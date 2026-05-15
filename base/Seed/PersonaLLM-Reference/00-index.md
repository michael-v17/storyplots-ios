# PersonaLLM Reference — Index & Canonical Names

> Evidence-first reference of PersonaLLM (observed app). Companion to [Seed/creator-vision.md](../creator-vision.md) and [Seed/creator-vision-for-multiinteractions.md](../creator-vision-for-multiinteractions.md). See [CLAUDE.md](../../CLAUDE.md) for documentation rules.

## File map

| File | Purpose |
|---|---|
| [00-index.md](00-index.md) | This file — map + canonical names |
| [01-overview.md](01-overview.md) | What PersonaLLM is, platform, scope |
| [02-information-architecture.md](02-information-architecture.md) | Global nav, routes, screen map |
| [03-data-model.md](03-data-model.md) | Entities inferred from visible fields |
| [04-screens/home.md](04-screens/home.md) | Home screen |
| [04-screens/onboarding.md](04-screens/onboarding.md) | First-run / onboarding |
| [04-screens/menu.md](04-screens/menu.md) | Side menu / drawer |
| [04-screens/community.md](04-screens/community.md) | Community browse & share |
| [04-screens/gallery.md](04-screens/gallery.md) | Media gallery |
| [04-screens/character-info.md](04-screens/character-info.md) | Character profile & editor |
| [04-screens/character-import.md](04-screens/character-import.md) | Import character flow |
| [04-screens/chat.md](04-screens/chat.md) | Chat / conversation UI |
| [04-screens/chat-controls.md](04-screens/chat-controls.md) | ⋯ Chat Controls sheet (Autopilot, per-conv overrides, Author's Notes) |
| [04-screens/branch.md](04-screens/branch.md) | Fork Conversation modal (Keep messages / Summarize & start fresh) |
| [04-screens/image-viewer.md](04-screens/image-viewer.md) | Fullscreen image viewer + Edit Prompt + image long-press |
| [04-screens/authors-notes.md](04-screens/authors-notes.md) | Author's Notes editor (scope + injection depth) |
| [04-screens/user-profile.md](04-screens/user-profile.md) | User persona profile |
| [04-screens/settings-index.md](04-screens/settings-index.md) | Settings overview & section map |
| [04-screens/settings/chat-behavior.md](04-screens/settings/chat-behavior.md) | Chat Behavior (typing speed, suggested replies) |
| [04-screens/settings/memory.md](04-screens/settings/memory.md) | Memory + Retrieval Tuning + Auto Lore Extraction |
| [04-screens/settings/visual-roleplay.md](04-screens/settings/visual-roleplay.md) | Visual Roleplay mode + resolution presets |
| [04-screens/settings/bubble-colors.md](04-screens/settings/bubble-colors.md) | Chat theme picker |
| [04-screens/settings/prompt-editor.md](04-screens/settings/prompt-editor.md) | **All prompt templates + 11-position assembly reference** |
| [04-screens/settings/text-engine.md](04-screens/settings/text-engine.md) | Text providers + generation params |
| [04-screens/settings/image-engine.md](04-screens/settings/image-engine.md) | Image providers + ComfyUI + refinement |
| [04-screens/settings/video-engine.md](04-screens/settings/video-engine.md) | Video engine (stub — detail not captured) |
| [04-screens/settings/text-to-speech.md](04-screens/settings/text-to-speech.md) | TTS settings |
| [04-screens/settings/speech-recognition.md](04-screens/settings/speech-recognition.md) | STT settings |
| [04-screens/settings/data-security.md](04-screens/settings/data-security.md) | Age, App Lock, Cloud Consent, Storage, Erase |
| [05-flows.md](05-flows.md) | End-to-end user journeys |
| [06-chat-interaction-model.md](06-chat-interaction-model.md) | Chat UX deep dive |
| [07-prompts-and-llm-touchpoints.md](07-prompts-and-llm-touchpoints.md) | Every LLM-facing surface |
| [08-generation-parameters.md](08-generation-parameters.md) | Sampling / model controls |
| [09-design-system.md](09-design-system.md) | Visual language & components |
| [10-non-functional.md](10-non-functional.md) | Tone, accessibility, privacy |
| [11-web-adaptation-notes.md](11-web-adaptation-notes.md) | Mobile → web adaptation guidance |
| [99-open-questions.md](99-open-questions.md) | Ambiguities pending user input |

## Canonical glossary

Lock names here; reuse identically everywhere. `(observed)` = verbatim from screenshots. `(canonical)` = normalized by us.

### Product
- **PersonaLLM** (observed) — the app being documented.
- **AI Companion / Persona / Character** — terms used in product copy. Canonical name: **Character**. Visible synonyms: "AI Companions" ([Home IMG_4095](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4095.PNG) subtitle), "Persona" (Home CTA "Create Persona"), "Companion" ("No Companions Yet" empty state).

### Screens (canonical)
- Home
- Onboarding
- Menu (side drawer)
- Community
- Gallery
- CharacterInfo
- CharacterImport
- Chat
- UserProfile (a.k.a. "Your Persona" in Menu — observed)
- Settings (+ sub-sections)

### Entities (canonical, defined fully in [03-data-model.md](03-data-model.md))
- User
- UserPersona — the user's self-representation (observed term: "Your Persona")
- Character
- Conversation (observed term: "Chat")
- Message
- MessageVariant (observed: "variants" / swipe alternates)
- LorebookEntry (observed term: "lorebook")
- MemoryDocument (observed: "uploaded documents" for RAG)
- Preset (observed in [PresetPrompts.md](../../References/PersonaLLM/ExtraDocuments/PresetPrompts.md))
- AuthorsNote — plot/scene steering (global / character / conversation scope)
- AutopilotRun — per-conversation auto-play state (5/10/25 turn presets)
- ChatControlsState — per-conversation UI state (auto-images, auto-TTS, debug, provider overrides)
- WritingStyle (observed: "Chat, Narrator, or your own custom style")
- VoiceProfile (observed: dual-voice TTS — dialogue + narration)
- ModelProvider (observed: "13+ text providers")
- ImageProvider / VideoProvider (observed: "20+ image generators, 10+ video providers")
- ConversationBranch (observed: "fork any conversation from any message")
- Credits (observed: "Credits 310" in Menu [IMG_4151](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Menu/IMG_4151.PNG))

### Actions (canonical)
- CreateCharacter
- ImportCharacter
- StartConversation
- SendMessage
- RegenerateMessage
- SwipeVariant
- EditMessage
- BranchConversation
- AddLorebookEntry
- ExtractLoreAuto (observed: "Auto Lorebook Extraction")
- ApplyPreset
- AdjustGenerationParameter

## Conventions

- Every factual claim links to a screenshot or is tagged `(inferred)`.
- Each screen doc follows the shape: Purpose · Entry points · UI inventory (verbatim copy) · States · Affordances · Outbound nav · Screenshot refs.
- Observed vs User Extensions sections are never merged.
