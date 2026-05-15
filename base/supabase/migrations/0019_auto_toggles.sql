-- Cycle 0016 — per-Conversation auto-mode toggles.
-- schema.md §2.11 lists auto_images + auto_tts as overrides for the Visual
-- Roleplay + TTS per-user defaults. auto_tts column ships with an empty
-- reader in v0 (no TTS code yet); it lights up when the TTS cycle lands.
--
-- No RLS change — the chat_controls_state policies from migration 0017
-- cover these new columns.

alter table public.chat_controls_state
  add column auto_images boolean,
  add column auto_tts    boolean;
