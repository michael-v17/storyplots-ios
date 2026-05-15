# Plan 0092 — Image compression pipeline (WebP, never PNG)

status: in_progress
date: 2026-05-05

## Motivation

Cycle 0090 confirmed Seedream PNG outputs weigh 3.5-4.2 MB each — at 50 chat scenes per character × 10 characters that's ~1.9 GB of Storage just for chat scenes. WebP at quality 82 lands at ~250-400 KB → ~93% reduction. Block this in BEFORE Cycle 0093 (which starts saving fal output to Storage at scale).

ComfyUI today writes PNG too. This cycle covers all three sources:
1. Generated outputs (ComfyUI today; fal once Cycles 0093/0094 wire).
2. User-uploaded avatars (CharacterForm paste / file picker / import).

Goals:
- Never write PNG/JPEG to Supabase Storage. WebP only.
- Quality 82, max 2048 px (1024 for references), target ≤500 KB scene/avatar / ≤350 KB reference.
- Persist compressed `bytes_size` to `generated_images.bytes_size` (column added in 0091's 0037 migration).
- Storage path extension reflects format (`.webp`), so signed-URL fetches return correct `Content-Type`.
- Telemetry: log `kind / dim_in / dim_out / bytes_in / bytes_out / quality` per compression.

Non-goals (defer):
- Retroactive recompression of existing PNGs in xvm's `generated-media` (the new project has nothing yet — xvp@storyplots.app's bucket is empty). MVX cleanup ships when we switch back, owned by Cycle 0098 cascade-cleanup which already plans an `--apply` sweep.
- AVIF (encoder cost too high for marginal gain over WebP).

## Implementation order

### Subtask 1 — Compression utility
- New `backend/app/lib/image_compress.py`:
  - `compress_for_storage(image_bytes, kind="scene"|"avatar"|"reference") -> CompressionResult` dataclass `{bytes, mime, width, height, bytes_size, quality_used}`.
  - Pillow-based: open → maybe-resize (max 2048 for scene/avatar, 1024 for reference) → re-encode WebP.
  - Adaptive quality: start 85 → step down by 5 if bytes > target_kb (target 500 scene/avatar, 350 reference); floor 70.
  - Logs each compression as a structured INFO line.
- Add `Pillow>=10.0` to `backend/pyproject.toml`.
- Smoke test: feed PNG → output WebP < target, dims preserved or reduced.

### Subtask 2 — Wire into all image upload sites
Grep `storage.upload\|upload_bytes` filtered to image buckets (`generated-media`, `avatars`):
- `routes/image.py` chat-scene gen → compress(kind="scene") → upload `.webp`.
- `routes/avatar_generate.py` character + persona avatar gen → compress(kind="avatar") → upload `.webp`.
- Character avatar paste / import (find via grep).

Each site:
1. Replace raw `image_bytes` with `compress_for_storage(image_bytes, kind=...)`.
2. Update `storage_ref` extension to `.webp`.
3. Pass `image/webp` as content_type.
4. Persist `bytes_size = result.bytes_size` in the `generated_images` insert (only applicable to gen sites; uploads to `avatars` bucket have no DB row).

### Subtask 3 — Smoke test live
Generate one ComfyUI avatar via `xvp@storyplots.app` after switching back to ComfyUI provider. Verify:
- Storage object lands at `<user>/<id>.webp`.
- `generated_images.bytes_size` populated, < 500 KB.
- Avatar renders correctly in CharacterEdit / Chat.

### Subtask 4 — Plugin gates + commit
- code-review focused on: format detection edge cases (animated GIF? alpha? grayscale? CMYK? truncated?), security (Pillow zip-bomb / decompression DoS guards), Pillow version compatibility.
- code-simplifier on the utility.
- Commit `feat(0092): WebP compression pipeline for all image uploads`.
- Update SESSION_HANDOFF.

## Critical files

| Layer | Path |
|---|---|
| Util (new) | `backend/app/lib/image_compress.py` |
| Deps | `backend/pyproject.toml` (+Pillow) |
| Chat scene | `backend/app/routes/image.py:643-644` |
| Avatar gen | `backend/app/routes/avatar_generate.py` (×2 endpoints) |
| Avatar upload | TBD via grep |

## Risks

- **Alpha channel preservation**: ComfyUI outputs sometimes have alpha (transparent bg avatars). WebP supports alpha — verify Pillow encodes it.
- **Animated content**: any GIFs from user uploads? Probably no. Skip if simple.
- **Existing PNG storage_ref entries**: stay valid. New rows are `.webp`. Frontend reads from DB `storage_ref`, no hardcoded extension.
- **Pillow decompression bombs**: enable `Image.MAX_IMAGE_PIXELS` cap or rely on size limit at the upload boundary.

## Verification

_(to be appended at close)_
