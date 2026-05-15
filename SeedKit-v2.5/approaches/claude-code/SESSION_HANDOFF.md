# Session Handoff — [PROJECT NAME]

> Read this at the start of every session — it is the project's running memory.
> Update it at the end of every session. Never let it go stale.
>
> **Content discipline:** this file tracks project state, not history.
> History (what shipped per cycle) → CHANGELOG.md and git log.
> Architecture and domain rules → seed/ files.
> Workflow rules → CLAUDE.md.
> What goes HERE: current phase + subtask, what shipped (table), active stack config,
> implementation decisions made during work that aren't in the seed, and what's next.

---

## Current position

**Phase:** Phase [N] — [Phase name from roadmap.md]
**Status:** [⏳ pending start / 🔄 in progress / ✅ shipped]
**Plan file:** `plans/[NNNN-phase-slug].md`
**Last commit:** `[SHA7]` — [short commit message]

**In-progress subtask:** [N] — [Subtask name]
**What remains in this subtask:**
- [bullet of what's left, or "complete — move to subtask N+1"]

**Blockers:** [None — or describe what's blocking and what you need to unblock]

**Next step:**
[Exact action to take to resume. Specific enough that a new session can start without
reading the full plan. Examples:
- "Run gate: `pnpm typecheck && vitest run && playwright test`; if green, commit and close Phase 3"
- "Draft Phase 4 plan from seed/roadmap.md Phase 4 scope — wait for creator approval before coding"
- "Fix subtask 2 verification failure: `vitest run --reporter=verbose` → [specific test name] failing"]

---

## Phases shipped

[Keep this as a table — brief, scannable. One row per phase. Full narrative → CHANGELOG.md]

| Phase | Name | Shipped | Key deliverables |
|---|---|---|---|
| 0 | [Name] | [date] | [1–2 bullets] |
| 1 | [Name] | [date] | [1–2 bullets] |
| ... | | | |

---

## Active stack and config

[Ports, providers, active API keys status, test data — things Claude needs to run the project.
Update whenever these change. This is what lets a new session start services correctly.]

**Services:**

| Service | Port | Start command |
|---|---|---|
| [Backend] | [port] | [command] |
| [Frontend] | [port] | [command] |

**Active providers (BYOK):**
- [Text engine: provider + model]
- [Image engine: provider + endpoint if LAN]
- [Other: ...]

**Test data:**
- [Character name used for testing: e.g. "Aria — has 10 messages, active API key"]
- [Any other test fixtures worth calling out]

---

## Implementation decisions (not in seed)

[Decisions made during implementation that aren't captured in seed/ — e.g. a library choice
the seed didn't pin, a UI pattern derived from the design system, a workaround for a discovered
constraint. One line each. If a decision becomes foundational, escalate it to seed/open-questions.md.]

- [Decision: brief description + why]

---

## Coming next

**Next phase:** Phase [N+1] — [Name]
**Rough scope:** [2–3 bullets from seed/roadmap.md]
**Any prep needed before starting:** [e.g. "creator must resolve open-question #3 in seed/open-questions.md"]

---

## Open decisions pending creator input

[Decisions that require creator approval before implementation can continue.
Each with: what the decision is, why it's blocking, proposed default if any.]

- [None — or describe]
