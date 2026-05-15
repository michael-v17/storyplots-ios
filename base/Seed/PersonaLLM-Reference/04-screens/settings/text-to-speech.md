# Settings → Text-to-Speech

## Observed in PersonaLLM

Source: [Settigns/IMG_4191.PNG](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4191.PNG).

Header: `< · Text-to-Speech`. Section: **TEXT-TO-SPEECH**.

| Field | Control | Observed | Copy |
|---|---|---|---|
| **Text-to-Speech** | Toggle | ON | "Read AI responses aloud" |
| **TTS Provider** | Tab switcher | `System | Kokoro` (System selected) | — |
| **Default Voice** | Card | "No enhanced voices available" | Hint: "Download voices in iOS Settings → Accessibility → Spoken Content → Voices" |
| **Speed** | Slider | Normal (mid) | — |
| **Pitch** | Slider | Normal (mid) | — |
| **Volume** | Slider | `100%` | — |
| **Test Voice** | Button (play ▶) | — | — |

### Notes
- Only **one voice** configurable here (single default voice). The marketing claim of **dual-voice TTS** (dialogue + narration) must therefore be configured *somewhere else* — most likely per-character in the Character editor Settings tab (a section below what Pass C captured) or in an expanded TTS panel not visible in this screenshot.
- **Kokoro** provider is on-device; **System** provider uses iOS TTS.

### Per-character dual voices `(inferred, pending)`
Marketing copy ([Website.md](../../../../References/PersonaLLM/ExtraDocuments/Website.md)): "Dual-voice TTS — one for dialogue, one for narration. On-device Kokoro or system voices with autoplay."

→ The observed italic-vs-plain typography ([chat.md](../chat.md)) drives routing:
- `*italic asterisks*` → narrator voice
- `"quoted dialogue"` → dialogue voice

The per-character voice assignment UI is not captured. `(open question)`

## User Extensions / Scope Decisions

- PersonaLLM ships with **only one voice (female)** — this is a real product limitation. The clone will **fix this by default** via the extension below.
- **Kokoro gender-matched TTS (clone extension).** Use the on-device / web-assembly Kokoro engine to route to a **male voice for male Characters** and a **female voice for female Characters**.
  - Derivation: read `Character.gender` (Male / Female / Non-binary / Custom — clone widens from PersonaLLM's Male/Female). Fallback to a heuristic scan of `Character.appearanceDescription` ("male" / "female" keyword) when gender is Custom or not set.
  - The **narrator voice** stays consistent across characters (e.g., a neutral narrator voice the user picks once globally).
  - Dual-voice routing: italic `*asterisks*` → narrator voice; `\"quoted\"` dialogue → character-gender voice.
  - Clone's Character editor (or TTS settings) should expose **"Override voice"** per character so the user can pin a specific Kokoro voice to a character if the automatic gender match is wrong.
- On web, the `System` engine maps to the browser's `speechSynthesis` API. The clone can ship with that + optional cloud TTS (OpenAI TTS, ElevenLabs, Cartesia, etc.) as BYOK.
- Keep Speed / Pitch / Volume sliders + Test Voice button.
- **Per-Character voice pair** (narrator + dialogue voice) is what makes dual-voice TTS work correctly. Belongs in a new section of the Character editor's Settings tab.

## Open Questions

- Where is the dual-voice routing configured (narrator voice vs dialogue voice picker)?
- Does the System provider actually play tts on iOS without downloaded voices, or is "No enhanced voices available" a blocking error state?
- Autoplay toggle referenced in marketing — not visible on this screen. Where is it?
