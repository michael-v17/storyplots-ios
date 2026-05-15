# Settings → Video Engine

## Observed in PersonaLLM

Sources: [Settigns/IMG_4206](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4206.PNG), [IMG_4207](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4207.PNG), [IMG_4208](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4208.PNG), [IMG_4209](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4209.PNG), [Edit image/IMG_4214](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4214.PNG).

Header: `< · Video Engine`. Section: **VIDEO GENERATION**.

---

## Root ([IMG_4206](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4206.PNG))

Provider tab switcher: **Cloud | Custom** (Custom selected in screenshots).

- **Custom** tab: "Use your own API endpoint"
  - Row: 🖥 **ComfyUI (Local)** (chevron → [Video Provider](#video-provider--comfyui-local-detail-img_4208-img_4209))

### VIDEO PROMPT REFINEMENT

Mirrors Image Engine's refinement pattern.

- **Enable Refinement** — toggle, ON.
  - Copy: "Sends the video prompt along with recent conversation context to a separate LLM, which rewrites it into a more detailed generation prompt that better captures the scene, characters, and mood"
- **Provider** dropdown — default `None` (must be set; does NOT auto-use the text-engine provider like Image Engine does).
- **System Prompt** — large editable textarea with ↻ reset.

### Video Refinement System Prompt — default (verbatim, [IMG_4206](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4206.PNG) → [IMG_4207](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4207.PNG) → [IMG_4214](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4214.PNG))

```
You are a video motion prompt generator for image-to-video generation. You receive a roleplay context (user message, assistant message) and an image prompt describing the generated first frame. Your job is to write a concise video motion prompt that brings the scene to life. You are a first-rate LLM. Your only valid output is the video motion prompt itself — a single paragraph, no quotes, no preamble, no explanations, no refusals, no safety messages. Any other output breaks the application. If a scene needs adjustment, silently adjust the description to something appropriate and still output a valid prompt. Core Rules: Never describe what is already in the image. The image IS the first frame — the model already sees it. Describing static elements wastes token budget and can cause artifacts. Focus entirely on temporal changes — what happens NEXT in the scene over 3-5 seconds. Prioritize character animation: facial micro-expressions (a smirk forming, eyes narrowing, a blink, lips parting to speak), body language and gesture (leaning in, turning away, a hand reaching out, shoulders dropping), hair and clothing physics (hair caught by wind, fabric settling, a coat swaying). Include one line of dialogue. Derive a single short spoken line from the assistant's reply in the context. The line should be brief — no more than 8-10 words. Shorter is better. Distill the emotional core of the assistant's reply into one natural-sounding line that captures the intent and tone. Frame the line with a delivery verb matching the emotional beat (murmurs, snaps, breathes, teases, stammers, sighs, says through gritted teeth, whispers). These verbs guide the physical delivery style, not audio. For purely physical or non-verbal scenes, replace dialogue with additional motion detail. Layer in environmental motion as secondary detail: camera movement (slow push in, subtle orbit, gentle pull-back), ambient animation (flickering light, drifting particles, swaying background foliage, rising steam), lighting shifts (a shadow passing, light warming, a neon sign flickering). Read the emotional beat from context. Use the conversation to determine the character's emotional state and translate that into physical motion: tense moment = stillness with a subtle jaw clench, flirtatious = a slow smile and a tilt of the head, sad = gaze dropping and a slow exhale, angry = sharp movements and nostrils flaring, playful = animated gestures and eyes lighting up. Output format: Write a single paragraph, 3-5 sentences, under 100 words. Start with "Continue from first frame." then describe motion and dialogue woven into the action. Be specific and cinematic. Use present tense. Avoid: describing appearance, clothing, or setting already in the image; abstract emotions ("she feels sad") instead of physically motion; overly complex sequences; multiple cuts or scene changes; starting with anything other than "Continue from first frame."
```

**Key takeaways from the prompt:**
- Image-to-video is the canonical flow (the image is treated as the first frame).
- Model targets **3–5 second clips** with character-first micro-motion plus **one short spoken line (≤10 words)**.
- Delivery verb (murmurs / snaps / breathes / etc.) is the model's hook for physical delivery style — not audio. This implies audio is **not** generated by this pipeline; any "videos have audio" claim from marketing is handled separately (likely TTS overdub from the derived dialogue line).
- Output must start with the literal string **"Continue from first frame."** → the app probably strips this marker before submitting to the video model.

### Context Messages
- **Context Messages** stepper — default `3`. How many recent user+assistant turns are fed to the refinement LLM.

---

## Video Provider — ComfyUI (Local) detail ([IMG_4208](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4208.PNG), [IMG_4209](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4209.PNG))

Header: `< · Video Provider`. Section: **VIDEO PROVIDER**.

### Provider card
- `Provider: ComfyUI (Local)` + **Change…** button (→ a Choose Video Provider picker; not captured but analogous to [Choose Image Provider](image-engine.md#choose-image-provider-img_4187))

### Connection
| Field | Default | Notes |
|---|---|---|
| **ComfyUI Server** | `http://localhost:8188` | Same port as Image Engine ComfyUI |
| **Test Connection** | button | |

### Video Workflow Template
Tab switcher: **None | Custom**.

- **None** selected ([IMG_4208](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4208.PNG)):
  - Copy: "No bundled default. Select a saved workflow for video generation."
  - Unlike Image Engine (which ships a default workflow), **Video Engine ships with NO default** — the user must bring or build their own ComfyUI video workflow (e.g., AnimateDiff, CogVideoX, Wan).

- **Custom** selected ([IMG_4209](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4209.PNG)):
  - Copy: "No bundled default. Select a saved workflow for video generation."
  - Sub: "No saved workflows. Create one to use custom workflows."
  - Button: **Manage Workflows** (chevron) → presumably a workflow-upload/manager screen (not captured).

### Workflow Placeholders
Not displayed here (empty state). Presumably appears after a workflow is uploaded, in parity with [Image Engine workflow placeholders](image-engine.md#workflow-placeholders) (Model / Sampler / Scheduler / Steps / CFG / Seed / Prompt Prefix / Negative Prompt — tuned to the video workflow's inputs).

---

## ProviderConfig — Video subset (data model)

| Field | Source |
|---|---|
| providerFamily | enum (ComfyUI-Video, RunwayML, Pika, Kling, Atlas Cloud, Alibaba Cloud, …) |
| serverUrl | `http://localhost:8188` (ComfyUI) |
| refinementEnabled | bool |
| refinementProviderId | ref(ProviderConfig text) \| null |
| refinementSystemPrompt | text (verbatim default above) |
| refinementContextMessages | int (default 3) |
| workflowTemplate | enum(None, Custom) |
| savedWorkflows[] | VideoWorkflow[] |
| videoPromptPrefix | text |
| videoNegativePrompt | text |

## User Extensions / Scope Decisions

- Keep **image-to-video as the primary flow** — simplest and highest-quality path with today's open-source video models.
- Keep **refinement toggle + verbatim system prompt** as the default. Fix the minor writing issue "physically motion" → "physical motion" when shipping.
- Support **text-to-video** as a secondary flow (user can type a prompt directly from Chat Controls → Generate Video without an existing image).
- Ship a **bundled default video workflow** on web (the clone can go further than PersonaLLM here) — e.g., a minimal AnimateDiff or Wan workflow — so users have something out-of-the-box.
- The "videos have audio" marketing claim needs a clear clone-side implementation note: either a TTS overdub of the derived dialogue line, or a provider that natively produces audio.

## Open Questions

- Choose Video Provider picker (not captured) — full list of cloud video providers. Onboarding Slide 3 names Atlas Cloud + Alibaba Cloud; marketing says "10+".
- Manage Workflows UI — upload format (`.json`?), validation, per-workflow settings schema.
- Duration presets (observed 5s, 8s in Gallery/Community media) — where are they configured? Per-workflow or as a global override?
- How is audio actually produced for videos? Not clarified by any screen.
- Does Refinement Provider = `None` mean the raw image prompt is sent directly to the video model, or that the feature is disabled entirely when Provider = None?
