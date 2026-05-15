-- Cycle 0021 — ElevenLabs as a second BYOK TTS provider + Speed/Volume
-- client-side slider prefs. Keeps both provider keys around; one
-- active at a time. Voice slots move into a per-family nested block
-- under preferences.tts so switching active doesn't clobber the other
-- provider's picks.

-- 1. Upsert now scopes by (user, kind, family). Each family gets one
--    row. Active switching is a separate op so the caller can rotate
--    a key without re-declaring active state.
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
  has_any_active boolean;
begin
  if uid is null then raise exception 'auth required'; end if;
  if p_provider_family not in ('openai', 'elevenlabs') then
    raise exception 'unknown tts provider family: %', p_provider_family;
  end if;

  select * into old_row
    from public.provider_configs
    where user_id = uid and kind = 'tts' and provider_family = p_provider_family
    limit 1;

  if rotating_key then
    new_secret_id := vault.create_secret(
      p_api_key,
      format('byok_tts_%s_%s_%s', uid, p_provider_family, extract(epoch from now())::bigint),
      'BYOK TTS key (StoryPlots v0)'
    );
    if old_row.vault_secret_id is not null then
      delete from vault.secrets where id = old_row.vault_secret_id;
    end if;
  elsif old_row.id is not null then
    new_secret_id := old_row.vault_secret_id;
  else
    new_secret_id := null;
  end if;

  -- Is there already an active TTS row for this user? First TTS row
  -- overall becomes active by default; subsequent rows keep whatever
  -- is_active the existing row had (or false for a brand-new other-
  -- family row, since another family is already active).
  select exists (
    select 1 from public.provider_configs
      where user_id = uid and kind = 'tts' and is_active
  ) into has_any_active;

  if old_row.id is not null then
    update public.provider_configs
      set provider_family = p_provider_family,
          vault_secret_id = new_secret_id,
          model_id        = p_voice_id
      where id = old_row.id
      returning * into result;
  else
    insert into public.provider_configs
      (user_id, kind, provider_family, vault_secret_id, model_id, is_active)
    values
      (uid, 'tts', p_provider_family, new_secret_id, p_voice_id,
       not has_any_active)
    returning * into result;
  end if;
  return result;
end;
$$;

grant execute on function public.upsert_tts_provider(text, text, text) to authenticated;

-- 2. Explicit active-provider flip. Only affects TTS rows (other
--    kinds untouched).
create or replace function public.switch_active_tts_provider(
  p_provider_family text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target_exists boolean;
begin
  if uid is null then raise exception 'auth required'; end if;
  if p_provider_family not in ('openai', 'elevenlabs') then
    raise exception 'unknown tts provider family: %', p_provider_family;
  end if;

  select exists (
    select 1 from public.provider_configs
      where user_id = uid and kind = 'tts' and provider_family = p_provider_family
  ) into target_exists;
  if not target_exists then
    raise exception 'no TTS row for family % — save a key first', p_provider_family;
  end if;

  update public.provider_configs
    set is_active = (provider_family = p_provider_family)
    where user_id = uid and kind = 'tts';
end;
$$;

grant execute on function public.switch_active_tts_provider(text) to authenticated;

-- 3. Extend set_user_tts_prefs with speed + volume. Drop the cycle-
--    0025 6-arg signature and replace with the 8-arg version (all
--    nullable for partial updates). Keep legacy flat voice params
--    wired to the openai nested block for backward compat with any
--    stale caller — new frontend code uses set_tts_voices() instead.
drop function if exists public.set_user_tts_prefs(text, boolean, text, text, text, text);

create or replace function public.set_user_tts_prefs(
  p_mode                text    default null,
  p_dual_voice          boolean default null,
  p_narrator_voice      text    default null,
  p_char_voice_male     text    default null,
  p_char_voice_female   text    default null,
  p_char_voice_fallback text    default null,
  p_speed               numeric default null,
  p_volume              numeric default null
)
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
  if p_speed is not null and (p_speed < 0.5 or p_speed > 2.0) then
    raise exception 'speed out of range: %', p_speed;
  end if;
  if p_volume is not null and (p_volume < 0 or p_volume > 1) then
    raise exception 'volume out of range: %', p_volume;
  end if;

  select coalesce(preferences, '{}'::jsonb) into current_prefs
    from public.users where id = auth.uid();

  current_prefs := jsonb_set(current_prefs, '{tts}',
                             coalesce(current_prefs -> 'tts', '{}'::jsonb), true);

  if p_mode is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,mode}', to_jsonb(p_mode), true);
  end if;
  if p_dual_voice is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,dual_voice}', to_jsonb(p_dual_voice), true);
  end if;
  if p_speed is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,speed}', to_jsonb(p_speed), true);
  end if;
  if p_volume is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,volume}', to_jsonb(p_volume), true);
  end if;

  -- Legacy flat params feed the OpenAI-family nested slots.
  current_prefs := jsonb_set(current_prefs, '{tts,openai}',
                             coalesce(current_prefs -> 'tts' -> 'openai', '{}'::jsonb), true);
  if p_narrator_voice is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,openai,narrator}', to_jsonb(p_narrator_voice), true);
  end if;
  if p_char_voice_male is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,openai,char_male}', to_jsonb(p_char_voice_male), true);
  end if;
  if p_char_voice_female is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,openai,char_female}', to_jsonb(p_char_voice_female), true);
  end if;
  if p_char_voice_fallback is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,openai,char_fallback}', to_jsonb(p_char_voice_fallback), true);
  end if;

  update public.users set preferences = current_prefs where id = auth.uid();
end;
$$;

grant execute on function public.set_user_tts_prefs(text, boolean, text, text, text, text, numeric, numeric) to authenticated;

-- 4. Per-family voice slot setter. Replaces all 4 slots for one
--    family in a single call. Partial-update per-slot would bloat
--    the signature — the frontend loads current prefs first and
--    sends the whole block.
create or replace function public.set_tts_voices(
  p_provider_family text,
  p_narrator        text,
  p_char_male       text,
  p_char_female     text,
  p_char_fallback   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_prefs jsonb;
  family_block  jsonb;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if p_provider_family not in ('openai', 'elevenlabs') then
    raise exception 'unknown tts provider family: %', p_provider_family;
  end if;

  family_block := jsonb_build_object(
    'narrator',      p_narrator,
    'char_male',     p_char_male,
    'char_female',   p_char_female,
    'char_fallback', p_char_fallback
  );

  select coalesce(preferences, '{}'::jsonb) into current_prefs
    from public.users where id = auth.uid();
  current_prefs := jsonb_set(current_prefs, '{tts}',
                             coalesce(current_prefs -> 'tts', '{}'::jsonb), true);
  current_prefs := jsonb_set(current_prefs,
                             array['tts', p_provider_family],
                             family_block, true);

  update public.users set preferences = current_prefs where id = auth.uid();
end;
$$;

grant execute on function public.set_tts_voices(text, text, text, text, text) to authenticated;

-- 5. Data migration — move any flat TTS voice keys into the openai
--    nested block. Idempotent; a user with only the new shape has
--    nothing to migrate.
update public.users
set preferences = jsonb_set(
  preferences,
  '{tts,openai}',
  coalesce(preferences -> 'tts' -> 'openai', '{}'::jsonb) ||
  jsonb_strip_nulls(jsonb_build_object(
    'narrator',      preferences -> 'tts' -> 'narrator_voice',
    'char_male',     preferences -> 'tts' -> 'char_voice_male',
    'char_female',   preferences -> 'tts' -> 'char_voice_female',
    'char_fallback', preferences -> 'tts' -> 'char_voice_fallback'
  )),
  true
)
where preferences -> 'tts' ? 'narrator_voice'
   or preferences -> 'tts' ? 'char_voice_male'
   or preferences -> 'tts' ? 'char_voice_female'
   or preferences -> 'tts' ? 'char_voice_fallback';

update public.users
set preferences = preferences
  #- '{tts,narrator_voice}'
  #- '{tts,char_voice_male}'
  #- '{tts,char_voice_female}'
  #- '{tts,char_voice_fallback}'
where preferences -> 'tts' ? 'narrator_voice'
   or preferences -> 'tts' ? 'char_voice_male'
   or preferences -> 'tts' ? 'char_voice_female'
   or preferences -> 'tts' ? 'char_voice_fallback';
