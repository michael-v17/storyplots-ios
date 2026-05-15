# UX — StoryPlots v0

> **Authority:** eighth in precedence. Conflicts with higher files are resolved in their favor and recorded in [open-questions.md](open-questions.md).
>
> Screen-level behaviors inherited from PersonaLLM are sourced from [PersonaLLM-Reference/04-screens/](PersonaLLM-Reference/04-screens/). v0 extensions and divergences are called out explicitly in each screen contract below.

---

## 1. Sitemap

```
/                                          Home — Recent Characters + Grammar snapshot
/sign-in                                   Sign-in form (email/pw, Google, GitHub)
/sign-up                                   Sign-up form
/reset-password                            Password reset (Supabase magic link)

/characters                                Full Character grid
/character/:id/edit                        Character editor (Avatar / Info / Settings tabs)
/character/new                             Character creation picker → AI Generate / Manual / Import

/chat/:characterId/:conversationId         Active chat — the core surface

/profile                                   UserPersona editor

/gallery                                   Gallery (filter by Character)
/gallery/:mediaId                          Fullscreen image viewer (also reachable as overlay)

/grammar                                   Grammar Dashboard (primary nav)

/settings                                  Settings index
/settings/chat-behavior                    Typing speed, suggested replies
/settings/memory                           RAG tuning + Auto Lore Extraction
/settings/visual-roleplay                  Visual Roleplay mode + resolution presets
/settings/bubble-colors                    Chat theme
/settings/prompt-editor                    11-position assembly (SFW block NOT exposed)
/settings/text-engine                      BYOK text provider — also Conversation Agent model selector
/settings/image-engine                     ComfyUI URL + per-style workflows + direct APIs
/settings/video-engine                     Stub
/settings/text-to-speech                   ElevenLabs / OpenAI TTS / WebSpeech; default OFF
/settings/speech-recognition               STT engine
/settings/grammar                          v0 Extension: Master toggle (default OFF), Inline, Sidebar, Reinforcement, Tier, Custom model
/settings/data-security                    Fiction-disclaimer restate, Cloud Consent, SFW disable + 18+, storage, sign out, delete account, Clear all grammar data
```

All routes are deep-linkable. SPA navigation — no full-page reloads.

---

## 2. Navigation model

- **UI shell:** left **sidebar** + **top nav bar**. No bottom button bar (matches PersonaLLM on desktop and mobile; [creator-vision.md](creator-vision.md) §4).
- **Sidebar primary nav (in order):**
  1. Home (`/`)
  2. Characters (`/characters`)
  3. Chat (`/chat/:c/:conv` when active)
  4. Gallery (`/gallery`)
  5. Grammar (`/grammar`) — **primary nav item in v0**
  6. Settings (`/settings`)
- **Sidebar user section** (avatar + display name at sidebar bottom) → opens UserPersona editor.
- **Top-bar Conversation switcher** inside `/chat/...` — dropdown of the active Character's Conversations + "New conversation" action. PersonaLLM-style.
- **Account upgrade CTA** — appears in the user section when the current User is anonymous.
- **Cross-device nudge for anonymous Users** — a subtle, persistent banner/CTA ("Sign up to access your Characters from anywhere") visible while the session is anonymous. Low-pressure: no modal, no blocking, dismissible to a quieter form but never fully suppressed until the user links an account. Drives honest expectations since anonymous Supabase sessions are browser-bound — opening the app in a different browser creates a fresh anonymous User and the previous data stays on the original browser.
- **Sidebar open/closed state persists per-User** (round-3C commit; [user-stories.md](user-stories.md) story 29 AC).

**What is removed vs PersonaLLM:**

- No Community nav item.
- No Credits display in the sidebar drawer.
- No bottom tab bar.

---

## 3. Breakpoints (adaptive shell)

Adapted from [PersonaLLM-Reference/11-web-adaptation-notes.md](PersonaLLM-Reference/11-web-adaptation-notes.md).

| Breakpoint | Range | Behavior |
|---|---|---|
| S | ≤ 640 px | Drawer-style sidebar (slide-in); bottom modal sheets; full-width compositions |
| M | 641–1024 px | Sidebar collapsible (persistent when open); modals still bottom sheets |
| L | ≥ 1025 px | Persistent sidebar; right-pane inspector replaces many modal sheets; keyboard-first affordances |

Gesture-only iOS behaviors get explicit UI on web: swipe → arrow buttons / keyboard shortcuts; long-press → right-click / ⋮ kebab.

---

## 4. Screen contracts

Each screen: **route**, **purpose**, **entry points**, **must-have sections**, **optional sections**, **primary actions**, **secondary actions**, **interactions**, **opens**, **required states**, **critical edge cases**, **must not omit**, **notes / assumptions**.

---

### 4.1 First-launch fiction-disclaimer overlay

- **Route:** none (overlay over `/`).
- **Purpose:** show the fiction disclaimer + content guidelines once per User on first launch (story 5, [creator-vision.md](creator-vision.md) §6).
- **Entry points:** triggered when a User (anonymous or authenticated) loads the app for the first time and has no `preferences.fiction_disclaimer_seen_at` timestamp.
- **Must-have sections:** disclaimer text; content-guidelines bullet list (no impersonation / no illegal content / no minors); single dismiss CTA.
- **Optional sections:** link to Terms of Service / Privacy Policy.
- **Primary actions:** "I Understand" (dismiss).
- **Secondary actions:** none.
- **Interactions:** dismiss persists `fiction_disclaimer_seen_at`; does not block subsequent screens if the user somehow closes the tab first.
- **Opens:** dismiss → Home.
- **Required states:** first-show (unseen) / hidden (already seen).
- **Critical edge cases:** if the user deletes browser storage but has server-side `preferences.fiction_disclaimer_seen_at`, do not re-show.
- **Must not omit:** the bullet list of content guidelines; a restatement path in Settings → Data & Security.
- **Notes:** non-blocking in spirit — one-tap dismiss. No 18+ gate here (that lives only behind SFW disable). Cloud AI Consent is NOT bundled into this overlay (inline on first BYOK entry instead).

---

### 4.2 Home (`/`)

- **Purpose:** entry point; lists recent Characters; surfaces a macro grammar signal (when enabled).
- **Entry points:** sidebar → Home; app-start default.
- **Must-have sections:**
  - **Recent Characters** — most recently used Characters only. "See all" link → `/characters`.
  - **Empty state** ("No Companions Yet") — shown when the User has no Characters; primary CTA "Create / Import Character".
  - **Grammar snapshot widget** (v0 Extension) — detected English level, most common errors, frequently overused words. Reads `GrammarAggregate` **pre-computed**; no live aggregation on render. Hidden when Master Grammar is OFF OR when no data exists.
- **Optional sections:** none in v0.
- **Primary actions:** Create Character; Import Character; tap a recent Character.
- **Secondary actions:** See all (go to `/characters`); open sidebar; open Settings; open `/grammar` Dashboard via sidebar.
- **Interactions:**
  - Tap a recent Character → navigate to that Character's **most recent Conversation**, or create a new Conversation if none exists (round-3 confirmation).
  - Grammar snapshot renders cached values immediately; triggers async Insights Job refresh when `GrammarAggregate.dirty = true`. **Home is never blocked** (F3 / story 37).
- **Opens:** Character editor (creation); Character import dropzone; Chat; `/characters`.
- **Required states:** empty (no Characters); populated (≥ 1 Character); grammar-snapshot-hidden (master OFF or no data); grammar-snapshot-visible (master ON AND data exists); grammar-snapshot-stale (render cached + async refresh in progress).
- **Critical edge cases:** first-time Home after BYOK-less guest session → Create CTA is primary but chat requires a key; Home should not push the user into BYOK before they click Create.
- **Must not omit:** "See all" link; empty-state CTA; dual recent-vs-see-all framing.
- **Notes:** copy tone is chat-first, grammar-opt-in ([user-stories.md](user-stories.md) §3 round-3 commit).

---

### 4.3 `/sign-in`, `/sign-up`, `/reset-password`

- **Purpose:** authenticated sign-in / sign-up / password reset flows.
- **Entry points:** account-upgrade CTA from the sidebar user section; direct URL; sign-out.
- **Must-have sections:** provider buttons (Google, GitHub); email + password form; "Forgot password" link on `/sign-in`; "Sign up" / "Sign in" cross-links.
- **Optional sections:** none.
- **Primary actions:** submit; OAuth provider button.
- **Secondary actions:** toggle between sign-in ↔ sign-up; request magic link.
- **Interactions:** email verification is **non-blocking** — after sign-up the user is signed in immediately.
- **Opens:** Home.
- **Required states:** form / submitting / error (incorrect credentials / network / rate limit).
- **Critical edge cases:** existing anonymous session — linking to email/OAuth must preserve all data (F5) without creating a second `User` row.
- **Must not omit:** Google, GitHub, email+password, reset link.
- **Notes:** no Apple SignIn; no Microsoft. No 18+ gate at signup.

---

### 4.4 `/characters` (grid)

- **Purpose:** full grid of all of the User's Characters.
- **Entry points:** sidebar → Characters; Home → "See all".
- **Must-have sections:** Character grid; Create CTA; Import CTA.
- **Optional sections:** search (deferred post-v0), filter by tag (deferred).
- **Primary actions:** tap a Character (→ most recent Conversation or new one); Create; Import.
- **Secondary actions:** context menu → Edit / Delete (with confirmation and cascade).
- **Interactions:** layout toggle (grid cards / compact circles / list) — inherited from PersonaLLM (optional for v0).
- **Opens:** Chat; Character editor; Character import dropzone.
- **Required states:** empty ("No Companions Yet"); populated.
- **Critical edge cases:** deletion with active Conversations → confirmation modal enumerates the cascade (Characters / Conversations / Messages / Lorebook / Memory / Grammar).
- **Must not omit:** empty state; Create + Import.

---

### 4.5 Character editor + importer (`/character/new`, `/character/:id/edit`)

- **Purpose:** create / edit / import a Character.
- **Entry points:** `/characters` → Create / Import; Home empty-state CTA.
- **Must-have sections (tabs — preserved from PersonaLLM):** Avatar · Info · Settings.
- **Info tab fields:** name, tagline, `system_prompt` (≤2000 chars soft warning), personality, goals, worldbuilding, tags, **`scenario` (text field)**, **`english_style` dropdown (v0 Extension)**, Assistant-mode fields (expertise, communication style, rules) when mode = `assistant`.
- **Settings tab fields:** default writing style, default persona, character memory enabled toggle.
- **Creation picker:** AI Generate (Recommended) / Manual / Import (JSON + PNG card).
- **Primary actions:** Save; Generate (AI Generate); Import.
- **Secondary actions:** Refine with AI (Manual); Cancel.
- **Interactions:** `mode` is set on creation and **immutable** after; cannot be changed later. Saving creates or updates a Character row scoped to `auth.uid()`.
- **Opens:** back to `/characters` or direct to Chat.
- **Required states:** creating / editing / saving / import-parsing / error.
- **Critical edge cases:**
  - **Lorebook is NOT exposed on this editor.** It lives in the Chat screen (story 9, 25).
  - Imported community-sourced cards — **not importable** in v0 (no Community surface).
  - Editing a Character does NOT retroactively change existing Conversations — the Character's snapshot lives in `conversations.character_snapshot` (story 9 round-3A).
- **Must not omit:** English Style dropdown; the "edits apply to new Conversations only" messaging or equivalent subtle hint.
- **Notes:** scenario is captured as a single text field (v0 collapses PersonaLLM's `Scenario[]`). The scenario is injected into the system prompt, not rendered as message #0.

---

### 4.6 Chat (`/chat/:characterId/:conversationId`)

- **Purpose:** the core 1:1 conversation surface.
- **Entry points:** Home tile tap; `/characters` tile tap; sidebar Recent (via top-bar switcher); deep link.
- **Must-have sections:**
  - **Top bar** — Character avatar + name; **Conversation switcher** dropdown ("New conversation" + list of existing Conversations); Chat Controls button (⋯).
  - **Message feed** — scrollable history of `Message` rows; dialogue/narration typography (story 24).
  - **Composer** (sticky bottom) — text input (Enter send, Shift+Enter newline); send button; **Grammar sidebar toggle** (right of send, visible only when Master + Sidebar Grammar are ON).
  - **Suggested Replies pill** above composer (when enabled in Chat Behavior).
  - **Grammar inline correction row** below a user Message (when Master + Inline are ON and a correction exists) — Mode A: corrected text only; Mode B: corrected text + short plain-English explanation.
  - **Grammar Panel** (right sidebar, conditional on toggle) — plain-text `original → corrected` pairs (two lines per pair, newest first), mini per-Conversation summary, "Clear grammar for this Conversation" action.
  - **Rewrite gate** — replaces the composer when Reinforcement Mode is on and the Grammar Agent returns a correction. Local validator (≥95% similarity) compares the rewrite; 3-strike cap surfaces "That's enough — continuing" state and fires the NPC.
- **Optional sections:** Author's Notes affordance (opens editor); Lorebook panel (per-Conversation); Debug Mode panel (when Chat Controls → Debug is on).
- **Primary actions:** Send message; Regenerate (rail); Branch (rail); Generate Image (rail); Edit Message; Delete Message.
- **Secondary actions:** Variant nav `< N/M >`; Continue generation (append to selected variant); TTS playback (per message or auto); Long-press/right-click kebab.
- **Interactions:**
  - **Italic (`*…*`) → narration; plain quoted (`"…"`) → dialogue** — required rendering convention; also drives dual-voice TTS routing when TTS is enabled.
  - **MessageVariant navigation** — left/right arrows on assistant messages; keyboard `←`/`→`.
  - **Edit Message (destructive trim)** — confirmation dialog makes the trim explicit; saving deletes all subsequent Messages + variants + grammar rows; for user Messages with Grammar enabled, fresh Grammar Agent pass on the new text (F4).
  - **Branch** — "Keep messages" or "Summarize & start fresh"; creates a new Conversation; kept-range Lorebook entries and GrammarCorrections are **COPIED** into the new Conversation.
  - **Autopilot** — 5 / 10 / 25 / custom turn preset; Stop button visible in composer while running; Autopilot generates assistant turns only; Grammar Agent does NOT run on Autopilot-generated user messages.
  - **Cloud AI Consent** — inline on first BYOK key entry (not here).
  - **SFW text filtering** — when `sfw_disabled = false`, the Conversation Agent's system prompt gets the system-owned guardrail block prepended. The user cannot see or edit this block.
- **Opens:** Chat Controls sheet / right-pane inspector (L); Fork modal; Image viewer; Author's Notes editor; Lorebook editor panel; Delete-message confirmation; Destructive-trim confirmation; Clear-grammar-for-Conversation confirmation.
- **Required states:**
  - Loading (Conversation history fetching).
  - Empty (brand-new Conversation with greeting-only).
  - Streaming (assistant is producing tokens).
  - Streaming paused (provider rate limit; SSE error).
  - Rewrite-gate active (Reinforcement Mode, input replaced).
  - Grammar disabled (no inline rows, no panel toggle).
  - BYOK missing — compose is disabled with an inline CTA to Settings → Text Engine.
- **Critical edge cases:**
  - Edit a user Message while assistant is streaming → UI prevents until stream completes.
  - Regenerate while streaming → replaces the active variant when the in-flight stream completes.
  - Rewrite gate × 3 failures → NPC continues; subtle "continuing anyway" microcopy; `reinforcement_failures_count++`.
  - Spanish / Spanglish input → Grammar Agent corrects to English; if frequent, Settings → Grammar surfaces a soft upgrade-to-Advanced hint (story 42).
  - SFW-blocked image generation → brief notice, not a hard error.
- **Must not omit:**
  - Typography rendering for `*…*` / `"…"`.
  - Top-bar Conversation switcher.
  - Grammar sidebar toggle (when eligible).
  - Destructive-trim confirmation copy.
  - "Active Notes" badge on composer when an AuthorsNote applies (adapted from web notes).
- **Notes:** This is the single most dense screen in v0 — see [PersonaLLM-Reference/04-screens/chat.md](PersonaLLM-Reference/04-screens/chat.md) and [PersonaLLM-Reference/06-chat-interaction-model.md](PersonaLLM-Reference/06-chat-interaction-model.md) for the full observed behavior that v0 inherits.

---

### 4.7 `/profile` (UserPersona editor)

- **Purpose:** create or edit the user's UserPersona.
- **Entry points:** sidebar user section tap.
- **Must-have sections:** photo, name, gender, appearance (skin, eyes, hair, extras), background story.
- **Primary actions:** Save; Upload photo; Generate photo (from description).
- **Secondary actions:** Clear persona; Cancel.
- **Interactions:** gender-appropriate smart defaults fill blank fields at read time.
- **Required states:** empty / editing / saving / error.
- **Must not omit:** the "not sent to Grammar Agent" invariant does not need UI — it's enforced in code — but the editor must exist so UserPersona can be populated for the Conversation Agent.

---

### 4.8 `/gallery` + Image Viewer

- **Purpose:** browse user-generated images, filterable by Character.
- **Must-have sections:** grid (masonry or CSS grid), filter bar (Images / Videos / per-Character), Search (optional; observed but deferrable).
- **Primary actions:** open fullscreen viewer; delete; re-generate; edit prompt.
- **Image Viewer:** fullscreen overlay; Edit Prompt side panel (L); keyboard shortcuts (`Esc` close, `←/→` paging, `E` edit).
- **Required states:** empty / populated / loading / error.
- **Notes:** v0 scopes filters to **per-Character**, not per-Story — Stories don't exist.

---

### 4.9 `/grammar` (Grammar Dashboard)

- **Purpose:** macro view of the user's grammar progress across all Conversations.
- **Entry points:** sidebar → Grammar. Reachable even when Master Grammar is OFF.
- **Must-have sections (all from [creator-vision.md](creator-vision.md) §5.6):**
  1. Detected English level.
  2. Most common errors (categorized).
  3. Filler words / muletillas.
  4. Overused words.
  5. Connector analysis.
  6. AI narrative feedback.
  7. Improvement suggestions.
  8. **Reinforcement performance** — % of rewrite attempts that failed, drawn from `GrammarCorrection.reinforcement_failures_count`.
  9. Full correction list — scrollable `original → corrected` pairs verbatim.
- **Primary actions:** Clear all grammar data (destructive, with confirmation).
- **Secondary actions:** follow link into Settings → Grammar to flip the Master toggle.
- **Interactions:** renders from pre-computed `GrammarAggregate`; if `dirty`, render cached values immediately and trigger async Insights Job refresh.
- **Required states:**
  - **Empty (no data)** — friendly copy verbatim from [creator-vision.md](creator-vision.md) §5.6: *"Your detected level, common errors, and overused words will appear here as you chat."*
  - Populated.
  - Stale (cached + refresh in progress).
  - Master-OFF — renders empty state, does NOT render a "turn on Grammar" nag (opt-in, not push).
- **Must not omit:** reinforcement performance block; full correction list.
- **Notes:** **Never blocked** on the Insights Job. Clear-all cascades across `GrammarCorrection` and `GrammarAggregate` for the User.

---

### 4.10 Settings index (`/settings`) + sub-sections

**Index** — list of sections on L (left list, active section on right); stacked tap-to-drill on S/M. Breadcrumb on L. All 11 sub-sections present in v0; Video Engine is a stub.

#### 4.10.1 Settings → Chat Behavior
- Typing speed slider (0..1).
- Suggested replies auto (default OFF).
- Inline hints for every advanced control.

#### 4.10.2 Settings → Memory
- RAG top-k, similarity threshold, recency weighting.
- Auto Lore Extraction: on/off, cadence (every N turns; default 3), extraction prompt editor.
- Knowledge budget + active-window reserve.
- Lore scan depth + query context chars.
- Extracted `LorebookEntry` rows are written to the **active Conversation only** (per-Conversation scoping).

#### 4.10.3 Settings → Visual Roleplay
- Mode + resolution presets (Random / Square / Portrait / Landscape / TallPortrait / WideLandscape / UltraTall / UltraWide).
- Auto-generate images toggle.
- Enabled resolutions list.

#### 4.10.4 Settings → Bubble Colors
- 15 themes (Essentials + SillyTavern + Moods packs); Custom.

#### 4.10.5 Settings → Prompt Editor
- All 11 positions editable (Roleplay + Assistant scaffolds).
- Full default templates bundled verbatim.
- **Must-not-omit:** the SFW guardrail block is **NOT exposed here**. Not an editable position. Any attempt to include it violates [creator-vision.md](creator-vision.md) §5.7 / §6.

#### 4.10.6 Settings → Text Engine
- BYOK providers (OpenRouter primary; OpenAI / Google / Ollama / LM Studio / vLLM / …).
- Active-per-kind enforcement.
- **Conversation Agent model selector lives here** (not in Settings → Grammar).
- Cloud AI Consent appears **inline on first key entry**.

#### 4.10.7 Settings → Image Engine
- ComfyUI URL + port (local or remote); "Test connection".
- **Per-style workflow upload** — anime / realistic / pixel — each with its own parameters (sampler / scheduler / steps / CFG / seed / prefix / negative).
- Direct API providers (OpenAI / Google / xAI / etc.).

#### 4.10.8 Settings → Video Engine
- Stub. Settings page exists; no production video flow required in v0.

#### 4.10.9 Settings → Text-to-Speech
- Providers (v0): ElevenLabs, OpenAI TTS, WebSpeech.
- **Default OFF.**
- Modes: auto on every assistant message; per-message playback.
- Dual-voice selection (narrator + dialogue), gender-matched.
- **No local Kokoro** in v0.

#### 4.10.10 Settings → Speech Recognition
- Engine (browser default via `SpeechRecognition`; optional Whisper via BYOK or WASM).

#### 4.10.11 Settings → Grammar (v0 Extension)
- **Master toggle — default OFF.**
- Inline Grammar on/off; Mode A vs Mode B.
- Sidebar Grammar on/off; Frequency (every / every 3 / every 5 / major errors only). *Frequency controls UI surfacing, not Grammar Agent invocation — the agent runs on every user message regardless.*
- Reinforcement Mode on/off (disabled unless Inline is on).
- Grammar Agent Tier (Basic default / Advanced); Custom model ID free-text override.
- Spanish/Spanglish soft upgrade hint (non-blocking, dismissible).

#### 4.10.12 Settings → Data & Security
- Fiction disclaimer restate.
- Cloud Consent (inline link back to where it was set).
- **SFW toggle + 18+ confirmation modal** (only flow that requires 18+).
- Storage breakdown per category.
- **Clear all grammar data** (mirrors Dashboard action).
- Sign out.
- **Delete account** (typed confirmation; full cascade).

---

## 5. Modal / overlay registry

| Modal / overlay | Trigger | Behavior |
|---|---|---|
| First-launch fiction-disclaimer | First app load per User | Dismiss writes `fiction_disclaimer_seen_at` |
| Inline Cloud AI Consent | First BYOK key entry in any Text Engine field | Inline notice, not a blocking overlay |
| 18+ confirmation | Toggling SFW OFF (only) | Blocking; requires authenticated (non-anonymous) User |
| Delete-message confirm | Delete action on a Message | "Delete Message?" |
| Destructive-trim confirm | Save on an Edit of a prior Message | Explicit copy about feed trim + grammar re-run |
| Fork Conversation | Branch rail / long-press → Fork | "Keep messages" or "Summarize & start fresh"; primary CTA, not destructive red |
| Clear grammar for this Conversation | Grammar Panel action | Confirmation |
| Clear all grammar data | `/grammar` or Settings → Data & Security | Confirmation |
| Delete account | Settings → Data & Security | Typed confirmation ("ERASE" or similar); full cascade |
| Fullscreen image viewer | Gallery / Chat inline image tap | Esc close; keyboard nav |
| Chat Controls panel/sheet | Composer ⋯ button | Right inspector on L; bottom sheet on S/M |
| Author's Notes editor | Chat Controls → Author's Notes | Per-Conversation |
| Lorebook panel | Chat Controls → Lore Book OR dedicated affordance | Per-Conversation; shown next to Chat |
| Account upgrade dialog | Sidebar user-section tap when anonymous | Links email / OAuth; preserves data |
| BYOK not configured | Any chat send when key absent | Inline CTA to Settings → Text Engine |
| SFW-blocked image notice | Image generation rejected by filter | Brief notice; user can rewrite or (if eligible) disable SFW |
| TTS provider missing | Tap TTS play when no provider active | Inline CTA to Settings → Text-to-Speech |

---

## 6. Required states — global checklist

Every screen has the first four; additional states are per-screen.

1. **Loading** — skeletons or spinners where relevant; no blocking modals for network.
2. **Empty** — friendly copy + primary CTA to fill it.
3. **Error** — informational + actionable; if BYOK, offer "Copy prompt" for retry outside the app (inspired by PersonaLLM Debug Mode pattern).
4. **Offline / disconnected** — app shell loads; chat disabled with clear message; Settings still editable.

Additional across the app:

- **Stale aggregate** (`GrammarAggregate.dirty = true`) — render cached values + trigger async refresh.
- **Streaming** (Conversation Agent) — token-reveal animation respecting `prefers-reduced-motion`.
- **Rewrite-gate active** — composer replaced; 3-strike counter visible subtly.
- **BYOK absent** — chat disabled; inline CTA.
- **Anonymous** — persistent (but low-pressure) "Sign up to access from anywhere" nudge visible in the user section and, briefly, as a dismissible banner on Home and Chat the first time the user lands on each.
- **SFW enabled / disabled** — no global UI distinction except in Settings; behavior is silent.

---

## 7. Critical flows (F1–F7)

Cross-reference to [user-stories.md](user-stories.md) §6. Restated here in UX terms (user-visible transitions).

### F1 — First-run MVP flow
1. First visit → anonymous session silently created.
2. Fiction disclaimer overlay → dismiss.
3. User creates/imports a Character; BYOK key needed for chat → inline Cloud AI Consent on first key entry in Settings → Text Engine.
4. `/characters` → tap Character → navigate to new `/chat/:c/:conv`.
5. User sends a message → NPC reply streams back with italic/plain typography preserved.
6. (Optional) Settings → Grammar → flip Master ON → Inline Mode A renders corrected text inline.
7. (Optional) `/grammar` shows populating Dashboard.

### F2 — Reinforcement learning loop
1. Master + Inline + Reinforcement ON.
2. Send flawed message → inline correction + rewrite gate replaces composer.
3. User rewrites; local validator checks ≥95% similarity after normalization.
4. On pass → NPC responds.
5. On 3 failures → gate clears with "continuing anyway" microcopy; NPC responds; `reinforcement_failures_count++`.
6. Dashboard reflects the counted failure.

### F3 — Grammar isolation invariant
- Logged prompts show: Conversation Agent prompt has zero grammar data; Grammar Agent prompt has only the raw user message. Both directions enforced.

### F4 — Destructive edit propagation
- Edit a prior Message → confirmation explains the trim → save deletes downstream Messages + grammar rows → edited user Message receives a fresh correction row (if grammar enabled).

### F5 — Account upgrade preserves data
- Anonymous user uses the app heavily → clicks "Sign up / link account" → picks Google/GitHub/email → post-upgrade, every Character / Conversation / BYOK key / grammar row is intact.

### F6 — Branching carries grammar forward
- In a Conversation with Grammar rows, click Branch at message N → "Keep messages" → new Conversation has Messages 1..N copied + corresponding `LorebookEntry` and `GrammarCorrection` rows copied with the new `conversation_id`.

### F7 — Re-measure progress
- Practice → Per-Conversation Clear in the Panel → practice again → Dashboard and Home reflect only the new data, reaggregated async.

---

## 8. Interaction invariants (non-omission)

These behaviors must be present in v0 UX:

1. **Italic / plain typography** renders correctly in every message bubble, every variant, every read path.
2. **Grammar surfaces are hidden when Master is OFF** — no inline rows, no sidebar toggle, no Home widget. `/grammar` still loads with empty state.
3. **NPC never waits on grammar** unless Reinforcement Mode is explicitly enabled. Default path adds zero friction.
4. **Grammar sidebar frequency** controls UI surfacing only — the Grammar Agent still runs on every user message.
5. **Edit is destructive** — copy never uses "update" or "revise"; always "edit (this will trim the feed)".
6. **Branch copies** — the post-fork UI shows an initial mini-state where Lorebook and Grammar Panel are populated from the parent's kept range.
7. **Autopilot has a Stop button** in the composer while running.
8. **TTS routes narration → narrator voice, dialogue → character voice** when TTS is on (story 49).
9. **SFW-blocked image generation shows a brief notice**, never a hard error modal.
10. **Account upgrade preserves data** — UI explicitly states this in the upgrade dialog copy.

---

## 9. Error and recovery expectations

- **BYOK missing** — composer disabled with a single-click CTA to Settings → Text Engine. Matches PersonaLLM's "Add Provider" pattern.
- **Test Connection failure** — red inline microtext; "Copy error" affordance for BYOK users.
- **Provider token limit** — inline info card with specific limit.
- **NSFW image blocked** — brief notice; user can rewrite; if authenticated + 18+ they can disable SFW.
- **Reinforcement 3-strike** — gate clears with "continuing anyway" microcopy; no modal.
- **Conversation Agent stream error mid-reply** — truncated reply stays in the feed; user sees an error chip and can Regenerate.
- **Grammar Agent error** — degrades gracefully to "correction unavailable"; Conversation Agent flow is unaffected.
- **Network loss** — app shell remains; Settings are editable; chat disabled.
- **SSE disconnect** — reconnect attempt with visible indicator; message history is reloaded from Supabase when needed.

---

## 10. Non-omission checklist (must exist in v0, even if thin)

- First-launch fiction-disclaimer overlay.
- Home grammar snapshot widget (hidden states included).
- `/grammar` primary nav item, empty state copy, 9 content blocks.
- All 11 Settings sub-sections, including Video Engine (stub).
- Settings → Grammar sub-section with tier selector + custom-model override.
- Per-Conversation Lorebook panel on the Chat screen.
- Grammar sidebar with plain-text two-lines-per-pair display.
- Rewrite gate (Reinforcement Mode).
- Dual-voice TTS routing.
- ComfyUI per-style workflow upload UI.
- 18+ confirmation modal behind SFW disable.
- Clear-grammar-for-Conversation and Clear-all-grammar-data confirmations.
- Account upgrade dialog preserving data.
- Destructive-trim confirmation on edit.

---

## Cross-references

- [creator-vision.md](creator-vision.md) §4 (nav), §5 (screens), §6 (safety), §7 (agents), §8 (principles).
- [user-stories.md](user-stories.md) §5 (stories), §6 (F1–F7), §8 (screen↔story), §10 (gaps).
- [design.md](design.md) — visual contract for every screen here.
- [PersonaLLM-Reference/04-screens/](PersonaLLM-Reference/04-screens/) — inherited screen behaviors.
- [PersonaLLM-Reference/11-web-adaptation-notes.md](PersonaLLM-Reference/11-web-adaptation-notes.md) — breakpoint and adaptation patterns.
