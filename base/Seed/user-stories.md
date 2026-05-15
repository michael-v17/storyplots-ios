# User Stories — StoryPlots v0

> **Authority:** Second-highest in the seed, after [creator-vision.md](creator-vision.md). Lower-priority seed files (`product.md`, `ux.md`, `domain.md`, `architecture.md`) must align with stories here. Conflicts with `creator-vision.md` are resolved in favor of `creator-vision.md` and recorded in `open-questions.md`.
>
> **Generated per** [user_stories_instructions.md](../user_stories_instructions.md).
>
> **v3 — reconciled with updated `creator-vision.md`.** Changes from v2: Supabase Auth (not BetterAuth); Grammar master toggle default-OFF (not on); branching **copies** grammar rows (flipped); editing a prior Message **trims** the feed and the edited message receives a fresh grammar pass (flipped); Lorebook is per-Conversation (scoping changed); added typography-rendering and per-Conversation Lorebook stories; added reinforcement 3-strike cap and ≥95% similarity threshold; TTS default-OFF with named providers; ComfyUI per-style workflow configuration; Dashboard adds Reinforcement performance block.

---

## 1. Purpose

This document captures the **user-centered behaviors** that StoryPlots v0 must support, framed as discrete user stories. It exists so downstream generators (product / UX / domain / architecture) understand **what users actually need to do**, not just what screens exist.

It is **not** a sprint backlog. It is a foundational truth document: each story is a load-bearing user outcome that the implementation must preserve.

---

## 2. Story-writing rules

Every story uses this schema:

```
### <number>. <Title>  ·  <Priority>  ·  [<Provenance tag>]

- **As a** <single dominant persona>
- **I want** <capability>
- **So that** <outcome>
- **Why it matters:** <traced to creator-vision §X>
- **Acceptance criteria:**
  - [ ] <criterion>
  - [ ] **<bold = architectural invariant from creator-vision>**
- **Related screens:** <screen names or routes>
- **Related domain entities:** <entity names from creator-vision §2>
- **Constraints / notes:** <non-negotiable rules, secondary persona, cross-links>
```

**Tagging convention:**
- `[Observed]` — preserved verbatim from PersonaLLM.
- `[Extension]` — net-new in v0.
- `[Observed + Extension]` — base from PersonaLLM, modified by v0.

**Persona discipline:** every story names exactly one dominant persona in the **As a** line. A secondary persona, if relevant, is mentioned in `Constraints / notes`.

**Architectural invariant repetition:** load-bearing rules from `creator-vision.md` §7 / §8 are restated as **bold acceptance criteria** on every story they constrain. Repetition is intentional.

---

## 3. Prioritization rules

| Priority | Meaning |
|---|---|
| **Critical** | MVP must-ship. Removing it breaks v0 product identity per `creator-vision.md` §1. |
| **High** | Required for v0 to feel complete and match PersonaLLM depth. |
| **Medium** | In v0 scope; acceptable to ship in a second pass. |
| **Low** | In v0 scope but lowest-leverage; may be stubbed. |

**MVP cutline (Critical only):** Supabase anonymous session → BYOK key entered → create or import a Character → start a Conversation → send a message → receive an NPC reply → Grammar Module is *reachable and opt-in* (master toggle, inline correction, Dashboard primary nav). Grammar is default-OFF per `creator-vision.md` §5.0 — the MVP ships with all grammar surfaces present and working, but the Learner must opt in to see corrections. This distinction is enforced in flow F1.

**Product positioning (confirmed by creator, review round 3):** StoryPlot v0 is positioned as **a chat app with grammar as an opt-in extension** — not as a grammar-first language-learning app and not as equal pillars. The Critical path (F1 steps 1–6) must work without the Learner ever touching grammar settings. Grammar surfaces (Settings → Grammar, `/grammar` Dashboard, Home snapshot) must exist and work, but they are a *strong opt-in*, not a first-run imposition. This stance propagates into `product.md` priorities, Home copy, and onboarding tone.

---

## 4. Personas

### P1 — **Learner** (primary)
An English learner using StoryPlots to practice through 1:1 chat with an AI companion. Cares about: low-friction defaults, getting corrections when they want them, seeing measurable progress. Explicitly identified in `creator-vision.md` §1. Spanish/Spanglish speakers are a real subset (see `creator-vision.md` §5.2 Spanish handling).

### P2 — **Power Creator** (secondary, inferred)
A user who tunes their own Characters, edits the 11-position prompt assembly, configures BYOK providers, picks Grammar Agent tiers, and uses per-Conversation Lorebook / Author's Notes / MessageVariant heavily. Inferred from `creator-vision.md` §8 principle 4 ("power-user depth preserved"). The same human may play both personas at different moments — the split is interpretive, not exclusive. See §10 #8.

---

## 5. Core user stories

### 5.1 Onboarding & Auth

#### 1. Sign up with email, Google, or GitHub  ·  Critical  ·  [Extension]

- **As a** Learner
- **I want** to create an account with email/password, Google, or GitHub
- **So that** my Characters, Conversations, and BYOK keys persist
- **Why it matters:** v0 uses **Supabase Auth (JWT)** per `creator-vision.md` §6. Three providers are the v0 set; no Apple, no Microsoft.
- **Acceptance criteria:**
  - [ ] Email + password (and/or magic link) works end-to-end via Supabase Auth
  - [ ] Google OAuth works end-to-end
  - [ ] GitHub OAuth works end-to-end
  - [ ] **Per-user data isolation is enforced by Supabase RLS**, not hand-written checks (`creator-vision.md` §6, §8 principle 5)
  - [ ] No Apple SignIn anywhere
- **Related screens:** `/sign-in`, `/sign-up`
- **Related domain entities:** `User`, `Session`
- **Constraints / notes:** BYOK keys stored encrypted in `User.byok_keys` scoped by RLS.

#### 2. Use the app as a guest without signing up  ·  Critical  ·  [Extension]

- **As a** Learner (first-time visitor)
- **I want** to start using StoryPlots immediately as an anonymous guest
- **So that** I can try the product without committing to an account
- **Why it matters:** Guest mode uses **Supabase anonymous sign-in**, which produces a real `User` row + JWT (`creator-vision.md` §6). Upgrading to a full account links providers without data migration.
- **Acceptance criteria:**
  - [ ] First visit creates an anonymous Supabase `User` + JWT
  - [ ] Guest data (Characters, Conversations, BYOK keys, Grammar) persists across return visits
  - [ ] Guest session persists ~90 days of inactivity before pruning (inferred default per `creator-vision.md` §6)
  - [ ] Upgrading the anonymous User (linking email / OAuth) preserves all data — no migration step
  - [ ] **Per-user isolation via RLS applies to anonymous Users identically to authenticated Users.**
- **Related screens:** Home, account-upgrade dialog
- **Related domain entities:** `User` (anonymous variant), `Session`
- **Constraints / notes:** —

#### 3. Reset a forgotten password  ·  Critical  ·  [Extension]

- **As a** Learner
- **I want** to recover access to my account if I forget my password
- **So that** I don't lose my Characters, Conversations, and grammar history
- **Why it matters:** Implicit requirement of email auth (story 1). Supabase Auth ships this flow out of the box.
- **Acceptance criteria:**
  - [ ] "Forgot password" link on `/sign-in`
  - [ ] Supabase-managed recovery email is sent
  - [ ] Reset preserves all `User`-scoped data
- **Related screens:** `/sign-in`, `/reset-password`
- **Related domain entities:** `User`, `Session`
- **Constraints / notes:** Not explicit in `creator-vision.md`; standard for Supabase Auth.

#### 4. Verify my email address  ·  High  ·  [Extension]

- **As a** Learner
- **I want** to verify my email after signup
- **So that** account recovery (story 3) works reliably
- **Why it matters:** Supabase Auth standard flow.
- **Acceptance criteria:**
  - [ ] Verification email sent by Supabase on signup
  - [ ] **Verification is NON-blocking** — users can sign in and use the app immediately after signup, whether or not they've clicked the verification link. Matches the app's "use as guest, upgrade when needed, confirm identity only when required" progressive-auth stance (confirmed by creator, review round 3). Verification is effectively enforced by password-reset flows (story 3).
  - [ ] Verification status visible in Settings → Data & Security
- **Related screens:** Settings → Data & Security, email
- **Related domain entities:** `User.emailVerified`
- **Constraints / notes:** Progressive auth model: guest-usable (story 2) → signed-in unverified (OK) → verified (required for recovery) → SFW disable requires signed-in + 18+ (story 6). Each gate only demands as much identity as it needs.

#### 5. See the fiction disclaimer on first launch  ·  High  ·  [Observed]

- **As a** Learner
- **I want** to be shown the fiction disclaimer and content guidelines once
- **So that** I understand what is and isn't allowed
- **Why it matters:** Content safety baseline (`creator-vision.md` §6). Non-blocking.
- **Acceptance criteria:**
  - [ ] Shown on first launch only
  - [ ] Dismissible
  - [ ] Restated in Settings → Data & Security
- **Related screens:** First-launch overlay; Settings → Data & Security
- **Related domain entities:** `User.preferences`
- **Constraints / notes:** Cloud AI Consent is **inline on first API-key entry**, not bundled here (`creator-vision.md` §6).

#### 6. Disable SFW with explicit 18+ confirmation  ·  Medium  ·  [Observed + Extension]

- **As a** Power Creator (authenticated, non-anonymous)
- **I want** to disable SFW mode after explicitly confirming I am 18+
- **So that** I can use the product without the system-owned SFW pre-filter
- **Why it matters:** SFW is the default (`creator-vision.md` §6). Disabling is the only gate that requires 18+ confirmation; signup does not.
- **Acceptance criteria:**
  - [ ] Toggle exists in Settings → Data & Security; flips `User.sfw_disabled`
  - [ ] Disabling SFW shows a blocking 18+ confirmation modal
  - [ ] Disabling is allowed only for authenticated (non-anonymous) `User`s
  - [ ] **Disabling removes the text guardrail block and the image NSFW-negative additions. It does NOT add any pro-NSFW instruction.** (`creator-vision.md` §6 "Disabling SFW — what it does and does NOT do".)
  - [ ] **The SFW pre-filter prompts are system-owned and not user-editable anywhere** (`creator-vision.md` §5.7, §6).
- **Related screens:** Settings → Data & Security
- **Related domain entities:** `User.sfw_disabled`
- **Constraints / notes:** When SFW is on, a blocked image generation shows a brief notice (`creator-vision.md` §6 "Images"). Tag is mixed: age gate existed in PersonaLLM but moves to this point in v0.

---

### 5.2 Character lifecycle

#### 7. Create a new Character from scratch  ·  Critical  ·  [Observed + Extension]

- **As a** Learner
- **I want** to create a new Character with name, persona, scenario, greeting, example messages, and English Style
- **So that** I have an AI companion to chat with
- **Why it matters:** Characters are the root of every Conversation (`creator-vision.md` §2).
- **Acceptance criteria:**
  - [ ] All PersonaLLM Character fields are editable (see `PersonaLLM-Reference/04-screens/character-info.md`)
  - [ ] **English Style** dropdown exists with: Formal American, Neutral American (default), Casual American
  - [ ] **Lorebook is NOT on the Character editor in v0** — it lives in the Chat screen because Lorebook is per-Conversation (`creator-vision.md` §3, §5.3, §9 "Changed")
  - [ ] Saving creates a `Character` row scoped to the current `User` via RLS
  - [ ] The new Character appears on Home (Recent) and `/characters`
- **Related screens:** Character editor (`PersonaLLM-Reference/04-screens/character-info.md`)
- **Related domain entities:** `Character`, `User`
- **Constraints / notes:** **English Style affects NPC speech only — never the Grammar Agent** (`creator-vision.md` §5.3, §8 principle 8). Power Creators use this story too.

#### 8. Import a Character from JSON or PNG card  ·  High  ·  [Observed]

- **As a** Power Creator
- **I want** to import a Character from a JSON file or PNG character card
- **So that** I can reuse Characters made elsewhere
- **Why it matters:** Power-user depth preserved (`creator-vision.md` §8 principle 4).
- **Acceptance criteria:**
  - [ ] JSON import path works (PersonaLLM format)
  - [ ] PNG card import path works (embedded JSON)
  - [ ] Imported Character is scoped to the current `User` via RLS
  - [ ] Community-sourced characters are **not** importable (no Community surface in v0)
- **Related screens:** `PersonaLLM-Reference/04-screens/character-import.md`
- **Related domain entities:** `Character`
- **Constraints / notes:** —

#### 9. Edit an existing Character  ·  High  ·  [Observed + Extension]

- **As a** Power Creator
- **I want** to edit any field on an existing Character (including English Style)
- **So that** I can refine the companion's persona and register over time
- **Why it matters:** Iteration on Characters is core (`creator-vision.md` §5.3).
- **Acceptance criteria:**
  - [ ] All editor fields are editable post-creation
  - [ ] **Character edits apply to NEW Conversations only.** Existing Conversations use a snapshot of the Character's prompt-relevant fields taken at Conversation-creation time (story 12) and are NOT retroactively updated. Matches inferred PersonaLLM behavior (confirmed by creator, review round 3). See §10 #1 for the re-validation note.
  - [ ] Existing Conversations are not deleted by an edit
  - [ ] **The Character editor does not expose Lorebook** — Lorebook lives per-Conversation (`creator-vision.md` §3)
- **Related screens:** Character editor
- **Related domain entities:** `Character`, `Conversation` (via `character_snapshot`)
- **Constraints / notes:** Snapshot semantics are committed by this document; downstream `schema.md` must carry snapshot fields on `Conversation`. Learners also use this story.

#### 10. Delete a Character  ·  High  ·  [Observed]

- **As a** Learner
- **I want** to delete a Character I no longer use
- **So that** my Character list stays manageable
- **Why it matters:** Standard lifecycle.
- **Acceptance criteria:**
  - [ ] Confirmation prompt
  - [ ] Deletion cascades to all of that Character's Conversations, Messages, MessageVariants, per-Conversation LorebookEntries, MemoryDocuments, AuthorsNotes, ConversationBranches, and `GrammarCorrection` rows
  - [ ] `GrammarAggregate` is recomputed (marked dirty)
- **Related screens:** Character list / info page
- **Related domain entities:** `Character`, `Conversation`, `Message`, `MessageVariant`, `LorebookEntry`, `MemoryDocument`, `AuthorsNote`, `ConversationBranch`, `GrammarCorrection`, `GrammarAggregate`
- **Constraints / notes:** Lorebook is per-Conversation, so it falls under the Conversation cascade rather than a Character-level list.

#### 11. See my full Character grid on `/characters`  ·  High  ·  [Observed]

- **As a** Learner
- **I want** the `/characters` page to show every Character I have
- **So that** I can pick beyond just the recents shown on Home
- **Why it matters:** Home is intentionally narrowed to recents (`creator-vision.md` §5.1).
- **Acceptance criteria:**
  - [ ] Grid lists all of the user's Characters
  - [ ] Empty state matches PersonaLLM ("No Companions Yet")
  - [ ] Create / Import CTAs are available
- **Related screens:** `/characters`
- **Related domain entities:** `Character`
- **Constraints / notes:** —

---

### 5.3 Conversation lifecycle

#### 12. Start a new Conversation with a Character  ·  Critical  ·  [Observed]

- **As a** Learner
- **I want** to open a Character and start a new Conversation thread
- **So that** I can begin chatting in a fresh context
- **Why it matters:** Each Conversation is an independent thread (`creator-vision.md` §2), with its own per-Conversation memory and Lorebook (`creator-vision.md` §3).
- **Acceptance criteria:**
  - [ ] "New Conversation" action from the top-bar Conversation switcher and Character info
  - [ ] Creates a new `Conversation` row scoped to that `Character` × `User`
  - [ ] **Conversation stores a snapshot of the Character's prompt-relevant fields at creation time** (`Conversation.character_snapshot` or equivalent). Subsequent edits to the source Character do NOT retroactively change this Conversation. See story 9.
  - [ ] Initial assistant turn renders the Character's greeting (from the snapshot)
  - [ ] **`Character.scenario` is injected as part of the system prompt** — appended to the Character card block in the 11-position assembly. It is NOT rendered as a visible message in the chat feed. (Confirmed by creator, review round 3.)
  - [ ] **New Conversations start with an empty Lorebook** (per-Conversation scoping — `creator-vision.md` §3)
- **Related screens:** Chat (`/chat/[characterId]/[conversationId]`)
- **Related domain entities:** `Character`, `Conversation` (with `character_snapshot`), `Message`
- **Constraints / notes:** Multiple Conversations per Character are explicitly in scope; they are **not** v1 Plots (`creator-vision.md` §8 principle 7). How the Character's `scenario` field is represented in the LLM context is unresolved (§10 #5).

#### 13. Switch between Conversations of the same Character  ·  High  ·  [Observed]

- **As a** Learner
- **I want** to switch among my existing Conversations via the top-bar Conversation switcher
- **So that** I can resume different threads
- **Why it matters:** Preserved from PersonaLLM (`creator-vision.md` §5.2).
- **Acceptance criteria:**
  - [ ] Top-bar switcher lists all Conversations for the active Character
  - [ ] Switching loads that Conversation's full history, Lorebook, Author's Notes, and Grammar panel state
  - [ ] URL reflects `/chat/[characterId]/[conversationId]`
- **Related screens:** Chat
- **Related domain entities:** `Conversation`
- **Constraints / notes:** Per-Conversation isolation of memory, Lorebook, and grammar data is mandatory (`creator-vision.md` §2, §3).

#### 14. Branch a Conversation at any message  ·  High  ·  [Observed + Extension]

- **As a** Power Creator
- **I want** to fork a Conversation at a chosen message ("Keep messages" or "Summarize & start fresh")
- **So that** I can explore alternate story paths without losing the original
- **Why it matters:** Branching is preserved (`creator-vision.md` §5.2). v0 extends it with explicit grammar-carryover semantics.
- **Acceptance criteria:**
  - [ ] Branch action available on any message
  - [ ] "Keep messages" creates a new `Conversation` initialized with prior turns up to the fork point
  - [ ] "Summarize & start fresh" creates a new `Conversation` seeded with a generated summary
  - [ ] Original Conversation is unaffected
  - [ ] **All `GrammarCorrection` rows belonging to the kept range are COPIED into the new Conversation with the new `conversation_id`.** Each branch is a self-contained Conversation with its own grammar history (`creator-vision.md` §5.2 "Branching × Grammar").
  - [ ] **Per-Conversation LorebookEntry rows in the kept range are COPIED into the new Conversation** with the new `conversation_id`, mirroring the grammar-carryover rule. The branch is fully self-contained — RAG retrieval and Grammar both work from turn one. (Confirmed by creator, review round 3.)
- **Related screens:** Chat, `PersonaLLM-Reference/04-screens/branch.md`
- **Related domain entities:** `Conversation`, `ConversationBranch`, `Message`, `GrammarCorrection`, `LorebookEntry`
- **Constraints / notes:** Grammar carryover default is now **COPY**, reversed from v2 of this file to match `creator-vision.md` §5.2.

#### 15. Delete a Conversation  ·  Medium  ·  [Observed]

- **As a** Learner
- **I want** to delete a Conversation
- **So that** I can clean up unused threads
- **Why it matters:** Standard lifecycle.
- **Acceptance criteria:**
  - [ ] Confirmation prompt
  - [ ] Cascade-deletes Messages, MessageVariants, MemoryDocuments, AuthorsNote, ConversationBranches, per-Conversation LorebookEntries, and `GrammarCorrection` rows for that Conversation
  - [ ] `GrammarAggregate` is marked dirty so Home / Dashboard re-aggregate
- **Related screens:** Chat / top-bar Conversation switcher
- **Related domain entities:** `Conversation`, `Message`, `MessageVariant`, `MemoryDocument`, `AuthorsNote`, `ConversationBranch`, `LorebookEntry`, `GrammarCorrection`, `GrammarAggregate`
- **Constraints / notes:** Lorebook is per-Conversation in v0 (`creator-vision.md` §3), so it is deleted with the Conversation — no "Character-level lorebook survives" caveat.

---

### 5.4 Chat interaction

#### 16. Send a message and receive an NPC reply  ·  Critical  ·  [Observed]

- **As a** Learner
- **I want** to type a message, press Enter, and get a reply from the NPC
- **So that** I can have a conversation
- **Why it matters:** The irreducible core loop (`creator-vision.md` §1).
- **Acceptance criteria:**
  - [ ] Enter sends; Shift+Enter inserts newline
  - [ ] User message appears immediately
  - [ ] Conversation Agent reply streams via SSE from FastAPI `/chat` (`creator-vision.md` §7)
  - [ ] Conversation Agent prompt assembly follows PersonaLLM's 11-position format
  - [ ] **The Conversation Agent prompt receives no Grammar data, ever** (`creator-vision.md` §7, §8 principle 3)
  - [ ] **When `User.sfw_disabled = false`, the system-owned SFW guardrail block is prepended to the system prompt** (`creator-vision.md` §6)
- **Related screens:** Chat, `PersonaLLM-Reference/04-screens/chat.md`
- **Related domain entities:** `Conversation`, `Message`, `Character`, `UserPersona`, `LorebookEntry`, `MemoryDocument`, `AuthorsNote`
- **Constraints / notes:** —

#### 17. Regenerate the assistant's last reply (MessageVariant)  ·  High  ·  [Observed]

- **As a** Power Creator
- **I want** to regenerate the assistant's last response and swipe between alternate variants
- **So that** I can pick the version I prefer
- **Why it matters:** PersonaLLM behavior preserved (`creator-vision.md` §5.2, §8 principle 4).
- **Acceptance criteria:**
  - [ ] Regenerate button on assistant messages
  - [ ] Variants are persisted as `MessageVariant` rows on the same `Message`
  - [ ] User can navigate between variants (left/right)
  - [ ] Selecting a variant defines which version the next turn responds to
  - [ ] **The Conversation Agent prompt receives no Grammar data, ever.**
  - [ ] **Assistant messages are never sent to the Grammar Agent** (`creator-vision.md` §7).
- **Related screens:** Chat, `PersonaLLM-Reference/04-screens/chat-controls.md`
- **Related domain entities:** `Message`, `MessageVariant`
- **Constraints / notes:** —

#### 18. Edit a prior message (destructive trim)  ·  High  ·  [Observed + Extension]

- **As a** Learner
- **I want** to edit a previous message knowing the feed will trim at that point
- **So that** I can fix a turn without leaving incoherent downstream context
- **Why it matters:** v0 redefines edit as a destructive trim (`creator-vision.md` §5.2 "Edit semantics"). Silently keeping downstream messages after a prior edit produces incoherent context.
- **Acceptance criteria:**
  - [ ] Edit action on user and assistant messages
  - [ ] Saving an edit **deletes all subsequent Messages** in that Conversation
  - [ ] **For edits of user messages when Grammar is enabled, the `GrammarCorrection` rows for the deleted Messages are removed, and the edited Message receives a fresh Grammar Agent pass.** (`creator-vision.md` §5.2, §7.)
  - [ ] Delete action with confirmation (simple delete, not edit)
  - [ ] **The "once corrected, not re-corrected" invariant still holds** — it refers to re-correcting the same `user_message_id` repeatedly. Editing produces a *new logical user message* (the old `GrammarCorrection` row was destroyed with the trim).
  - [ ] Confirmation dialog makes the destructive trim explicit before save
- **Related screens:** Chat, `PersonaLLM-Reference/04-screens/chat-controls.md`
- **Related domain entities:** `Message`, `MessageVariant`, `GrammarCorrection`
- **Constraints / notes:** Reversed from v2 of this file — v2 said edit does NOT re-run grammar. `creator-vision.md` §5.2 overrides that.

#### 19. Continue generation  ·  Medium  ·  [Observed]

- **As a** Power Creator
- **I want** to ask the model to continue from where it stopped
- **So that** I can extend a truncated reply
- **Why it matters:** PersonaLLM behavior.
- **Acceptance criteria:**
  - [ ] Continue action on the most recent assistant message
  - [ ] Continuation is appended to the same selected `MessageVariant` (default; storage shape revisitable in §10 #3)
  - [ ] **The Conversation Agent prompt receives no Grammar data, ever.**
- **Related screens:** Chat
- **Related domain entities:** `Message`, `MessageVariant`
- **Constraints / notes:** —

#### 20. See suggested replies  ·  Medium  ·  [Observed]

- **As a** Learner
- **I want** to optionally see suggested replies
- **So that** I have a starting point when I'm stuck
- **Why it matters:** PersonaLLM Chat Behavior setting.
- **Acceptance criteria:**
  - [ ] Configurable in Settings → Chat Behavior
  - [ ] When enabled, suggestions appear above the input
  - [ ] Tapping a suggestion fills the input (does not auto-send)
- **Related screens:** Chat, `PersonaLLM-Reference/04-screens/settings/chat-behavior.md`
- **Related domain entities:** `User.preferences`
- **Constraints / notes:** Suggested replies are not grammar-corrected unless the user actually sends them. Default on/off unresolved — §10 #6.

#### 21. Use Autopilot for assistant-only turns  ·  Medium  ·  [Observed + Extension]

- **As a** Power Creator
- **I want** to enable Autopilot so the model takes multiple turns without me typing
- **So that** I can let scenes play out
- **Why it matters:** PersonaLLM feature preserved; v0 adds explicit grammar isolation.
- **Acceptance criteria:**
  - [ ] Autopilot toggle on the chat surface
  - [ ] Autopilot generates assistant turns only — never user turns
  - [ ] **The Conversation Agent prompt receives no Grammar data, ever.**
  - [ ] **The Grammar Agent does NOT run on Autopilot-generated user messages** (`creator-vision.md` §5.2 "Autopilot × Grammar"). Autopilot output is not human input and must not pollute corrections or aggregates.
- **Related screens:** Chat
- **Related domain entities:** `Conversation`, `Message`
- **Constraints / notes:** Autopilot × Grammar rule is an explicit v0 Extension over PersonaLLM's unspecified behavior.

#### 22. Set Author's Notes per Conversation  ·  High  ·  [Observed]

- **As a** Power Creator
- **I want** to set Author's Notes on a per-Conversation basis to steer the NPC
- **So that** I can adjust tone or scene direction without editing the Character
- **Why it matters:** Power-user preservation (`creator-vision.md` §8 principle 4).
- **Acceptance criteria:**
  - [ ] Author's Notes editable from the Chat surface
  - [ ] Notes are injected into the Conversation Agent's prompt at the configured position
  - [ ] **Author's Notes are not visible to the Grammar Agent** (architectural isolation; principle 8 "Grammar is Character-independent").
- **Related screens:** Chat, `PersonaLLM-Reference/04-screens/authors-notes.md`
- **Related domain entities:** `AuthorsNote`, `Conversation`
- **Constraints / notes:** —

#### 23. Dictate a message via voice input  ·  Medium  ·  [Observed]

- **As a** Learner
- **I want** to speak my message instead of typing it
- **So that** I can practice spoken English and reduce typing friction
- **Why it matters:** PersonaLLM keeps a Speech Recognition settings surface (`creator-vision.md` §5.7); without a capture flow, the setting has no user value.
- **Acceptance criteria:**
  - [ ] Microphone affordance on the chat input
  - [ ] Dictated text fills the input (does not auto-send) so the Learner can review before sending
  - [ ] **Dictated, sent text is treated as an ordinary user message and goes through the Grammar Agent normally.**
  - [ ] Provider configurable in Settings → Speech Recognition
- **Related screens:** Chat, Settings → Speech Recognition
- **Related domain entities:** `Message`, `User.byok_keys`
- **Constraints / notes:** `creator-vision.md` does not detail the capture UI — see §10 #12.

#### 24. Read narration and dialogue as visually distinct typography  ·  High  ·  [Observed]

- **As a** Learner
- **I want** `*asterisk-wrapped text*` rendered as italic narration and `"quoted text"` rendered as plain dialogue
- **So that** long roleplay responses stay readable and I can tell what the character *does* from what the character *says*
- **Why it matters:** Explicit in `creator-vision.md` §5.2. Not cosmetic — this typographic convention is what makes roleplay replies readable AND drives dual-voice TTS routing (story 49).
- **Acceptance criteria:**
  - [ ] `*…*` renders as italic, visually de-emphasized (lighter tone on dark background)
  - [ ] `"…"` renders as normal-weight, full-contrast
  - [ ] Rendering is consistent across every message bubble, including variants
  - [ ] **The same text segmentation drives TTS voice routing** when TTS is enabled (narration → narrator voice; dialogue → character voice — story 49).
- **Related screens:** Chat
- **Related domain entities:** `Message`, `MessageVariant`
- **Constraints / notes:** Load-bearing for readability AND for the TTS path — regressing this breaks two user-visible behaviors.

#### 25. Edit the per-Conversation Lorebook from the Chat screen  ·  High  ·  [Extension]

- **As a** Power Creator
- **I want** to view and edit Lorebook entries for the active Conversation, from the Chat screen
- **So that** I can curate the facts the NPC recalls within this thread
- **Why it matters:** v0 scopes Lorebook per-Conversation (divergence from PersonaLLM — `creator-vision.md` §3, §9 "Changed"). Its UI moves from the Character editor into the Chat screen (`creator-vision.md` §5.2 "Lorebook in Chat").
- **Acceptance criteria:**
  - [ ] Lorebook panel/affordance accessible from the Chat surface (chat-controls or a side panel)
  - [ ] Create / edit / delete `LorebookEntry` scoped to the current Conversation
  - [ ] Entries are used by RAG retrieval for this Conversation only (`creator-vision.md` §3)
  - [ ] **Lorebook is NOT exposed on the Character editor** (story 9)
- **Related screens:** Chat → Lorebook panel
- **Related domain entities:** `LorebookEntry`, `Conversation`
- **Constraints / notes:** Auto Lore Extraction also writes here (story 41). The per-Conversation scoping may be re-validated — see `creator-vision.md` §10 "Lorebook scoping re-validation".

---

### 5.5 Grammar — inline corrections  `[Extension]`

#### 26. Toggle the Grammar Module on/off globally (default OFF)  ·  Critical  ·  [Extension]

- **As a** Learner
- **I want** a single master toggle that turns the entire Grammar Module on or off, and I want it to default to OFF
- **So that** I opt into grammar feedback rather than having it imposed on me
- **Why it matters:** `creator-vision.md` §5.0 and §5.7 both state the master toggle defaults to **OFF**. Grammar is opt-in at every layer (`creator-vision.md` §8 principle 2).
- **Acceptance criteria:**
  - [ ] Master toggle in Settings → Grammar
  - [ ] **Default state for every new `User` (including anonymous) is OFF**
  - [ ] When off: no inline correction, no sidebar panel, no Home widget, no Grammar Agent invocation
  - [ ] When off: the `/grammar` route loads and shows the friendly empty state (story 36)
- **Related screens:** Settings → Grammar, Home, Chat, `/grammar`
- **Related domain entities:** `User.preferences.grammar`
- **Constraints / notes:** —

#### 27. See an inline correction below my message (Mode A)  ·  Critical  ·  [Extension]

- **As a** Learner
- **I want** the corrected version of my message to appear inline, just below my bubble
- **So that** I see the right form immediately while context is fresh
- **Why it matters:** Verbatim from `creator-vision.md` §5.2 — the core grammar feedback channel.
- **Acceptance criteria:**
  - [ ] Visible only when Master + Inline Grammar are both on
  - [ ] Correction renders below my message in a distinct visual style
  - [ ] **Correction target is American English regardless of Character's English Style** (`creator-vision.md` §8 principle 8)
  - [ ] If my original message was already correct, no correction is shown (no false positives)
  - [ ] **If I write in Spanish or Spanglish, the Grammar Agent shows what I should have written in English** — it is a translation-aware corrector, not a "wrong language" rejecter (`creator-vision.md` §5.2 "Spanish / Spanglish handling"). This raises the bar for the Basic tier — see story 42 and §10 #9.
  - [ ] **The NPC reply does not wait on grammar by default** (`creator-vision.md` §8 principle 1). Reinforcement Mode (story 34) is the only sanctioned exception.
  - [ ] **A given user `Message` produces at most one `GrammarCorrection` row** for its current text. Re-renders and variant navigation do not trigger re-correction. (Editing a message trims and re-corrects the new text — see story 18.)
- **Related screens:** Chat
- **Related domain entities:** `GrammarCorrection`, `Message`
- **Constraints / notes:** —

#### 28. See a brief explanation alongside the correction (Mode B)  ·  High  ·  [Extension]

- **As a** Learner
- **I want** to optionally enable a plain-English explanation under the correction
- **So that** I understand **why** something was wrong, not just what to say
- **Why it matters:** `creator-vision.md` §5.2 Mode B.
- **Acceptance criteria:**
  - [ ] Settings → Grammar → Inline level selector: "Correction only" (Mode A) / "Correction + explanation" (Mode B)
  - [ ] When Mode B is on, explanation renders under the correction
  - [ ] Explanation length is short (one or two sentences)
  - [ ] **The explanation is produced in the same single Grammar Agent pass as the correction** (`creator-vision.md` §7).
  - [ ] **A given user `Message` produces at most one `GrammarCorrection` row.** Switching Mode A ↔ Mode B does not re-correct existing messages — only new ones.
- **Related screens:** Chat, Settings → Grammar
- **Related domain entities:** `GrammarCorrection.explanation`
- **Constraints / notes:** —

---

### 5.6 Grammar — sidebar panel  `[Extension]`

#### 29. Toggle the Grammar Sidebar from the chat input  ·  High  ·  [Extension]

- **As a** Learner
- **I want** a one-click toggle next to the send button to open/close the Grammar Sidebar
- **So that** I can surface the panel only when I want to focus on feedback
- **Why it matters:** Specified in `creator-vision.md` §5.2.
- **Acceptance criteria:**
  - [ ] Toggle visible only when Master + Sidebar Grammar are both on
  - [ ] Right-side panel slides open / closes
  - [ ] Open/closed state persists per-user (default — see §10 #2)
- **Related screens:** Chat
- **Related domain entities:** `User.preferences.grammar`
- **Constraints / notes:** —

#### 30. Review correction pairs in the sidebar (plain-text, two lines per pair)  ·  High  ·  [Extension]

- **As a** Learner
- **I want** the sidebar to list `original → corrected` pairs for this Conversation in plain text, two lines per pair
- **So that** I can review where I went wrong without scrolling chat history
- **Why it matters:** `creator-vision.md` §5.2 "Grammar Panel" specifies display format: **plain text, two lines per pair — first line original, second line corrected. No diff highlighting in v0.**
- **Acceptance criteria:**
  - [ ] First line = `original_text`, second line = `corrected_text`, plain text, no diff highlighting
  - [ ] Newest first (default — see §10 #2 for relevance-ranking alternative)
  - [ ] Scoped to the current Conversation only
  - [ ] **Surfacing rate respects Settings → Grammar → Sidebar frequency** (every / every 3 / every 5 / major errors only). This governs UI surfacing, not Grammar Agent invocation — the agent runs on every user message regardless (`creator-vision.md` §5.7, §7).
- **Related screens:** Chat → Grammar Sidebar
- **Related domain entities:** `GrammarCorrection`
- **Constraints / notes:** —

#### 31. See a per-Conversation grammar mini-summary in the sidebar  ·  High  ·  [Extension]

- **As a** Learner
- **I want** the sidebar to show my most overused words and most common error types **for this Conversation**
- **So that** I get a quick, focused signal scoped to the thread I'm in
- **Why it matters:** Explicit in `creator-vision.md` §5.2.
- **Acceptance criteria:**
  - [ ] Mini-summary computed from `GrammarCorrection` rows scoped to this `Conversation`
  - [ ] Updates as new corrections land
- **Related screens:** Chat → Grammar Sidebar
- **Related domain entities:** `GrammarCorrection`, `Conversation`
- **Constraints / notes:** Distinct from the macro Dashboard (story 36), which spans all Conversations.

#### 32. Clear grammar data for this Conversation  ·  High  ·  [Extension]

- **As a** Learner
- **I want** a "Clear grammar for this Conversation" action in the sidebar
- **So that** I can re-measure my improvement after focused practice
- **Why it matters:** Explicit in `creator-vision.md` §5.2 and §5.7.
- **Acceptance criteria:**
  - [ ] Action visible in the sidebar
  - [ ] Confirmation prompt before deletion
  - [ ] Deletes all `GrammarCorrection` rows scoped to this Conversation
  - [ ] Marks `GrammarAggregate.dirty = true` so Home / Dashboard re-aggregate
- **Related screens:** Chat → Grammar Sidebar
- **Related domain entities:** `GrammarCorrection`, `GrammarAggregate`
- **Constraints / notes:** Mirrored in Dashboard (story 38) and Data & Security.

---

### 5.7 Grammar — Reinforcement Mode  `[Extension]`

#### 33. Enable Reinforcement Mode  ·  High  ·  [Extension]

- **As a** Learner
- **I want** to enable a mode where I must rewrite my message after a correction before the NPC replies
- **So that** I practice the correct form in the moment
- **Why it matters:** `creator-vision.md` §5.2 and §5.7.
- **Acceptance criteria:**
  - [ ] Toggle in Settings → Grammar
  - [ ] Toggle is disabled (greyed) unless Inline Grammar is on
  - [ ] When enabled, Reinforcement Mode applies to all of this user's Conversations
- **Related screens:** Settings → Grammar
- **Related domain entities:** `User.preferences.grammar`
- **Constraints / notes:** Reinforcement is the **only** sanctioned way grammar may block the NPC (`creator-vision.md` §8 principle 1).

#### 34. Be prompted to rewrite my message, with a 3-strike cap  ·  High  ·  [Extension]

- **As a** Learner with Reinforcement Mode on
- **I want** the input to be replaced with a rewrite prompt when my message had real errors, but to never be trapped after 3 failed attempts
- **So that** I practice corrections without being locked out of the conversation
- **Why it matters:** `creator-vision.md` §5.2, §7, §8 principle 6.
- **Acceptance criteria:**
  - [ ] User sends message → Grammar Agent runs → if errors, rewrite prompt replaces input
  - [ ] If original was already correct, NO rewrite is asked — zero friction for good input (`creator-vision.md` §7)
  - [ ] **A given user `Message` produces at most one `GrammarCorrection` row for its current text.** Rewrite attempts are validated locally, never by an LLM.
  - [ ] **Reinforcement validation is local, non-LLM — string distance only, after normalization** (`creator-vision.md` §7).
  - [ ] Pass threshold: **≥95% similarity** after normalizing case / whitespace / punctuation (`creator-vision.md` §7). Concrete Levenshtein budget still TBD — see §10 #8.
  - [ ] Validator is lenient on trivial differences (punctuation, whitespace, case), strict on real content (tense, articles, prepositions, word order)
  - [ ] On pass: NPC responds normally
  - [ ] On fail: user is asked to try again (no LLM cost)
  - [ ] **After 3 failed attempts the flow continues anyway** (NPC responds) and `GrammarCorrection.reinforcement_failures_count` is incremented (`creator-vision.md` §5.2 step 7, §7).
- **Related screens:** Chat
- **Related domain entities:** `Message`, `GrammarCorrection`
- **Constraints / notes:** 3-strike cap is a non-negotiable principle (`creator-vision.md` §8 principle 6).

---

### 5.8 Grammar — Dashboard & insights  `[Extension]`

#### 35. Open the Grammar Dashboard from primary nav  ·  Critical  ·  [Extension]

- **As a** Learner
- **I want** a `/grammar` route I can reach from the sidebar at any time
- **So that** I can check my macro progress
- **Why it matters:** Dashboard is MVP and a primary nav item (`creator-vision.md` §5.6).
- **Acceptance criteria:**
  - [ ] `/grammar` is a primary sidebar item
  - [ ] Page loads using pre-computed `GrammarAggregate` (no live aggregation on render)
  - [ ] **The Dashboard is never blocked waiting on the Insights Job.** If `dirty = true`, cached values render immediately and an async refresh runs in the background (`creator-vision.md` §7).
  - [ ] Empty-state friendly copy when no data exists yet: *"Your detected level, common errors, and overused words will appear here as you chat."* (`creator-vision.md` §5.6)
- **Related screens:** `/grammar`
- **Related domain entities:** `GrammarAggregate`
- **Constraints / notes:** Reachable even when Master Grammar is off (story 26) — showing the empty state is fine.

#### 36. See level, errors, fillers, connectors, AI feedback, reinforcement performance, and the full correction list  ·  Critical  ·  [Extension]

- **As a** Learner
- **I want** the dashboard to show all nine content blocks from `creator-vision.md` §5.6
- **So that** I get a meaningful macro view of my progress
- **Why it matters:** Verbatim content list in `creator-vision.md` §5.6.
- **Acceptance criteria:**
  - [ ] Detected English level
  - [ ] Most common errors (categorized)
  - [ ] Filler words / muletillas
  - [ ] Overused words
  - [ ] Connector analysis
  - [ ] AI narrative feedback
  - [ ] Improvement suggestions
  - [ ] **Reinforcement performance** — percentage of attempts that failed reinforcement, drawn from `GrammarCorrection.reinforcement_failures_count` (new in v3 per `creator-vision.md` §5.6)
  - [ ] Full correction list — scrollable, `original → corrected` pairs verbatim
  - [ ] Data is aggregated **across all the user's Conversations**
  - [ ] **The Insights Job operates on aggregated stats, not raw message text** (`creator-vision.md` §7).
- **Related screens:** `/grammar`
- **Related domain entities:** `GrammarAggregate`, `GrammarCorrection`
- **Constraints / notes:** —

#### 37. See a fast Grammar snapshot on Home  ·  High  ·  [Extension]

- **As a** Learner
- **I want** Home to show a small grammar widget (level + top errors + overused words)
- **So that** I get a glance signal without opening the dashboard
- **Why it matters:** `creator-vision.md` §5.1.
- **Acceptance criteria:**
  - [ ] Reads `GrammarAggregate` only (no live aggregation)
  - [ ] Hidden if Master Grammar is off OR if no data exists yet
  - [ ] When `dirty = true`, renders cached values immediately and triggers async refresh
  - [ ] **Home is never blocked waiting on the Insights Job.** Staleness is state-based (`dirty` flag), not time-based (`creator-vision.md` §7).
- **Related screens:** Home
- **Related domain entities:** `GrammarAggregate`
- **Constraints / notes:** —

#### 38. Clear all grammar data  ·  High  ·  [Extension]

- **As a** Learner
- **I want** a "Clear all grammar data" action on the Dashboard (and mirrored in Data & Security)
- **So that** I can start fresh and re-measure progress globally
- **Why it matters:** `creator-vision.md` §5.6 and §5.7.
- **Acceptance criteria:**
  - [ ] Action on Dashboard and Settings → Data & Security
  - [ ] Confirmation prompt
  - [ ] Deletes every `GrammarCorrection` and `GrammarAggregate` row for this `User`
  - [ ] Snapshot disappears from Home until new data lands
- **Related screens:** `/grammar`, Settings → Data & Security
- **Related domain entities:** `GrammarCorrection`, `GrammarAggregate`
- **Constraints / notes:** Per-Conversation clear is story 32.

---

### 5.9 Settings & power-user

#### 39. Configure my BYOK provider keys  ·  Critical  ·  [Observed + Extension]

- **As a** Learner
- **I want** to enter my own API keys for my chosen text provider
- **So that** I can use the chat at all (v0 is BYOK-only)
- **Why it matters:** v0 has no built-in inference (`creator-vision.md` §6, §11).
- **Acceptance criteria:**
  - [ ] Settings → Text Engine accepts an OpenRouter key (primary)
  - [ ] Local-network endpoints (Ollama / LM Studio / vLLM) are configurable
  - [ ] Cloud AI Consent appears **inline on first key entry**, not as an onboarding wall
  - [ ] Keys stored encrypted in `User.byok_keys`, isolated by RLS
  - [ ] **Text Engine is also where the Conversation Agent model is selected** (`creator-vision.md` §5.7); the Grammar Agent has its own selector in Settings → Grammar (story 42)
- **Related screens:** Settings → Text Engine, Settings → Data & Security
- **Related domain entities:** `User.byok_keys`
- **Constraints / notes:** —

#### 40. Edit the 11-position prompt assembly  ·  High  ·  [Observed]

- **As a** Power Creator
- **I want** full access to PersonaLLM's 11-position prompt editor
- **So that** I can fine-tune how the Conversation Agent's prompt is built
- **Why it matters:** Power-user depth preserved (`creator-vision.md` §8 principle 4).
- **Acceptance criteria:**
  - [ ] All 11 positions are editable
  - [ ] Templates from PersonaLLM are preserved
  - [ ] Changes apply to subsequent Conversation Agent calls
  - [ ] **The Grammar Agent uses its own prompt and is not affected by the prompt editor** (`creator-vision.md` §7)
  - [ ] **The SFW guardrail block is system-owned and NOT exposed in the Prompt Editor** (`creator-vision.md` §5.7, §6). Editable = trivial bypass.
- **Related screens:** Settings → Prompt Editor
- **Related domain entities:** `User.promptAssembly`
- **Constraints / notes:** —

#### 41. Tune RAG memory and Auto Lore Extraction  ·  High  ·  [Observed + Extension]

- **As a** Power Creator
- **I want** to configure RAG top-k, similarity threshold, recency weighting, and auto-lore-extraction cadence
- **So that** I can shape what the NPC remembers and retrieves within a Conversation
- **Why it matters:** PersonaLLM memory architecture preserved; v0 scopes per-Conversation (`creator-vision.md` §3, §9 "Changed").
- **Acceptance criteria:**
  - [ ] Settings → Memory exposes all PersonaLLM tuning knobs
  - [ ] Auto Lore Extraction prompt is editable
  - [ ] Default extraction cadence: every 3 turns
  - [ ] **Extracted `LorebookEntry` rows are written to the active Conversation only** (per-Conversation scoping — `creator-vision.md` §3)
  - [ ] **Vector storage is Supabase `pgvector`** (`creator-vision.md` §3, §11)
- **Related screens:** Settings → Memory
- **Related domain entities:** `LorebookEntry`, `MemoryDocument`, `User.preferences`
- **Constraints / notes:** Tag is mixed because the per-Conversation scope is a v0 Extension.

#### 42. Choose the Grammar Agent tier or override with a custom model  ·  High  ·  [Extension]

- **As a** Power Creator
- **I want** to choose between Basic and Advanced Grammar Agent tiers, or override with a custom model ID
- **So that** I can balance cost and quality, and handle Spanish/Spanglish input well
- **Why it matters:** `creator-vision.md` §5.7 and §7.
- **Acceptance criteria:**
  - [ ] Tier selector: Basic (default) / Advanced
  - [ ] Free-text "Custom model ID" field overrides the tier when filled
  - [ ] Setting persists across sessions
  - [ ] **Spanish/Spanglish handling raises the bar for Basic** — users who frequently write in Spanish may need Advanced (`creator-vision.md` §5.2, §7)
  - [ ] **When the Grammar Agent detects frequent non-English input over a recent window of user messages, a soft in-app hint surfaces in Settings → Grammar (and/or alongside corrections in the sidebar) suggesting the user switch to Advanced.** Basic stays the default — the hint is non-blocking and dismissible. (Confirmed by creator, review round 3.)
- **Related screens:** Settings → Grammar, optional hint surface in Chat → Grammar Sidebar
- **Related domain entities:** `User.preferences.grammar`, `GrammarCorrection` (detection signal)
- **Constraints / notes:** Concrete model picks are unresolved (§10 #7). The exact detection window and threshold for the upgrade hint is a §10 item — see §10 #9 (renamed). This story owns only the tier selector; Master / Inline / Sidebar / Reinforcement toggles are owned by stories 26, 28, 29, 33.

#### 43. Configure the Text-to-Speech engine (default OFF, named providers)  ·  Medium  ·  [Observed + Extension]

- **As a** Learner
- **I want** to configure my TTS provider so NPC messages can be voiced
- **So that** the playback action (story 49) works
- **Why it matters:** `creator-vision.md` §5.7 names the v0 providers and default state.
- **Acceptance criteria:**
  - [ ] Provider set (v0): **ElevenLabs**, **OpenAI TTS**, **WebSpeech** (browser native)
  - [ ] **Default state is OFF** — user opts in (`creator-vision.md` §5.7)
  - [ ] Two modes are exposed: **auto on every assistant message** OR **per-message playback** via a speaker icon (`creator-vision.md` §5.7)
  - [ ] Dual-voice selection is preserved from PersonaLLM (gender-matched)
  - [ ] **No local Kokoro option** (`creator-vision.md` §9)
- **Related screens:** Settings → Text-to-Speech
- **Related domain entities:** `User.byok_keys`, `User.preferences`
- **Constraints / notes:** —

#### 44. Configure the Image Engine — ComfyUI with per-style workflows  ·  Medium  ·  [Observed + Extension]

- **As a** Power Creator
- **I want** to configure ComfyUI by URL + port, test the connection, and upload per-style workflows with parameters
- **So that** my image generation supports multiple styles (anime / realistic / pixel) with tuned parameters
- **Why it matters:** v0 enriches PersonaLLM's Image Engine surface with explicit per-style workflow uploads (`creator-vision.md` §5.7).
- **Acceptance criteria:**
  - [ ] ComfyUI URL + port configurable (local or remote, e.g. `http://localhost:8188`)
  - [ ] "Test connection" action exists
  - [ ] Per-style workflow upload (**anime / realistic / pixel**) with parameters per workflow
  - [ ] Direct API providers remain configurable
  - [ ] Keys stored encrypted in `User.byok_keys`
- **Related screens:** Settings → Image Engine
- **Related domain entities:** `User.byok_keys`, `User.preferences`
- **Constraints / notes:** —

#### 45. Configure Visual Roleplay mode and resolution presets  ·  Low  ·  [Observed]

- **As a** Power Creator
- **I want** to configure when and how visual generation is triggered (mode + resolution presets)
- **So that** the Image Engine is used to suit my workflow
- **Why it matters:** `creator-vision.md` §5.7.
- **Acceptance criteria:**
  - [ ] Mode and resolution preset selectors in Settings → Visual Roleplay
  - [ ] Selections respected by inline image generation (story 50)
- **Related screens:** Settings → Visual Roleplay
- **Related domain entities:** `User.preferences`
- **Constraints / notes:** Behavioral spec in `PersonaLLM-Reference/04-screens/settings/visual-roleplay.md`.

#### 46. See the Video Engine settings stub  ·  Low  ·  [Observed]

- **As a** Power Creator
- **I want** the Video Engine surface to exist as a stub
- **So that** the slot is reserved for future expansion
- **Why it matters:** PersonaLLM parity (`creator-vision.md` §5.7).
- **Acceptance criteria:**
  - [ ] Settings → Video Engine page exists
  - [ ] No production video flow required in v0
- **Related screens:** Settings → Video Engine
- **Related domain entities:** —
- **Constraints / notes:** —

#### 47. Customize chat bubble colors  ·  Low  ·  [Observed]

- **As a** Learner
- **I want** to customize the user/assistant bubble colors
- **So that** the chat looks the way I prefer
- **Why it matters:** PersonaLLM Bubble Colors setting (`creator-vision.md` §5.7).
- **Acceptance criteria:**
  - [ ] Settings → Bubble Colors exposes color pickers for user and assistant bubbles
  - [ ] Selections persist and apply on Chat immediately
- **Related screens:** Settings → Bubble Colors, Chat
- **Related domain entities:** `User.preferences`
- **Constraints / notes:** —

#### 48. Sign out and delete account  ·  High  ·  [Observed + Extension]

- **As a** Learner (authenticated)
- **I want** to sign out, and to delete my account with all associated data
- **So that** I can leave the product cleanly
- **Why it matters:** Replaces PersonaLLM's App Lock with a simpler model (`creator-vision.md` §9).
- **Acceptance criteria:**
  - [ ] Sign out is one-click in Settings → Data & Security
  - [ ] Delete account requires confirmation (typed username or similar)
  - [ ] Delete cascades all `Character`, `Conversation`, `Message`, `MessageVariant`, `MemoryDocument`, `LorebookEntry`, `AuthorsNote`, `ConversationBranch`, `GrammarCorrection`, `GrammarAggregate`, and `UserPersona` rows for the `User`
  - [ ] Supabase session is revoked
- **Related screens:** Settings → Data & Security
- **Related domain entities:** `User` and all owned entities
- **Constraints / notes:** App Lock biometric flow is dropped (`creator-vision.md` §9).

---

### 5.10 Media (playback / generation / browse)

#### 49. Hear an NPC message via dual-voice TTS  ·  Medium  ·  [Observed + Extension]

- **As a** Learner
- **I want** to play an NPC message as audio, with narrator and character voices routed by typography
- **So that** I can hear pronunciation and distinguish narration from dialogue
- **Why it matters:** `creator-vision.md` §5.2 "Dual-voice TTS" + story 24 typography convention.
- **Acceptance criteria:**
  - [ ] Per-message play action on assistant messages (or auto-play if that mode is selected in story 43)
  - [ ] **Narration segments (`*…*`) are read by the narrator voice; dialogue segments (`"…"`) by the character voice** (`creator-vision.md` §5.2)
  - [ ] Voice selection respects Character / UserPersona gender (PersonaLLM behavior)
  - [ ] **Remote TTS provider only — no local Kokoro** (`creator-vision.md` §9)
  - [ ] **TTS reads whatever text the Conversation Agent produced** — no separate TTS content filter (`creator-vision.md` §6)
- **Related screens:** Chat
- **Related domain entities:** `Message`, `Character`, `UserPersona`
- **Constraints / notes:** Provider configured in story 43. Typography parsing in story 24 drives the voice-routing split.

#### 50. Generate an inline image for a message  ·  Low  ·  [Observed + Extension]

- **As a** Power Creator
- **I want** to generate an image for a message via my configured Image Engine
- **So that** the scene has a visual
- **Why it matters:** Preserved feature; v0 adds SFW image filtering (`creator-vision.md` §6).
- **Acceptance criteria:**
  - [ ] Action on assistant messages
  - [ ] Inline placeholder → rendered image
  - [ ] Generated image added to Gallery, scoped to the Character
  - [ ] Mode and resolution respect Settings → Visual Roleplay (story 45)
  - [ ] **When `User.sfw_disabled = false`, the pipeline prepends an SFW-friendly positive suffix and appends NSFW terms to the negative prompt** (`creator-vision.md` §6)
  - [ ] **If the filtered prompt still reads as NSFW, image generation is blocked** with a brief notice; the user can rewrite or (if eligible) disable SFW (`creator-vision.md` §6)
- **Related screens:** Chat, Gallery
- **Related domain entities:** `Message`, `GeneratedImage`, `Character`
- **Constraints / notes:** Provider configured in story 44.

#### 51. Browse the Gallery filtered by Character  ·  Low  ·  [Observed]

- **As a** Learner
- **I want** to browse generated images filtered by Character
- **So that** I can revisit visuals from a particular companion
- **Why it matters:** Preserved feature; v0 narrows the filter (no Stories exist).
- **Acceptance criteria:**
  - [ ] `/gallery` lists images
  - [ ] Filter by Character is available
  - [ ] Image viewer supports fullscreen, Edit Prompt, long-press actions
- **Related screens:** `/gallery`, Image viewer
- **Related domain entities:** `GeneratedImage`, `Character`
- **Constraints / notes:** —

---

### 5.11 User persona / profile

#### 52. Create or edit my UserPersona  ·  High  ·  [Observed]

- **As a** Learner
- **I want** to set a UserPersona (photo, name, gender, appearance, background story)
- **So that** the NPC has accurate context about who I am in roleplay
- **Why it matters:** Preserved from PersonaLLM (`creator-vision.md` §5.4); feeds the Conversation Agent prompt.
- **Acceptance criteria:**
  - [ ] All PersonaLLM fields editable
  - [ ] Gender-appropriate smart defaults fill blank fields
  - [ ] UserPersona is optional (0..1 per `creator-vision.md` §2)
  - [ ] UserPersona is injected into the Conversation Agent's prompt at the configured position
  - [ ] **UserPersona is never sent to the Grammar Agent.**
- **Related screens:** `/profile`
- **Related domain entities:** `UserPersona`, `User`
- **Constraints / notes:** —

---

## 6. Non-negotiable flows

These are cross-story critical paths. Each is a smoke test for v0.

### F1. First-run MVP flow (guest → first reply → optional grammar)

**Steps:**
1. Anonymous visit creates a Supabase anonymous `User` + JWT (story 2)
2. Enter BYOK key; inline Cloud AI Consent appears (story 39)
3. Create a Character (story 7) or import one (story 8)
4. Start a Conversation (story 12)
5. Send a message (story 16)
6. Receive an NPC reply (story 16), with `*narration*` vs `"dialogue"` rendered correctly (story 24)

**Optional grammar continuation (opt-in since Master is default-OFF per `creator-vision.md` §5.0):**

7. Open Settings → Grammar and flip Master ON (story 26); ensure Inline Grammar is ON (Mode A default)
8. Send another message → see inline correction (story 27)
9. Open `/grammar` → Dashboard shows the correction populating (stories 35, 36)

**Pass when:** steps 1–6 complete without touching grammar settings (MVP is a chat product first), and steps 7–9 work for users who opt in.

### F2. Reinforcement learning loop (including 3-strike cap)

**Steps:**
1. Learner has Master + Inline Grammar on; enables Reinforcement Mode (story 33)
2. Sends a flawed message (story 16)
3. Inline correction appears (story 27)
4. Rewrite prompt blocks the input (story 34)
5. Local validator compares rewrite to correction at ≥95% similarity after normalization
6. On pass → NPC responds (story 16)
7. If the user fails 3 times, the flow continues anyway; `reinforcement_failures_count` is incremented and later surfaced on the Dashboard (story 36)

**Pass when:** the rewrite gate appears only for flawed input, the 3-strike cap is enforced, and the Dashboard's Reinforcement performance block reflects counted failures.

### F3. Grammar isolation invariant

**Conversation-side direction (explicit in `creator-vision.md` §7, §8 principle 3):**
- For every Conversation Agent call (stories 16, 17, 18, 19, 21, 22), **no Grammar data appears in its prompt**.

**Grammar-side direction (strongly implied by §8 principle 8 "Grammar is Character-independent" and §7 multi-agent separation — still not stated bidirectionally; see §10 #10):**
- For every Grammar Agent call (stories 27, 28, 34), **no Character / UserPersona / Author's Notes / Lorebook / Memory data appears in its prompt** — only the user's raw message.

**Pass when:** logged prompts to both agents conform to the isolation rule on every turn.

### F4. Destructive edit propagation

**Steps:**
1. User edits a prior Message in a Conversation with multiple downstream turns (story 18)
2. Confirmation makes the trim explicit
3. All subsequent Messages (and their MessageVariants and GrammarCorrection rows) are deleted
4. The edited Message is re-sent, receiving a fresh Grammar Agent pass if grammar is enabled

**Pass when:** feed state after edit equals "Conversation ending at the edited Message" with no orphan downstream rows.

### F5. Account upgrade preserves data

**Steps:**
1. Use the app extensively as a guest (stories 2, 7, 12, 16)
2. Link an email / OAuth provider (story 1)
3. All Characters, Conversations, Messages, BYOK keys, and Grammar data remain attached to the same `User` row

**Pass when:** post-upgrade state is identical to pre-upgrade state modulo the auth method on the `User` row.

### F6. Branching carries grammar forward

**Steps:**
1. In a Conversation with several `GrammarCorrection` rows, fork at message N via "Keep messages" (story 14)
2. New Conversation is created with Messages 1..N
3. **GrammarCorrection rows for messages 1..N are COPIED into the new Conversation with the new `conversation_id`**
4. Per-Conversation LorebookEntries are copied too

**Pass when:** the new Conversation is self-contained — correction pairs and Lorebook are visible in its sidebar immediately, and modifying the original's grammar data does not affect the branch.

### F7. Re-measure progress

**Steps:**
1. Practice in a Conversation (stories 16, 27)
2. Clear grammar for the Conversation (story 32) or clear all (story 38)
3. Practice again
4. Dashboard / sidebar reflect only the new data

**Pass when:** post-clear views show no rows from before the clear, and Home / Dashboard reaggregate without manual refresh.

---

## 7. Acceptance-criteria conventions

- **Use checkboxes.** Each criterion must be independently testable.
- **Reference observable state, not implementation.**
- **Prefer absolute statements.** ("X never receives Y" > "X should not normally receive Y".)
- **Bold = architectural invariant** from `creator-vision.md` §7 / §8. Repetition across stories is intentional.
- **Don't restate other stories' criteria** — cross-link.
- **No TBDs in ACs.** Unresolved items belong in §10. Defaults asserted here are committed by this document until §10 is resolved.

---

## 8. Screen ↔ story map

| Screen / Route | Stories |
|---|---|
| `/sign-in`, `/sign-up`, `/reset-password` | 1, 2, 3 |
| First-launch overlay | 5 |
| Home (`/`) | 11 (link to /characters), 37 |
| `/characters` | 7, 8, 9, 10, 11 |
| Chat (`/chat/[characterId]/[conversationId]`) | 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29, 30, 31, 32, 34, 47, 49, 50 |
| `/profile` | 52 |
| `/gallery` + image viewer | 50, 51 |
| `/grammar` (Dashboard) | 35, 36, 38 |
| Settings → Grammar | 26, 28, 29, 33, 42 |
| Settings → Text Engine | 39 |
| Settings → Text-to-Speech | 43, 49 |
| Settings → Image Engine | 44, 50 |
| Settings → Visual Roleplay | 45, 50 |
| Settings → Video Engine | 46 |
| Settings → Speech Recognition | 23 |
| Settings → Bubble Colors | 47 |
| Settings → Prompt Editor | 40 |
| Settings → Memory | 41 |
| Settings → Chat Behavior | 20 |
| Settings → Data & Security | 4, 5, 6, 38, 48 |

PersonaLLM screens intentionally absent from v0: Community, Credits, App Lock, Apple SignIn (`creator-vision.md` §9).

---

## 9. Domain-entity ↔ story map

| Entity | Stories that read or write it |
|---|---|
| `User` | 1, 2, 3, 4, 6, 7, 39, 48, 52 |
| `Session` | 1, 2, 3 |
| `UserPersona` | 16, 52 |
| `Character` | 7, 8, 9, 10, 11, 12, 14, 15, 16, 49, 50, 51 |
| `Conversation` | 10, 12, 13, 14, 15, 16, 21, 22, 25, 31, 32 |
| `Message` | 10, 14, 15, 16, 17, 18, 19, 23, 24, 27, 28, 34, 49, 50 |
| `MessageVariant` | 10, 15, 17, 18, 19, 24 |
| `LorebookEntry` | 10, 12, 14, 15, 16, 25, 41 |
| `MemoryDocument` | 10, 15, 16, 41 |
| `AuthorsNote` | 10, 15, 22 |
| `ConversationBranch` | 10, 14, 15 |
| `GrammarCorrection` | 10, 14, 15, 18, 27, 28, 30, 31, 32, 34, 36, 38, 48 |
| `GrammarAggregate` | 10, 15, 32, 35, 36, 37, 38, 48 |
| `GeneratedImage` | 50, 51 |
| `User.byok_keys` | 23, 39, 43, 44 |
| `User.sfw_disabled` | 6, 16, 50 |
| `User.preferences` | 5, 6, 20, 26, 29, 41, 42, 43, 45, 47 |
| `User.promptAssembly` | 40 |

---

## 10. Story gaps & unclear user needs

Numbered for stable cross-reference. After review round 3 only four genuine open items remain — everything else has been resolved, committed as a default, or deferred to post-v0. Will be moved into `Seed/open-questions.md` when that file is generated. **Do not invent answers downstream.**

### Open — require real-world action before final resolution (not Q&A items)

1. **Re-validate PersonaLLM Character-edit semantics against the actual app.** Committed default: Character edits do NOT retroactively affect existing Conversations; each Conversation stores a snapshot at creation time. Creator expressed some uncertainty about exact PersonaLLM behavior. A short hands-on session with PersonaLLM would harden this. Related: `creator-vision.md` §10 "Lorebook scoping re-validation" covers adjacent ground.
2. **Specific Grammar Agent model picks** for Basic and Advanced tiers. Needs a small benchmark (`creator-vision.md` §10). Candidates listed there.
3. **Concrete Levenshtein budget below the 95% similarity threshold.** Story 34 — the exact normalized-edit-distance number. Needs user testing (`creator-vision.md` §7, §10).
4. **Spanish/Spanglish upgrade-hint detection window.** Story 42 — the recent-message window size and the "frequent non-English" threshold. Needs tuning after real usage.

### Voice input UI specifics (minor spec gap)

5. **Voice input UI specifics.** Story 23 — push-to-talk vs streaming, in-place vs modal. Not blocking for seed generation; will be pinned down when the voice-input story is implemented.

### Resolved in review round 3 (creator Q&A)

**Round 3 — part A (product-shape decisions)**

- ~~Persona question: collapse or split?~~ → **Keep split.** Learner (primary, explicit in creator-vision) + Power Creator (secondary, inferred from §8 principle 4). §4 unchanged.
- ~~`Character.systemPrompt` snapshot vs live~~ → **Snapshot at Conversation creation.** Matches inferred PersonaLLM behavior. Committed in stories 9 and 12. Residual re-validation task is §10 #1.
- ~~MVP stance~~ → **Chat-first, grammar opt-in.** §3 now states this explicitly. Downstream `product.md` must inherit.
- ~~Spanish/Spanglish tier default~~ → **Basic stays default, with a soft upgrade hint.** Committed in story 42. Detection-window specifics are §10 #4.

**Round 3 — part B (mechanics + scope cleanup)**

- ~~Branching × per-Conversation Lorebook~~ → **COPY the Lorebook into the branch**, mirroring the grammar-carryover rule. Committed in story 14.
- ~~`Character.scenario` representation in LLM context~~ → **Part of the system prompt** (appended to the Character card block in the 11-position assembly). Not rendered as a visible chat-feed message. Committed in story 12.
- ~~Email verification blocking~~ → **Non-blocking.** Users can sign in immediately after signup. Verification is enforced only when needed (password reset). Confirms the progressive-auth stance: guest (story 2) → signed-in unverified (OK) → verified (needed for recovery) → signed-in + 18+ (needed for SFW disable, story 6). Committed in story 4.
- ~~Resume-after-disconnect / Export / Search / Notifications~~ → **NOT in v0 scope.** Deferred to v1+. No stories written for these. If the scope stance shifts later, new stories can slot into §5.3 / §5.9 / §5.11 without structural changes.
- ~~UI localization~~ → **NOT in v0.** UI is English-only in v0. The Grammar Agent always corrects to American English (`creator-vision.md` §5.7) — that's unrelated to the UI's own locale. Creator's conservative v0 scope stance applies. If Spanish UI is needed later, it will be an independent localization pass on the already-stable user-stories.

**Round 3 — part C (silent commits, lower-impact)**

*These were not asked as questions — I committed sensible defaults consistent with creator-vision and PersonaLLM conservatism. Surfaced here for review; overridable at any time.*

- **Sidebar open/closed persistence** → **per-User.** Simple, predictable. Story 29 AC already commits this.
- **Correction ordering in sidebar** → **newest-first.** Story 30 AC already commits this.
- **Continue generation storage shape** → **append to selected `MessageVariant`.** Story 19 AC already commits this.
- **Suggested replies default** → **OFF.** Matches PersonaLLM conservatism and the chat-first, low-friction MVP stance. Story 20 treats the setting as inherited from Chat Behavior preferences.
- **F3 bidirectional isolation** → **committed bidirectional.** Conversation Agent receives no Grammar data (explicit per `creator-vision.md` §7); Grammar Agent receives no Character-side data (strongly implied by §8 principle 8 "Grammar is Character-independent" and the multi-agent separation in §7). F3 already documents both directions.
- **Onboarding persona-hint copy** → **NO persona question at onboarding.** Matches the chat-first framing and keeps onboarding minimal. Learner vs Power Creator is an internal seed concept only.

### Resolved in v3 (removed from §10)

- ~~Default Grammar Module state~~ → committed OFF (`creator-vision.md` §5.0, §5.7)
- ~~Insights Job cadence reconciliation~~ → "every 10 user messages + Home async if dirty" (`creator-vision.md` §7)
- ~~Branching grammar carryover~~ → COPY committed (`creator-vision.md` §5.2)
- ~~Edit message + grammar~~ → trim-and-re-run committed (`creator-vision.md` §5.2, §7)
- ~~Cadence contradiction in creator-vision~~ → resolved by the canonical §10 list in `creator-vision.md`
