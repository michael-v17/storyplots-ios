-- Cycle 0091 — fal.ai provider scaffold: schema columns for dual-store
-- (Storage + external CDN URL), per-image style/engine snapshot, per-character
-- avatar_style snapshot, reference_ref for the white-bg reference image
-- (Decision A from Cycle 0090), and a `bucket` discriminator for the
-- cascade-delete helper of Cycle 0098.
--
-- Everything is additive + nullable (or with a safe default). No data backfill
-- required: NULL on a row means "ComfyUI generated, pre-fal era". Code paths
-- branch on `engine` / `provider_family` to interpret correctly.

-- =============================================================================
-- generated_images: per-image snapshots + dual-store URLs + bucket discriminator
-- =============================================================================
alter table public.generated_images
  add column if not exists style                       text,
  add column if not exists engine                      text,
  add column if not exists external_url                text,
  add column if not exists external_url_provider       text,
  add column if not exists external_url_captured_at    timestamptz,
  add column if not exists bytes_size                  integer,
  add column if not exists bucket                      text not null default 'generated-media';

-- Index for the Cycle 0094 display_url logic that needs to filter by
-- (engine, age) cheaply when computing per-image render strategy.
create index if not exists generated_images_engine_captured
  on public.generated_images (engine, external_url_captured_at)
  where external_url is not null;

comment on column public.generated_images.style is
  'Snapshot of users.preferences.image.style at gen time (realistic|anime|custom). NULL on legacy / pre-fal rows.';
comment on column public.generated_images.engine is
  'Image engine that produced this row (comfyui|fal). NULL on pre-Cycle-0091 rows — treat as ''comfyui''.';
comment on column public.generated_images.external_url is
  'For fal-engine rows: the CDN URL fal returns at gen time. Frontend renders from this for the first 24h after capture (Cycle 0094 display_url policy), then falls back to signed Storage URL.';
comment on column public.generated_images.external_url_captured_at is
  'When the external_url was captured. Used by Cycle 0094 to decide whether the URL is still likely to be fresh (<24h policy boundary).';
comment on column public.generated_images.bytes_size is
  'Compressed bytes after WebP encoding (Cycle 0092). NULL on pre-compression rows.';
comment on column public.generated_images.bucket is
  'Supabase Storage bucket where the object lives. Driven by kind: generated-media for chat scenes, avatars for character/persona avatars + references. Needed by the Cycle 0098 cascade-delete helper to know which bucket to scrub.';

-- =============================================================================
-- characters: dual-store URLs + reference_ref + avatar_style snapshot
-- =============================================================================
alter table public.characters
  add column if not exists reference_ref                       text,
  add column if not exists avatar_style                        text,
  add column if not exists avatar_external_url                 text,
  add column if not exists avatar_external_url_captured_at     timestamptz,
  add column if not exists reference_external_url              text,
  add column if not exists reference_external_url_captured_at  timestamptz;

comment on column public.characters.reference_ref is
  'Storage path for the white-bg half-body reference image used as image_urls[0] in fal /edit chat-scene calls (Cycle 0090 Decision A). NULL when no fal avatar has been generated for this character.';
comment on column public.characters.avatar_style is
  'Snapshot of the global users.preferences.image.style at avatar gen time. Chat scenes for this character read this field (NOT the global) when picking a style template — preserves the character''s look across global preference flips. UI surfaces a hint in CharacterEdit when avatar_style != global style.';
comment on column public.characters.avatar_external_url is
  'fal CDN URL for the avatar at gen time. Mirrors the dual-store strategy: Storage is canonical for avatars (always rendered from there) but the external URL is captured for the brief async-upload window post-gen.';

-- =============================================================================
-- user_personas: same scaffold as characters
-- =============================================================================
alter table public.user_personas
  add column if not exists reference_ref                       text,
  add column if not exists avatar_style                        text,
  add column if not exists avatar_external_url                 text,
  add column if not exists avatar_external_url_captured_at     timestamptz,
  add column if not exists reference_external_url              text,
  add column if not exists reference_external_url_captured_at  timestamptz;

comment on column public.user_personas.reference_ref is
  'Persona equivalent of characters.reference_ref. NULL when persona has no fal-generated reference.';

-- =============================================================================
-- Backfill bucket on existing rows. Postgres 11+ uses a fast-path that records
-- the DEFAULT value in the catalog without rewriting tuples — reads of
-- pre-existing rows return 'generated-media' transparently and the NOT NULL
-- constraint is satisfied. The UPDATE below physicalises the value so:
--   (a) older Postgres instances and replication consumers reading raw tuples
--       see the value on disk, not just via catalog default;
--   (b) any future ALTER that drops/changes the default doesn't strand
--       previously-implicit-default rows.
-- Required for correctness across Postgres versions, not redundant.
-- =============================================================================
update public.generated_images
  set bucket = 'generated-media'
  where bucket is null;
