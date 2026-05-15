# Approach: spec-driven

> Claude Code + spec-kit methodology (github/spec-kit).
> Each roadmap phase becomes one or more feature specs with three dedicated artifacts:
> spec (requirements) → plan (technical design) → tasks (executable implementation list).
> Each feature lives on its own branch, making specs reviewable as PRs.

---

## When to use this approach

- You are working with a team and want specs reviewable before any code is written
- You want the spec to remain a living artifact throughout — not just a planning doc
- You prefer more granular per-feature isolation (vs. one combined plan per phase)
- You want a stronger validation gate: tasks.md is generated LAST, from plan + data-model + contracts

## When NOT to use

- You are building solo and want a single mental model with less ceremony → use **claude-code**
- You want maximum Claude Code automation via hooks and agents → use **ecc**

---

## How it works

### The core idea

In spec-kit, specifications don't serve code — code serves specifications. The spec is the primary
artifact; implementation is its expression. This means:

- You never write code until the spec AND the plan are approved
- Tasks (the implementation list) are generated from the plan, not written by hand
- A spec lives in the repo as a permanent record — it can generate a re-implementation

### Artifacts per feature

Each roadmap phase spawns one or more feature specs, each with its own folder and branch:

```
specs/
└── [###-feature-name]/          ← one folder per feature
    ├── spec.md                  ← PHASE 0: requirements — user stories + acceptance scenarios
    ├── plan.md                  ← PHASE 1: technical plan — architecture, deps, file structure
    ├── data-model.md            ← PHASE 1: entities, schema, relationships (if applicable)
    ├── contracts/               ← PHASE 1: API contracts (endpoints, payloads)
    ├── research.md              ← PHASE 1: library/API research (context7 output)
    └── tasks.md                 ← PHASE 2: executable task list, generated LAST from above
```

### The three-phase per-feature flow

```
Phase 0 — Specify
  Read seed/roadmap.md for the feature scope
  Create specs/[###-feature]/spec.md
  → user stories (with priority P1/P2/P3) + acceptance scenarios
  → non-negotiables from seed/creator-vision.md that apply
  → explicit out-of-scope
  Get creator approval → proceed to Phase 1

Phase 1 — Plan
  Create specs/[###-feature]/plan.md
  → technical approach, dependencies, file structure
  → data-model.md (if schema changes)
  → contracts/ (API shapes)
  → research.md (context7 queries for lib APIs)
  Constitution check: verify seed non-negotiables are respected
  Get creator approval → proceed to Phase 2

Phase 2 — Tasks
  Generate specs/[###-feature]/tasks.md from plan.md + data-model + contracts
  Tasks are organized by user story — each story implementable independently
  [P] marker = can run in parallel (no file dependency with other open tasks)
  Implement task by task, verify each before the next
  Run acceptance scenarios from spec.md → all must pass
  Merge PR → feature done
```

### How the seed integrates with spec-kit

The seed replaces the spec-kit constitution — but is richer:

| Seed file | Spec-kit role |
|---|---|
| `seed/creator-vision.md` non-negotiables | Constitution core principles |
| `seed/user-stories.md` | Primary source for spec.md user stories |
| `seed/schema.md` | Primary source for data-model.md |
| `seed/ux.md` | Primary source for contracts/ shapes and acceptance scenarios |
| `seed/roadmap.md` | Determines the sequence of feature specs to create |
| `seed/tech-stack.md` | Populates plan.md Technical Context section |

The kickoff generates a `constitution.md` at the repo root — a condensed extract of the
seed's non-negotiables that spec-kit's plan phase checks against. The full seed remains
the authority; the constitution is the lightweight gate artifact that spec-kit can check
quickly without loading the full seed.

### Session continuity

No SESSION_HANDOFF.md. The active feature branch + `specs/[###-feature]/tasks.md` IS the state.
At session start: check which branch you are on → open its tasks.md → find the first unchecked task.

A minimal `SPEC-STATUS.md` at the root records: which feature is active, which task is next,
and any blockers. Updated at session end.

---

## Files in this folder

| File | Purpose |
|---|---|
| `README.md` | This file |
| `kickoff.md` | First-session prompt — generates framework files + first feature spec |
| `CLAUDE.md` | CLAUDE.md template for spec-driven workflow |
| `SPEC-STATUS.md` | Minimal session pointer — active branch + next task |

---

## Tradeoffs vs. claude-code approach

| Spec-driven | Claude-code |
|---|---|
| 3 artifacts per feature (spec + plan + tasks) — more structured | 1 artifact per phase (combined plan) — less ceremony |
| Each spec is reviewable on a PR | Plans are in-repo but not PR-gated |
| Tasks generated from plan (not hand-written) — less drift | Subtasks hand-written in the plan |
| Better for team workflow and spec longevity | Faster for solo builders |
| Session state is in tasks.md + git branch | Session state in SESSION_HANDOFF.md |

---

## Setup

1. Complete the seed (States 0–2 from SEED-GUIDE.md)
2. Install spec-kit plugin (optional — the workflow works without it, just manually)
3. Paste `kickoff.md` into the first Claude Code session
4. Claude generates CLAUDE.md, dev-runbook.md, constitution.md, specs/ directory, SPEC-STATUS.md
5. Claude creates first feature spec from seed/roadmap.md Phase 0 → review and approve
6. Implementation begins
