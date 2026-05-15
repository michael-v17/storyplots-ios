# 08 — Generation Parameters

> Every user-facing generation knob captured in PersonaLLM's Settings, with observed defaults and source screenshots.

## Observed in PersonaLLM

### Text generation (per ProviderConfig — [settings/text-engine.md](04-screens/settings/text-engine.md))

| Label (verbatim) | Control | Default | Source |
|---|---|---|---|
| Base URL | text | `https://openrouter.ai/api/v1` | [IMG_4178](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4178.PNG) |
| API Key | masked text + 👁 reveal | — | [IMG_4178](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4178.PNG) |
| Model | dropdown (searchable) + refresh | `deepseek/deepseek-v3.2` | [IMG_4181](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4181.PNG) |
| Test Connection | button | — | [IMG_4180](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4180.PNG) |
| Thinking Mode | toggle | OFF | [IMG_4179](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4179.PNG) |
| Temperature | slider | `0.7` | [IMG_4179](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4179.PNG) |
| Max Tokens | slider | `8192` | [IMG_4179](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4179.PNG) |
| Context Length | slider (tap to type) | `32768` | [IMG_4179](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4179.PNG) |

**Not exposed (possibly missing):** top-p, top-k, frequency/presence penalty, stop sequences. Clone should add these in an "Advanced" collapsible.

### Providers available (Text — [settings/text-engine.md §Choose Provider](04-screens/settings/text-engine.md#choose-provider-img_4182))

**Local (6+):** Ollama :11434, LM Studio :1234, KoboldCpp :5001, llama.cpp :8080, Text Gen WebUI :5000 (oobabooga), vLLM :8000.
**Cloud (3+ visible):** OpenRouter, OpenAI, Google. More below fold.

### Image generation (per ComfyUI workflow placeholder — [settings/image-engine.md](04-screens/settings/image-engine.md))

| Label | Control | Default | Source |
|---|---|---|---|
| ComfyUI Server | text | `http://localhost:8188` | [IMG_4185](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4185.PNG) |
| Image Workflow Template | tab | Default \| Custom | [IMG_4185](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4185.PNG) |
| Model | dropdown (+refresh) | (provider list) | [IMG_4185](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4185.PNG) |
| Sampler | dropdown | `euler` | [IMG_4185](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4185.PNG) |
| Scheduler | dropdown | `normal` | [IMG_4185](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4185.PNG) |
| Steps | number | `20` | [IMG_4185](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4185.PNG) |
| CFG Scale | number | `7` | [IMG_4185](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4185.PNG) |
| Seed | text | blank = random | [IMG_4185](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4185.PNG) |
| Prompt Prefix | text | (user-set) | [IMG_4186](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4186.PNG) |
| Negative Prompt | text | `text, watermark, worst quality, low quality` | [IMG_4186](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4186.PNG) |
| Enable Refinement | toggle | ON | [IMG_4183](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4183.PNG) |
| Refinement Context Messages | stepper | `3` | [IMG_4184](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4184.PNG) |

### Image resolution presets (global — [settings/visual-roleplay.md](04-screens/settings/visual-roleplay.md))
Square 1408² · Portrait 1280×1664 · Landscape 1664×1280 · Tall Portrait 1088×1920 · Wide Landscape 1920×1088 · Ultra Tall 1024×2048 · Ultra Wide 2048×1024 · Custom.
Selection from in-chat resolution modal ([Chat/IMG_4131](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4131.PNG)).

### Providers available (Image — [settings/image-engine.md](04-screens/settings/image-engine.md))
**Self-hosted:** ComfyUI (Local). **Direct APIs:** OpenAI (GPT Image 1.5), Google (Imagen 4, Nano Banana via Gemini), xAI Grok (Grok Imagine). Marketing claims 20+.

### Video generation ([settings/video-engine.md](04-screens/settings/video-engine.md))

| Label | Control | Default | Source |
|---|---|---|---|
| Provider tab | tabs | Cloud \| Custom | [IMG_4206](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4206.PNG) |
| Video Provider | picker | ComfyUI (Local) | [IMG_4208](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4208.PNG) |
| ComfyUI Server | text | `http://localhost:8188` | [IMG_4208](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4208.PNG) |
| Workflow Template | tabs | None \| Custom (no bundled default) | [IMG_4209](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4209.PNG) |
| Enable Refinement | toggle | ON | [IMG_4206](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4206.PNG) |
| Refinement Provider | dropdown | None (must select) | [IMG_4206](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4206.PNG) |
| Refinement Context Messages | stepper | 3 | [IMG_4207](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4207.PNG) |
| Refinement System Prompt | text | verbatim in [settings/video-engine.md](04-screens/settings/video-engine.md) | [IMG_4206](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4206.PNG) → [IMG_4214](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4214.PNG) |
| Video Prompt Prefix (global) | text | placeholder "e.g. smooth camera motion, cinematic" | [Prompt Editor §3.c](04-screens/settings/prompt-editor.md#3c-video-prompts) |
| Video Negative Prompt (global) | text | `text, watermark, worst quality, low quality` | [Prompt Editor §3.c](04-screens/settings/prompt-editor.md#3c-video-prompts) |

Observed output durations: 5s, 8s (from Gallery + Community media). Duration presets not found in the Video Engine screen — likely part of the uploaded ComfyUI workflow or the Chat Controls video picker.

### TTS ([settings/text-to-speech.md](04-screens/settings/text-to-speech.md))
| Label | Control | Default |
|---|---|---|
| Text-to-Speech | toggle | ON |
| TTS Provider | tabs | `System | Kokoro` |
| Default Voice | picker | system-dependent |
| Speed | slider | Normal |
| Pitch | slider | Normal |
| Volume | slider | 100% |

### STT ([settings/speech-recognition.md](04-screens/settings/speech-recognition.md))
Engine: Apple Speech (default) or WhisperKit (local CoreML).

### Retrieval / Memory params ([settings/memory.md](04-screens/settings/memory.md))
See verbatim table in that file (8 knobs + Auto Lore Extraction cadence).

### Chat / UX params ([settings/chat-behavior.md](04-screens/settings/chat-behavior.md))
| Label | Default |
|---|---|
| Typing Speed | 0.80 (0=slowest, 1=instant) |
| Suggested Replies | ON |

## User Extensions / Scope Decisions

- Keep every captured knob verbatim, including defaults.
- Expand Text generation panel to also expose **top-p, top-k, frequency/presence penalty, stop sequences** under an "Advanced" section.
- Make Image Workflow placeholders **per-character overridable** (useful when a character has a specific style).
- On web, move "Tap value to type" into a proper text input beside the slider (more accessible than the iOS gesture).
- All params per ProviderConfig → scoped by `userId` in the clone.

## Open Questions

- Full text-generation knob set (top-p / top-k / penalties / stop) — confirmed absent or hidden?
- Video Engine detail screen contents (duration presets, fps, resolution, motion).
- TTS per-character voice-pair UI.
- Cloud image-provider detail screen (style preset "Cloud · Anime").
