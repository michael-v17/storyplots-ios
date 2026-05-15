# Product — StoryPlots v0

> **Authority:** third in precedence, after [creator-vision.md](creator-vision.md) and [README.md](README.md). Higher than [user-stories.md](user-stories.md) for product-scope decisions; lower for user-centered behaviors, which [user-stories.md](user-stories.md) owns.
>
> Any conflict with [creator-vision.md](creator-vision.md) is resolved in favor of [creator-vision.md](creator-vision.md) and recorded in [open-questions.md](open-questions.md).

---

## 1. Product identity

- **Name:** StoryPlots (v0)
- **Scope label:** `SingleNPCInteractionVersion`
- **Platform:** web-first SPA (React + Vite). No native iOS / Android in v0. See [architecture.md](architecture.md) §Stack.
- **Tagline (inferred):** *"Practice English by chatting with AI characters — one companion at a time."*

StoryPlots v0 is a **web app where the user holds 1:1 chats with AI characters**, with an integrated, opt-in **Grammar Module** that silently corrects, explains, aggregates, and (optionally) drills the user's English.

## 2. Positioning

**StoryPlots v0 is a chat app with grammar as an opt-in extension — not a grammar-first language-learning app, and not equal pillars.**

This positioning is committed in [user-stories.md](user-stories.md) §3 (round-3 creator confirmation) and drives:

- the default state of the Grammar Module (**OFF** at first launch — [creator-vision.md](creator-vision.md) §5.0, §5.7);
- the MVP cutline (the Critical path works without ever touching Grammar — see §5);
- the tone of Home copy, the onboarding flow, and the Settings → Grammar surface (none of them are first-run impositions).

Grammar surfaces (Settings → Grammar, `/grammar` Dashboard, Home snapshot widget) **must exist and work** in v0, but they are a strong opt-in, not a default behavior.

## 3. Problem statement

English learners who want realistic, open-ended conversation practice are caught between two options:

- **Chatbot companions** that feel natural but give no feedback on what the learner actually said.
- **Grammar drills** that give feedback but force the learner into sterile, non-narrative tasks.

StoryPlots v0 takes the conversational shape of a PersonaLLM-style character-chat app and adds a grammar layer that (a) is opt-in at every layer, (b) never derails the roleplay when disabled, and (c) produces macro feedback the learner can measure progress against when they want it. The learner keeps the chat experience they'd want for its own sake; grammar becomes a tool they can turn on when they're ready for feedback.

## 4. Target users

Two personas live inside the same product; the same human often plays both at different moments. [user-stories.md](user-stories.md) §4 owns the canonical definitions.

### P1 — Learner (primary)

An English learner using StoryPlots to practice through 1:1 chat with an AI companion. Cares about:

- low-friction defaults (Grammar OFF, guest mode, no upfront 18+ gate);
- getting corrections when they want them (inline, sidebar, or reinforcement);
- seeing measurable progress over time (Home widget, `/grammar` Dashboard);
- practicing natural conversation, not drills.

Spanish / Spanglish speakers are a real subset: the Grammar Agent is explicitly translation-aware in v0 ([creator-vision.md](creator-vision.md) §5.2 Spanish/Spanglish handling).

### P2 — Power Creator (secondary, inferred)

A user who:

- tunes their own Characters (personality, goals, worldbuilding, register);
- edits the 11-position prompt assembly (full Prompt Editor access);
- configures BYOK providers for text / image / TTS;
- picks the Grammar Agent tier or overrides with a custom model ID;
- uses per-Conversation Lorebook, Author's Notes, MessageVariant, Autopilot heavily.

Inferred from [creator-vision.md](creator-vision.md) §8 principle 4 ("Power-user depth is preserved"). The Power Creator is a real persona for v0 even though the creator vision positions the Learner first.

## 5. MVP scope (Critical cutline)

The v0 MVP ships when the Critical-priority stories in [user-stories.md](user-stories.md) pass, i.e. when the following path works end-to-end **without the learner ever touching grammar settings**:

1. First visit creates an anonymous Supabase `User` + JWT (story 2, guest mode).
2. Learner enters a BYOK API key; Cloud AI Consent appears **inline** on first key entry (story 39).
3. Learner creates a Character (story 7) or imports one from JSON/PNG (story 8).
4. Learner starts a Conversation (story 12) — `Conversation.character_snapshot` captures the Character's prompt-relevant fields at creation time.
5. Learner sends a message (story 16); Shift+Enter inserts a newline, Enter sends.
6. Conversation Agent reply streams via SSE; `*narration*` renders italic and `"dialogue"` renders plain (story 24).

**Grammar is reachable and opt-in** (not imposed):

- Settings → Grammar exists with the master toggle (default OFF); Inline Grammar (Mode A / B), Grammar Sidebar, Reinforcement Mode, Tier selector, and Custom model override all present (stories 26, 27, 28, 29, 33, 42).
- `/grammar` Dashboard is reachable from primary nav even when the master toggle is OFF — shows the empty-state copy (stories 35, 36).
- Home grammar snapshot widget appears only when the master toggle is on AND `GrammarAggregate` data exists (story 37).

The seven **non-negotiable flows** F1–F7 ([user-stories.md](user-stories.md) §6) are the smoke tests for v0:

- **F1** First-run MVP flow (steps above + optional grammar continuation).
- **F2** Reinforcement learning loop (3-strike cap, ≥95% similarity after normalization).
- **F3** Grammar isolation invariant (bidirectional — Conversation Agent never sees grammar; Grammar Agent never sees Character/UserPersona/Lorebook/Memory/Author's Notes).
- **F4** Destructive edit propagation (edit trims the feed, re-runs grammar on the new text).
- **F5** Account upgrade preserves data (guest → signed, same `User` row).
- **F6** Branching carries grammar forward (copy `GrammarCorrection` + per-Conversation `LorebookEntry` rows into the branch).
- **F7** Re-measure progress (per-Conversation clear + global clear, reaggregate without manual refresh).

## 6. Out of scope in v0

Explicit anti-goals, consolidated from [creator-vision.md](creator-vision.md) §1 and §9, and [user-stories.md](user-stories.md) §10 round-3C deferrals.

### Product-level cuts

- **No multi-NPC in a single chat, no Story, no Scenario layer, no Quest, no Plot, no Master Agent.** Those belong to v1+ and live in [../creator-vision-for-multiinteractions.md](../creator-vision-for-multiinteractions.md). Multiple Conversations per Character **are** in scope and must not be confused with Plots.
- **No Community.** No browse / share / rate / publish / favorite / follow / flag of Characters.
- **No monetization.** No Credits system, no paid tiers, no App Store surfaces. The `Credits` entity from PersonaLLM is dropped.
- **No native iOS or Android.** Flutter mobile is acknowledged as a future path but not v0.
- **No local model runtimes in v0.** No MLX, no local Kokoro. Web-first with BYOK cloud providers. ComfyUI is configured as a remote URL (local or tunneled), not bundled.
- **No iOS local on-device mode.** Future path; v0 prompts are vendor-agnostic across cloud BYOK models but **not** deliberately small-local-model-compatible.

### Interaction-level cuts (deferred to v1+)

- **No resume-after-disconnect** beyond basic SPA routing + Supabase-backed state.
- **No export / backup / restore** UI in v0 (the Data & Security surface exists but export is not required for v0).
- **No search** across Conversations or Characters.
- **No notifications** (web push, email, in-app).
- **No UI localization.** The UI is English-only in v0. The Grammar Agent always corrects to American English regardless of UI locale.

### Auth-surface cuts

- **No Apple SignIn.** iOS-specific, explicitly cut.
- **No Microsoft / other enterprise providers.**
- **No App Lock biometric flow** — replaced with plain sign-out + account deletion.
- **No upfront 18+ gate at signup.** 18+ is required only when disabling SFW (see §9 safety model).

## 7. Product principles (non-negotiable)

Verbatim from [creator-vision.md](creator-vision.md) §8. These are architectural invariants, not aspirations. Breaking one is a defect.

1. **Grammar never blocks the NPC** unless Reinforcement Mode is explicitly enabled. Default mode adds zero friction.
2. **Grammar is opt-in at every layer.** Master toggle OFF → no grammar UI, no Grammar Agent calls.
3. **Conversation context stays clean.** Grammar data is architecturally forbidden from entering the Conversation Agent's prompt. Enforced by separate tables and separate agents, not by convention.
4. **Power-user depth is preserved.** Full Prompt Editor, generation parameters, Lorebook, Author's Notes, MessageVariant — all retained from PersonaLLM.
5. **Privacy-first.** Per-user isolation via Supabase RLS. BYOK keys stored encrypted. No third-party analytics on message content.
6. **Reinforcement validation is lightweight.** String distance, not LLM. Learning aid, not exam. Hard cap of 3 retries — the user is never trapped.
7. **No silent invention of v1+ features.** If it smells like Story, Scenario, Quest, Master Agent, or multi-NPC in the same chat — it belongs to v1 and is out of scope. Multiple Conversations per Character **are** in scope.
8. **Grammar is Character-independent.** No Character attribute — including English Style — alters Grammar Agent behavior. The Grammar Agent always corrects to American English in v0.
9. **Character integrity.** NPCs never behave as assistants; sycophancy is a defect. (Observed in PersonaLLM; preserved.)
10. **Source of truth is Supabase Postgres.** Checkpointers, caches, client state — all secondary. Any client (web today, Flutter tomorrow, local-mode later) must be able to reconstruct the conversation by reading Supabase.

## 8. Success criteria

Observable, testable at v0-release time:

- **F1–F7 all pass** on a fresh local environment ([user-stories.md](user-stories.md) §6).
- **Grammar master toggle defaults OFF** for every new `User`, including anonymous ([creator-vision.md](creator-vision.md) §5.0, §5.7; story 26).
- **The critical path works without the learner touching Settings → Grammar** — F1 steps 1–6 complete cleanly.
- **No cross-user data bleed.** RLS policies on every table; anonymous users get identical isolation ([creator-vision.md](creator-vision.md) §6; story 2).
- **No Grammar data in any Conversation Agent prompt, on any turn** — enforced in code, verifiable by logging ([creator-vision.md](creator-vision.md) §8 principle 3; F3).
- **No Character / UserPersona / Lorebook / Memory / Author's Notes data in any Grammar Agent prompt** — only the user's raw message text (F3 bidirectional).
- **Edit is destructive** — editing a prior Message trims the feed and refreshes the Grammar Agent pass on the edited Message ([creator-vision.md](creator-vision.md) §5.2; F4).
- **Branching is self-contained** — the new Conversation has its own copied `GrammarCorrection` and `LorebookEntry` rows, independent of the parent ([creator-vision.md](creator-vision.md) §5.2; F6).
- **Reinforcement fails open after 3 attempts** — `reinforcement_failures_count` increments, NPC responds ([creator-vision.md](creator-vision.md) §5.2 step 7; F2).
- **SFW pre-filter prompts are system-owned and not user-editable anywhere** (not in Prompt Editor, not in Settings) ([creator-vision.md](creator-vision.md) §5.7, §6).
- **Account upgrade preserves all data** — guest → signed keeps the same `User` row (F5).
- **All 10 PersonaLLM settings sub-sections exist** (Chat Behavior, Memory, Visual Roleplay, Bubble Colors, Prompt Editor, Text Engine, Image Engine, Video Engine (stub), Text-to-Speech, Speech Recognition, Data & Security) **plus** the v0 Grammar sub-section.

## 9. Major constraints

- **BYOK-only.** The builder pays nothing for LLM inference. The user brings their own key for every provider (text / image / TTS / STT). No shared server-side keys, no centralized billing.
- **Supabase Postgres is the source of truth.** LangGraph's `langgraph-checkpoint-postgres` is a cache, not a second store ([architecture.md](architecture.md) §Design disciplines).
- **Multi-agent separation is mandatory.** The Conversation Agent and Grammar Agent are separate LangGraph nodes; they never share context; they run on potentially different BYOK models ([architecture.md](architecture.md) §Agents).
- **Streaming is SSE, not WebSocket.** Simpler, portable to Flutter, browser-native.
- **Auth is Supabase JWT only.** FastAPI validates against Supabase's public key. No custom token emission.
- **Context window** = PersonaLLM default (32k) + the user's Text Engine setting. The 4–8k ceiling is a **future local-mode discipline only**, not a v0 constraint.
- **Function calling / structured outputs are fine** for the Grammar Agent, Insights Job, and any other non-Conversation-Agent path. The **Conversation Agent reply path stays plain text** so the future iOS local on-device mode can swap in a small model behind an `LLMProvider` abstraction.
- **SFW is the default.** 18+ confirmation is required **only** when disabling SFW, and only for authenticated (non-anonymous) users. Disabling SFW removes the text guardrail block and the image NSFW-negative additions; it does **not** add any pro-NSFW instruction.

## 10. Safety & content model (summary)

Full behavior in [creator-vision.md](creator-vision.md) §6; summarized here because it shapes product scope.

- **Fiction disclaimer + content guidelines** shown on first launch, dismissible, restated in Settings → Data & Security.
- **Cloud AI Consent** is inline on first API-key entry, not a blocking onboarding screen.
- **SFW pre-filter** applies to two surfaces:
  - **Text (Conversation Agent):** system-owned guardrail block prepended to the system prompt when `sfw_disabled = false`. Not exposed in the Prompt Editor. Deflection / refusal behavior matches PersonaLLM as v0 baseline; keeping NPCs fully in character while deflecting is a v1+ quality goal.
  - **Images (Image Engine / ComfyUI):** SFW-friendly positive suffix + NSFW negative-prompt keywords. If the combined prompt still reads NSFW after filtering, generation is **blocked** with a brief notice.
- **TTS** has no dedicated filter — it reads what the Conversation Agent already produced.
- **Minors are strictly prohibited** at the content-policy level (inherited from PersonaLLM's image-refinement guardrail: "All characters are adults").

## 11. Priorities

Ordered from highest product leverage to lowest:

1. **The core chat loop works** — F1 passes, typography renders correctly, Conversation Agent streams via SSE, per-user RLS holds.
2. **Character lifecycle is complete** — create, import (JSON + PNG card), edit (with snapshot semantics on existing Conversations), delete, grid view.
3. **Conversation lifecycle is complete** — new / switch / branch (with Lorebook + Grammar copy) / delete, with the `character_snapshot` capturing prompt-relevant fields at creation.
4. **Grammar Module surfaces exist and pass F2 + F3 + F4 + F6 + F7** — inline Mode A / B, sidebar, Reinforcement with 3-strike cap, Dashboard with 9 content blocks, per-Conversation and global clear, Home snapshot.
5. **BYOK + Settings surface is complete** — all 10 PersonaLLM sub-sections plus Grammar sub-section; inline Cloud AI Consent on first key entry.
6. **Media surfaces** — per-message TTS with dual-voice routing, per-message image generation via ComfyUI (per-style workflows) with SFW filtering, Gallery filtered by Character, fullscreen image viewer.
7. **Power-user depth preserved** — full Prompt Editor exposing all 11 positions; Memory tuning knobs; Author's Notes; Autopilot; Bubble Colors.
8. **Account management** — sign up (email / Google / GitHub), guest mode, account upgrade, email verification (non-blocking), password reset, sign out, delete account with full cascade.
9. **Reachable visual polish** — dialogue/narration typography, three-layer theming (app base / bubble colors / Character accent), WCAG 2.1 AA baseline, `prefers-reduced-motion` respected.

A v0 release that ships (1)–(5) is already a viable product. (6)–(9) round it out to match PersonaLLM depth, which is a non-negotiable of [creator-vision.md](creator-vision.md) §8 principle 4 — none of them can be silently dropped, but the order above reflects relative product leverage.

## 12. Non-goals (redundant with §6, collected here for downstream consumers)

Downstream AI must not invent, infer, or scope-creep any of the following into v0. If the reference folder mentions them, they are interpretive color only.

- Story, Scenario-as-entity, Quest, Plot, Master Agent, multi-NPC chats.
- Community browse / share / rate / favorite / follow / download / flag.
- Credits, in-app purchases, subscription tiers.
- Apple SignIn, biometric App Lock.
- Native mobile (iOS / Android).
- Local model runtimes (MLX, local Kokoro).
- Export / backup / restore / search / notifications / UI localization.
- Small-local-model-compatibility for the Conversation Agent reply path (future iOS local-mode discipline; not a v0 constraint).

---

## Cross-references

- [creator-vision.md](creator-vision.md) §1, §6, §7, §8, §9, §10, §11 for source-of-truth statements.
- [user-stories.md](user-stories.md) §3 (positioning), §4 (personas), §5 (all 52 stories), §6 (flows F1–F7), §8 (screen map), §9 (entity map), §10 (gaps).
- [architecture.md](architecture.md) for how §9 constraints are enforced.
- [schema.md](schema.md) for isolation rules that back §7 principle 3.
- [open-questions.md](open-questions.md) for the four genuine open items.
