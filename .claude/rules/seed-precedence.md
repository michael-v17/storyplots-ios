# Seed-Precedence — StoryPlots iOS

> Top-level rule. Loaded at every session start (no `paths:` frontmatter).
> The seed at `seed/` is the only authoritative source for **what** to build.
> ECC's harness (`.claude/`) configures **how** Claude works — never overrides what.

## Precedence within `seed/`

When two seed files disagree, the higher number wins:

1. `seed/creator-vision.md` — absolute authority on intention.
2. `seed/tech-stack.md` — stack decisions.
3. `seed/ux.md` — UI patterns, navigation, gestures.
4. `seed/design.md` — visual tokens, Liquid Glass, materials.
5. `seed/api-contract.md` — 18 backend endpoints (verified) + Zone A/B pattern.
6. `seed/reference-map.md` — where to look for what.
7. `seed/roadmap.md` — phase definitions + exit criteria.
8. `seed/open-questions.md` — append-only; resolved → §99.

## `base/` is reference, not authority

`base/` is the working web app + backend. Source for:
- Backend route shapes (lookup via `Read base/backend/app/routes/...`).
- Visual tokens (`base/frontend/src/styles/tokens.css`).
- Behavior inspection (levantar web + Playwright si hace falta).

`base/` no se modifica desde la migración iOS. Endpoints nuevos van bajo `/api/v2/ios/`.

## ECC harness vs seed

If an ECC agent / skill / rule contradicts the seed, **the seed wins**. Examples:
- A skill says "use Combine" → seed §tech-stack §4 says Swift Concurrency → use Swift Concurrency.
- An agent suggests adding a UI library → seed §creator-vision §6.9 says no UI libraries → reject.
- A rule recommends light mode default → seed §design.md §10 says dark-only MVP → dark-only.

## Non-invention

If a decision is missing from `seed/`:
1. Flag in `seed/open-questions.md` with a default + when it blocks.
2. **Do not invent** silently in code.
3. Cite the open-question entry in the plan that needs it.

## Non-omission

These cannot be dropped (from `creator-vision.md` §6):
- No web views.
- No hardcoded tokens (everything via `Theme`).
- SwiftUI primary; UIKit only when SwiftUI can't.
- Swift Concurrency (not Combine).
- Backend intact (v2/ios for additions).
- Native feel over literal web paridad.
- Accessibility (Dynamic Type, VoiceOver).
- Tests as gate per feature.
- No third-party UI libraries.
- No opaque trackers.

If any of these is violated by a proposed change, escalate before merging.

## How to use this rule

- Read at session start (it's auto-loaded by Claude Code).
- Cite specific seed sections in plan documents (`plans/NNNN-*.md`).
- When in doubt, open the seed file referenced and read the cited section verbatim.
