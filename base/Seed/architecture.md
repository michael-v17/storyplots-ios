# Architecture — StoryPlots v0

> **Authority:** sixth in precedence. Conflicts with [creator-vision.md](creator-vision.md), [product.md](product.md), [user-stories.md](user-stories.md), or [domain.md](domain.md) are resolved in their favor and recorded in [open-questions.md](open-questions.md).
>
> **Source consolidation:** this file consolidates [creator-vision.md](creator-vision.md) §3, §6, §7, §11 with [../References/GeneralDocuments/stack-decisions.md](../References/GeneralDocuments/stack-decisions.md). The ADR in `stack-decisions.md` has the full rationale and cost analysis; this file holds the v0-binding decisions only.

---

## 1. Stack at a glance

| Layer | Choice | Host / notes |
|---|---|---|
| Frontend web | **React + Vite** (SPA) | Cloudflare Pages — free, unlimited sites |
| Backend API | **Python + FastAPI + LangGraph** | Hetzner CX22 + Coolify (~$5/mo) **or** Railway Hobby ($5/mo). Final host pick is an [open question](open-questions.md). |
| Data + Auth + Storage + Vector | **Supabase** (Postgres + pgvector + Auth + Storage + RLS + Edge Functions) | Free tier covers v0 validation; Pro $25/mo at scale |
| LLM | **BYOK** — user's own API keys | $0 for the builder; keys encrypted in `User.byok_keys` |
| Streaming | **SSE** (Server-Sent Events) | From FastAPI `/chat`; portable to Flutter via `http` package |
| LangGraph persistence | `langgraph-checkpoint-postgres` | Stored in the **same** Supabase Postgres; acts as a cache |
| Notifications | Web Push API + Supabase Edge Function | Not in v0 scope but stack-compatible for later |
| Landing / marketing | Separate Cloudflare Pages project (if ever needed) | Deliberately not mixed with the SPA |

**Rationale (one line each, full version in [../References/GeneralDocuments/stack-decisions.md](../References/GeneralDocuments/stack-decisions.md)):**

- **Why not Next.js:** post-login app, no SEO benefit; Server Actions / RSC push patterns that break symmetry with a future Flutter client. React + Vite keeps all clients as symmetric API consumers.
- **Why Python (not LangGraph.js):** multi-agent ecosystem maturity, checkpointer variety, centralized "brain" lets web / Flutter / local-mode clients stay thin.
- **Why Supabase:** collapses Auth + Postgres + pgvector + Storage into one service; JWT works uniformly across web, FastAPI, and future Flutter SDK; RLS replaces hand-written authorization.
- **Why SSE:** simpler than WebSocket, portable, browser-native; chat is request/response and doesn't need bidirectional.
- **Why BYOK:** zero inference cost for the builder; users choose their own model.

---

## 2. System overview

```
┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│  React + Vite (Web SPA)  │   │  Flutter iOS/Android     │   │  Local on-device client  │
│  Cloudflare Pages        │   │  (future, not v0)        │   │  (future, not v0)        │
└──────┬───────────────────┘   └──────┬───────────────────┘   └──────┬───────────────────┘
       │                              │                              │
       │  Supabase SDK (auth, CRUD, Storage, pgvector via RLS)       │
       │  ───────────────────────────────────────────────────────────┼──────────┐
       │                                                             │          │
       │  FastAPI REST + SSE (chat flow, multi-agent)                │          │
       │  ───────────────────────────────────────────────────────────┘          │
       ▼                                                                        ▼
┌──────────────────────────────────────────────────┐      ┌──────────────────────────────┐
│  FastAPI (Python) + LangGraph                    │      │  Supabase                    │
│  ──────────────────────────────────────────────  │◀────▶│  Postgres + pgvector         │
│  • Conversation Agent (LangGraph node)            │      │  Auth (JWT)                  │
│  • Grammar Agent (LangGraph node)                 │      │  Storage                     │
│  • Reinforcement Validator (local / non-LLM)      │      │  RLS (per-user isolation)    │
│    — also runs in the React client                │      │  Edge Functions              │
│  • Insights Job (async)                           │      │  `langgraph-checkpoint-...`  │
│  • SFW guardrail injection                        │      │    table (LangGraph cache)   │
└──────────────────────────────────────────────────┘      └──────────────────────────────┘
       │
       │  per-request BYOK keys (decrypted in memory only)
       ▼
┌──────────────────────────────────────────────────┐
│  BYOK LLM / media providers                      │
│  OpenRouter (primary), OpenAI, Google, Gemini,   │
│  ElevenLabs, OpenAI TTS, WebSpeech,              │
│  user-hosted ComfyUI (URL+port), etc.            │
└──────────────────────────────────────────────────┘
```

All clients + backend share **one** Supabase Postgres (source of truth) and **one** JWT format.

---

## 3. Frontend responsibilities (React + Vite)

- **SPA routing** — every screen gets a stable deep-linkable URL. Route map in [ux.md](ux.md) §Sitemap.
- **CRUD reads** — via Supabase SDK directly against RLS-protected tables: Conversations list, Characters, message history, Settings, `GrammarAggregate`, `GrammarCorrection` for the sidebar and Dashboard.
- **Chat dispatch + streaming** — POSTs to FastAPI `/chat`, consumes the SSE stream, renders tokens with the user's Typing Speed setting; batches updates to an `aria-live="polite"` region for screen readers.
- **Markdown-light rendering** — italic `*…*` → narration, plain quoted `"…"` → dialogue (story 24). Load-bearing for readability AND for dual-voice TTS routing (story 49).
- **Reinforcement Validator (local, non-LLM)** — TypeScript comparator that normalizes (whitespace / punctuation / case) and computes edit distance against the ≥95% similarity threshold. No LLM call. Runs on the client to keep the rewrite-gate fast and free.
- **Typography → TTS routing** — the same segmentation that renders italics / plain drives dual-voice playback: narration spans → narrator voice; dialogue spans → character voice.
- **BYOK key entry flows** — encrypt-on-save via the backend (the encryption key is server-owned, not user-derived); inline Cloud AI Consent is shown on first key entry.
- **Client state** — scoped per-`User`; no cross-user cache keys; logout clears local caches.
- **Error UX** — BYOK not configured → CTA inline; provider test-connection failures visible immediately; NSFW-image block shows a brief notice; Reinforcement 3-strike fall-through is user-visible.
- **Three breakpoints** — S (≤ 640 px), M (641–1024 px), L (≥ 1025 px). Sidebar collapses, right inspector panel appears on L. See [PersonaLLM-Reference/11-web-adaptation-notes.md](PersonaLLM-Reference/11-web-adaptation-notes.md) and [design.md](design.md).

**What the frontend does NOT do:**

- Does NOT implement the multi-agent orchestration logic.
- Does NOT hold raw BYOK keys in local storage in plain text; keys are fetched per session, decrypted server-side and returned to the client only when the client is the caller (e.g., STT via browser API).
- Does NOT run the Grammar Agent or Conversation Agent directly against providers; those go through FastAPI.
- Does NOT replicate the chat flow for a "client-side-only" mode in v0. Local on-device mode is a future path and out of v0 scope.

---

## 4. Backend responsibilities (FastAPI + LangGraph, Python)

FastAPI stays **thin**: its job is to authenticate the request, invoke the LangGraph chat flow, and stream results back.

### 4.1 Endpoints (v0 surface)

- `POST /chat` — SSE stream of the Conversation Agent's response to a user message. Triggers Grammar Agent in parallel (out-of-band). Input: `{ conversation_id, user_message_text, byok_hint? }`. Headers: Supabase JWT.
- `POST /grammar/correct` (optional, internal) — if the Grammar Agent is ever called standalone (e.g., for edits). May be collapsed into `/chat` semantics; [open-questions.md](open-questions.md) logs the call.
- `POST /insights/run` (internal, triggered by the app when `dirty` fires) — runs the Insights Job for the current User. Can also be triggered by a scheduled Edge Function.
- `POST /providers/test` — test-connection for BYOK providers.
- All endpoints validate the Supabase JWT against Supabase's public key. No custom token emission.

### 4.2 LangGraph orchestration

LangGraph (Python) owns the multi-agent flow. Two agent nodes in v0:

- **Conversation Agent** — produces the NPC reply.
- **Grammar Agent** — produces the correction, explanation (Mode B), and error categorization for the user's current message.

Both run on BYOK models selected independently, but **share the user's Text Engine BYOK key / endpoint** (confirmed by creator):

- Conversation Agent model: Settings → **Text Engine** (PersonaLLM-style).
- Grammar Agent model: Settings → **Grammar** (Basic / Advanced tier + free-text custom model override) — the tier / override selects a **model ID only**; the provider + key come from the active Text Engine `provider_configs` row. OpenRouter as v0 primary makes this natural: one account, multiple models.
- Consequence: there is **no separate Grammar Provider configuration surface** and no separate row in `provider_configs` for grammar. If the user has no active Text Engine provider, the Grammar Master toggle is disabled with an inline CTA to Settings → Text Engine.

**Execution order on a user-Message turn with grammar enabled (default, no Reinforcement):**

1. User `POST /chat`.
2. FastAPI validates JWT, loads the Conversation snapshot + retrieval context from Supabase.
3. LangGraph kicks off the Conversation Agent node (SSE back to client starts streaming tokens as soon as the model emits them).
4. In parallel, LangGraph kicks off the Grammar Agent node on the user's raw text.
5. Grammar Agent writes a `GrammarCorrection` row, increments the `GrammarAggregate.new_messages_since_last_run` counter, and marks `GrammarAggregate.dirty = true`.
6. Reinforcement Mode is OFF, so the Conversation Agent's stream completes regardless of Grammar Agent outcome.

**Execution order with Reinforcement Mode on:**

1. User `POST /chat`.
2. Grammar Agent runs first (user-message text only).
3. If the Grammar Agent returns "already correct" → Conversation Agent runs immediately; SSE streams NPC reply.
4. If the Grammar Agent returns a correction → FastAPI streams a rewrite-prompt SSE event; the client swaps the input for the rewrite gate. No NPC call yet.
5. The client runs the Reinforcement Validator locally (≥95% normalized similarity).
6. On pass → client re-POSTs the rewrite text → Conversation Agent runs.
7. On 3 failed attempts → client POSTs with a "reinforcement-exhausted" flag → Conversation Agent runs anyway → `GrammarCorrection.reinforcement_failures_count` is incremented.

### 4.3 SFW guardrail injection

- When `User.sfw_disabled = false`, FastAPI prepends the **system-owned SFW guardrail block** to the Conversation Agent's system prompt, alongside the Character card and the rest of the 11-position assembly.
- The guardrail text is a **system asset**. Not exposed in Settings. Not exposed in the Prompt Editor. Editable = trivial bypass.
- When `User.sfw_disabled = true`, the guardrail block is **not added**. No pro-NSFW instruction replaces it.

### 4.4 Checkpointer

- `langgraph-checkpoint-postgres` persists LangGraph graph state into the same Supabase Postgres.
- **The checkpointer is a cache, not a source of truth.** Supabase application tables (`conversations`, `messages`, `lorebook_entries`, `grammar_corrections`, etc.) remain the source of truth. Any client reading Supabase directly can reconstruct conversation history without replaying the graph.

### 4.5 Insights Job

- Async Python job, triggered by:
  - Every **10 new user messages** (via `GrammarAggregate.new_messages_since_last_run` counter).
  - Home load when `GrammarAggregate.dirty = true` (async refresh; never blocks Home).
- Aggregates over `GrammarCorrection` rows for the User and updates `GrammarAggregate` with: detected level, top errors, filler words, overused words, connector stats, AI narrative feedback, improvement suggestions, reinforcement performance %.
- **Single LLM call** on **aggregated stats**, not raw `original_text` / `corrected_text` strings. This keeps cost predictable and prevents message content from leaking into the insights layer.
- Clears `dirty` and resets the counter on completion.

### 4.6 Reinforcement Validator implementation guidance

- **Local, non-LLM.** Default implementation lives in the React client (TypeScript) — this is what v0 ships.
- A FastAPI Python implementation is an **acceptable alternative** and would behave identically; both paths must share the normalization rules and threshold.
- **Normalization:** strip trailing/leading whitespace, collapse internal whitespace to single spaces, lowercase, remove extraneous punctuation (periods, commas, exclamation marks, quotation marks — but preserve apostrophes that carry contraction meaning).
- **Comparison:** normalized Levenshtein edit distance; pass if similarity ≥ 95%.
- **Lenient** on trivial differences (a missing comma, an extra space, minor punctuation / capitalization).
- **Strict** on real content (wrong tense, missing article, wrong preposition, word order).
- **3-strike cap** tracked on the client; the client reports the outcome to FastAPI when re-POSTing.
- **Concrete Levenshtein budget** below the 95% threshold is still TBD — [open-questions.md](open-questions.md).

---

## 5. Agents — contracts

Each agent is a LangGraph node with a rigid input / forbidden-input / output shape. Violations are defects.

### 5.1 Conversation Agent

- **Inputs:** the 11-position assembly from [PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md):
  1. Writing Style (snapshot)
  2. Character Prompt (from `Conversation.character_snapshot`)
  3. Scenario (from `Character.scenario`, if any — appended to Character card block)
  4. User Persona (if any)
  5. Character Descriptions (Roleplay) / Expertise (Assistant)
  6. Knowledge Base / Lore (retrieved)
  7. RAG Memories (retrieved)
  8. Rolling Summary
  9. Visual Roleplay
  10. Context Summary / parent-branch summary
  11. Suggested Replies template (when the pill is tapped)
  - PLUS: message history (with Author's Notes injected at configured depth — the 12th touchpoint).
  - PLUS: SFW guardrail block (when `sfw_disabled = false`).
  - PLUS: the current user message.
- **Forbidden inputs:** `GrammarCorrection`, `GrammarAggregate`, Grammar Agent output, any grammar-derived feature.
- **Model:** user's BYOK model from Settings → Text Engine.
- **Output:** streaming text (SSE).
- **Other disciplines:**
  - **Plain-text completion.** No hard dependency on JSON mode / function calling — this path is earmarked for a future iOS local on-device mode where small models often fail structured outputs. Structured outputs are allowed **everywhere else** ([creator-vision.md](creator-vision.md) §7 discipline 7).
  - **Vendor-agnostic prompts.** Work across OpenRouter models (GPT-4-class, Claude, Gemini). Do NOT hard-depend on a specific vendor's proprietary tool schema.
  - **Context window:** PersonaLLM default (32k) and the user's Text Engine setting. The 4–8k ceiling is a future local-mode discipline only; not applied in v0.

### 5.2 Grammar Agent

- **Inputs:** the user's **raw current message text only**.
- **Forbidden inputs:** Character, UserPersona, Lorebook, Memory, Author's Notes, Rolling Summary, Writing Style, Bubble Colors, the NPC's reply, assistant messages, prior Messages of any role. Nothing character-side.
- **Model:** user's BYOK model from Settings → Grammar (Basic default / Advanced; free-text custom override).
- **Output (single-pass, one LLM call):**
  - `corrected_text` — American English correction (or "already correct" signal).
  - `explanation?` — short plain-English explanation, when Mode B is active.
  - `error_categories[]` — verb tense, articles, prepositions, word order, filler words, etc.
  - Signals for aggregates: filler words detected, overused words, connector usage.
- **Side effects:** writes one `GrammarCorrection` row; increments `GrammarAggregate.new_messages_since_last_run`; marks `GrammarAggregate.dirty = true`.
- **Never runs on:** assistant Messages; Autopilot-generated user Messages; suggested-reply chips that were never sent.
- **Structured outputs / JSON mode:** permitted here.
- **Spanish / Spanglish handling:** shows "what should have been written in English" — translation-aware corrector, not a "wrong language" rejecter. The Basic tier's ability to handle this well is a real tuning question; a soft upgrade hint surfaces when the Grammar Agent detects frequent non-English input over a recent window (story 42). Detection window is a minor open question.
- **Re-correction rule:** a given user Message produces at most one `GrammarCorrection` row for its current text. Edit creates a new logical message (per §5.3).

### 5.3 Reinforcement Validator

- **Kind:** non-LLM string comparator.
- **Location:** React client (TypeScript) by default; FastAPI Python is an acceptable alternative.
- **Input:** `corrected_text` + user's rewrite text.
- **Threshold:** ≥ 95% similarity after normalization.
- **Cap:** hard 3-strike cap — after 3 failed rewrites the flow continues.
- **Output:** pass / fail / exhausted.

### 5.4 Insights Job

- **Kind:** async Python job.
- **Trigger:** every 10 new user messages OR Home load when `dirty = true`.
- **Input:** **aggregated stats** from `GrammarCorrection` rows for the User — NOT raw `original_text` / `corrected_text`.
- **Output:** updates to `GrammarAggregate` (level, top errors, filler words, overused words, connector stats, AI narrative feedback, improvement suggestions, reinforcement performance %). Clears `dirty`.
- **Never blocks:** Home or Dashboard rendering.
- **Structured outputs / JSON mode:** permitted.

---

## 6. Data layer (Supabase)

### 6.1 Tables, schema, RLS

Full catalog lives in [schema.md](schema.md). Rules that bind the architecture:

- **One row per `User`**, including anonymous users (Supabase anonymous sign-in creates a real row + JWT).
- **Per-user RLS** on every table that holds user-scoped data. The policy is uniformly `where user_id = auth.uid()` for top-level tables; join tables inherit via their parent.
- **BYOK keys are encrypted at rest** in `User.byok_keys`. Decryption happens in backend memory only, per request.
- **pgvector** stores `MemoryDocument.chunks` embeddings; retrieval runs in Postgres via `ORDER BY embedding <-> query_embedding LIMIT k`.

### 6.2 Source-of-truth guarantee

Supabase Postgres application tables are the **source of truth** for Conversation state. The `langgraph-checkpoint-postgres` table is a **cache**. Any client (web today, Flutter tomorrow, local-mode client eventually) can reconstruct conversation history by reading `conversations` + `messages` + `message_variants` + `lorebook_entries` + `memory_documents` + `authors_notes` + `grammar_corrections` + `grammar_aggregates` alone.

This is a **data-layer guarantee**, not a "chat flow must also run client-side" requirement. v0's chat flow runs server-side via LangGraph — that is the normal implementation. Replayability is a property of the data layer.

### 6.3 Migrations

- Managed via **`supabase db push`**.
- Schema parity between local, dev, and prod is mandatory.
- A seed / fixture script populates a fresh local DB with a demo User, Character, and Conversation so the app is immediately usable after clone.

---

## 7. Authentication

- **Supabase Auth (JWT).** FastAPI validates each request's JWT against Supabase's public key; it never emits custom tokens.
- **Providers in v0:**
  - Email + password (and/or magic link).
  - Google OAuth.
  - GitHub OAuth.
  - Supabase anonymous sign-in for guest mode.
- **Dropped:** Apple SignIn, Microsoft, any biometric App Lock.
- **Anonymous → authenticated upgrade** preserves all owned rows — no migration step (Supabase links the existing `User` to the new auth identity).
- **Email verification is NON-blocking.** Users can sign in and use the app immediately after signup, whether or not they've clicked the verification link. Verification is effectively enforced by password-reset flows (story 4 round-3B commit).
- **Anonymous retention:** ~90 days of inactivity before pruning (inferred default, [creator-vision.md](creator-vision.md) §6).
- **Session model:** server-side sessions (Supabase-managed JWT). The client holds the refreshable token; idle timeout logs the user out.

---

## 8. Streaming contract

- **SSE** (Server-Sent Events) from FastAPI `/chat`.
- **Why not WebSocket:** chat is request/response, not bidirectional; SSE is simpler, browser-native, and portable to Flutter via its `http` package.
- **Event types** (v0 surface):
  - `token` — streamed text chunk from the Conversation Agent.
  - `done` — Conversation Agent finished; includes final message ID.
  - `rewrite_required` — used in Reinforcement Mode; carries the `corrected_text` payload so the client can populate the rewrite gate without another round-trip.
  - `error` — provider error, invalid key, rate limit, etc. Surfaced inline in Debug Mode with full detail.
- **Typing Speed** is a client-side reveal animation on top of the stream; `prefers-reduced-motion` disables it.

---

## 9. Design disciplines (binding for v0)

From [creator-vision.md](creator-vision.md) §7 and [../References/GeneralDocuments/stack-decisions.md](../References/GeneralDocuments/stack-decisions.md) §9. Any code that breaks one of these is a defect:

1. **Supabase Postgres is the source of truth for Conversation state.** Checkpointers are caches.
2. **Prompts are vendor-agnostic** across OpenRouter / OpenAI / Google / Claude / Gemini, but **not deliberately small-local-model-compatible**. v0 targets good cloud BYOK models; future local mode swaps in via an `LLMProvider` abstraction on its own timeline.
3. **Standard message interface `{role, content, metadata}`** — clean portability baseline.
4. **Auth = Supabase JWT only.** FastAPI validates against Supabase's public key. No custom tokens.
5. **Conversation state is replayable by any client** reading Supabase. This is a data-layer guarantee, not a code-path duplication requirement.
6. **Context window in v0 = PersonaLLM default (32k) + the user's Text Engine setting.** The 4–8k ceiling is for the future iOS local on-device mode only.
7. **JSON function calling / structured outputs are fine everywhere EXCEPT the Conversation Agent reply path.** The reply path stays plain-text completion for future local-mode compatibility.
8. **SSE streaming, not WebSocket.**

---

## 10. Local development

v0 must be fully runnable locally before any deploy. Two supported modes:

- **Recommended default:** local React+Vite + local FastAPI on `localhost`, both connecting to a **hosted Supabase dev project** (free tier — separate from the prod project). Same SDK, same SQL, zero schema drift.
- **Fully offline:** `supabase start` via the Supabase CLI runs a local Supabase stack in Docker at `http://localhost:54321`. FastAPI and Vite still run locally; everything points at the local Supabase instance.

Rules:

- Single env-var set: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Switching local ↔ dev ↔ prod is one env-var change.
- Migrations via `supabase db push`.
- BYOK keys live in `.env.local` for development; never committed.
- A seed script populates a demo User + Character + Conversation so the app works immediately.

---

## 11. Infrastructure assumptions

- **Frontend host:** Cloudflare Pages, free tier, unlimited projects. SPA build artifacts served from CDN.
- **Backend host:** Hetzner CX22 (~$5/mo) + Coolify (self-hosted deploy orchestrator), OR Railway Hobby ($5/mo). Final pick deferred ([open-questions.md](open-questions.md)).
- **DB / Auth / Storage / Vector / Edge Functions:** Supabase free tier for v0 validation.
- **Domain:** registrar (Porkbun / Namecheap) — ~$10–15/year.
- **No centralized LLM billing.** BYOK means the builder's variable cost for LLM is $0; only infra floor costs apply (~$5–10/mo end-to-end in v0).
- **SSL, rate-limiting, basic WAF** — rely on the host's defaults (Cloudflare Pages in front; Coolify / Railway's built-in).

---

## 12. Multi-client architecture (preview for forward compatibility)

v0 ships only the React web client. The architecture above keeps the path open to:

- **Flutter mobile (iOS + Android)** — consumes the same FastAPI + Supabase surface. `supabase_flutter` is the official SDK. Same JWT, same RLS, same SSE (`http` package).
- **iOS local on-device mode** — future; add an `LLMProvider` abstraction in the client so cloud and local providers swap behind one interface. The Conversation Agent reply path has been constrained (discipline 7) specifically to keep this path open. Multi-agent flows stay cloud-only.
- **Multiple apps from the same builder** — Hetzner + Coolify (or Cloud Run) let new apps share infra at near-zero marginal cost.

None of these are v0 requirements. They are explicitly **forward-compatibility considerations** that shape v0's disciplines — not scope to implement.

---

## 13. Undecided technical areas

Consolidated in [open-questions.md](open-questions.md). Highlights that affect the architecture:

- **Final backend host:** Hetzner + Coolify vs Railway Hobby.
- **Concrete model picks** for Grammar Agent Basic and Advanced tiers (after a small benchmark).
- **Concrete Levenshtein budget** under the 95% similarity threshold.
- **Spanish/Spanglish upgrade-hint detection window** — recent-message window size + frequency threshold.
- **Conversation Agent SSE event taxonomy** — the list in §8 is a minimum; additional event types may emerge during implementation.
- **Character-edit retroactive semantics** — committed default is "snapshot at creation; edits do not retroact"; residual re-validation against observed PersonaLLM behavior is pending.
- **`AuthorsNote` scope** — v0 commits to per-Conversation only; global and Character scopes deferred to post-v0.

---

## Cross-references

- [creator-vision.md](creator-vision.md) §3 (memory), §6 (auth, SFW), §7 (agents, streaming, disciplines), §11 (stack).
- [../References/GeneralDocuments/stack-decisions.md](../References/GeneralDocuments/stack-decisions.md) — full ADR with cost analysis and host comparison.
- [product.md](product.md) §9 (constraints), §10 (safety model summary).
- [domain.md](domain.md) §7 (boundary and visibility model).
- [schema.md](schema.md) — concrete storage that backs this architecture.
- [user-stories.md](user-stories.md) §6 F3 (isolation invariant) and F1–F7 more broadly.
- [PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md) for the 11-position assembly.
