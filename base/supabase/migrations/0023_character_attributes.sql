-- Cycle 0018 — Canonical physical attributes on Character.
-- Satisfies domain.md §2.3 (Character identity) and prepares the base for
-- cycle 0019 (TTS dual-voice with gender-matched voices + ElevenLabs
-- voice selection hints).
--
-- Design: ONLY the canonical identity lives here. Dynamic state (current
-- outfit / pose / location / mood mid-story) stays in the conversation
-- context — `recent_turns` already drives that for the image refiner
-- from cycle 0014.1. The signature_style field is the DEFAULT attire; a
-- scene that mentions different clothing overrides it at render time.
--
-- All fields are nullable: existing characters keep working without any
-- structured data; the refiner falls back to the legacy prose-parse path
-- when fields are null.

alter table public.characters
  add column age                  text,
  add column gender               text,
  add column build                text,
  add column height               text,
  add column hair_color           text,
  add column hair_style           text,
  add column eye_color            text,
  add column skin_tone            text,
  add column distinctive_features text,
  add column signature_style      text,
  add column voice_style          text;

-- Gender is the only field with a CHECK — TTS and image pipelines branch
-- on specific values. The other fields stay free-text so the user isn't
-- boxed into a fixed vocabulary (e.g. "plus-size" / "petite" / "heavyset"
-- are all valid values for `build`).
alter table public.characters
  add constraint characters_gender_valid
  check (gender is null or gender in ('male', 'female', 'non_binary', 'unspecified'));
