# storyplots-ios

Native iOS migration of [StoryPlots](https://storyplots.app) — a SwiftUI app on iOS 26 with Liquid Glass, consuming the existing FastAPI + Supabase backend that already powers the productive web version.

## Status

Pre-implementation. Seed complete; ECC harness pruned for Swift/iOS; ready for Phase 0 (Bootstrap Xcode).

## Source of truth

- **`seed/`** — what to build. 8 docs: `reference-map`, `creator-vision`, `api-contract`, `tech-stack`, `ux`, `design`, `roadmap`, `open-questions`. See `seed/reference-map.md` for the precedence model.
- **`CLAUDE.md`** — how Claude Code works in this repo (harness, PRP loop, MCP usage).
- **`dev-runbook.md`** — how to start/stop services, MCP setup, restart procedures.
- **`base/`** — the productive web app, included as a reference snapshot. Read-only.
- **`.claude/`** — ECC harness at project scope (25 agents, 42 commands, 84 skills, custom Swift+iOS rules).

## Stack

- **iOS 26** minimum, Xcode 26.3+, Swift 6 strict concurrency
- **SwiftUI** + Liquid Glass + Foundation Models
- **SwiftData** for local cache
- **Networking**: URLSession + SSE for backend (Zone A) · `supabase-swift` for direct PostgREST (Zone B)
- **Auth**: Supabase email/password + Sign in with Apple
- **Testing**: Swift Testing + XCTest + the 3 iOS MCPs (Apple Xcode MCP, XcodeBuildMCP, ios-simulator-mcp)

## Getting started (next session, fresh)

1. Open a Claude Code session in this directory. `CLAUDE.md` loads automatically; rules in `.claude/rules/` activate per their `paths:` frontmatter; Serena attaches via `SessionStart` hook.
2. Verify MCPs: `claude mcp list` — expect at least `xcode: xcrun mcpbridge` connected (Xcode must be running).
3. Plan Phase 0:
   ```
   /prp-plan "Phase 0 — Bootstrap Xcode" "From seed/roadmap.md §Fase 0"
   ```
   Review the generated plan at `.claude/PRPs/plans/0000-phase-0-bootstrap.plan.md`.
4. Execute when approved:
   ```
   /prp-implement .claude/PRPs/plans/0000-phase-0-bootstrap.plan.md
   ```
5. Then `/code-review` · `/quality-gate` · `/prp-commit` · `/prp-pr` per phase.

The roadmap covers Phases 0–10 to TestFlight beta. Cross-cutting Liquid Glass acceptance gates are documented in `seed/roadmap.md` §Liquid Glass acceptance gates.

## License

(To be set by the creator.)
