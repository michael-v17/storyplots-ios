-- Cycle 0019 — Per-character image seed lock.
-- When set, every image generation for this character reuses this
-- seed (visual-consistency lock). When null, the backend picks a
-- fresh random seed per call.
--
-- Default ON: existing characters are backfilled with a per-row
-- random seed. New characters get a seed assigned at creation time
-- by the frontend emptyDraft() / import baseDraft(). The column
-- default stays null so a direct INSERT that omits it (e.g. a test
-- fixture) still opts out of the lock.

alter table public.characters
  add column image_seed bigint;

update public.characters
  set image_seed = floor(random() * 2147483647)::bigint + 1
  where image_seed is null;
