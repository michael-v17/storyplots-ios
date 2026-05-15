# Creator Vision — StoryPlots v0

## How to Use This Document

This document captures the **v0** creator vision for StoryPlot: the earliest, narrowest version of the product. It precedes the multi-NPC / multi-interaction vision described in [creator-vision-for-multiinteractions.md](../creator-vision-for-multiinteractions.md) and should be treated as its predecessor, not its replacement.

v0 is intentionally close to PersonaLLM, with one differentiator: a **first-class Grammar Module**. Everything else in PersonaLLM's feature surface is either kept, simplified, or explicitly cut — never silently reinvented.

### Source precedence

- **Observed PersonaLLM behavior** is sourced from [Seed/PersonaLLM-Reference/](PersonaLLM-Reference/). That reference is authoritative for UI, flows, settings, and prompts.
- **Grammar Module** behavior is lifted from [creator-vision-for-multiinteractions.md](../creator-vision-for-multiinteractions.md) §5.1, §5.3, §5.5, §5.6 — but only the single-NPC, single-conversation parts.
- **Tech stack decisions** are sourced from [References/GeneralDocuments/stack-decisions.md](../References/GeneralDocuments/stack-decisions.md) and consolidated in §11 below. That document is the authoritative ADR for the stack.
- **Inferred** decisions are labeled `(inferred)` and mirrored in `## 10. Open Questions`.
- Separation rule (from [CLAUDE.md](../CLAUDE.md)): PersonaLLM-as-observed and v0 extensions are never silently merged.

### Seed philosophy

If behavior is not explicitly defined in the seed, downstream AI will invent it incorrectly. Better slightly verbose than ambiguous. Omission is not simplification — it is an invitation for hallucinated behavior.

---

## 1. Product Identity

**Name:** StoryPlots (v0)
**Scope label:** `SingleNPCInteractionVersion`
**Tagline (inferred):** "Practice English by chatting with AI characters — one companion at a time."

StoryPlots v0 is a **web app where the user holds 1:1 chats with AI characters**, with an integrated **Grammar Module** that silently corrects, explains, aggregates, and (optionally) drills the user's English.

It is deliberately PersonaLLM-shaped. The user creates or imports a Character, optionally defines a UserPersona, and chats. Each Character supports **multiple independent Conversations** (PersonaLLM-style — see [Seed/PersonaLLM-Reference/04-screens/chat.md](PersonaLLM-Reference/04-screens/chat.md)); each Conversation is its own thread with its own memory and Lorebook. The chat experience — message variants, regenerate/edit, branching, suggested replies, Autopilot, Author's Notes, TTS, image generation — is preserved from PersonaLLM (see [Seed/PersonaLLM-Reference/01-overview.md](PersonaLLM-Reference/01-overview.md)).

On top of that, v0 adds a Grammar Module that runs **out-of-band** on the user's input: inline corrections in the chat feed, an optional side panel, an optional rewrite-gate ("Reinforcement Mode"), a Home snapshot widget, and a full **Grammar Dashboard** as a primary nav destination.

**v0 anti-goals (explicitly out of scope):**
- **No multi-NPC in a chat, no Story, no Scenarios, no Quest Plots, no Master Agent.** Those belong to v1+ ([creator-vision-for-multiinteractions.md](../creator-vision-for-multiinteractions.md)).
- **No Community.** No browse / share / rate / publish of Characters.
- **No monetization.** No Credits system, no paid tiers, no App Store surfaces. (PersonaLLM's Credits is cut — see [Seed/PersonaLLM-Reference/04-screens/menu.md](PersonaLLM-Reference/04-screens/menu.md).)
- **No local model runtimes.** No MLX, no local Kokoro in v0 — web-first with BYOK cloud providers.
- **No native iOS / Android.** Flutter mobile is acknowledged as a future path (see §11) but not v0.

---

## 2. Core Hierarchy (v0, flat)

v0 is a **flat, single-NPC-per-chat model**. No Story / Scenario / Quest / Plot layers, no multi-NPC in a chat. A Character can have **multiple Conversations** (PersonaLLM-style) — each is an independent thread with its own memory, Lorebook, and Grammar history.

```
User
  └── UserPersona (0..1, optional)
  └── Character (1..N, each = one AI companion)
       └── Conversation (1..N per Character — multiple threads like PersonaLLM)
            └── Message (user + assistant)
            │    └── MessageVariant[] (alternate assistant responses; regen / nav)
            ├── LorebookEntry[] (per-Conversation in v0 — see §3, divergent from PersonaLLM)
            ├── MemoryDocument[] (auto-extracted, per-Conversation RAG)
            ├── AuthorsNote (0..1, per-Conversation override)
            ├── ConversationBranch[] (fork points)
            └── GrammarCorrection[] (per-Conversation; see §7)
```

Canonical entity names are reused from [Seed/PersonaLLM-Reference/00-index.md](PersonaLLM-Reference/00-index.md) and [Seed/PersonaLLM-Reference/03-data-model.md](PersonaLLM-Reference/03-data-model.md). The `Credits` entity from PersonaLLM is **dropped** in v0.

**v0 Extension — Grammar entities:**

- **GrammarCorrection** — one row per user Message that produced a correction. Fields: `id`, `user_message_id`, `conversation_id`, `original_text`, `corrected_text`, `explanation?`, `error_categories[]`, `edit_distance`, `reinforcement_failures_count` (default 0), `created_at`.
- **GrammarAggregate** — per-user rollups for the Grammar Dashboard: level, top errors, filler words, overused words, connector stats, AI narrative feedback, and a `dirty` boolean flag for the staleness model (see §7).

Grammar entities are intentionally **decoupled** from Conversation/Message tables so dashboard queries stay cheap and grammar data cannot contaminate the Conversation Agent's context.

**v0 Extension — Character field:**

- `Character.english_style` enum: `formal_american` / `neutral_american` (default) / `casual_american`. Affects how the NPC speaks (§5.3); does not affect the Grammar Agent.

**v0 Extension — User fields:**

- `User.byok_keys` — encrypted blob holding the user's BYOK API keys (text engine, image engine, TTS). Scoped per-User. **(v0.2 update — cycle 0106:)** anonymous sessions are no longer auto-created; every User is email-registered. The original "guest mode → link account later" flow is dormant in code (the Supabase auth API still supports it), pending a future demo-mode feature backed by project-side free-tier model keys. With pure BYOK there is no usable surface for an anonymous user — they cannot chat without a key, and storing a key in a session that can be lost (cookie clear, device change) is a worse UX than registering up-front.
- `User.sfw_disabled` — boolean, requires authenticated User + 18+ confirmation flow.

---

## 3. Memory Architecture

v0 uses **per-Conversation** scoping for both conversation memory and Lorebook. This is a deliberate **divergence** from PersonaLLM (see §9): PersonaLLM scopes Lorebook per-Character. v0 scopes per-Conversation so each new thread feels like a clean start, supporting practice scenarios and re-attempts without prior context bleeding in.

**Conversation memory (v0):**
- Per-Conversation RAG using **Supabase Postgres with the `pgvector` extension** (see §11).
- Auto Lore Extraction runs every N turns (default 3) and writes `LorebookEntry` items **into the active Conversation only**. See [Seed/PersonaLLM-Reference/04-screens/settings/memory.md](PersonaLLM-Reference/04-screens/settings/memory.md) for the PersonaLLM-style configuration; the only v0 change is scope.
- Lorebook entries and Author's Notes are injected into the prompt at the positions defined by PersonaLLM's 11-position prompt assembly. See [Seed/PersonaLLM-Reference/04-screens/settings/prompt-editor.md](PersonaLLM-Reference/04-screens/settings/prompt-editor.md) and [Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md).
- Retrieval tuning (top-k, similarity threshold, recency weighting) is exposed in Settings → Memory.

**LangGraph state:**
- LangGraph's `langgraph-checkpoint-postgres` checkpointer persists graph state into the same Supabase Postgres. The checkpointer is a **cache** — Supabase Postgres tables are the **source of truth** for Conversations, Messages, Lorebook, and Grammar (see §7 design disciplines).

**Grammar memory (v0 Extension):**
- Stored in `GrammarCorrection` + `GrammarAggregate` tables (§2).
- **Never injected** into the Conversation Agent's prompt. Grammar context is orthogonal to NPC context.
- Aggregated by a background **Insights job** (§7).

---

## 4. Navigation & Sidebar

**UI shell mirrors PersonaLLM**: left **sidebar** + **top nav bar**. No bottom button bar — same as PersonaLLM across desktop and mobile.

**Sidebar primary nav:**

1. **Home** (`/`) — Recent Characters + Grammar snapshot (§5.1)
2. **Characters** (`/characters`) — Full Character list / grid (§5.3)
3. **Chat** (`/chat/[characterId]/[conversationId]`) — One of a Character's Conversations (§5.2). The chat screen exposes a top-bar **Conversation switcher** (PersonaLLM-style) to switch / create new ones.
4. **Gallery** (`/gallery`) — Generated images (§5.5)
5. **Grammar** (`/grammar`) — Grammar Dashboard (§5.6) — **primary nav item in v0**
6. **Settings** (`/settings`) — All configuration (§5.7)

**User section** sits in the sidebar (avatar + display name) → opens UserPersona editor (§5.4).

**What's removed vs. PersonaLLM:**
- **Community** route — cut.
- **Credits** display in the side drawer — cut.

---

## 5. Screen-by-Screen Breakdown

### 5.0 Grammar Module Overview

Grammar is a cross-cutting module that surfaces in multiple screens. This index points to every place it appears. Detail lives at each link — do not duplicate here.

- **5.1 Home → Grammar snapshot widget** — quick macro view (level, common errors, overused words).
- **5.2 Chat → Inline Grammar (Mode A / B)** — corrections inline in the message feed.
- **5.2 Chat → Grammar Reinforcement Mode** — optional rewrite-gate before NPC responds.
- **5.2 Chat → Grammar Panel (sidebar)** — list of correction pairs + per-Conversation summary.
- **5.6 Grammar Dashboard (`/grammar`)** — full macro view across all Conversations.
- **5.7 Settings → Grammar sub-section** — all toggles + tier / model selector.
- **§7 Architecture** — Grammar Agent, Reinforcement Validator, Insights Job, multi-agent separation.
- **§8 Principles** — non-negotiables #1, #2, #3, #6, #8 are grammar-related.

Defaults: Grammar master toggle is **OFF** at first launch. The user opts in. With it OFF, no grammar UI is visible and no Grammar Agent calls are made.

### 5.1 Home (`/`)

**Purpose:** entry point; lists recent Characters and surfaces a macro grammar signal.

**Sections (top-to-bottom):**
- **Recent Characters** — shows the user's **most recently used Characters** only. "See all" link → `/characters` (§5.3). Empty state: "No Companions Yet" (Observed in PersonaLLM — see [Seed/PersonaLLM-Reference/04-screens/home.md](PersonaLLM-Reference/04-screens/home.md)). Primary CTA: Create / Import Character.
- **Grammar snapshot (v0 Extension)** — widget showing **detected English level**, **most common error patterns**, **frequently overused words**. Pulls from `GrammarAggregate` (pre-computed — Home must load fast, no live aggregation on render).
- Snapshot is **hidden** if the grammar master toggle is off or if no data exists yet.

### 5.2 Chat (`/chat/[characterId]/[conversationId]`)

**Purpose:** a 1:1 conversation with one Character. A Character may have multiple Conversations. The chat screen exposes a **top-bar Conversation switcher** (PersonaLLM-style) — opens a list/dropdown of the Character's Conversations + "New conversation" action. v0's core surface.

**PersonaLLM behavior preserved** (see [Seed/PersonaLLM-Reference/04-screens/chat.md](PersonaLLM-Reference/04-screens/chat.md), [chat-controls.md](PersonaLLM-Reference/04-screens/chat-controls.md), [branch.md](PersonaLLM-Reference/04-screens/branch.md), [06-chat-interaction-model.md](PersonaLLM-Reference/06-chat-interaction-model.md)):
- Message bubbles with author styling (bubble colors configurable).
- **Dialogue vs. narration typography (preserved from PersonaLLM — critical for readability):**
  - **Italic (`*asterisks*`)** → rendered as italic, visually distinct (lighter / de-emphasized tone on dark background). Represents **narration / action** (e.g., *I blink, tilting my head slightly…*).
  - **Plain quoted text (`"..."`)** → rendered as normal weight, full-contrast. Represents **dialogue** (e.g., "So let me help you finish it.").
  - This typographic convention is not cosmetic only — it's what keeps long roleplay responses readable by separating what the character *does* from what the character *says*. See [Seed/PersonaLLM-Reference/04-screens/chat.md](PersonaLLM-Reference/04-screens/chat.md) §Message bubble anatomy.
  - It also powers **dual-voice TTS routing** (§5.7): narration → narrator voice, dialogue → character voice.
- **MessageVariant** — regenerate alternate assistant responses; navigate between variants.
- **Edit message** — see "Edit semantics" below.
- **Branching** — fork a conversation at any message (Keep messages / Summarize & start fresh).
- **Suggested replies** and typing-speed options.
- **Autopilot** and **Author's Notes** — both first-class, per-Conversation.
- **Dual-voice TTS** — text-to-speech per message, gender-matched voices (remote providers in v0; see §5.7).
- **Per-message image generation** — inline placeholder → inline rendered image.

**v0 Extension — Lorebook in Chat:** since Lorebook is per-Conversation in v0 (§3), Lorebook editing/viewing UI lives in **chat-controls / a side panel within the Chat screen**, not in the Character editor (§5.3). Each Conversation has its own Lorebook surface.

**v0 Extension — Edit semantics (destructive trim):** editing any prior Message **deletes all subsequent Messages** in that Conversation (truncates the feed at the edit point). If grammar is enabled, the corresponding `GrammarCorrection` rows for the deleted Messages are also removed. The edited Message receives a fresh grammar pass. Rationale: continuing a thread after silently changing a prior message produces incoherent context.

**v0 Extension — Branching × Grammar:** when forking a Conversation, **copy** all `GrammarCorrection` rows belonging to the kept range into the new Conversation (new `conversation_id`). Each branch becomes a self-contained Conversation with its own grammar history. Storage cost is acceptable at v0 scale.

**v0 Extension — Autopilot × Grammar:** the Grammar Agent **does NOT run on Autopilot-generated user messages**. Autopilot output is not human input and must not pollute corrections / aggregates.

**v0 Extensions — Grammar in Chat:**

#### Inline Grammar (only visible if enabled in Settings)

- **Mode A (simple):** Corrected version of the user's message appears below their input in the feed. American English standard.
- **Mode B (advanced):** Corrected version + a brief plain-English explanation of the correction. Displayed in a distinct font or style.

#### Grammar Reinforcement Mode (optional, requires inline grammar to be on)

An additional Settings toggle that adds a **rewrite step** before the NPC responds:

1. User sends a message.
2. Grammar Agent returns: "this is how it should have been said" (or "already correct").
3. If correct → NPC responds immediately. No rewrite asked.
4. If there was an error → input field is replaced with a **rewrite prompt**; user must type the corrected version.
5. **Validation is lightweight** — a Reinforcement Validator (non-LLM) compares the user's rewrite to the proposed correction (see §7 for the ≥95% threshold).
6. On pass → NPC responds. Conversation flow continues.
7. **After 3 failed attempts**, the flow continues anyway (NPC responds). The `GrammarCorrection.reinforcement_failures_count` is incremented. No infinite loop.
8. If the user's original message was essentially correct, the rewrite step is skipped entirely — no friction for good input.

**Key design:** This happens BEFORE the NPC responds. The flow is: user types → grammar check → rewrite if needed → NPC responds. The user practices the correct form while context is fresh, without breaking conversation rhythm unnecessarily.

#### Spanish / Spanglish handling

If the user writes in Spanish or mixes (Spanglish), the Grammar Agent **shows what the user should have written in English**. The whole point is English learning — the agent is a translation-aware corrector, not a "wrong language" rejecter. Note: this raises the bar for the Basic-tier model (see §7 model selection guidance).

#### Input Area (bottom, sticky)

- Text input field (Enter = send, Shift+Enter = newline)
- Send button
- **Grammar sidebar toggle** (right of send button, only visible if grammar is enabled) → opens/closes the right-side Grammar Panel.

#### Grammar Panel (right sidebar, conditional)

- **List of correction pairs** — primary content. Display format: **plain text, two lines per pair** — first line = original, second line = corrected. No diff highlighting in v0.
- Mini-summary: most overused words, most common error types **in this Conversation** (a Conversation is the aggregation unit in v0).
- **Clear grammar for this Conversation** action — deletes all `GrammarCorrection` rows scoped to this Conversation so the user can re-measure improvement after focused practice. Confirms before deletion.
- Only visible when activated.

### 5.3 Characters (`/characters`) + Character Info / Editor / Import

**Characters list page** — full grid of all of the user's Characters. Home shows only recents; this is the "see all" surface.

**Character Info / Editor / Import preserved from PersonaLLM**, with two v0 differences:
- [Seed/PersonaLLM-Reference/04-screens/character-info.md](PersonaLLM-Reference/04-screens/character-info.md)
- [Seed/PersonaLLM-Reference/04-screens/character-import.md](PersonaLLM-Reference/04-screens/character-import.md) — JSON + PNG card import.
- **Difference 1 — Lorebook NOT in Character editor.** Because Lorebook is per-Conversation in v0, its UI lives in the Chat screen (§5.2), not on the Character profile.
- **Difference 2 — English Style selector** (see below).

**v0 Extension — English Style selector (per Character):**
- New field on the Character editor: **English Style** — a dropdown describing **register / variety**, not regional dialect. Options:
  - **Formal American English** (cultured / educated register — careful vocabulary, complete sentences, low slang).
  - **Neutral American English** (default — standard conversational register).
  - **Casual American English** (popular / colloquial register — how a street vendor, bartender, or friend would talk: slang, contractions, informal grammar).
  - Optional regional variants (British, Australian, etc.) deferred — v0 stays American English only.
- This value is injected into the Character's system prompt so the NPC speaks in the chosen register — flavor only, on top of the NPC's personality.
- **Grammar is completely independent from this selector.** The Grammar Agent always corrects to American English in v0 regardless of the Character's English Style. Grammar does not depend on the Character.

Community-sourced characters are **not** importable in v0 (no Community surface).

### 5.4 User Profile / UserPersona (`/profile`, inferred route)

**Unchanged from PersonaLLM.** See [Seed/PersonaLLM-Reference/04-screens/user-profile.md](PersonaLLM-Reference/04-screens/user-profile.md). Fields: photo, name, gender (checkbox-style), appearance (skin, eyes, hair, extras), background story. Gender-appropriate smart defaults for blank fields.

### 5.5 Gallery (`/gallery`) + Image Viewer

**Unchanged from PersonaLLM.** See:
- [Seed/PersonaLLM-Reference/04-screens/gallery.md](PersonaLLM-Reference/04-screens/gallery.md)
- [Seed/PersonaLLM-Reference/04-screens/image-viewer.md](PersonaLLM-Reference/04-screens/image-viewer.md) — fullscreen + Edit Prompt + long-press actions.

v0 scopes the gallery filter to **per-Character** (not per-Story — stories don't exist).

### 5.6 Grammar Dashboard (`/grammar`)

**MVP and a primary navigation item.**

**Layout:** Sidebar + main content.

**Content (aggregated across all the user's Conversations):**
- **Detected English level** — overall assessment computed from all the user's Conversations.
- **Most common errors** — categorized by error type (verb tense, prepositions, articles, etc.).
- **Filler words** — overused filler words / muletillas detected.
- **Overused words** — words the user relies on too heavily.
- **Connector analysis** — how the user links sentences and ideas.
- **AI feedback** — narrative paragraph assessing the user's biggest weaknesses and patterns.
- **Improvement suggestions** — specific, actionable recommendations.
- **Reinforcement performance** — percentage of attempts that failed reinforcement (when Reinforcement Mode was active), drawn from `GrammarCorrection.reinforcement_failures_count`.
- **Full correction list** — scrollable list of all correction pairs: original message vs. corrected version.
- **Clear all grammar data** — destructive action; wipes `GrammarCorrection` + `GrammarAggregate` for the user. Confirms before deletion.

**Empty state:** when there are zero corrections, show a friendly message that hints at what will appear: *"Your detected level, common errors, and overused words will appear here as you chat."*

Data aggregated across all Conversations (macro view, not per-Conversation). Stored in `GrammarAggregate` (pre-computed by the Insights job — see §7).

### 5.7 Settings (`/settings`)

v0 keeps the full PersonaLLM settings surface, **minus** the scope-cut items, **plus** a new Grammar sub-section. See the full list in [Seed/PersonaLLM-Reference/04-screens/settings-index.md](PersonaLLM-Reference/04-screens/settings-index.md).

**Kept (Observed in PersonaLLM):**
- Chat Behavior — typing speed, suggested replies. [chat-behavior.md](PersonaLLM-Reference/04-screens/settings/chat-behavior.md)
- Memory — RAG tuning, Auto Lore Extraction, extraction prompt editor, retrieval parameters. [memory.md](PersonaLLM-Reference/04-screens/settings/memory.md)
- Visual Roleplay — mode + resolution presets. [visual-roleplay.md](PersonaLLM-Reference/04-screens/settings/visual-roleplay.md)
- Bubble Colors. [bubble-colors.md](PersonaLLM-Reference/04-screens/settings/bubble-colors.md)
- Prompt Editor — full 11-position assembly, all templates. [prompt-editor.md](PersonaLLM-Reference/04-screens/settings/prompt-editor.md)
- **Text Engine** — BYOK providers (OpenRouter primary in v0). **This is also where the Conversation Agent model is selected**; the Grammar Agent has its own model selector in the Grammar sub-section below. [text-engine.md](PersonaLLM-Reference/04-screens/settings/text-engine.md)
- Image Engine — **ComfyUI** (user enters URL + port, local or remote, e.g. `http://localhost:8188` or remote tunnel; test connection; per-style workflow upload — anime / realistic / pixel — with parameters per workflow) + direct API providers. [image-engine.md](PersonaLLM-Reference/04-screens/settings/image-engine.md)
- Video Engine — stub. [video-engine.md](PersonaLLM-Reference/04-screens/settings/video-engine.md)
- **Text-to-Speech** — providers in v0: **ElevenLabs**, **OpenAI TTS**, **WebSpeech** (browser native). **Default: OFF.** User opts in. When on, supports both PersonaLLM modes: "auto on every assistant message" or "per-message playback" (per-message speaker icon). [text-to-speech.md](PersonaLLM-Reference/04-screens/settings/text-to-speech.md)
- Speech Recognition. [speech-recognition.md](PersonaLLM-Reference/04-screens/settings/speech-recognition.md)
- Data & Security — **18+ SFW confirmation flow** (only required when disabling SFW; see §6), Cloud Consent (inline, not blocking), Storage breakdown, Erase. See [data-security.md](PersonaLLM-Reference/04-screens/settings/data-security.md). **Note: SFW pre-filter prompts are NOT user-editable** (matches PersonaLLM). Disabling SFW removes the filter entirely; the filter itself is a system asset.

**Cut from PersonaLLM:**
- Credits / purchases.
- App Lock biometric flow — simplified to plain "sign out" + account delete. (inferred)
- Community-related toggles (share, discoverability).
- Apple SignIn.

**v0 Extension — Grammar sub-section:**

- Master grammar toggle (on/off) — **default OFF**.
- Inline grammar (on/off)
  - Level selector: simple correction only (Mode A) / correction + explanation (Mode B).
- Sidebar grammar panel (on/off)
  - Frequency: every message / every 3 messages / every 5 messages / major errors only.
  - "Major errors only" = only flag mistakes that native American English speakers would never make.
  - **Note:** this frequency controls **panel UI surfacing**, not Grammar Agent invocation. The agent runs on every user message regardless (see §7).
- Reinforcement mode (on/off, only available when inline grammar is on)
  - When on: user must rewrite corrected messages before NPC responds (see §5.2 for flow).
  - Validation is lightweight (string comparison, not LLM).
  - After 3 failed attempts, the flow continues; failures are counted.
- **Grammar Agent tier** (v0 Extension):
  - **Basic** (default) — cheap, reliable correction for common errors. Nano / Flash-Lite class.
  - **Advanced** — slightly better model, deeper explanations and richer insights.
  - **Custom model override** — free-text field to type any model ID and override the tier default.
  - See §7 for model guidance, including the Spanish-handling consideration that may push some users to Advanced.

**v0 Extension — Grammar deletion controls:**
- In the **Grammar Dashboard** (§5.6): "Clear all grammar data" — deletes every `GrammarCorrection` + `GrammarAggregate` row for the current user.
- In the **Grammar Panel** (§5.2): "Clear grammar for this Conversation" — scoped delete.
- In **Data & Security**: mirrors of both controls for consistency with PersonaLLM's storage layout.
- Purpose: let the user wipe old errors and re-measure progress after practice.

**Correction target language (v0):** American English only. The per-Character **English Style** selector (§5.3) affects how the NPC speaks, not what the Grammar Agent corrects to.

---

## 6. Authentication & Content Safety

### Authentication

v0 uses **Supabase Auth** (JWT-based). Rationale (see §11 and [stack-decisions.md](../References/GeneralDocuments/stack-decisions.md) §5):
- Unifies authentication across React web today, future Flutter, and a future local-on-device client — the same JWT works everywhere.
- FastAPI validates the JWT against Supabase's public key; never emits custom tokens.
- Row-Level Security (RLS) policies on Supabase Postgres enforce per-user data isolation declaratively — no hand-written authorization checks scattered across the backend.
- Free tier is sufficient for v0 validation.

**Providers (v0):**
- **Email + password** (and/or magic link).
- **Google OAuth.**
- **GitHub OAuth** (trivial to add via Supabase) — included.
- No Apple, no Microsoft.

**Session model:**
- Server-side sessions (Supabase-managed JWT).
- **Guest mode (REMOVED in v0.2 — cycle 0106):** the original spec defined a Supabase anonymous sign-in path that created a real `User` row + JWT for guests, with an "upgrade to real account" link-flow preserving all data. That path is **deprecated** for v0.2: the app is registered-only (email + password). Reason: with pure BYOK every meaningful action requires an API key the guest would have saved into a session they can lose (cookie clear, device change, expiry), which is a worse UX than registering up-front. The link-flow code still exists in `AuthForm.tsx` (`signUp` always creates fresh now) but is dormant. Re-enable when a project-side free-tier demo-mode lands.
- **Retention:** N/A under v0.2 (no anonymous Users to prune).
- Per-user data isolation via RLS.

**Explicitly dropped from PersonaLLM:**
- Apple SignIn (iOS-specific).
- Any in-app purchase / Credits-linked auth surfaces.

### Content Safety

- **Fiction disclaimer** and content guidelines on first launch (no impersonation, no illegal content, no minors).
- **Cloud AI Consent** — inline in Settings when the user first enters an API key, **not** a blocking onboarding screen.
- **SFW is the default** and is enforced as a system-prompt pre-filter (not a separate agent). **The pre-filter prompts are NOT user-editable** (matches PersonaLLM; editable = trivial bypass).
- **18+ confirmation is only required when disabling SFW**, not at signup. Default SFW mode keeps the experience safe for any user, so no upfront age gate is needed. Disabling SFW triggers an explicit 18+ confirmation modal and requires an authenticated (non-anonymous) account.

### SFW Pre-Filter — surfaces, behavior, and how to disable

SFW is a cross-cutting filter that applies to **text** and **image** surfaces in v0. TTS inherits safety from the text path — no separate TTS filtering.

**1. Text — Conversation Agent**
- When `User.sfw_disabled = false`, a **system-owned guardrail block** is prepended to the Conversation Agent's system prompt, alongside the Character card and the rest of the 11-position assembly (see [Seed/PersonaLLM-Reference/04-screens/settings/prompt-editor.md](PersonaLLM-Reference/04-screens/settings/prompt-editor.md)).
- **Observed PersonaLLM behavior (v0 baseline):** when the user pushes toward inappropriate content, the response may **deflect, refuse, or state plainly that the topic cannot be continued** ("I can't maintain this conversation on that topic" style). This sometimes breaks character — that is PersonaLLM's actual behavior and v0 matches it.
- Keeping the NPC fully in character while deflecting is a **v1+ quality goal** (see [creator-vision-for-multiinteractions.md](../creator-vision-for-multiinteractions.md) §6 "NPCs must not break character"). v0 does not commit to that bar.

**2. Images — Image Engine / ComfyUI**
- When `User.sfw_disabled = false`, the image pipeline:
  - Prepends an SFW-friendly positive suffix to the generation prompt (e.g., `tasteful, clothed, non-explicit`).
  - Appends NSFW keywords to the user's existing negative prompt (for providers that support negative prompts, like ComfyUI; for direct APIs that don't, only the positive suffix applies).
- **Observed PersonaLLM behavior (v0 baseline):** if the combined prompt still reads as NSFW after filtering, image generation is **blocked** — the system does not produce the image. The user sees a brief notice and can rewrite the prompt or (if eligible) disable SFW.

**3. TTS** — no dedicated filter. TTS reads whatever text the Conversation Agent produced, which has already passed the text filter.

**Disabling SFW — what it does and does NOT do**
- Disable **removes** the text guardrail block and **removes** the image NSFW-negative additions. That's it.
- **It does NOT add "be explicit" or any pro-NSFW instruction.** The NPC continues to behave according to the Character card and conversation context. If the user never pushes toward NSFW, the output stays SFW naturally.
- Disabling does not bypass character integrity (§8 #9) — a cold or guarded Character still behaves as such.

**System-owned prompts**
- The exact text of the text guardrail and the exact keyword lists for the image filter are **system assets**. Not visible in Settings, not exposed in the Prompt Editor. PersonaLLM keeps them closed for the same bypass-prevention reason.

---

## 7. AI Architecture Requirements

v0 uses **multi-agent separation** via **LangGraph (Python)** on a **FastAPI** backend, to keep Grammar strictly out of the Conversation Agent's context. **The Conversation Agent is never asked to do grammar** — doing so would dilute the quality of the roleplay reply. This is the single most important architectural rule in v0.

The frontend (React + Vite) talks to the backend via **REST + SSE for chat streaming**, and **directly to Supabase** for CRUD reads (Conversations list, message history, settings) through RLS-protected tables. FastAPI stays thin: its job is to invoke the LangGraph chat flow and expose `/chat` (SSE).

### Conversation Agent

- LangGraph node, Python.
- Uses PersonaLLM's prompt-assembly pipeline unchanged (system prompt + character card + UserPersona + lorebook + memory retrieval + Author's Notes + chat history + user message). See [Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md).
- **Prepends the SFW guardrail block to the system prompt when `User.sfw_disabled = false`** (see §6 "SFW Pre-Filter"). The guardrail is system-owned and not exposed in the Prompt Editor.
- Receives the user's BYOK key per request; does not persist it server-side beyond `User.byok_keys` (encrypted).
- Model selected by the user in Settings → Text Engine.
- **Must not** receive any Grammar data in its prompt.

### Grammar Agent

- Separate LangGraph node, runs **out-of-band** on **every user message** (user messages only — assistant messages are never corrected; Autopilot messages are never corrected).
- **Single-pass** by default — one LLM call per user message.
- **Two-tier model selector** in Settings → Grammar (with a free-text override field):
  - **Basic tier** (default) — cheap but reliable. Nano / Flash-Lite class (e.g., GPT-4.1-nano, Gemini Flash-Lite).
  - **Advanced tier** — slightly better; deeper explanations and richer insights. **GPT-4o-mini is considered too expensive even for Advanced** — target something cheaper with strong grammar capability.
  - **Spanish/Spanglish caveat:** non-English input handling (translation-aware correction) raises the bar for the Basic tier. Some users may need Advanced for reliable behavior; flagged as an open tuning question (§10).
- Default selection: **Basic tier**. Users opt into Advanced if they want richer feedback.
- Responsibilities in that single pass:
  - Produce corrected version of the user's text.
  - Produce plain-English explanation when Mode B is active.
  - Classify error categories (verb tense, articles, prepositions, word order, etc.).
  - Detect filler words / muletillas, overused words, connector usage.
  - Write a `GrammarCorrection` row and update counters in `GrammarAggregate` (set `dirty = true`).
- **Once a message has been corrected, it is not re-corrected.** The correction is the learning artifact; the user either rewrites it (Reinforcement Mode) or moves on.
- Editing a prior message → trims the feed (§5.2) and the new edited message gets a fresh grammar pass.

### Reinforcement Validator

- **Local, non-LLM.** Runs wherever the rewrite UI lives (TypeScript in React today; Dart in Flutter tomorrow). FastAPI implementation is an acceptable alternative.
- **Threshold: ≥95% similarity** after normalization (whitespace / punctuation / case stripped before computing edit distance). Below 95% → user retries.
- Lenient on trivial differences (a missing comma, an extra space, minor punctuation / capitalization), strict on real content (wrong tense, missing article, wrong preposition, word order).
- **After 3 failed rewrites**, the flow continues (NPC responds anyway). `GrammarCorrection.reinforcement_failures_count` is incremented for that row. Surfaced in the Dashboard. No infinite loop.
- Concrete numeric budget for the normalized Levenshtein threshold is TBD (§10).

### Insights Job

- Async Python job. Triggered by:
  - Every **10 new user messages** (counter on `GrammarAggregate`).
  - Home load if `GrammarAggregate.dirty = true`.
- Aggregates over `GrammarCorrection` → updates `GrammarAggregate` with: level assessment, filler words, overused words, connector analysis, AI narrative feedback. Clears `dirty` on completion.
- **Single LLM call** operates on **aggregated stats**, not raw message text — avoids leaking conversation content into the insights layer and keeps cost predictable.
- **Home is never blocked** on this job. Snapshot reads cached `GrammarAggregate` immediately; a stale flag triggers an async refresh that updates the next render.

### Storage of correction pairs

- Store **both** `original_text` and `corrected_text` verbatim (no diff-only storage). Enables the user to review the full pair in the sidebar panel and on the dashboard. Space cost is acceptable at v0 scale.

### Checkpointer

- `langgraph-checkpoint-postgres` persists graph state into the same Supabase Postgres protected by RLS.

### Streaming

- SSE (Server-Sent Events) from FastAPI `/chat`. Not WebSocket — SSE is simpler, portable, and matches Flutter's `http` package natively for the future mobile path.

### BYOK per user

- v0 is web-first with BYOK cloud providers. No local MLX, no local Kokoro. ComfyUI is a remote URL the user configures.
- Keys stored encrypted server-side in `User.byok_keys` (Supabase Postgres + RLS).

### Design disciplines (from [stack-decisions.md](../References/GeneralDocuments/stack-decisions.md) §9 — v0 must respect these to keep future paths open)

1. **Conversation state in Supabase Postgres = source of truth.** Not only in the LangGraph checkpointer. Any client reading Supabase directly can reconstruct the conversation. This is the single most important forward-compatibility guarantee.
2. **Prompts are vendor-agnostic, not small-model-compatible.** v0 targets **good BYOK cloud models via OpenRouter** (GPT-4-class, Claude, Gemini, etc.). Prompts should not hard-depend on a single vendor's proprietary features (e.g., Claude-only tool schemas). But **small-local-model compatibility (3B–8B) is NOT a v0 requirement** — deliberately constraining v0 prompts to run on tiny models would degrade quality for zero present-day benefit. When (and if) iOS local mode is pursued, prompts can be adapted then.
3. **Standard message interface `{role, content, metadata}`** — clean portability baseline.
4. **Auth = Supabase JWT only.** FastAPI validates against Supabase's public key. Never emit custom tokens.
5. **Conversation state is replayable by any client.** Because state lives in Supabase (discipline #1), any future client — including a hypothetical local-mode client — can reconstruct history by reading the DB. This is a **data-layer guarantee, not a code-path duplication requirement**. v0's chat flow runs server-side via LangGraph as the normal implementation; there is no requirement to also replicate the 1:1 flow in the client.
6. **Context window in v0: honor PersonaLLM's default (32k) and the user's Text Engine setting.** BYOK users pay their own tokens and choose their own model — artificially limiting context would degrade the v0 experience. The **4–8k assumption is reserved exclusively for the future iOS local on-device code path**, where the `LLMProvider` abstraction will expose a lower-ceiling profile. Do not leak the local-mode ceiling into v0 cloud flows.
7. **JSON function calling / structured outputs are OK in v0 wherever they help** — Grammar Agent, Insights Job, and any other cloud-only multi-agent flow can use them freely (BYOK cloud models handle them fine). The **only exception** is the **Conversation Agent reply path**: that specific path should not take a hard dependency on function calling, because it's the flow earmarked for the future iOS local on-device mode where small models often fail JSON mode. Keep that path as plain text completion.

---

## 8. Non-Negotiable Creator Principles

1. **Grammar never blocks the NPC** unless Reinforcement Mode is explicitly enabled. Default mode adds zero friction.
2. **Grammar is opt-in at every layer.** Master toggle off → no grammar UI, no Grammar Agent calls.
3. **Conversation context stays clean.** Grammar data is architecturally forbidden from entering the Conversation Agent's prompt. Enforced by separate tables and separate agents, not by convention.
4. **Power-user depth is preserved.** Full Prompt Editor, generation parameters, Lorebook, Author's Notes, MessageVariant — all retained from PersonaLLM.
5. **Privacy-first.** Per-user isolation via Supabase RLS. BYOK keys stored encrypted. No third-party analytics on message content.
6. **Reinforcement validation is lightweight.** String distance, not LLM. Learning aid, not exam. Hard cap of 3 retries — the user is never trapped.
7. **No silent invention of v1+ features.** If it smells like Story, Scenario, Quest, Master Agent, multi-NPC in the same chat — it belongs to v1 and is out of scope. Multiple Conversations per Character **are** in scope and must not be confused with Plots.
8. **Grammar is Character-independent.** No Character attribute — including English Style — alters Grammar Agent behavior. The Grammar Agent always corrects to American English in v0.
9. **Character integrity.** NPCs never behave as assistants; sycophancy is a defect. (Observed in PersonaLLM; preserved.)
10. **Source of truth is Supabase Postgres.** Checkpointers, caches, client state — all secondary. Any client (web today, Flutter tomorrow, local-mode later) must be able to reconstruct the conversation by reading Supabase.

---

## 9. Divergences from PersonaLLM

**Cut:**
- Community (browse / share / rate / publish).
- Credits system and all monetization surfaces.
- Apple SignIn; any App Store / iOS-specific features.
- Local model runtimes (MLX, local Kokoro). Web-first BYOK only.
- App Lock biometric flow (simplified to sign-out + account delete).

**Added:**
- Grammar Module: inline correction (Mode A / B), Grammar Panel sidebar, Grammar Reinforcement Mode (with 3-strike cap), Home grammar snapshot, Grammar Dashboard (`/grammar`), Settings → Grammar sub-section, English Style selector on Character editor.
- Multi-agent architecture: Conversation Agent + Grammar Agent + Reinforcement Validator + Insights Job (LangGraph Python).
- Supabase Auth (JWT). ~~Anonymous sign-in for guest mode.~~ **Deprecated v0.2 — cycle 0106**: registered-only; see §"Session model" for rationale.
- `GrammarCorrection` + `GrammarAggregate` stores.

**Changed:**
- **Platform:** iOS native app → **React + Vite web app (SPA)** on Cloudflare Pages.
- **Backend:** none (PersonaLLM is client-only) → **Python FastAPI + LangGraph** on Hetzner+Coolify (or Railway).
- **Data layer:** local iOS storage → **Supabase** (Postgres + pgvector + Auth + Storage + RLS).
- **Cloud Consent:** blocking onboarding screen → inline notice on first API-key entry.
- **Lorebook scoping:** PersonaLLM scopes per-Character → **v0 scopes per-Conversation**. Reason: each Conversation feels like a clean start; supports practice scenarios and re-attempts without prior context bleeding in. Lorebook editing UI moves out of the Character editor and into the Chat screen.
- **Character editor:** loses the Lorebook section; gains the English Style dropdown.
- **Flutter mobile** acknowledged as a future path (not v0).
- **iOS local on-device mode** acknowledged as a future path (not v0).

---

## 10. Resolved Decisions & Remaining Open Questions

### Resolved (canonical list — single source of truth)

- **UI shell:** PersonaLLM-style sidebar + top nav. No bottom button bar. (§4)
- **Home:** recent Characters + grammar snapshot; full list at `/characters`. Snapshot reads pre-computed `GrammarAggregate` — no live aggregation. (§5.1)
- **Conversations per Character:** many (PersonaLLM-style). Top-bar Conversation switcher in Chat. (§5.2)
- **English Style selector** on Character editor — register-based (Formal / Neutral default / Casual American English). Character-independent from Grammar. (§5.3)
- **Lorebook scoping in v0:** per-Conversation (divergence from PersonaLLM). Lorebook UI lives in Chat, not Character editor. (§3, §5.2, §9)
- **Edit-as-trim:** editing a prior Message deletes all subsequent Messages + their grammar rows. Destructive. (§5.2)
- **Branching × Grammar:** copy `GrammarCorrection` rows into the new Conversation. Each branch is self-contained. (§5.2)
- **Autopilot × Grammar:** Grammar Agent does not run on Autopilot user messages. (§5.2)
- **Spanish / Spanglish:** Grammar shows "what should have been written in English." (§5.2)
- **Grammar deletion:** per-Conversation in panel + global in Dashboard / Data & Security. (§5.7)
- **Grammar master toggle:** default OFF. (§5.0, §5.7)
- **Grammar panel display:** plain text, two lines per pair (original / corrected). (§5.2)
- **Reinforcement threshold:** ≥95% similarity after normalization. 3-strike cap; counted in `GrammarCorrection.reinforcement_failures_count`. (§7)
- **Insights job cadence:** every 10 user messages + async refresh on Home if `dirty = true`. State-based, not time-based. (§7)
- **Correction storage:** both `original_text` and `corrected_text` verbatim. (§7)
- **Grammar Agent:** single-pass, user messages only, two-tier (Basic default / Advanced) + free-text custom override. (§5.7, §7)
- **Conversation Agent model selection:** Settings → Text Engine (PersonaLLM-style). (§5.7)
- **Auth:** Supabase Auth (JWT). Email/password + Google + GitHub OAuth. ~~Guest mode via Supabase anonymous sign-in.~~ **Deprecated v0.2 — cycle 0106**, registered-only. (§6)
- **18+ gate:** only when disabling SFW. (§6)
- **SFW pre-filters:** not user-editable. System assets. (§5.7, §6)
- **TTS providers:** ElevenLabs, OpenAI TTS, WebSpeech. Default OFF. Auto-mode + per-message playback (PersonaLLM-style). (§5.7)
- **ComfyUI:** user configures URL + port + per-style workflows + parameters. (§5.7)
- **Multi-agent separation:** mandatory. Conversation Agent never performs grammar. LangGraph Python. (§7)
- **Backend:** Python + FastAPI + LangGraph. Frontend: React + Vite. (§11)
- **DB / Auth / Storage / Vector:** Supabase + pgvector. (§11)
- **Streaming:** SSE. (§7, §11)

### Remaining open questions

- **Specific model picks (Basic + Advanced):** name a concrete default for each tier after a small benchmark. Candidates: GPT-4.1-nano, Gemini Flash-Lite, Gemini Flash, a small Claude below Haiku price, capable open-weights options (Qwen, Llama).
- **Spanish-handling tier impact:** if Spanish/Spanglish input is expected to be frequent in v0, Basic tier may be insufficient. Decide whether to flip the default to Advanced.
- **Reinforcement Levenshtein budget:** concrete numeric threshold (e.g., ≤5% normalized edit distance, or ≤3 absolute edits) — decide after a small user test.
- **Backend host final pick:** Hetzner CX22 + Coolify vs. Railway Hobby. Both work; decision is price/DX preference. (See [stack-decisions.md](../References/GeneralDocuments/stack-decisions.md) §7.)
- **Flutter timing:** when does the Flutter client begin? v0.x, v1, later? Not v0.
- **Local on-device mode timing & framework:** `fllama` vs `llama_cpp_dart` vs MLX vs MLC-LLM. Not v0.
- **Lorebook scoping re-validation:** revisit by directly running PersonaLLM if doubt persists about whether docs vs. observed behavior diverge.

---

## 11. Tech Stack Direction

This section consolidates the stack decisions. Full ADR-style detail (rationale, cost analysis, host comparison, design disciplines) lives in **[References/GeneralDocuments/stack-decisions.md](../References/GeneralDocuments/stack-decisions.md)** — that file is authoritative.

### Stack at a glance

| Layer | Choice |
|---|---|
| Frontend web | **React + Vite** → Cloudflare Pages (free) |
| Backend API | **Python + FastAPI + LangGraph** → Hetzner CX22 + Coolify (~$5/mo) or Railway Hobby ($5/mo) |
| Data + Auth + Storage + Vector + Realtime | **Supabase** (Postgres + pgvector + Auth + Storage + RLS + Edge Functions) |
| LLM | **BYOK** (user provides API key; builder pays nothing) |
| Streaming | **SSE** (Server-Sent Events) |
| LangGraph state | `langgraph-checkpoint-postgres` → Supabase Postgres |

### Why these choices (one-line each)

- **Why NOT Next.js:** Server Actions / RSC push patterns that break symmetry with future Flutter clients. The app is post-login (no SEO / SSR benefit). React + Vite keeps web and mobile as symmetric API clients.
- **Why Python (not LangGraph.js):** LangGraph Python is the reference implementation; Python's multi-agent ecosystem (checkpointers, evals, libs) is more mature; a centralized Python "brain" lets web / Flutter / local-mode clients stay thin views.
- **Why Supabase:** collapses Auth + Postgres + pgvector + Storage into one service; JWT works uniformly across web, FastAPI, and Flutter SDK; RLS replaces hand-written CRUD endpoints; free tier covers v0 validation.
- **Why SSE (not WebSocket):** simpler, portable to Flutter via `http` package, works natively in browsers. Chat is request/response — no need for bidirectional.
- **Why BYOK:** zero LLM cost for the builder; users choose their own model.

### Multi-client architecture (preview)

```
React web (Cloudflare Pages)  ─┐
Flutter iOS/Android (future)  ─┼──► Supabase SDK (auth, CRUD reads via RLS)
Local on-device client (future) ┘
                                │
                                └──► FastAPI (REST + SSE) ──► LangGraph
                                                                  │
                                                                  └──► BYOK LLM (per request)

All clients + backend share one Supabase Postgres (source of truth) + one JWT.
```

### Local development

v0 must be fully runnable **locally** before any deploy. Two supported modes:

- **Recommended default:** local React+Vite + local FastAPI on `localhost`, both connecting to a **hosted Supabase dev project** (free tier — separate from the prod project). Same SDK / same SQL / zero schema drift.
- **Fully offline mode (optional):** `supabase start` via the **Supabase CLI** runs a local Supabase stack in Docker (Postgres + GoTrue auth + Storage + Realtime + Studio) at `http://localhost:54321`. FastAPI runs locally; React+Vite runs locally; everything points to the local Supabase instance.

Rules:
- Single set of env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Switching local ↔ dev ↔ prod is an env-var change.
- Migrations managed via `supabase db push`. Schema parity between local, dev, and prod is mandatory.
- Seed / fixture script populates a fresh local DB with a demo User, Character, and Conversation so the app is immediately usable.
- BYOK keys live in `.env.local` for development; never committed.

### Future paths enabled by these choices (not v0)

- **Flutter mobile (iOS + Android):** consume the same FastAPI + Supabase. `supabase_flutter` is the official SDK.
- **iOS local on-device mode:** add an `LLMProvider` abstraction in the Flutter client; cloud and local providers swap behind the same interface. Multi-agent flows stay cloud-only.
- **Multiple apps from the same builder:** Hetzner+Coolify or Cloud Run let new apps share infra at near-zero marginal cost.

### Design disciplines for v0 (full list in [stack-decisions.md](../References/GeneralDocuments/stack-decisions.md) §9)

1. Supabase Postgres = source of truth for conversation state.
2. Prompts are **vendor-agnostic** (work across OpenRouter models) but **not** deliberately small-model-compatible — v0 targets good cloud BYOK models and should not degrade quality to fit hypothetical 3B local models.
3. Standard `{role, content, metadata}` message interface.
4. Auth = Supabase JWT only.
5. Conversation state in Supabase lets any future client replay history — this is a **data guarantee**, not a "chat flow must also run client-side" requirement. v0 chat runs server-side via LangGraph.
6. **v0 context window** = PersonaLLM default (32k) + user's Text Engine setting. The 4–8k ceiling is a **future local-mode discipline only**, not a v0 constraint.
7. Function calling / structured outputs are fine in v0 (Grammar Agent, Insights, etc.). The only exception is the Conversation Agent reply path — keep it plain text completion to preserve the future local-mode path.
8. SSE streaming, not WebSocket.

---
