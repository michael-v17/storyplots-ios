# Handoff — autonomous Fase 11 run [2026-05-15]

**Status**: Fase 11 shipped (12 of 16 sub-tasks fully done, Task 8a partial).
**Phase**: 11 — IA Realignment + Missing Surfaces
**Last commit**: pending — see `git log` after the wrap-up commit lands.
**Wall-clock used**: ~50 min.

---

## Background — what triggered this round

The creator updated the seed (commit `4ba72df`) to redefine Fase 11 as
**IA Realignment + Missing Surfaces** and added PersonaLLM consensus
(commit `0b3b067`) for look-vs-feel. The previous "Fase 11 polish"
work shipped earlier (commits `8fa1d13` and `7978188`) is unchanged;
this run rebuilt the top-level information architecture and added the
six surfaces the seed promised but never landed.

---

## What landed this run

### Architectural rewire — sidebar replaces TabView

- `NavigationSplitView`-based `AppShellView` is the new app root.
- Sidebar carries: permanent wordmark header, three top-level destinations
  (Home / Characters / Gallery), grouped Recent Chats (one row per
  character with chat count, sorted by latest activity), and a footer
  with the persona card, Settings, and Sign out.
- Tap a Recent row → pushes `CharacterChatsView` (list of that character's
  chats) onto the detail stack and auto-dismisses the drawer.
- `MainTabView.swift` deleted; `RootView` now mounts `AppShellView`.

### Home rebuild — wordmark + recents + grammar + cycler + search

- Wordmark image now sits prominently in Home content (above greeting).
- Horizontal Recent Characters strip + tappable Grammar widget +
  HomeNudge when empty.
- Three-mode layout cycler (grid / circles / list), persisted via
  `@SceneStorage("home.layoutMode")` — visible only when ≥3 characters.
- `.searchable` over name + tagline + scenario.
- HomeViewModel reoriented to load characters + persona + grammar
  snapshot in parallel.

### Six new surfaces

- **GalleryView** (top-level destination) — grid of `generated_images`
  with viewer + delete via backend.
- **GrammarDashboardView** — brand-gradient accuracy ring, top-3 issue
  categories, recent 20 corrections, "Run insights now" button.
- **CharacterImportSheet** + `CharacterCardParser` — PNG `tEXt` chunk
  parsing (v1/v2/v3 via `CGImageSource` + base64 JSON), refine via
  `POST /character-refine`, save to `characters` table.
- **VisualRoleplaySettingsView**, **PromptEditorView**,
  **MemorySettingsView** — three new sub-screens persisted to
  `users.preferences` JSONB via the now-internal `PreferenceFamilyStore`.

### New mid-flow screens

- **CharacterLandingView** — pre-chat opener for tap-from-Characters.
  Shows hero avatar, name, tagline, mode pill, and either a scenario
  card (creates a new conversation seeded with the scenario as the
  first assistant message) or an empty-state CTA.
- **CharacterChatsView** — destination from sidebar Recent row, lists
  all conversations for a single character.

### Refinements baked in (Update 2.C)

- Section labels use small-caps + tracking everywhere
  ("RECENT", "YOUR CAST", "ACCURACY", "TOP ISSUES").
- Image-generation loading copy: **"Generating… · Feel free to keep
  chatting"** replaces the old "Painting…" line.
- Assistant bubble gains a `< n/total >` variant pill at the top-leading
  corner (in addition to the existing dots indicator).
- Settings now has an "Experience" section with rows for Visual roleplay,
  Prompt editor, Memory (user-facing). Grammar is split into "Grammar
  dashboard" + "Grammar settings".
- `Character` now conforms to `Hashable` (via `id`) so destinations can
  pass it directly.

---

## Build + run

- `xcodebuild build` → SUCCEEDED (Debug, iPhone 17 Pro Max sim, iOS 26).
- App installs + launches cleanly. Smoke screenshots captured for
  Home (default + layout cycler visible), Grammar dashboard, and Sidebar.

---

## Deltas vs the plan

- **Task 8a (Floating MessageRail) shipped partial.** The full refactor
  of `MessageBubbleView` (selection-driven floating vertical rail of
  4 circular chips on the selected message) was deemed high-risk for an
  unattended autonomous run because it touches `ChatView.messagesScroll`
  selection state, gesture wiring, and bubble reflow simultaneously.
  The two adjacent Update 2.C refinements (image-gen copy + variants
  pill) landed instead; the existing inline action chips continue to
  render unchanged. Follow-up: complete the rail refactor as a
  standalone cycle.

- **Snapshot tests deferred.** Plan §Testing Strategy lists Swift Testing
  unit tests for sidebar grouping, card parser, and gallery ordering.
  Not written in this run; filed as a follow-up.

- **`.toolbar(.hidden, for: .navigationBar)` swapped for
  `.toolbarBackground(.hidden, for: .navigationBar)`** on Home,
  People, Gallery, so the sidebar toggle button stays visible in the
  nav bar without re-introducing the bar background. The wordmark hero
  in Home renders below the nav-bar safe area cleanly.

---

## To review when human returns

1. Visually walk all three destinations from the sidebar toggle.
2. Tap a Recent row → confirm `CharacterChatsView` lists the right
   conversations and tapping one opens `ChatView` with full history.
3. Tap a character on Home/Characters → confirm `CharacterLandingView`
   opens; tap scenario card → fresh conversation + scenario as first
   assistant message.
4. Open Settings → Experience section → each new sub-screen loads and
   round-trips a save to `users.preferences`.
5. Gallery → confirm the grid + viewer + long-press delete cycle.
6. Grammar dashboard → tap "Run insights now" and confirm the backend
   updates aggregate row.
7. Try Character Import with a real Character Card v2 PNG.

---

## Follow-ups

- **Follow-up A**: complete the floating MessageRail refactor (Task 8a
  full version) — selection state in ChatView, tap-empty-to-deselect,
  remove inline action row when selected.
- **Follow-up B**: write the deferred Swift Testing unit tests
  (`SidebarViewModelTests`, `CharacterCardParserTests`,
  `GalleryViewModelTests`).
- **Follow-up C**: backend `/api/v2/ios/push/register` route (AUTONOMY
  §4 prohibits modifying `base/`).

---

> Updated by Claude per AUTONOMY.md §7 after the autonomous Fase 11 run.
> The plan + report are the durable artifacts; this file is the entry
> point for the human reviewer.
