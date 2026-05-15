# Plan 0095 — Image Engine fal.ai polish (style picker + refs stepper)

status: shipped
date: 2026-05-05

## Motivation

The fal tab today only configures the API key + model endpoints. The two missing UX bits that matter for actual usage:
1. **Style picker** — Seedream lacks a `style` API parameter, so realistic / anime / custom is purely a prompt-template layer (Cycle 0090 Decision B). Without UI for this, every avatar / scene is anime-by-default with no way to switch.
2. **Reference continuity** stepper — `use_chat_history_refs` is wired all the way through Cycle 0094's chat-scene gen but invisible from settings. Default stays 0 (cost-minimum); when set, appends the last N chat-scene fal CDN URLs as additional `image_urls` for stronger lighting / outfit continuity.

Non-goals (deferred):
- Resolution preset dropdown for fal — the existing one in the ComfyUI tab persists to `users.preferences.image.default_resolution_preset` which Cycle 0094's `image.py` already reads regardless of provider. No need for a duplicate.
- `POST /providers/image/fal/test` endpoint — small backend value, defer to a follow-up.
- Per-image style override on regen — Cycle 0097.

## Implementation

### Subtask 1 — Frontend prefs helpers + UI ✅
- `lib/imageProvider.ts` — new `FalImagePrefs` type + `FAL_IMAGE_PREFS_DEFAULTS` (style="anime", custom_template="", use_chat_history_refs=0). `loadFalImagePrefs(userId)` + `saveFalImagePrefs(userId, prefs)` use direct read-modify-write on `users.preferences.image` (RLS allows; race risk is nil for a one-tab settings panel).
- `routes/ImageEngineSettings.tsx`:
  - useEffect Promise.all extends to load fal prefs alongside the provider rows.
  - State `falPrefs` initialized to defaults, hydrated from DB on load.
  - Two new sections in the fal tab between Models and the error/save row:
    - "Default style" — radio with realistic / anime / custom + a custom-template textarea visible only when style==='custom'. Inline hints on each option.
    - "Reference continuity" — number stepper 0–5 for use_chat_history_refs.
  - `onSaveFal` flushes both the provider row (key + endpoints) AND the user prefs (style + custom_template + use_chat_history_refs) in the same Save action.

### Subtask 2 — Plan + commit ✅

## Critical files

| Layer | Path |
|---|---|
| Frontend lib | `frontend/src/lib/imageProvider.ts` (FalImagePrefs + load / save helpers) |
| Frontend UI | `frontend/src/routes/ImageEngineSettings.tsx` (2 new sections + state + save wiring) |

## Risks managed

- **Read-modify-write on `users.preferences`**: only one tab edits the same row in normal use. The merge re-reads + spreads existing keys (memory, grammar, tts, image.engine, image.default_resolution_preset, …) so they survive the write.
- **Style change doesn't restyle existing characters**: by design — Cycle 0093 stores `characters.avatar_style` per character, Cycle 0094 chat scenes read that snapshot. The hint copy in the UI says so explicitly.
- **`use_chat_history_refs > 0` adds cost**: each extra ref doubles the implicit context fal processes per call. Default stays 0; the field is documented as opt-in.

## Verification

- tsc 0 errors after the lib + route changes.
- Visual: fal tab now shows three sections (Models / Default style / Reference continuity) above the error+save row. Custom textarea appears only when style==='custom'.
- Live verification deferred until xvm has a fal-active provider + a chat scene generated under different style values.
