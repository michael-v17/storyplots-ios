# Approach: claude-code

> Vanilla Claude Code + plugins. The seed is the high-authority spec.
> Phases from the roadmap drive implementation. SESSION_HANDOFF.md is the living
> project state between sessions — detailed enough to resume without re-reading everything.

---

## When to use this approach

- You built (or approved) the seed yourself and know the product well
- You want direct control and full visibility per phase and subtask
- You prefer explicit plugin discipline (code-review, code-simplifier, playwright as gates)
- Solo or small team — no spec branching / PR review flow needed

## When NOT to use

- You need a team-reviewed spec as a living artifact → use **spec-driven**
- You want heavy automation via hooks and agent delegation → use **ecc**

---

## How it works

### The four artifacts and what each owns

```
seed/roadmap.md               ← phases + exit criteria — master sequencing (read-only during impl.)
plans/NNNN-phase-slug.md      ← one plan per roadmap phase; atomic subtasks + per-subtask verification
SESSION_HANDOFF.md            ← living project state; what shipped, what's in progress, what's next
CHANGELOG.md                  ← immutable log of what shipped, populated from commits
```

**`seed/roadmap.md`** is the only place that decides sequencing and done-criteria.
**`plans/`** executes a phase — one file per phase (or per large feature within a phase).
**`SESSION_HANDOFF.md`** is the project's running memory across sessions.
**`CHANGELOG.md`** is the permanent record — SESSION_HANDOFF links to it, never duplicates it.

### What SESSION_HANDOFF.md tracks (and what it does NOT)

It IS:
- The table of shipped phases/features (brief, not narrative)
- Current phase: which subtask, what's left, any blockers
- Active stack config (ports, providers, test data, BYOK keys status)
- Implementation decisions made during impl that aren't captured in the seed
- What's coming next (next 1–2 phases)

It is NOT:
- A narrative prose log of every cycle (that's CHANGELOG.md / git log)
- An architecture overview (that's in seed/)
- A copy of workflow rules (that's in CLAUDE.md)
- A re-statement of the roadmap (that's in seed/roadmap.md)

The v1 problem in StoryPlots wasn't that SESSION_HANDOFF was long — it was that it mixed
all these things together in dense paragraphs, making it take 20 minutes to read at session start.
Structure the content correctly and length takes care of itself.

### The v1 → v2 fixes (lessons from StoryPlots, 78 cycles)

| v1 problem | v2 fix |
|---|---|
| No roadmap in seed → sequencing invented per micro-cycle, re-invented every session | `seed/roadmap.md` owns sequencing; phases drive plans |
| Plans per micro-cycle (78 files) → thread lost, plans became noise | One plan per roadmap phase; subtasks within that plan |
| SESSION_HANDOFF mixed logs + architecture + conventions + rules in prose | Separate concerns: CHANGELOG (log), seed/ (spec), CLAUDE.md (rules), SESSION_HANDOFF (current state) |
| No dev-runbook → creator restarted servers manually every session | Kickoff generates dev-runbook.md; Claude manages services autonomously |

### Typical session flow

1. Run `./preflight.sh` (or `preflight.ps1`) → tools on PATH, env parity, key shape, reachability all green
2. Read `SESSION_HANDOFF.md` → know which phase and subtask to pick up from (human-readable state)
3. Let Serena hydrate `.serena/memories/` at session start → agent-readable context for code
4. Start dev services from `dev-runbook.md` → verify all healthy
5. Open current `plans/NNNN-phase-slug.md` → see what subtasks remain
6. Do the work → each subtask = plan + implement + test, run its `Verify:` before moving on
7. When phase is done: run all exit criteria from `seed/roadmap.md` → must all pass
8. Run Verification ritual (code-review, code-simplifier, playwright, memory hygiene)
9. Mark phase ✅ in roadmap, append to CHANGELOG.md, update SESSION_HANDOFF.md,
   update Serena memories, single commit with all the above

### When to use `/ultraplan`

`/ultraplan` is a planning skill — heavy, thorough, useful for two specific moments:

1. **During seed authoring (optional):** generate `seed/roadmap.md` if you haven't written it yet
2. **At the start of a new roadmap phase:** generate `plans/NNNN-phase-slug.md`

It is not the name of this methodology. It is one tool among many.
Do not invoke it for subtasks within a phase — those are bullets in the plan file.

---

## Files in this folder

| File | Purpose |
|---|---|
| `README.md` | This file |
| `kickoff.md` | First-session prompt — generates framework files + preflight scripts + activates Serena + drafts Phase 0 plan |
| `CLAUDE.md` | CLAUDE.md template — framework harness for Claude Code |
| `SESSION_HANDOFF.md` | Living-state template — what the human reads between sessions |
| `serena-playbook.md` | How to use Serena correctly — install paths, decision matrix, memories workflow, per-language notes |
| `preflight-pattern.md` | Preflight script pattern — tools / env parity / key shape / reachability / fingerprints, plus cloud-auth drift workflow |

---

## Two complementary tracking layers

Running state is tracked in two layers that do not duplicate each other:

- **`SESSION_HANDOFF.md`** (human-readable) — living project state, what shipped, current
  phase + subtask, active stack config, coming next. This is what the person reads at
  session start.
- **`.serena/memories/`** (agent-readable) — six canonical memories auto-generated by
  Serena onboarding (`project_overview`, `tech_stack`, `suggested_commands`,
  `style_and_conventions`, `task_completion_checklist`, `structure_and_layout`) plus
  `decision_<slug>_YYYY_MM_DD` memories for non-trivial mid-phase trade-offs. These are
  what the agent loads automatically via the `SessionStart → activate` Serena hook.

The memory-hygiene step in `CLAUDE.md §Verification ritual` keeps both layers in sync at
phase close — it's a blocker before the phase commit.

---

## Per-task cycle inside a phase

Each subtask inside a phase follows a consistent plan → implement → test micro-cycle:

1. **Plan** — what to build + which test proves it (this is a bullet in the phase plan, not a new file).
2. **Implement** — Serena-first for any edit to an existing symbol (`replace_symbol_body`,
   `insert_after_symbol`, `rename_symbol`) instead of line-based `Edit`.
3. **Test** — written joint with the code, not afterwards. The plan's `Verify:` command
   runs this test in isolation.

Only when every subtask's `Verify:` is green does the phase run the full Verification
ritual and close.

---

## Setup

1. Complete the seed (States 0–2 from SEED-GUIDE.md) — `seed/roadmap.md` must exist before kickoff
2. Complete the one-time prerequisites at the top of `kickoff.md` (Serena plugin + CLI,
   other MCPs). These install once per developer machine.
3. Paste the `kickoff.md` prompt into the first Claude Code session
4. Claude activates Serena, generates CLAUDE.md, dev-runbook.md, preflight.ps1 + preflight.sh,
   .env.example, README.md, CHANGELOG.md, SESSION_HANDOFF.md, and plans/
5. Claude drafts `plans/0001-phase-0-[slug].md` (with the Serena-first preamble) and stops for approval
6. Approve → implementation of Phase 0 begins
