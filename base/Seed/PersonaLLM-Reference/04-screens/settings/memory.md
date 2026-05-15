# Settings → Memory

## Observed in PersonaLLM

Sources: [IMG_4155](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4155.PNG) (Memory root), [IMG_4156](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4156.PNG) + [IMG_4157](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4157.PNG) (Retrieval Tuning), [IMG_4158](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4158.PNG) → [IMG_4161](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4161.PNG) (Auto Lore Extraction).

---

### Memory root ([IMG_4155](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4155.PNG))

**CHARACTER MEMORY**
- **Character Memory** — toggle, ON by default.
  - Copy: "New characters remember details across conversations by default. Can be overridden per character."
  - This is the global default; the per-character override lives in [character-info.md → Settings tab](../character-info.md#3c-settings-tab).

**RETRIEVAL SETTINGS**
- **Retrieval Tuning** → submenu (chevron).

**AUTO LORE**
- **Auto Lore Extraction** → submenu (chevron).

---

### Retrieval Tuning — Memory Settings ([IMG_4156](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4156.PNG), [IMG_4157](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4157.PNG))

| # | Label | Control | Default | Unit | Copy |
|---|---|---|---|---|---|
| 1 | **RAG Retrieval** | Toggle | ON | — | "When off, no memory stores are opened and no retrieval or writes occur. Lore keyword matching still works." |
| 2 | **Lore Scan Depth** | Slider | `1 pairs` | message pairs | "Message pairs (user + AI) scanned for knowledge base keyword matches." |
| 3 | **Knowledge Budget** | Slider | `3500` | tokens | "Total token pool shared between lore entries and RAG memories. Lore gets priority; RAG gets the remainder." |
| 4 | **Active Window Reserve** | Slider | `2000` | tokens | "Minimum tokens reserved for conversation messages. Prevents memories from starving the chat context." |
| 5 | **Search Candidates** | Slider | `10` | count | "Candidates retrieved before fusion ranking. Higher means better recall but slower retrieval." |
| 6 | **Max Memories** | Slider | `5` | count | "Maximum number of memory snippets injected into the system prompt per message." |
| 7 | **Snippet Max Tokens** | Slider | `300` | tokens | "Maximum size of each individual memory snippet." |
| 8 | **Query Context** | Slider | `1800` | characters | "Characters of the previous AI response included in the retrieval query. Higher gives more context but noisier queries." |

Footer: **↻ Reset to Defaults** button.

**Architectural implications (confirmed, not inferred):**
- Memory subsystem is **dual**: keyword-matched **Lore** entries (lorebook) + **RAG** vector retrieval. Lore has priority in the token budget.
- Fusion ranking exists (N candidates → top-M kept). Suggests hybrid retrieval (BM25 / keyword + vector) with a re-ranker.
- The retrieval *query* is the previous assistant response (windowed to N chars) — lore scan is on the last N user+assistant pairs.

---

### Auto Lore Extraction ([IMG_4158](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4158.PNG) → [IMG_4161](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4161.PNG))

**GENERAL**
- **Auto Lore Extraction** — toggle, ON.
  - Copy: "Automatically extract and save lore entries from your conversations" · "View and manage extracted entries in each character's Lore Book under Edit Character."

**PROVIDER**
- Picker — when no provider configured: _"No providers available. Apple Intelligence is not available on this device. Configure a custom text provider to use this feature."_ + `Add Provider` button.
- When configured: `Provider: OpenRouter` (dropdown).
- Info card (green): "Apple Intelligence has a 4,096 token context limit. Character descriptions over ~2,000 characters will be truncated. For best results, use 1–5 messages per extraction."
- Info card (purple, lock icon): "Upgrade to Premium for cloud-powered memory extraction." *(SCOPE-CUT in clone.)*

**EXTRACTION FREQUENCY**
- **Extract Every** `3` turns — stepper (`−` / `+`).

**SYSTEM PROMPT**
- **Extraction Prompt** — large editable textarea, with **↻ reset** icon.
  - Placeholder hint: "Use `{name}` and `{description}` as placeholders for the character's name and description."
  - **Default value (verbatim, [IMG_4160](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4160.PNG), [IMG_4161](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4161.PNG)):**

```
You are a lore extractor for a roleplay character.
Character: {name}
Description: {description}

Analyze the conversation below and extract important facts worth remembering for future conversations.

Extract ONLY:
- Named characters, people, or beings introduced or described
- Named locations, places, or settings
- Named items, weapons, artifacts, or objects of significance
- Relationships between characters (family, allies, enemies)
- World rules, magic systems, or established lore
- Significant events that change the story

Do NOT extract:
- Generic actions (walking, talking, greeting)
- Emotions or reactions without factual content
- Information already obvious from the character description above
- Vague or ambiguous statements
```

---

### LorebookEntry / MemoryDocument fields (inferred from settings behavior)

| Field | Source of evidence |
|---|---|
| `id` | standard |
| `characterId` | per-character Lore Book |
| `title` | extraction output (named entity) |
| `keywords[]` | keyword-matched retrieval ("keyword matching still works" when RAG is off) |
| `body` | extracted fact |
| `createdAt` / `source` | auto-extracted vs user-added |
| `tokenEstimate` | to satisfy `snippetMaxTokens` budget |

MemoryDocument (for RAG docs uploaded):
| Field |
|---|
| `id`, `ownerScope` (character / global), `title`, `chunks[]` (with embeddings), `createdAt` |

## User Extensions / Scope Decisions

- **Keep the dual memory model verbatim** (keyword Lore + vector RAG) — it's a competitive advantage and power-user magnet.
- Keep all 8 Retrieval Tuning knobs with the same defaults. These are meaningful only to power users but critical for them.
- Keep Auto Lore Extraction as opt-in/out with user-editable prompt and configurable cadence.
- In the clone's BYOK world: the extraction provider is **always** the user's own text provider (no "Apple Intelligence" fallback). Info cards change accordingly.
- Premium-gated "cloud-powered memory extraction" — remove (no monetization).

## Open Questions

- Exact embedding model used for RAG (on-device or provider-side)? Not captured.
- How does "Fusion ranking" work — is it reciprocal-rank fusion, a linear weighting, or LLM re-ranker?
- Storage quota per RAG store? Size limits on uploaded documents?
- Does Lore Book editing happen inside the Character editor (not captured in Character Info screenshots) or here? Copy says "View and manage extracted entries in each character's Lore Book under Edit Character" — so there IS a Lore Book UI inside Character editor that Pass C did not capture.
