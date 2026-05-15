# 03 — Data Model

> All entities derived strictly from visible fields across screenshots. Column "Source" points to the screenshot that confirms the field. `(inferred)` where no direct UI evidence exists but the field is implied by behavior. Canonical names from [00-index.md](00-index.md).

## Observed in PersonaLLM

### User
| Field | Type | Required | Source | Notes |
|---|---|---|---|---|
| id | string | yes | `(inferred)` | Account identity. |
| authIdentity | — | yes | [Onboarding/IMG_4106](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4106.PNG) | "Verify with Apple" in PersonaLLM; clone will use email/OAuth. |
| ageVerifiedAt | timestamp | yes | [Onboarding/IMG_4106](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4106.PNG) | 18+ gate. |
| tosAcceptedAt | timestamp | yes | [Onboarding/IMG_4106](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4106.PNG) | Per user-account in clone. |
| privacyAcceptedAt | timestamp | yes | [Onboarding/IMG_4106](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4106.PNG) | |
| cloudConsentAt | timestamp\|null | no | [Onboarding/IMG_4108](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4108.PNG) | Skippable; revocable from Settings. |
| credits | int | PersonaLLM-only | [Menu/IMG_4151](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Menu/IMG_4151.PNG) | **SCOPE-CUT in clone.** |
| displayName | string | no | [Comunity/IMG_4121](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/IMG_4121.PNG) | Community-only in source; carry-over for clone auth. |

### UserPersona  ([04-screens/user-profile.md](04-screens/user-profile.md))
| Field | Type | Required | Source | Notes |
|---|---|---|---|---|
| id | string | yes | `(inferred)` | |
| userId | ref(User) | yes | `(inferred)` | Per-user isolation. |
| isDefault | bool | auto | [User/IMG_4149](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/User/IMG_4149.PNG) | Exactly one default. |
| avatar | image | no | [User/IMG_4149](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/User/IMG_4149.PNG) | Upload or Generate from Description. |
| name | string | yes (inferred) | [User/IMG_4149](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/User/IMG_4149.PNG) | "What should characters call you?" |
| gender | enum | no | [User/IMG_4149](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/User/IMG_4149.PNG) | Observed Male/Female only; clone widens. |
| description (appearance) | text | no | [User/IMG_4149](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/User/IMG_4149.PNG) | Used for avatar generation. |
| background | text | no | [User/IMG_4150](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/User/IMG_4150.PNG) | "About You" section. |

### Character  ([04-screens/character-info.md](04-screens/character-info.md))
| Field | Type | Required | Source |
|---|---|---|---|
| id | string | yes | `(inferred)` |
| ownerUserId | ref(User) | yes | `(inferred)` — per-user isolation in clone. |
| name | string | yes | [CharInfo/IMG_4140](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4140.PNG) |
| tagline | string | no | [CharInfo/IMG_4140](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4140.PNG) |
| systemPrompt | text (≤ 2000 chars) | yes | [CharInfo/IMG_4140](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4140.PNG) |
| mode | enum(Roleplay, Assistant) | yes, **immutable after creation** | [Import/IMG_4097](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4097.PNG), [CharInfo/IMG_4145](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4145.PNG) |
| avatar | image | no | [CharInfo/IMG_4138](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4138.PNG) |
| appearanceDescription | text | no | [CharInfo/IMG_4138](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4138.PNG) |
| appendAppearanceToImagePrompts | bool | default true | [CharInfo/IMG_4138](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4138.PNG) |
| accentColor | color (16 presets + custom) | yes (defaulted) | [CharInfo/IMG_4139](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4139.PNG) — themes [Chat](04-screens/chat.md). |
| personality.coreTraits | text | no | [CharInfo/IMG_4141](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4141.PNG) |
| personality.fearsInsecurities | text | no | [CharInfo/IMG_4141](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4141.PNG) |
| personality.communicationStyle | text | no | [CharInfo/IMG_4141](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4141.PNG) |
| personality.quirksHabits | text | no | [CharInfo/IMG_4141](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4141.PNG) |
| goals.primaryGoal | text | no | [CharInfo/IMG_4142](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4142.PNG) |
| goals.secretDesire | text | no | [CharInfo/IMG_4142](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4142.PNG) |
| goals.fearsToOvercome | text | no | [CharInfo/IMG_4142](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4142.PNG) |
| goals.whatTheydSacrifice | text | no | [CharInfo/IMG_4142](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4142.PNG) |
| worldbuilding.originBirthplace | text | no | [CharInfo/IMG_4143](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4143.PNG) |
| worldbuilding.backstory | text | no | [CharInfo/IMG_4143](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4143.PNG) |
| worldbuilding.worldSetting | text | no | [CharInfo/IMG_4143](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4143.PNG) |
| worldbuilding.specialAbilities | text | no | [CharInfo/IMG_4144](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4144.PNG) |
| defaultWritingStyle | ref(WritingStyle) | yes (defaulted Roleplay) | [CharInfo/IMG_4145](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4145.PNG) |
| defaultPersona | ref(UserPersona)\|null | default "None · Use app default" | [CharInfo/IMG_4146](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4146.PNG) |
| characterMemoryEnabled | bool | default true | [CharInfo/IMG_4146](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4146.PNG) |
| tags[] | string[] | no | [Comunity/IMG_4124](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/IMG_4124.PNG) (Sci-Fi, Psychological, SFW, Male, Android) |
| scenarios[] | Scenario[] | no (≥1 to start a chat) | [CharInfo/IMG_4136](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4136.PNG), [Comunity/IMG_4124](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/IMG_4124.PNG) |
| isExample | bool | auto-seeded | [Home/IMG_4112](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4112.PNG) ("Example" tag) |

### Scenario
| Field | Type | Source |
|---|---|---|
| id | string | `(inferred)` |
| characterId | ref(Character) | `(inferred)` |
| title | string | [CharInfo/IMG_4136](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4136.PNG) (e.g. "Late Night Check-In") |
| body | text | [Comunity/IMG_4124](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/IMG_4124.PNG), [Chat/IMG_4126](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4126.PNG) |
| badge | "RP" pill | [Comunity/IMG_4124](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/IMG_4124.PNG) |
| firstMessage (override?) | text | `(open question)` — might equal `body` or be a separate field |

### Conversation
| Field | Type | Source |
|---|---|---|
| id | string | `(inferred)` |
| characterId | ref(Character) | [Chat/IMG_4132](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4132.PNG) |
| title | string | [Chat/IMG_4132](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4132.PNG) (default "New Conversation") |
| scenarioId | ref(Scenario) | [Chat/IMG_4126](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4126.PNG) (first turn) |
| writingStyle | ref(WritingStyle) | inherits from Character.defaultWritingStyle |
| personaId | ref(UserPersona) | inherits from Character.defaultPersona or User's default |
| branchParentMessageId | ref(Message)\|null | marketing ("fork any conversation") |
| lastMessageAt | timestamp | [Menu/IMG_4151](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Menu/IMG_4151.PNG) ("7m", "10m" timestamps) |
| messageCount | int | [Chat/IMG_4132](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4132.PNG) ("7 msgs") |

### Message
| Field | Type | Source |
|---|---|---|
| id | string | `(inferred)` |
| conversationId | ref(Conversation) | `(inferred)` |
| role | enum(user, assistant, scenario) | [Chat/IMG_4126](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4126.PNG) |
| variants[] | MessageVariant[] | marketing |
| activeVariantIdx | int | `(inferred)` |
| attachments[] | InlineMedia[] | [Chat/IMG_4130](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4130.PNG), [IMG_4147](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4147.PNG) |
| createdAt | timestamp | [Chat/IMG_4126](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4126.PNG) ("16:13") |
| isBranchPoint | bool | marketing |

### MessageVariant
| Field | Type |
|---|---|
| content | text (italic+plain mix) |
| model | string (snapshot of which model generated it) |
| params | GenerationParamsSnapshot |
| createdAt | timestamp |

### InlineMedia
| Field | Type | Source |
|---|---|---|
| kind | enum(image, video) | [Chat/IMG_4130](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4130.PNG), [IMG_4131](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4131.PNG) |
| url / assetId | string | `(inferred)` |
| prompt | text | [Gallery/IMG_4148](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Gallery/IMG_4148.PNG) ("Search prompts…") |
| resolutionPreset | enum(Random, Square, Portrait, Landscape, TallPortrait, WideLandscape, UltraTall, UltraWide) | [Chat/IMG_4131](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4131.PNG) |
| dimensions | {w,h} | [Chat/IMG_4131](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4131.PNG) |
| durationSec | int (videos) | [Gallery/IMG_4148](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Gallery/IMG_4148.PNG), [Comunity/IMG_4120](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/IMG_4120.PNG) ("5s", "8s") |
| providerSnapshot | — | `(inferred)` which provider rendered it |
| seed | string\|null | `(inferred)` |
| parentImageId | ref(InlineMedia)\|null | [Chat/IMG_4131](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4131.PNG) (video "From this image") |

### WritingStyle
| Field | Type | Source |
|---|---|---|
| id | string | `(inferred)` |
| name | string | [CharInfo/IMG_4145](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4145.PNG) |
| isBuiltIn | bool | "Built-in" label in radio card |
| directive | text | `(open)` actual prompt-template string |
| builtInVariants (observed) | enum(Roleplay, Storybook, Texting) | [CharInfo/IMG_4145](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4145.PNG) |

### LorebookEntry (confirmed — [settings/memory.md](04-screens/settings/memory.md))
| Field | Type | Notes |
|---|---|---|
| id | string | |
| characterId | ref(Character) | per-character lore book |
| title | string | |
| keywords[] | string[] | drives keyword-triggered retrieval at positions #6/#8 |
| body | text | |
| source | enum(manual, autoExtracted) | Auto Lore Extraction marks these |
| tokenEstimate | int | used for `knowledgeBudget` slicing |
| createdAt / updatedAt | timestamp | |

### MemoryDocument (RAG source — [settings/memory.md](04-screens/settings/memory.md))
| Field | Type | Notes |
|---|---|---|
| id | string | |
| ownerScope | enum(character, global) | "Per-character + global document stores" |
| characterId | ref(Character)\|null | only when scope=character |
| title | string | |
| sourceType | enum(upload, conversationExtract) | "uploaded documents" + "RAG Memory Stores" |
| chunks[] | {text, embedding, tokenEstimate} | vector-indexed |
| createdAt | timestamp | |

### RollingSummary (auto-generated — prompt position 8/10)
| Field | Type |
|---|---|
| conversationId | ref |
| summaryText | text |
| summarizedThroughMessageId | ref(Message) |
| updatedAt | timestamp |

### BranchSummary (parent→child on fork — position 10/11)
| Field | Type |
|---|---|
| branchConversationId | ref(Conversation) (the child) |
| title | string (parsed from "TITLE: …" line) |
| summary | text |

### Conversation — branch fields (confirmed from [branch.md](04-screens/branch.md))
| Field | Type | Notes |
|---|---|---|
| branchParentConversationId | ref(Conversation) \| null | Parent conversation when forked |
| branchParentMessageId | ref(Message) \| null | Fork anchor message |
| branchMode | enum(keepMessages, summarizeFresh) | Which fork variant was used |
| parentBranchSummary | text \| null | Only set when mode = summarizeFresh |
| title | string | Auto-generated via `TITLE: …` convention from Branch Summary System Prompt |

### AuthorsNote (new entity — [authors-notes.md](04-screens/authors-notes.md))
| Field | Type | Notes |
|---|---|---|
| id | string | |
| userId | ref(User) | per-user isolation |
| scope | enum(global, character, conversation) | From the 3-state segmented control |
| characterId | ref(Character) \| null | required when scope = character |
| conversationId | ref(Conversation) \| null | required when scope = conversation |
| notesText | text | The steering note |
| injectionDepth | int | 0 = right before latest user message; N = N turns earlier |
| createdAt / updatedAt | timestamp | |

### AutopilotRun (new entity — [chat-controls.md §Autopilot](04-screens/chat-controls.md#section-autopilot-img_4210))
| Field | Type | Notes |
|---|---|---|
| id | string | |
| conversationId | ref(Conversation) | |
| preset | enum(5, 10, 25, custom) | Turn count preset |
| remainingTurns | int | decremented each auto-turn |
| active | bool | paused when user sends or provider errors |
| startedAt / endedAt | timestamp | |

### ChatControlsState (per-conversation UI state)
| Field | Type | Notes |
|---|---|---|
| conversationId | ref | |
| autoImages | bool | overrides global Visual Roleplay Auto-Generate Images |
| autoTextToSpeech | bool | per-conversation autoplay |
| debugMode | bool | shows request/response + token usage inline |
| imageProviderOverride | ref(ProviderConfig) \| null | optional per-conversation image provider |
| videoProviderOverride | ref(ProviderConfig) \| null | optional per-conversation video provider |

### Lorebook editor UI — still unconfirmed
Reached via [Chat Controls → Lore Book](04-screens/chat-controls.md#section-settings) ("0 entries" in screenshot). Editor layout not captured — open question remains.

### WritingStylePreset (confirmed — [settings/prompt-editor.md](04-screens/settings/prompt-editor.md#1-roleplay-section-img_4164))
| Field | Type |
|---|---|
| id | string |
| userId | ref(User) |
| name | string |
| isBuiltIn | bool |
| writingInstructions | text |
| defaultAuthorsNote | text (optional) |

### ProviderConfig (BYOK — [settings/text-engine.md](04-screens/settings/text-engine.md), [settings/image-engine.md](04-screens/settings/image-engine.md))
| Field | Type |
|---|---|
| id | string |
| userId | ref(User) |
| kind | enum(text, image, video, tts, stt) |
| providerFamily | enum (OpenRouter, OpenAI, Google, Ollama, LM Studio, KoboldCpp, llama.cpp, Text Gen WebUI, vLLM, ComfyUI, xAI, Atlas Cloud, Alibaba Cloud, …) |
| baseUrl | string |
| apiKey | encrypted string \| null |
| modelId | string |
| thinkingMode | bool |
| temperature | float |
| maxTokens | int |
| contextLength | int |
| lastTestedOk | bool |
| lastTestedAt | timestamp |
| isActive | bool | only one active per `kind` at a time |
| workflowConfig | json (image-only; sampler/scheduler/steps/CFG/seed/prefix/negative) |

### GlobalSettings (per-user) — screens that contain no captured entity but store settings:
| Field | Source |
|---|---|
| typingSpeed (0..1) | [chat-behavior.md](04-screens/settings/chat-behavior.md) |
| suggestedRepliesAuto | [chat-behavior.md](04-screens/settings/chat-behavior.md) |
| characterMemoryDefault | [memory.md](04-screens/settings/memory.md) |
| retrieval.* (8 knobs) | [memory.md](04-screens/settings/memory.md) |
| autoLore.enabled, provider, frequencyTurns, extractionPrompt | [memory.md](04-screens/settings/memory.md) |
| visualRoleplayMode | [visual-roleplay.md](04-screens/settings/visual-roleplay.md) |
| autoGenerateImages | [visual-roleplay.md](04-screens/settings/visual-roleplay.md) |
| defaultResolution | [visual-roleplay.md](04-screens/settings/visual-roleplay.md) |
| enabledResolutions[] | [visual-roleplay.md](04-screens/settings/visual-roleplay.md) |
| bubbleTheme | [bubble-colors.md](04-screens/settings/bubble-colors.md) |
| promptEditor.* | [prompt-editor.md](04-screens/settings/prompt-editor.md) (editable positions + templates) |
| tts.* (enabled, provider, voice, speed, pitch, volume) | [text-to-speech.md](04-screens/settings/text-to-speech.md) |
| stt.engine | [speech-recognition.md](04-screens/settings/speech-recognition.md) |
| security.appLock | [data-security.md](04-screens/settings/data-security.md) |
| security.cloudConsent | [data-security.md](04-screens/settings/data-security.md) |

### Character — Assistant-mode fields (added from Prompt Editor reveal)
| Field | Source |
|---|---|
| expertiseAreas | [prompt-editor.md](04-screens/settings/prompt-editor.md) Assistant #5 |
| communicationStyle | [prompt-editor.md](04-screens/settings/prompt-editor.md) Assistant #6 |
| rules | [prompt-editor.md](04-screens/settings/prompt-editor.md) Assistant #7 |

### Conversation — snapshot fields confirmed
| Field | Source |
|---|---|
| writingStylePresetSnapshot | [prompt-editor.md](04-screens/settings/prompt-editor.md) — "snapshotted per conversation" |

### ProviderConfig (clone-specific, BYOK)
| Field | Type | Notes |
|---|---|---|
| userId | ref(User) | per-user isolation |
| textProvider | enum(OpenRouter, direct…) | BYOK |
| textApiKey | encrypted string | |
| textModelId | string | |
| imageProvider | enum(ComfyUI, RunPod, …) | |
| imageEndpointUrl | string | e.g. user's own ComfyUI URL |
| imageApiKey | encrypted string\|null | |
| videoProvider | enum(Atlas, Alibaba, …) | |
| videoApiKey | encrypted string\|null | |
| ttsProvider | enum(browser, cloud) | |

### SCOPE-CUT entities (documented but removed in clone)
- CreditsAccount, CreditsTransaction ([Menu/IMG_4151](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Menu/IMG_4151.PNG), [Onboarding/IMG_4111](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4111.PNG))
- CommunityCharacter, Creator, Follow, Favorite, Like, Download, Flag, Leaderboard ([Comunity/](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/))

## User Extensions / Scope Decisions

- Every entity above is **scoped by `userId`**: all queries must filter by the authenticated user. No cross-user reads.
- Replace Credits/Community tables with the **ProviderConfig** table (BYOK).
- Encrypt API keys at rest (envelope encryption with a per-user data key).

## Open Questions

- Does Scenario carry a separate `firstMessage` distinct from `body`, or is the body itself the first message?
- Exact enum values for `gender` (Male / Female / Non-binary / Custom).
- Are `tags[]` a free-text list or a controlled vocabulary from the Community filter chips (Male / Female / Roleplay / Assistant / SFW / NSFW + detail tags)?
- Full LorebookEntry / MemoryDocument field set (pending Pass D).
- Does Conversation store a **snapshot** of the system prompt at creation time, or does it re-read the Character live? Matters for character-edit semantics on existing chats.
