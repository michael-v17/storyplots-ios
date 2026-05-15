# Settings → Data & Security

## Observed in PersonaLLM

Sources: [IMG_4152](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4152.PNG), [IMG_4153](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4153.PNG) (root rows), [IMG_4188](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4188.PNG), [IMG_4189](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4189.PNG) (Storage), [IMG_4192](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4192.PNG) (Erase Everything).

### Root rows ([IMG_4153](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4153.PNG))

- ✅ **Age Verification (18+)**
  - Green sub: "Verified via Apple · Apr 13, 2026"
  - Read-only in this state; re-verification path not captured.
- 🔓 **App Lock** — toggle row (OFF in screenshot)
  - Copy: "Require Face ID to open the app"
- ☁ **Cloud AI Consent** — toggle row (ON in screenshot)
  - Copy: "Allow sending data to OpenRouter, Atlas Cloud, and RunPod for AI features"
  - → This is the "revoke anytime in Settings" affordance referenced in onboarding Slide 3.
- 💾 **Storage** — trailing `41.1 MB` → Storage detail
- ⛔ **Erase Everything & Reset** — red destructive row
- (separator)
- **Reset All Settings** — red link (below the card)

---

## Storage detail ([IMG_4188](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4188.PNG), [IMG_4189](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4189.PNG))

Header: `< · Storage`. Hero: **"43 MB · Total Storage Used"**.

### BREAKDOWN (each row has a Delete link in red)

| Category | Example | Clone notes |
|---|---|---|
| 🖼 **Images & Avatars** | 20 items · 14.7 MB | Keep |
| 🎥 **Videos** | 5 items · 28.2 MB | Keep |
| 💬 **Conversations** | 6 items · 6 KB | Keep |
| ☁ **Community Cache** | 3.1 MB | SCOPE-CUT |

### MEMORY SYSTEM
- 🗃 **RAG Memory Stores** · 5 items — Delete

### DATA
- ⬆ **Export My Data** — button (likely a .zip of characters + conversations + memory)
- ⬇ **Import Backup** — button

### Footer microcopy
"Deleting media removes files but preserves your characters. Deleting memory stores removes cross-conversation recall."

---

## Erase Everything & Reset ([IMG_4192](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4192.PNG))

Confirmation sheet.

- Header: `Cancel · Erase Everything & Reset`
- Centered red user-with-X icon.
- Title: **"Erase Everything & Reset"**
- Sub: "This action is permanent and cannot be undone."

### What gets erased (red bullets)
- All characters and scenarios
- All conversations and messages
- All generated images and videos
- All user personas
- All memory stores and documents
- All downloaded models (MLX, TTS, STT)
- All app settings

### Yellow bullet
- **Community profile, uploads, and media**

### Red warning card
"⚠ Your community account will be permanently deleted from our servers."

### CTA
- **Continue** — bold red pill (destructive primary).

---

## User Extensions / Scope Decisions

- **Age Verification** stays on Day 1 (mature content). Swap "Verified via Apple" for email/OAuth confirmation record; keep verification date.
- **App Lock** → on web replace with **"Re-authenticate after N min of inactivity"** session lock (10 min default, adjustable).
- **Cloud AI Consent** → rewrite copy to match the clone's BYOK model:
  - Old: "Allow sending data to OpenRouter, Atlas Cloud, and RunPod for AI features"
  - New: "Allow sending your conversations to the AI providers you've configured (under AI & Voice → Text / Image / Video Engine). Keys never leave your account."
- **Storage** — keep all categories **except Community Cache** (remove, scope-cut).
- **Export My Data / Import Backup** — mandatory on Day 1 for portability (users are paying their own API keys; they deserve data freedom).
- **Erase Everything** — keep; remove the "Community profile, uploads, and media" bullet and the server-side community-account warning.
- **Reset All Settings** — keep as a non-destructive option that preserves characters/chats but reverts Settings to defaults.

## Open Questions

- Is **Age Verification** re-triggered when the user logs in on a new device? (Critical for the multi-user web.)
- What exactly is in the **Export My Data** zip? Format? Includes generated media and memory embeddings, or just text?
- Can the user **import a partial backup** (e.g., only characters, no conversations)?
- Is there a **per-character delete** / **per-conversation delete**, and do those appear elsewhere (in Character Info / Conversations list)?
