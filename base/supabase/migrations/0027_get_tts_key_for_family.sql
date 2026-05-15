-- Cycle 0021 follow-up — surgical key lookup by provider_family.
-- The cycle-0021 /providers/tts/elevenlabs/voices proxy needs the
-- ElevenLabs key even when that family isn't the active TTS provider
-- (the user is setting things up; the voice picker loads before the
-- user flips active). The existing get_active_tts_key() only reads the
-- is_active row, so we'd need to temporarily flip active — racy under
-- concurrent synth requests. A dedicated by-family reader is surgical
-- and state-free.

create or replace function public.get_tts_key_for_family(
  p_provider_family text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if p_provider_family not in ('openai', 'elevenlabs') then
    raise exception 'unknown tts provider family: %', p_provider_family;
  end if;
  select decrypted_secret into k
    from vault.decrypted_secrets
    where id = (
      select vault_secret_id from public.provider_configs
        where user_id = auth.uid()
          and kind = 'tts'
          and provider_family = p_provider_family
        limit 1
    );
  return k;
end;
$$;

grant execute on function public.get_tts_key_for_family(text) to authenticated;
