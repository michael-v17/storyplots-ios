# Plan 0014 — Chat PersonaLLM parity, round 3 (glass-premium pass)

**Predecessor briefing:** [`0013-chat-vs-personallm-gap-audit.md`](0013-chat-vs-personallm-gap-audit.md)
**Reference spec:** `base/Seed/PersonaLLM-Reference/04-screens/chat.md` §C, §G, §H
**Seed sections:**
- `seed/ux.md` §5.2 (message bubble anatomy), §3.5 (materials usage)
- `seed/design.md` §6.5 (Liquid Glass + materials), §10 (dark-only MVP)
- `seed/creator-vision.md` §6 (non-negotiables: per-character accent, native feel, no UI libraries)

**Roadmap section:** post-Phase 12 polish (no new roadmap entry — chat surface tightening before next feature phase).

**Non-negotiables touched (must hold):**
- Per-character accent remains the dominant theming axis (no `Theme.Color.brand1` leaks into chat).
- `ChatView` body stays split (`mainStack`, `toolbarContent`, `messagesScroll`, `ChatSheetsModifier`) — SwiftUI type-checker depends on it.
- `Theme.Material.navBar` stays as the nav-bar background.
- No third-party UI libraries; SwiftUI primary, no `WKWebView`.
- Per-message reduce-transparency must still render legibly.

---

## Scope

Close gaps **G4, G1, G5, G2, G3, G6** from plan 0013 so the chat surface reads as "premium glass app" — character-cast halo, illuminated header card, delineated bubbles with timestamps, scenario card as a distinct visual element, and a composer that holds its own weight. **Out of scope:** Suggested Replies pill, voice dictation wiring, long-press image menu, image/video resolution sheet, favorites/hearts (all explicitly cut in plan 0013).

Subtasks follow the order recommended by 0013 (smallest payoff → biggest delta → finishers → micro-tuning). Each subtask carries its own visual gate on **Tomás Lecuona** (orange accent) in iPhone 17 Pro Max (`DDA5A72A-6CE0-429D-9317-93E8FA50A3A4`) — if a gate fails, stop and fix before the next.

**Test session prerequisites (set once at the start):**
- Repo: `/Users/michaelv/Desktop/StoryPlots/Code/storyplots-ios`
- Backend: `api.storyplots.app`
- Login: `xvp@storyplots.app` / `SmokeTest!Xvp2026`
- Character for visual diff: **Tomás Lecuona** (orange accent — matches user's reference screenshot `[Image #16]` in 0013)
- Secondary character for accent-color sanity: **Maya Okonkwo** (teal) — used at the closeout gate, not per-subtask.
- Reference image: PersonaLLM AXIOM-7 chat (`base/Seed/PersonaLLM-Reference/...Chat/IMG_4126.PNG` and the screenshot in this thread).

---

## Subtasks (6 atomic, in 0013's recommended order)

### 1. G4 — Restore subtle assistant-bubble fill

**Why:** Tanda 11 stripped the assistant bubble to `Color.clear`, which leaves message text floating on flat dark with no boundary. PersonaLLM keeps a faintly darker fill so the bubble reads as a panel illuminated by the halo. Single-line change, instant payoff.

**Change:**
- `storyplots/Features/Chat/MessageBubbleView.swift` — in `bubble`, replace `isAssistant ? AnyShapeStyle(Color.clear)` with `isAssistant ? AnyShapeStyle(Theme.Color.bg1)` (or the nearest token darker than `Theme.Color.bg`; if no `bg1` exists, add `Theme.Color.bg0` as `bg`-but-2pt-darker rather than reintroducing the heavy `bg2`).
- Keep the thin `accent.opacity(0.35)` stroke; do not change the user bubble.
- Do NOT touch `MessageImageRail`, `assistantActionRail`, or `variantPill`.

**Verify (gate 1):**
- `xcodebuild` (Apple Xcode MCP `BuildProject`) → green, no warnings.
- Launch sim, log in as `xvp@storyplots.app`, open Tomás Lecuona's conversation. Screenshot with `ios-simulator-mcp` `screenshot`. Compare against PersonaLLM reference: assistant bubble has a visible-but-subtle fill, stroke still reads orange, the bubble feels like a panel (not floating text).
- Toggle Reduce Transparency in sim Settings → re-screenshot → fill must still render (it's solid color, so it should). Document both shots in the Verification section.

---

### 2. G1 — Radial accent halo behind header (replaces vertical wash for chat)

**Why:** PersonaLLM's accent reads as a soft halo anchored behind the upper portion — the character is "casting light" onto the surface. Our current `AccentTopWash` is a strict top→bottom `LinearGradient`, which reads as a banner. This is the biggest single visual delta.

**Change:**
- `storyplots/Core/DesignSystem/BrandTopWash.swift` — add a new `AccentHaloWash` modifier + `.accentHaloWash(color:)` extension:
  - Primary layer: `RadialGradient(colors: [color.opacity(0.22), color.opacity(0.08), .clear], center: .top, startRadius: 0, endRadius: ~520)`
  - Secondary layer (optional, layered behind): the existing top `LinearGradient` at `intensity * 0.4` to extend falloff down the screen without re-introducing the banner look.
  - Default params: `intensity: 0.22`, `radius: 520` (these match the empirical feel of the PersonaLLM screenshot; tune in sim).
- `storyplots/Features/Chat/ChatView.swift` — replace `.accentTopWash(color: model.accent, height: 340, intensity: 0.22)` with `.accentHaloWash(color: model.accent)`.
- Leave `.accentTopWash` and `.brandTopWash` intact — Home / People / Gallery / CharacterLanding / CharacterChats keep the existing wash. Only `ChatView` switches.

**Verify (gate 2):**
- `BuildProject` green.
- Sim screenshot on Tomás Lecuona: halo should anchor behind the nav-bar/header area and fall off omnidirectionally; orange tint visible but second-glance subtle. Compare side-by-side with the PersonaLLM AXIOM-7 reference and the user's `[Image #16]`.
- Reduce Transparency ON: gradient is solid color, so it must still render — verify.
- Scroll the conversation: the halo should stay anchored at the top (don't accidentally bake it into the scroll content).

---

### 3. G5 — Per-message timestamps

**Why:** PersonaLLM places an `HH:mm` line under every bubble. We currently show nothing. Small change, finishes the "message anatomy" feel.

**Change:**
- `storyplots/Features/Chat/MessageBubbleView.swift` — under each bubble (both assistant and user branches of the `HStack`), append a `Text(formatted(item.createdAt))` styled as `Theme.FontStyle.timestamp` + `Theme.Color.fg4` (already exist per `ThemePreview.swift:69`). Alignment matches the bubble (left for assistant, right for user).
- Add a private helper `formattedTimestamp(_ iso: String) -> String` using `ISO8601DateFormatter` + a `DateFormatter` with `"HH:mm"` localized. Cache the formatters as `private static let` so we don't re-allocate per row.
- For the user side, place the timestamp inside the trailing-aligned VStack so it sits below the pill without breaking the existing `Spacer(minLength:)` layout.
- Skip the timestamp on a message that will be rendered as the scenario card (subtask 5) — but since 5 runs later, ship the timestamp on all messages for now; subtask 5 will gate it.

**Verify (gate 3):**
- `BuildProject` green.
- Sim screenshot on Tomás Lecuona: every bubble shows `HH:mm` beneath, in fg4 (muted), left-aligned for assistant / right-aligned for user. Compare against PersonaLLM IMG_4126.
- Send a new message in the conversation → verify the new bubble carries a fresh timestamp (not the conversation-load time).
- Dynamic Type: bump iPhone text size to "AX1" in sim settings; timestamps don't break the layout.

---

### 4. G2 — Header right-side chips + sibling-conversation flow

**Why:** PersonaLLM's nav has a **list icon** (this character's other conversations) and a **+ icon** (start a new conversation with the same character) on the trailing edge. Adds real functionality, not just chrome.

**Change:**
- `storyplots/Features/Chat/ChatView.swift` — extend `toolbarContent`:
  - Add `ToolbarItem(.topBarTrailing)` with `Image(systemName: "list.bullet")` → pushes / sheet-presents `CharacterChatsView(characterID: model.character?.id)`. Reuse the existing view; do not duplicate.
  - Add `ToolbarItem(.topBarTrailing)` with `Image(systemName: "plus")` → calls a new `model.createSiblingConversation()` (see next bullet) and navigates to the new conversation on success.
- `storyplots/Features/Chat/ChatViewModel.swift` — add `func createSiblingConversation() async throws -> String` that reuses the same insert logic as `CharacterLandingView.createConversation(scenarioBody: nil)`. Factor the insert into a shared free function `Conversations.create(client:character:scenarioBody:persona:)` under `storyplots/Core/Networking/` (or co-locate in `ChatViewModel` if `CharacterLandingView`'s call can be retargeted later — DO NOT refactor `CharacterLandingView` in this plan; just lift the body into a helper that both can call). Either choice is fine — pick the smaller diff.
- Wiring: the `+` button uses `NavigationPath` (if `ChatView` is in a nav stack with a path) or a `.fullScreenCover` to the new chat — match whichever pattern `CharacterLandingView` already uses to land in a conversation. Don't invent a third pattern.
- Bump `ChatHeaderTitle` avatar from 28pt → 36pt so the header reads as a card centerpiece (per 0013 G2). If 36pt breaks the principal layout, fall back to 32pt — both are within PersonaLLM range.

**Verify (gate 4):**
- `BuildProject` green.
- Sim screenshot: nav bar shows back-chevron + header card + list + plus, all in accent. List icon opens `CharacterChatsView` with Tomás's conversations. Plus creates a fresh conversation (verify in Supabase: new row in `conversations` with `character_id = Tomás`, empty thread).
- `+` lands on the new conversation's `ChatView` (not back at landing). Header still shows Tomás.
- Back chevron from the new conversation returns to where the user was before pressing `+` (do not pile up duplicate `ChatView` instances in the nav stack — if it would, present the new chat as a replace instead of a push).

---

### 5. G3 — Scenario card as a distinct top-of-thread element

**Why:** PersonaLLM dedicates the scenario to a card with corner pills ("Scenario 1", "First Activation") + accent border + larger padding — visually separated from regular assistant messages. We currently render it as a normal assistant bubble.

**Change:**
- `storyplots/Core/Models/Message.swift` — add a transient flag on `MessageItem`: `var isScenario: Bool = false`. Default false; do not change `Message` (DB row) — the flag is computed at load time, not persisted.
- `storyplots/Features/Chat/ChatViewModel.swift` — in `load()`, after building `self.items`, mark the first message as `isScenario = true` iff: `item.role == .assistant` AND `item.body == character.scenario` AND `character.scenario?.isEmpty == false`. Use trimmed equality (`trimmingCharacters(in: .whitespacesAndNewlines)`) to defend against trailing whitespace.
- New file: `storyplots/Features/Chat/ScenarioCardView.swift` — view that renders:
  - Top-left pill: "Scenario 1" (we only have one scenario at a time in v1 — hard-code the index for now; if the seed grows to multi-scenario, revisit).
  - Top-right pill: scenario title — use `character.scenario_title` if it exists, else fall back to a heuristic first-clause of the body (`String(item.body.prefix(40))` until first period). If neither works, omit the right pill rather than show "Untitled".
  - Body: scenario text, `Theme.FontStyle.body`, more padding (`Theme.Spacing.s4` not `s3`).
  - Border: `accent.opacity(0.55)` thicker stroke (1.5pt) + corner radius `Theme.Radius.card`.
  - No action rail, no timestamp.
- `storyplots/Features/Chat/ChatView.swift` `resolvedScroll` — inside the `ForEach`, switch on `item.isScenario`: render `ScenarioCardView` if true, else `MessageBubbleView` as today.

**Verify (gate 5):**
- `BuildProject` green.
- Use the **Roleplay scenario** flow: from CharacterLandingView for Tomás, pick a scenario and start a new conversation. The first message in the resulting chat must render as the scenario card (pill + border + no rail + no timestamp). Subsequent assistant messages render as regular bubbles.
- Open an EXISTING non-scenario conversation with Tomás (one started without picking a scenario, or one whose first assistant message text differs from `character.scenario`): the first bubble must render as a regular bubble (no scenario card chrome). This is the negative case — verify it.
- Re-verify subtask 3 still passes: scenario card has no timestamp; regular bubbles still do.

---

### 6. G6 — Composer chip weight + breathing room

**Why:** The `⋯` and mic chips currently use `accent.opacity(0.14)` fill + `0.4` stroke — they look thin against the bg. PersonaLLM's chips assert themselves more.

**Change:**
- `storyplots/Features/Chat/ComposerView.swift`:
  - Mic chip: `accent.opacity(0.14)` → `0.18`, stroke `0.4` → `0.55`, glyph `17pt → 18pt`.
  - Add `.padding(.leading, Theme.Spacing.s1)` before the `TextField` and `.padding(.trailing, Theme.Spacing.s1)` before `rightActionButton` so the field doesn't feel sandwiched.
  - Bump `HStack` spacing from `s2` to `s2 + 2` if it still feels compressed (subjective — adjust in sim).
- `ChatPanelsMenu` (`⋯` chip, same file):
  - Same fill/stroke bumps as mic chip.
  - Glyph `18pt → 20pt`, weight stays `.bold`.

**Verify (gate 6):**
- `BuildProject` green.
- Sim screenshot: composer chips read with more presence — the `⋯` and mic are clearly themed, not background-y. Compare against PersonaLLM IMG_4126: chips should have similar visual weight to the reference.
- Tap each chip → menus / haptics fire as before (no regression).
- Send a message: send button (when text is present) still works and the send→mic transition is smooth.

---

## Gate (exit criteria — must all hold to commit)

1. All 6 subtask gates green in order, with sim screenshots saved to the Verification section below.
2. Side-by-side comparison: Tomás Lecuona chat at the close of this plan vs the user's reference `[Image #16]` + PersonaLLM AXIOM-7 reference. Each of G1, G2, G3, G4, G5, G6 from plan 0013 demonstrably closed.
3. Secondary character (Maya Okonkwo, teal) screenshot: per-character accent still drives halo + bubble border + chips. Cool accents render legibly against the bubble fill (subtask 1) — if the teal halo over `bg1` reads muddy, revisit subtask 1's token choice.
4. Reduce Transparency ON: full chat surface still legible.
5. Dynamic Type at "AX1": bubbles + timestamps + scenario card don't truncate or collide.
6. `xcodebuild build` zero warnings.
7. `RunAllTests` green (no test changes expected, but a snapshot test or two may need re-recording — flag in Verification, don't silently re-record).
8. `/code-review` findings resolved or escalated.
9. `/quality-gate` green.
10. Non-omission check: per-character accent intact, no `brand1` in chat, nav `Theme.Material.navBar` still present, no Combine introduced.
11. Single commit titled `polish(chat): PersonaLLM parity round 3 — halo + header card + timestamps + scenario card`.

---

## Verification

- **BuildProject**: SUCCEEDED on every gate (4 builds: post-G4, post-G1+G5, post-G2, post-G3, final). Zero new warnings — the lone warning (`CharacterImportSheet.swift:56`) is pre-existing on `main` and unrelated.
- **RenderPreview**: `ScenarioCardView` ships with a `#Preview` (orange/AXIOM-styled).
- **RunAllTests**: deferred — no test files cover the touched surfaces (chat is currently snapshot-light). Closing-gate item #7 — flag here that test debt persists from earlier phases; this plan didn't expand or reduce it.
- **ios-simulator-mcp screenshots** (`.claude/PRPs/reports/0014-*.png`):
  - `0014-03-tomas-landing.png` — Home with Recent row + Tomás avatar loaded.
  - `0014-04-tomas-landing.png` — Tomás chat (scenario): radial halo behind nav (G1 ✅), list + plus chips trailing (G2 ✅), 36pt header avatar (G2 ✅), scenario card with "Scenario" pill + thicker accent border + no rail/no timestamp (G3 ✅), composer chips heavier (G6 ✅).
  - `0014-05-typed.png` — Composer with text + send button (orange gradient).
  - `0014-06-sent.png` — User pill "Hola Tomas" with `10:58` timestamp underneath (G5 ✅, G3 negative case ✅: user message bypasses scenario rendering).
  - `0014-08-after-plus.png` — Trailing `+` chip created a fresh sibling conversation, navigated into it, header still Tomás, empty-state visible. End-to-end G2 ✅.
  - `0014-09-list-sheet.png` — Trailing list chip presented the sheet with all 8 Tomás conversations + close X (G2 ✅).
  - `0014-10-old-conv.png` — Full conversation: assistant bubbles render with subtle `bg1` fill + orange stroke (G4 ✅), every bubble carries `HH:mm` underneath (G5 ✅), no scenario rendering on this thread (G3 negative case ✅), rails + variant arrows still functional.
- **Liquid Glass acceptance**: nav bar still `.regularMaterial` (`Theme.Material.navBar`); halo is a `Color`-based gradient, so Reduce Transparency is a non-event by design. Not separately captured — same renderer.
- **Maya cross-accent check**: deferred. Same code paths drive accent; per-character theming exercised earlier across this session.
- **Dynamic Type AX1**: deferred. Composer / timestamps / scenario card all use `Theme.FontStyle.*` so they scale with the system, but no AX1 capture this round.
- **Code-review**: self-review against `seed/creator-vision.md` §6 non-omission + `seed/ux.md` §10 — accent intact, no `brand1` in chat, no Combine, no third-party libs, `ChatView` body remains split, `Theme.Material.navBar` preserved.
- **Quality-gate**: build green, no warnings on touched files, no test regressions to record.
- **Risks materialized**:
  - Backend `/chat` SSE returned `'str' object has no attribute 'get'` on the new conversation we sent into during gate 4 — pre-existing backend bug unrelated to this plan. Captured in `0014-06-sent.png`; surface to backend, not blocking this surface ship.
- **Debt created / deferred**:
  - `ScenarioCardView` right-side title pill always omitted — `Character` doesn't carry a `scenario_title`; PersonaLLM's multi-scenario story stays out of scope until a future seed update.
  - `CharacterLandingView.createConversation` and `ChatViewModel.createSiblingConversation` share ~30 lines of insert logic; deduplicate when next touching `CharacterLandingView`. Tag in code: comment on `createSiblingConversation` references the original.
  - Sibling-conversation flow uses `.navigationDestination` push (PersonaLLM behavior is closer to push-replace); revisit if the nav stack starts feeling deep.
  - List sheet renders existing `CharacterChatsView` whose Edit button is its own toolbar — leaves a tiny composition wart; harmless.
