# Plan 0094 — fal.ai chat scene gen + storage backfill sweeper

status: shipped
date: 2026-05-05

## Motivation

The biggest cycle of the iniciativa fal.ai. Wires every chat-scene generation through fal/Seedream when the user has the fal provider active, with the dual-store async pattern decided 2026-05-05: response is fast (fal CDN URL), Storage upload + compression happen out-of-band via a sweeper. Cycle 0090's research validated natural-language prose prompts (Decision B) and identity-attribute re-mention (Decision C); the refiner LLM gets a "seedream" mode that produces both. Per-character `avatar_style` snapshot (Cycle 0093) drives the style template — flipping the user's global preference doesn't restyle existing characters' scenes.

Goals:
1. New refiner system prompt for natural-language cinematic prose (no Danbooru tags, no quality boosters).
2. `image.py` fal branch: use seedream refiner default (override via `_refiner_system_prompt` still works); call FalProvider.submit with the character's `reference_ref` as `image_urls[0]`; persist row immediately with `external_url`, `storage_ref=NULL`; return display_url=external_url. NO download / compress / upload during the request.
3. Server-side helper for character.reference signed URL (fal CDN dereferences once at gen time).
4. Frontend `displayUrl(image)` helper picks fal CDN for <24h-old fal rows, signed Storage URL otherwise.
5. `MessageImage.tsx` consumes `displayUrl(image)` instead of `imageUrl(image.storage_ref)`.
6. `scripts/storage_backfill.py` sweeper consumes pending rows, downloads from CDN, compresses (Cycle 0092), uploads to Storage, populates `storage_ref`.

Non-goals:
- Provider switcher polish + style picker UI (Cycle 0095).
- Per-image style override on regen (Cycle 0097).
- "Set as default fal" auto-flip on first save — already works via the BYOK section's save-activates pattern (Cycle 0090).

## Implementation order

### Subtask 1 — Seedream refiner system prompt ✅
- New `backend/app/prompts/image_refine_system_seedream.txt` — ~30 lines.
- Directs the LLM to produce 4-7 sentences of cinematic prose, re-mention identity attributes (Decision C), skip Danbooru tags / quality boosters / aspect ratio hints / style boosters (added by the pipeline based on `characters.avatar_style`).
- Empty `negative_prompt` always (Seedream doesn't expose one).
- SFW logic unchanged (`sfw_blocked` + `block_reason` returned the same way as the comfyui prompt).

### Subtask 2 — image.py fal branch ✅
- Char SELECT extended to include `reference_ref` + `avatar_style` (Cycle 0091 columns).
- `provider_family` detection elevated above the refiner block. When `family='fal'` and the user hasn't supplied a custom `_refiner_system_prompt`, the code loads the new seedream prompt as the refiner system override.
- New branch placed after the SFW-blocked path and before the existing ComfyUI workflow shape check. Steps:
  - Resolve `t2i_endpoint` + `edit_endpoint` from `workflow_config` (legacy `model_slug` fallback derives both via suffix).
  - Read `characters.avatar_style` snapshot for the style suffix (NOT the user's current global preference — preserves per-character look).
  - Append `_style_suffix(scene_style)` from `app/lib/fal_avatar.py` to the refined paragraph.
  - Build `image_urls`: signed URL for `characters.reference_ref` (when present) via new `UserSupabase.create_signed_url` helper. Optional history-of-N tail when `image.use_chat_history_refs > 0` (defaults to 0).
  - Call `FalProvider.submit(prompt, refs, width, height)`. fal returns CDN URL.
  - Insert `generated_images` row immediately with `engine='fal'`, `external_url`, `external_url_captured_at`, `style`, `storage_ref=null`, `bucket='generated-media'`.
  - Insert `inline_media` link with the next position.
  - Return row + `display_url=external_url`.
- ComfyUI path entirely unchanged.

### Subtask 3 — display_url helper ✅
- Frontend `lib/images.ts`:
  - `GeneratedImage` type extended with `engine`, `style`, `bucket`, `bytes_size`, `external_url`, `external_url_provider`, `external_url_captured_at`.
  - `imageUrl(storageRef, bucket?)` — bucket parameter added (default 'generated-media') so the helper can resolve avatars / refs from `avatars` bucket.
  - New `displayUrl(image)` — picks fal CDN when `engine='fal'` AND `external_url` AND `age < 24h`; else `imageUrl(storage_ref, bucket)`; else `external_url` as a last-resort fallback.
- `MessageImage.tsx`: swap `imageUrl(image.storage_ref)` → `displayUrl(image)`. useEffect deps include `image?.external_url` so stepper changes refetch correctly.

### Subtask 4 — Storage backfill sweeper ✅
- `scripts/storage_backfill.py` — service-role-driven, idempotent, dry-run + apply.
- WHERE engine='fal' AND storage_ref IS NULL, ORDER BY external_url_captured_at ASC (oldest = closest to CDN expiry first).
- Per row: httpx GET the external_url → `compress_for_storage(bytes, kind="scene")` → `storage.upload` with upsert → UPDATE row with storage_ref + bytes_size + dimensions.
- Compression imported from `backend.app.lib.image_compress` so sync and async paths produce identical WebP.
- Failures don't mark the row — next sweep retries. CDN-expired URLs simply stay `storage_ref=null`; the frontend `<img onError>` handles the regen prompt.

### Subtask 5 — Plan + commit ✅
- This plan.
- Self-review on the gen path (BYOK leakage, ref signed URL TTL, snapshot consistency).
- Commit `feat(0094): fal.ai chat scene gen + dual-store + storage backfill sweeper`.
- Update SESSION_HANDOFF.

## Critical files

| Layer | Path |
|---|---|
| New refiner prompt | `backend/app/prompts/image_refine_system_seedream.txt` |
| Backend gen branch | `backend/app/routes/image.py` (in the chat-scene POST handler) |
| Backend signed URL helper | `backend/app/deps/supabase.py` (UserSupabase.create_signed_url) |
| Frontend types + helpers | `frontend/src/lib/images.ts` |
| Frontend renderer | `frontend/src/features/chat/MessageImage.tsx` |
| Sweeper | `scripts/storage_backfill.py` |

## Operational notes

- **Run the sweeper periodically** — every 30-60 min is safe given the 24h dual-store window. Suggested cron:
  ```
  */30 * * * * cd /path/to/repo && set -a && source .env.local && set +a && \
      cd backend && uv run python ../scripts/storage_backfill.py --apply --quiet >> /var/log/sp-backfill.log 2>&1
  ```
- **First fal-driven chat-scene gen on xvm**: the sweeper hasn't run yet, so the row will sit with `storage_ref=null` until the next sweep. The frontend renders straight from fal CDN — that's the dual-store strategy working.
- **fal CDN URL TTL** is bounded but not officially documented; observed empirically as hours-to-days. The 24h frontend boundary is conservative; the sweeper aims to populate Storage well within that window.

## Risks managed

- BYOK key: `image_api_key` is decrypted via existing `get_active_image_key()` RPC (auth.uid()-scoped) and passed straight to `FalProvider(api_key=...)`. Never logged. Per-call AsyncClient (Cycle 0091 fix) prevents env-var races across concurrent BYOK users.
- Reference signed URL: 1h TTL (60*60). fal dereferences it once at gen time and caches its own copy — short TTL is fine.
- Sweeper concurrency: only one cron worker; if two run by accident, supabase-py's UPDATE with WHERE id=... is atomic. The second worker's storage upload would be a redundant overwrite (upsert=true), no breakage.
- Stale character.avatar_style: read from row at gen time → snapshot per generation. Future cycle 0097 will let the user override per-image on regen.

## Verification

- Backend imports clean: `uv run python -c "from app.routes.image import router"` succeeded.
- tsc 0 errors after frontend changes (GeneratedImage type extension + displayUrl helper + MessageImage swap).
- Live verification deferred until xvm has a chat with a fal-active provider + a character with `reference_ref`. The infrastructure is wired end-to-end; first user-driven chat scene will exercise the full path including the sweeper on its next cron tick.
