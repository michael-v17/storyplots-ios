# Approach: ecc

> Claude Code + the **Everything Claude Code** harness
> ([github.com/affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code)
> · homepage: [ecc.tools](https://ecc.tools)).
> ECC is a Claude Code plugin by Affaan Mustafa that ships 38 agents, 156 skills, 72 commands,
> 10+ hooks, and rules across many languages and domains.
> The kickoff in this folder is two-phase: first **audit** the harness against your seed
> (and design any custom rules/skills the seed implies), then **bootstrap** — prune, wire the
> PRP loop, wire Serena, emit `roadmap.md`, and draft the Phase-0 plan.

**Credit:** the underlying ECC harness is upstream. This `SeedKit-v2/approaches/ecc/` folder is
the seed-aware kickoff layer on top — audit → bootstrap → PRP loop — written to consume a
populated `seed/` folder and produce a project-tuned harness without hand-pruning.

---

## What is ECC (in one paragraph)

ECC is an audit-then-bootstrap kickoff that turns a populated `seed/` folder into:

- a project-tuned `.claude/` harness (with only the agents/skills/rules relevant to this project's stack)
- any **custom rules / skills / agents / hooks** the seed implies but the stock harness doesn't ship
- a project-root `roadmap.md` that tracks every phase's status and points at plans/reports
- a Phase-0 implementation plan drafted by `/prp-plan` — ready to review and execute

Everything after kickoff runs through the PRP loop: `/prp-plan → /prp-implement → /code-review →
/quality-gate → /prp-commit → /prp-pr`, with `roadmap.md` ticked at each close.

---

## Inputs / Outputs

| In                                                      | Out                                                                                                          |
|---------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| `seed/creator-vision.md`, `seed/user-stories.md`, `seed/tech-stack.md`, `seed/roadmap.md` (required) | pruned `.claude/` harness                                                                                    |
| `seed/product.md`, `seed/domain.md`, `seed/schema.md`, `seed/ux.md`, `seed/design.md`, `seed/architecture.md` (if present) | `CLAUDE.md` + `dev-runbook.md` + `README.md` + `CHANGELOG.md`                                                |
| `seed/open-questions.md`                                | `roadmap.md` at project root (phase tracker)                                                                 |
| `seed/references/[AppName]/` (if present)               | `.claude/PRPs/plans/0000-phase-0-bootstrap.plan.md` drafted by `/prp-plan`                                   |
|                                                         | Custom `.claude/rules/`, `.claude/skills/`, `.claude/agents/`, `.claude/hooks/hooks.json` entries (if the seed implies them) |
|                                                         | Serena MCP registered + indexed + onboarded (if not already)                                                 |
|                                                         | ECC session memory entry summarising the kickoff                                                             |

---

## When to use this approach

- You want maximum autonomy — hooks run automatically between tool calls, agents delegate subtasks.
- You want the PRP framework (`/prp-plan`, `/prp-implement`, `/prp-prd`, `/prp-commit`, `/prp-pr`)
  wired in from day one.
- You want Serena (semantic code navigation) actually used, not just installed.
- You plan to customise the harness over time with project-specific rules and skills.

## When NOT to use

- You want full visibility into every decision per phase → use **claude-code**.
- You want spec-as-living-artifact with branch-per-feature → use **spec-driven**.
- ECC is not installed or you don't want to manage the harness → use **claude-code**.

---

## Workflow at a glance

```
seed/  ──►  /kickoff-audit (plan mode, read-only)
                 │
                 │  (1) Project Fingerprint from seed
                 │  (2) classify existing .claude/ files (KEEP / TWEAK / REMOVE / DEFER)
                 │  (3) propose custom rules/skills the seed implies
                 │  (4) draft roadmap.md rows
                 │  (5) check PRP + Serena wiring
                 ▼
        .claude/PRPs/plans/ecc-audit-<project>.md       (creator reviews + approves)
                 │
                 ▼
        /kickoff-bootstrap
                 │
                 │  1. execute approved audit (delete / tweak / settings / rules)
                 │  2. verify PRP commands; install any missing
                 │  3. wire Serena (MCP register, index, hooks, onboarding) if missing
                 │  4. inject Serena-first preamble into /prp-plan, /prp-implement, /plan
                 │  5. emit roadmap.md at project root
                 │  6. emit custom rules/skills/agents/hooks from the audit
                 │  7. generate framework files (CLAUDE.md, dev-runbook.md, README, CHANGELOG)
                 │  8. draft Phase-0 plan via /prp-plan
                 ▼
        implementation loop (per phase, forever):

        roadmap.md (Next pointer)
          → /prp-plan  → .claude/PRPs/plans/NNNN-phase-N-<slug>.plan.md
          → (review)
          → /prp-implement  → .claude/PRPs/reports/NNNN-phase-N-<slug>-report.md
          → /code-review + /quality-gate
          → /prp-commit
          → /prp-pr
          → roadmap.md row flipped to `done`, Next pointer advances
```

---

## Files in this folder

| File | Purpose |
|---|---|
| `README.md` | This file |
| `kickoff-audit.md` | Phase 1 prompt — run in plan mode; produces audit plan, no changes |
| `kickoff-bootstrap.md` | Phase 2 prompt — run after audit is approved; executes prune + wires PRP/Serena + emits roadmap + drafts Phase-0 plan |
| `CLAUDE.md` | `CLAUDE.md` template for ECC projects (seed precedence, PRP loop, Serena rules, verification ritual) |
| `roadmap-template.md` | Project-root `roadmap.md` shape emitted by the bootstrap |
| `playwright-capture-pattern.md` | Background-spider + saved-state pattern for reverse-engineering external web apps |
| `serena-playbook.md` | How to actually use Serena: decision matrix, memories workflow, onboarding ritual, hooks |
| `custom-rules-skills-cookbook.md` | Catalogue of seed-signal → rule/skill/agent/hook proposals the audit picks from |
| `preflight-pattern.md` | Preflight script pattern — what to check (tools / env parity / key shape / reachability / fingerprints), PowerShell + bash templates, cloud-auth drift workflow |

---

## Setup (overview)

1. Install ECC as a Claude Code plugin (see [ecc.tools](https://ecc.tools) or the
   [upstream repo](https://github.com/affaan-m/everything-claude-code) for the current install
   syntax — today: `/plugin install everything-claude-code@everything-claude-code`).
   Pick the **full** profile so the audit has the complete harness to prune from.
2. Make sure this `SeedKit-v2/` folder is in the project root — copy it from wherever you
   keep the SeedKit (personal repo, dotfiles, shared team folder). The two kickoff prompts
   plus their 5 companion files must be siblings under `SeedKit-v2/approaches/ecc/`.
3. Complete the seed (States 0–2 from SEED-GUIDE.md) — `seed/roadmap.md` must exist.
4. Open a Claude Code session in plan mode (`/plan`).
5. Paste `kickoff-audit.md` content → Claude produces `.claude/PRPs/plans/ecc-audit-[project].md`.
6. Review and approve the audit plan. This is the moment to confirm the proposed custom
   rules/skills and the drafted roadmap rows — edit the file inline if you want overrides
   (the bootstrap re-reads the plan when it runs).
7. Paste `kickoff-bootstrap.md` content → Claude executes the audit, wires PRP + Serena, emits
   `roadmap.md`, emits the custom artifacts, generates the framework files, and drafts
   `.claude/PRPs/plans/0000-phase-0-bootstrap.plan.md` via `/prp-plan`.
8. Review the Phase-0 plan and run `/prp-implement` to begin the build.

From there: every phase follows the PRP loop documented in `CLAUDE.md`. The bootstrap's
`CLAUDE.md` **replaces** the seed-authoring `CLAUDE.md` at the project root — expected and correct.

---

## Quickstart runbook — exact commands (note to future self)

Walk-through of the actual session that bootstrapped a project with this framework.
Re-use verbatim on the next project; only the project name changes.

### 0 · Prerequisites check

```bash
# In the project folder:
ls seed/creator-vision.md seed/user-stories.md seed/tech-stack.md   # all must exist
ls -d .claude/                                                       # ECC harness installed
ls -d SeedKit-v2/approaches/ecc/                                     # this kickoff layer present
git rev-parse --is-inside-work-tree 2>/dev/null || git init          # bootstrap commits per step
git status                                                           # clean or known WIP only

# Tools pinned by seed/tech-stack.md §1 — verify each is on PATH (example for Node-based):
node --version                                                       # matches the seed's Node pin
corepack --version                                                   # Corepack ships with Node 22 — enables pnpm
pnpm --version || corepack enable && corepack prepare pnpm@<seed-version> --activate
# Repeat for every tool pinned by the seed (python/uv, go, cargo, cloud CLIs via `pnpm dlx` or equivalent).
```

- If any of the three **seed** files is missing, go back to SEED-GUIDE.md and finish
  Layer 1–2 before touching this folder.
- If `.claude/` is missing, install ECC (Setup step 1 above).
- If `SeedKit-v2/approaches/ecc/` is missing, copy/clone it into the project root from wherever
  you keep SeedKit — the two kickoff prompts need their 6 companion files (`CLAUDE.md`,
  `roadmap-template.md`, `serena-playbook.md`, `playwright-capture-pattern.md`,
  `custom-rules-skills-cookbook.md`, `preflight-pattern.md`) in the same folder.
- If the project is not yet a git repo, run `git init` first — the bootstrap creates ~9
  single-purpose commits that all assume a working tree.
- **Cloud CLIs**: prefer `pnpm dlx <cli>` / `uvx <cli>` / `npx <cli>` over global installs.
  The bootstrap-emitted `preflight.*` checks availability via the same runner, so a missing
  global CLI isn't a blocker as long as the per-runner invocation works.

### 1 · Install the required MCP plugins (first-time)

Run these slash-commands in the Claude Code session, one at a time. The
`@claude-plugins-official` suffix picks the Anthropic-maintained marketplace;
without it the command may fail if multiple marketplaces are registered.

```
/plugin install context7@claude-plugins-official
/plugin install playwright@claude-plugins-official
/plugin install serena@claude-plugins-official
/reload-plugins
```

*Alternative:* run `/plugin` interactively (no args) and pick each one from the marketplace
UI — that's what I did the first time; the slash-install form above is faster on repeat.

Verify they are all connected:

```bash
claude mcp list
# expect three "✓ Connected" lines for plugin:context7:context7,
#                                  plugin:playwright:playwright,
#                                  plugin:serena:serena
```

**Why it matters:** `kickoff-audit.md` Phase 0 preflight requires context7;
Serena wiring in the bootstrap requires the Serena plugin; `playwright` is
loaded now so the `reference-capture` skill proposals have the tool when they fire.

### 1b · Install the Serena CLI (required for the Serena hooks in settings.json)

The Anthropic marketplace plugin provides the Serena MCP server only — not the
`serena-hooks` binary that the hooks in `settings.json` depend on. Without this
step the hooks fail silently; Serena tools still work but you lose automatic
project activation, anti-drift reminders, and auto-approve for destructive edits.

**See `serena-playbook.md` §One-time-setup for the three install paths** (plugin-only /
hybrid / pure-CLI) and the trade-off table. For teams of 2+ the **hybrid path** below is
recommended:

```bash
# Install uv if missing (Python tool manager)
which uv || curl -LsSf https://astral.sh/uv/install.sh | sh

# Install serena-agent — provides both `serena` and `serena-hooks` executables
uv tool install serena-agent

# Verify
which serena-hooks
serena-hooks --help | head -5
# expect: Usage: serena-hooks ... Commands: activate / auto-approve / cleanup / remind
```

Per-machine cost: ~30 seconds the first time, 0 on subsequent projects.

### 2 · Open a planning session in the project folder

```
/model           # pick Opus 4.x for the audit — it's planning-heavy
/plan            # optional — audit is naturally planning-mode
```

### 3 · Run the audit (paste `kickoff-audit.md`)

Two ways to trigger it:

- **Full paste:** open `SeedKit-v2/approaches/ecc/kickoff-audit.md`, copy the prompt block
  inside the triple backticks, paste it into Claude.
- **Short prompt:** just say "run the ECC audit per `SeedKit-v2/approaches/ecc/kickoff-audit.md`" —
  Claude reads the file and follows it.

Claude runs Phases 0–4 read-only and writes:

```
.claude/PRPs/plans/ecc-audit-<kebab-project-name>.md
```

Expect a summary line: `KEEP: N | TWEAK: M | REMOVE: P | DEFER: Q | Custom proposals: R`.
Claude stops automatically after writing the plan.

### 4 · Review the audit plan

Open `.claude/PRPs/plans/ecc-audit-<project>.md` and:

- Skim the **Project Fingerprint** — confirms Claude read the seed correctly.
- Skim the **KEEP/TWEAK/REMOVE/DEFER** tables — override anything you disagree with inline.
- Skim the **Custom proposals** — 16 is typical for a multi-tenant SaaS; fewer is fine.
- Skim the **Roadmap draft** — confirms phase numbering matches `seed/roadmap.md`.
- Tick the 6 approval checkboxes at the bottom (or note overrides in the same space).

### 5 · Pre-bootstrap snapshot commit

**Strongly recommended.** The bootstrap deletes ~215 files; a snapshot gives you
a clean rollback point.

```bash
git add -A
git commit -m "chore(ecc): pre-bootstrap snapshot with approved audit plan"
```

### 6 · Run the bootstrap (paste `kickoff-bootstrap.md`)

```
run the ECC bootstrap per `SeedKit-v2/approaches/ecc/kickoff-bootstrap.md`
```

Claude executes 8 steps, each with its own commit. Expect roughly this commit chain:

```
chore: prune ECC harness for <project>
chore: align ECC settings to seed for <project>
chore: prune ECC rules to project stack
chore(serena): activate semantic code navigation
chore(prp): teach prp-* and plan to prefer Serena
docs: add project roadmap (phase tracker)
feat(harness): add seed-implied custom rules and skills
docs: bootstrap project framework files (CLAUDE.md, runbook, README, CHANGELOG)
docs(phase-0): draft bootstrap plan via /prp-plan
```

At the end Claude stops and asks: **"Bootstrap complete. Phase 0 plan at
`.claude/PRPs/plans/0000-phase-0-bootstrap.plan.md` — ready to review?"**

### 6b · Run preflight

The bootstrap emitted `preflight.ps1` + `preflight.sh` at the project root. Run the one
for your shell — it verifies the pinned tools are on PATH, `.env.local` is in parity with
`.env.example`, opaque keys have valid shapes, and the project's external services are
reachable:

```bash
# macOS / Linux / WSL / Git-Bash
./preflight.sh
```

```powershell
# Windows PowerShell
.\preflight.ps1
```

Expected output: all tools present, `.env parity → missing: none`, shape checks `True` /
known format, `HTTP 200` on the reachability line. If reachability reports
`SKIPPED — fix .env.local first`, copy `.env.example` to `.env.local` and paste the real
credentials from the cloud provider's dashboard, then re-run.

If a reachability check returns a 4xx despite valid-looking credentials, the project's seed
likely documents a health-check curl that's older than the provider's current auth shape
(e.g. Supabase new-key projects need `apikey` + `Authorization: Bearer` — the legacy
single-header form returns 401). Follow `preflight-pattern.md §Cloud-provider auth drift`:
fix `dev-runbook.md` now, append an `OQ-PREFLIGHT-*` entry to `seed/open-questions.md`,
update the `suggested_commands` Serena memory, and leave `seed/` untouched until the
creator approves the seed edit.

### 7 · Verify the Gate + close Phase 0 in `roadmap.md`

Open `.claude/PRPs/plans/0000-phase-0-bootstrap.plan.md` and run the block of
shell commands under `## Gate`. All must exit 0.

Then flip `roadmap.md` manually (`/prp-implement` handles this automatically
on subsequent phases, but Phase 0 was the bootstrap itself, so a human closes it):

- Row `| 0 | ECC Bootstrap | in-progress |` → change status to `done`
- Footer line `**Next:** Phase 0 (ECC Bootstrap)` → change to `**Next:** Phase 1 (<name from seed/roadmap.md row 1>)`
- Commit: `chore(roadmap): close Phase 0, advance to Phase 1`

Every subsequent phase close is automatic — `/prp-implement`'s final step
flips its own row to `done` and advances the `Next` pointer. Phase 0 is the
only one that needs a manual flip.

### 8 · Bootstrap replicates this checklist into the project

The bootstrap's emitted `README.md` at the project root contains a
**"Getting started — first run"** section that mirrors steps 7 above plus
the PRP loop kick-off, so a second person cloning the repo can follow the
same checklist without re-reading this SeedKit doc. The checklist points
at the project's own `CLAUDE.md §PRP workflow loop` for the repeating cycle.

### 9 · First implementation phase — PRP loop kick-off

After the manual Phase 0 flip, start the first real implementation cycle:

```
/prp-plan "Phase 1 — <name from seed/roadmap.md row 1>" \
    "brief from seed/roadmap.md §<corresponding section>"
```

This writes `.claude/PRPs/plans/0001-phase-1-<slug>.plan.md`. Review. Then:

```
/prp-implement .claude/PRPs/plans/0001-phase-1-<slug>.plan.md
/code-review && /quality-gate
/prp-commit "feat(phase-1): <scope>"
/prp-pr
```

If a custom hook emitted by the bootstrap blocks you unexpectedly, read the
stderr message (it names the rule that fires and how to fix) and adjust.
**Never use `--no-verify`** — the hooks encode creator-vision non-negotiables.

### 10 · From here, every phase follows the PRP loop in `CLAUDE.md`

`roadmap.md (Next) → /prp-plan → (review) → /prp-implement → /code-review +
/quality-gate → /prp-commit → /prp-pr → roadmap row flips to done (automatic)`.

See the project's own `CLAUDE.md §PRP workflow loop` for the full diagram
with guardrails, Serena-first rules, and verification ritual.

---

## What you'll end up with (typical headline numbers)

For a single-service TypeScript/Next.js/Supabase project (Traveliru Operator v0 shape):

| Surface | Before bootstrap | After bootstrap |
|---|---|---|
| `.claude/agents/` | ~48 | ~31 (stock) + ~1 (custom) |
| `.claude/commands/` | ~80 | ~63 |
| `.claude/skills/` | ~149 | ~61 (stock) + 3 (custom) |
| `.claude/rules/` subdirs | 16 | 7 (3 stock + 4 custom) |
| `.claude/hooks/hooks.json` entries | ~25 | +5 custom hooks |
| Root framework files | none | `CLAUDE.md` · `dev-runbook.md` · `README.md` · `CHANGELOG.md` · `roadmap.md` |
| `.serena/memories/` | — | 6 onboarding memories + 1 session memory |
| Commits produced | — | 9 single-purpose commits on a pre-bootstrap snapshot |

Numbers vary per project — see the Traveliru Operator v0 bootstrap commit chain
for a concrete worked example.

---

## Troubleshooting

- **Phase 0 preflight fails on context7 / Serena / Playwright** — you skipped step 1 above. Install the plugins and `/reload-plugins` before re-trying. The audit stops immediately if any of them is missing (the prompt says "STOP — do not fall back to training-data assumptions").
- **`serena` CLI not found on the system** — expected. We don't need the CLI; the Serena MCP wraps everything (`mcp__plugin_serena_serena__activate_project` creates `.serena/project.yml` without a shell call).
- **A hook blocks your first commit after bootstrap** — the `conventional-commits` hook is active now. Use the shape `<type>(<scope>)?: <description>`. If a legitimate commit is blocked, fix the message; never `--no-verify`.
- **Skills you expected to find are missing from the project `.claude/skills/`** — they're likely still installed at user scope via plugins (check `~/.claude/plugins/`). The project prune only touches the project-scoped copy, which is the correct behaviour.

---

## Why this layout

- **Seed stays authoritative** — ECC configures *how* Claude works; `seed/` defines *what* to build.
- **`roadmap.md` at the project root** — a living projection of `seed/roadmap.md` plus status.
  The PRP commands tick it; the human inserts/reorders phases; bulk rewrites are forbidden.
- **PRP as the default cycle** — durable plan files + validation loops + reports are more reliable
  than free-form `/plan` for non-trivial phases.
- **Serena made the default** — the audit/bootstrap doesn't just register the MCP; it injects a
  "Serena-first" preamble into `/prp-plan`, `/prp-implement`, and `/plan` so the habit propagates.
- **Custom rules/skills from the seed** — the audit proposes new artifacts the seed implies
  (PHI, PCI, currency, i18n, multi-tenancy, reference-capture, …) rather than only classifying what
  already ships.
- **Playwright in the background** — spiders launch via `Bash(run_in_background=true)` so the
  conversation keeps moving while captures run.
