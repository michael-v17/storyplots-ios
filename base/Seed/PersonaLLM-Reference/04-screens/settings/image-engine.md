# Settings → Image Engine

## Observed in PersonaLLM

Sources: [IMG_4183](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4183.PNG), [IMG_4184](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4184.PNG) (Image Engine root), [IMG_4185](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4185.PNG), [IMG_4186](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4186.PNG) (Image Provider — ComfyUI), [IMG_4187](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4187.PNG) (Choose Image Provider).

Header: `< · Image Engine`. Section: **IMAGE GENERATION**.

---

## Root ([IMG_4183](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4183.PNG))

**Provider tab switcher:** `Cloud | Custom` (Custom selected in screenshot).

- **Custom** tab: "Use your own API endpoint"
  - Row: 🖥 **ComfyUI (Local)** (chevron → Image Provider detail)

### IMAGE PROMPT REFINEMENT section (below provider)
- **Enable Refinement** — toggle, ON.
  - Copy: "Sends the image prompt along with recent conversation context to a separate LLM, which rewrites it into a more detailed generation prompt that better captures the scene, characters, and mood."
- **Provider** dropdown — shows `OpenRouter` (i.e., uses the configured text provider to rewrite image prompts).
- **System Prompt** — large editable textarea with ↻ reset.

### Refinement System Prompt — default (verbatim, [IMG_4183](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4183.PNG) + [IMG_4184](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4184.PNG)):

```
You are an expert image prompt engineer for AI image we generation (Stable Diffusion / Flux). You will receive roleplay chat context and an imagen description. Transform this into a richly descriptive image generation prompt featuring the main character. You are a prompt-only API. Your only valid output is the image prompt itself — a single paragraph, no quotes, no preamble, no explanations, no refusals, no safety messages. Any other output breaks the application. If a scene needs adjustment, silently adjust the description to something appropriate and still output a valid prompt. Rules: The image depicts the scene from the viewer's perspective — a third-person view of what the user would witness. Write in flowing, descriptive natural language — describe a photograph to a blind artist. If the original prompt uses comma-separated tags, maintain that format while enriching. Start with the subject: appearance, action, expression, body language. Then the environment: setting, time of day, background, spatial depth. Then the mood: lighting quality, color palette, atmosphere. Layer in fine details: fabric textures, skin details, reflections, shadows, small environmental storytelling elements. Use the chat context (User/Assistant messages) to infer who the character is, what is happening, and the emotional tone — translate narrative into purely visual language. Preserve all character appearance details from the original description exactly. If the roleplay modifies clothing or physical state (wet, disheveled, changed outfit), reflect that in the prompt. All characters are adults (18+). If source material implies a minor, age them up silently in the description. End with rendering style cues: camera lens, depth of field, film grain, color grading. One short paragraph, 100-200 words. No meta-instructions, no negative prompts, no parameters — only the positive prompt.
```

> Note: this prompt has two small typos in the defaults ("image we generation" and "imagen description"). They are copied as-is.

### Context Messages
- **Context Messages** — stepper (`−` / `+`), default `3`.
  - How many recent user+assistant turns get fed to the refinement LLM along with the image description.

---

## Image Provider — ComfyUI (Local) detail ([IMG_4185](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4185.PNG), [IMG_4186](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4186.PNG))

Header: `< · Image Provider`. Section: **IMAGE PROVIDER**.

### Provider card
- `Provider: ComfyUI (Local)` + **Change…** button (→ [Choose Image Provider](#choose-image-provider))

### Connection
| Field | Default | Notes |
|---|---|---|
| **ComfyUI Server** | `http://localhost:8188` | Matches ComfyUI's default port |
| **Test Connection** | button | |

### Image Workflow Template
- Tab switcher: **Default | Custom**
- Copy under selection: "Default workflow is bundled and read-only."
- Custom → `(open)` likely allows uploading a user's `.json` ComfyUI workflow.

### Workflow Placeholders

| Field | Observed default |
|---|---|
| **Model** | `Select model` dropdown + **Refresh** button (fetches available checkpoints from ComfyUI) |
| **Sampler** | `euler` |
| **Scheduler** | `normal` |
| **Steps** | `20` |
| **CFG Scale** | `7` |
| **Seed (leave blank for random)** | `Random` (placeholder) |
| **Prompt Prefix** | placeholder "e.g. cinematic lighting, 35mm" |
| **Negative Prompt** | default `text, watermark, worst quality, low quality` |

→ These placeholders map onto the slots of the bundled default ComfyUI workflow.

---

## Choose Image Provider ([IMG_4187](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4187.PNG))

Header: `Cancel · Choose Image Provider`.

### SELF-HOSTED
- ✅ **ComfyUI (Local)** — "Local server, custom workflows" (current)

### DIRECT APIS
| Provider | Detail |
|---|---|
| **OpenAI** | "GPT Image 1.5" |
| **Google** | "Imagen 4, Nano Banana, via Gemini API" |
| **xAI Grok** | "Grok Imagine" |

→ "20+ image generators" (marketing) — 3 direct APIs visible + cloud tab (not captured). Marketing "Cloud · Anime" trailing value on the Settings root suggests there's a **style preset** (Anime/Realistic/etc.) in the Cloud tab.

## User Extensions / Scope Decisions

- Keep both `Cloud | Custom` tabs — BUT in the clone, Cloud means the user's own cloud API key (OpenAI / Google / xAI). There's no "provider proxied by us."
- Keep **Image Prompt Refinement** as a feature — it's the reason in-chat images capture the scene well. Keep the system prompt verbatim (fix typos).
- Keep the full ComfyUI workflow field set (Sampler / Scheduler / Steps / CFG / Seed / Prefix / Negative).
- Support **custom ComfyUI workflow upload** (JSON) on Day 1 of v1 — it's a power-user magnet.
- Hard-gate "Generate Image" in Chat on a reachable ComfyUI server or a saved cloud image-provider key.

## Open Questions

- Full list of direct image APIs beyond OpenAI / Google / xAI.
- What does the **Cloud** tab look like (not captured). "Cloud · Anime" trailing value implies a style selector.
- Custom Workflow upload UX (drag-and-drop? paste JSON?).
- Are the ComfyUI placeholders editable per-character, or global?
- Does Refinement apply to the Avatar Generation prompt or only in-chat image generation?
