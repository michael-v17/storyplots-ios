-- Cycle 0022 — per-character TTS voice override.
-- When set, these override the global gender-matched voice slots for
-- this specific character. When null, the global routing (gender →
-- male/female/fallback slot) applies as before.
-- The stored voice_id matches whatever provider is active at save time
-- (OpenAI name or ElevenLabs UUID). If the user switches providers,
-- the override may not match — they can clear it and re-pick.

alter table public.characters
  add column tts_narrator_voice_id  text,
  add column tts_character_voice_id text;
