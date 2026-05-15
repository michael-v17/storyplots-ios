-- 0045_character_rp_overrides.sql
-- Cycle 0130 — per-character Roleplay scaffolding overrides.
--
-- Adds characters.rp_overrides: a per-character override of the three
-- system-level RP settings that today live only in users.preferences.rp
-- (cycle 0113 / migration 0039). Shape:
--   { "author_framing": bool, "pacing": "off"|"slow_burn"|"warm", "style_anchor": bool }
-- Any missing key = inherit that key from the global default. NULL / {} = inherit
-- everything (identical to pre-0130 behaviour).
--
-- Nullable + default NULL so every existing row keeps inheriting the global.
-- The value is snapshotted into conversations.character_snapshot at creation
-- time (snapshot semantics, creator-vision §8) — editing a character later does
-- not mutate existing conversations. RLS is inherited from the characters
-- policies (migration 0004).

alter table public.characters
  add column rp_overrides jsonb;
