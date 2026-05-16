# Audit — Chat surface gap vs PersonaLLM

> Plan number: **13** (after 0012-phase-12-device-polish).
> Created at the close of Tanda 11 (`58ba618` `polish(chat): round 2 PersonaLLM parity — class chrome end-to-end`).
> Purpose: hand a clean session everything it needs to close the remaining gap between our chat and the PersonaLLM reference (`base/Seed/PersonaLLM-Reference/04-screens/chat.md`) without re-doing discovery.
>
> **Do not start coding from this doc.** It's the briefing, not the plan. The clean session should read it, then write a `0014-...-plan.md` with subtasks before touching code.

---

## Side-by-side (Tomás Lecuona ours vs AXIOM-7 PersonaLLM)

Reference images:
- Ours: `[Image #16]` in this thread — Tomás Lecuona, orange accent.
- Theirs: `[Image #17]` in this thread — AXIOM-7, red accent.
- Spec: `base/Seed/PersonaLLM-Reference/04-screens/chat.md` §C "Active chat".

What we already match (don't undo):
- Capsule composer with `⋯` left, mic right, accent-tinted send when typed
- Action rail on the right with 3 chips (regen, fork, image) at 40pt
- Top accent wash (height 340 × intensity 0.22)
- Per-character accent throughout: bubble border, send button, rail chips, wash
- ChatHeaderTitle clickable → CharacterDetailSheet (medium detent)
- Nav bar Liquid Glass material

---

## Gaps to close (ranked by visual impact)

### G1 — Background: radial glow behind header, not vertical wash
- **PersonaLLM**: the accent reads as a soft radial halo anchored behind the upper portion of the screen — feels like the character is casting light onto the surface. Falls off in every direction, not just down.
- **Ours**: `AccentTopWash` is a strict top→bottom `LinearGradient`. Reads as a banner, not a halo.
- **What to try**:
  - Replace the linear wash with a `RadialGradient(center: .top, startRadius: 0, endRadius: ~520)` so the falloff is omnidirectional from the upper area.
  - Keep intensity around 0.22 (don't crank it — the look is "halo you notice on second glance", not "tint").
  - Possibly compose **two layers**: a faint radial near the header + the existing top wash at lower intensity, blended.
  - Verify in Reduce Transparency that the gradient still renders (it's `Color`-based so it should).
- **File**: `storyplots/Core/DesignSystem/BrandTopWash.swift` — extend with an `AccentHaloWash` modifier, keep `accentTopWash` for non-chat surfaces.

### G2 — Header "card" feel + missing right-side chips
- **PersonaLLM**: header is back chevron + avatar (medium-large, ringed) + name (bold) + tagline + **list icon (conversations) + plus icon (new conversation)** on the right. Whole thing sits inside the halo so it reads as a card the wash is illuminating.
- **Ours**: standard iOS nav bar, principal slot holds `ChatHeaderTitle` (28pt avatar + name + tagline + chevron-down hint). No right-side icons.
- **What to try**:
  - Add list-icon `ToolbarItem(.topBarTrailing)` → opens a list of conversations with this character (we already have `CharacterChatsView` — reuse).
  - Add plus-icon `ToolbarItem(.topBarTrailing)` → starts a new conversation with the same character (reuse `CharacterLandingView.createConversation`).
  - Consider bumping `ChatHeaderTitle` avatar to ~36pt so the header feels more like a card centerpiece.
- **Files**: `ChatView.toolbarContent`, new helpers on `ChatViewModel` (`createSiblingConversation()`), navigation wiring.

### G3 — Scenario card persists as a separate visual element at top of thread
- **PersonaLLM**: the chosen scenario lives as a **dedicated card** at the top of the conversation — corner pill "Scenario 1", title pill on the right ("First Activation"), scenario body inside a rounded rect with **accent border**. It's visually distinct from regular character messages.
- **Ours**: the scenario body is inserted into the `messages` table as the first `assistant` message — it renders identically to any other assistant turn (no special card chrome, no scenario label).
- **What to try**:
  - Detect "first assistant message of a conversation that has `scenario` text matching" and render it as a `ScenarioCardView` instead of a regular `MessageBubbleView` — corner labels + accent border + bigger padding.
  - OR add a `kind: 'scenario'` discriminator on the message row (would require backend schema change — avoid).
  - Cleanest: in `ChatViewModel.load()`, mark the first message as `isScenario: Bool` when its text equals the character's stored scenario. `ChatView.resolvedScroll` switches renderer.
- **Files**: `MessageItem` model gains `isScenario`, new `ScenarioCardView`, `ChatView.resolvedScroll` swap.

### G4 — Message bubble fill: subtle, not zero
- **PersonaLLM**: assistant bubble HAS a fill — a slightly darker dark-grey than the surrounding bg (looks ~`bg1` or `bg.opacity(0.85)`), with thin red border. The "no fill" we shipped in Tanda 11 is **too empty** vs the reference — text floats on flat dark with no boundary.
- **Ours**: char bubble `fill: Color.clear` + stroke `accent.opacity(0.35)`.
- **What to try**: restore a subtle fill — `Theme.Color.bg1` (or a new `bg0` darker than `bg`) — keep the thin accent stroke. The fill should be just enough to delineate the bubble against the wash without re-introducing the heavy `bg2` look.
- **File**: `storyplots/Features/Chat/MessageBubbleView.swift` — `bubble` background.

### G5 — Per-message timestamps
- **PersonaLLM**: every bubble has a `HH:mm` timestamp directly below it (fg3/fg4, small).
- **Ours**: no timestamps shown anywhere on the message stream.
- **What to try**: add a `Text(formattedTime(from: item.createdAt))` under each bubble in `MessageBubbleView`, `Theme.FontStyle.timestamp`, `fg4`, with the same alignment as the bubble (left for assistant, right for user).
- **File**: `MessageBubbleView.body` (under both branches of the HStack).

### G6 — Composer spacing and ⋯/mic chip weight
- **PersonaLLM**: composer feels less compressed — the field has more horizontal room, the `⋯` chip on the left is a clear filled circle with subtle accent, mic chip on right is brighter accent. Both chips look heavier (more presence) than ours.
- **Ours**: 40pt chips with `accent.opacity(0.14)` fill + `0.4` stroke. Reads a bit thin against the bg.
- **What to try**:
  - Bump fill opacity 0.14 → 0.18, stroke 0.4 → 0.55 so the chips assert themselves.
  - Slightly larger glyph size inside the chip (the `⋯` could be 20pt vs 18).
  - More horizontal padding between chips and the field (so the field doesn't feel sandwiched).
- **File**: `ComposerView` + `ChatPanelsMenu`.

### G7 — Tagline truncation behaviour
- **PersonaLLM**: tagline truncates to one line with `…` at the end; the full text reveals in the detail sheet.
- **Ours**: same behaviour BUT we already pass the tagline to the detail sheet. Fine — no change needed beyond confirming. Mention here so the clean session doesn't waste time on it.

### G8 — Bottom safe-area: composer doesn't have its own background tint
- **PersonaLLM**: the area below the composer (the home-indicator zone) reads the same bg with the wash subtly falling off, no abrupt division.
- **Ours**: composer bar uses `.thinMaterial` + a top hairline. Below it the home indicator zone is the host `bg` (no wash). Looks acceptable; if we add the radial halo in G1 the falloff may need to extend further or skip the safe-area zone.
- **What to try (after G1 lands)**: re-check on real device; might need to bump wash `height` from 340 → screen-height-ish, or use `.background(Theme.Color.bg)` with the wash overlay only on the scroll content (not the composer bar).

---

## Things explicitly NOT in scope (user said so)
- 💬 **Suggested Replies** pill above composer — PersonaLLM has it, our base doesn't. Skip.
- Voice dictation behind the mic — mic stays a visual stub until we wire `Speech.framework`.
- Long-press image menu (Regenerate/Favorite/Delete) — image viewer already covers Regenerate + Delete.
- Video / Edit Prompt sheet — need backend endpoints we don't have.
- Favorites / hearts on images — need DB column.

---

## What to read before writing code
1. `base/Seed/PersonaLLM-Reference/04-screens/chat.md` §C, §G, §H — message bubble anatomy and rails.
2. `storyplots/Features/Chat/ChatView.swift` — body is split across `mainStack`, `toolbarContent`, `messagesScroll`, `ChatSheetsModifier` (Tanda 11 refactor). Keep that split; don't collapse it or the compiler will time out again.
3. `storyplots/Features/Chat/MessageBubbleView.swift` — rail + bubble logic.
4. `storyplots/Features/Chat/ComposerView.swift` — left chip / mic / send.
5. `storyplots/Core/DesignSystem/BrandTopWash.swift` — current wash modifier.

## Test characters in the seeded DB
- Maya Okonkwo — teal/sky accent. Good for legibility test on cool accents.
- Tomás Lecuona — orange accent. The screenshot the user shared (`#16`) is this one.
- Gianni — sky/blue accent.
- Use one of these (not Roberth/Hideo) for visual diff vs the AXIOM-7 reference.

## Suggested ordering for the clean session
1. G4 (restore subtle bubble fill) — single-line change, instant payoff.
2. G1 (radial halo) — biggest visual delta; spec the gradient carefully, test in sim.
3. G5 (timestamps) — small, finishes the "message anatomy" feel.
4. G2 (header right-side icons + sibling-conversation flow) — adds real functionality.
5. G3 (scenario card) — pleasant to have, more work.
6. G6 (composer chip weight) — micro-tuning at the end after the rest stabilizes.

## Constraints inherited from prior commits (don't undo)
- `ChatView` body must stay split — `mainStack`, `toolbarContent`, `noticeStrip`, `errorStrip`, `ChatSheetsModifier` are there because SwiftUI's type-checker chokes on the chained modifier stack.
- Per-character accent is the dominant theming axis. Brand-amber (`Theme.Color.brand1`) is reserved for app-level chrome (Home, People, Gallery, sidebar). Don't sneak brand1 back into chat.
- `Theme.Material.navBar` (regularMaterial) is the chat nav bar background. Don't remove that — Liquid Glass on the nav is part of the look.

## Verification ritual for the next plan
After the implementation tanda commits, screenshot the chat with:
- Maya Okonkwo (cool teal)
- Tomás Lecuona (warm orange — the user's reference screenshot character)
- One Roleplay scenario open (so the scenario card vs regular bubble distinction is visible)
Compare against the `[Image #17]` AXIOM-7 reference side-by-side. The G-list above maps directly to "did we close this?" checks.
