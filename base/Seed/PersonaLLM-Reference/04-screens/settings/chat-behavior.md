# Settings → Chat Behavior

## Observed in PersonaLLM

Source: [Settigns/IMG_4154.PNG](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4154.PNG).

Header: `< · Chat Behavior`. Section label: **CHAT BEHAVIOR**.

| Field | Control | Default / Observed | Copy |
|---|---|---|---|
| **Typing Speed** | Slider (0 → 1) | `0.80` (shown) | "Controls visual reveal only: 0 = slowest, 1 = instant" |
| **Suggested Replies** | Toggle | ON | "Show AI-suggested responses after each message" |

## Notes

- Typing Speed is **visual-only** — does not affect actual generation; controls the client-side reveal animation of streamed tokens.
- With Suggested Replies ON, the "💬 Suggested Replies" pill in [Chat](../chat.md) auto-populates 3 chips after every assistant response. When OFF, the pill still exists but the user must tap to request.
  - `(inferred)` — not captured in Chat screenshots, but this matches the toggle's literal copy.

## User Extensions / Scope Decisions

- Keep both controls verbatim.
- On web, expose Typing Speed as CSS-animated reveal (or disable for users who prefer instant).

## Open Questions

- When Suggested Replies is OFF, does the pill disappear or remain as a manual trigger? (Observed pill in [Chat/IMG_4125](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4125.PNG) suggests manual trigger.)
