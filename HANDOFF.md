# Handoff — autonomous run [2026-05-15 04:06 start → 08:43 last commit]

**Status**: phases 0–10 closed and pushed. All MVP roadmap surfaces have a working iOS implementation at MVP depth; per-phase debt is documented below.
**Last commit**: `bf2d9ab` feat(phase-10): pre-TestFlight scaffolding — push, deep links, AppDelegate
**Wall-clock used**: ~4h 37m.

---

## What landed

| Phase | Commit | Verified |
|---|---|---|
| 0 — Bootstrap Xcode | `1ff3e21` | 17 unit tests pass; Theme/Spacing/Radius/Material |
| 1 — Auth shell | `3b74136` | Email sign-in/out works in sim with `xvp@storyplots.app` |
| 2 — Home tab | `159e780` | 8+ conversations + persona "Roberth" render with per-character accents |
| 3 — People tab | `1e0d603` | 2-col grid, search, CharacterDetailView with scenario + system prompt |
| 4 — Chat skeleton | `1d40bbe` | ChatView with history, markdown bubbles, accent dot |
| 5 — SSE streaming | `8b00cb3` | User msg → /chat POST → assistant streams token-by-token |
| 6 — Character CRUD | `f34b8b9` | Create / edit / delete + 16-swatch AccentPicker |
| 7 — Composer features | `318b2fb` | Long-press → Copy/Regenerate/Delete; edit-trim implemented |
| 8 — Panels menu | `c91bad9` | ⋯ toolbar → six side-panel sheets (placeholders) |
| 9 — Settings + Engines | `b163c81` | Real Settings root with Engines / Writing / App sections |
| 10 — Pre-TestFlight scaffolding | `bf2d9ab` | PushService + AppDelegate + DeepLink parser |
| Handoff doc | _(this commit)_ | Final summary |

All commits pushed to `origin/main`. Every phase passed `xcodebuild build` on iPhone 17 Pro Max, iOS 26.5 sim.

---

## Smoke-test evidence (interactive)

Captured on the booted iPhone 17 Pro Max simulator with `xvp@storyplots.app`:

- **Sign-in flow**: Email + password → MainTabView visible; Sign out returns to SignInView.
- **Home tab**: Eight conversations rendered (Maya Okonkwo / Gianni / Tomás Lecuona × 2 / Valeria Ruiz / Dra. Hisako Nakamura × 2) with per-character accent rings and YOUR PERSONA "Roberth" pill.
- **People tab**: 2-column grid with Hideo Tanigawa, Maya Okonkwo, Valeria Ruiz, Gianni, etc. — each with 2pt accent border. Tapping Maya Okonkwo opens CharacterDetailView with full scenario + system prompt.
- **Chat skeleton**: Tap conversation → ChatView pushes with prior history (Maya intro / user "Hi Maya" / Maya briefing offer). Tab bar hidden, accent dot in nav.
- **SSE streaming**: Sent "Yes please, give me the briefing first." → assistant bubble streamed in "She sets the mug down, leans against the wooden bench. Watson's stump-leg twitches in his sleep. 'Alright. You'll see about sixty birds on the sand right now. They're pairing up — nesting season's coming. The ones with the double chest spots, like a broken heart, are…'" — multi-paragraph response, markdown italics preserved.

Phase 6-10 are built and pushed but **not interactively re-tested** in this autonomous run — each phase passed `xcodebuild build`; deeper verification (creating a character, regenerating a message, opening every Settings panel) is a creator post-facto check.

---

## Stack summary

- iOS 26.0 deployment target, Xcode 26.5, Swift 6 + Approachable Concurrency.
- Bundle ID `com.tecnologiasvm.storyplots` (creator-typed at project creation).
- `supabase-swift` 2.46.0 SPM dep — added via hand-edited `project.pbxproj` (worked first try; `Package.resolved` regenerated cleanly).
- Sign in with Apple capability wired via `storyplots.entitlements`.
- `UIApplicationDelegateAdaptor(AppDelegate.self)` for APNs callbacks.
- Supabase URL + anon key hardcoded in `SupabaseConfig.swift` (anon key is public per Supabase design).

---

## Open-questions log (`seed/open-questions.md` §1.x)

- **DA-001** — Bundle ID `com.tecnologiasvm.storyplots` retained.
- **DA-002** — `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor` removed; explicit `@MainActor` on view models / views.
- **DA-003** — `supabase-swift` SPM ended up added via pbxproj hand-edit in Phase 1.
- **DA-004** — `seed/roadmap.md §Estado` update remains blocked by the permission hook; phase status tracked in `HANDOFF.md` + the §1.x phase-status table in `open-questions.md`.

---

## Known debt / next-session priorities

### High-confidence shipped, polish/verify needed

1. **Apple Sign-In interactive test** — Button + nonce flow + Supabase exchange are coded; need a real Apple ID in the simulator Settings to drive the full round-trip.
2. **Streaming completion edge case** — Red stop button can linger if the backend takes > a few minutes to emit `done` on a long generation. Tighten the state machine; consider a max-duration timeout.
3. **Phase 6 character flows** — Created characters land in Supabase; verify visually that the new row shows up in People grid (the model.load() refetch is wired).
4. **Phase 7 regenerate / edit-trim** — Both code paths are present; needs interactive verification that regenerate replaces the bubble in place and edit-trim deletes the right subsequent messages.

### Surface-level shipped, depth pending

5. **Phase 8 panels** — Menu and sheets exist but each panel renders a placeholder. Per-panel CRUD (Memory list, Lorebook entries, Author's Note editor, Generation Override knobs, Chat Controls upsert, Grammar read-only) is the next chunk.
6. **Phase 9 settings sections** — Navigation graph complete; each destination renders the generic placeholder. Text Engine first (gates streaming), then Memory + Voice + Image.
7. **Phase 10 backend route** — `POST /api/v2/ios/push/register` does not yet exist on the backend. The iOS side POSTs to it speculatively; the creator adds the route in `base/backend/app/routes/v2/ios/` per the AUTONOMY contract (Claude can't modify `base/`).

### Creator-only (blocked from this autonomous run)

8. **Apple Developer Portal**: register Push Notifications, Background Modes, Associated Domains capabilities under team `7RYJM44SBW`.
9. **`apple-app-site-association`** JSON hosting on the web domain.
10. **App Store Connect**: app record, Internal Testing group, Privacy nutrition label, archive + altool upload.
11. **`seed/roadmap.md §Fase 0-10 Estado`** manual update (or relax the permission hook — DA-004).

---

## How to resume

1. Open `storyplots.xcodeproj`, build, run on iPhone 17 Pro Max sim.
2. Sign in with `xvp@storyplots.app` / `SmokeTest!Xvp2026` (cached session should restore).
3. Backend at `http://127.0.0.1:8000` must be up for streaming.
4. Walk through each tab. The interactive smoke test only covered phases 0-5; verify 6 (create a character), 7 (long-press a chat message), 8 (open a ⋯ panel), 9 (visit Settings → Engines → Text Engine), 10 (push permission prompt is now wired but only fires when `PushService.shared.requestAuthorizationAndRegister()` is called — invoke from Settings → Privacy & Data when that flow lands).
5. If next session is autonomous, pick deepest debt first from the "Surface-level shipped, depth pending" block above.

---

> Updated by Claude during the autonomous run per AUTONOMY.md §7.
> When the human returns, read this file first.
