# 01 — Overview

## Observed in PersonaLLM

### What it is
PersonaLLM is a character-chat app for creating and chatting with custom AI characters. Marketing tagline: **"Your stories, brought to life with AI."** ([Website.md](../../References/PersonaLLM/ExtraDocuments/Website.md))

### Core value props (verbatim from marketing site)
- Chat with custom AI characters — unlimited messages.
- Real-time **image and video** generation (with audio on videos).
- **On-device memory**; privacy- and local-first.
- **Voice roleplay** (dual-voice TTS: dialogue + narration).
- Free for basic chat; **Bring Your Own Keys** for power features.

### Feature pillars (from marketing)
1. **Watch and hear your story** — in-chat image/video generation via local ComfyUI or 20+ cloud providers.
2. **Share your world** — community browse / download / share / sandbox-try / rate / favorite.
3. **Built for power users** — BYO API keys (13+ text, 20+ image, 10+ video providers), local MLX models, conversation branching, RAG memory, dual-voice TTS, custom writing styles, deep character creation.

### Ancillary features (from marketing)
- Character Memory (RAG + semantic search + keyword-triggered lore + uploaded documents).
- Auto Lorebook Extraction from conversations.
- Character Voices (dual-voice TTS; on-device Kokoro or system voices; autoplay).
- Conversation Branching (fork from any message; navigate branch tree).
- User Personas (multiple personas with appearance/personality/backstory).
- Writing Styles (Chat / Narrator / custom; first- or third-person).
- Character Import (JSON or PNG character cards).
- Message Variants (regenerate + swipe alternates).
- Suggested Replies (three contextual options after each response).

### Platform (observed)
- **iOS mobile app** — every screenshot is an iPhone capture (status bar, aspect ratio, `IMG_*.PNG` naming; "Download on the App Store" CTA; see [Home/IMG_4095.PNG](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4095.PNG)).
- Distributed on the App Store (marketing CTA).
- Local-first architecture implied by "on-device memory", "Private & Local-First", "Run models locally with MLX".

### Target user (inferred)
Roleplay / interactive-fiction enthusiasts and power users who want control over models, prompts, and memory — not a mass-market companion app. Evidence: dense settings surface (41 settings screenshots), BYO-keys emphasis, character-card import, branching, RAG.

### Monetization (observed)
- **Credits** system — visible in Menu footer: "Credits 310" ([Menu/IMG_4151.PNG](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Menu/IMG_4151.PNG)).
- "Free Basic Chat" + BYOK for advanced features (marketing copy).
- Exact credit economics (what consumes credits, pricing tiers) — `(inferred)`, pending Settings deep-read.

### Legal / privacy surface
- Privacy Policy and Terms of Service exist as discrete documents ([PrivacyPolicy.md](../../References/PersonaLLM/ExtraDocuments/PrivacyPolicy.md), [TermsOfService.md](../../References/PersonaLLM/ExtraDocuments/TermsOfService.md)); details consolidated in [10-non-functional.md](10-non-functional.md).

## User Extensions / Scope Decisions

The target app is a **close clone of PersonaLLM** adapted to web, with the following explicit scope cuts and additions confirmed by the user:

**Keep (copy faithfully):**
- Single-NPC (1:1) chat with custom Characters.
- Character creation, editing, import (JSON + PNG card).
- UserPersona system.
- Memory / Lorebook / RAG.
- Conversation branching, message variants, regenerate, edit, suggested replies.
- Writing Styles (Chat / Narrator / custom).
- Dual-voice TTS surface (dialogue + narration).
- Image / video generation surface.
- Deep settings for prompts and generation parameters.

**Cut:**
- **No Credits system.** No in-app currency, no monetization surface.
- **No Community.** No browse/share/rate/favorite of characters from other users. The Community screen family will still be documented from screenshots as reference, but flagged as out-of-scope for the build.
- No App Store / iAP surfaces.

**Change:**
- **Web-first, multi-user.** Each user has their own account and their own data.
- **BYOK per user.** Every user supplies their own API keys:
  - Text: OpenRouter (primary target) — and/or direct provider keys.
  - Image/Video: user's own ComfyUI endpoint URL, or provider keys.
  - No shared server-side keys, no centralized billing.
- **No local-only runtime (MLX / Kokoro) for v1 web** — replaced by BYOK cloud + user-hosted ComfyUI endpoint. Flagged in [11-web-adaptation-notes.md](11-web-adaptation-notes.md).
- Per-user isolation: each account sees only their own Characters, Chats, UserPersonas, Memory, Settings.

**Additional clone extensions (beyond PersonaLLM's observed behavior):**
- **Kokoro gender-matched TTS.** PersonaLLM ships one voice (female). The clone routes dialogue spans to a **male Kokoro voice for male Characters** and a **female Kokoro voice for female Characters**, derived from `Character.gender` (with appearance-description fallback for Custom). Narrator voice stays globally configured. See [settings/text-to-speech.md](04-screens/settings/text-to-speech.md).
- **Autopilot** and **Author's Notes** are kept verbatim from PersonaLLM — both are first-class power-user features captured in [chat-controls.md](04-screens/chat-controls.md) and [authors-notes.md](04-screens/authors-notes.md).
- **Debug Mode** (Chat Controls toggle) is kept — critical for BYOK users who want to see request/response and token costs.

**Future (not in v1):**
- StoryPlots grammar module and multi-NPC story/plot layer — deferred; see [Seed/creator-vision.md](../creator-vision.md) and [Seed/creator-vision-for-multiinteractions.md](../creator-vision-for-multiinteractions.md).

## Open Questions

- Is there a web or desktop build today, or only iOS? (All screenshots are iOS.)
- What exactly consumes Credits — only cloud text/image/video generation, or any LLM call?
- Is account creation required, or is the app usable fully offline/anonymous? (Answered partially in Onboarding — pending Pass B.)
