# Settings → Speech Recognition

## Observed in PersonaLLM

Source: [Settigns/IMG_4190.PNG](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4190.PNG).

Header: `< · Speech Recognition`. Section: **SPEECH RECOGNITION**.

### Engine (radio list)
| Option | Description |
|---|---|
| ✅ **Apple Speech** | "Built-in, no download required" |
| ⚪ **WhisperKit** | "OpenAI Whisper via CoreML (local)" |

### Status card
- Green check: **"Ready to use"**
- Detail: "SpeechAnalyzer (on-device). Falls back to SFSpeechRecognizer if the on-device model isn't available."

### Usage context
Feeds the 🎤 mic icon on the Chat composer (and the 🎤 mic on the Character-creation "Character Concept" textarea).

## User Extensions / Scope Decisions

- On web: use the browser's **`SpeechRecognition` / `webkitSpeechRecognition`** as the default "System" engine.
- Offer **Whisper (via WebAssembly)** as the "local" option if bundle size is acceptable, else offer **Whisper via user's OpenAI / Groq API key** as a BYOK alternative.
- Keep the engine picker simple (System vs Whisper); defer advanced whisper params (model size, language) to an Advanced sub-panel.

## Open Questions

- Does PersonaLLM support setting a **preferred language** for transcription?
- Continuous vs push-to-talk — default behavior not visible here.
