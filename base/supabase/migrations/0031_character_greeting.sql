-- Cycle 0025 — Character greeting (first message).
-- The character's opening line, auto-inserted as the first assistant
-- message when a new conversation starts. Separate from `scenario`
-- which is the scene description displayed as a visual card.

alter table public.characters
  add column greeting text;
