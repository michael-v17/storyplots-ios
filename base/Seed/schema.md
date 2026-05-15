# Schema — StoryPlots v0

> **Authority:** seventh in precedence. Field names here are canonical for the v0 build. Types and SQL-level detail are **sketches**: downstream implementers pick concrete Postgres types within the ranges suggested below. Conflicts with [creator-vision.md](creator-vision.md), [product.md](product.md), [user-stories.md](user-stories.md), [domain.md](domain.md), or [architecture.md](architecture.md) are resolved in their favor and recorded in [open-questions.md](open-questions.md).
>
> This file is **NOT** DDL. No `CREATE TABLE`, no migrations. Structural data truth only, per [../greenfield_seed_instructions.md](../greenfield_seed_instructions.md) §7.

---

## 1. High-level ERD

```
                                auth.users  (Supabase-managed)
                                    │  1:1
                                    ▼
                                 users
                   ┌────────────────┼──────────────────────────────────┐
                   │                │                                  │
            user_personas       characters                     provider_configs
                                    │                                  │
                                    ▼ 1:N                               │
                              conversations  ◀─────(branch_parent)─────┤
                                    │                                  │
        ┌───────────────┬───────────┼──────────────┬──────────────────┤
        ▼               ▼           ▼              ▼                  ▼
    messages      lorebook_    memory_       authors_notes     conversation_branches
        │         entries      documents                       (optional — may be
        ▼                                                       fields on conversations)
    message_variants                           autopilot_runs
        │                                      chat_controls_state
        ▼                                      rolling_summaries
    inline_media ───┐
                    ▼
            generated_images  (per-User, filterable by Character)

    grammar_corrections ───▶ messages (user_message_id) + conversations (conversation_id)
    grammar_aggregates  ───▶ users (one row per User; cache)
```

All user-scoped tables have a `user_id` column and enforce RLS as `where user_id = auth.uid()`.

---

## 2. Table sketches

For each table: **purpose**, **fields** (name, conceptual type, nullability, notes), **uniqueness / indexes**, **FK behavior**, **scoping & RLS**, **open questions**.

### 2.1 `users`

Wraps Supabase's `auth.users` with app-specific columns.

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | no | `= auth.users.id`; PK |
| `auth_method` | enum(`email`, `google`, `github`, `anonymous`) | no | Anonymous = Supabase anonymous sign-in |
| `display_name` | text | yes | Editable in Settings |
| `email` | text | yes | Mirrored from Supabase Auth |
| `email_verified_at` | timestamptz | yes | Non-blocking; populated when the user clicks the verification link |
| `sfw_disabled` | bool | no (default `false`) | Requires `auth_method != 'anonymous'` |
| `byok_keys` | bytea (encrypted blob) OR jsonb with per-field encryption | no (default empty) | Envelope-encrypted at rest |
| `preferences` | jsonb | no (default `{}`) | Grammar master/inline/sidebar/reinforcement toggles, sidebar persistence, typing speed, suggested replies default, bubble theme, TTS mode, etc. Full key list in §4 |
| `prompt_assembly` | jsonb | no (default system defaults) | User overrides of the 11-position prompt templates |
| `created_at` | timestamptz | no | default `now()` |
| `last_active_at` | timestamptz | no | updated on session activity; drives anonymous pruning |

**Uniqueness / indexes:** `id` PK; `email` unique where non-null.
**RLS:** `where id = auth.uid()` on select/update/delete. Insert handled by Supabase Auth hooks.
**Cascade on delete:** everything owned by this `User` across all tables.
**Open questions:** exact encryption envelope scheme for `byok_keys` (per-user data key vs. single app-level key).

---

### 2.2 `user_personas`

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `user_id` | uuid | no | FK → `users.id` |
| `photo_ref` | text | yes | Storage path |
| `name` | text | no | "What should characters call you?" |
| `gender` | text | yes | Observed Male/Female in PersonaLLM; exact enum set is an open question ([PersonaLLM-Reference/99-open-questions.md](PersonaLLM-Reference/99-open-questions.md)) |
| `appearance` | jsonb | yes | `{ skin, eyes, hair, extras }` |
| `background_story` | text | yes | "About You" in PersonaLLM |
| `is_default` | bool | no (default `true`) | v0 allows 0..1 per User per [creator-vision.md](creator-vision.md) §2; if that relaxes later, exactly one `is_default=true` per user |
| `created_at` / `updated_at` | timestamptz | no | |

**Uniqueness:** (`user_id`) unique in v0 (one UserPersona per user). See [open-questions.md](open-questions.md) if the cardinality relaxes.
**RLS:** `where user_id = auth.uid()`.
**Cascade:** deleted with `User`.

---

### 2.3 `characters`

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `user_id` | uuid | no | Owner; FK → `users.id` |
| `name` | text | no | |
| `tagline` | text | yes | |
| `system_prompt` | text | no | ≤ 2000 chars soft-warning, not hard-capped on web |
| `mode` | enum(`roleplay`, `assistant`) | no | **Immutable after creation** |
| `avatar_ref` | text | yes | Storage path |
| `appearance_description` | text | yes | |
| `append_appearance_to_image_prompts` | bool | no (default `true`) | |
| `accent_color` | text | no | 16 presets + custom HEX |
| `personality` | jsonb | yes | `{ core_traits, fears_insecurities, communication_style, quirks_habits }` |
| `goals` | jsonb | yes | `{ primary_goal, secret_desire, fears_to_overcome, would_sacrifice }` |
| `worldbuilding` | jsonb | yes | `{ origin_birthplace, backstory, world_setting, special_abilities }` |
| `default_writing_style_id` | uuid | yes | FK → `writing_styles.id` (see §2.18) |
| `default_persona_id` | uuid | yes | FK → `user_personas.id`; null = "None · Use app default" |
| `character_memory_enabled` | bool | no (default `true`) | |
| `tags` | text[] | yes | Free-text list in v0 |
| `scenario` | text | yes | **v0: collapsed from PersonaLLM's `Scenario[]`.** Appended to the Character card block in the 11-position assembly. Not rendered as a feed message |
| `english_style` | enum(`formal_american`, `neutral_american`, `casual_american`) | no (default `neutral_american`) | **v0 Extension.** Affects NPC speech only; never consumed by Grammar Agent |
| `expertise_areas` | text | yes | Assistant-mode only |
| `communication_style_assistant` | text | yes | Assistant-mode only |
| `rules` | text | yes | Assistant-mode only |
| `is_example` | bool | no (default `false`) | Seeded examples |
| `created_at` / `updated_at` | timestamptz | no | |

**RLS:** `where user_id = auth.uid()`.
**Cascade:** deletion cascades all `conversations` owned by this Character (and their subtrees). `grammar_aggregates` is marked `dirty`.

---

### 2.4 `conversations`

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `user_id` | uuid | no | FK → `users.id` |
| `character_id` | uuid | no | FK → `characters.id` |
| `title` | text | no | Default `"New Conversation"` |
| `character_snapshot` | jsonb | no | **Point-in-time** copy of the Character's prompt-relevant fields at Conversation creation. Never overwritten by later Character edits. Includes: `name`, `system_prompt`, `mode`, `personality`, `goals`, `worldbuilding`, `expertise_areas` (if Assistant), `communication_style_assistant`, `rules`, `english_style`, `scenario` |
| `writing_style_snapshot` | jsonb | no | Snapshotted WritingStyle preset at creation |
| `persona_id` | uuid | yes | FK → `user_personas.id`; snapshot of the persona picked at creation, or null |
| `last_message_at` | timestamptz | yes | Updated on each turn |
| `message_count` | int | no (default `0`) | |
| `branch_parent_conversation_id` | uuid | yes | FK → `conversations.id` |
| `branch_parent_message_id` | uuid | yes | FK → `messages.id` |
| `branch_mode` | enum(`keep_messages`, `summarize_fresh`) | yes | |
| `parent_branch_summary` | text | yes | Only when `branch_mode = summarize_fresh` |
| `created_at` / `updated_at` | timestamptz | no | |

**RLS:** `where user_id = auth.uid()`.
**Cascade:** deletion cascades all `messages`, `lorebook_entries`, `memory_documents`, `authors_notes`, `autopilot_runs`, `chat_controls_state`, `rolling_summaries`, `grammar_corrections`, and `conversation_branches` rows scoped to this Conversation. `grammar_aggregates` is marked `dirty`.
**Invariants:**
- `character_snapshot` is write-once at row creation.
- New rows start with an empty Lorebook (no `lorebook_entries` auto-created).

**Open question:** keep branch fields on this table (current sketch) or factor into a separate `conversation_branches` table? Both are viable; committed default is "on this table"; [open-questions.md](open-questions.md) logs the option.

---

### 2.5 `messages`

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `conversation_id` | uuid | no | FK → `conversations.id` |
| `role` | enum(`user`, `assistant`) | no | |
| `active_variant_id` | uuid | yes | FK → `message_variants.id` |
| `created_at` | timestamptz | no | |
| `edited_at` | timestamptz | yes | Set on edit-as-trim; the message's text is the new text |

**RLS:** via parent `conversations` (inherit by join in RLS policy).
**Cascade:** deletion cascades `message_variants` and `inline_media` for this Message, and (for user Messages) `grammar_corrections` where `user_message_id` matches. Edit-as-trim deletes downstream Messages and their subtrees.

---

### 2.6 `message_variants`

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `message_id` | uuid | no | FK → `messages.id` |
| `content` | text | no | Mixed italic narration + quoted dialogue |
| `model_snapshot` | text | yes | Model ID used to generate this variant |
| `generation_params_snapshot` | jsonb | yes | Temperature / max tokens / context length / etc. at time of generation |
| `created_at` | timestamptz | no | |

**Only on assistant messages.** User messages do not use variants (their text is mutated via edit-as-trim, not regeneration).
**Cascade:** with Message.
**"Continue generation"** appends text to the selected variant's `content` (default committed in [user-stories.md](user-stories.md) story 19). Alternative: a new variant per continuation — deferred to implementation preference.

---

### 2.7 `lorebook_entries`

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `conversation_id` | uuid | no | FK → `conversations.id`. **v0 scoping: per-Conversation, NOT per-Character.** |
| `user_id` | uuid | no | Denormalized for RLS convenience |
| `title` | text | no | |
| `keywords` | text[] | yes | Drives keyword-triggered retrieval at positions #6/#8 |
| `body` | text | no | |
| `source` | enum(`manual`, `auto_extracted`) | no | |
| `token_estimate` | int | no | Used for `knowledge_budget` slicing |
| `created_at` / `updated_at` | timestamptz | no | |

**RLS:** `where user_id = auth.uid()`.
**Branching:** on fork, kept-range entries are **COPIED** into the new Conversation with the new `conversation_id`.
**Cascade:** with Conversation.

---

### 2.8 `memory_documents`

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `conversation_id` | uuid | no | **Per-Conversation in v0**, mirroring Lorebook scoping |
| `user_id` | uuid | no | Denormalized |
| `title` | text | no | |
| `source_type` | enum(`upload`, `conversation_extract`) | no | |
| `created_at` | timestamptz | no | |

Chunks + embeddings live in a companion table:

`memory_document_chunks`:

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `memory_document_id` | uuid | no | FK |
| `conversation_id` | uuid | no | Denormalized for retrieval joins |
| `user_id` | uuid | no | Denormalized for RLS |
| `chunk_index` | int | no | |
| `text` | text | no | |
| `token_estimate` | int | no | |
| `embedding` | `vector(N)` | no | pgvector; `N` = the chosen embedding model's dimensionality |

**Index:** `ivfflat` or `hnsw` on `embedding` per the Supabase pgvector recommendation.
**Retrieval query:** scoped by `user_id` + `conversation_id` at the pgvector ORDER BY. Cross-conversation retrieval is never performed in v0.
**Branching default (inferred):** new Conversation starts empty (no copy). Logged as a minor decision in [open-questions.md](open-questions.md).

---

### 2.9 `authors_notes`

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `user_id` | uuid | no | |
| `conversation_id` | uuid | no | **v0 restricts scope to `conversation` only** |
| `notes_text` | text | no | |
| `injection_depth` | int | no (default `0`) | 0 = right before latest user message |
| `created_at` / `updated_at` | timestamptz | no | |

**Uniqueness:** `(conversation_id)` unique — at most one AuthorsNote per Conversation in v0.
**RLS:** `where user_id = auth.uid()`.
**Open question:** global and Character-scoped AuthorsNotes are silently deferred in v0 and logged in [open-questions.md](open-questions.md).

---

### 2.10 `autopilot_runs`

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `conversation_id` | uuid | no | |
| `user_id` | uuid | no | |
| `preset` | enum(`5`, `10`, `25`, `custom`) | no | |
| `remaining_turns` | int | no | |
| `active` | bool | no | Paused on user send or provider error |
| `started_at` / `ended_at` | timestamptz | varies | |

---

### 2.11 `chat_controls_state`

| Field | Type | Null | Notes |
|---|---|---|---|
| `conversation_id` | uuid | no | PK (1:1 with Conversation) |
| `user_id` | uuid | no | |
| `auto_images` | bool | no (default from Visual Roleplay settings) | |
| `auto_tts` | bool | no (default from TTS settings) | |
| `debug_mode` | bool | no (default `false`) | |
| `image_provider_override_id` | uuid | yes | FK → `provider_configs.id` |
| `video_provider_override_id` | uuid | yes | FK → `provider_configs.id` |

---

### 2.12 `conversation_branches` (optional encoding)

Current sketch keeps branch fields on `conversations` (§2.4). If a separate table is preferred:

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | |
| `user_id` | uuid | no | |
| `parent_conversation_id` | uuid | no | |
| `parent_message_id` | uuid | no | |
| `child_conversation_id` | uuid | no | |
| `branch_mode` | enum(`keep_messages`, `summarize_fresh`) | no | |
| `summary_text` | text | yes | |
| `created_at` | timestamptz | no | |

Either encoding is acceptable in v0. Pick one consistently.

---

### 2.13 `rolling_summaries`

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | |
| `conversation_id` | uuid | no | |
| `user_id` | uuid | no | |
| `summary_text` | text | no | |
| `summarized_through_message_id` | uuid | no | FK → `messages.id` |
| `updated_at` | timestamptz | no | |

**Uniqueness:** `(conversation_id)` — one row per Conversation.

---

### 2.14 `grammar_corrections` (v0 Extension)

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `user_message_id` | uuid | no | FK → `messages.id` (must be `role=user`) |
| `conversation_id` | uuid | no | FK → `conversations.id` |
| `user_id` | uuid | no | Denormalized for RLS + aggregate queries |
| `original_text` | text | no | Verbatim |
| `corrected_text` | text | no | Verbatim |
| `explanation` | text | yes | Present only when Mode B was active at generation time |
| `error_categories` | text[] | no | e.g. `['verb_tense', 'articles', 'prepositions', 'word_order', 'filler_words', 'overused_words']` |
| `edit_distance` | int | yes | Normalized Levenshtein distance between `original_text` and `corrected_text` |
| `reinforcement_failures_count` | int | no (default `0`) | Incremented when the user fails a rewrite attempt |
| `created_at` | timestamptz | no | |

**Uniqueness:** `(user_message_id)` unique — a user Message produces at most one correction row **for its current text**.
**RLS:** `where user_id = auth.uid()`.
**Branching:** copied to the new Conversation with a new `conversation_id` when a Conversation is forked (F6).
**Cascade:** deleted with the owning Message (edit-as-trim) or Conversation; per-Conversation "Clear grammar" action deletes all rows for the Conversation; global "Clear all grammar data" deletes all rows for the User.

---

### 2.15 `grammar_aggregates` (v0 Extension)

| Field | Type | Null | Notes |
|---|---|---|---|
| `user_id` | uuid | no | PK (1:1 with User) |
| `detected_level` | text | yes | e.g. `A1` / `A2` / `B1` / `B2` / `C1` / `C2` — exact scheme TBD |
| `top_errors` | jsonb | yes | `[{ category, count, examples? }]` |
| `filler_words` | jsonb | yes | `[{ word, count }]` |
| `overused_words` | jsonb | yes | `[{ word, count }]` |
| `connector_stats` | jsonb | yes | Distribution of connectors and linking devices |
| `ai_narrative_feedback` | text | yes | Short paragraph assessing patterns |
| `improvement_suggestions` | text | yes | Actionable recommendations |
| `reinforcement_performance_pct` | numeric | yes | Failed-attempts ratio, drawn from `grammar_corrections.reinforcement_failures_count` |
| `dirty` | bool | no (default `false`) | True when corrections landed after the last Insights run |
| `new_messages_since_last_run` | int | no (default `0`) | Counter; Insights Job fires at 10 |
| `updated_at` | timestamptz | no | |

**RLS:** `where user_id = auth.uid()`.
**Invariants:**
- Pre-computed — never aggregated live on render.
- The Insights Job updates this row from **aggregated stats**, not raw Message text.
- Global "Clear all grammar data" deletes the row (it will be re-created on the next correction).

---

### 2.16 `generated_images`

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `user_id` | uuid | no | |
| `character_id` | uuid | no | For Gallery filtering |
| `conversation_id` | uuid | yes | Where it was generated |
| `message_id` | uuid | yes | Attached Message |
| `kind` | enum(`image`, `video`) | no | |
| `prompt` | text | no | |
| `refined_prompt` | text | yes | Output of the Image Refinement step |
| `resolution_preset` | text | no | `Random` / `Square` / `Portrait` / `Landscape` / `TallPortrait` / `WideLandscape` / `UltraTall` / `UltraWide` |
| `dimensions` | jsonb | no | `{ w, h }` |
| `duration_sec` | int | yes | Video only |
| `provider_snapshot` | jsonb | yes | Provider, model, params used |
| `seed` | text | yes | |
| `parent_image_id` | uuid | yes | Video-from-image linkage |
| `storage_ref` | text | no | Supabase Storage path |
| `created_at` | timestamptz | no | |

**SFW behavior:** see [architecture.md](architecture.md) §3 / [product.md](product.md) §10. The pipeline prepends positive-suffix + negative NSFW keywords when `sfw_disabled = false`. Blocked generations do not write a row (user sees an inline notice).

---

### 2.17 `provider_configs` (BYOK)

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `user_id` | uuid | no | |
| `kind` | enum(`text`, `image`, `video`, `tts`, `stt`) | no | |
| `provider_family` | text | no | OpenRouter / OpenAI / Google / Ollama / LM Studio / KoboldCpp / llama.cpp / Text Gen WebUI / vLLM / ComfyUI / xAI / Atlas Cloud / Alibaba Cloud / ElevenLabs / WebSpeech |
| `base_url` | text | yes | User's endpoint |
| `api_key_encrypted` | bytea | yes | Encrypted at rest |
| `model_id` | text | yes | Selected model |
| `temperature` | numeric | yes | |
| `max_tokens` | int | yes | |
| `context_length` | int | yes | |
| `thinking_mode` | bool | no (default `false`) | |
| `workflow_config` | jsonb | yes | Image-only: per-style workflow upload (anime / realistic / pixel) + sampler / scheduler / steps / CFG / seed / prefix / negative |
| `last_tested_ok` | bool | yes | |
| `last_tested_at` | timestamptz | yes | |
| `is_active` | bool | no (default `false`) | Exactly one `is_active=true` per `(user_id, kind)` |
| `created_at` / `updated_at` | timestamptz | no | |

**Uniqueness:** a partial unique index on `(user_id, kind) where is_active = true`.
**RLS:** `where user_id = auth.uid()`.

---

### 2.18 `writing_styles`

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `user_id` | uuid | yes | Null for built-ins |
| `name` | text | no | Roleplay / Storybook / Texting (built-in) or custom |
| `is_built_in` | bool | no | |
| `writing_instructions` | text | no | |
| `default_authors_note` | text | yes | |
| `created_at` / `updated_at` | timestamptz | no | |

---

### 2.19 Supabase Storage buckets

- `avatars` — User / UserPersona / Character avatars.
- `character-imports` — Uploaded JSON / PNG character cards, processed then retained.
- `generated-media` — `GeneratedImage.storage_ref` targets.
- `comfyui-workflows` — Per-style workflow files uploaded via Settings → Image Engine.

Each bucket has a policy: read/write where `owner = auth.uid()` (or equivalent).

---

## 3. RLS policies (summary)

Every table listed above has a Supabase RLS policy of the form:

- **select / update / delete:** `where user_id = auth.uid()` (for tables with `user_id`) OR inherited via parent join for tables without (e.g. `messages`, `message_variants` inherit via `conversations.user_id`).
- **insert:** `where NEW.user_id = auth.uid()`.

For `messages` and `message_variants`, add an explicit subquery check: `where conversation_id in (select id from conversations where user_id = auth.uid())`.

`auth.users` is managed by Supabase Auth and is not directly modified by the app.

---

## 4. User preferences (contents of `users.preferences` jsonb)

The canonical shape, drawn from [user-stories.md](user-stories.md) and [creator-vision.md](creator-vision.md) §5.7. Defaults are committed by this seed.

```jsonc
{
  "grammar": {
    "master": false,                      // Default OFF (story 26)
    "inline_enabled": false,              // Gated by master
    "inline_mode": "A",                   // "A" = correction only, "B" = correction + explanation
    "sidebar_enabled": false,             // Gated by master
    "sidebar_frequency": "every",         // every | every_3 | every_5 | major_errors_only
    "sidebar_open": false,                // Per-User sidebar open/closed persistence
    "reinforcement_enabled": false,       // Gated by master AND inline
    "tier": "basic",                      // "basic" | "advanced"
    "custom_model_id": null,              // Free-text override; null = use tier default
    "upgrade_hint_dismissed_at": null     // Spanish/Spanglish soft upgrade hint
  },
  "chat_behavior": {
    "typing_speed": 0.6,                  // 0..1
    "suggested_replies_auto": false       // Default OFF (story 20, round-3C)
  },
  "memory": {
    "retrieval_top_k": 5,
    "similarity_threshold": 0.7,
    "recency_weight": 0.3,
    "auto_lore": { "enabled": true, "every_turns": 3 },
    "knowledge_budget": 3500,
    "active_window_reserve": 2000,
    "search_candidates": 10,
    "max_memories": 5,
    "snippet_max_tokens": 300,
    "query_context_chars": 1800,
    "lore_scan_depth": 1
  },
  "visual_roleplay": {
    "mode": "manual",                     // auto | manual
    "auto_generate_images": false,
    "default_resolution": "Square",
    "enabled_resolutions": ["Random","Square","Portrait","Landscape","TallPortrait","WideLandscape","UltraTall","UltraWide"]
  },
  "bubble_theme": "default",
  "tts": {
    "enabled": false,                     // Default OFF (story 43)
    "mode": "per_message",                // "auto" | "per_message"
    "provider": null,                     // "elevenlabs" | "openai_tts" | "webspeech" | null
    "speed": 1.0,
    "pitch": 1.0,
    "volume": 1.0
  },
  "stt": { "engine": "webspeech" },
  "security": { "cloud_consent_at": null } // Populated on first BYOK key entry
}
```

---

## 5. Scoping & isolation rules

Numbered and bold — see [domain.md](domain.md) §6 for the unified invariant list. Schema-specific restatements:

1. **Per-user RLS on every user-scoped table.** No hand-written authorization checks in application code.
2. **Anonymous users get identical RLS to authenticated users.**
3. **`lorebook_entries.conversation_id` is NOT NULL and references `conversations.id`.** There is no `character_id` column on `lorebook_entries` in v0.
4. **`memory_documents.conversation_id` is NOT NULL.** No `character_id` or `global` scope exists in v0.
5. **`grammar_corrections` has FK to `messages` via `user_message_id`** that must reference a row with `role = 'user'`. Enforce via DB trigger or CHECK subquery.
6. **`grammar_corrections` NEVER joins with `messages` in the Conversation Agent's read path.** Enforced in application code (agent context builder) — the schema does not prevent a rogue join.
7. **`conversations.character_snapshot` is write-once.** UPDATE policy must reject changes to this column except during fork carry-forward.
8. **Exactly one `provider_configs` row has `is_active = true` per `(user_id, kind)`.** Partial unique index.
9. **`authors_notes` has unique `(conversation_id)` in v0.**
10. **`users.sfw_disabled = true` requires `auth_method != 'anonymous'`.** Enforce via CHECK or trigger.

---

## 6. Cascade rules

| Deleted row | Cascades |
|---|---|
| `users` (account delete) | Every user-owned row in every table above. `auth.users` deletion handled by Supabase. |
| `characters` | `conversations` (and their subtrees). `grammar_aggregates.dirty = true`. |
| `conversations` | `messages`, `message_variants` (via messages), `inline_media` (via messages), `lorebook_entries`, `memory_documents` + `memory_document_chunks`, `authors_notes`, `autopilot_runs`, `chat_controls_state`, `rolling_summaries`, `grammar_corrections`, `conversation_branches` (either encoding). `grammar_aggregates.dirty = true`. |
| `messages` (direct delete) | `message_variants`, `inline_media` (via messages), and `grammar_corrections` where `user_message_id` matches. |
| Edit-as-trim on `messages` | All `messages` with `created_at > edited_message.created_at` in the same Conversation — plus their variants, inline media, and grammar corrections. Edited user Message gets a fresh Grammar Agent pass (a new `grammar_corrections` row replaces the deleted one). |
| Per-Conversation "Clear grammar" | All `grammar_corrections` where `conversation_id = X`. Marks `grammar_aggregates.dirty = true`. |
| Global "Clear all grammar data" | All `grammar_corrections` and the `grammar_aggregates` row for the User. |
| Fork (F6) | Copies `lorebook_entries` and `grammar_corrections` of the kept range into the new Conversation. Never mutates parent rows. |

Implement cascades via Postgres FKs with `ON DELETE CASCADE` where it is truly a cascade. Edit-as-trim and fork-copy are **application-layer** operations, not DB cascades.

---

## 7. Branching semantics — concrete data ops

**"Keep messages" at fork point M of Conversation P:**

1. Insert a new `conversations` row C with `branch_parent_conversation_id = P.id`, `branch_parent_message_id = M.id`, `branch_mode = 'keep_messages'`, `character_snapshot = P.character_snapshot` (copy of the same snapshot).
2. Copy every `message` in P with `created_at <= M.created_at` into C (new `id`s, same `role` / `content` / variants).
3. Copy every `lorebook_entry` in P that existed at or before M's `created_at` into C with the new `conversation_id`.
4. Copy every `grammar_correction` in P whose `user_message_id` references a copied Message into C with the new `conversation_id`.
5. Do NOT copy `memory_documents` (default); [open-questions.md](open-questions.md) logs the alternative.
6. Do NOT touch P.

**"Summarize & start fresh" at fork point M:**

1. Insert C as above with `branch_mode = 'summarize_fresh'` and `parent_branch_summary = <generated summary>`.
2. Do NOT copy messages / lorebook / grammar rows; C starts fresh with the summary injected at prompt position 10.

---

## 8. Checkpointer table

`langgraph_checkpoint` (name exact to match `langgraph-checkpoint-postgres`) lives in the same Supabase Postgres. It is a **cache**. Any client reading the application tables above can reconstruct Conversation state without ever reading this table.

---

## 9. Open data questions

- **`conversation_branches` encoding** — fields on `conversations` (current sketch) vs a separate table. Both are viable.
- **`memory_documents` branching behavior** — v0 committed default is "new branch starts empty". Alternative: copy. Cost/UX tradeoff.
- **`users.gender` enum** — PersonaLLM observed Male/Female only; v0 should widen (e.g., Male / Female / Non-binary / Custom). Not resolved.
- **`users.byok_keys` encryption envelope** — per-user data key vs single app-level key.
- **`messages.continue_generation` shape** — v0 default appends to the selected variant; alternative is a new variant per continuation.
- **`tags[]` on Characters** — free-text vs controlled vocabulary.
- **Retention policy for anonymous users** — 90-day inactivity default is inferred; pending confirmation.
- **Detected-level scheme** (`users.grammar_aggregates.detected_level`) — CEFR A1–C2 vs a v0-specific scheme.
- **Full set of `error_categories`** — v0 commits to the canonical list above; extensions possible.

Full list rolls into [open-questions.md](open-questions.md).

---

## Cross-references

- [domain.md](domain.md) §2 — conceptual entity catalog this schema backs.
- [architecture.md](architecture.md) §6 — how this schema is consumed via RLS and pgvector.
- [creator-vision.md](creator-vision.md) §2 (hierarchy + v0 field additions), §3 (memory), §7 (Grammar storage).
- [user-stories.md](user-stories.md) §5, §9 — entity ↔ story matrix.
- [PersonaLLM-Reference/03-data-model.md](PersonaLLM-Reference/03-data-model.md) — observed PersonaLLM field sets, where v0 inherits them.
