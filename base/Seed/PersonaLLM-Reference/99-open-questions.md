# 99 — Open Questions

> **Big news from Pass D:** the 11-position prompt assembly was **confirmed verbatim** via the "System Prompt Reference" modal — no longer inferred. Many earlier Pass C open questions are now resolved. See [07-prompts-and-llm-touchpoints.md](07-prompts-and-llm-touchpoints.md) and [04-screens/settings/prompt-editor.md](04-screens/settings/prompt-editor.md).

### Resolved in Pass F
- ✅ **⋯ kebab menu contents** → it's **Chat Controls** ([chat-controls.md](04-screens/chat-controls.md)): Autopilot, per-conversation image/video provider overrides, Auto Images / Auto TTS / Debug toggles, Author's Notes, Lore Book, Character Settings, App Settings.
- ✅ **Message variants UI** → `< N/M >` counter on assistant messages ([Chat/IMG_4200](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4200.PNG)).
- ✅ **Edit message UI** → user-message long-press sheet: Edit / Copy / New Response / Fork from here / Delete.
- ✅ **Delete message flow** → confirmation modal "Delete Message?" ([Chat/IMG_4202](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4202.PNG)).
- ✅ **Branch = new Conversation** with parent links + optional parent-branch summary (not a tree node inside one Conversation). Two modes: Keep messages / Summarize & start fresh. See [branch.md](04-screens/branch.md).
- ✅ **Storybook / Texting writing-style preset bodies** — full verbatim in [PresetPrompts.md](../../References/PersonaLLM/ExtraDocuments/PresetPrompts.md); mirrored into [settings/prompt-editor.md](04-screens/settings/prompt-editor.md).
- ✅ **Roleplay Writing Instructions / Default Author's Note** full text — resolved from PresetPrompts.md.
- ✅ **Video Engine detail screen** — ComfyUI config, Workflow Template None/Custom (no bundled default), full Video Refinement System Prompt verbatim ([settings/video-engine.md](04-screens/settings/video-engine.md)).
- ✅ **Author's Notes as 12th touchpoint** — injects into message history at configurable depth, not into the 11-position system prompt.
- ✅ **Scenarios editor field set** — title + body (mixed narration+dialogue), `+` to add; scenario body IS the first assistant message when the conversation starts ([04-screens/character-info.md](04-screens/character-info.md)).
- ✅ **Content below Memory toggle on Character Settings tab** — there is none; the tab ends at Memory ([Character Info/IMG_4205](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4205.PNG)).
- ✅ **Image viewer + Edit Prompt + image long-press** fully documented ([image-viewer.md](04-screens/image-viewer.md)).
- ✅ **Autopilot** is a real feature with 5/10/25-turn presets ([chat-controls.md §Autopilot](04-screens/chat-controls.md#section-autopilot-img_4210)).

### Resolved in Pass D
- ✅ Prompt-assembly order (confirmed: 11 positions, skip-if-empty, Roleplay vs Assistant scaffolds).
- ✅ Writing Style directive existence (three built-ins, editable, **Roleplay** verbatim captured — Storybook/Texting bodies still pending).
- ✅ Memory architecture (dual: keyword Lore + vector RAG, priority ordering, 8 tuning knobs with defaults).
- ✅ Auto Lore Extraction full prompt + cadence.
- ✅ Image Refinement system prompt (verbatim) + pipeline (bracket tag → refine → provider).
- ✅ ComfyUI integration params (sampler / scheduler / steps / CFG / seed / prefix / negative).
- ✅ Providers list (6+ local, 3+ cloud text; ComfyUI + OpenAI/Google/xAI image; Atlas/Alibaba video).
- ✅ Storage categories + Export/Import backup + Erase-everything scope.
- ✅ Onboarding Age Verification wire: "Verified via Apple · Apr 13, 2026".

> Running list of ambiguities only the user can resolve. Each item links to the file where it was raised. Resolve by replying inline; the reference will be updated.

## Platform & scope
- Is there a non-iOS build today? All screenshots are iPhone. ([01-overview.md](01-overview.md))
- Which features get dropped on web? Local MLX, ComfyUI-local, TTS-Kokoro need explicit decisions. ([11-web-adaptation-notes.md](11-web-adaptation-notes.md))

## Navigation
- Identity and routes of the three bottom-tab icons behind the Menu drawer. ([02-information-architecture.md](02-information-architecture.md), [04-screens/menu.md](04-screens/menu.md))
- Entry point for CharacterImport — Home header, Menu, Settings, or Community only? ([02-information-architecture.md](02-information-architecture.md))
- **Tap on a Home character card/row** — opens [CharacterInfo](04-screens/character-info.md) first, or jumps straight into [Chat](04-screens/chat.md)? ([04-screens/home.md](04-screens/home.md))
- Home sort-menu options (alphabetical / recent / favorite / custom). ([04-screens/home.md](04-screens/home.md))

## Onboarding & account
- Is account creation required or is the app usable anonymously? PersonaLLM uses "Verify with Apple" — suggests identity attached from step 2. ([04-screens/onboarding.md](04-screens/onboarding.md))
- Gating logic on slide 2 — does the app block the user until both ToS and Privacy toggles are ON? ([04-screens/onboarding.md](04-screens/onboarding.md))
- What happens when the user taps "Skip for Now" on the Cloud AI Services slide and later tries a cloud feature — just-in-time consent? ([04-screens/onboarding.md](04-screens/onboarding.md))

## Chat
- Single-NPC confirmed visually (no multi-character bubbles); group chat not observed. OK for clone.
- Suggested Replies: opt-in button observed — count (always 3?) confirmed by marketing. ([04-screens/chat.md](04-screens/chat.md))
- Streaming indicator not visible in stills. ([06-chat-interaction-model.md](06-chat-interaction-model.md))
- UI for **message variants swipe** and **edit message** — not captured in screenshots. ([06-chat-interaction-model.md](06-chat-interaction-model.md))
- Contents of the composer **⋯ kebab menu**. ([04-screens/chat.md](04-screens/chat.md))
- Is **Branch** a full Conversation clone or a tree node inside one Conversation? ([06-chat-interaction-model.md](06-chat-interaction-model.md))
- How is a Scenario represented in the LLM payload — `first_mes`-style assistant turn, or system-context? ([07-prompts-and-llm-touchpoints.md](07-prompts-and-llm-touchpoints.md))
- Auto Image Generation trigger heuristic (every message? cooldown? scene-change detection?) ([06-chat-interaction-model.md](06-chat-interaction-model.md))

## Character
- Confirmed field set (name, tagline, systemPrompt ≤2000, mode, avatar, appearanceDescription, appendAppearanceToImagePrompts, accentColor, 12 deep-dive fields, defaultWritingStyle, defaultPersona, characterMemoryEnabled, scenarios[], tags[]). ([03-data-model.md](03-data-model.md))
- Full Scenarios editor field set (title, body, firstMessage override?). Not captured. ([04-screens/character-info.md](04-screens/character-info.md))
- Content below the Memory toggle on Settings tab (voice? delete? export?). ([04-screens/character-info.md](04-screens/character-info.md))
- Does Mode (Roleplay vs Assistant) swap prompt scaffolding or only a tag? ([07-prompts-and-llm-touchpoints.md](07-prompts-and-llm-touchpoints.md))
- What does "Refine with AI" do in the Manual flow? ([04-screens/character-info.md](04-screens/character-info.md))
- Import: V3 card support? URL import (paste Chub.ai link)? Duplicate-name handling? Character-book (embedded lorebook) import? ([04-screens/character-import.md](04-screens/character-import.md))

## Prompts & generation (remaining)
- Full verbatim text of **Storybook** and **Texting** writing-style preset bodies (only Roleplay expanded in screenshots). ([04-screens/settings/prompt-editor.md](04-screens/settings/prompt-editor.md))
- Text past the truncated tails of Roleplay Writing Instructions, Default Author's Note, Visual Roleplay Instructions, Suggested Replies Template. ([04-screens/settings/prompt-editor.md](04-screens/settings/prompt-editor.md))
- Where is the **Rolling Summary** template defined (prompt position 8/10)? Not captured.
- Conversation snapshot semantics: Writing Style is confirmed snapshotted; is the character systemPrompt also snapshotted, or live-read?
- Position 11 "Suggested Replies" — always in the system prompt, or only when the user taps the pill?
- Concatenation vs role-split of the 11 positions in the actual API payload.

## Settings — remaining gaps from Pass D
- **Video Engine detail screen** not captured (only the root row). Need: providers list, duration presets (5s/8s/others), fps, resolution, motion strength.
- **Cloud Image tab** not captured ("Cloud · Anime" trailing value implies a style selector).
- **Character editor — Assistant-mode fields** (Expertise / Communication Style / Rules) — all Character-Info screenshots in Pass C were Roleplay characters. The Assistant tab/sections exist per [prompt-editor.md §5.b](04-screens/settings/prompt-editor.md#5b-assistant--11-positions-verbatim-img_4174-img_4175) but aren't captured.
- **Character Lore Book editor** inside Character editor (settings/memory.md copy says "under Edit Character").
- **Per-character TTS voice pair** picker (dialogue voice + narrator voice).
- **Thinking Mode** actual request-body effect.
- **Stop sequences / top-p / top-k / penalty** — present or missing?
- **Advanced Generation Settings** panel below Context Length (possibly exists; cut off in screenshots).
- **Cloud providers list** below OpenRouter / OpenAI / Google (cut off).
- Custom ComfyUI workflow upload UX.

## Monetization
- What exactly consumes Credits? Cloud text/image/video only? ([01-overview.md](01-overview.md))

## Community
- Categories, tags, ranking algorithm? ([04-screens/community.md](04-screens/community.md))
- Moderation / reporting? ([04-screens/community.md](04-screens/community.md))

## Design
- Light mode exists? ([09-design-system.md](09-design-system.md))
- Exact brand hex palette and icon library? ([09-design-system.md](09-design-system.md))

## UserPersona
- Exact field set beyond Name / Gender / Description / Background. ([04-screens/user-profile.md](04-screens/user-profile.md))
- Gender options — only Male/Female, or more? ([04-screens/user-profile.md](04-screens/user-profile.md))
- Max number of personas; per-chat active-persona switcher? ([04-screens/user-profile.md](04-screens/user-profile.md))

## Gallery
- Global-per-user or per-character filtered? ([04-screens/gallery.md](04-screens/gallery.md))
- Storage model / quota. ([04-screens/gallery.md](04-screens/gallery.md))
- Can a Gallery item be re-attached to a chat as a message?

## Scenarios (carried over from Community doc)
- Are Scenarios an observed field on own Characters (not just Community uploads)? Must confirm in [04-screens/character-info.md](04-screens/character-info.md) during Pass C. ([04-screens/community.md](04-screens/community.md))
- Does selecting a Scenario at chat-start set the system/first-message, and can it be switched mid-conversation? ([04-screens/community.md](04-screens/community.md))
