# Handoff — autonomous run [2026-05-15 04:06 start → 08:33 last commit]

**Status**: phases 0–5 closed and pushed; remaining MVP roadmap is 6–10.
**Last commit**: `8b00cb3` feat(phase-5): SSE streaming — /chat end-to-end, 7 event types, cancel
**Wall-clock used**: ~4h 27m (with two pauses where the creator checked in mid-run).

---

## What landed

| Phase | Commit | Smoke test |
|---|---|---|
| **0 — Bootstrap Xcode** | `1ff3e21` | 17 unit tests pass; Theme/Spacing/Radius/Material; networking skeleton |
| (stop-handoff doc revert) | `b21f3f2` | (superseded — see "What this doc replaces" below) |
| **1 — Auth shell** | `3b74136` | Sign in with `xvp@storyplots.app` → MainTabView; Sign out → SignInView |
| **2 — Home tab** | `159e780` | 8+ conversations render with per-character accent + YOUR PERSONA pill "Roberth" |
| **3 — People tab** | `1e0d603` | 2-col grid with character accent borders; search works; CharacterDetailView shows scenario + system prompt |
| **4 — Chat skeleton** | `1d40bbe` | Tap conversation → ChatView with history, markdown bubbles, accent dot in nav, tab bar hidden |
| **5 — SSE streaming** | `8b00cb3` | Send → user bubble persisted to Supabase → assistant bubble streams in token-by-token over ~3-5s; red stop button replaces send arrow during stream |

All commits pushed to `origin/main`. Each phase passed `xcodebuild build` + `xcodebuild test` (17 unit tests in `storyplotsTests`) on iPhone 17 Pro Max, iOS 26.5 sim.

## What this doc replaces

Earlier in this run I wrote a "stopped after Phase 0" handoff (`b21f3f2`) because Phase 1's Apple Sign-In path needed creator-only inputs. The creator's `/goal` reset overrode that decision and the run continued. The SPM dependency for `supabase-swift` ended up being hand-edited into the pbxproj successfully (the resolved deps are listed in `Package.resolved` — see DA-003 in `seed/open-questions.md` for the historical context); Apple Sign-In was wired in code but not interactively tested.

---

## Surfaces shipped end-to-end (verified on sim)

- **Auth**
  - `SignInView` — Liquid Glass card over amber gradient, email/password + Apple Sign-In button with secure-nonce flow.
  - `SignUpView` + `ResetPasswordView` — minimal Form sheets.
  - `AuthStore` (`@MainActor @Observable`) wraps `SupabaseClient`: signInEmail / signUp / resetPassword / signInWithApple / signOut / restoreSession.
- **Home**
  - `HomeView` — large-title nav with `.toolbarBackground(.regularMaterial)`, pull-to-refresh, `YourPersonaPill`, `ConversationCardView` rows with per-character accent + AsyncImage avatar + initials fallback.
  - `HomeViewModel` fetches conversations + characters + persona in parallel via `async let`. Optimistic delete with rollback.
- **People**
  - `PeopleView` — 2-column `LazyVGrid` of `CharacterCardView` (aspect-1 avatar, 2pt accent border), `.searchable` filter, pull-to-refresh.
  - `CharacterDetailView` — read-only landing per Q5.3 default. Hero header (96pt avatar) + scenario + system prompt + identity rows. Edit button wired but unbound (Phase 6).
- **Chat**
  - `ChatView` — hidden tab bar, accent dot in nav principal, scroll-pinned `LazyVStack` of `MessageBubbleView`, transient grammar notice + error banner above composer.
  - `MessageBubbleView` — 28pt left avatar for character bubbles (bg2 + accent border), right-aligned bg3 bubble for user, `AttributedString(markdown:)` rendering with plain-text fallback.
  - `ComposerView` — multi-line TextField (1...5 lines), gradient send button, red stop button while streaming.
  - `ChatViewModel.send()` — inserts user row via Supabase, POSTs `/chat` with Supabase JWT, consumes SSE stream, builds assistant placeholder, mutates it as tokens arrive, handles all 7 event types.
  - `SSEFrameParser` — pure Swift event/data line parser; `URLSession.eventStream(for:)` extension wraps `URLSession.bytes(for:)` in an `AsyncThrowingStream<ChatStreamEvent, Error>`.
- **Settings (placeholder)** — Form section with email + destructive Sign out button.

---

## Stack summary (vs `seed/tech-stack.md`)

- iOS deployment target 26.0; toolchain Xcode 26.5; Swift 6 with `SWIFT_APPROACHABLE_CONCURRENCY = YES`; iPhone-only.
- Bundle ID `com.tecnologiasvm.storyplots` (creator-typed at project creation; DA-001).
- `supabase-swift` 2.46.0 resolved transitively with swift-crypto / swift-asn1 / swift-http-types / swift-clocks / swift-concurrency-extras / xctest-dynamic-overlay.
- Sign in with Apple capability wired via `storyplots.entitlements` + `CODE_SIGN_ENTITLEMENTS`.
- Supabase URL + anon key live in `SupabaseConfig.swift` (anon key is public per Supabase design); migrate to xcconfig when multi-environment builds appear.

---

## Open-questions log (`seed/open-questions.md` §1.x)

- **DA-001** — Bundle ID `com.tecnologiasvm.storyplots` retained.
- **DA-002** — `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor` removed; explicit `@MainActor` on view models / views instead. `SWIFT_APPROACHABLE_CONCURRENCY = YES` retained.
- **DA-003** — `supabase-swift` SPM dep ultimately added via pbxproj hand-edit during Phase 1 (worked first try, `xcodebuild -resolvePackageDependencies` confirmed Supabase 2.46.0 + transitive deps). DA-003 stays as a historical note.
- **DA-004** — `seed/roadmap.md §Estado` update remains blocked by the permission hook. Phase status is tracked in this HANDOFF and the §1.x "Phase status" table inside `seed/open-questions.md` instead.

---

## Known issues / debt

- **Apple Sign-In not interactively tested.** The button is wired and the nonce flow + Supabase exchange are implemented, but I didn't drive the full ASAuthorization → consent → Supabase round-trip in the simulator (it would require a real Apple ID signed into the sim's Settings). Email/password is verified end-to-end with `xvp@storyplots.app`.
- **Streaming stop button can linger after a slow `done`.** If the backend takes longer than expected, the red stop button stays visible briefly past completion. State machine returns to idle on `done`; UI catches up on next view refresh. Tighten in Phase 7 alongside the regenerate / variant work.
- **No SwiftData cache layer yet.** Home does a fresh Supabase round-trip on every `.task`. Add when offline mode becomes a real concern (post-Phase-5 polish).
- **`avatar_ref` URLs assume the `avatars` bucket is public-readable.** If RLS or bucket policy changes, swap to signed URLs (Phase 3 has the helper hook spot already).
- **Storyboard / Info.plist `INFOPLIST_KEY_SupabaseURL` etc. were added then made dead** — the keys are still in `project.pbxproj` (harmless, not read at runtime). Remove on the next pbxproj sweep.
- **OSLog stream visible at `subsystem == "com.storyplots.ios"` / category `chat-stream`.** Useful for debugging streaming under `xcrun simctl spawn booted log show`.

---

## What's NOT shipped (roadmap §Fase 6–10)

- **Phase 6 — Character CRUD**: create wizard, edit form, accent picker, delete, initials fallback for avatar.
- **Phase 7 — Composer features**: long-press context menu, variant pagination, fork dialog, edit-as-trim, regenerate.
- **Phase 8 — Panels + Image + Audio + Character LLM**: Memory / Lorebook / Author's Note / Generation Override panels, image generation per message, TTS, character generate / refine / avatar generate.
- **Phase 9 — Settings + Engines**: real Settings root, engine config screens (text / image / memory / voice), Profile, Privacy & Data.
- **Phase 10 — Pre-TestFlight**: push registration (`/api/v2/ios/push/register` backend route to be created), Universal Links, App Store Connect setup, archive + upload.

---

## How to resume

1. Open `storyplots.xcodeproj`, build, run on iPhone 17 Pro Max sim.
2. Sign in with `xvp@storyplots.app` / `SmokeTest!Xvp2026` (or use the cached Supabase session).
3. Tap any conversation on Home, send a message — the backend at `http://127.0.0.1:8000` must be up.
4. Continue at Phase 6 with `/prp-plan "Phase 6 — Character CRUD" "Brief from seed/roadmap.md §Fase 6"`.

---

## To review when human returns (priority order)

1. **Visual sweep on device** — open Xcode previews for `ThemePreview`, `SignInView`, `HomeView`, `ChatView`, `CharacterDetailView`. Confirm tokens match `seed/design.md`.
2. **Apple Sign-In live test** — sign a test Apple ID into the simulator Settings, then tap "Sign in with Apple" on the SignInView. The nonce + identity-token exchange to Supabase is wired but unverified interactively.
3. **Update `seed/roadmap.md §Fase 0-5 Estado`** manually (or relax the permission hook — DA-004). Suggested marker for each phase: `✅ Completed 2026-05-15 by autonomous run, commit <SHA>`.
4. **Confirm `seed/open-questions.md` DA-001 / DA-002 / DA-003 / DA-004** stand as decisions, or override.
5. **Inspect `storyplots/Core/Supabase/SupabaseConfig.swift`** — if a different staging project gets used, swap the URL + anon key.
6. **Spot-check the Maya Okonkwo streaming flow** — type "Tell me about penguins" and verify multi-paragraph response renders with markdown formatting intact.

---

> Updated by Claude during the autonomous run per AUTONOMY.md §7.
> When the human returns, read this file first.
