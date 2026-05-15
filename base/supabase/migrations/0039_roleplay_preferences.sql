-- 0039_roleplay_preferences.sql
-- Cycle 0113 — Roleplay scaffolding defaults.
--
-- Seeds users.preferences.rp with the three system-level RP settings:
--   author_framing  bool (default true)   — inject Position 0 "Author Framing" block
--   pacing          text (default 'slow_burn')  — off | slow_burn | warm
--   style_anchor    bool (default true)   — inject depth-0 "[System note: …]" every turn
--
-- Idempotent: only seeds rows that don't already have a `rp` key. Frontend
-- loader and backend bundle reader both apply defaults via coalesce when
-- `users.preferences.rp` is null, so new users created post-migration work
-- without this seed having touched their row.

update public.users
set preferences = jsonb_set(
  coalesce(preferences, '{}'::jsonb),
  '{rp}',
  '{"author_framing": true, "pacing": "slow_burn", "style_anchor": true}'::jsonb,
  true
)
where coalesce(preferences -> 'rp', 'null'::jsonb) = 'null'::jsonb;
