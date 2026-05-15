-- 0040_dialogue_examples.sql
-- Cycle 0115 — Ali:Chat dialogue examples.
--
-- Adds characters.dialogue_examples jsonb (array of {user_msg, char_reply, kind})
-- where kind ∈ ("everyday" | "refusal" | "unguarded"). Used by the refiner to
-- produce voice samples (≥1 refusal mandatory per doc §3.2) and rendered as
-- Position 5.5 "# Voice Samples" in the prompt assembly with <START> delimiter.
--
-- No constraint on shape — validated client-side and at assembly time. Nullable
-- so existing characters and pre-cycle imports continue to work; the prompt
-- assembly silently skips Position 5.5 when the column is null or empty.

alter table public.characters
  add column if not exists dialogue_examples jsonb;
