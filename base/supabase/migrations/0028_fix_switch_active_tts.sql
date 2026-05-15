-- Fix: switch_active_tts_provider fails with unique constraint
-- violation because the single UPDATE sets both rows' is_active
-- simultaneously — Postgres checks constraints per-row during
-- multi-row updates, so the target row going true while the old
-- active row hasn't yet been flipped to false triggers
-- provider_configs_one_active_per_kind.
--
-- Fix: two-step deactivate-all → activate-target. Never has two
-- active rows at the same time.

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

  -- Step 1: deactivate ALL tts rows for this user.
  update public.provider_configs
    set is_active = false
    where user_id = uid and kind = 'tts';

  -- Step 2: activate only the target family.
  update public.provider_configs
    set is_active = true
    where user_id = uid and kind = 'tts' and provider_family = p_provider_family;
end;
$$;

grant execute on function public.switch_active_tts_provider(text) to authenticated;
