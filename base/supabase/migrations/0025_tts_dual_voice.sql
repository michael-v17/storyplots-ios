-- Cycle 0020 — TTS dual-voice (narrator + character voices).
-- Splits each assistant reply into narrator segments (*italic*) and
-- character segments ("quoted"); each segment caches separately keyed
-- on its segment index so one reply can have N rows for the same
-- variant/family. Voice selection per segment branches on
-- character.gender (shipped in cycle 0018).

-- Segment index defaults to 0 — existing cycle-0017 rows (single-voice,
-- one segment per variant) keep working as segment 0.
alter table public.message_audio
  add column segment_index integer not null default 0;

-- Swap the uniqueness key. The old shape — (variant, family, voice) —
-- would collide when two segments of the same reply happen to route to
-- the same voice (e.g. narrator == char_voice_male). Include
-- segment_index so each segment gets its own row.
alter table public.message_audio
  drop constraint message_audio_variant_id_provider_family_voice_id_key;

alter table public.message_audio
  add constraint message_audio_variant_family_voice_segment_key
  unique (variant_id, provider_family, voice_id, segment_index);

-- Extend the atomic preferences writer for the new voice prefs. All
-- new params default null so callers can partial-update any combination
-- without clobbering the others. Parent-seed pattern from 0016.2 still
-- applies — the {tts} parent was already seeded by cycle 0017's version
-- of this function, but we re-seed defensively for rows that never had
-- a tts block.
create or replace function public.set_user_tts_prefs(
  p_mode                text    default null,
  p_dual_voice          boolean default null,
  p_narrator_voice      text    default null,
  p_char_voice_male     text    default null,
  p_char_voice_female   text    default null,
  p_char_voice_fallback text    default null
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
  if p_dual_voice is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,dual_voice}', to_jsonb(p_dual_voice), true);
  end if;
  if p_narrator_voice is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,narrator_voice}', to_jsonb(p_narrator_voice), true);
  end if;
  if p_char_voice_male is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,char_voice_male}', to_jsonb(p_char_voice_male), true);
  end if;
  if p_char_voice_female is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,char_voice_female}', to_jsonb(p_char_voice_female), true);
  end if;
  if p_char_voice_fallback is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,char_voice_fallback}', to_jsonb(p_char_voice_fallback), true);
  end if;

  update public.users set preferences = current_prefs where id = auth.uid();
end;
$$;

grant execute on function public.set_user_tts_prefs(text, boolean, text, text, text, text) to authenticated;

-- Drop the old single-param signature so callers don't accidentally
-- bind to it (PostgREST resolves by param count). The new function
-- above with all defaults null covers the mode-only call site too.
drop function if exists public.set_user_tts_prefs(text);
