---
id: 0112
slug: rp-quality-audit-roadmap
status: audit
created: 2026-05-12
---

# Cycle 0112 — RP Quality Audit + Implementation Roadmap

> **This is an audit + sequencing document, not a single-cycle implementation plan.** It cross-references the principles in `extras/rp-character-design-knowledge-base.md` against the StoryPlots v0.2 implementation, identifies concrete gaps, and proposes a sequenced roadmap of follow-up cycles. Each numbered candidate gets its own `plans/NNNN-...md` when scheduled. No code changes in 0112 itself.

## Source documents

- **Reference being audited against:** `extras/rp-character-design-knowledge-base.md` (852 lines, last reviewed May 2026). Synthesizes SillyTavern/Pygmalion/Janitor AI community practice + shipped extensions + recent academic work (Liu et al. TACL 2024 "Lost in the Middle"; arXiv 2509.00482 rule-based role prompting; arXiv 2512.02445 long-context degradation; MiniMax Talkie/Xingye 20-turn cliff research; Nebula Block RP benchmarks).
- **Implementation read against:**
  - `backend/app/prompt_assembly.py` (11-position canonical assembly).
  - `backend/app/routes/chat.py` (`_load_bundle`, `_stream_npc_reply`, memory retrieval + extraction trigger).
  - `backend/app/agents/conversation.py` (`ProviderCallConfig`, `stream_completion`).
  - `backend/app/prompts/character_refine_system.txt`, `memory_extract_system.txt`, `sfw_guardrail.txt`, `visual_roleplay_instructions.txt`.
  - `supabase/migrations/0004_characters.sql` + 0011 (lorebook/notes) + 0023 (physical attrs) + 0029 (TTS) + 0031 (greeting) + 0032 (writing styles) + 0033/0034 (memory + recency) + 0035 (group).
  - `frontend/src/features/characters/CharacterForm.tsx`, `frontend/src/lib/characterRefine.ts`, `frontend/src/features/import/mapCardToDraft.ts`, `frontend/src/lib/conversations.ts`.
- **Three deep-dive explorer reports** (chat/prompt, memory, character creation) commissioned 2026-05-12. Citations below reference `file:line` from those reads.

## Top-line findings

Five gaps explain most of the "feels like an assistant, not a character" symptom:

1. **No author framing.** The persistent system scaffolding never tells the model "you are a skilled author giving voice to {{char}}." The only universal injection is the SFW guardrail. Author-framing principles only land if the user picked the `Storybook` writing-style preset (`migrations/0032_writing_styles.sql:53-56`). Doc §2 calls this the single highest-leverage improvement; we don't have it. **Impact: HIGH.**
2. **No dialogue/voice samples (Ali:Chat) anywhere.** The `characters` schema has no `dialogue_examples` column. V1/V2 imports fold `mes_example` into `system_prompt` as labeled prose, losing the `<START>` delimiter and the turn structure. The refiner never produces voice samples. There is no UI field for the creator to add them. The doc says a refusal sample is mandatory (§3.2, §10 "Character feels generic"). **Impact: HIGH.**
3. **No slow-burn / refusal scaffolding.** Nothing in the system prompt tells the agent to default-skeptical, develop attraction gradually, or resist compliments-as-bribes. SESSION_HANDOFF cycle 0081 logs that the creator had to *manually* append a `--- SAFETY: NON-ROMANTIC ROLEPLAY ---` clause to five characters' `system_prompt` to suppress romantic drift — a per-character workaround for a system-level gap. Doc §4 ships this as a standard block. **Impact: HIGH.**
4. **No cross-session continuity (T1 / T2 / session resume).** Memory is strictly per-`conversation_id`. There is no character-scoped persistent store, no relationship-canon summary, no "X days since last spoke, last session: Y" injection at re-open. Doc §9.1's "20-turn cliff" and §9.5's multi-tier architecture both apply. The schema is ready to extend (vector(1536), pgvector + ivfflat, RLS pattern established). **Impact: HIGH for returning users; LOW within a single session.**
5. **Sampler hygiene incomplete.** `ProviderCallConfig` only forwards `temperature`, `max_tokens`, `reasoning`. `top_p`, `top_k`, `min_p`, `frequency_penalty`, `presence_penalty`, `repetition_penalty`, DRY — none are passed. The doc validated defaults (temp 1.0, top_p 0.95, top_k 40, min_p 0.01, no freq/presence penalty, DRY > rep_penalty) cannot be enforced today. Provider defaults vary; OpenRouter passes through silently. **Impact: MEDIUM** (silent quality leak).

Three secondary gaps:

6. **The refiner's `goals.secret_desire` + `goals.fears_to_overcome` are romance attractors.** SESSION_HANDOFF cycle 0081 documents the creator catching this on five characters; the refiner system prompt still requires these fields in output and has no anti-romance clause (only PG-13 SFW). Per doc §3.5, the LLM-assisted creation flow should push back on romance-archetype-before-character. **Impact: MEDIUM-HIGH for character creation quality.**
7. **No periodic anti-drift Author's Note.** Infrastructure exists (`authors_notes` table, depth-injected at `prompt_assembly.py:294-301`) but is per-conversation manual. Doc §7.2's "frequency 1, depth 0" recurring style reminder — the *highest-leverage anti-drift tool* — has no default-on system version. **Impact: MEDIUM.**
8. **No validation gate on character creation.** `canSave = name.trim() && system_prompt.trim()` (CharacterForm.tsx:416). Doc §3.4 validation checklist (≥2 concrete flaws, ≥1 refusal sample, dialogue in greeting, named refusal topic) is not checked. **Impact: MEDIUM** for new-user quality; **HIGH** for the public-facing screenshot/marketing characters.

Two latent items worth flagging:

9. **`english_style` is a dead field at the prompt layer.** Snapshotted into `character_snapshot` but never read by `build_system_prompt`. Either inject it or remove it.
10. **Lorebook is keyword-only.** No semantic retrieval, no character-POV writing convention (doc §6.2). Manageable but suboptimal.

## Principle-by-principle audit

For each principle: doc reference / current state in code (with file:line) / gap severity / proposed cycle candidate. Cycle candidates are placeholders — the creator picks order & which to skip.

### 1. Sampler hygiene (doc §1.1, §10 "Character voice flattens" + "Character repeats phrases")

- **Current:** `ProviderCallConfig` (`conversation.py:24-31`) carries only `temperature`, `max_tokens`, `thinking_mode`. `stream_completion` (`conversation.py:37-51`) sends only those three keys plus `reasoning` when `thinking_mode=true`. Schema for `provider_configs` stores `temperature`, `max_tokens`, `context_length`, `thinking_mode` — no `top_p`/`top_k`/`min_p`/penalty/DRY fields.
- **Gap:** No top_p / top_k / min_p / freq_penalty / presence_penalty / DRY. Cannot enforce doc-validated defaults. Some providers will silently set `presence_penalty` or `frequency_penalty` to nonzero, distorting character voice and breaking catchphrases.
- **Cycle 0113 candidate — "Sampler hygiene":** add `top_p`, `top_k`, `min_p`, `frequency_penalty` (default 0), `presence_penalty` (default 0) columns to `provider_configs`. Add DRY fields if any major provider exposes them today (OpenRouter passes them through to compatible upstreams). Pass all configured values through `ProviderCallConfig`. Expose in `/settings/text-engine` with the doc's recommended defaults pre-populated for new users; existing users keep whatever they have, get a "Reset to RP defaults" pill (mirrors cycle 0081 Animagine reset pattern). Migrations: 1. ~80 LOC backend, ~60 LOC frontend.

### 2. Author framing (doc §2 — HIGHEST LEVERAGE)

- **Current:** No universal author-framing injection. Position 2 in `build_system_prompt` (`prompt_assembly.py:258-271`) is the raw `character_snapshot.system_prompt` with only a `# Character Prompt` markdown header — typically begins "You are X, a Y..." because the refiner writes it that way. The author frame only lands when the user picks the `Storybook` writing-style preset (`migrations/0032_writing_styles.sql:56`). Default preset for new conversations is whatever the user picks at creation; there is no project-level default that adds the frame.
- **Gap:** Doc §2 calls this the single biggest leverage point — ~150 tokens, produces measurably more consistent, less brittle behavior over long sessions, more robust to jailbreaks. SOURCES: rpfiend.com 2026, arXiv 2509.00482 "Talk Less, Call Right". Confirmed by the doc as **validated** with academic backing.
- **Cycle 0114 candidate — "Author framing scaffold":** add a new global setting `users.preferences.rp.author_framing` (default `on`). When on, inject a new **Position 0** (before SFW) block titled `# Author Framing` with the doc's recommended baseline text (or a tunable variant). Text:
  ```
  You are a skilled, imaginative author collaborating on an interactive
  story with the user. You give voice to {{char}} fully and without
  restraint, maintaining their established personality and voice across
  the narrative.

  - Never speak, act, or describe thoughts for {{user}}.
  - Stay in {{char}}'s established voice. If {{char}} would not say it,
    you do not write it.
  - Do not narrate as a generic AI assistant. Avoid markdown formatting,
    bullet lists, summaries, idealized emotional affirmation, omniscient
    knowledge of things {{char}} has no way to know, or text that
    resembles a Wikipedia entry.
  - Advance the story at a slow, natural tempo.
  - {{char}} is allowed to disagree, push back, refuse, be bored,
    or be unhappy with the user. Their default is not to please.
  ```
  Add `{{char}}` / `{{user}}` substitution at prompt-assembly time (today only `substituteCardPlaceholders` exists, and it's only called for greeting + scenario display — not system prompt). Settings UI surface in `/settings/memory` or a new `/settings/roleplay` page. ~50 LOC backend, ~80 LOC frontend, 1 migration (jsonb preference key).

### 3. PList vs labeled prose (doc §3.1)

- **Current:** Position 5 `# Character Descriptions` renders structured fields as labeled prose (`prompt_assembly.py:83-102`):
  ```
  Personality:
  - core traits: …
  - fears insecurities: …
  - …
  Goals:
  - primary goal: …
  - …
  ```
  Roughly 2-3× the tokens of an equivalent PList. The schema (`personality.core_traits`, `goals.primary_goal`, etc.) has all the data PList would need; the format is just verbose.
- **Gap:** Tokens are not the bottleneck for chat (most providers absorb the 50-150 token diff), but PList tokenizes each trait as 1-3 tokens directly anchored to the character name (`{{char}}'s personality: ...`), which the doc claims trains the model on stronger trait-name association. **MEDIUM** priority.
- **Cycle 0115 candidate — "PList rendering":** swap `_position_5` to synthesize PList format from the same JSONB fields:
  ```
  [{{char}}'s personality: <core_traits>, <quirks_habits>; {{char}}'s
  flaws: <fears_insecurities>; {{char}}'s communication style:
  <communication_style>; {{char}}'s primary goal: <primary_goal>;
  {{char}}'s fears: <fears_to_overcome>; {{char}}'s background:
  <origin_birthplace>, <backstory>; {{char}}'s appearance:
  <age>, <gender>, <hair_color> <hair_style>, <eye_color>, <build>,
  <signature_style>; {{char}}'s likes: …; {{char}}'s dislikes: …]
  ```
  Add `likes`/`dislikes` (text[] or jsonb) columns — currently absent. Optional but doc-supported. Backend-only change.
- **Open decision:** add a `flaws` column explicitly, or continue to map `fears_insecurities` → `flaws`? Doc says ≥2 concrete *flaws* (behaviors, not traits). The semantic distinction matters: "withholds her own needs", "sharp-tongued when pushed" is a flaw; "fears abandonment" is a fear. **Recommend a new `flaws text[]` column.** Bundled with cycle 0115 or split.

### 4. Ali:Chat dialogue examples (doc §3.2 — CRITICAL)

- **Current:** No column. V1/V2 import folds `mes_example` into `system_prompt` as prose (`mapCardToDraft.ts:55, 74-79`). Refiner produces no examples. UI has no field. Prompt has no `<START>` injection.
- **Gap:** **HIGH.** The doc says dialogue examples are *more reliably imitated* than declarative trait descriptions ("LLMs are pattern-matching machines. Show, don't describe.") and that ≥1 refusal example is **mandatory** — without it, the model defaults to compliance regardless of the trait list. Failure mode §10 "Character feels generic / agrees too easily" maps directly to this gap. This is the single highest-leverage character-quality improvement after author framing.
- **Cycle 0116 candidate — "Ali:Chat dialogue examples":**
  - New `characters.dialogue_examples jsonb` column. Shape: `[{user_msg: string, char_reply: string, kind: "everyday" | "refusal" | "unguarded"}, ...]` up to ~5 entries.
  - Migration: add column nullable; backfill on import: parse existing `mes_example` from imported cards' system_prompt prose back into structured form (best-effort regex on `<START>` and `{{user}}:` / `{{char}}:` delimiters).
  - CharacterForm: new fieldset "Voice samples" in Info tab. UI: each row = two textareas + a kind dropdown. Add/remove rows. Soft hint: "At least one example should show {{char}} refusing or pushing back."
  - Refiner: extend `CharacterRefineResult` with `dialogue_examples: list[DialogueExample]` field, update `character_refine_system.txt` to generate 3-5 short exchanges per the doc's spec, including 1 refusal and 1 unguarded.
  - Prompt assembly: new Position 5.5 `# Voice Samples` block, rendered as:
    ```
    <START>
    {{user}}: <user_msg>
    {{char}}: <char_reply>

    <START>
    ...
    ```
    with `{{char}}` / `{{user}}` substitution.
  - Validation: surface a warning (not blocking) on Save if no examples or no refusal example.
  ~100 LOC backend (refiner + prompt assembly), ~150 LOC frontend (form section), 1 migration.

### 5. First message / greeting quality (doc §3.3)

- **Current:** `greeting` column (`migrations/0031_character_greeting.sql`), refiner produces it, no validation rules.
- **Gap:** Doc §3.3 lists anti-patterns: all-narration-no-dialogue, sycophantic warm welcome ("I've been waiting for you!"), narrating the user's actions/feelings, backstory dump. None of these are caught today.
- **Cycle 0117 candidate — "Greeting quality nudges"**:
  - Update `character_refine_system.txt` greeting spec: must include dialogue, must not narrate `{{user}}`, must establish a starting attitude (not necessarily warm), must give user a hook to respond to. **Caveat:** SESSION_HANDOFF cycle 0081 already removed romantic-longing language from greetings as a manual per-character fix; refiner doesn't currently inject this.
  - CharacterForm soft-validation: regex/heuristic warnings — "Greeting has no dialogue (looks like all narration)"; "Greeting may narrate {{user}}'s actions (`you walk in`, `you feel`)". Non-blocking yellow banner near the field.
  ~30 LOC backend (refiner prompt diff), ~50 LOC frontend (validation function + render).

### 6. Character creation craft + 5 questions (doc §3.4)

- **Current:** CharacterForm exposes ~30 fields across three tabs. No guided flow asks the 5 questions (one-sentence concept / flaws / voice / refusal / dramatic tension). Refiner's "connectedness" rule (`character_refine_system.txt:47`) implicitly enforces internal conflict; the rest is hoped-for-from-system_prompt.
- **Gap:** A "blank form with 30 fields" produces all-positive trait lists and Wikipedia-entry characters even with a good refiner. The doc has an explicit failure mode for this (§3.4 anti-patterns).
- **Cycle 0118 candidate — "Quick Create wizard":** alternative `/character/new/quick` route. 5 questions, one at a time:
  1. One-sentence concept.
  2. What's hard/unlikable/messy about them? (≥2 examples required).
  3. Voice signature — sentence as if they just said it.
  4. What would they refuse to do, and why?
  5. Where/when do we first meet them? What are they doing?
  After answers, call refiner with the 5 answers as input + a special creation-from-quick-prompt mode. Refiner outputs the full structured character. User reviews and adjusts. Keeps the original `/character/new` for power users.
  ~200 LOC frontend (wizard component), ~30 LOC backend (refiner input mode + system prompt branch).

### 7. Validation checklist (doc §3.4 end)

- **Current:** `canSave = name && system_prompt` (CharacterForm.tsx:416). That's it.
- **Gap:** Doc lists 7 validation items, each mapping to a §10 failure mode.
- **Cycle 0119 candidate — "Soft validation gate":** non-blocking validation banner on Save attempt that surfaces failed items:
  - [ ] At least 2 concrete flaws (after cycle 0115 adds the `flaws` column).
  - [ ] At least 1 refusal voice sample (after cycle 0116).
  - [ ] Greeting includes dialogue (regex check).
  - [ ] Greeting does not narrate {{user}} (regex check).
  - [ ] Refusal-topic field non-empty (new field: "Something they refuse to do", char(160)).
  - [ ] Dramatic-tension field non-empty (new field: "Why is talking to them interesting?", char(280)).
  User can choose "Save anyway" but the warning is visible. Use yellow `StatusBanner` tone. ~40 LOC backend (new columns), ~80 LOC frontend.

### 8. LLM-assisted creation: refiner improvements (doc §3.5)

- **Current state of refiner system prompt** (`character_refine_system.txt`):
  - "Connectedness" rule (line 47): "Every character gets at least one internal conflict — public persona vs. secret desire, or a fear vs. a goal."
  - "Specificity over filler" rule (line 49).
  - Required output fields include `goals.secret_desire` and `goals.fears_to_overcome` (top-level keys in `CharacterRefineResult`).
  - SFW guardrail appended at end conditionally.
  - **No anti-romance clause.** No "push back on all-positive trait lists." No "don't fabricate backstory." No "this is not your girlfriend / boyfriend."
  - Uses the text engine (chat model), not a reasoning model.
- **Gap:** Doc §3.5 prescribes:
  - Ask the 5 §3.4 questions in order before generating (covered by cycle 0118).
  - Push back on all-positive trait lists.
  - Push back on backstory-before-personality.
  - Push back on "she's my girlfriend" framings.
  - Refuse to fabricate backstory the user didn't ask for.
  - **Use a reasoning-capable model for character creation (not the same as runtime).**
  - The SESSION_HANDOFF cycle 0081 evidence (5 characters had to be manually de-romanced) is the concrete failure case: `secret_desire` field name biases toward longing.
- **Cycle 0120 candidate — "Refiner v2 with anti-romance hardening + reasoning model"**:
  - Update `character_refine_system.txt` with explicit anti-romance clause (the wording from cycle 0081's per-character SAFETY block, lifted to system level for default characters; user can override per-character).
  - Add "Push back on all-positive trait lists" instruction — refiner can flag the input as needing more flaws and ask for them via the response (or just write balanced output).
  - Refactor `secret_desire` framing: rename to `internal_conflict` or `private_truth` (less romance-attracting), or keep field name but tighten the prompt with examples ("a private truth they don't tell others — could be regret, ambition, unfinished business; NOT a longing for connection unless the card explicitly says so").
  - Add separate refiner BYOK config: new "Character Creation Engine" provider slot (`kind='character_refiner'`), defaults to OpenRouter routing `deepseek/deepseek-v3.2` with reasoning enabled. Runtime chat keeps its own provider. ~100 LOC backend (provider plumbing), ~80 LOC frontend (settings UI).

### 9. Slow-burn block (doc §4)

- **Current:** Absent. Cycle 0081 manually appended a NON-ROMANTIC clause to 5 characters' `system_prompt`. No system-level default.
- **Gap:** Doc §4 calls this the simplest validated technique to prevent forced intimacy. Qualitative gates beat numeric meters (§11 explicitly lists "max ±1 trust per turn" as NOT validated).
- **Cycle 0121 candidate — "Slow-burn scaffold"**: new setting `users.preferences.rp.pacing` with three values:
  - `off` — no block injected (assistant mode usage, story-driven cards that need fast intimacy by design).
  - `slow_burn` (default for new roleplay characters) — inject doc §4 block at Position 1.5 (between Author Framing and Writing Style).
  - `warm` — soften "neutral / skeptical / reserved" to "warm but bounded"; keep the three conditions (trust / shared experiences / vulnerability).
  Per-character override via a new dropdown in CharacterForm Settings tab. ~30 LOC backend (block text + injection), ~30 LOC frontend (settings + form dropdown), 1 migration.

### 10. State tracking (doc §5)

- **Current:** None. No `trust` / `affection` / `desire` / `connection` / `mood`.
- **Gap:** Doc §5 frames this as optional. Inline emission is the simpler architecture; doc warns the model can fake meters (§5.4). Best practice: combine with §4 qualitative gates.
- **Cycle candidate (LOW priority, deferred):** likely not worth building until after §4 is in place and we have feedback. If we do, recommend inline emission with named-state alternative (§5.5: `stranger | acquaintance | familiar | friend | close`) over numeric meters. **Not scheduled.**

### 11. Memory extraction patterns (doc §6)

- **Current:** `memory_extract_system.txt` asks for 0-3 items per 5 topic categories (event/action/promise/fact/relationship), ≤25 words each. **No requirement to write in character POV.** Allows the prompt to be overridden per-user via `users.preferences.memory.extraction_prompt`.
- **Gap:** Doc §6.2: lorebook/memory entries written from `{{char}}`'s perspective produce more in-voice retrieval. The doc's good example: *"She told me about her brother last night. First time she's opened that door. I don't know what to do with it yet."* vs the less-good: *"User disclosed information about sibling relationship on turn 34."* Today we mostly get the latter shape.
- **Cycle 0122 candidate — "Memory extraction in character POV + significance"**:
  - Update `memory_extract_system.txt` to require `{{char}}`-POV phrasing. Examples in the prompt itself.
  - Add `significance smallint check 1..5` column to `memory_document_chunks` + extractor outputs it (default 3 for "moment", 4 for "promise/boundary", 5 for "first/turning point").
  - Add `topic enum('event','action','promise','fact','relationship','boundary')` as a real column (today it's free text on `memory_documents.title`). Boundary is new — doc §6.1, §10 "Character forgets boundaries set earlier" failure mode.
  - Retrieval RPC (`0034_memory_recency.sql`'s `memory_search`) extended to apply a topic+significance boost in the score: `score = cosine*(1-recency_weight) + recency*recency_weight + significance_bonus + topic_bonus`. Tunable weights in `users.preferences.memory`.
  - 1 migration (column adds + RPC swap), ~60 LOC backend.

### 12. Author's Note depth 0 / frequency 1 (doc §7)

- **Current:** `authors_notes` table exists. `prompt_assembly.py:294-301` injects the note as a `role:"system"` mid-history message at `injection_depth` from the end. **Per conversation, manually configured. No system-wide default note.**
- **Gap:** Doc §7.2's "frequency 1, depth 0" anti-drift style reminder is the highest-leverage anti-drift tool per the doc. Today we expose the infrastructure but ship no default. Failure mode §10 "Character voice drifts after ~20 turns" maps directly.
- **Cycle 0123 candidate — "Default style anchor"**: new global `users.preferences.rp.style_anchor` (default `on`). When on, inject (always at depth 0, every turn):
  ```
  [System note: Write one reply only. Do not speak or act for {{user}}.
  Stay in {{char}}'s established voice and pace.]
  ```
  Composable with the per-conversation Author's Note (if both, both are injected — global at depth 0, per-conversation at its own depth). Per-character override field for when the character has a custom style anchor. ~30 LOC backend, ~30 LOC frontend.

### 13. OOC brackets (doc §8)

- **Current:** Not specially handled. `((OOC: ...))` flows through as user text. Most models recognize the convention by default.
- **Gap:** **LOW.** Optional polish: a button in Composer that wraps the input in `((OOC: ... ))` and the system prompt could add one-line acknowledgment ("Treat `((OOC:...))` as out-of-character directives; act on them but do not echo them in your response."). Not scheduled unless an explicit drift report comes from users.

### 14. Cross-session multi-tier memory (doc §9.5 — HIGH for returning users)

- **Current:** Strictly per-`conversation_id`. `memory_documents` + `memory_document_chunks` both FK to conversations. The `characters.character_memory_enabled` gate is global per-character but doesn't create cross-conversation storage. No T1 / no T2.
- **Gap:** When a user opens a new conversation with an existing character (or continues an old one weeks later), the model has zero recall of prior promises, boundaries, significant moments — they live in another `conversation_id`. The doc §9.1 "20-turn cliff" research from MiniMax says this is *exactly* the regime where memory matters most.
- **Cycle 0124 candidate — "T1 character_memories"**:
  - New table `character_memories(id, user_id, character_id, topic, significance, content, source_conversation_id, created_at, embedding vector(1536))` with RLS, HNSW index on embedding, B-tree on `(user_id, character_id)`.
  - Promotion rules at extraction time (cycle 0122 dependency): if `significance >= 4` or `topic in ('promise', 'boundary', 'relationship')`, write to both T3 (per-conversation chunks) and T1 (character-scope). Optional user "pin" affordance in MemoryPanel that promotes an existing T3 chunk to T1.
  - Retrieval: parallel union — `memory_search` for T3 + new `character_memory_search` for T1, merged and reranked by score. T1 gets lower threshold + significance bonus per doc §9.10.
  - MemoryPanel UI: tabs "This conversation" / "Character memories" with separate count badges. Allow delete + pin/unpin.
  - 1 migration (~50 lines schema + RLS + RPC), ~80 LOC backend, ~60 LOC frontend.

### 15. T2 character canon (doc §9.5)

- **Current:** None.
- **Gap:** A 2-5 paragraph narrative summary "where the relationship stands" injected at the top of a returning session. Doc §9.5.
- **Cycle 0125 candidate — "T2 character_canon"**: regenerated periodically (e.g., when 5+ new T1 memories accumulate or weekly cron-like trigger). New table `character_canon(user_id, character_id, content text, generated_at, source_memory_count, primary key (user_id, character_id))`. Regeneration agent prompt: *"Read these T1 memories. Write a 3-paragraph in-character summary of the relationship's history with {{user}}, in {{char}}'s voice. Do not invent details not present in the memories."* Inject at Position 0.5 (after Author Framing, before SFW) for the *first* turn of a returning session only. ~40 LOC backend (table + RPC), ~80 LOC backend (regen agent), 1 migration. **Depends on 0124.**

### 16. Session resume pattern (doc §9.6)

- **Current:** No gap-awareness. `_load_bundle` reads the entire `messages` history ordered by `created_at` (`chat.py:126-129`) and replays it. There is no "X days have passed" injection at conversation re-open.
- **Gap:** Doc §9.6 — the recap pattern. Critical doc-noted detail: the character should NOT pick up exactly where they left off emotionally; the model needs permission to evolve the state slightly during the time gap.
- **Cycle 0126 candidate — "Session resume injection"**: on conversation open, if `last_assistant_message.created_at < now() - threshold` (default 4h, configurable), compute `humanize_elapsed` and fetch T2 canon, inject as a one-shot Position 0.7 (after Author Framing, before SFW):
  ```
  [Session context: It has been {elapsed} since {{char}} last spoke with
  {{user}}. Relationship summary: {canon || "we have spoken a few times before"}.
  {{char}} has had time to think about it, get distracted by their own life,
  possibly cooled off or escalated. They are not picking up exactly where
  they left off emotionally — they have lived intervening time.]
  ```
  Injected for the first user turn of the re-opened session only; from turn 2 onward, normal context. ~50 LOC backend, 1 small migration (preference key). **Depends on 0125 for canon; can ship a degraded version with just the elapsed time first.**

### 17. Per-message atomic summaries (doc §9.7)

- **Current:** We already extract atomic facts from each ~3-turn window. The window-of-3 is slightly coarser than the doc's per-message recommendation, but functionally the same shape: each unit is independently editable / deletable / regeneratable, no rolling summary corrupting the chain.
- **Gap:** **NONE.** We're already in the doc's recommended pattern.

### 18. Time-aware memory metadata (doc §9.8)

- **Current:** Only `created_at` and `message_count_at_creation`. No fiction-time, no significance (already covered in cycle 0122).
- **Gap:** LOW-MEDIUM. After significance is added (cycle 0122), the only missing piece is `fiction_time` ("morning after the fight", "two scenes later") — a useful but optional narrative-anchor field. Defer unless creator wants the granularity.

### 19. Hybrid retrieval — entity match fallback (doc §9.10)

- **Current:** Pure cosine + recency. No keyword/full-text fallback. The doc explicitly warns: "if a user mentions someone by name (their mother, a specific friend), semantic search may miss memories about that person if the prior wording was different. Keyword fallback for entity-anchored queries catches what cosine misses."
- **Gap:** MEDIUM. pgvector + Postgres `tsvector`/`ILIKE` would be straightforward.
- **Cycle 0127 candidate — "Hybrid retrieval"**: add `text tsvector` generated column on `memory_document_chunks` (and `character_memories` if 0124 shipped), GIN index, extend `memory_search` RPC to UNION cosine top-k with tsvector match for entity-anchored queries (heuristic: detect proper nouns in the query union, run keyword fallback). ~30 LOC migration, ~40 LOC RPC.

### 20. Model & provider defaults (doc §1)

- **Current:** Memory Engine default is OpenRouter routing `openai/text-embedding-3-small` (cycle 0050). Text Engine has no documented default in the migrations (user picks). No Character Creation Engine concept yet (would be added by cycle 0120).
- **Gap:** Doc recommends MiniMax M2 (Her) for runtime chat; DeepSeek V3.2 with reasoning for character creation. The doc also explicitly flags GPT-4o / Claude (any tier for full-spectrum) / Gemini as poor RP defaults due to sycophancy / filters / unpredictability. We don't currently steer users away from these.
- **Cycle candidate (SOFT, bundled w/ 0120):** in `/settings/text-engine` and `/settings/character-engine`, surface recommended presets with a one-click "Use RP-recommended defaults" pill that fills base_url + model + sampler defaults from cycle 0113. ~30 LOC frontend.

## Cross-cutting concerns

### a. The `english_style` dead field

`characters.english_style` (formal_american / neutral_american / casual_american) is snapshotted into `character_snapshot` but `build_system_prompt` never reads it. Either inject it into the prompt (e.g., as an additional bullet inside the new Author Framing block, or as part of the PList in cycle 0115) or remove the field. **Recommend bundle into cycle 0114 (author framing) — add a "Language register" line so the field becomes load-bearing.**

### b. Lorebook (currently keyword-only)

Position 6 `# Knowledge Base` runs case-insensitive substring matching only. The doc's §6 patterns (in-character POV writing, boundaries trump recency) and §9.10 (hybrid retrieval) apply equally to lorebook. **Recommend: defer — lorebook is per-conversation and the user can write entries thoughtfully. Revisit after T1/T2 ship.**

### c. `{{char}}` / `{{user}}` substitution

Today these placeholders are resolved **only** for greeting (at conversation creation) and scenario display (at chat render). The system prompt is sent literal. After cycle 0114 introduces author framing (which uses `{{char}}` / `{{user}}` in its template), substitution must run at prompt-assembly time. Sounds trivial but interacts with every block that mentions the character — need to confirm we don't double-substitute the greeting (which is already substituted).

### d. Group characters

`group_size > 1` characters (cycles 0079-0080) need special handling for several of these recommendations:
- Ali:Chat samples: per-member dialogue may not make sense for a group card; samples represent the *group* as a unit. **TBD.**
- Slow-burn: applies to the group's collective stance toward the user, not per-member.
- Author framing: "give voice to {{char}}" works the same — the group has a singular voice in the prose.
- Memory: T1 promotion is per-`character_id`, fine for groups.

## Recommended sequencing

Order follows doc §12 implementation order (decreasing leverage), folded into project realities:

| # | Cycle candidate | Doc § | Effort | Depends on |
|---|---|---|---|---|
| 0113 | Sampler hygiene (top_p, top_k, min_p, freq/presence) | §1 | S | — |
| 0114 | Author framing scaffold + `{{char}}`/`{{user}}` system-prompt substitution | §2 | S | — |
| 0115 | PList rendering + `flaws` column + `likes`/`dislikes` columns | §3.1, §3.4 | S | — |
| 0116 | Ali:Chat dialogue examples (column + form + refiner + injection) | §3.2 | M | — |
| 0117 | Greeting quality nudges (refiner + soft validation) | §3.3 | S | — |
| 0118 | Quick Create wizard | §3.4 | M | 0115, 0116 |
| 0119 | Soft validation gate on character Save | §3.4 | S | 0115, 0116 |
| 0120 | Refiner v2: anti-romance + reasoning model + Character Creation Engine BYOK | §3.5 | M | — |
| 0121 | Slow-burn scaffold (pacing setting + system injection) | §4 | S | 0114 |
| 0122 | Memory extraction in character POV + significance/topic columns + boost in RPC | §6, §9.8 | M | — |
| 0123 | Default style anchor (depth 0, every turn) | §7 | S | — |
| 0124 | T1 character_memories table + promotion + retrieval merge | §9.5 | L | 0122 |
| 0125 | T2 character_canon table + regeneration agent | §9.5 | M | 0124 |
| 0126 | Session resume injection | §9.6 | M | 0125 (graceful w/o canon) |
| 0127 | Hybrid retrieval (tsvector + entity-anchored fallback) | §9.10 | S | — |

**Highest leverage if forced to pick three:** 0114 (author framing), 0116 (Ali:Chat), 0123 (default style anchor). Together ~$200 LOC, addresses 4 of the 5 top-line gaps, and the doc backs each as validated.

**Highest leverage for character creation quality:** 0116 (Ali:Chat) + 0120 (refiner v2 anti-romance). Without these, every character produced by Enrich keeps drifting toward "warm helpful assistant" archetype despite §0081 manual hardening.

**Highest leverage for cross-session continuity:** 0124 (T1) + 0125 (T2) + 0126 (session resume). This is the most expensive set but addresses the §9.1 "20-turn cliff" — the regime where users actually churn.

## Open decisions for creator (block kickoff until answered)

1. **Where to land "RP preferences" settings UI?** Current `/settings` has Memory, Memory Engine, Text Engine, Image Engine, TTS, Grammar Settings, Writing Styles, Visual Roleplay, Data & Security, Prompt Editor. The new author-framing / slow-burn / style-anchor / pacing toggles would fit best in either:
   - A new `/settings/roleplay` page (clean), OR
   - Folded into the existing Writing Styles page (since writing-style is the closest existing concept), OR
   - A new section inside Memory Settings (less natural).
   Recommend a new `/settings/roleplay` page. Confirm.
2. **Per-character override depth.** The doc-validated patterns (author framing, slow-burn, style anchor) work as universal defaults. Do you want every cycle to ALSO add a per-character override field, or treat the user-global setting as authoritative (with the existing per-character `system_prompt` being the only escape hatch)? Per-character is more flexible but doubles UI surface. **Recommend: ship as user-global only first; add per-character override only if a use case demonstrably requires it.**
3. **Default-on vs default-off for slow-burn.** New users get a character that's reserved-by-default unless they pick "warm" or "off." This is a flavor change vs current behavior. **Recommend default-on** but explicit.
4. **Character Creation Engine BYOK** (cycle 0120) — extra provider config slot. Adds friction for new users who'd then need to configure two keys (chat + creation). Alternatives:
   - Reuse the Text Engine credentials but allow the user to override the *model* + `reasoning: true` flag for character creation only.
   - Ship a sensible default (`deepseek/deepseek-v3.2` via OpenRouter, reasoning enabled) that uses the user's existing OpenRouter key from Text Engine, no extra setup.
   **Recommend: reuse Text Engine credentials, expose only a `creation_model_id` override + `reasoning_enabled` toggle. Avoid asking users to manage three BYOK keys.**
5. **Backfill existing characters?** Adding `flaws`, `likes`, `dislikes`, `dialogue_examples` columns: do we run the refiner against existing characters to populate them, or leave nullable and let creators fill manually? **Recommend: leave nullable, expose a "Refresh with new fields" button in CharacterForm that calls the refiner with the existing card; users opt in per-character.**
6. **Provider recommendation language**: explicit "don't use GPT-4o for chat — it's sycophantic"? Or stay agnostic and ship presets without dissing competitors? **Recommend: neutral presets ("RP-recommended defaults") with tooltip explaining the why, no naming-and-shaming.**

## Non-goals (explicitly OUT of scope of this audit)

- Schema-breaking changes to existing migrations (we extend, never alter v0 contracts).
- The non-negotiables from `Seed/creator-vision.md` §8 are off-limits — every cycle below preserves agent isolation, SSE, edit-as-trim, per-conversation lorebook (T3), branching, snapshots, BYOK, vendor-agnostic prompts, plain-text reply path.
- Switching off the existing 11-position assembly. We add Position 0 (author framing), Position 0.5 (T2 canon on resume), Position 0.7 (session resume note), Position 1.5 (slow-burn), Position 5.5 (Ali:Chat). Existing positions and order are preserved.
- Replacing the current memory retrieval pipeline. We extend it (significance/topic boost, T1 union, hybrid tsvector fallback) — we don't rewrite it.
- State trackers / numeric meters (§5 explicitly low-priority; doc §11 lists them as not-validated as a universal rule).
- OOC bracket affordances (§8 — low-leverage polish).

## What's NOT in the doc that this audit deliberately doesn't address

- StoryPlots-specific features the knowledge base doesn't speak to: the Grammar module, Visual Roleplay (image generation tied to chat), TTS routing, English-learning framing. The doc is RP-general; our project carries those as v0-specific extensions per the seed, and they fall outside this audit.
- The egress-crisis project context (xvm_project switch, cycles 0090-0098 fal.ai migration). Independent track.

## What to do next

This document deliberately spawns no code in 0112. Action items for creator:

1. Read the **Top-line findings** and **Recommended sequencing** table; reject / reorder / drop cycles you don't want.
2. Answer the **Open decisions for creator** block — those gate the first concrete cycle.
3. Pick the first cycle to write a full `plans/0113-...md` (or whichever number) plan for and implement.

A reasonable first move is **0114 (author framing)** because (a) it's the doc's single-biggest-leverage item, (b) it's small (~150 LOC across one migration + two files), (c) it doesn't depend on any other cycle, and (d) it makes every subsequent cycle land harder (because the model is already framed correctly).

## Verification

This is an audit, not an implementation. There is nothing to verify until the spawned cycles ship. Each spawned cycle gets its own Verification section per the standard workflow.
