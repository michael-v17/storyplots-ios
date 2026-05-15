-- Cycle 0090 — fal.ai BYOK requires comfyui + fal image providers to coexist
-- per user, with only one active at a time. The v1 upsert_image_provider
-- (migration 0016) finds the single active row and overwrites its family
-- and workflow_config — fine when there's only one provider, breaks when
-- you want to switch back to the previous one without re-pasting its key.
--
-- This migration adds two sibling RPCs that route by (user_id, kind, family):
--   - upsert_image_provider_v2 — insert/update the row for one family,
--     keep other-family rows intact, atomically flip is_active.
--   - set_active_image_provider — switch active family without rotating the key.
--
-- v1 stays untouched for backwards compat (ComfyUI form continues to call it).
-- New fal.ai section in ImageEngineSettings calls v2.

create or replace function public.upsert_image_provider_v2(
  p_provider_family  text,
  p_base_url         text,
  p_api_key          text,
  p_workflow_config  jsonb
) returns public.provider_configs
language plpgsql
security definer
set search_path = public
as $$
declare
  uid           uuid := auth.uid();
  family_row    public.provider_configs;
  new_secret_id uuid;
  result        public.provider_configs;
  rotating_key  boolean := p_api_key is not null and btrim(p_api_key) <> '';
begin
  if uid is null then raise exception 'auth required'; end if;
  if p_provider_family is null or btrim(p_provider_family) = '' then
    raise exception 'provider_family is required';
  end if;

  -- Find row for this specific (user, kind, family). Picks the most recently
  -- touched row if duplicates ever exist (defensive — schema doesn't prevent
  -- duplicate inactive rows for the same family).
  select * into family_row
    from public.provider_configs
    where user_id = uid and kind = 'image' and provider_family = p_provider_family
    order by updated_at desc
    limit 1;

  -- Vault round-trip: rotate only THIS family's secret. Other-family rows'
  -- vault_secret_id stays untouched.
  if rotating_key then
    new_secret_id := vault.create_secret(
      p_api_key,
      format('byok_image_%s_%s_%s', p_provider_family, uid, extract(epoch from now())::bigint),
      format('BYOK image-provider key (%s, StoryPlots v0)', p_provider_family)
    );
    if family_row.vault_secret_id is not null then
      delete from vault.secrets where id = family_row.vault_secret_id;
    end if;
  elsif family_row.id is not null then
    new_secret_id := family_row.vault_secret_id;
  else
    new_secret_id := null;
  end if;

  -- Step 1: deactivate every OTHER family row for this user+kind. Done first
  -- to avoid violating the partial unique index (one is_active=true per
  -- (user_id, kind)) when we activate the target row.
  update public.provider_configs
    set is_active = false
    where user_id = uid
      and kind = 'image'
      and provider_family <> p_provider_family
      and is_active;

  -- Step 2: upsert the target-family row + activate it.
  if family_row.id is not null then
    update public.provider_configs
      set is_active       = true,
          base_url        = p_base_url,
          vault_secret_id = new_secret_id,
          workflow_config = p_workflow_config
      where id = family_row.id
      returning * into result;
  else
    insert into public.provider_configs
      (user_id, kind, provider_family, base_url, vault_secret_id,
       workflow_config, is_active)
    values
      (uid, 'image', p_provider_family, p_base_url, new_secret_id,
       p_workflow_config, true)
    returning * into result;
  end if;

  return result;
end;
$$;

grant execute on function public.upsert_image_provider_v2(text, text, text, jsonb) to authenticated;

-- Switch active image provider by family. Used when the user already pasted
-- both keys and wants to flip without re-saving config. **Raises** if the
-- named family has no row for this user — callers should only invoke this
-- when the row is confirmed to exist (the UI gates the button on `falRow` /
-- `existing` being non-null, so the raise is a defensive guard, not a
-- normal control-flow path).
create or replace function public.set_active_image_provider(
  p_provider_family text
) returns public.provider_configs
language plpgsql
security definer
set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  result public.provider_configs;
begin
  if uid is null then raise exception 'auth required'; end if;
  if p_provider_family is null or btrim(p_provider_family) = '' then
    raise exception 'provider_family is required';
  end if;

  -- Verify the family row exists; if not, raise so the UI can surface.
  perform 1
    from public.provider_configs
    where user_id = uid and kind = 'image' and provider_family = p_provider_family
    limit 1;
  if not found then
    raise exception 'no provider_configs row for family %', p_provider_family;
  end if;

  -- Same two-step flip as v2 to stay safe with the partial unique index.
  update public.provider_configs
    set is_active = false
    where user_id = uid
      and kind = 'image'
      and provider_family <> p_provider_family
      and is_active;

  update public.provider_configs
    set is_active = true
    where user_id = uid
      and kind = 'image'
      and provider_family = p_provider_family
      and not is_active
    returning * into result;

  -- If the row was already active, the UPDATE above returns 0 rows — fetch it.
  if result.id is null then
    select * into result
      from public.provider_configs
      where user_id = uid and kind = 'image' and provider_family = p_provider_family
      order by updated_at desc
      limit 1;
  end if;

  return result;
end;
$$;

grant execute on function public.set_active_image_provider(text) to authenticated;
