# SeedKit-v2

> A portable meta-layer for starting greenfield AI-assisted projects.
> Provides the seed standard (what a project seed looks like) and approach bindings
> (how a specific AI workflow tool consumes that seed).
>
> **This is not a project seed.** It is the kit you use to build one.

---

## What this kit contains

```
SeedKit-v2/
├── README.md                  ← this file
├── SEED-GUIDE.md              ← the authoritative standard for greenfield seeds
├── generation-guides/         ← session prompts for generating each seed file
│   ├── 01-schema.md           ← guide for seed/schema.md
│   ├── 02-ux.md               ← guide for seed/ux.md
│   ├── 03-tech-stack.md       ← guide for seed/tech-stack.md
│   ├── 04-product.md          ← guide for seed/product.md (conditional)
│   ├── 05-domain.md           ← guide for seed/domain.md (conditional)
│   ├── 06-architecture.md     ← guide for seed/architecture.md (conditional)
│   ├── 07-design.md           ← guide for seed/design.md (conditional)
│   ├── 08-roadmap.md          ← guide for seed/roadmap.md (always last)
│   └── 09-dev-runbook.md      ← guide for dev-runbook.md (kickoff artifact)
└── approaches/
    ├── claude-code/           ← vanilla Claude Code + plugin discipline
    ├── spec-driven/           ← Claude Code + spec-kit SDD methodology
    └── ecc/                   ← Claude Code + everything-claude-code ecosystem
```

**Three distinct layers — always in this order:**

1. **The seed** (`seed/` in your project) — portable, approach-agnostic, defined by `SEED-GUIDE.md`. Build this first using the `generation-guides/`.
2. **The approach binding** (one of `approaches/*/`) — picked after the seed is ready. Generates `CLAUDE.md`, `dev-runbook.md`, and session artifacts for your chosen methodology.
3. **Implementation** — the framework executes the roadmap phase by phase from the seed.

---

## Step 1 — Build the seed

Read `SEED-GUIDE.md` before you write a single line. Then use `generation-guides/` as session prompts — one guide per file, one dedicated Claude Code session per guide. It defines:

- Which files exist in `seed/` and what each contains
- Who authors each (creator vs AI-generated)
- What layer each belongs to (Layer 1 creator brings / Layer 2 AI generates / Layer 3 roadmap last)
- What **must** be in each file and what **must not**
- The portability contract (6 conditions the seed must satisfy)
- Authoring rules (22, inherited + new for v2)

**Authoring flow:**

| State | Who does what | Output | How |
|---|---|---|---|
| 0 | Creator writes/brings | `creator-vision.md`, `user-stories.md`, `references/[AppName]/`, optionally `design-system/` | No guide needed — creator authors these directly |
| 1 | AI generates per-file, creator reviews | `schema.md`, `ux.md`, `tech-stack.md`, and conditionals (`product.md`, `domain.md`, `architecture.md`, `design.md`) | Use the matching guide in `generation-guides/` — one dedicated session per file |
| 2 | Creator + AI in one dedicated session, last | `roadmap.md` (with executable exit criteria per phase) | Use `generation-guides/08-roadmap.md` |
| 3 | Framework kickoff generates | `dev-runbook.md`, `CLAUDE.md`, session artifacts | Use `generation-guides/09-dev-runbook.md` + chosen approach kickoff |
| → | Seed complete | Portable, approach-agnostic, ready for any framework | |

**Gating rule:** do not open a generation session until all its prerequisites exist and are approved. A generated but unreviewed file counts as not approved.

**Seed is complete when these exist and are approved:**
- [ ] `seed/creator-vision.md` · `seed/user-stories.md` · `seed/schema.md` · `seed/roadmap.md`
- [ ] `seed/ux.md` *(UI projects)* · `seed/tech-stack.md`
- [ ] Conditionals as warranted: `product.md` · `domain.md` · `architecture.md` · `design.md`
- [ ] `roadmap.md` has executable exit criteria (commands, not narratives) for every phase

The seed does **not** contain: run commands, slash commands, plugin references, plans, tasks, or anything framework-specific. Those live in the approach binding.

---

## Step 2 — Pick an approach

**All three approaches use Claude Code.** What differs is the workflow methodology layered on top of it. Claude Code + the right seed is already very powerful before any methodology is applied — the approach multiplies that by adding structure, automation, and session continuity conventions.

| Approach | Philosophy | Per-phase artifacts | Session continuity | Best for |
|---|---|---|---|---|
| **claude-code** | Seed as high authority; one plan per roadmap phase; plugin discipline as gates | `plans/NNNN-phase-slug.md` | `SESSION_HANDOFF.md` | Products you know well; full control per phase; proven with complex seeds |
| **spec-driven** | Spec as living artifact; spec→plan→tasks chain per feature branch | `specs/YYYY-MM-DD-feature/{requirements, plan, validation}.md` | Status in active `validation.md` | Collaborative/team projects; spec stays authoritative throughout; prefer objective validation gates |
| **ecc** | Maximize CC automation; hooks, agents, skills, rules as first-class | `.claude/{commands,skills,rules,agents,hooks}/` | ECC memory system | Maximum autonomy; want hooks running between tool calls; heavy agent delegation |

**When in doubt:** claude-code is the default. It has the most proven track record with complex seeds, gives you the most direct control, and its verification ritual (code-review + code-simplifier + playwright per phase) catches drift early.

---

## What each approach binding provides

Each `approaches/[name]/` folder contains exactly these files:

| File | Purpose |
|---|---|
| `README.md` | When to use this approach, tradeoffs, setup steps |
| `kickoff.md` | The prompt to use in the first session. Reads the seed and generates all framework binding files. |
| `CLAUDE.md` | Template CLAUDE.md for this approach. Generated by kickoff; kept here as the authoritative template. |

Approach-specific extras:

| Approach | Extra files |
|---|---|
| claude-code | `SESSION_HANDOFF.md` — living project state template |
| spec-driven | `SPEC-STATUS.md` — minimal session pointer; full state in `specs/[active]/tasks.md` |
| ecc | — (uses ECC's own memory system) |

---

## What the kickoff generates in your project

When you run the kickoff prompt (first session), it reads `seed/` and generates:

| File | Always / Conditional | Notes |
|---|---|---|
| `CLAUDE.md` | Always (Claude Code) | Framework harness: seed precedence, workflow mechanics, plugin rules, verification ritual |
| `dev-runbook.md` | Always | Start/stop/restart commands for every service. Agent reads this to manage the dev environment autonomously. **Generated from `seed/tech-stack.md`** — not authored by the creator. |
| `README.md` | If not present | Human onboarding: what the repo is, link to seed, how to start dev |
| `CHANGELOG.md` | Always | Empty reverse-chron log; ready for auto-population |
| Session continuity artifact | Per approach | `SESSION_HANDOFF.md` (claude-code), `SPEC-STATUS.md` + `tasks.md` (spec-driven), ECC memory (ecc) |

> **Why `dev-runbook.md` lives outside the seed:** it depends on knowing the full tech stack AND the specific approach's tooling. The seed defines the stack; the kickoff translates that into exact CLI commands for this project. Claude Code specifically: services run in background with `run_in_background=true`; logs read via `BashOutput`; stuck ports cleared via `KillShell`. Without the runbook, the creator starts and restarts servers manually every session.

---

## Universal tools (orthogonal to approach)

These tools work with any approach. Wire them regardless of which methodology you pick:

| Tool | When to use |
|---|---|
| `context7` | Any external library API decision (don't guess shapes — fetch the docs) |
| `playwright` | Any navigable UI surface — required gate, not optional polish |
| `serena` | Symbol-level code navigation in large codebases (preferred over reading whole files) |
| web search | Live information not in context7 |

---

## Versioning

This is v2. v1 was built implicitly during the StoryPlots project (2026-04) — it worked but lacked:
roadmap as a seed artifact, tech-stack.md as a separate file, executable exit criteria, dev-runbook.md
in kickoff, and slim session handoff vs giant monolithic document.

v2 addresses all seven gaps identified in `SEED-V2-POSTMORTEM.md` (sibling to this folder, same repo).
The SEED-GUIDE.md internal version is v2 (matching this kit version).

When a v3 is needed, create a `SeedKit-v3/` folder alongside this one. v2 stays as reference.
