# Screen — Image Viewer & Editor

> Shared by [Chat](chat.md) (inline images) and [Gallery](gallery.md) (media library). Tapping an image thumbnail in either place opens this fullscreen viewer.

## Observed in PersonaLLM

Sources: [Edit image/IMG_4197.PNG](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4197.PNG), [IMG_4198](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4198.PNG), [IMG_4199](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4199.PNG), [IMG_4201](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4201.PNG), [IMG_4214](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4214.PNG).

### Sub-states
1. **Fullscreen viewer** (default)
2. **Prompt panel expanded**
3. **Inline image long-press menu** (from Chat)
4. **Edit Prompt sheet** (regenerate with new prompt / resolution)

---

### 1. Fullscreen viewer ([IMG_4197](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4197.PNG))

- Top bar:
  - Left: **X** (close) — circular chip
  - Center: **Date pill** (e.g., "April 13, 2026") — when the image was generated
  - Right: **♥ favorite** toggle — circular chip
- Body:
  - Fullscreen image (centered; aspect-respecting). Small pagination dots below image suggest multi-generation navigation when a message has several attached images.
- Footer panel:
  - **PROMPT** label + dimensions (e.g., `1088×1912`) + expand chevron `˅`
  - One-line prompt preview (ellipsized).
- Sticky bottom action bar (3 buttons with labels):
  - ⬆ **Share** — native share sheet
  - 🎥 **Video** — generate video from this image (image-to-video entry; see [chat.md §F image options modal](chat.md#f-image-options-modal-img_4131))
  - ✏ **Edit** — opens Edit Prompt sheet (sub-state 4)

### 2. Prompt panel expanded ([IMG_4199](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4199.PNG))

Expanded footer becomes a scrollable card overlaying the bottom portion of the image:
- PROMPT · `{dimensions}` · collapse chevron `^`
- **Full prompt text** (scrollable if long). Example (Socrates of Athens):
  > "1boy, elderly bald man, thick gray beard, leaning against marble column, arms folded, weathered skin, white chiton, ancient Greek agora, dappled shade, merchant stalls background, midday Mediterranean light, engaged curious expression, pointing finger gesture, classical Athens, male, elderly man in his early seventies, bald head, thick bushy gray beard, deep-set brown eyes, broad flat nose, stocky sturdy build, weathered sun-darkened skin, simple off-white linen chiton, worn leather sandals, no jewelry, prominent forehead, thick eyebrows"
- Action bar (Share · Video · Edit) stays sticky below.

### 3. Inline image long-press menu ([IMG_4201](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4201.PNG))

Invoked from an image inside a chat bubble (long-press). Sheet slides up:
- ↻ **Regenerate Image** — same prompt, new seed
- ♥ **Favorite** — adds/removes from favorites (ties to Gallery heart filter)
- 🌐 **Share to Community** — **SCOPE-CUT in clone**
- 🗑 **Delete** (red)

### 4. Edit Prompt sheet ([IMG_4198](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4198.PNG))

- Header: **Cancel · "Edit Prompt"** (no Save — Regenerate is the primary)
- Top: `< · Image Prompt` label
- **Image Prompt** — large editable textarea, pre-filled with the image's full prompt (same text shown in the expanded panel).
- Hint: "Edit the prompt and regenerate the image"
- **Resolution** — 3×3 grid of the same preset tiles from [Visual Roleplay](settings/visual-roleplay.md):
  - Random · Square 1408² · Portrait 1280×1664 · Landscape 1664×1280 · **Tall Portrait 1088×1920** (selected in screenshot, themed accent)
  - Wide Landscape 1920×1088 · Ultra Tall 1024×2048 · Ultra Wide 2048×1024
  - (no Custom tile here — only global Visual Roleplay settings exposes Custom)
- CTA (accent pill, full width): **↻ Regenerate**

### Media metadata captured on each image

| Field | Source |
|---|---|
| createdAt (date) | Top-bar date pill |
| isFavorite | Top-right ♥ |
| dimensions (W × H) | Prompt panel header |
| prompt (full text) | Prompt panel / Edit sheet |
| resolutionPreset | Derived from dimensions |
| canGenerateVideo | Video button |
| messageId / conversationId | back-reference `(inferred)` — so the viewer knows which chat it came from |

## User Extensions / Scope Decisions

- Keep the entire viewer as-is. The 3-button action bar (Share · Video · Edit) is a clear model.
- **Remove "Share to Community"** from the long-press menu.
- On web:
  - Swap native share sheet for browser share API (fallback: copy link + download).
  - Replace long-press with right-click / ⋮ kebab on each image.
  - Keep Edit Prompt sheet — it's the "photoshop in miniature" feature that makes the generated media feel live.
- Pagination dots ([IMG_4197](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4197.PNG)) imply a **message can have multiple generated images** (each Regenerate Image keeps a history of variants). Design the data model so `InlineMedia.parentMessageId` supports N images per message.
- Keep `♥ Favorite` and wire it to the Gallery heart filter.

## Open Questions

- What does "Video" do when clicked from here — does it open [Chat/IMG_4131](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4131.PNG) (the resolution+video modal) or go directly to video generation using the last duration preset?
- Is there a "Revert to previous prompt" or "Show prompt history" for an image that has been regenerated multiple times?
- Does Edit Prompt allow editing the **Negative Prompt** inline, or only the positive prompt?
- Does the pagination dots count include all variants ever generated, or only the current "thread" of regenerations?
