-- Cycle 0007 — provider_configs + Vault-backed encryption.
-- Satisfies schema.md §2.17, §5 rule #8; domain.md §2.17, §6 invariants
-- #1 #11 #15 #18; user-stories.md §5.9 story #39 (no Test Connection, no
-- model refresh — deferred to cycle 0008).
-- Resolves open-questions.md §2.3 (envelope encryption) via Supabase Vault.

create type public.provider_kind as enum ('text', 'image', 'video', 'tts', 'stt');

create table public.provider_configs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  kind               public.provider_kind not null,
  provider_family    text not null,
  base_url           text,
  vault_secret_id    uuid,                              -- into vault.secrets
  api_key_encrypted  bytea,                             -- schema.md §2.17 preserved; unused when vault_secret_id is set
  model_id           text,
  temperature        numeric,
  max_tokens         integer,
  context_length     integer,
  thinking_mode      boolean not null default false,
  workflow_config    jsonb,
  last_tested_ok     boolean,
  last_tested_at     timestamptz,
  is_active          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- schema.md §5 rule #8: exactly one is_active=true per (user_id, kind).
create unique index provider_configs_one_active_per_kind
  on public.provider_configs (user_id, kind) where is_active;

create index provider_configs_user_kind
  on public.provider_configs (user_id, kind);

alter table public.provider_configs enable row level security;

create policy provider_configs_select_own on public.provider_configs
  for select using (user_id = auth.uid());
create policy provider_configs_insert_own on public.provider_configs
  for insert with check (user_id = auth.uid());
create policy provider_configs_update_own on public.provider_configs
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());
create policy provider_configs_delete_own on public.provider_configs
  for delete using (user_id = auth.uid());

create trigger provider_configs_touch_updated_at
  before update on public.provider_configs
  for each row execute function public.touch_updated_at();

-- Upsert the active text provider. Rotates the Vault secret (drops the
-- old, creates a new) so a previously-stored key is never left dangling.
-- Leaving p_api_key null/blank keeps whatever key was there before.
create or replace function public.upsert_text_provider(
  p_provider_family  text,
  p_base_url         text,
  p_api_key          text,
  p_model_id         text,
  p_temperature      numeric,
  p_max_tokens       integer,
  p_context_length   integer,
  p_thinking_mode    boolean
) returns public.provider_configs
language plpgsql
security definer
set search_path = public
as $$
declare
  uid           uuid := auth.uid();
  old_row       public.provider_configs;
  new_secret_id uuid;
  result        public.provider_configs;
  rotating_key  boolean := p_api_key is not null and btrim(p_api_key) <> '';
begin
  if uid is null then
    raise exception 'auth required';
  end if;

  -- Find the current active text row, if any.
  select * into old_row
    from public.provider_configs
    where user_id = uid and kind = 'text' and is_active
    limit 1;

  -- If rotating (new key supplied) or no previous row: mint a new Vault secret.
  if rotating_key then
    new_secret_id := vault.create_secret(
      p_api_key,
      format('byok_text_%s_%s', uid, extract(epoch from now())::bigint),
      'BYOK text-provider key (StoryPlots v0)'
    );
    if old_row.vault_secret_id is not null then
      delete from vault.secrets where id = old_row.vault_secret_id;
    end if;
  elsif old_row.id is not null then
    -- Keep the existing secret.
    new_secret_id := old_row.vault_secret_id;
  else
    new_secret_id := null;
  end if;

  if old_row.id is not null then
    update public.provider_configs
      set is_active       = true,
          provider_family = p_provider_family,
          base_url        = p_base_url,
          vault_secret_id = new_secret_id,
          model_id        = p_model_id,
          temperature     = p_temperature,
          max_tokens      = p_max_tokens,
          context_length  = p_context_length,
          thinking_mode   = coalesce(p_thinking_mode, false)
      where id = old_row.id
      returning * into result;
  else
    insert into public.provider_configs
      (user_id, kind, provider_family, base_url, vault_secret_id,
       model_id, temperature, max_tokens, context_length, thinking_mode,
       is_active)
    values
      (uid, 'text', p_provider_family, p_base_url, new_secret_id,
       p_model_id, p_temperature, p_max_tokens, p_context_length,
       coalesce(p_thinking_mode, false),
       true)
    returning * into result;
  end if;

  return result;
end;
$$;

-- Only authenticated sessions can call. Anonymous sign-in users are already
-- the `authenticated` role from PostgREST's perspective (they hold a JWT
-- with role=authenticated), so this does not lock out anon-signed-in users;
-- it removes the attack surface for truly unauthenticated requests.
grant execute on function public.upsert_text_provider(
  text, text, text, text, numeric, integer, integer, boolean
) to authenticated;

-- Delete a provider config row and its Vault secret atomically.
create or replace function public.delete_provider(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.provider_configs;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  select * into row from public.provider_configs where id = p_id;
  if row.id is null or row.user_id <> auth.uid() then
    raise exception 'not found';
  end if;
  if row.vault_secret_id is not null then
    delete from vault.secrets where id = row.vault_secret_id;
  end if;
  delete from public.provider_configs where id = p_id;
end;
$$;

grant execute on function public.delete_provider(uuid) to authenticated;

-- Stamp users.preferences.security.cloud_consent_at atomically. Using
-- jsonb_set avoids the read-modify-write race that a client-side SELECT
-- then UPDATE would expose.
create or replace function public.stamp_cloud_consent()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  update public.users
    set preferences = jsonb_set(
      coalesce(preferences, '{}'::jsonb),
      '{security,cloud_consent_at}',
      to_jsonb(now_ts::text),
      true
    )
    where id = auth.uid();
  return now_ts;
end;
$$;

grant execute on function public.stamp_cloud_consent() to authenticated;
