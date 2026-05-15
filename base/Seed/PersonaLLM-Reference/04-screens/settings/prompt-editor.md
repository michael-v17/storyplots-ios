# Settings → Prompt Editor

> **This is the single most important settings screen.** It exposes every editable prompt template, plus a "System Prompt Reference" that confirms the real 11-position prompt-assembly order. All templates below are captured verbatim from screenshots.

## Observed in PersonaLLM

Sources: [IMG_4164](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4164.PNG), [IMG_4165](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4165.PNG), [IMG_4166](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4166.PNG), [IMG_4167](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4167.PNG), [IMG_4168](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4168.PNG), [IMG_4169](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4169.PNG), [IMG_4170](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4170.PNG), [IMG_4171](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4171.PNG), [IMG_4172](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4172.PNG), [IMG_4173](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4173.PNG), [IMG_4174](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4174.PNG), [IMG_4175](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4175.PNG).

Header: `< · Prompt Editor · Done`. Scrollable single page with collapsible section dropdowns: **Roleplay · Assistant · Image & Video · Advanced** + a separate button **"How System Prompts Are Built"** + a red **"Reset All Prompts to Default"** button at the bottom.

---

## 1. ROLEPLAY section ([IMG_4164](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4164.PNG))

Sub-intro: "Prompts that shape how the AI writes and generates images in roleplay conversations."

### 1.a. Writing Style Presets (list)
Three built-in radio rows + "+ New Preset" row:

- 📖 **Roleplay** — "Built-in"
- 📖 **Storybook** — "Built-in"
- 📖 **Texting** — "Built-in"
- `+` **New Preset** (create custom)

Tapping a preset opens an **Edit Preset** sheet with two editable fields (see §1.b). Built-ins are editable too; a **↻ Reset to Default** button sits at the bottom of the sheet.

### 1.b. Edit Preset — "Roleplay" (verbatim defaults, [IMG_4165](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4165.PNG))

Header: `Cancel · Edit Preset · Save`.

| Field | Hint |
|---|---|
| **Name** | — (plain text input, default "Roleplay") |
| **Writing Instructions** | "Instructions for how the AI should write (perspective, tone, style)" |
| **Default Author's Note** | "Guidance that applies to conversations using this style (optional)" |

**Writing Instructions — Roleplay default (FULL VERBATIM, sourced from [PresetPrompts.md](../../../../References/PersonaLLM/ExtraDocuments/PresetPrompts.md)):**
```
Write from the character's perspective using first person (I/me/my). Match the character's established voice and vocabulary. Use "quotation marks" for spoken dialogue. Use *asterisks* for actions, thoughts, and physical descriptions. Show emotions through body language and actions — don't narrate feelings directly. React naturally to what the user says and does. Never control the user's character — don't write their actions, dialogue, or feelings. Keep responses to 1-2 short paragraphs. Favor quick back-and-forth over long monologues.
```

**Default Author's Note — Roleplay default (FULL VERBATIM, [PresetPrompts.md](../../../../References/PersonaLLM/ExtraDocuments/PresetPrompts.md)):**
```
Each response must move the scene forward — never repeat, recap, or stall. Stay grounded in the moment — react to what just happened before introducing anything new. End on something the user can react to: a question, an action, a shift in tension. Match the scene's energy — don't force humor into serious moments or drama into lighthearted ones.
```

> Note on the typography convention: the Writing Instructions for **Roleplay** explicitly direct `*asterisks*` for narration. This matches the italic-vs-plain observation in [chat.md](../chat.md) — the app renders `*asterisks*` as italic narration (Markdown-style) and `"quoted"` text as dialogue.

---

### 1.d. Edit Preset — "Storybook" (FULL VERBATIM, [PresetPrompts.md](../../../../References/PersonaLLM/ExtraDocuments/PresetPrompts.md))

**Writing Instructions:**
```
You are a skilled author collaborating with the user on an interactive story. Write in close third person, giving voice to characters through their actions, dialogue, and inner thoughts. The user may write as their character or direct the story — embellish their stated actions with vivid prose, but never invent new actions, decisions, or feelings for the user's character beyond what they describe. Favor strong verbs over adjective clusters — one precise sensory detail beats three vague ones. Aim for roughly 60% dialogue and character interaction, 40% narration and scene-setting. Show emotion through body language, dialogue cadence, and physical sensation — never state feelings directly. Give each character a distinct voice and mannerisms. Write 2-4 paragraphs per response. Vary sentence length and openings. End at a moment of tension, decision, or discovery — never wrap up a scene completely.
```

**Default Author's Note:**
```
Advance the plot every response — never recap or stall. Alternate action beats with quiet moments. Never describe the same emotion twice in a scene. Match the energy of the user's input — terse action gets focused intensity, expansive writing gets met in kind. Maintain tonal consistency — tension resolves through story events, not sudden mood shifts. End on a hook.
```

### 1.e. Edit Preset — "Texting" (FULL VERBATIM, [PresetPrompts.md](../../../../References/PersonaLLM/ExtraDocuments/PresetPrompts.md))

**Writing Instructions:**
```
Write in first person as the character. Short, direct, and conversational — like talking face to face. 1-3 short lines per response. Keep actions minimal — a brief gesture or expression at most, not a scene. The focus is on what the character says, not what they do. React to the part of the user's message that hits hardest — don't address everything. Let tone come through word choice and rhythm. Incomplete thoughts are natural. Emoji only if it genuinely fits the character. A cold character is blunt and spare. A warm character is open and easy. The way someone speaks IS their personality — lean into that. Never over-explain. Never recap what the user said.
```

**Default Author's Note:**
```
Hard limit: 1-4 short lines. If you wrote more than 4 lines, cut it down. Each line should be a single thought — not a run-on sentence. No paragraphs. No monologues. No walls of text. If the character has a lot to say, pick the most impactful part and say only that. Short answers carry weight — not every message needs a follow-up question. Stay in the character's voice — don't drift toward formal or helpful. Match the user's energy — terse gets terse, playful gets playful.
```

**Per-preset behavior contrast:**
- **Roleplay**: 1-2 short paragraphs; first-person; asterisks for narration; quotes for dialogue; never controls user's character. Back-and-forth pacing.
- **Storybook**: 2-4 paragraphs; close third-person; 60% dialogue / 40% narration; ends on a hook.
- **Texting**: 1-4 short lines; first-person; minimal actions; tight and conversational.

These three presets exhaustively cover the three reading modes PersonaLLM optimizes for.

### 1.c. Visual Roleplay Instructions ([IMG_4164](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4164.PNG))

Editable textarea with ↻ reset icon. Hint: "Tells the AI how to format `[image: …]` prompts at the end of responses"

**Default value (verbatim, truncated):**
```
End your response with a bracketed image prompt: [image: ...]

Describe the scene in detail using comma-separated tags. Be descriptive, not subjective. Include all relevant details. Stay consistent with the current story.

Example:
[image: 1girl, solo, sitting on windowsill, knees to chest, gazing at rain-streaked glass, dim bedroom, grey afternoon light, distant expression, oversized sweater slipping off shoulder, cold coffee cup nearby, from side]
```

→ Confirms the `[image: ...]` tag convention used by Visual Roleplay Mode.

---

## 2. ASSISTANT section ([IMG_4167](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4167.PNG))

Sub-intro: "Global instructions applied to all assistant-mode characters. Read live at each message send."

### 2.a. Assistant Base Prompt (editable)

Hint: "Defines tone and behavior for assistant characters"

**Default value (verbatim):**
```
Stay in character — maintain your personality and voice — while being genuinely helpful. Prioritize clear, accurate, and useful responses. You may use conversational tone but focus on helping the user accomplish their goals. Do not use roleplay actions or *asterisks* unless the user does first.
```

→ Confirms Assistant-mode characters use a **different base scaffold** (no asterisk narration unless the user initiates).

---

## 3. IMAGE & VIDEO section ([IMG_4167](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4167.PNG), [IMG_4168](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4168.PNG))

Sub-intro: "Prompt templates for avatar, image, and video generation. Prefix is prepended to every generation request."

### 3.a. Avatar Generation
"Prefix/suffix wrapped around avatar description"

| Sub-field | Example value observed |
|---|---|
| **Prefix** | "Medium shot portrait, face focus, soft lighting, simple background, looking at viewer" (or "close-up portrait, face…") |
| **Suffix** | "high quality, detailed face, sharp focus" |

Assembled as: **`{prefix}, {description}, {suffix}`** — verbatim in UI hint.

### 3.b. Image Prompts
| Sub-field | Default / Placeholder |
|---|---|
| **Prompt Prefix** | placeholder "e.g. cinematic lighting, 35mm" — "Prepended to every image generation prompt" |
| **Negative Prompt** | `text, watermark, worst quality, low quality` — "Tags to avoid in generated images" |

### 3.c. Video Prompts
| Sub-field | Default / Placeholder |
|---|---|
| **Prompt Prefix** | placeholder "e.g. smooth camera motion, cinematic" — "Prepended to the image prompt for video generation" |
| **Negative Prompt** | `text, watermark, worst quality, low quality` — "Tags to avoid in generated videos" |

---

## 4. ADVANCED section ([IMG_4169](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4169.PNG), [IMG_4170](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4170.PNG))

Sub-intro: "Prompts for conversation branching, summarization, and reply suggestions. Most users won't need to change these."

### 4.a. Branch Summary (template)

Hint: "Use `{messages}` as placeholder for conversation content"

**Default (verbatim):**
```
Summarize the following conversation for context. Include:
- What happened (key events and actions)
- Current situation (where things stand now)
- Relationship dynamics (how the characters relate to each other)
- Emotional state (mood and tone)
- Any unresolved threads or tensions

Write up to three paragraphs in past tense.
```

### 4.b. Branch Summary System Prompt

Hint: "The app looks for `TITLE: ` on the first line to auto-name branches"

**Default (verbatim):**
```
You are a helpful assistant that summarizes conversations concisely. Begin your response with a short descriptive title (3-5 words) on the first line, prefixed with "TITLE: ". Then leave a blank line and write the summary.
```

### 4.c. Suggested Replies Template

Hint: "Format for AI-generated reply suggestions shown below messages"

**Default (verbatim, truncated):**
```
<SUGGESTED_REPLIES>
- [short, natural reply option 1]
- [short, natural reply option 2]
- [short, natural reply option 3]
</SUGGESTED_REPLIES>

Make suggestions feel natural for the user's…
```

→ Confirms Suggested Replies is parsed from a tag-delimited response.

---

## 5. "How System Prompts Are Built" — System Prompt Reference modal

Button at bottom of Prompt Editor → opens a full reference sheet.

Sheet header: `System Prompt Reference · Done`.
Sub-intro: "**The system prompt is assembled from up to 11 ordered positions.** Only positions with content are included. Positions marked 'Editable' can be customized in the Prompt Editor."

Tab switcher: **Roleplay | Assistant**.

### 5.a. ROLEPLAY — 11 positions (verbatim, [IMG_4171](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4171.PNG), [IMG_4173](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4173.PNG))

| # | Name | Tag | Description | Source |
|---|---|---|---|---|
| 1 | **Writing Style** | Editable | How the AI writes — perspective, tone, paragraph length | Writing Style Preset (snapshotted per conversation) |
| 2 | **Character Prompt** | — | The character's base system prompt defining who they are | Character editor → System Prompt |
| 3 | **Scenario** | — | Active scenario context for the conversation | Scenario attached to conversation |
| 4 | **User Persona** | — | Your name, gender, appearance, and about-me context | Settings → User Persona |
| 5 | **Character Descriptions** | — | Appearance, personality, goals, and worldbuilding | Character editor detail fields |
| 6 | **Knowledge Base (Lore)** | — | Keyword-triggered lore entries matching recent messages | Character → Lore Entries |
| 7 | **RAG Memories** | — | Relevant memories retrieved from the vector store | Per-character + global document stores |
| 8 | **Rolling Summary** | — | Summary of older messages dropped from context window | Auto-generated by summary manager |
| 9 | **Visual Roleplay** | Editable | Instructions for formatting `[image: ...]` prompts | Prompt Editor → Roleplay section |
| 10 | **Context Summary** | — | Summary carried over from a parent branch | Branch summary (auto-generated) |
| 11 | **Suggested Replies** | Editable | Instructions for generating reply suggestions | Prompt Editor → Advanced section |

### 5.b. ASSISTANT — 11 positions (verbatim, [IMG_4174](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4174.PNG), [IMG_4175](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4175.PNG))

| # | Name | Tag | Description | Source |
|---|---|---|---|---|
| 1 | **Assistant Prompt** | Editable | Global base prompt for all assistant-mode characters | Prompt Editor → Assistant section |
| 2 | **Character Prompt** | — | The character's base system prompt defining their role | Character editor → System Prompt |
| 3 | **Guideline** | — | Interaction guideline (scenario with different framing) | Scenario attached to conversation |
| 4 | **User Persona** | — | Your name, gender, appearance, and about-me context | Settings → User Persona |
| 5 | **Expertise** | — | The character's declared areas of expertise | Character editor → Expertise Areas |
| 6 | **Communication Style** | — | How the character communicates (formal, casual, etc.) | Character editor → Communication Style |
| 7 | **Rules** | — | Behavioral rules and boundaries for the assistant | Character editor → Rules |
| 8 | **Knowledge Base (Lore)** | — | Keyword-triggered lore entries matching recent messages | Character → Lore Entries |
| 9 | **RAG Memories** | — | Relevant memories retrieved from the vector store | Wax character + global document stores (verbatim; likely typo for "per character") |
| 10 | **Rolling Summary** | — | Summary of older messages dropped from context window | Auto-generated by summary manager |
| 11 | **Context Summary** | — | Summary carried over from a parent branch | Branch summary (auto-generated) |

### 5.c. Observations from the reference

- **Roleplay vs Assistant scaffolds differ substantially.** Assistant has distinct `Expertise` / `Communication Style` / `Rules` fields on the Character — **these are Assistant-only fields**, not visible in the Character Info screenshots captured in Pass C (which were all Roleplay characters). Pass C Deep Dives (Personality / Goals / Worldbuilding) are the Roleplay equivalent of position 5 "Character Descriptions".
- **Scenario in Assistant mode is relabeled "Guideline"** — same slot, different framing.
- Position 11 differs: Roleplay = Suggested Replies directive; Assistant = Context Summary (no suggested-replies block by default).
- Assembly is **linear, skip-if-empty** — confirmed by "Only positions with content are included."
- Positions 1, 9 (Roleplay) / 1 (Assistant) are user-editable via Prompt Editor; positions 11 (Roleplay) also editable.

---

## 6. Reset All Prompts to Default
Red button at bottom of the Prompt Editor page. Destructive; restores every preset and template to the factory defaults shown above.

---

## Data model implications

### WritingStylePreset
| Field | Type | Source |
|---|---|---|
| id | string | |
| name | string | [IMG_4165](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4165.PNG) |
| isBuiltIn | bool | "Built-in" label |
| writingInstructions | text | [IMG_4165](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4165.PNG) |
| defaultAuthorsNote | text (optional) | [IMG_4165](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4165.PNG) |

### Character (Assistant-mode fields to add)
| Field | Source |
|---|---|
| `expertiseAreas` | System Prompt Reference → Assistant position 5 |
| `communicationStyle` | System Prompt Reference → Assistant position 6 |
| `rules` | System Prompt Reference → Assistant position 7 |

## User Extensions / Scope Decisions

- **Copy every default template verbatim into the clone.** These are battle-tested prompts — do not rewrite them.
- Ship the **System Prompt Reference** modal as-is; exposing the assembly order to users is a trust-building win.
- Make **all 11 positions optionally user-editable** on web (open the doors wider than PersonaLLM, which only exposes positions 1, 9, 11 for Roleplay).
- Support **user-defined Writing Style Presets** (already present) + **export/import preset** for sharing offline.
- Asterisks-for-narration + quotes-for-dialogue: make this **the convention** and document it in the marketing/help text.
- Build a **"Live Preview"** panel that shows the assembled prompt with per-position coloring; users can toggle positions on/off to debug.

## Open Questions

- ~~Storybook and Texting writing-style defaults~~ — **RESOLVED** from [PresetPrompts.md](../../../../References/PersonaLLM/ExtraDocuments/PresetPrompts.md).
- ~~Roleplay Writing Instructions / Default Author's Note full text~~ — **RESOLVED** from [PresetPrompts.md](../../../../References/PersonaLLM/ExtraDocuments/PresetPrompts.md).
- Full text past the truncated tails for **Visual Roleplay Instructions** and **Suggested Replies Template** (neither is in PresetPrompts.md).
- Are the Assistant-mode Character fields (Expertise / Communication Style / Rules) edited inside the Character editor on a **different tab/view** we haven't captured (since all Character Info screenshots were Roleplay-mode)?
- Is position 11 "Suggested Replies" included only when the user taps the pill, or always as a standing instruction?
- Order semantics for **Character Descriptions** (Roleplay #5) — does the app serialize Personality / Goals / Worldbuilding in a fixed order, or interleave by filled-ness?
- The 11-position assembly documented here is the **system prompt** only. [Author's Notes](../authors-notes.md) is a **12th touchpoint** that injects into the message history rather than the system prompt; the Prompt Editor doesn't expose it.
