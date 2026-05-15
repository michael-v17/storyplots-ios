# Plan 0097 — Per-image style override on regen

status: shipped
date: 2026-05-05

## Motivation

Closing the iniciativa fal.ai. Style today is layered:
- Global default: `users.preferences.image.style` (Cycle 0095).
- Per-character snapshot: `characters.avatar_style` (Cycle 0093) — wins over global for chat scenes so characters keep their look across global flips.
- Per-image snapshot: `generated_images.style` (Cycle 0091) — already captured at gen time.

What's missing: **letting the user pick a style for ONE specific regenerate** without touching the character's snapshot or the global. The Regenerate-with… panel already exposes POV, shot framing, resolution, prompt — adding style closes the loop.

The new variant lands with its own style snapshot in `generated_images.style`. The variant nav (existing) lets the user step between styles side-by-side; the original variants stay immutable.

## Implementation

### Subtask 1 — Backend `style_override` ✅
- `routes/image.py` — `GenerationOverrides` Pydantic model adds `style_override: str | None = None`.
- fal branch: style resolution priority becomes (1) `overrides.style_override` → (2) `characters.avatar_style` → (3) `users.preferences.image.style` → (4) "anime". The chosen value persists to `generated_images.style` for the new variant; existing variants are untouched.
- ComfyUI path: ignored (the workflow's `_prompt_wrap` is the style mechanism there, no clean equivalent).

### Subtask 2 — Frontend regen panel dropdown ✅
- `lib/images.ts` — `GenerationOverrides` type adds `style_override?: "realistic" | "anime" | "custom"`.
- `features/chat/ImageViewer.tsx`:
  - New state `ovStyle` (default "inherit").
  - `<select>` in the regen panel below Resolution. Options: Inherit / Realistic / Anime / Custom (uses your saved template).
  - `hasOverrides` bool extends to include style.
  - Click handler includes `ov.style_override = ovStyle` when not inherit.
  - Title attribute notes the dropdown is fal-only (ComfyUI path ignores it).
- testID: `viewer-regen-style`.

## Critical files

| Layer | Path |
|---|---|
| Backend schema + branch | `backend/app/routes/image.py` |
| Frontend types | `frontend/src/lib/images.ts` |
| Frontend UI | `frontend/src/features/chat/ImageViewer.tsx` |

## Verification

- tsc 0 errors.
- Functional verification deferred until xvm has a fal chat scene with multiple variants; live-checking style flip on regen requires hitting the API.

## Iniciativa fal.ai — closing summary (post-0097)

| # | Cycle | Status |
|---|---|---|
| 0090 | byok + research | ✅ |
| 0091 | provider scaffold | ✅ |
| 0092 | compression pipeline | ✅ |
| 0098 | phantom cascade cleanup | ✅ |
| 0096 | chat-image-lazy-load | ✅ |
| 0093 | fal-avatar-dual-gen + model split | ✅ |
| 0094 | fal-chat-scene-gen + sweep | ✅ |
| 0095 | settings polish (style + refs) | ✅ |
| **0097** | **per-image style override** | **✅** |

All 9 cycles shipped. Live-test pending: requires a chat with fal active + a generated character + a chat scene to exercise the full path. Sweeper can run in parallel to bring Storage in line with the dual-store contract once fal scenes start being generated.

Follow-ups not in this iniciativa (deferred):
- Test endpoint POST `/providers/image/fal/test` for the BYOK Save flow (UX nice-to-have).
- Browser-side WebP encoding for user-uploaded avatars in CharacterImport / paste (Cycle 0092 scope was backend only).
- Default flip `image.engine` global to 'fal' — at the moment the active provider is determined by `provider_configs.is_active`, which the Settings UI already drives via Save & activate. The Cycle 0090 plan mentioned a possible final migration of the `users.preferences.image.engine` field to default 'fal'; that field isn't actually consulted in the call paths today (provider resolution is by row, not pref), so the migration is unnecessary. Closing without it.
