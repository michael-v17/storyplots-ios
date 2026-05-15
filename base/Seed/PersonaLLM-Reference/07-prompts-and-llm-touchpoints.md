# 07 — Prompts & LLM Touchpoints

> This file is now **confirmed**, not inferred, thanks to the **System Prompt Reference** modal captured in Pass D ([settings/prompt-editor.md §5](04-screens/settings/prompt-editor.md#5-how-system-prompts-are-built--system-prompt-reference-modal)). Use that file as the source of truth for verbatim template strings.

## Observed in PersonaLLM

### LLM / media touchpoints (confirmed)

| # | Surface | Trigger | Template source |
|---|---|---|---|
| T1 | Main chat completion (Roleplay) | User sends message | 11-position assembly, Roleplay scaffold |
| T2 | Main chat completion (Assistant) | User sends message | 11-position assembly, Assistant scaffold |
| T3 | Regenerate message | Rail ↻ | Same as T1/T2 minus the stale variant |
| T4 | Suggested Replies | "💬 Suggested Replies" pill | Suggested Replies Template (verbatim in prompt-editor.md §4.c) |
| T5 | AI Generate Character | [CharInfo/IMG_4134](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4134.PNG) | Internal template (not exposed) |
| T6 | Refine with AI (Manual flow) | [Import/IMG_4101](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4101.PNG) | Internal |
| T7 | Auto Lorebook Extraction | Background, every N turns | Extraction Prompt (verbatim in settings/memory.md) |
| T8 | Avatar Generation (User/Char) | "Generate" button | Avatar Prefix + description + Suffix (prompt-editor.md §3.a) |
| T9 | Inline Image Generation (direct) | Rail 🖼 | Uses `[image: ...]` tag from assistant's response |
| T10 | Inline Image Generation (refined) | Same + Enable Refinement ON | Image Refinement prompt (verbatim in settings/image-engine.md) |
| T11 | Video from Image | Image options modal | Image + Video Prompt prefix + negative (prompt-editor.md §3.c) |
| T12 | Branch Summary | Fork conversation | Branch Summary + Branch Summary System Prompt (verbatim in prompt-editor.md §4) |
| T13 | Rolling Summary | Background when history exceeds context | Auto-generated (not user-visible template; see open question) |
| T14 | TTS (dual-voice) | Message playback | Italic spans → narrator voice; plain/quoted → dialogue voice |
| T15 | Video Refinement | Video generation with Refinement ON | Full verbatim system prompt in [settings/video-engine.md](04-screens/settings/video-engine.md) |
| T16 | Author's Notes injection | Every chat turn where a matching AuthorsNote exists | Injected at `injectionDepth` inside message history ([authors-notes.md](04-screens/authors-notes.md)) |

### Confirmed 11-position prompt assembly

#### Roleplay scaffold ([full verbatim table](04-screens/settings/prompt-editor.md#5a-roleplay--11-positions-verbatim-img_4171-img_4173))

```
1. Writing Style           (editable; Writing Style Preset snapshot)
2. Character Prompt        (Character.systemPrompt)
3. Scenario                (Scenario.body attached to this Conversation)
4. User Persona            (active UserPersona — name, gender, appearance, about-me)
5. Character Descriptions  (personality.* + goals.* + worldbuilding.*)
6. Knowledge Base (Lore)   (keyword-triggered LorebookEntries)
7. RAG Memories            (semantic retrieval from MemoryDocuments)
8. Rolling Summary         (auto-generated summary of older history)
9. Visual Roleplay         (editable; [image: …] instructions)
10. Context Summary         (parent-branch summary, if applicable)
11. Suggested Replies       (editable; tag-delimited output format)
```

#### Assistant scaffold ([full verbatim table](04-screens/settings/prompt-editor.md#5b-assistant--11-positions-verbatim-img_4174-img_4175))

```
1. Assistant Prompt       (editable global base)
2. Character Prompt       (Character.systemPrompt)
3. Guideline              (Scenario.body — relabeled here)
4. User Persona
5. Expertise              (Character.expertiseAreas — Assistant-only field)
6. Communication Style    (Character.communicationStyle — Assistant-only)
7. Rules                  (Character.rules — Assistant-only)
8. Knowledge Base (Lore)
9. RAG Memories
10. Rolling Summary
11. Context Summary
```

Rules:
- **Skip-if-empty.** "Only positions with content are included."
- **Snapshot semantics:** Writing Style is "snapshotted per conversation" — the Conversation stores the preset at the moment of creation, so editing the preset later doesn't retroactively change existing chats.
- **Editable positions:** Roleplay {1, 9, 11}; Assistant {1}. Others source from the Character / Conversation / Settings.

### The 12th touchpoint — Author's Notes (injected into message history)

The 11 positions above are the **system prompt**. [Author's Notes](04-screens/authors-notes.md) is a separate injection that lives **inside the message history** at a user-configured depth:

```
<System prompt: positions 1–11, skip-if-empty>
...message history...
  [depth N]  <AuthorsNote (depth=N)>
  ...
  [depth 1]
  [depth 0]  <AuthorsNote (depth=0)>   ← default, strongest steering
  <user's latest message>
```

When multiple AuthorsNotes apply (different scopes: global / character / conversation), stack them in that order (least specific to most specific) at each configured depth. `(open question — stacking order needs confirmation)`

### Conversation → Prompt data flow

```
                   ┌────────────────────────────────┐
                   │    Conversation (current)      │
                   │  ┌──────────────────────────┐  │
User's composer ──▶│  │  user message text       │  │
                   │  └──────────────────────────┘  │
                   │   writingStylePresetSnapshot   │───▶ pos #1
                   │   scenarioId (ref)             │───▶ pos #3 (or #3 Guideline)
                   │   branchParentSummary          │───▶ pos #10 (or #11)
                   └──┬───────────────────────────┬─┘
                      │                           │
                      ▼                           ▼
         ┌────────────────────────┐   ┌────────────────────────┐
         │  Character (live read) │   │   Settings (live read) │
         │  systemPrompt   ──▶ #2 │   │  User Persona    ──▶ #4│
         │  personality/*  ──▶ #5 │   │  Prompt Editor — #9    │
         │  goals/*        ──▶ #5 │   │                       #11│
         │  worldbuilding  ──▶ #5 │   └────────────────────────┘
         │  Expertise      ──▶ #5 │
         │  Comm. Style    ──▶ #6 │   ┌────────────────────────┐
         │  Rules          ──▶ #7 │   │  Memory (retrieval)    │
         │  Lorebook       ──▶ #6/8│◀─│  Lore keyword match #6/8│
         │  RAG docs       ──▶ #7/9│◀─│  RAG vector search #7/9│
         └────────────────────────┘   │  Rolling summary  #8/10│
                                      └────────────────────────┘
```

### Retrieval token budgets (confirmed, [settings/memory.md](04-screens/settings/memory.md))

- `knowledgeBudget` = 3500 tokens total shared between Lore (priority) and RAG (remainder)
- `activeWindowReserve` = 2000 tokens reserved for conversation messages
- `searchCandidates` = 10 candidates pre-ranking
- `maxMemories` = 5 snippets injected per message
- `snippetMaxTokens` = 300 per snippet
- `queryContext` = 1800 chars of the previous assistant response used as the retrieval query
- `loreScanDepth` = 1 message pair (user+ai) scanned for lore-keyword matches

### Image-generation pipeline (confirmed)

1. Assistant message ends with `[image: …]` bracket (Visual Roleplay Instructions steer this).
2. If **Enable Refinement** ON: app posts the bracket content + last `contextMessages=3` turns to the refinement LLM (system prompt verbatim in [settings/image-engine.md](04-screens/settings/image-engine.md)). Output is a richer prompt paragraph.
3. Final prompt = `Avatar/Image Prefix` + refined_prompt + `Suffix`.
4. Provider = ComfyUI (local) with workflow placeholders (sampler, scheduler, steps, CFG, seed, negative prompt) OR cloud image API.
5. Resolution from the per-generation modal or the Default Resolution setting (fallback to "Random" from enabled set).
6. If **Append appearance to image prompts** ON on the Character → Appearance Description is prepended.

### Auto Lorebook Extraction (confirmed, [settings/memory.md](04-screens/settings/memory.md))

- Frequency: `extractEvery` turns (default 3).
- Provider: user's text provider (OpenRouter / Apple Intelligence / etc.).
- Prompt: verbatim "lore extractor" template with `{name}` and `{description}` placeholders.
- Output: LorebookEntries added automatically to the Character's Lore Book.

## User Extensions / Scope Decisions

- **Mirror the 11-position assembly exactly** in the clone. This is PersonaLLM's secret sauce; reimplementing it changes the product.
- **Expose all 11 positions as user-editable** on web (PersonaLLM only exposes 1/9/11 in Roleplay, 1 in Assistant). Low implementation cost, big power-user win.
- **Ship all default templates verbatim** (see [04-screens/settings/prompt-editor.md](04-screens/settings/prompt-editor.md) and [04-screens/settings/memory.md](04-screens/settings/memory.md) and [04-screens/settings/image-engine.md](04-screens/settings/image-engine.md)).
- **Snapshot Writing Style per conversation** — the clone's Conversation table stores the preset at creation time.
- **Offer a "Prompt Preview" panel** showing the final assembled system prompt in real time — a first-class UI feature (not hidden under dev-tools).
- **Fix the typos** in the default Image Refinement prompt ("image we generation" → "image generation"; "imagen description" → "image description") when shipping the clone's defaults.

## Open Questions

- Full verbatim text of **Storybook** and **Texting** writing-style preset bodies (only Roleplay was expanded).
- Full text past the truncated tails of Roleplay Writing Instructions, Default Author's Note, Visual Roleplay Instructions, Suggested Replies Template.
- Where is the **Rolling Summary** template defined (position 8 / 10)? Not captured; likely in an Advanced settings screen we didn't reach.
- Token budget allocation details: when `knowledgeBudget=3500` is exceeded by Lore alone, does RAG get 0 tokens, or is RAG guaranteed a minimum floor?
- Does position 11 "Suggested Replies" appear in the system prompt **only when** the user taps the pill, or **always** (so the model is primed to produce the tagged block)?
- Exact message-ordering: are positions 1-11 concatenated into a single system-role message, or split across system/user/assistant messages? (Matters for providers that handle roles differently.)
