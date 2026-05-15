# Handoff — autonomous run [2026-05-15 04:06 start]

**Status**: stopped — Phase 1 requires creator-only inputs (see §Stop reason)
**Phase**: 0 — Bootstrap Xcode → ✅ closed
**Subtask**: —
**Last commit**: `1ff3e21` feat(phase-0): bootstrap Xcode scaffolding (pushed to origin/main)
**Wall-clock used**: ~0h 25m of 4h budget

---

## Stop reason

Per AUTONOMY.md §2.1 ("Critical blocker: una decisión que … requiere input humano específico no documentado"), Phase 1 cannot reach its roadmap exit criteria from the autonomous run alone. The exit criteria require:

> Launch → SignInView visible
> Tap "Sign in with Apple" → Apple consent → MainTabView visible
> Force-quit → relaunch → MainTabView directo (session persisted)
> Tap Settings tab → tap "Sign out" → SignInView visible

This needs four inputs the autonomous run cannot provide:

1. **`supabase-swift` SPM remote package** added to the Xcode project. Phase 0 DA-003 already documents this. Hand-editing `project.pbxproj` to add an `XCRemoteSwiftPackageReference` + `XCSwiftPackageProductDependency` + `PBXBuildFile` is technically possible, but `Package.resolved` resolution + verification needs Xcode UI for safety, and a corrupted pbxproj is high blast-radius. Creator action recommended: open project in Xcode → File → Add Package Dependencies → `https://github.com/supabase-community/supabase-swift` → up-to-next-major `2.0.0`.
2. **Supabase project URL + anon key** for the staging environment. Phase 0 created `storyplots/Resources/Debug.xcconfig` + `Release.xcconfig` as empty placeholders. The seed does not include these credentials (correctly — they're environment values that live outside the repo). Creator action: populate the two xcconfig files with `SUPABASE_URL` + `SUPABASE_ANON_KEY` and wire them via `baseConfigurationReference` in the storyplots target's Debug/Release configs.
3. **Sign in with Apple capability** registered for `com.tecnologiasvm.storyplots` in the Apple Developer Portal under team `7RYJM44SBW`. This is a portal/account action; not visible to the autonomous run. Without it, the simulator's Sign in with Apple flow will fail at runtime.
4. **`.entitlements` file** added to the target with `com.apple.developer.applesignin = (Default,)`. Could be created by Claude, but it's brittle without (3) — best added once (3) is confirmed.

The right move per AUTONOMY.md is to stop here, push Phase 0, and let the next session pick up Phase 1 with the prerequisites in place. Wall-clock spent (~25m) is well under the 4h budget — the stop is not budget-driven, it's input-driven.

---

## Available external resources (mientras la sesión autónoma corre)

El creator dejó la web vieja corriendo en otra sesión por si la sesión autónoma necesita inspeccionar el comportamiento real:

- **Frontend web**: `http://localhost:5173/` (Vite dev server, sirviendo `base/frontend/`).
- **Backend FastAPI**: `http://localhost:8000/` — endpoints documentados en `seed/api-contract.md` §3.
- **Auth state**: una sesión autenticada activa en el browser de Playwright.

Acceso: **Playwright MCP** (`mcp__plugin_playwright_playwright__*`). NO usar curl/wget desde Bash hacia esos ports (bloqueado por `check-port.mjs`). Phase 0 no las usó.

---

## Done since start

### Phase 0 — Bootstrap Xcode (✅ Completed 2026-05-15 04:23)

Single commit: `1ff3e21`. Deliverables:

- **Build settings** (`storyplots.xcodeproj/project.pbxproj`):
  - `IPHONEOS_DEPLOYMENT_TARGET = 26.0` (was 26.5 — wider compatibility within iOS 26).
  - `SWIFT_VERSION = 6.0` (was 5.0).
  - `TARGETED_DEVICE_FAMILY = "1"` (iPhone-only, was "1,2").
  - Removed `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor` (broke test-target isolation; recorded as DA-002). `SWIFT_APPROACHABLE_CONCURRENCY = YES` is retained.
- **Folder layout** under `storyplots/`: `App/`, `Core/{DesignSystem,Networking,Persistence,Supabase}/`, `Features/{Auth,Home,People,Chat,Settings}/`, `Resources/`.
- **`Theme` namespace** (`Core/DesignSystem/Theme.swift`):
  - 38 surface/border/foreground/brand/semantic Color tokens with `--sp-*` token doc comments.
  - 16 accent presets (`Theme.Color.AccentPreset.all`).
  - `Theme.Spacing`, `Theme.Radius`, `Theme.FontStyle`, `Theme.Motion`, `Theme.Shadow` (with `Theme.Shadow.preset(_:)` accessor).
  - **`Theme.Material`** — `navBar = .regularMaterial`, `chip = .thinMaterial`, `viewerOverlay = .ultraThickMaterial`, `sheetCard = .thinMaterial` (satisfies the Phase 0 Liquid Glass acceptance gate at source level).
  - `Color+Hex.swift`, `ThemeModifiers.swift` (`.sectionLabel()`, `.elevation(_:)`), `ThemePreview.swift` (`#Preview` shows palette + materials over brand gradient).
- **Networking skeleton** (`Core/Networking/`):
  - `APIClient` protocol + `URLSessionAPIClient` (actor).
  - `Endpoint<R: Decodable & Sendable>` + `HTTPMethod`.
  - `SSEEvent` + `URLSession.eventStream(for:)` extension (Phase 0 stub finishes immediately).
  - `AuthStore` (actor) + `AuthState` (`@MainActor @Observable`).
  - `APIError`, `SSEError`, `AuthError` typed enums.
- **Supabase abstraction** (`Core/Supabase/SupabaseManager.swift`):
  - `SupabaseProviding: Sendable` protocol with `isConfigured` member.
  - `StubSupabaseManager` value type — Phase 0 stub. Phase 1 swaps in the SDK-backed implementation (DA-003).
- **App entry**:
  - `storyplotsApp.swift` rewritten to enforce `.preferredColorScheme(.dark)` per non-negotiable §6.7 + Q2.2.
  - `storyplots/App/RootView.swift` (placeholder routing).
  - `storyplots/App/ScaffoldView.swift` (Phase 0 visible scaffold — wordmark + "phase 0 — bootstrap" caption).
  - Boilerplate `ContentView.swift` deleted.
- **xcconfig placeholders** (`Resources/Debug.xcconfig`, `Release.xcconfig`) — header comments only, not wired to the build configuration. Phase 1 populates real values.
- **17 unit tests** (Swift Testing, `storyplotsTests/`):
  - `ThemeTests`: 8 tests covering Color hex parity, Spacing scale, Radius, accent-preset count, Motion durations, Shadow presets.
  - `NetworkingTests`: 5 tests covering Endpoint shape, HTTPMethod raw values, stub-throws-notImplemented, SSE stream finishes, `SSEEvent` equality.
  - `SupabaseManagerTests`: stub instantiates with `isConfigured == false`.
  - `AuthStoreTests`: 3 tests for `AuthState` flip + signInEmail stub.
- **Builds**: Debug + Release both green (iPhone 17 Pro Max, iOS 26.5 sim).
- **Plan**: `.claude/PRPs/plans/0001-phase-0-bootstrap-xcode.plan.md`.
- **Report**: `.claude/PRPs/reports/0001-phase-0-bootstrap-xcode.report.md` (gitignored locally; mirrors the commit message + this handoff).

---

## In progress

(Phase 0 closed cleanly; Phase 1 not started — see Stop reason.)

---

## Open-questions appended (`seed/open-questions.md` §1.x)

- **DA-001** — Bundle ID `com.tecnologiasvm.storyplots` retained. The project carried it from creator setup; the seed Q3.8 placeholder was `com.storyplots.ios`. Confirm or rebrand before Phase 10 (Pre-TestFlight).
- **DA-002** — `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor` removed because tests are nonisolated by default and could not access MainActor-isolated value types. `SWIFT_APPROACHABLE_CONCURRENCY = YES` retained; view models/views remain `@MainActor` explicitly per `seed/tech-stack.md` §4.
- **DA-003** — `supabase-swift` SPM dependency deferred to Phase 1. SDK addition is creator action (see Stop reason).
- **DA-004** — `seed/roadmap.md §Fase 0 Estado` update is blocked by the active permission policy that denies all writes to `seed/` except `open-questions.md`. AUTONOMY.md §8 expects the Estado line to be updated; the policy disagrees. Phase status is tracked here (HANDOFF.md), in the report, and in §1.x's "Phase status" table inside `seed/open-questions.md`.

---

## To review when human returns (priority order)

1. **Update `seed/roadmap.md §Fase 0 Estado`** manually (or relax the permission hook). Suggested line:
   ```
   - ✅ Completed 2026-05-15 by autonomous run. Plan: `.claude/PRPs/plans/0001-phase-0-bootstrap-xcode.plan.md`. Single-commit `1ff3e21`. supabase-swift SPM deferred to Phase 1 (DA-003).
   ```
2. **Reconcile AUTONOMY.md §8 ↔ permission policy** (DA-004): either widen the hook to permit Estado edits in `seed/roadmap.md`, or amend §8 to acknowledge `HANDOFF.md` as the live source of phase status during autonomous runs.
3. **Confirm bundle ID** (DA-001): keep `com.tecnologiasvm.storyplots` or rebrand. Decision affects nothing today; affects Phase 10.
4. **Spot-check `Theme.swift`** against `seed/design.md` §3 token table — all 38 surface/border/fg/brand/semantic tokens are present + 16 accent presets.
5. **Open `ThemePreview` in Xcode** (Cmd+Option+Return on `ThemePreview.swift`) to visually confirm the materials strip over brand gradient (the Phase 0 Liquid Glass gate). Optional: capture a PNG and drop it under `docs/snapshots/` for the record.
6. **Verify tests still pass** locally:
   ```
   xcodebuild test -project storyplots.xcodeproj -scheme storyplots \
     -destination "platform=iOS Simulator,name=iPhone 17 Pro Max,OS=26.5"
   ```
   Expect 17 tests passing.

---

## Phase 1 prerequisites (what to set up before resuming autonomous mode)

In the order they need to happen:

### P1.1 — Add `supabase-swift` SPM dep

In Xcode UI: File → Add Package Dependencies → URL `https://github.com/supabase-community/supabase-swift` → Up to Next Major `2.0.0` → Add `Supabase` product to the storyplots target.

Verify: `xcodebuild -resolvePackageDependencies -project storyplots.xcodeproj -scheme storyplots` produces a `Package.resolved` in the project, build still passes.

### P1.2 — Populate xcconfig + wire them

Edit `storyplots/Resources/Debug.xcconfig` and `Release.xcconfig`:
```
SUPABASE_URL = https:/$()/<project>.supabase.co
SUPABASE_ANON_KEY = <anon-key-from-supabase-dashboard>
```
(Note the `$()` escape after `https:` — xcconfig treats `//` as a comment.)

Wire each to its build configuration: in the storyplots.xcodeproj inspector → Project → Info → Configurations → expand Debug/Release → set the storyplots target's "Based on Configuration File" to the matching xcconfig.

Add `Info.plist` keys (auto-generated):
- `SUPABASE_URL` → `$(SUPABASE_URL)`
- `SUPABASE_ANON_KEY` → `$(SUPABASE_ANON_KEY)`

…or read them via `Bundle.main.infoDictionary` at runtime.

### P1.3 — Register Sign in with Apple capability + entitlement

In `developer.apple.com`: select team `7RYJM44SBW` → Certificates, Identifiers & Profiles → Identifiers → `com.tecnologiasvm.storyplots` → enable Sign in with Apple.

In Xcode: storyplots target → Signing & Capabilities → "+" → Sign in with Apple. Xcode creates `storyplots.entitlements` automatically.

### P1.4 — Configure simulator Apple ID

In the iPhone 17 Pro Max sim: Settings → Sign in to your iPhone → use a real or test Apple ID. Required for `ASAuthorizationAppleIDProvider` to return a credential.

### P1.5 — Resume autonomous mode

Once P1.1–P1.4 are done, re-run the autonomous prompt. The first thing Phase 1 plan will do is verify P1.1–P1.4 are in place, then build the real `SupabaseManager`, `AuthStore.signInEmail` + `signInWithApple`, and the auth UI.

---

## Next phase suggested

**Phase 1 — Auth shell.** Plan target path: `.claude/PRPs/plans/0002-phase-1-auth-shell.plan.md`. Will be written once P1.1–P1.4 prerequisites are confirmed. Phase 1 subtasks (per `seed/roadmap.md` §Fase 1):

1. Wire live `SupabaseManager` from xcconfig values + replace `StubSupabaseManager` references.
2. Implement live `AuthStore.signInEmail` / `signInWithApple` / `signOut` / `currentSession` (calls into supabase-swift).
3. `SignInView` (email, password, "Sign in", separator, Apple Sign-In button) + SignUpView + ResetPasswordView (minimal).
4. `RootView` switches between `AuthFlow` (full-screen cover) and `MainTabView` (3 tabs: Home, People, Settings — placeholders only).
5. Apple Sign-In E2E test via ios-simulator-mcp using the simulator's signed-in Apple ID.

Stop-condition reminder: AUTONOMY.md §2.4 ends the autonomous run after Phase 2 closes regardless of remaining wall-clock.

---

> Updated by Claude during the autonomous run per AUTONOMY.md §7.
> When the human returns, read this file first.
