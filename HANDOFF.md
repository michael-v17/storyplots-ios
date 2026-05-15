# Handoff — autonomous run [2026-05-15 04:06 start]

**Status**: in-progress
**Phase**: 0 — Bootstrap Xcode → ✅ closed; advancing to Phase 1
**Subtask**: —
**Last commit**: 3599058 docs(handoff): note external web running locally for autonomous run (pre-Phase-0; updated at next commit)
**Wall-clock used**: ~0h 20m

## Available external resources (sin cambios)

El creator dejó la web vieja corriendo en otra sesión por si la sesión autónoma necesita inspeccionar el comportamiento real:

- **Frontend web**: `http://localhost:5173/` (Vite dev server, sirviendo `base/frontend/`).
- **Backend FastAPI**: `http://localhost:8000/` — endpoints documentados en `seed/api-contract.md` §3.
- **Auth state**: una sesión autenticada está activa en el browser que Playwright abrirá.

Acceso: **Playwright MCP** (`mcp__plugin_playwright_playwright__*`). NO usar curl/wget desde Bash hacia esos ports — bloqueado por `check-port.mjs`.

Phase 0 no usó estas resources. Phase 1 probablemente tampoco (Auth shell es self-contained). Phase 2+ las puede necesitar.

## Done since start

- **Phase 0 — Bootstrap Xcode** (✅ Completed 2026-05-15 04:23):
  - `project.pbxproj`: `IPHONEOS_DEPLOYMENT_TARGET 26.5 → 26.0`, `SWIFT_VERSION 5.0 → 6.0`, `TARGETED_DEVICE_FAMILY "1,2" → "1"`, removed `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor` (caused test-target isolation errors — see open-questions DA-002).
  - Folder layout: `storyplots/App/`, `Core/{DesignSystem, Networking, Persistence, Supabase}/`, `Features/{Auth, Home, People, Chat, Settings}/`, `Resources/`.
  - `Theme` namespace complete: Color (38 tokens + 16 accent presets), Spacing, Radius, FontStyle, Motion, Shadow, **Material** (`navBar`, `chip`, `viewerOverlay`, `sheetCard`). `ThemePreview` shows materials over the brand gradient.
  - Networking skeleton: `APIClient` protocol + `URLSessionAPIClient` actor, `SSEClient` (`URLSession.eventStream` extension + `SSEEvent` struct), `AuthStore` actor + `@Observable AuthState`, typed-error enums (`APIError`, `SSEError`, `AuthError`).
  - `SupabaseProviding` protocol + `StubSupabaseManager` value type. The `supabase-swift` SPM dependency is **deferred to Phase 1** (DA-003) — autonomous tooling cannot reliably add SPM remote packages without Xcode UI.
  - `RootView` → `ScaffoldView` (placeholder); `storyplotsApp` enforces `.preferredColorScheme(.dark)`. `ContentView.swift` deleted.
  - 17 unit tests across `ThemeTests`, `NetworkingTests`, `SupabaseManagerTests`, `AuthStoreTests` — all pass on `iPhone 17 Pro Max,OS=26.5`.
  - Debug + Release builds: green.
  - `seed/open-questions.md` appended with DA-001 (bundle ID), DA-002 (actor isolation), DA-003 (SPM defer), DA-004 (roadmap Estado update blocked by permission hook).

## In progress

(Phase 0 closed; about to commit + push + start Phase 1.)

## Open-questions appended

- **DA-001** — Bundle ID `com.tecnologiasvm.storyplots` retained (the project carried it from creator setup; seed Q3.8 placeholder was `com.storyplots.ios`).
- **DA-002** — `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor` removed; `SWIFT_APPROACHABLE_CONCURRENCY = YES` kept. View models / views remain explicitly `@MainActor` per `seed/tech-stack.md` §4.
- **DA-003** — `supabase-swift` SPM dependency deferred to Phase 1 (first task).
- **DA-004** — `seed/roadmap.md` Estado update blocked by permission hook. Phase status is tracked in `HANDOFF.md` + `seed/open-questions.md` §1.x + `.claude/PRPs/reports/` instead. **Creator action needed**: either update roadmap Estado manually post-review, widen the hook to permit Estado-line edits, or update `AUTONOMY.md` §8 to acknowledge HANDOFF.md as the live source of phase status.

## To review when human returns

1. **AUTONOMY contract vs hook policy** — §8 says append to `seed/roadmap.md` Estado on phase close; the active permission policy blocks all edits inside `seed/` except `open-questions.md`. Pick one rule, reconcile both.
2. **Bundle ID confirmation** (DA-001) — keep `com.tecnologiasvm.storyplots` or rebrand before Phase 10.
3. **Verify the Theme.swift token mapping** matches `seed/design.md` §3 exactly. All 38 surface/border/fg/brand/semantic tokens are present + all 16 accent presets.
4. **Open `ThemePreview` in Xcode preview** to visually confirm the material strip (it satisfies the Phase 0 Liquid Glass gate at source level; PNG snapshots were not captured in this run).
5. **Phase 1 SPM dependency**: add `supabase-swift` via Xcode UI before resuming, OR allow Phase 1 plan to attempt a pbxproj hand-edit.

## Next phase suggested

Phase 1 — Auth shell. Plan to be written at `.claude/PRPs/plans/0002-phase-1-auth-shell.plan.md`. Stop-condition reminder: `AUTONOMY.md` §2.4 ends the autonomous run after Phase 2 closes regardless of remaining wall-clock.

---

> Updated by Claude during the autonomous run per `AUTONOMY.md` §7.
> When the human returns, read this file first.
