# 05 — User Flows

> End-to-end journeys synthesized from Passes B–F. Each flow lists **trigger**, **steps** (each with a screenshot ref), **branches/error cases**, and **exit state**. Cross-links point at the canonical screen docs for details.

## Observed in PersonaLLM

---

### F1 — First-run onboarding (new install → first chat)

**Trigger:** Fresh install opened from App Store.

| Step | Screen | Evidence |
|---|---|---|
| 1 | Welcome — 3 feature rows + Continue | [Onboarding/IMG_4105](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4105.PNG) |
| 2 | Age Verification — toggle ToS + Privacy; Verify with Apple | [IMG_4106](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4106.PNG) |
| 3 | Cloud AI Services consent — "I Understand & Agree" OR "Skip for Now" | [IMG_4108](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4108.PNG) |
| 4 | For Entertainment Only — "I Understand" | [IMG_4109](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4109.PNG) |
| 5 | You're Ready — Auto Image Generation toggle + Start Exploring | [IMG_4111](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4111.PNG) |
| 6 | Home — empty state "No Companions Yet" | [Home/IMG_4095](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4095.PNG) |

**Branches:**
- Gate blocks at step 2 until both consent toggles are ON.
- Step 3 is skippable — cloud features can be unlocked later in [Settings → Cloud AI Consent](04-screens/settings/data-security.md).

**Exit state:** Home, empty library, two CTAs visible (Create Persona / Browse Community). UserPersona is NOT created in onboarding — user is prompted via the [Menu](04-screens/menu.md) "Your Persona · Tap to set up" row later.

**Clone delta:** see [01-overview.md](01-overview.md) and [04-screens/onboarding.md](04-screens/onboarding.md) → rewrite Slide 3 to collect BYOK (OpenRouter key + optional ComfyUI URL); rewrite Slide 5 (remove credits); add optional UserPersona quick-setup slide before Home.

---

### F2 — Create Character (AI Generate)

**Trigger:** Home → "+ New Persona" tile OR "Create Persona" CTA (empty Home).

| Step | Screen | Evidence |
|---|---|---|
| 1 | Creation method picker | [Import/IMG_4096](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4096.PNG) |
| 2 | Pick "AI Generate" (Recommended) | [Import/IMG_4096](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4096.PNG) |
| 3 | Choose mode — Roleplay or Assistant (immutable after creation) | [Import/IMG_4097](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4097.PNG) |
| 4 | Describe Your Character — Concept textarea + example chips + Writing Style radio | [CharInfo/IMG_4134](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4134.PNG) |
| 5 | Tap "Generate Character" — modal streams output | [CharInfo/IMG_4135](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4135.PNG) |
| 6 | Land on Character landing / pre-chat card with auto-generated scenarios | [CharInfo/IMG_4136](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4136.PNG) |

**Branches:**
- Step 5: Cancel / Continue in Background / wait to completion.
- Example-chip tap → populates the Concept textarea.
- Step 3: Assistant mode loads a different editor (Expertise / Communication Style / Rules fields — not captured).

**Exit state:** Character saved to the user's library with avatar, systemPrompt, deep-dive fields, and ≥1 auto-generated Scenario. Ready to chat.

---

### F3 — Create Character (Manual)

**Trigger:** Home → creation method picker → "Manual".

| Step | Screen | Evidence |
|---|---|---|
| 1 | Mode picker (Roleplay / Assistant) | [Import/IMG_4097](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4097.PNG) |
| 2 | Manual form — Name · Tagline · Appearance Description · Accent Color · Character Description | [Import/IMG_4101](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4101.PNG) · [IMG_4102](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4102.PNG) |
| 3 | Optional Deep Dives (Personality / Goals / Worldbuilding) | [IMG_4103](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4103.PNG) |
| 4 | Save → full [Edit Character](04-screens/character-info.md#3-edit-character) view | — |

**Branches:**
- "Refine with AI" at the top of the form → AI rewrites the current fields in place `(behavior inferred)`.

---

### F4 — Import Character (JSON / PNG card)

**Trigger:** Home → creation method picker → "Import".

| Step | Screen | Evidence |
|---|---|---|
| 1 | Import screen — dropzone "Tap to Select" | [Import/IMG_4104](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4104.PNG) |
| 2 | Native iOS file picker — pick `.json` or `.png` | `(inferred)` |
| 3 | App parses V1/V2 character card (PNG `tEXt`/`iTXt` metadata) | `(inferred)` |
| 4 | Lands in Edit Character with pre-populated fields | [CharInfo/IMG_4140](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4140.PNG) |

**Supported formats** (observed verbatim): TavernAI, SillyTavern, Chub.ai · Character Card V1 & V2. See [character-import.md](04-screens/character-import.md) for field-mapping.

---

### F5 — Configure BYOK text provider (clone-specific flow, observed in PersonaLLM Custom tab)

**Trigger:** Menu → Settings → AI & VOICE → Text Engine → Custom tab.

| Step | Screen | Evidence |
|---|---|---|
| 1 | Text Engine root — switch to Custom tab | [Settigns/IMG_4177](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4177.PNG) |
| 2 | Tap saved provider OR "Add Provider" → Choose Provider picker (Local / Cloud) | [IMG_4182](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4182.PNG) |
| 3 | Text Provider detail — Base URL · API Key · Model | [IMG_4178](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4178.PNG) |
| 4 | Tap Model → Select Model list (live-fetched from provider) | [IMG_4181](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4181.PNG) |
| 5 | Test Connection → "✅ Connected" | [IMG_4180](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4180.PNG) |
| 6 | Adjust Temperature / Max Tokens / Context Length | [IMG_4179](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4179.PNG) |
| 7 | Optional: Thinking Mode toggle | [IMG_4179](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4179.PNG) |

**Exit state:** Active ProviderConfig persisted; all subsequent main-chat LLM calls route through this provider.

---

### F6 — Start conversation (new Chat)

**Trigger:** Home → tap Character card/row OR Menu → Recent Chats row.

| Step | Screen | Evidence |
|---|---|---|
| 1 | Character landing (pre-chat) — scenario cards listed | [Chat/IMG_4125](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4125.PNG) · [IMG_4133](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4133.PNG) · [CharInfo/IMG_4136](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4136.PNG) |
| 2 | Tap a Scenario card → new Conversation starts; scenario body becomes message #0 | [Chat/IMG_4126](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4126.PNG) |
| 3 | Type message + send → LLM call assembled from [11-position scaffold](07-prompts-and-llm-touchpoints.md) | — |
| 4 | Assistant streams reply (italic narration + quoted dialogue) | [IMG_4127](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4127.PNG) |

**Branches:**
- Header `+` starts a brand-new Conversation (fresh scenario pick).
- Header list icon opens the Conversations list (resume path — F7).

---

### F7 — Resume conversation

**Trigger:** Menu → Recent Chats row, OR Chat header → list icon → pick Conversation.

| Step | Screen | Evidence |
|---|---|---|
| 1 | Menu — Recent Chats list with last-message preview + timestamp | [Menu/IMG_4151](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Menu/IMG_4151.PNG) |
| 2 | Conversations list for a character | [Chat/IMG_4132](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4132.PNG) |
| 3 | Tap row → active chat with history | — |

---

### F8 — Message variants (Regenerate + swipe)

**Trigger:** Rail ↻ chip on an assistant message.

| Step | Action | Evidence |
|---|---|---|
| 1 | Tap ↻ → new variant generated (LLM call) | — |
| 2 | Counter appears: `< 1/2 >` pill at top-left of message | [Chat/IMG_4200](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4200.PNG) |
| 3 | Tap arrows to swipe between variants (no LLM call) | — |

**Exit state:** `activeVariantIdx` updated on the Message; downstream turns continue from the active variant.

---

### F9 — Edit / Delete / New Response (user message long-press)

**Trigger:** Long-press a user-message pill → context sheet.

| Step | Action | Evidence |
|---|---|---|
| 1 | Long-press user message → sheet appears with 5 options | [Chat/IMG_4200](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4200.PNG) |
| 2 | **Edit** → replace text (downstream re-run = `open question`) | — |
| 3 | **Copy** → clipboard | — |
| 4 | **New Response** → regenerate the assistant reply to this user msg | — |
| 5 | **Fork from here** → [Fork Conversation flow (F10)](#f10--fork-conversation) | [branch.md](04-screens/branch.md) |
| 6 | **Delete** → confirmation modal "Delete Message?" → Cancel / Delete | [Chat/IMG_4202](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4202.PNG) |

---

### F10 — Fork Conversation (Branch)

**Trigger:** Rail `⑂` chip on any message, OR "Fork from here" from user-msg sheet.

| Step | Action | Evidence |
|---|---|---|
| 1 | Fork Conversation modal opens with Starting point preview | [Branch/IMG_4195](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Branch/IMG_4195.PNG) |
| 2 | Optionally set Branch Name (empty → auto-generate via `TITLE:` line) | — |
| 3 | Pick **Keep previous messages** (copy all) or **Summarize & start fresh** (lightweight) | [IMG_4196](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Branch/IMG_4196.PNG) |
| 4 | Tap **Create Branch** / **Summarize & Branch** (red pill) | — |
| 5 | App runs Branch Summary prompts if mode=summarizeFresh; persists parentBranchSummary | [prompt-editor.md §4](04-screens/settings/prompt-editor.md) |
| 6 | New Conversation created with parent links; user lands in it | [branch.md](04-screens/branch.md) |

---

### F11 — Generate inline image (direct)

**Trigger:** Rail 🖼 chip on an assistant message.

| Step | Action | Evidence |
|---|---|---|
| 1 | Tap 🖼 → placeholder card appears | [Chat/IMG_4129](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4129.PNG) |
| 2 | App extracts `[image: …]` tag from message OR synthesizes prompt | [prompt-editor.md §1.c](04-screens/settings/prompt-editor.md#1c-visual-roleplay-instructions-img_4164) |
| 3 | If Enable Refinement ON → refine via [T10 Image Refinement](07-prompts-and-llm-touchpoints.md) | [settings/image-engine.md](04-screens/settings/image-engine.md) |
| 4 | Send to image provider (ComfyUI or cloud) | — |
| 5 | Attach rendered image to message | [Chat/IMG_4130](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4130.PNG) · [IMG_4147](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4147.PNG) |

**Non-blocking:** "Feel free to keep chatting."

---

### F12 — Edit / Regenerate generated image

**Trigger:** Tap image → fullscreen viewer → Edit, OR long-press inline image.

| Step | Action | Evidence |
|---|---|---|
| 1a | Short-press → [Fullscreen Viewer](04-screens/image-viewer.md) → tap ✏ Edit | [Edit image/IMG_4197](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4197.PNG) |
| 2a | Edit Prompt sheet — rewrite prompt, pick resolution | [IMG_4198](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4198.PNG) |
| 3a | Tap ↻ Regenerate → new image replaces/augments | — |
| 1b | Long-press inline image → sheet with Regenerate / Favorite / Share / Delete | [IMG_4201](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4201.PNG) |

---

### F13 — Generate video from image

**Trigger:** Fullscreen image viewer → 🎥 Video button, OR Chat image resolution modal → "Generate Video · From this image".

| Step | Action | Evidence |
|---|---|---|
| 1 | Viewer → tap Video, or Chat modal → Generate Video | [Chat/IMG_4131](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4131.PNG) · [Edit image/IMG_4197](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Edit%20image/IMG_4197.PNG) |
| 2 | App runs [Video Refinement](04-screens/settings/video-engine.md) with last 3 turns | — |
| 3 | Refined prompt sent to video provider (ComfyUI video workflow or cloud) | — |
| 4 | On complete, video attached; duration badge shows `▶ 5s` / `▶ 8s` | [Gallery/IMG_4148](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Gallery/IMG_4148.PNG) |

---

### F14 — Set Author's Note (plot steering)

**Trigger:** Chat → Chat Controls (⋯) → Author's Notes.

| Step | Action | Evidence |
|---|---|---|
| 1 | Open Chat Controls | [Chat Controls/IMG_4210](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat%20Controls/IMG_4210.PNG) |
| 2 | Tap Author's Notes | [IMG_4213](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat%20Controls/IMG_4213.PNG) |
| 3 | Pick scope (All Chats / This Character / This Conversation) | — |
| 4 | Enter Notes text (or tap an example chip) | — |
| 5 | Adjust Injection Depth stepper | — |
| 6 | Save Notes | — |

**Exit state:** AuthorsNote persisted; future prompts in matching-scope conversations inject it at the configured depth.

---

### F15 — Autopilot

**Trigger:** Chat → Chat Controls → Autopilot → 5/10/25 → Start.

| Step | Action | Evidence |
|---|---|---|
| 1 | Have ≥1 AI reply with Suggested Replies available | [Chat Controls/IMG_4210](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat%20Controls/IMG_4210.PNG) |
| 2 | Pick turn count (5, 10, 25) | — |
| 3 | Tap ▶ Start Autopilot → loop runs | — |
| 4 | Each iteration: pick a suggested reply → send → wait for AI reply → repeat | `(inferred)` |
| 5 | Stop on: turn cap reached, user sends, user taps stop, provider error | `(inferred)` |

---

### F16 — Configure Memory (Lore + RAG)

**Trigger:** Menu → Settings → CHAT EXPERIENCE → Memory.

| Step | Screen | Evidence |
|---|---|---|
| 1 | Memory root — Character Memory toggle + Retrieval Tuning + Auto Lore Extraction | [Settigns/IMG_4155](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4155.PNG) |
| 2 | Retrieval Tuning — 8 knobs (Lore Scan Depth, Knowledge Budget, etc.) | [IMG_4156](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4156.PNG) · [IMG_4157](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4157.PNG) |
| 3 | Auto Lore Extraction — provider + frequency + editable prompt | [IMG_4158](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4158.PNG) → [IMG_4161](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4161.PNG) |

**Exit state:** Background extractor runs every N turns after this is enabled; keyword + RAG retrieval run every main-chat turn using the tuned knobs.

---

### F17 — Export / Import backup

**Trigger:** Menu → Settings → DATA & SECURITY → Storage.

| Step | Action | Evidence |
|---|---|---|
| 1 | Storage screen shows per-category breakdown | [Settigns/IMG_4188](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4188.PNG) |
| 2 | Tap **Export My Data** → download zip | [IMG_4189](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4189.PNG) |
| 3 | Tap **Import Backup** → pick zip → restore | [IMG_4189](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4189.PNG) |

---

### F18 — Revoke cloud consent / App Lock / Reset

**Trigger:** Menu → Settings → DATA & SECURITY.

| Action | Screen |
|---|---|
| Revoke cloud consent | Toggle Cloud AI Consent ([Settigns/IMG_4153](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4153.PNG)) |
| Enable App Lock | Toggle App Lock (Face ID) ([IMG_4153](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4153.PNG)) |
| Delete per-category storage | Storage → Delete on a row ([IMG_4188](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4188.PNG)) |
| Nuke everything | Erase Everything & Reset → confirm ([IMG_4192](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4192.PNG)) |
| Reset settings only | Reset All Settings ([IMG_4153](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4153.PNG)) |

---

### F19 — Community flows (SCOPE-CUT but documented as reference)

See [04-screens/community.md](04-screens/community.md). Journeys: join (gate consent), browse Trending / New Arrivals / Leaderboards, filter by tags, preview Character Detail, **Try It** sandbox, **Add to Library**, Upload Character, Follow creators, Report flag.

---

## User Extensions / Scope Decisions

- All flows above are **preserved in the clone EXCEPT**:
  - F1 Slide 3 rewritten for BYOK (not Atlas/RunPod).
  - F1 Slide 5 rewritten (no credits, no tiers).
  - F13/F11 gracefully degrade when no image/video provider is configured (inline CTA to Settings instead of 🖼/🎥).
  - F19 Community flows entirely cut.
- New/adjusted flows:
  - F14 gains a **"Active Author's Notes"** badge on the composer so users can see at a glance that steering is active.
  - F15 Autopilot: add explicit Stop button in the composer while running.
  - F17 Export/Import: extend to include LorebookEntries and MemoryDocuments embeddings.
- F9 open question (Edit user message downstream behavior): clone should **ask** the user on Edit — "Re-run assistant reply?" (Yes / No). Default = No, keep locally.

## Open Questions

- Assistant-mode creation flow (F2 variant with mode=Assistant) — the Character editor likely has Expertise / Communication Style / Rules sub-sections not captured.
- Autopilot exact termination rules (F15).
- Export My Data ZIP schema (F17).
- Branch-of-a-branch (F10 recursion).
