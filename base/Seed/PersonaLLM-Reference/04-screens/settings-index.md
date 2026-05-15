# Screen — Settings (Index)

## Observed in PersonaLLM

Source: [Settigns/](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/) — 41 screenshots IMG_4152 … IMG_4192. The settings screen is reached from the side [Menu](menu.md) → ⚙ Settings row.

### Root layout ([IMG_4152](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4152.PNG), [IMG_4153](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4153.PNG))

Header: centered title **"Settings"** + right pill button **"Done"**.

Three top-level sections, each a bordered card with rows of `icon · label · trailing value · chevron`:

#### 💬 CHAT EXPERIENCE
| Row | Observed trailing value | Detail file |
|---|---|---|
| 💬 **Chat Behavior** | "Suggested" | [settings/chat-behavior.md](settings/chat-behavior.md) |
| 🖐 **Memory** | "On · Auto Lore" | [settings/memory.md](settings/memory.md) |
| 🎭 **Visual Roleplay** | "On" | [settings/visual-roleplay.md](settings/visual-roleplay.md) |
| 🎨 **Bubble Colors** | "Default" | [settings/bubble-colors.md](settings/bubble-colors.md) |
| 📝 **Prompt Editor** | — | [settings/prompt-editor.md](settings/prompt-editor.md) |

#### ✨ AI & VOICE
| Row | Observed trailing value | Detail file |
|---|---|---|
| 📖 **Text Engine** | "Cloud" | [settings/text-engine.md](settings/text-engine.md) |
| 🖼 **Image Engine** | "Cloud · Anime" | [settings/image-engine.md](settings/image-engine.md) |
| 🎥 **Video Engine** | "Cloud · 5s" | [settings/video-engine.md](settings/video-engine.md) |
| 🔊 **Text-to-Speech** | "Off" | [settings/text-to-speech.md](settings/text-to-speech.md) |
| 🎤 **Speech Recognition** | "Apple Speech" | [settings/speech-recognition.md](settings/speech-recognition.md) |

#### 🔒 DATA & SECURITY
| Row | Observed trailing value | Detail file |
|---|---|---|
| ✅ **Age Verification (18+)** | "Verified via Apple · Apr 13, 2026" (green sub) | [settings/data-security.md](settings/data-security.md) |
| 🔓 **App Lock** | toggle ("Require Face ID to open the app") | [settings/data-security.md](settings/data-security.md) |
| ☁ **Cloud AI Consent** | toggle ("Allow sending data to OpenRouter, Atlas Cloud, and RunPod for AI features") | [settings/data-security.md](settings/data-security.md) |
| 💾 **Storage** | "41.1 MB" | [settings/data-security.md](settings/data-security.md) |
| ⛔ **Erase Everything & Reset** | red link (destructive) | [settings/data-security.md](settings/data-security.md) |

Footer link (red, last row in Data & Security card):
- **Reset All Settings**

### Patterns
- Every row uses icon + label with trailing summary that reflects live state ("On", "Off", chosen model name, size).
- Destructive actions are rendered in red text.
- Section labels are small-caps, muted.

## User Extensions / Scope Decisions

- Keep the **3-section taxonomy** (Chat Experience / AI & Voice / Data & Security) — it scales well.
- The clone's Data & Security changes:
  - Remove references to **Atlas Cloud** and **RunPod** in the Cloud AI Consent copy — clone uses only what the user's BYOK implies (OpenRouter + user's ComfyUI URL + user's chosen cloud image/video APIs).
  - Remove the "Community profile, uploads, and media" bullet from the Erase flow (Community is cut).
- **App Lock** (Face ID) → on web, replace with an optional "Re-authenticate after N minutes of inactivity" session-lock.
- **Storage** metrics should still exist on web (per-user quota display, export, import, per-category delete).

## Open Questions

- Some visible row trailing values imply sub-states we haven't fully explored:
  - "Cloud · Anime" on Image Engine suggests a **style preset** layer; only "Cloud / Custom" tabs captured.
  - "Cloud · 5s" on Video Engine implies a default duration; Video Engine detail screen not captured.
- Is there a "Per-character overrides" settings view (for when Memory is globally on but you want it off for one character)?
