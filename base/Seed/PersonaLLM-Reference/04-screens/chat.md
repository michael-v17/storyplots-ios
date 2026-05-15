# Screen — Chat

## Observed in PersonaLLM

Source folder: [Chat/](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/) — IMG_4125 … IMG_4133, IMG_4147 (10 screenshots). Also relevant: [Character Info/IMG_4136](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4136.PNG), [IMG_4137](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4137.PNG) (the pre-chat character landing).

### Purpose
1:1 conversation between the active UserPersona and one Character. Everything in this screen is themed by the Character's **accent color** (see [character-info.md §Avatar tab](character-info.md#3a-avatar-tab)).

### Sub-states observed
A. **Character landing / pre-chat card** (new conversation, no messages yet)
B. **Conversations list** (multiple saved conversations per character)
C. **Active chat** (messages present)
D. **Message with image-generation placeholder**
E. **Message with generated image**
F. **Image options modal** (resolution + Generate Video)

---

### A. Character landing ([CharInfo/IMG_4136](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4136.PNG), [IMG_4137](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4137.PNG), [Chat/IMG_4125](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4125.PNG), [IMG_4133](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4133.PNG))

Header (same across all sub-states):
- Left: back chevron `<` → [Home](home.md).
- Next to back: small circular avatar + name + one-line tagline preview (ellipsized).
- Right: **list icon** (opens the [Conversations list](#b-conversations-list), sub-state B) and **+ icon** (start a new conversation).

Body:
- Large circular avatar (themed glow ring in character's accent color).
- Character **name** (bold, large).
- **Tagline** (muted).
- **Mode pill** below tagline: `📖 Roleplay` (or Assistant) — themed in accent color with border.
- **Scenario cards** (N cards, one per scenario on the character):
  - Each card has a colored border tinted in the accent color.
  - Top-left: **"Scenario N"** label (purple/accent pill).
  - Top-right: **scenario title** badge (e.g., "Late Night Check-In", "First Activation", "Midnight Conversation", "Rooftop Terrace Encounter", "Meeting in the Agora", "Evening by the River").
  - Body: opening scene narration (ellipsized).
  - Chevron → tapping selects this scenario and starts the conversation with its body as the first assistant message.

Composer (sticky bottom, same across all states):
- **⋯ Chat Controls** — bottom-left of composer; opens the [Chat Controls](chat-controls.md) modal sheet (Autopilot, per-conversation provider pickers, Auto Images / Auto TTS / Debug Mode toggles, Author's Notes, Lore Book, shortcuts to Character Settings and App Settings).
- **"💬 Suggested Replies"** pill above the composer — tap to request 3 suggested-reply chips (marketing: "Three contextual options after every response — tap to continue instantly").
- Text input: **"Message [CharName]…"** placeholder.
- **🎤 mic** icon on the right — voice dictation into the composer.

### B. Conversations list ([IMG_4132](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4132.PNG))

- Title: **"Conversations"** (centered).
- Top-right: **+ circular button** — creates a new Conversation for this character.
- List rows: each row shows **conversation title** (defaults to "New Conversation" or auto-named), one-line first-message preview, timestamp (e.g. "4m"), message count (e.g. "7 msgs").
- Row border tinted in character accent color for the currently-active conversation.

**→ Conclusion: each Character has N independent Conversations, and each Conversation has its own message thread, scenario, and branches.** Multiple saved conversations per character confirmed.

### C. Active chat ([IMG_4126](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4126.PNG), [IMG_4127](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4127.PNG), [IMG_4128](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4128.PNG))

**Message bubble anatomy:**
- First message is the **selected Scenario card** itself (persists at the top of the thread — labeled "Scenario N · <title>" with the scenario border).
- **Character messages** — left-aligned, no bubble fill (just body on dark bg), full-width.
  - **Italic text = narration / action** (e.g., "*I blink, tilting my head slightly…*")
  - **Plain quoted text = dialogue** ("So let me help you finish it, if I may.")
  - Mixed freely within a single message.
  - Timestamp below message (left-aligned, small muted, e.g. "16:13").
- **User messages** — right-aligned, **pill bubble filled with character's accent color** (e.g., bronze pill for Socrates: "So who you are", [IMG_4128](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4128.PNG)).
- Selected-message indicator: the right-side **floating action rail** (see below) attaches to the currently selected message.
- **Variants counter** on assistant messages with multiple variants: `< N/M >` pill at the top-left of the message body (e.g., `< 1/2 >` in [Chat/IMG_4200](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4200.PNG)). Tap the arrows to swipe between variants.

**Floating action rail (right edge, attached to selected message):**
- Vertical stack of circular chips, themed in the accent color.
- Standard set observed ([IMG_4126](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4126.PNG), [IMG_4127](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4127.PNG), [IMG_4128](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4128.PNG)):
  - ↻ **Regenerate**
  - ⑂ **Branch** (fork conversation from this message)
  - 🖼 **Generate Image** (render a scene image from this message)
- Extended set on the newest character message with an image attached ([IMG_4147](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4147.PNG), Clara Moretti — 4 chips stacked):
  - ↻ Regenerate
  - ⑂ Branch
  - 📷 (likely **Save/Screenshot** `(inferred)`)
  - ⌄ **Collapse/chevron** (collapse the image `(inferred)`)
- On an assistant message where an image is currently generating ([IMG_4130](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4130.PNG)): a rail with **Regenerate image** + a **save** icon adjacent to the image itself.

### D. Image-generation placeholder ([IMG_4129](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4129.PNG))

- Full-width dark placeholder card (≈ chat-column height) appears after the user triggers image generation.
- Centered sparkle animation + text:
  - **"Generating image…"**
  - **"Feel free to keep chatting"** (i.e., generation is non-blocking).
- Single **↻ Regenerate** chip sits to the right of the card.
- Once complete, card content is replaced with the rendered image ([IMG_4130](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4130.PNG)).

### E. Generated image ([IMG_4130](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4130.PNG), [IMG_4147](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4147.PNG))

- Image renders inline in the conversation, full-width of the chat column, rounded corners.
- Appended to the message the user requested an image from (not a new standalone message).
- Rail chips: Regenerate image · Save · Expand image options.

### F. Image options modal ([IMG_4131](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4131.PNG))

Triggered from an image-options affordance (likely long-press or expand icon).

- Modal sheet title: **"Resolution"**
- Preset list (each row: name · dimensions):
  - **Random** — "Surprise me"
  - **Square** — 1408 × 1408
  - **Portrait** — 1280 × 1664
  - **Landscape** — 1664 × 1280
  - **Tall Portrait** — 1088 × 1920
  - **Wide Land…** (Wide Landscape) — 1920 × 1088
  - **Ultra Tall** — 1024 × 2048
  - **Ultra Wide** — 2048 × 1024
- Separator.
- **🎥 Generate Video** (purple link) — "From this image" (image-to-video on the already-generated still).

### Cross-cutting patterns

- **Per-character theming** via accent color drives: scenario card border, user-message pill fill, rail chip tint, mode-pill border, avatar glow ring.
- **Voice dictation** on the composer (mic icon, themed in accent color).
- **Non-blocking image generation** — user can keep typing while an image renders.
- **Italic vs plain convention** on character messages provides a free "dual-voice TTS" signal (italic → narrator voice, plain → dialogue voice). Marketing confirms dual-voice TTS ([Website.md](../../../References/PersonaLLM/ExtraDocuments/Website.md)).
- **Scenario = persistent first turn** — the selected scenario card stays at the top of the thread as message #0.

### G. User-message long-press sheet ([Chat/IMG_4200](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4200.PNG))

Long-pressing a **user message** pill opens a context sheet with the message text echoed at the top, then the following actions:

| Icon | Action | Notes |
|---|---|---|
| ✏ | **Edit** | Edit the user's message text in place. Downstream behavior (re-run or keep): `(open question)` |
| 📋 | **Copy** | Copy to clipboard |
| ↻ | **New Response** | Regenerate the assistant's reply to this user message (creates a variant) |
| ⑂ | **Fork from here** | Opens [Fork Conversation modal](branch.md) anchored on this message |
| 🗑 | **Delete** (red) | Opens confirmation ([Chat/IMG_4202](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4202.PNG)) |

**Delete Message confirmation** ([IMG_4202](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4202.PNG)):
- Modal: "Delete Message?" · "This message and its media will be permanently deleted."
- Buttons: **Cancel** · **Delete** (red).

### H. Inline image long-press menu ([Edit image/IMG_4201](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4201.PNG))

Long-pressing an inline image inside a chat bubble opens a separate sheet:

| Icon | Action | Notes |
|---|---|---|
| ↻ | **Regenerate Image** | Same prompt, new seed |
| ♥ | **Favorite** | Wires to Gallery heart filter |
| 🌐 | **Share to Community** | **SCOPE-CUT in clone** |
| 🗑 | **Delete** (red) | Removes the image (not the parent message) |

Tapping the image (short press) opens the fullscreen [Image Viewer](image-viewer.md) instead.

### Actions inventory (from Chat folder)

| Action | Trigger | Notes |
|---|---|---|
| Open Conversations list | List icon in header | Sub-state B |
| New Conversation | + icon in header | Also `+` on Conversations list |
| Select Scenario | Tap scenario card on landing | Seeds msg #0 |
| Send message | Composer + send (implied) | Mic for dictation |
| Request suggested replies | "💬 Suggested Replies" pill | 3 contextual options |
| Regenerate message | Rail ↻ | Creates a variant |
| Swipe variants | `< N/M >` arrows on assistant message | Confirmed [IMG_4200](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4200.PNG) |
| Edit message | Long-press user message → **Edit** | Confirmed [IMG_4200](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4200.PNG) |
| Delete message | Long-press user message → **Delete** → confirm | Confirmed [IMG_4202](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4202.PNG) |
| Fork from message | Rail ⑂ or user-msg sheet → Fork from here | Opens [branch.md](branch.md) |
| Open Chat Controls | ⋯ on composer | Opens [chat-controls.md](chat-controls.md) |
| Start Autopilot | Chat Controls → Autopilot preset + Start | 5 / 10 / 25-turn loop |
| Edit Author's Notes | Chat Controls → Author's Notes | [authors-notes.md](authors-notes.md) |
| Regenerate image (long-press) | Image long-press menu | Same prompt, new seed |
| Open Image Viewer | Tap any inline image / Gallery item | [image-viewer.md](image-viewer.md) |
| Branch conversation | Rail ⑂ | Fork from message |
| Generate image from message | Rail 🖼 | Non-blocking |
| Change image resolution | Image options modal | 7 presets + Random |
| Generate video from image | Image options modal bottom | Image-to-video |
| Regenerate image | Rail ↻ on image | |
| Save/export image | Rail 📷 `(inferred)` | |
| Conversation menu | ⋯ kebab on composer | Contents not captured |

## User Extensions / Scope Decisions

- **Keep every observed pattern verbatim** — this screen is the soul of the product. Do not simplify.
- Single-NPC only (matches the current folder name "SingleNPCInteractionVersion" and user's explicit decision).
- Accent-color theming should be implemented as a CSS custom property (`--char-accent`) scoped to the chat view root; all tinted components read from it.
- "Generate Image" and "Generate Video" should be **hard-gated** on the user having configured an image/video provider (their own ComfyUI URL or cloud key). If not configured, show the button with an inline "Configure provider" state that deep-links to [Settings](settings-index.md).
- Keep **non-blocking** generation; web can use SSE or WebSocket for status.
- Keep the Conversations list per-character.
- **Swipe variants** (prev/next alternates on a message) — marketing says they exist but screenshots don't capture them. Plan the UI: on web, replace swipe with explicit `< 1/3 >` counter + arrow keys.
- **Suggested Replies** — opt-in (user taps to request) rather than always-on. Cheap on tokens; keeps user in the driver's seat.
- TTS dual-voice: use italic-vs-plain parsing to route to narrator vs dialogue voice; pluggable TTS engine (browser `speechSynthesis` fallback, user-provided cloud key preferred).

## Open Questions

- ~~Exact UI for message **variants swipe** and **edit message**~~ — **RESOLVED** ([IMG_4200](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4200.PNG)): `< N/M >` counter + user-message long-press sheet with Edit action.
- ~~Contents of the **⋯ conversation menu**~~ — **RESOLVED**: it's the [Chat Controls](chat-controls.md) modal.
- ~~Does **Branch** create a new Conversation or a tree inside one Conversation?~~ — **RESOLVED** via [branch.md](branch.md): Fork creates a **new Conversation record** with parent links (`branchParentConversationId`, `branchParentMessageId`).
- What exactly does **Edit** on a user message do to downstream turns (re-run them, or just replace locally)?
- Does the **Generate Image** action use the character's `appearanceDescription` always, or only when "Append appearance to image prompts" is ON? (Setting exists; runtime behavior needs confirmation.)
- Is the suggested-replies generation a separate model call (cheap model) or the main model? Settings should expose this.
- Are there streaming indicators (tokens typing out live) in PersonaLLM? Not obvious from still screenshots.
- Auto-image generation (onboarding Slide 5 toggle) — does it trigger image generation on EVERY assistant message, or heuristically on scene changes?
