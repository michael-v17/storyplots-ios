# Domain — StoryPlots v0

> **Authority:** fifth in precedence. Higher than [architecture.md](architecture.md), [schema.md](schema.md), [ux.md](ux.md), [design.md](design.md). Conflicts with [creator-vision.md](creator-vision.md), [product.md](product.md), or [user-stories.md](user-stories.md) are resolved in their favor and recorded in [open-questions.md](open-questions.md).
>
> Canonical names come from [PersonaLLM-Reference/00-index.md](PersonaLLM-Reference/00-index.md) plus v0 additions. Shape and scoping come from [creator-vision.md](creator-vision.md) §2, §3, §7.

---

## 1. Hierarchy (v0, flat)

v0 is **single-NPC-per-chat**. No Story / Scenario-as-entity / Quest / Plot layer. A Character has N Conversations; each Conversation is an independent thread with its own per-Conversation memory, Lorebook, and Grammar history.

```
User
  ├── UserPersona (0..1, optional)
  ├── ProviderConfig[]                        — BYOK keys / endpoints per provider kind
  ├── GrammarAggregate (0..1)                 — per-User rollup cache for Home + Dashboard
  └── Character (1..N — each = one AI companion)
        └── Conversation (1..N per Character)
              ├── Message[] (role ∈ user | assistant)
              │     └── MessageVariant[]      — alternate assistant contents; regen / nav
              │     └── InlineMedia[]         — generated images / videos attached to a message
              ├── LorebookEntry[]             — per-Conversation in v0 (diverges from PersonaLLM)
              ├── MemoryDocument[]            — per-Conversation RAG source, pgvector
              ├── RollingSummary (0..1)       — auto-generated; position 8 / 10 in prompt
              ├── AuthorsNote (0..1)          — per-Conversation steering note (v0 limits to conv scope)
              ├── AutopilotRun (0..N)         — per-Conversation auto-play state
              ├── ChatControlsState (0..1)    — per-Conversation UI overrides
              ├── ConversationBranch (0..N)   — fork points; or encoded as fields on Conversation
              └── GrammarCorrection[]         — per-Conversation; never entered into Conv. Agent ctx

Aggregate / cross-cutting:
  GeneratedImage                              — per-User, filterable by Character; feeds Gallery
```

**What this shape deliberately does NOT contain:**

- No `Story`, `Scenario` (as a first-class entity), `Quest`, `Plot`, `MasterAgent` — out of v0 scope per [creator-vision.md](creator-vision.md) §1 / §8 principle 7. Scenario lives as a Character field (§3 below).
- No `CommunityCharacter`, `Creator`, `Follow`, `Favorite`, `Like`, `Download`, `Flag`, `Leaderboard` — Community is cut in v0.
- No `Credits`, `CreditsAccount`, `CreditsTransaction` — monetization is cut.

---

## 2. Entity catalog

Each entity lists: **purpose**, **key fields (conceptual, not SQL)**, **scope**, **lifecycle states**, **invariants**. Fields are prose; [schema.md](schema.md) owns the concrete column-level truth.

### 2.1 User

- **Purpose:** account identity. One row per human (or per guest session, see "Anonymous variant").
- **Key fields:** `id`, `auth_method` (email / google / github / anonymous), `display_name`, `email?`, `email_verified_at?`, `sfw_disabled` (default `false`), `byok_keys` (encrypted blob — text / image / TTS / STT keys + endpoints), `preferences` (JSON — grammar toggles, sidebar persistence, typing speed, suggested replies, bubble theme, TTS mode, etc.), `prompt_assembly` (JSON — user's 11-position overrides), `created_at`, `last_active_at`.
- **Scope:** root. Every other entity is ultimately scoped to a `User` via RLS.
- **Lifecycle:**
  - `anonymous` — created via Supabase anonymous sign-in on first visit; has a real `User` row + JWT; data persists across return visits; pruned after ~90 days of inactivity (inferred default, [creator-vision.md](creator-vision.md) §6).
  - `authenticated` — linked to email/password (and/or magic link), Google, or GitHub. Anonymous → authenticated upgrade **preserves all data with no migration step** (F5, story 2).
  - `deleted` — full cascade of every owned entity (see §4); Supabase session revoked.
- **Invariants:**
  - Anonymous Users get **identical RLS** to authenticated Users.
  - `sfw_disabled = true` requires `auth_method != anonymous`.
  - BYOK keys are **encrypted at rest**; never leave the backend unencrypted except in a per-request in-memory pass to the relevant provider.

### 2.2 UserPersona

- **Purpose:** the user's self-representation inside roleplay. Injected into the Conversation Agent prompt at position 4. Optional: 0..1 per User.
- **Key fields:** `id`, `user_id`, `photo?`, `name`, `gender`, `appearance` (skin / eyes / hair / extras), `background_story?`.
- **Scope:** per-User.
- **Lifecycle:** created / edited / deleted. Gender-appropriate smart defaults fill blank fields at read time (PersonaLLM behavior preserved).
- **Invariants:**
  - **UserPersona is never sent to the Grammar Agent.**
  - Absent UserPersona → position 4 is skipped (skip-if-empty rule from [PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md)).

### 2.3 Character

- **Purpose:** an AI companion the user chats with.
- **Key fields (PersonaLLM-derived):** `id`, `owner_user_id`, `name`, `tagline?`, `system_prompt` (≤ 2000 chars by convention, soft limit on web), `mode` (`roleplay` | `assistant`, **immutable after creation**), `avatar?`, `appearance_description?`, `append_appearance_to_image_prompts` (default `true`), `accent_color` (16 presets + custom), `personality` (core traits / fears / communication style / quirks), `goals` (primary / secret desire / fears to overcome / would-sacrifice), `worldbuilding` (origin / backstory / world / special abilities), `default_writing_style` (refs `WritingStyle`; defaulted to Roleplay), `default_persona?` (refs `UserPersona`; "None · Use app default" allowed), `character_memory_enabled` (default `true`), `tags[]?`, `scenario?` (text — see §3), `is_example?` (auto-seeded flag).
- **Key fields (Assistant-mode only):** `expertise_areas`, `communication_style_assistant`, `rules`.
- **Key fields (v0 Extension):** `english_style` — enum: `formal_american` / `neutral_american` (default) / `casual_american`. Register-based, **not** regional dialect. Injected into the Character's system prompt so the NPC speaks in the chosen register. **Never consumed by the Grammar Agent.**
- **Scope:** per-User. No cross-user reads ever.
- **Lifecycle:** created (AI Generate / Manual) or imported (JSON / PNG card). Edited. Deleted (cascades to all Conversations and their subtrees — §4).
- **Invariants:**
  - **Lorebook is NOT on the Character.** Lorebook is per-Conversation in v0 ([creator-vision.md](creator-vision.md) §3, §9). Character deletion still cascades each Conversation's Lorebook.
  - **`english_style` never alters Grammar Agent behavior** ([creator-vision.md](creator-vision.md) §8 principle 8).
  - **Edits are NOT retroactive.** Editing a Character does NOT change existing Conversations; each Conversation holds a snapshot (§2.4). Edits apply to subsequently-created Conversations only.
  - `mode` is **immutable after creation** (PersonaLLM baseline; preserved in v0).
  - Community-sourced Characters are **not importable** in v0 (no Community surface).

### 2.4 Conversation

- **Purpose:** an independent 1:1 chat thread with one Character. A Character has multiple Conversations; each has its own memory, Lorebook, Author's Note, and grammar history.
- **Key fields:** `id`, `user_id`, `character_id`, `title`, `character_snapshot` (JSON — prompt-relevant fields taken from the Character at creation time; used by the 11-position assembly going forward), `writing_style_snapshot`, `persona_id?` (refs UserPersona at creation), `last_message_at`, `message_count`, plus branch fields — `branch_parent_conversation_id?`, `branch_parent_message_id?`, `branch_mode?` (`keep_messages` | `summarize_fresh`), `parent_branch_summary?`.
- **Scope:** per-User, per-Character. RLS enforced.
- **Lifecycle:** created → active → (forked, optionally) → deleted.
- **Invariants:**
  - `character_snapshot` is **point-in-time and never overwritten** by later Character edits. This is what makes "Character edits apply to new Conversations only" work without surprise (stories 9, 12).
  - **New Conversations start with an empty Lorebook** ([creator-vision.md](creator-vision.md) §3; story 12).
  - **Scenario is NOT rendered as a visible chat-feed message.** If `Character.scenario` is non-empty, its text is **appended to the Character card block in the 11-position assembly** and otherwise invisible to the user ([user-stories.md](user-stories.md) story 12 round-3 commit). This diverges from PersonaLLM's behavior of rendering the scenario as message #0.
  - Per-Conversation isolation of memory, Lorebook, and grammar is mandatory ([creator-vision.md](creator-vision.md) §2, §3).
  - Deletion cascades everything owned by this Conversation (§4).

### 2.5 Message

- **Purpose:** one turn in a Conversation, user or assistant.
- **Key fields:** `id`, `conversation_id`, `role` (`user` | `assistant`), `active_variant_id?`, `created_at`, plus attachments (`InlineMedia[]`).
- **Scope:** per-Conversation.
- **Lifecycle:** created → edited (destructive trim) → deleted. Variants are added via Regenerate; branching produces a new Conversation rather than mutating this Message.
- **Invariants:**
  - **Editing any prior Message deletes all subsequent Messages in that Conversation** ([creator-vision.md](creator-vision.md) §5.2 "Edit semantics"; story 18). For user-Message edits, grammar is re-run on the new text; downstream `GrammarCorrection` rows are removed with the trim.
  - **Once a user Message has been corrected, it is not re-corrected for the same text.** Re-renders and variant navigation do not trigger re-correction. Editing replaces the logical Message and produces a fresh correction pass (F4).
  - **Assistant Messages are never sent to the Grammar Agent.** Only user Messages are.
  - **Autopilot-generated user Messages (if any exist) are NOT sent to the Grammar Agent** ([creator-vision.md](creator-vision.md) §5.2 "Autopilot × Grammar"). Autopilot generates assistant turns only; the principle protects against any accidental path that synthesizes user turns.

### 2.6 MessageVariant

- **Purpose:** alternate assistant content for a given assistant Message. Created by Regenerate; the user swipes or clicks between variants.
- **Key fields:** `id`, `message_id`, `content` (text — may mix italic narration and plain/quoted dialogue), `model_snapshot`, `generation_params_snapshot`, `created_at`.
- **Scope:** per-Message.
- **Lifecycle:** appended via Regenerate; `Message.active_variant_id` points to the currently-displayed one. "Continue generation" appends to the selected variant's content (default — story 19).
- **Invariants:**
  - Variants live only on **assistant** Messages.
  - Regenerate / variant navigation **never triggers Grammar Agent calls** (principle 3).

### 2.7 LorebookEntry

- **Purpose:** a piece of keyword-triggered knowledge the retrieval step can inject into the prompt at position 6 / 8.
- **Key fields:** `id`, `conversation_id`, `title`, `keywords[]`, `body`, `source` (`manual` | `auto_extracted`), `token_estimate`, `created_at`, `updated_at`.
- **Scope:** **per-Conversation in v0** (divergence from PersonaLLM, which scopes per-Character — [creator-vision.md](creator-vision.md) §3, §9).
- **Lifecycle:** created manually (via the Chat-screen Lorebook panel) or via Auto Lore Extraction every N turns (default 3); edited; deleted; cascade-deleted with the Conversation.
- **Invariants:**
  - **Not exposed on the Character editor** — the UI lives on the Chat screen, tied to the active Conversation ([creator-vision.md](creator-vision.md) §5.2 "Lorebook in Chat"; story 25).
  - **Branching COPIES** the kept-range Lorebook entries into the new Conversation with the new `conversation_id` ([user-stories.md](user-stories.md) story 14 round-3 commit; F6).

### 2.8 MemoryDocument

- **Purpose:** RAG source for position 7 / 9 retrieval. Holds embedded chunks produced from uploaded documents or (future) conversation extracts.
- **Key fields:** `id`, `conversation_id`, `title`, `source_type` (`upload` | `conversation_extract`), `chunks[]` (each with `text`, `embedding`, `token_estimate`), `created_at`.
- **Scope:** **per-Conversation in v0** (mirrors Lorebook divergence).
- **Lifecycle:** uploaded or extracted; chunked + embedded; retrieved at retrieval time; deleted cascading with the Conversation.
- **Invariants:**
  - Uses **Supabase Postgres + `pgvector`** ([creator-vision.md](creator-vision.md) §3, §11). No external vector DB.
  - Retrieval tuning (top-k, similarity threshold, recency weighting) is exposed in Settings → Memory (story 41).

### 2.9 RollingSummary

- **Purpose:** auto-generated summary of older Conversation history, injected at prompt position 8 (Roleplay) / 10 (Assistant).
- **Key fields:** `id`, `conversation_id`, `summary_text`, `summarized_through_message_id`, `updated_at`.
- **Scope:** per-Conversation.
- **Lifecycle:** rebuilt when the active-window history exceeds the configured budget.
- **Invariants:** skip-if-empty (PersonaLLM rule).

### 2.10 AuthorsNote

- **Purpose:** user-written steering note injected into the message history at a configurable depth. The 12th touchpoint beyond the 11-position system prompt ([PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md)).
- **Key fields:** `id`, `user_id`, `scope` (v0: `conversation` only), `conversation_id`, `notes_text`, `injection_depth`, `created_at`, `updated_at`.
- **Scope:** per-Conversation in v0. PersonaLLM's `global` and `character` scopes are out of scope for v0 (**inferred**: [creator-vision.md](creator-vision.md) §5.2 says "Author's Notes — first-class, per-Conversation"; no broader scope is affirmed). Logged as a minor gap in [open-questions.md](open-questions.md) if downstream implementers ask.
- **Lifecycle:** created / edited / deleted per Conversation.
- **Invariants:**
  - **Not visible to the Grammar Agent** ([user-stories.md](user-stories.md) story 22; F3).

### 2.11 AutopilotRun

- **Purpose:** tracks a per-Conversation auto-play session (N assistant-only turns).
- **Key fields:** `id`, `conversation_id`, `preset` (`5` | `10` | `25` | `custom`), `remaining_turns`, `active`, `started_at`, `ended_at?`.
- **Scope:** per-Conversation.
- **Lifecycle:** started → decremented per turn → paused on user send or provider error → ended.
- **Invariants:**
  - **Autopilot generates assistant turns only** ([user-stories.md](user-stories.md) story 21).
  - **The Grammar Agent does NOT run on Autopilot-generated user messages**, should any such path exist ([creator-vision.md](creator-vision.md) §5.2 "Autopilot × Grammar").

### 2.12 ChatControlsState

- **Purpose:** per-Conversation UI overrides (auto-images, auto-TTS, debug, provider overrides).
- **Key fields:** `conversation_id`, `auto_images`, `auto_tts`, `debug_mode`, `image_provider_override?`, `video_provider_override?`.
- **Scope:** per-Conversation.
- **Lifecycle:** created on first override; mutated as user flips toggles; deleted with the Conversation.

### 2.13 ConversationBranch

- **Purpose:** point-in-time record of a fork. May live as its own table OR as fields on the child `Conversation` (see [schema.md](schema.md) §Open data questions).
- **Key fields:** `id`, `parent_conversation_id`, `parent_message_id`, `child_conversation_id`, `branch_mode`, `summary_text?` (when `summarize_fresh`), `created_at`.
- **Scope:** per-User (linked to both parent and child Conversations, both owned by the same User).
- **Lifecycle:** created at fork; read-only after.
- **Invariants:**
  - Forking produces a **new** Conversation (F6), not a tree node inside an existing one. The child is self-contained: its Lorebook and GrammarCorrection rows are **copied** from the kept range, not referenced ([user-stories.md](user-stories.md) story 14).
  - Parent Conversation is unaffected by the fork.

### 2.14 GrammarCorrection (v0 Extension)

- **Purpose:** one row per user Message that produced a correction. The learning artifact for the Grammar Module.
- **Key fields:** `id`, `user_message_id`, `conversation_id`, `user_id`, `original_text` (verbatim), `corrected_text` (verbatim), `explanation?` (Mode B only), `error_categories[]` (e.g. verb-tense, articles, prepositions, word-order, filler-words), `edit_distance`, `reinforcement_failures_count` (default `0`), `created_at`.
- **Scope:** per-Conversation, per-User.
- **Lifecycle:** written on Grammar Agent completion. Incremented `reinforcement_failures_count` when a user fails a Reinforcement rewrite. Deleted by: (a) edit-as-trim on its owning Message, (b) Conversation deletion, (c) Character deletion cascade, (d) per-Conversation clear (story 32), (e) global clear (story 38), (f) account delete.
- **Invariants:**
  - **Both `original_text` and `corrected_text` are stored verbatim** (no diff-only storage) — [creator-vision.md](creator-vision.md) §7 "Storage of correction pairs".
  - **A given user Message produces at most one `GrammarCorrection` row for its current text** (stories 27, 28, 34). Re-renders and variant navigation do not re-correct.
  - **Never injected into the Conversation Agent prompt** ([creator-vision.md](creator-vision.md) §3, §8 principle 3).
  - **Branching COPIES** the kept-range `GrammarCorrection` rows into the new Conversation with the new `conversation_id` ([creator-vision.md](creator-vision.md) §5.2; F6).

### 2.15 GrammarAggregate (v0 Extension)

- **Purpose:** per-User rollup cache consumed by the Home snapshot widget and the `/grammar` Dashboard.
- **Key fields:** `user_id`, `detected_level`, `top_errors`, `filler_words`, `overused_words`, `connector_stats`, `ai_narrative_feedback`, `improvement_suggestions`, `reinforcement_performance_pct`, `dirty` (boolean), `new_messages_since_last_run` (integer counter), `updated_at`.
- **Scope:** per-User.
- **Lifecycle:** created on first Grammar Agent write; updated by the Insights Job (triggered every 10 new user messages, or on Home load when `dirty = true`); cleared on global grammar clear or account delete.
- **Invariants:**
  - **Pre-computed; never aggregated live on render.** Home and Dashboard read cached values immediately.
  - **Home is never blocked on the Insights Job** — staleness is state-based via `dirty`, not time-based ([creator-vision.md](creator-vision.md) §7; story 37).
  - **The Insights Job operates on aggregated stats, not raw Message text** — avoids leaking conversation content into the insights layer and keeps cost predictable ([creator-vision.md](creator-vision.md) §7).

### 2.16 GeneratedImage

- **Purpose:** a user-generated image attached to a Message (via ComfyUI or a cloud provider).
- **Key fields:** `id`, `user_id`, `character_id`, `conversation_id`, `message_id`, `kind` (`image` | `video`), `prompt`, `refined_prompt?`, `resolution`, `dimensions`, `duration_sec?` (video), `provider_snapshot`, `seed?`, `parent_image_id?` (video-from-image), `storage_ref`, `created_at`.
- **Scope:** per-User, filterable by Character (Gallery in v0 filters per-Character, not per-Story — Stories don't exist).
- **Lifecycle:** generated async (non-blocking); attached to Message and Gallery; deletable.
- **Invariants:**
  - When `User.sfw_disabled = false`, the **image pipeline prepends an SFW-friendly positive suffix** and **appends NSFW terms to the negative prompt** ([creator-vision.md](creator-vision.md) §6). If the filtered prompt still reads NSFW, generation is **blocked** with a brief notice.

### 2.17 ProviderConfig (BYOK)

- **Purpose:** one record per provider the user has configured. Stored encrypted.
- **Key fields:** `id`, `user_id`, `kind` (`text` | `image` | `video` | `tts` | `stt`), `provider_family` (e.g. OpenRouter, OpenAI, Google, Ollama, LM Studio, vLLM, ComfyUI, ElevenLabs, WebSpeech), `base_url?`, `api_key_encrypted?`, `model_id?`, `temperature?`, `max_tokens?`, `context_length?`, `thinking_mode?`, `workflow_config?` (image-only; sampler / scheduler / steps / CFG / seed / prefix / negative + per-style file for anime/realistic/pixel), `last_tested_ok?`, `last_tested_at?`, `is_active` (one active per `kind`), `created_at`.
- **Scope:** per-User.
- **Invariants:**
  - Exactly one `is_active = true` per `kind` per User.
  - Keys are **encrypted at rest**; passed to the backend per request.
  - **No shared server-side keys.** No centralized billing.

---

## 3. Terminology

### 3.1 Reused verbatim from PersonaLLM

- **Character** — canonical name for the AI companion (observed synonyms "AI Companion / Persona" are product-copy variants; the seed uses `Character` in data/model contexts).
- **UserPersona** — the user's self-representation in roleplay ("Your Persona" in UI copy).
- **Conversation** — an independent thread ("Chat" in UI copy).
- **Message** — one turn.
- **MessageVariant** — alternate assistant contents (UI: "variants" / swipe alternates).
- **LorebookEntry** — keyword-triggered knowledge item.
- **MemoryDocument** — vector-indexed RAG source.
- **AuthorsNote** — per-Conversation steering note.
- **AutopilotRun**, **ChatControlsState**, **WritingStyle**, **VoiceProfile**, **ConversationBranch**, **RollingSummary**, **BranchSummary** — preserved.
- **ProviderConfig** — BYOK configuration record.

### 3.2 v0 additions

- **GrammarCorrection** — row per user-Message correction.
- **GrammarAggregate** — per-User cache for Home widget + `/grammar` Dashboard.
- **English Style** — Character-level register (`formal_american` / `neutral_american` / `casual_american`). Flavor only; not consumed by the Grammar Agent.
- **Reinforcement Validator** — local, non-LLM comparator (≥95% normalized similarity, 3-strike cap).
- **Insights Job** — async Python job that rolls up `GrammarCorrection` → `GrammarAggregate`.

### 3.3 Deliberate removals

- `Credits`, `CreditsAccount`, `CreditsTransaction`.
- `CommunityCharacter`, `Creator`, `Follow`, `Favorite`, `Like`, `Download`, `Flag`, `Leaderboard`.

### 3.4 Deliberate demotions

- **`Scenario`** is **not a first-class entity in v0.** PersonaLLM treats it as a `Scenario[]` under `Character`; v0 collapses it into a single `Character.scenario` text field, appended to the Character card block in the 11-position system prompt ([user-stories.md](user-stories.md) story 12 round-3 commit). This is a deliberate simplification for the single-NPC-per-chat model; Scenario-as-entity returns in v1+ alongside Story / Quest / Plot.

---

## 4. Relationships, ownership, and cascades

### 4.1 Ownership (who can delete whom)

| Parent | Children (deleted on parent deletion) |
|---|---|
| `User` | Every other entity the user owns — fully cascaded on account deletion (story 48). |
| `Character` | All its `Conversation`s and, via them, every subtree: `Message`, `MessageVariant`, `LorebookEntry`, `MemoryDocument`, `AuthorsNote`, `ConversationBranch`, `GrammarCorrection`, `AutopilotRun`, `ChatControlsState`, `RollingSummary`. `GrammarAggregate` is **recomputed** (marked `dirty`) but not deleted. (Story 10.) |
| `Conversation` | `Message`, `MessageVariant`, `LorebookEntry` (per-Conv in v0), `MemoryDocument` (per-Conv in v0), `AuthorsNote`, `AutopilotRun`, `ChatControlsState`, `RollingSummary`, `ConversationBranch`, `GrammarCorrection`. `GrammarAggregate` marked `dirty`. (Story 15.) |
| `Message` | `MessageVariant`, `InlineMedia` (but `GeneratedImage` is per-User / per-Character so it survives in the Gallery unless explicitly deleted). Edit-as-trim removes `Message[]` downstream of the edit point plus their variants and their `GrammarCorrection` rows (story 18). |

### 4.2 Carry-forward on branch (copies, not references)

When a Conversation is forked via "Keep messages" or "Summarize & start fresh":

- A **new `Conversation`** is created (not a tree node inside the parent).
- Messages 1..N of the kept range are **attached to the new Conversation** (storage detail: may be re-rowed or linked; [schema.md](schema.md) §Open data questions).
- **`LorebookEntry` rows of the kept range are COPIED** into the new Conversation with the new `conversation_id` ([user-stories.md](user-stories.md) story 14 round-3B).
- **`GrammarCorrection` rows of the kept range are COPIED** into the new Conversation with the new `conversation_id` ([creator-vision.md](creator-vision.md) §5.2 "Branching × Grammar"; F6).
- `MemoryDocument` behavior is per-Conversation — the branch starts empty OR copies depending on the cost/UX tradeoff. **Default committed here (inferred):** empty, because RAG sources tend to be large and re-uploading is cheaper than bloating storage; logged as a minor gap in [open-questions.md](open-questions.md).
- Parent Conversation is unaffected.

### 4.3 Cross-entity dependencies (soft links)

- `Message` ↔ `GrammarCorrection` via `user_message_id`. One-to-zero-or-one for user Messages; never for assistant Messages.
- `Conversation.character_snapshot` ↔ `Character` (point-in-time value, not a live FK).
- `InlineMedia` ↔ `GeneratedImage` (the inline attachment is the image record, filterable in Gallery).

---

## 5. Lifecycles

### 5.1 Anonymous → authenticated upgrade (F5)

- Supabase anonymous sign-in creates a real `User` row + JWT on first visit.
- Linking email / OAuth preserves the same `User.id` and therefore every owned row (Characters, Conversations, BYOK keys, Grammar data).
- No migration step; no data copy; no cascade.

### 5.2 Character edit vs existing Conversations

- Edits to `Character.*` apply to **Conversations created AFTER the edit**.
- Existing Conversations read from `Conversation.character_snapshot`; they are **not retroactively updated**.
- Store [user-stories.md](user-stories.md) story 9 round-3A commit: "Character edits apply to NEW Conversations only." Residual re-validation against observed PersonaLLM behavior is §10 #1 in [open-questions.md](open-questions.md).

### 5.3 Edit-as-trim (F4)

- User edits any prior Message (user or assistant) → confirmation dialog makes the trim explicit → save deletes all subsequent Messages, their MessageVariants, and their `GrammarCorrection` rows.
- For edited **user** Messages with grammar enabled, the edited text goes through a fresh Grammar Agent pass, writing a new `GrammarCorrection` row.
- The "once corrected, not re-corrected" invariant is preserved: it refers to re-correcting the same text; the edited Message's text is different.

### 5.4 Reinforcement (F2)

- Grammar Agent returns a correction (or "already correct").
- If correct → NPC responds immediately. No rewrite prompt.
- If there was an error → input is replaced with a rewrite prompt.
- **Reinforcement Validator** compares rewrite to correction locally (non-LLM, ≥95% normalized similarity).
- On pass → NPC responds.
- On fail → user retries.
- **After 3 failed attempts** → NPC responds anyway, `GrammarCorrection.reinforcement_failures_count` incremented. No infinite loop.

### 5.5 Insights Job cadence

- Triggered **every 10 new user messages** (tracked via `GrammarAggregate.new_messages_since_last_run`), OR on Home load when `GrammarAggregate.dirty = true`.
- Runs a single LLM call over aggregated stats (not raw Message text).
- Clears `dirty` and resets the counter on completion.
- Home / Dashboard never block waiting on the Insights Job; they render cached values and trigger an async refresh.

### 5.6 Grammar clears (F7)

- **Per-Conversation clear** (story 32) — deletes `GrammarCorrection` rows scoped to the Conversation; marks `GrammarAggregate.dirty = true`.
- **Global clear** (story 38) — deletes every `GrammarCorrection` and `GrammarAggregate` row for the `User`. Snapshot disappears from Home until new data lands.

---

## 6. Invariants (bold, numbered)

These are the rules downstream generators must not break. Restated here in one place for easy reference:

1. **Conversation Agent context never contains Grammar data, on any turn.**
2. **Grammar Agent context never contains Character, UserPersona, Lorebook, Memory, or Author's Notes data.** Only the user's raw message text.
3. **Assistant Messages are never sent to the Grammar Agent. Autopilot-generated user Messages are never sent to the Grammar Agent.**
4. **A given user Message produces at most one `GrammarCorrection` row for its current text.** Edit creates a new logical message with a fresh pass; regenerate / variant navigation never re-correct.
5. **Editing a Message trims the feed.** Subsequent Messages and their grammar rows are deleted.
6. **Branching COPIES per-Conversation `LorebookEntry` and `GrammarCorrection` rows from the kept range into the new Conversation.**
7. **`Character.english_style` never alters Grammar Agent behavior.** The Grammar Agent always corrects to American English.
8. **`character_snapshot` is point-in-time and never retroactively changed by Character edits.**
9. **Home is never blocked on the Insights Job.** Staleness is state-based via `dirty`; Home reads cached values immediately.
10. **The Insights Job operates on aggregated stats, not raw Message text.**
11. **Anonymous Users get identical RLS to authenticated Users.**
12. **`sfw_disabled = true` requires authenticated (non-anonymous) User + 18+ confirmation.**
13. **SFW pre-filter prompts (text guardrail block and image NSFW-negative keywords) are system-owned and not user-editable anywhere** (not in Prompt Editor, not in Settings).
14. **Supabase Postgres is the source of truth for Conversation state.** `langgraph-checkpoint-postgres` is a cache; any client can replay history from Supabase alone.
15. **No cross-user read is possible at the database layer.** RLS enforces isolation; no hand-written authorization checks sprinkled across code.
16. **Reinforcement validation is local and non-LLM.** ≥95% normalized similarity. Hard cap of 3 retries.
17. **Grammar master toggle defaults OFF for every new `User`, including anonymous.**
18. **Exactly one `ProviderConfig` is `is_active = true` per `kind` per User at any time.**
19. **Community-sourced Characters are NOT importable in v0.**
20. **Character `mode` (Roleplay / Assistant) is immutable after creation.**

---

## 7. Boundary and visibility model

### 7.1 Privacy boundary

- The **User** is the only visibility boundary in v0. Every row, every file, every vector is scoped to one `user_id`.
- No public / friends / followers / groups concept exists (no Community).
- RLS policies on every table enforce `where user_id = auth.uid()` on select / insert / update / delete. Join tables inherit via their parent.

### 7.2 Agent-context boundary

- **Conversation Agent** input set: `Character` (via `character_snapshot`), `UserPersona`, `LorebookEntry` (retrieved), `MemoryDocument` (retrieved), `AuthorsNote`, `Message` history, current user Message, `WritingStyle`, `RollingSummary`, SFW guardrail block (when `sfw_disabled = false`).
- **Conversation Agent** forbidden set: `GrammarCorrection`, `GrammarAggregate`, any derivative of the Grammar Module.
- **Grammar Agent** input set: user's **current message text only**.
- **Grammar Agent** forbidden set: everything else (Character, UserPersona, Author's Notes, Lorebook, Memory, Rolling Summary, bubble colors, Writing Style, BYOK keys beyond the one used to call the agent's own model).
- **Reinforcement Validator** input set: correction text + user rewrite text. No LLM input.
- **Insights Job** input set: aggregated counts and categorized stats from `GrammarCorrection`. Forbidden: raw `original_text` / `corrected_text` strings.

### 7.3 SFW filter boundary

- Applies to **text** and **image** paths. TTS inherits safety from the text path.
- **Text:** system-owned guardrail block prepended to the Conversation Agent system prompt when `sfw_disabled = false`.
- **Image:** positive suffix + negative keywords applied by the Image Engine before dispatch. If still NSFW after filtering → block.
- **Disabling SFW does NOT add "be explicit".** It only removes the guardrail block and the NSFW negative keywords.

---

## 8. Open gaps (see [open-questions.md](open-questions.md) for the full list)

- **AuthorsNote scope** — v0 commits to per-Conversation only. Global and Character-scoped notes are silently deferred (medium-impact; logged).
- **MemoryDocument branching behavior** — v0 commits to "branch starts empty" by default. Alternative: copy the parent's docs.
- **Character-edit re-validation** — creator wants a hands-on pass on PersonaLLM to confirm whether the snapshot default matches the observed behavior.
- **ConversationBranch encoding** — separate table vs fields on `Conversation`; [schema.md](schema.md) captures this.

---

## Cross-references

- [creator-vision.md](creator-vision.md) §2 (hierarchy), §3 (memory architecture), §5.2 (chat behavior), §7 (agents), §8 (principles), §9 (divergences).
- [user-stories.md](user-stories.md) §5 (per-story entity map), §6 (F1–F7), §9 (entity ↔ story matrix), §10 (open items).
- [PersonaLLM-Reference/03-data-model.md](PersonaLLM-Reference/03-data-model.md) — observed PersonaLLM field sets, for fields v0 inherits.
- [PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md) — the 11-position assembly, which constrains how these entities feed the prompt.
- [schema.md](schema.md) — concrete storage shape backing this domain model.
- [architecture.md](architecture.md) — how agent boundaries and isolation invariants are enforced.
