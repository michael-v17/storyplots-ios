# Handoff — Phase 11 closed + Phase 12 plan ready [2026-05-15]

**Status**: Phase 11 (IA Realignment) shipped + 8 polish commits after it. Phase 12 plan written, awaiting execution in a fresh session.
**Last commit**: `28c729d` docs(prp): plan for Phase 12 — device-testing polish round.
**Backend**: live at `api.storyplots.app` (Render Free — cold-starts after ~15min).
**Device**: tested on real iPhone via wireless deploy + Personal Team (7-day cert).
**User**: `xvp@storyplots.app` / `SmokeTest!Xvp2026`. Apple Sign-In is a disabled placeholder.

---

## Commits since Phase 11 base

| SHA | Title | Notes |
|---|---|---|
| `7517a69` | feat(phase-11): NavigationSplitView shell + 6 missing surfaces + Update 2 refinements | Base Phase 11. |
| `14606df` | fix(shell): sidebar-as-sheet for reliable iPhone nav + Home polish | NavigationSplitView columnVisibility was unreliable on iPhone iOS 26; switched to NavigationStack + sheet-presented SidebarSheet driven by AppShellEnvironment. Home greeting reorganized. Apple SI disabled placeholder. Icon v1 amber-glow. |
| `a2f4a19` | fix(polish): gallery placeholder, settings sticky title, edit affordance, icon | GalleryTile uses didResolve flag → placeholder on signed-URL miss. SettingsView switched to `.navigationTitle("Settings")` + `.large` for native scroll-collapse. CharacterChatsView gained Edit toolbar button. Icon regenerated with logo-reduced.png on neutral dark bg. |
| `593e835` | fix(icon): scale logo to 80% + display name "StoryPlots" | `INFOPLIST_KEY_CFBundleDisplayName = StoryPlots` added to both Debug and Release configs. |
| `b028ef3` | fix(icon): bump logo scale to 88% for stronger launcher presence | Final icon scale. |
| `d1d85d8` | config(backend): point to production Render at api.storyplots.app | `BackendConfig.url` swapped from local dev address. |
| `9985fad` | feat(polish): URLCache bump, shimmer gallery tiles, +menu in home, avatar viewer | URLCache.shared bumped to 50MB/300MB at app launch (intra-session caching only — cross-launch needs storage_ref keying, that's the Phase 12 work). Gallery tiles use shimmer skeleton during load. Home dropped the dashed "+ New persona" tile and added a brand-gradient + button to the "Your cast" header. CharacterEditView gained 132pt tappable avatar → AvatarFullscreenViewer (pinch-zoom + drag-to-dismiss). |
| `f116680` | fix(landing): retry once + warm-up labeling on cold-start failures | `storyplotsApp.init` fires GET `/health` on launch. `createConversation` retries once after 2.5s with "Waking up the backend…" label. |
| `cc78042` | polish(create-character): native-feel wizard chrome | CharacterCreateSheet refactored: native Section + footer hints (no extra floating cards), back button with chevron+capsule, brand-gradient shadow on primary CTA, keyboard submit-label flow. |
| `28c729d` | docs(prp): plan for Phase 12 — device-testing polish round | The plan to execute next. |

---

## Phase 12 plan — `.claude/PRPs/plans/0012-phase-12-device-polish.plan.md`

7 issues from real-device QA grouped into 3 commits:

1. **T1 — Persistent image cache**: `ImageCache` actor (NSCache + Caches/ disk, SHA-256 keyed by storage_ref, 7-day TTL) + `CachedRemoteImage` SwiftUI view replacing `AsyncImage` in AvatarView / GalleryTile / MessageImageThumbnail / CharacterCardView. Solves the "fotos re-cargan en cold launch" complaint.
2. **T2 — Split profile from persona**: ProfileView trims to email + display name. New PersonaListView + PersonaEditView for multi-persona support (the user can have many personas; appearance/background lives per persona, not on the user account). PersonaEditView mirrors CharacterEditView's avatar section (PhotosPicker upload + Generate with AI via `POST /personas/me/generate-avatar`). Surface new "Personas" row under Settings → Experience.
3. **T3+T4+T5 — Chat polish**:
   - `CharacterChatsView` rows enriched with last-message snippet (batch query messages by `IN conversation_id`).
   - `CharacterChatsView` nav-bar avatar tappable → AvatarFullscreenViewer.
   - `ChatHeaderTitle` (new) tappable → `CharacterDetailSheet` (new) with avatar (tappable → fullscreen) + name + tagline + scenario + Edit CTA.
   - `CharacterLandingView` hero avatar tappable → fullscreen; surface real backend error (not generic copy) so we can diagnose the warm-backend conversation-start failure (hypothesis: missing `character_snapshot` NOT NULL — web frontend sends it; iOS doesn't).
   - `ComposerView` rebuilt: bg2 rounded field with borderSoft, 36pt brand-gradient circular send button.

Plan self-review passes per AUTONOMY.md §5. Single commit per group. 8 new files, 10 modified, ~1200 lines estimated.

---

## Gotchas / lessons from this session

- **SourceKit shows `No such module 'Supabase'` lints constantly.** False positive — xcodebuild compiles fine. Ignore SourceKit's red squiggles for any file that imports Supabase.
- **Personal Team app icon won't refresh** unless the app is uninstalled from the device first. Same for `CFBundleDisplayName`. Use `xcrun simctl uninstall <udid> <bundle-id>` then re-run.
- **Render Free cold-start is real** — first request after ~15min idle takes 30-60s. `storyplotsApp.init` pre-warms via `/health`. The Landing retry handles when pre-warm hasn't completed yet.
- **iPhone 17 Pro Max simulator (`DDA5A72A-6CE0-429D-9317-93E8FA50A3A4`)** is the active test target. `mcp__XcodeBuildMCP__build_run_sim` uses these defaults via the session profile already set.
- **NavigationSplitView columnVisibility binding is unreliable on iPhone in iOS 26** with custom row chrome. We worked around it by switching to NavigationStack + sheet for the sidebar. Don't try to revert this without testing on physical device.
- **`PreferenceFamilyStore` is `internal` (not private)** — bumped during Phase 11 so VisualRoleplay / PromptEditor / Memory settings can share it. Keep it that way.
- **`AvatarFullscreenViewer` already exists** at `storyplots/Features/People/AvatarFullscreenViewer.swift`. Reuse for T3/T4/T5 avatar-tap wiring.
- **`CharacterEditView` is the mirror pattern for any avatar editor** — Avatar section with tappable 132pt AvatarView + "Generate with AI" button. Copy that shape for `PersonaEditView` in T2.
- **The hit-test overlap between Grammar widget and the + button on Home** was observed during simulator clicks but not reliably reproduced. Worth wrapping the + button in an explicit `.contentShape(Circle())` if the user reports it on device.

---

## How to resume

```
Execute .claude/PRPs/plans/0012-phase-12-device-polish.plan.md.

Three commits in order:
  T1 → feat(cache): persistent on-device image cache
  T2 → fix(profile): split user profile from persona; persona editor with avatar
  T3+T4+T5 → polish(chat): tappable header sheet, native composer,
             snippet previews, avatar tap

Per AUTONOMY.md §5: single commit per group, no WIP commits, verify
after each subtask. Backend live at api.storyplots.app.

Before T2 verify `user_personas` schema columns (photo_ref vs avatar_ref)
by inspecting an existing row.

Before T5 reproduce the conversation-start error on a warm backend
to confirm the missing-column hypothesis (most likely character_snapshot
NOT NULL).

Test target: iPhone 17 Pro Max sim (DDA5A72A-6CE0-429D-9317-93E8FA50A3A4),
backend at api.storyplots.app, user xvp@storyplots.app /
SmokeTest!Xvp2026. Push to origin/main after each commit.
```

---

## To review when human returns post-Phase-12

- Cold launch on LTE → avatars + recent strip appear instantly from disk cache (T1).
- Settings → Profile shows email + display name only; Experience has Personas (T2).
- Tap chat header → sheet slides up with character info + Edit CTA (T4).
- Composer chrome feels coherent with the rest of the app (T4).
- CharacterChatsView rows differentiate by last-message snippet (T3).
- Every prominent avatar (Landing hero, CharacterChats nav, Chat nav) tappable → fullscreen (T3+T4+T5).
- Scenario-start error shows the real backend message if it fails after warm-up (T5).

---

> Updated by Claude post-Phase-11 + polish + Phase-12-plan-ready.
> Next session reads this first, then the plan, then executes.
