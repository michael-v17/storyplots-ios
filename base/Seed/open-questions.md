# Open Questions — StoryPlots v0

> **Authority:** lowest in precedence. A register of unresolved ambiguity — items here must NOT be silently invented by downstream systems. When an item is resolved, update the higher-priority file it affects and remove (or strike through) the entry here.
>
> **Rule:** low-impact gaps get silent defaults; medium-impact gaps get defaults recorded here; high-impact gaps require creator clarification before the seed treats them as resolved.

---

## 1. Genuine open items (require real-world action)

Promoted from [creator-vision.md](creator-vision.md) §10 and [user-stories.md](user-stories.md) §10. These cannot be resolved by seed-authoring alone.

### 1.1 Re-validate PersonaLLM Character-edit semantics hands-on

- **Status:** committed default in seed; needs real-app re-validation.
- **Seed default:** editing a Character does NOT retroactively change existing Conversations. Each Conversation stores `character_snapshot` at creation time and reads from it going forward ([domain.md](domain.md) §2.4, [schema.md](schema.md) §2.4, [user-stories.md](user-stories.md) story 9 round-3A).
- **Why it matters:** if the observed PersonaLLM behavior turns out to be "edits apply live," downstream users will be surprised by v0's snapshot semantics.
- **Action:** run PersonaLLM, edit a Character, check whether pre-existing Conversations reflect the edit.
- **Related:** [creator-vision.md](creator-vision.md) §10 "Lorebook scoping re-validation" covers adjacent ground.

### 1.2 Grammar Agent concrete model picks (Basic + Advanced tiers)

- **Status:** tiers are committed as an abstraction; specific model IDs pending a small benchmark.
- **Seed default:** Basic tier = "nano / Flash-Lite class" (e.g., GPT-4.1-nano, Gemini Flash-Lite). Advanced tier = slightly better but **cheaper than GPT-4o-mini**; candidates include Gemini Flash, a small Claude below Haiku price, or capable open-weights models (Qwen, Llama). Free-text override is always available per-User.
- **Why it matters:** cost + quality balance for a v0-launch default.
- **Action:** benchmark a short error set against candidate models; pick one per tier.

### 1.3 Reinforcement Validator — concrete Levenshtein budget under 95% similarity

- **Status:** threshold committed at ≥95% similarity after normalization; exact numeric budget TBD.
- **Seed default:** 95% normalized similarity floor. Concrete edit-distance budget below that floor (e.g., ≤5% normalized edit distance, or ≤3 absolute edits) is unresolved ([creator-vision.md](creator-vision.md) §7, §10).
- **Why it matters:** tuning determines whether rewrite passes feel fair.
- **Action:** small user test after implementation.

### 1.4 Spanish / Spanglish upgrade-hint detection window

- **Status:** soft upgrade hint committed (story 42 round-3A); recent-message window size and "frequent" threshold pending.
- **Seed default:** none committed — logged here verbatim so the downstream implementer picks a starting value and tunes after real usage.
- **Why it matters:** detects whether Basic tier is actually serving this user well.
- **Action:** pick an initial detection window (suggested: 20 most recent user messages, Spanish-dominant in ≥ 40% of them triggers the hint) and tune after usage.

---

## 2. Silent defaults committed by this seed

Committed defaults that were NOT escalated to the creator because they are medium- or low-impact. Surfaced here so the creator can override at any time. All align with creator-vision and user-stories round-3 decisions.

### 2.1 User experience

- **Sidebar open/closed persistence** — per-User ([ux.md](ux.md) §2; story 29 round-3C).
- **Grammar sidebar correction ordering** — newest-first ([ux.md](ux.md) §4.6; story 30 round-3C).
- **Continue-generation storage shape** — appended to the selected `MessageVariant.content` ([schema.md](schema.md) §2.6; story 19 round-3C).
- **Suggested Replies default** — OFF (matches PersonaLLM conservatism and chat-first framing — story 20 round-3C).
- **F3 bidirectional isolation** — committed bidirectional: Conversation Agent receives no Grammar data; Grammar Agent receives no Character / UserPersona / Lorebook / Memory / Author's Notes data ([architecture.md](architecture.md) §5; [domain.md](domain.md) §7.2; [user-stories.md](user-stories.md) §6 F3 round-3C).
- **Onboarding persona prompt** — NO persona question at onboarding (round-3C). Learner vs Power Creator is an internal seed concept only.
- **Tap-on-Character navigation target** — land in the **most recent Conversation**; if none, create one and navigate. No Character landing page in v0 ([ux.md](ux.md) §4.4, this conversation round-3).
- **First-launch fiction-disclaimer overlay** — full screen contract documented ([ux.md](ux.md) §4.1, this conversation round-3).

### 2.2 Data / domain

- **Scenario is not a first-class entity in v0.** Collapsed into `Character.scenario` text field, appended to the Character card block in the 11-position system prompt ([domain.md](domain.md) §3.4; [schema.md](schema.md) §2.3; story 12 round-3B).
- **Author's Notes scope in v0** — per-Conversation only (medium-impact). Global and Character-scoped notes deferred to post-v0 ([domain.md](domain.md) §2.10).
- **MemoryDocument branching behavior** — new branch starts **empty** (does not copy parent's RAG documents). Alternative of copying is not committed ([domain.md](domain.md) §4.2; [schema.md](schema.md) §2.8).
- **`conversation_branches` encoding** — fields on `conversations` by default; a separate table is an acceptable alternative ([schema.md](schema.md) §2.12).
- **Anonymous user retention** — 90 days of inactivity before pruning (inferred default).
- **Anonymous cross-device behavior** — opening the app in a different browser/device creates a fresh anonymous User; previous data stays on the original browser. A **persistent, low-pressure "Sign up to access from anywhere" nudge** is visible while anonymous, plus a dismissible first-visit banner on Home and Chat ([ux.md](ux.md) §2, §6). No blocking modal. (Confirmed by creator, this conversation.)
- **Error categories enum** — canonical v0 list: `verb_tense`, `articles`, `prepositions`, `word_order`, `filler_words`, `overused_words` ([schema.md](schema.md) §2.14). Extensions possible.

### 2.3 Security / privacy

- **`users.byok_keys` encryption envelope** — per-user data key approach preferred; single app-level key is acceptable as a simpler alternative. Not committed.
- **Email verification** — non-blocking; enforced only for password-reset ([architecture.md](architecture.md) §7; story 4 round-3B).

### 2.4 UI / visual

- **Light mode** — not committed in v0; dark-only.
- **Exact brand hex palette and icon library** — approximations in [design.md](design.md) §4; calibrate against real brand assets before implementation.
- **Bubble-color-theme per-property breakdown** — which CSS variables each theme sets. Not committed.
- **Rewrite gate escape hatch** — "Skip this turn (no grammar)" button is **not** in v0. The 3-strike fallthrough is the only exit.

---

## 3. Deferred to post-v0 (explicit non-goals — do not invent)

These are OUT of v0 scope per [creator-vision.md](creator-vision.md) and [product.md](product.md). Logged here so downstream generators do not accidentally implement them.

- **Flutter mobile client timing** — some v0.x, v1, or later. Not v0.
- **iOS local on-device mode timing & framework** — `fllama` vs `llama_cpp_dart` vs MLX vs MLC-LLM. Not v0.
- **Community surface** — browse / share / rate / favorite / follow / download / flag.
- **Credits / monetization surface.**
- **Apple SignIn.**
- **App Lock biometric flow.**
- **Multi-NPC in a single chat, Story, Scenario-as-entity, Quest, Plot, Master Agent.**
- **Resume-after-disconnect beyond SPA basics.**
- **Export / backup / restore / search / notifications / UI localization.**
- **Local Kokoro TTS.**
- **Light mode.**
- **PWA shell / offline caching strategy.**
- **Branch-tree navigator** (Conversations List + breadcrumb is enough in v0).

---

## 4. Reference conflicts

Items where [PersonaLLM-Reference/](PersonaLLM-Reference/) content diverges from v0 scope. These are **resolved by divergence** — the seed intentionally says something different. Logged here so downstream systems do not re-introduce the PersonaLLM behavior by accident.

### 4.1 Resolved by v0 divergence

- **Lorebook scoping** — PersonaLLM: per-Character. v0: **per-Conversation**. ([creator-vision.md](creator-vision.md) §3; story 25.) Residual re-validation is §1.1.
- **Community** — PersonaLLM has it; v0 does not.
- **Credits** — PersonaLLM has them; v0 does not.
- **Apple SignIn** — PersonaLLM uses it; v0 uses Supabase Auth with email / Google / GitHub.
- **App Lock biometric** — PersonaLLM has Face ID; v0 has plain sign-out + account delete.
- **Scenario as first-class entity** — PersonaLLM: `Scenario[]` under Character. v0: single `Character.scenario` text field appended to system prompt; not rendered as message #0.
- **Onboarding flow** — PersonaLLM: 5-slide linear flow with Apple verification + Cloud AI Consent. v0: fiction-disclaimer overlay on first launch + inline Cloud AI Consent on first BYOK entry; no forced UserPersona setup.
- **Platform** — PersonaLLM is iOS-only. v0 is web-first (React + Vite SPA on Cloudflare Pages) with Python + FastAPI + LangGraph backend and Supabase data layer.

### 4.2 PersonaLLM open questions the v0 seed deliberately leaves open

Items from [PersonaLLM-Reference/99-open-questions.md](PersonaLLM-Reference/99-open-questions.md) that still apply to v0 when v0 inherits the behavior:

- **Full verbatim text of Storybook and Texting writing-style preset bodies** — only Roleplay was captured. v0 ships Storybook and Texting as built-ins per [creator-vision.md](creator-vision.md) §5.7 but the directive strings need a verbatim pass.
- **Rolling Summary template text** — not captured in PersonaLLM screenshots.
- **Position 11 "Suggested Replies" presence** — always in the system prompt vs only when the user taps the pill. Implementation detail, not a seed-level decision.
- **Concatenation vs role-split** of the 11 positions in the actual API payload. Implementation detail.
- **`gender` enum** on UserPersona — PersonaLLM observed Male/Female only; v0 should widen. Exact set not committed.
- **Auto-image trigger heuristic** — "every message? cooldown? scene-change detection?" Implementation tuning.
- **Voice input UI specifics** — push-to-talk vs streaming, in-place vs modal. Not blocking for seed generation.

### 4.3 PersonaLLM open questions that are irrelevant to v0

These were open in the reference pass but are moot in v0 due to scope cuts. Listed for completeness:

- Community categories, tags, ranking, moderation — cut.
- Credits economics, tiers — cut.
- Bottom-tab-icon identity — v0 uses sidebar + top nav only.
- Apple SignIn wire — cut.
- Character-editor Lorebook section content — cut (Lorebook moved to Chat screen).

---

## 5. Discovery notes (surfaced during seed generation)

Items that emerged while drafting the lower-priority seed files. None of these are blockers for v0 but each deserves eyes before implementation.

### 5.1 Grammar Agent + BYOK interaction (resolved)

**Resolved** (confirmed by creator, this conversation):

- The Grammar Agent **shares the user's Text Engine BYOK key / endpoint**. Settings → Grammar selects the **model ID only** (via Basic / Advanced tier + free-text override). No separate Grammar Provider surface; no separate `provider_configs` row.
- If the user has not configured a Text Engine provider, the **Grammar Master toggle is disabled** with an inline CTA to Settings → Text Engine.

### 5.2 Grammar tier + key relationship

When a user picks **Advanced** and provides a custom model override that their BYOK provider does not support, what happens? Seed-committed default: **runtime error surfaced as an inline correction-unavailable notice, plus a hint in Settings → Grammar**. The Conversation Agent is unaffected.

### 5.3 SFW disable + pending message

If a user toggles SFW OFF during an active Conversation, does the system guardrail get removed mid-conversation or only for future turns? Seed-committed default: **future turns only** — the existing system prompt in the in-flight request is not mutated mid-stream. The next user turn sees the absence of the guardrail.

### 5.4 Account upgrade mid-rewrite

If the user links an account during a Reinforcement rewrite gate, does the 3-strike counter survive? Seed-committed default: **yes** — the counter is attached to the `GrammarCorrection` row, which is preserved across account upgrade (F5).

### 5.5 Insights Job concurrency

Two tabs open, both trigger an Insights refresh — race condition. Seed-committed default: **serialize at the DB level** via a lock on the `grammar_aggregates` row or an advisory lock. Implementation detail, not a seed-level decision, but flagged.

### 5.6 MessageVariant during rewrite

Can the user regenerate the NPC reply while in a rewrite gate? Seed-committed default: **no** — the NPC has not replied yet when the rewrite gate is active. Regenerate is only available after the NPC's reply exists.

### 5.7 Fork while streaming

Can the user click Fork while the Conversation Agent is streaming? Seed-committed default: **no** — Fork waits for the stream to complete. Prevents half-replies from landing in the child Conversation.

### 5.8 Grammar Panel frequency semantics

Sidebar frequency `every_3` / `every_5` means "surface a new panel entry every N user messages". Seed-committed default: **the Grammar Agent still runs on every user message** (invariant in [domain.md](domain.md) §6). Frequency controls only which `GrammarCorrection` rows appear in the panel's list render.

### 5.9 UserPersona cardinality

[creator-vision.md](creator-vision.md) §2 says "UserPersona (0..1, optional)". PersonaLLM has `isDefault` and more than one persona. Seed commits to **0..1 in v0**; if the creator decides later to allow many, the schema change is additive (drop the unique constraint).

### 5.9.1 BYOK encryption envelope (resolves §2.3)

Plan 0007 commits the envelope: **Supabase Vault**, one
`vault.secrets` row per `provider_configs` row, referenced by a
`vault_secret_id` uuid column. Save / rotate / delete flow through
`SECURITY DEFINER` PL/pgSQL functions that verify `auth.uid()` and
then `vault.create_secret(...)` / `delete from vault.secrets`. Plaintext
never leaves server-side memory: the client only submits the key; Vault
stores it encrypted under Supabase's managed key; decryption for the
Conversation Agent (cycle 0008+) happens inside another SECURITY
DEFINER function the backend calls on the user's behalf. Satisfies
architecture.md §3, §6.1 and `users.byok_keys` "envelope-encrypted at
rest" in schema.md §2.1.

### 5.10 User-message text storage

[schema.md](schema.md) §2.5 does not give `messages` a text column; §2.6 scopes `message_variants` to **assistant** messages only. There is therefore no committed home for a user message's text. Seed-committed default (plan 0006, append-only during implementation): **add a `text` column on `public.messages`**, populated for `role='user'` rows. Assistant text continues to live in the active `message_variants.content`. Rationale: matches the edit-as-trim semantics — user text is a single value that an edit replaces in place, while assistant text is a history of variants the user navigates between. If the creator later decides user messages should also use `message_variants`, the migration is additive (backfill + drop the `text` column).

---

## 6. How to use this register

- Read this register **before** generating downstream artifacts from the seed.
- If you see an item you can resolve with the creator, resolve it and remove (or strike through) the entry — then update the higher file it affects.
- If you encounter an ambiguity not listed here, add it — do not silently invent an answer in a downstream artifact.
- If you see an item that is now stale (because a higher file has answered it), remove the entry and leave a git/history note.

---

## Cross-references

- [creator-vision.md](creator-vision.md) §10 (creator-facing resolved + remaining open).
- [user-stories.md](user-stories.md) §10 (story-level gaps).
- [PersonaLLM-Reference/99-open-questions.md](PersonaLLM-Reference/99-open-questions.md) (reference-pass open questions, segmented above).
- Every other seed file in [.](.) — each emits items into this register when it commits a medium-impact default.
