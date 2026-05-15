# 06 — Chat Interaction Model

> Deep consolidation of [04-screens/chat.md](04-screens/chat.md). Read that first for the raw UI inventory; this file distills the *model* behind it for prompt-assembly and data-model work.

## Observed in PersonaLLM

### Conversation object model (inferred from UI)

```
Character (1) ──< Conversation (N)
Conversation ──< Message (N)
Message ──< MessageVariant (N)          // "swipe through variants"
Conversation ──< Branch (tree)          // "fork any conversation from any message"
Message ──(0..1)── ScenarioRef          // message #0 is the scenario
Message ──(0..N)── InlineMedia          // images, videos generated from that message
```

Evidence trail:
- Multiple Conversations per Character: [Chat/IMG_4132](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4132.PNG) (Conversations list).
- Scenario is persistent message #0: top of thread in [Chat/IMG_4126](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4126.PNG), [IMG_4127](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4127.PNG).
- Variants: marketing ("Regenerate any response. Swipe through variants…"); Regenerate rail chip observed.
- Branches: marketing + Branch rail chip observed.
- Inline media attached to messages: [Chat/IMG_4147](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4147.PNG).

### Message anatomy
| Attribute | Source |
|---|---|
| role | `user` \| `assistant` \| `scenario` (a first-turn synthetic assistant message) |
| content | mixed narration (italic) + dialogue (plain quoted) |
| variants[] | list of alternative assistant contents; active index persisted |
| attachments[] | generated images/videos with their own generation metadata (prompt, model, resolution, seed) |
| createdAt | shown as HH:MM below the bubble |
| branchPoint? | if the message is a branch origin |

### Narration vs. dialogue convention

PersonaLLM relies on **italic = narration, plain = dialogue** inside a single assistant message. Consistently observed in:
- [IMG_4126](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4126.PNG): "*I blink, tilting my head slightly…*" / "So let me help you finish it…"
- [IMG_4147](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4147.PNG): Clara Moretti narration + dialogue.

This dual-register is the **free signal** for dual-voice TTS (narrator voice on italic spans, dialogue voice on plain/quoted spans) — marketing confirms dual-voice TTS exists.

### Writing Style effect

Three built-in Writing Styles observed ([character-info.md §Settings tab](04-screens/character-info.md#3c-settings-tab)):
- **Roleplay** — italic narration + quoted dialogue, novelistic third-/first-person hybrid (the style shown in all Chat screenshots).
- **Storybook** — `(inferred)` prose-heavy, less dialogue, narrator POV.
- **Texting** — `(inferred)` short SMS-style turns, no narration, no quotes.

Writing Style is stored per-Conversation (Default Writing Style on Character sets the default for new conversations). It gets injected as a directive near the top of the prompt. Exact directive text: `(open question — see Pass D)`.

### Scenarios as first-turn seeds

Every Conversation starts with a Scenario (one of the character's N scenarios). The Scenario body is sent as message #0 with `role = scenario` (UI-only; in the LLM call it is most likely injected as the assistant's first message — treated as if "the character already opened the scene"). `(inferred)` confirmation needed by watching payload in Pass D/inspection.

**Consequence for prompt assembly:** the first "user" turn is the user's literal first message; the "assistant" has already spoken via the scenario. This matches Character Card V2's `first_mes` convention.

### Actions → state transitions

| UI Action | State transition |
|---|---|
| Send message | append `user` message → call LLM → append `assistant` message (streaming?) |
| Regenerate | create a new `variant` on the target assistant message; set active variant |
| Swipe variant | change active variant index (no LLM call) — UI shows `< N/M >` counter |
| Edit message (long-press → Edit) | replace active variant content; downstream re-run behavior `(open)` |
| Delete message (long-press → Delete → confirm) | remove message + attached media |
| New Response (on user msg long-press) | regenerate the assistant reply to this user message |
| Branch / Fork from here | create new Conversation; mode = keepMessages or summarizeFresh; parent + anchor stored |
| Generate image from msg | enqueue async image job (non-blocking); on complete, attach to message |
| Regenerate image (image long-press) | same prompt, new seed |
| Generate video from image | enqueue async video job on an existing image attachment |
| Suggested Replies | call LLM with a "give me 3 short next-turn options" meta-prompt; show chips; chip-tap = quick send |
| Start Autopilot (Chat Controls) | for N turns (5/10/25), auto-pick a suggested reply and send; stops on user input or error |
| Set Author's Notes (Chat Controls → Author's Notes) | store AuthorsNote at scope + injection depth; subsequent prompts include it |
| Per-conversation provider override (Chat Controls → Generation → Image/Video) | write to ChatControlsState; next generation uses the override |

### Rail-chip map (per target type)

| Target | Chips |
|---|---|
| Assistant text message | Regenerate · Branch · Generate Image |
| Assistant message with image | Regenerate (image) · Save · Collapse · (Generate Video via options modal) |
| User message | `(not captured — likely Edit + Delete)` |
| Scenario message | `(not captured — likely none, or "Change Scenario")` |

### Streaming

Not definitively visible in stills. Marketing implies real-time generation (text + image + video). Assume text streaming is supported — plan the clone for SSE/WebSocket, but not as a hard requirement.

### Suggested Replies

- Triggered manually via a **"💬 Suggested Replies"** pill above the composer (observed in every Chat screenshot).
- On tap: 3 chips appear (inferred; chips visible in marketing but not stills).
- Tapping a chip sends it as the next user message.
- Marketing quote: "Three contextual options after every response — tap to continue instantly."

### Auto Image Generation

Onboarding Slide 5 ([Onboarding/IMG_4111](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4111.PNG)) surfaces an **"Auto Image Generation"** toggle — when ON, the app automatically generates scene images as the chat progresses. Exact trigger heuristic not captured. Likely: after each assistant message (capped by cooldown), or on scene-change detection. `(open question)`

## User Extensions / Scope Decisions

- Keep the **Conversation (N) per Character** model.
- Keep **message-level variants** and **branches**; treat them as the same underlying mechanism (variants are branches without forking the conversation).
- Keep **narration/dialogue typography** convention and wire it to dual-voice TTS routing on web.
- Keep **Suggested Replies as opt-in** (one tap to request), not always-on.
- Keep **Writing Styles** with built-in + user-defined; confirm the exact directive strings in Pass D.
- **Image/Video generation must gracefully degrade** when the user hasn't configured a provider (show a small config CTA instead of the 🖼 chip).
- Log LLM/image/video costs locally per-user (no monetization, but transparency is useful when users are paying their own keys).

## Open Questions

- How is a Scenario represented in the LLM payload — as the assistant's `first_mes`, as a system-prompt suffix, or as a separate tool message?
- Exact **Writing Style** directive strings.
- Auto-image trigger heuristic.
- Edit-message semantics: re-run downstream turns, or just replace locally?
- Is Branch a full Conversation clone or a lightweight tree node inside one Conversation?
