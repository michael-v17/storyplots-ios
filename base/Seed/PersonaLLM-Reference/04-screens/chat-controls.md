# Screen — Chat Controls

> The `⋯` button in the Chat composer (bottom-left) opens a modal sheet called **Chat Controls**. This is a dense in-chat settings surface that covers autopilot, per-conversation generation overrides, and shortcuts to character-wide editors.

## Observed in PersonaLLM

Sources: [Chat Controls/IMG_4210.PNG](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat%20Controls/IMG_4210.PNG), [IMG_4211](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat%20Controls/IMG_4211.PNG), [IMG_4212](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat%20Controls/IMG_4212.PNG), [IMG_4213](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat%20Controls/IMG_4213.PNG).

### Entry point
From the active [Chat](chat.md) screen → `⋯` icon (bottom-left of composer).

### Sheet header
- Left: **Credits badge** — e.g. `⚡ 310` (bordered pill in character's accent color — red for AXIOM-7). **SCOPE-CUT** in the clone.
- Center: Title **"Chat Controls"**.
- Right: **Done** pill (closes sheet). Themed in character accent color.

### Section: AUTOPILOT ([IMG_4210](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat%20Controls/IMG_4210.PNG))

- Three preset chips (radio): **5 · 10 · 25** (turn counts).
- CTA: **▶ Start Autopilot** (accent-colored pill).
- Hint: "Send a message first — Autopilot needs an AI reply with suggestions"

**Autopilot behavior (inferred from hint):** after the user sends ≥1 message and the AI has produced a reply with Suggested Replies, pressing Start Autopilot auto-selects a suggested reply and keeps the loop running for N turns. Stops when the turn count expires or the user intervenes.

### Section: GENERATION

Per-conversation provider overrides (shortcuts into the global [Image Engine](settings/image-engine.md) / [Video Engine](settings/video-engine.md)).

| Row | Example value | Opens |
|---|---|---|
| ⚡ **Image** | `xAI Grok · Grok Imagine` | Image provider picker |
| 🖥 **Video** | `ComfyUI (Local) · Local server, custom workflows` | Video provider picker |

→ Gives the user fast access to swap the image / video provider mid-conversation without leaving the chat.

### Section: SETTINGS

| Row | Control | Default observed |
|---|---|---|
| 🖼 **Auto Images** | Toggle | OFF |
| 🔊 **Auto Text-to-Speech** | Toggle | OFF |
| 🐞 **Debug Mode** | Toggle | OFF |
| 📝 **Author's Notes** | Card with chevron | subtitle "Guide the story direction" → [authors-notes.md](authors-notes.md) |
| 📕 **Lore Book** | Card with chevron | subtitle "0 entries" → Character's lore book editor `(still not fully captured)` |

Notes:
- **Auto Images** here is the per-conversation override for the global Auto-Generate Images toggle in [visual-roleplay.md](settings/visual-roleplay.md).
- **Auto Text-to-Speech** is the per-conversation autoplay toggle referenced in the marketing copy ("autoplay"); the global TTS switch lives in [text-to-speech.md](settings/text-to-speech.md).
- **Debug Mode** is visible here only; no marketing mention. Likely exposes request/response payloads inline in chat.

### Section: MORE ([IMG_4211](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat%20Controls/IMG_4211.PNG))

| Row | Opens |
|---|---|
| ⚙ **Character Settings** | [character-info.md → Settings tab](character-info.md#3c-settings-tab) — but scoped to *this* character |
| ⚙ **App Settings** | [settings-index.md](settings-index.md) |

### Presentation ([IMG_4212](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat%20Controls/IMG_4212.PNG))
Modal sheet slides up over the chat; chat is dimmed but the character's theme (avatar, scenario labels, accent color) stays visible behind the sheet.

## User Extensions / Scope Decisions

- Keep **Chat Controls** as the canonical name and entry point (⋯ button on composer).
- **Remove Credits badge**; clone has no credits.
- Keep **Autopilot** — powerful feature; implement with a small per-conversation state machine (see [03-data-model.md → AutopilotRun](../03-data-model.md#autopilotrun)).
  - Preset options remain 5 / 10 / 25; allow a "Custom N" in advanced.
  - Auto-stop conditions: turn cap reached, user sends a message, user taps Stop, provider error.
- Keep **per-conversation provider override** rows for Image and Video — they read as a clear UX win.
- Keep **Auto Images / Auto TTS / Debug Mode** toggles; wire them to per-Conversation state (fallback to global default).
- **Debug Mode** in the clone → "Show request/response, token usage, and retrieval hits inline" — critical for BYOK users debugging their keys.
- **Lore Book** and **Character Settings** rows stay as deep-link shortcuts.

## Open Questions

- **Lore Book editor** fields — not captured yet. Likely: list of entries with title + keywords[] + body + auto/manual origin.
- Does Autopilot pause when the Suggested Replies LLM call fails?
- Is **Author's Notes** available only via Chat Controls, or also from the main Settings?
- Does **Debug Mode** persist across conversations or is it session-only?
- Can the user set a **default Autopilot turn count** globally?
