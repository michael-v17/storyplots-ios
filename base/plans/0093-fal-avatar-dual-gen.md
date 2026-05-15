# Plan 0093 — fal.ai avatar dual-gen (preview + reference)

status: shipped
date: 2026-05-05

## Motivation

First cycle that actually invokes fal.ai in production. Avatars are a great starting point because:
- Fewer concurrent calls than chat scenes (1 per character regen, not per message).
- The dual-image pattern (preview + white-bg reference) is the foundation Cycle 0094 needs — chat scenes will pass `reference_ref` as `image_urls[0]` to Seedream's /edit endpoint.
- Aligns with creator's 2026-05-05 architectural decision: avatars stored in Storage (always), references stored in Storage (always), chat scenes deferred-compress (Cycle 0094).

Goals:
- Lift `SUPPORTED_PROVIDER_FAMILIES` to include `'fal'` (Cycle 0091 had it gated to comfyui only).
- Character avatar gen: when fal active, run two t2i calls (preview with user prefix + scene context; reference with deterministic half-body whitebg template per Cycle 0090 Decision A). Compress each, upload to `avatars` bucket, persist all 5 columns: avatar_ref, reference_ref, avatar_external_url, reference_external_url, avatar_style.
- Persona avatar gen: same shape — uses `photo_ref` + `reference_ref` + `avatar_style` + external URL columns.
- Frontend: "View reference image" button in CharacterEdit Avatar tab — visible only when reference_ref exists, opens lightbox.

Non-goals:
- Chat scene gen using the reference (Cycle 0094).
- Style picker UI (Cycle 0095 — reads `users.preferences.image.style`; this cycle reads it defensively, defaults to 'anime' when absent).
- Async deferred compression for avatars (avatars stay synchronous — they're displayed in many places, Storage-first is correct; deferred is for scenes only).

## Implementation order

### Subtask 1 — Lift gate + prompt helpers ✅
- `app/agents/image_provider.py`: SUPPORTED_PROVIDER_FAMILIES = {"comfyui", "fal"}.
- `app/lib/fal_avatar.py` (new): `build_avatar_preview_prompt()` (user_prefix + identity + bg + style suffix) and `build_reference_prompt()` (deterministic half-body whitebg, no user prefix). `_style_suffix` maps realistic/anime/custom.

### Subtask 2 — Character avatar dual-gen ✅
- `routes/avatar_generate.py`: helper `_fal_dual_gen()` does the two FalProvider.submit() calls (preview fails → 502; reference fails → silent, preview-only success).
- Branch in `generate_character_avatar` after step 4 (background_tags collection): when family=='fal', skip steps 4b–10 and run fal flow.
  - Compress each via `compress_for_storage(kind="avatar"|"reference")` wrapped in `asyncio.to_thread`.
  - Upload to `avatars/{user_id}/character-{id}-{ts}.webp` and `…-ref.webp`.
  - Best-effort cleanup of previous avatar_ref + reference_ref.
  - Update characters row with all 5 columns. Return `{avatar_ref, reference_ref, engine: "fal", model, seed}`.

### Subtask 3 — Persona avatar dual-gen ✅
- Same pattern in `generate_persona_avatar`. Personas use `photo_ref` (not avatar_ref) per migration 0003. Helpers shared.
- Persona's `appearance` column (free-form text) is pre-shaped into `{appearance_description, gender}` so the prompt builders' fallback logic kicks in.

### Subtask 4 — Frontend reference viewer ✅
- `Character` type adds `reference_ref: string | null`. `emptyDraft()` and `mapCardToDraft()` initialize to null.
- CharacterForm.tsx: new `referenceUrl` + `referenceLightbox` state. useEffect loads via existing `avatarUrl(reference_ref)` helper (no new lib needed — same `avatars` bucket, same TTL cache).
- Button "View reference image" in the avatar tab below AvatarGenerateControls; visible only when `draft.reference_ref` exists. Reuses existing `AvatarLightbox` component.

### Subtask 5 — Plugin gates + commit
- Self-review on the fal branch (concentrate on edge cases: reference call failure, previous-object cleanup race, persona's reduced field set).
- Commit `feat(0093): fal.ai avatar dual-gen (preview + reference) + reference viewer`.
- Update SESSION_HANDOFF.

## Critical files

| Layer | Path |
|---|---|
| Gate | `backend/app/agents/image_provider.py` |
| Prompt helpers (new) | `backend/app/lib/fal_avatar.py` |
| Backend | `backend/app/routes/avatar_generate.py` (character + persona endpoints) |
| Frontend type | `frontend/src/lib/characters.ts` (+reference_ref) |
| Frontend draft init | `frontend/src/features/characters/CharacterForm.tsx` (emptyDraft) + `frontend/src/features/import/mapCardToDraft.ts` |
| Frontend UI | `frontend/src/features/characters/CharacterForm.tsx` (referenceUrl state + button + lightbox) |

## Risks

- **fal API call shape**: fal-client signature confirmed in Cycle 0091. The `/text-to-image` endpoint is what the seedream model_slug exposes; the helper appends the suffix.
- **Reference call failure**: handled — preview-only success returns valid response. User sees avatar, just no reference. Re-gen later succeeds.
- **Style snapshot at gen time**: `avatar_style` always written (default 'anime' if user_prefs.image.style is missing). Cycle 0094 chat scenes read this column; cycle 0095 surfaces a hint UI when the global style differs from the per-character snapshot.
- **Persona's `appearance` column**: free-form text only — the 11 typed columns of characters don't apply. The `_physical_attrs_line` helper falls back to `appearance_description`; persona's `appearance` is mapped to that key in a per-call shim.

## Verification

- Backend imports clean: `uv run python -c "from app.routes.avatar_generate import router"` succeeded.
- Prompt builders tested end-to-end: anime style + scene context produces well-structured comma-joined prompts; realistic style produces photorealistic suffix.
- tsc 0 errors after frontend changes (CharacterForm + characters.ts + mapCardToDraft.ts).
- Live verification deferred until xvm has a fal-active provider configured + a character to regenerate. The infrastructure is ready; first user-driven regen will exercise the path end-to-end.
