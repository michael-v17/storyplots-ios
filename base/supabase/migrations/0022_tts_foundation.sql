-- Cycle 0017 — TTS foundation (single-voice playback).
-- Satisfies schema.md §2.11 (auto_tts reader), §2.17 (tts kind already in
-- the enum from 0007), creator-vision.md §5.7, user-stories.md #43 + #49.
-- Dual-voice + ElevenLabs + WebSpeech ship in cycle 0018.

-- Cache table — one audio file per (message_variant, provider_family, voice).
-- Variants are immutable once created so a cache entry is stable for its
-- lifetime. Re-play on an existing row skips the provider call.
create table public.message_audio (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  variant_id          uuid not null references public.message_variants(id) on delete cascade,
  provider_family     text not null,
  voice_id            text,
  storage_ref         text,
  duration_ms         integer,
  provider_snapshot   jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  unique (variant_id, provider_family, voice_id)
);

alter table public.message_audio enable row level security;

create policy message_audio_select_own on public.message_audio
  for select using (user_id = auth.uid());
create policy message_audio_insert_own on public.message_audio
  for insert with check (user_id = auth.uid());
create policy message_audio_delete_own on public.message_audio
  for delete using (user_id = auth.uid());

create index message_audio_variant on public.message_audio (variant_id);

-- Private bucket, per-user path-prefix RLS. Same pattern as the 0014
-- `generated-media` and 0013 `character-imports` buckets.
insert into storage.buckets (id, name, public)
  values ('generated-audio', 'generated-audio', false)
  on conflict (id) do nothing;

create policy generated_audio_owner_select on storage.objects for select
  using (bucket_id = 'generated-audio'
         and (storage.foldername(name))[1] = auth.uid()::text);
create policy generated_audio_owner_insert on storage.objects for insert
  with check (bucket_id = 'generated-audio'
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy generated_audio_owner_update on storage.objects for update
  using (bucket_id = 'generated-audio'
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'generated-audio'
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy generated_audio_owner_delete on storage.objects for delete
  using (bucket_id = 'generated-audio'
         and (storage.foldername(name))[1] = auth.uid()::text);


-- BYOK TTS provider upsert — parallels upsert_text_provider (0007) +
-- upsert_image_provider (0016). Stores the voice id in provider_configs.model_id
-- so we can reuse the existing is_active = true uniqueness per (user, kind).
create or replace function public.upsert_tts_provider(
  p_provider_family text,
  p_api_key         text,
  p_voice_id        text
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
  if uid is null then raise exception 'auth required'; end if;

  select * into old_row
    from public.provider_configs
    where user_id = uid and kind = 'tts' and is_active
    limit 1;

  if rotating_key then
    new_secret_id := vault.create_secret(
      p_api_key,
      format('byok_tts_%s_%s', uid, extract(epoch from now())::bigint),
      'BYOK TTS-provider key (StoryPlots v0)'
    );
    if old_row.vault_secret_id is not null then
      delete from vault.secrets where id = old_row.vault_secret_id;
    end if;
  elsif old_row.id is not null then
    new_secret_id := old_row.vault_secret_id;
  else
    new_secret_id := null;
  end if;

  if old_row.id is not null then
    update public.provider_configs
      set is_active       = true,
          provider_family = p_provider_family,
          vault_secret_id = new_secret_id,
          model_id        = p_voice_id
      where id = old_row.id
      returning * into result;
  else
    insert into public.provider_configs
      (user_id, kind, provider_family, vault_secret_id, model_id, is_active)
    values
      (uid, 'tts', p_provider_family, new_secret_id, p_voice_id, true)
    returning * into result;
  end if;
  return result;
end;
$$;

grant execute on function public.upsert_tts_provider(text, text, text) to authenticated;


create or replace function public.get_active_tts_key()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select decrypted_secret into k
    from vault.decrypted_secrets
    where id = (
      select vault_secret_id from public.provider_configs
        where user_id = auth.uid() and kind = 'tts' and is_active
        limit 1
    );
  return k;
end;
$$;

grant execute on function public.get_active_tts_key() to authenticated;


-- Atomic merge for users.preferences.tts — parent-seed pattern from the
-- cycle 0016.2 fix (jsonb_set no-ops when the parent doesn't exist).
create or replace function public.set_user_tts_prefs(p_mode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_prefs jsonb;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if p_mode is not null and p_mode not in ('manual', 'auto') then
    raise exception 'invalid tts mode: %', p_mode;
  end if;

  select coalesce(preferences, '{}'::jsonb) into current_prefs
    from public.users where id = auth.uid();

  current_prefs := jsonb_set(
    current_prefs, '{tts}',
    coalesce(current_prefs -> 'tts', '{}'::jsonb),
    true
  );
  if p_mode is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,mode}', to_jsonb(p_mode), true);
  end if;

  update public.users set preferences = current_prefs where id = auth.uid();
end;
$$;

grant execute on function public.set_user_tts_prefs(text) to authenticated;
