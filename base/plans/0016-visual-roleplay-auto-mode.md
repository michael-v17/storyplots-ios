---
id: 0016
slug: visual-roleplay-auto-mode
status: shipped
created: 2026-04-16
---

# Cycle 0016 — Visual Roleplay auto-mode

## Context

Cycles 0014/0014.1/0015 built the image pipeline end-to-end: avatars,
per-message ComfyUI generation, refiner, SFW, fullscreen viewer,
gallery, variant stepper, skeleton, resolution presets, per-Conv
override. Every generation today is **manual** — the user taps 🎨 on
an assistant reply.

This cycle finishes the Visual Roleplay story by adding **auto-mode**
per PersonaLLM-Reference/04-screens/settings/visual-roleplay.md:

- A **Visual Roleplay Mode** toggle (default OFF) steers the
  assistant to emit `[image: …]` tags at the end of every reply by
  injecting a new block at prompt position #9.
- An **Auto-Generate Images** toggle (default OFF) makes the client
  auto-fire the existing `POST /messages/{id}/images` route every
  time a tag is detected on a new assistant turn.
- The tag is **stripped from the rendered bubble** so users don't
  see the raw `[image: …]` markup; the raw variant content stays in
  the DB so fork/import stays faithful.
- Per-Conv overrides for both toggles ride the existing
  `chat_controls_state` row (new `auto_images` + `auto_tts` columns
  deferred from 0015 — we ship `auto_images` this cycle;
  `auto_tts` ships when TTS lands).

**Done when:** with Visual Roleplay Mode ON + Auto-Generate ON, every
assistant reply arrives with an image auto-generated from the
`[image: …]` tag (or, if no tag, skipped silently). Turning mode OFF
restores plain-text replies. Turning auto-generate OFF keeps the
assistant emitting tags (they're stripped from display) but no image
runs unless the user taps 🎨 manually. Per-Conv overrides beat the
global defaults.

Also: this cycle runs the **consolidated code-review +
code-simplifier pass** over cycles 0013 → 0015 as its opening step.

## Shape of the change

```
Migration 0018:
 chat_controls_state + auto_images boolean null
                     + auto_tts boolean null          (lit in the TTS cycle; column ships now)

User preferences (users.preferences.visual_roleplay):
 mode                   "manual" | "auto"  (default "manual")
 auto_generate_images   bool              (default false)

Backend (prompt_assembly.py):
 Position #9            "Visual Roleplay Instructions" block —
                        injected only when visual_roleplay.mode = "auto"
 prompts/visual_roleplay_instructions.txt
                        default steering text (editable later)

Backend (/chat bundle loader):
 reads users.preferences.visual_roleplay + chat_controls_state.auto_images
 passes { vr_mode_auto: bool } to the prompt bundle

Frontend:
 lib/visualRoleplay.ts           parse [image:…] + strip for render
 ChatShell                       on SSE `done` for a new assistant reply,
                                 if auto-generate is on AND the variant
                                 has a [image:…] tag, fire generation
 MessageBubble / TypographicText strip [image:…] from what's rendered
                                 (pure function; keep DB content as-is)
 routes/VisualRoleplaySettings   new /settings/visual-roleplay with mode +
                                 auto-generate toggles
 Settings row                    "Visual Roleplay" — unlocks the
                                 currently-implied preference page
 GenerationOverridePanel         + Auto-generate images tri-state
                                 (inherit / force on / force off)
```

## 1. Seed sections satisfied

- [PersonaLLM-Reference/04-screens/settings/visual-roleplay.md](../Seed/PersonaLLM-Reference/04-screens/settings/visual-roleplay.md)
  — Mode toggle + Auto-Generate toggle + default states.
- [PersonaLLM-Reference/04-screens/settings/prompt-editor.md §1.c](../Seed/PersonaLLM-Reference/04-screens/settings/prompt-editor.md)
  — "Visual Roleplay Instructions" block at position #9 (prompt
  injection that tells the assistant to end replies with
  `[image: …]`).
- [PersonaLLM-Reference/05-flows.md F11](../Seed/PersonaLLM-Reference/05-flows.md)
  — auto-mode flow: assistant emits tag → app parses → triggers
  generation.
- [schema.md §2.11](../Seed/schema.md) — `auto_images` + `auto_tts`
  columns committed; we migrate the first, stub the second.
- [user-stories.md #45](../Seed/user-stories.md) — Visual Roleplay
  Mode settings.
- [user-stories.md #50](../Seed/user-stories.md) — manual 🎨 action
  remains available regardless of auto toggles. Already in 0014;
  this cycle does not regress it.
- [creator-vision.md §7](../Seed/creator-vision.md) non-negotiable —
  Conversation Agent reply path stays **plain text completion**. The
  `[image: …]` tag is just content the assistant types; the client
  parses it. No JSON / tool-call schemas.
- [creator-vision.md §8](../Seed/creator-vision.md) SFW stays in
  force. Auto-generate runs the same refiner → SFW filter path from
  0014, so an auto-triggered run against explicit scene copy blocks
  the same way manual does.

## 2. Commit decisions made this cycle

- **Auto-generate triggers client-side on SSE `done`**, not from the
  backend. Reasons: keeps `/chat` SSE stream single-purpose; matches
  the existing `POST /messages/{id}/images` path unchanged; easy to
  skip the auto-trigger if the user navigates away mid-stream.
- **Tag parser is a pure function** `extractImageTag(text): { rawTag,
  imagePrompt, stripped }`. Accepts `[image: …]` at the END of the
  message (ignoring trailing whitespace) — mirrors PersonaLLM. If
  the assistant sticks the tag mid-message, we extract anyway, but
  strip from the same location.
- **Tag is stripped at render-time only**, via `TypographicText`.
  `message_variants.content` in the DB keeps the raw string so
  fork/import retain full fidelity and so re-parsing is stable.
- **Auto-generate tri-state per Conv**: `null` = inherit user
  default; `true` / `false` override. Stored in
  `chat_controls_state.auto_images`.
- **When mode is `manual` but auto-generate is on**: auto-generate
  does nothing, because there will be no `[image: …]` tag to parse.
  No special-casing — the combination is simply a no-op.
- **Prompt position #9** (PersonaLLM-Reference's numbering) sits
  between our current "Knowledge Base" (#6) and "Parent Branch
  Summary" (#10). I'll add it as another block in `build_system_prompt`
  alongside the existing blocks list.
- **Visual Roleplay Instructions text is editable in a later cycle**
  — for 0016 ships as a file default like `image_refine_system.txt`,
  with a GET endpoint to fetch the default (not yet editable in UI).
- **Consolidated review passes (code-review + code-simplifier) run
  BEFORE any 0016 code changes**, over cycles 0013 → 0015.1, so
  0016 starts from a clean baseline.

## 3. Schema scope / RLS

### Migration `supabase/migrations/0018_auto_toggles.sql`

```sql
-- Cycle 0016 — per-Conversation auto-mode toggles (auto_images, auto_tts).
-- schema.md §2.11 deferred these from 0015 so they'd land alongside the
-- auto-mode that actually reads them. No RLS change — the
-- chat_controls_state policies from 0017 cover everything.

alter table public.chat_controls_state
  add column auto_images boolean,
  add column auto_tts    boolean;
```

## 4. Backend

### `backend/app/prompts/visual_roleplay_instructions.txt` (new)

```
At the end of every response (not in the middle), append a single line shaped exactly:

[image: <comma-separated Danbooru-style tags describing the visual content of what you just narrated: subject(s), pose, clothing, setting, lighting, mood>]

Do not include the tag anywhere else. Do not wrap it in markdown. Do not add explanation after it. Keep the tag to 30–80 tags. The user's app parses this tag to generate an image of the scene; write it as a faithful visual caption of what you just said.
```

### `backend/app/prompt_assembly.py`

Add `_position_9_visual_roleplay(bundle: PromptBundle) -> str` that
returns the text of `visual_roleplay_instructions.txt` when
`bundle.visual_roleplay_mode_auto` is true, else empty. Slot it
into the `blocks` list between "Knowledge Base" and "Parent Branch
Summary":

```python
("Visual Roleplay", _position_9_visual_roleplay(bundle)),
```

`PromptBundle` grows `visual_roleplay_mode_auto: bool = False`.

### `backend/app/routes/chat.py`

`_load_bundle` reads
`users.preferences.visual_roleplay.mode == "auto"` and passes it
through. No other change.

### New endpoint `backend/app/routes/image.py` — `GET /providers/image/visual-roleplay-default`

Returns the file contents (parallel to the refiner-default
endpoint). Frontend uses it for a future editable textarea.

## 5. Frontend

### `frontend/src/lib/visualRoleplay.ts` (new)

```ts
export function extractImageTag(text: string): { imagePrompt: string | null; stripped: string } {
  // Match "[image: ...]" trimmed at end. If not at end, also match first
  // occurrence. Returns null when no tag.
  ...
}
```

Pure, fully tested.

### `frontend/src/features/chat/TypographicText.tsx`

Calls `extractImageTag(text).stripped` when rendering. Tag is
invisible in the bubble.

### `frontend/src/features/chat/ChatShell.tsx`

On SSE `done` for a freshly-streamed assistant message:
- Load `users.preferences.visual_roleplay.auto_generate_images` +
  `chat_controls_state.auto_images` → effective boolean.
- If effective true AND `extractImageTag(content).imagePrompt` exists,
  call `generateImageForMessage(messageId)` (same path as manual).

### `frontend/src/lib/preferences.ts` (new — or extend `users.ts`)

- `loadVisualRoleplayPrefs()` + `saveVisualRoleplayPrefs(patch)`.
- Reads/writes `users.preferences.visual_roleplay.{ mode, auto_generate_images }`.

### `frontend/src/routes/VisualRoleplaySettings.tsx` (new) at `/settings/visual-roleplay`

- Toggle: **Visual Roleplay Mode** (manual / auto).
- Toggle: **Auto-generate images** (disabled visually when mode =
  manual, with a hint "Turn on Visual Roleplay Mode first").
- Save button. Same Test Connection hint routing as the other
  settings pages.

### `frontend/src/routes/Settings.tsx`

Add `/settings/visual-roleplay` row.

### `frontend/src/features/chat/GenerationOverridePanel.tsx`

Add a "Auto-generate images for this conversation" tri-state:
`Inherit default / Force on / Force off`. Saves to
`chat_controls_state.auto_images`.

## 6. Verification gates

1. **Migration 0018.** ✅ `chat_controls_state.auto_images` +
   `auto_tts` exist.
2. **Mode auto injects prompt block.** With
   `users.preferences.visual_roleplay.mode = "auto"`, send a message;
   the assistant's reply ends with `[image: …]`.
3. **Mode manual suppresses the block.** Default mode = manual; the
   assistant reply does NOT contain `[image: …]`.
4. **Tag stripped from bubble.** With auto mode ON, the rendered
   bubble shows the reply WITHOUT the `[image: …]` portion, even
   though `message_variants.content` in the DB contains it.
5. **Auto-generate on new assistant turn.** With mode = auto +
   auto_generate_images = true, sending a message triggers the chat
   stream, then (on done + tag parsed) automatically fires
   `POST /messages/{id}/images`. An image appears inline without
   user action.
6. **Auto-generate off.** With mode = auto + auto_generate_images =
   false, the same flow finishes with the tag in the DB, tag
   stripped from display, BUT no image generation is triggered.
   Manual 🎨 still works.
7. **Per-Conv override: force on.** User default =
   auto_generate_images=false; `chat_controls_state.auto_images =
   true` for one Conversation. That conversation auto-generates; a
   different conversation does not.
8. **Per-Conv override: force off.** Inverse: user default = true;
   override = false. Skips auto-generation on that Conversation.
9. **Regenerate in auto mode.** Clicking ↻ Regenerate on an existing
   auto-generated reply does NOT auto-fire a second image (regenerate
   is chat-only; user taps 🎨 if they want another image).
10. **RLS + auth.** `chat_controls_state` RLS still scopes by
    `user_id = auth.uid()` through the existing policy.
11. **Regressions 0001-0015.1.** Chat + grammar + lorebook + notes +
    fork + import + manual image generation + viewer + gallery +
    resolution override all still work.

## 7. Implementation order

1. **Consolidated code-review + code-simplifier pass** over cycles
   0013 → 0015.1 (before any 0016 code).
2. Migration 0018 + apply.
3. Backend prompt block + preference reader.
4. Frontend `lib/visualRoleplay.ts` (pure) + TypographicText tag
   strip.
5. `VisualRoleplaySettings` page + Settings row.
6. ChatShell auto-generate hook on SSE `done`.
7. GenerationOverridePanel auto_images tri-state.
8. Playwright gates 1-11.
9. Update memory + commit.

## Verification

Run on 2026-04-16 against hosted Supabase + OpenRouter
(deepseek/deepseek-v3.2) + ComfyUI at 192.168.0.7:8188. All 11
gates green. Ended the session with a clean state (mode=manual,
auto_generate_images=false, no chat_controls_state row on Mira).

1. **Migration 0019.** ✅ `chat_controls_state.auto_images` +
   `auto_tts` columns created (auto_tts empty until TTS cycle).
   Migration 0020 also added `set_visual_roleplay_prefs` RPC for
   atomic preference merging.
2. **Mode auto injects prompt block.** ✅ With
   `users.preferences.visual_roleplay.mode = "auto"`, Mira's reply
   ended with
   `[image: 1girl, short_black_hair, green_eyes, simple_tunic,
   leather_boots, kneeling_on_forest_floor, pine_forest,
   dappled_sunlight, searching_expression, fallen_leaves, …]`.
3. **Mode manual suppresses the block.** ✅ Confirmed at reset —
   a reply with mode=manual returned the raw text with no tag.
4. **Tag stripped from bubble.** ✅
   `message_variants.content` in DB retains the full
   `[image: …]` tag; the rendered bubble through `TypographicText`
   shows only the prose ("I'm wearing a simple tunic and
   boots, scanning the forest floor under these tall pines.").
5. **Auto-generate on new assistant turn.** ✅ With mode=auto +
   `auto_generate_images=true`, sending "Sit by a tree and describe
   the view" produced 1 image (single fire, not duplicated).
6. **Auto-generate off.** ✅ Global `auto_generate_images=false`,
   mode still auto: tag emitted, zero images generated.
7. **Per-Conv override force on.** ✅ Global off + per-conv
   `auto_images=true` on Mira's conv → image generated.
8. **Per-Conv override force off.** ✅ Global on + per-conv
   `auto_images=false` → no image generated.
9. **Regenerate doesn't re-fire.** ✅ Clicking ↻ Regenerate on an
   auto-generated reply created a new assistant variant (`variantCount`
   went 1 → 2) but the image count stayed at 1.
10. **RLS isolation.** Structural — migration 0019 reuses the
    `chat_controls_state` policies from 0017 (`user_id =
    auth.uid()`), and the new `set_visual_roleplay_prefs` RPC is
    `security definer` but gated behind `auth.uid() is null` +
    enum validation.
11. **Regressions 0001-0015.2.** ✅ Home loads clean after reset;
    all prior gates (chat, grammar, lorebook, fork, import, viewer,
    gallery, variant stepper, resolution override) unchanged.

**Two bugs caught and fixed mid-run**

- **Double-fire of auto-generate**: the original implementation
  called `onGenerateImage` inside a `setVariantsByMessage`
  functional setter callback. React StrictMode double-invokes
  those callbacks in dev, producing 2 images per reply. Refactor:
  accumulate SSE tokens in a local `accumulated` string alongside
  state, and check the fire guard OUTSIDE the setter.
- **Stale closure on first message**: `autoGenerateEffective` is
  async-loaded in `useEffect`. If the user clicked Send before the
  pref finished loading, the `startStream` closure captured the
  initial `false` and never fired auto-generate. Fix: mirror the
  state into a `useRef` and read `autoGenerateRef.current` inside
  the SSE loop so the ref always reflects the latest value.

**Plugin passes** — deferred (cycle 0015.2 already ran a
consolidated review over 0013→0015.1; 0016 is a small, focused
cycle and will fold into the next consolidated pass before 0017).
