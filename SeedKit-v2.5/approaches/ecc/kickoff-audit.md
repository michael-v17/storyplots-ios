# Kickoff Audit — ECC approach (Phase 1)

Run this prompt in **plan mode** (`/plan`) in a fresh Claude Code session inside your project folder.
Claude will produce an audit plan and STOP — it will NOT modify `.claude/` until you approve.

**Prerequisite:** ECC must already be installed (`.claude/` folder present with ECC contents),
and the seed must be at States 0–2 from SEED-GUIDE.md.

---

## Prompt

```
You are auditing the ECC harness inside `.claude/` for a new greenfield project whose spec lives
in `seed/`. Your job is to:

1. Decide — file by file — which existing ECC files inside `.claude/` should stay, be tweaked,
   be removed, or be deferred.
2. **Propose new project-specific rules / skills / agents / hooks** the seed implies.
3. Draft the project's `roadmap.md` (the phase-status tracker that lives at the project root).
4. Verify the PRP framework (`/prp-plan`, `/prp-implement`, `/prp-prd`, `/prp-commit`, `/prp-pr`)
   is intact, and queue any missing pieces.
5. Verify Serena (semantic code navigation) is wired, and queue any missing setup.

The audit scope is ONLY `.claude/` contents and the new files the bootstrap will emit at the
project root (`roadmap.md`, `CLAUDE.md`, etc.). Nothing else is touched.
The outcome is a plan file the creator reviews before any changes happen.
Do NOT modify `.claude/` until the plan is approved.

Read these companion files (siblings of this prompt) before you start, so your proposals match
the shapes the bootstrap will later emit — do not edit them, only read:
- `custom-rules-skills-cookbook.md` — seed-signal → artifact catalogue + canonical Claude-Code
                                      frontmatter shapes; drives every Phase 3.5 proposal
- `roadmap-template.md`             — `roadmap.md` shape you'll draft rows for in Phase 3.6
- `serena-playbook.md`              — recommended hooks + setup commands referenced in the
                                      Phase 3.8 wiring check
- `playwright-capture-pattern.md`   — only required if Phase 1 fingerprint flags
                                      "External-app reverse-engineering needed = yes"; informs the
                                      `reference-capture` skill proposal in Phase 3.5

You do NOT need to read this folder's `README.md` (creator-facing setup doc), `CLAUDE.md` (the
bootstrap fills it from a template — your audit decisions feed into it indirectly), or
`kickoff-bootstrap.md` (your output plan is what drives it).

## Phase 0 — Preflight

Before anything else:
1. Confirm `seed/creator-vision.md` and `seed/user-stories.md` exist. If either is missing, STOP.
2. Confirm `seed/tech-stack.md` exists. If missing, STOP — this is the primary source for the
   Project Fingerprint and the audit cannot proceed without it.
3. Confirm `.claude/` exists and is non-empty.
4. Confirm context7 is available: run `mcp__context7__resolve-library-id` on `claude-code`.
   Then `mcp__context7__query-docs` on `/anthropics/claude-code` for the current canonical layout
   (commands frontmatter, skills SKILL.md schema, hook event types). Record findings — they will
   feed Phase 3 classifications and Phase 3.5 proposals. If context7 fails or returns nothing
   useful, STOP — do not fall back to training-data assumptions about Claude Code conventions.

## Phase 1 — Build the Project Fingerprint

Read these seed files in precedence order:
1. `seed/creator-vision.md` — highest authority; non-negotiables and creator intent
2. `seed/user-stories.md` — user behaviors; what users must actually be able to do
3. `seed/product.md` (if present) — scope and explicit out-of-scope
4. `seed/domain.md` (if present) — domain complexity and business invariants
5. `seed/schema.md` — data model and storage
6. `seed/ux.md` (if present) — screens, flows, states
7. `seed/design.md` (if present) — visual direction
8. `seed/tech-stack.md` — PRIMARY SOURCE for fingerprint: language, framework, DB, testing stack,
   explicit prohibitions ("What we are NOT using"), layer responsibilities
9. `seed/roadmap.md` — phase sequence (informs how complex the build is and feeds the roadmap.md
   the bootstrap will emit at the project root)
10. `seed/architecture.md` (if present) — subsystems and integration boundaries
11. `seed/open-questions.md` — unresolved decisions (drives DEFER choices)
12. `seed/references/[AppName]/` (if present) — observed-app evidence; consult for domain/UI context
    when seed files above are thin. Interpretive only — never overrides seed.

Extract into a ~20-line internal Project Fingerprint:
- **Primary language(s):** (from tech-stack.md)
- **Frameworks / runtimes:** (from tech-stack.md)
- **Database / storage:** (from tech-stack.md + schema.md)
- **Has a UI?** yes/no — web/mobile/desktop (drives playwright, frontend-design relevance)
- **Testing stack:** unit runner + e2e tool (from tech-stack.md "Testing stack" section)
- **Explicit prohibitions:** things the seed says NOT to use (from tech-stack.md)
- **Domain sensitivities:** healthcare? fintech? PII? children? regulated? (drives custom rules)
- **ML / AI components:** LLM in product? prompts? evals? cost ceilings? (drives AI-specific rules)
- **External-app reverse-engineering needed?** does the project mirror or integrate against an
  external web app the team must catalogue? (drives the `reference-capture` skill + Playwright pattern)
- **Target platform:** server? browser? CLI? mobile?
- **Maturity signal:** prototype / MVP / production (from creator-vision.md tone)

This fingerprint is the lens for every KEEP/REMOVE decision AND for every Custom-Rules/Skills
proposal in Phase 3.5.

## Phase 2 — Inventory .claude/

Use `mcp__serena__list_dir` and `mcp__serena__get_symbols_overview` (or Glob if Serena is not yet
registered) to enumerate every file in `.claude/`. Do NOT read full file contents — use frontmatter
/ first heading only to determine purpose.

For each file record:
- Full path
- Type: agent / command / skill / hook / rule / setting
- One-line purpose (from frontmatter `description:` or first heading)
- Declared tools / model / language matchers (where visible in frontmatter)

Folders to inventory:
- `.claude/agents/`
- `.claude/commands/` — pay particular attention to `prp-plan`, `prp-implement`, `prp-prd`,
  `prp-commit`, `prp-pr`, `plan`, `tdd`, `e2e`, `code-review`, `quality-gate`, `verify`
- `.claude/skills/` (if present)
- `.claude/hooks/`
- `.claude/rules/common/` and `.claude/rules/[language]/` subdirs
- `.claude/mcp-configs/` (if present)
- `.claude/settings.json`

Do NOT inventory:
- `.claude/PRPs/` — durable artifacts, never touched
- Root `CLAUDE.md` — separate follow-up

## Phase 3 — Classify each existing file

Classify every `.claude/` file into exactly one bucket:

| Bucket | Meaning |
|---|---|
| **KEEP** | Directly useful given the Project Fingerprint. Leave unchanged. |
| **KEEP + TWEAK** | Useful but a small seed-aligned edit improves it. Specify the exact edit (≤10 lines). |
| **REMOVE** | No relevance to this project — wrong language, wrong stack, wrong domain. |
| **DEFER** | Relevance depends on an open question in `seed/open-questions.md`. |

Rules:
- **KEEP** must cite the seed file + section that justifies keeping it.
- **REMOVE** must cite the *absence* in the seed.
- **KEEP+TWEAK** must specify the exact change: old line → new line. If the change exceeds
  10 lines, it becomes REMOVE + a Phase 3.5 net-new proposal.
- **DEFER** must name the specific open question blocking the decision.

Scope bounds for this phase only (Phase 3.5 lifts these for proposals):
- Do NOT propose net-new agents/commands/skills here — that happens in Phase 3.5.
- Do NOT propose a wholesale settings.json rewrite — propose specific entries to add/remove.
- Do NOT touch `.claude/PRPs/` or root `CLAUDE.md`.

Run additional context7 queries for any Claude Code convention questions that affect your
judgment. If context7 returns nothing for a specific question, note it in the plan's Context7
Findings section.

## Phase 3.5 — Custom Rules / Skills / Agents / Hooks design

This is the part the original ECC audit was missing. After classifying existing files, **propose new
project-specific artifacts the seed implies**. Read `SeedKit-v2/approaches/ecc/custom-rules-skills-cookbook.md`
for the catalogue of common patterns and the canonical frontmatter shapes (verified against
context7 `/anthropics/claude-code`).

For each Project Fingerprint signal that warrants a custom artifact, propose a row with:

| Field | Notes |
|---|---|
| Type | rule / skill / agent / hook |
| Name | kebab-case |
| Path | per cookbook conventions: `.claude/rules/<domain>/<name>.md`, `.claude/skills/<name>/SKILL.md`, `.claude/agents/<name>.md`, or merged into `.claude/hooks/hooks.json` |
| `description:` trigger | the sentence that goes in the frontmatter — the model matches user intent against this sentence to auto-load the skill / pick the agent. Vague descriptions never fire — write a sentence the user might plausibly say or imply. |
| Source-of-truth | which seed section made this non-negotiable (file + line/section reference) |
| MCP dependencies | does it require Playwright, Firecrawl, Context7, or Serena? |

Consult the cookbook table — examples:

- Healthcare/clinical signal in `seed/user-stories.md` → propose `.claude/rules/healthcare/phi.md`
- Payments / cards in `seed/domain.md` → propose `.claude/rules/payments/pci-dss.md`
- "Reverse-engineer external app X" anywhere in the seed → propose
  `.claude/skills/reference-capture/SKILL.md` referencing `playwright-capture-pattern.md`
- Money math throughout `seed/schema.md` → propose `.claude/skills/currency-arithmetic/SKILL.md`
- Multi-tenant SaaS in `seed/architecture.md` → propose `.claude/rules/architecture/tenancy.md`
- Conventional-commits non-negotiable in `seed/creator-vision.md` → propose a PreToolUse Bash hook
  blocking malformed commits

The audit is allowed (and encouraged) to invent rows beyond the cookbook when the seed implies them.
Be conservative: if you would not be able to defend the row against "is this really required by the
seed?", don't propose it.

## Phase 3.6 — Roadmap derivation

Read `seed/roadmap.md` and draft the table of phases that the bootstrap will emit at the project
root as `roadmap.md` (using `SeedKit-v2/approaches/ecc/roadmap-template.md` as the shape).

For each phase from `seed/roadmap.md`, draft a row with:
- `#` (zero-padded, mirrors the row order)
- Phase name
- Status (always `pending` at this point — Phase 0 will flip to `in-progress` at bootstrap)
- Plan path: `.claude/PRPs/plans/<NNNN>-phase-<N>-<slug>.plan.md` (paths only, files don't exist yet)
- Report path: empty
- Notes: any open questions blocking the phase

Phase 0 (Bootstrap) is added by the bootstrap itself — do not include it here.

## Phase 3.7 — PRP framework wiring check

For each of `/prp-plan`, `/prp-implement`, `/prp-prd`, `/prp-commit`, `/prp-pr`:

- Confirm the command file exists in `.claude/commands/`
- If missing, mark MISSING and capture the source path in the ECC source harness (so the bootstrap
  can copy it back in)

The audit must NOT modify these commands itself. The bootstrap's Step 4 will inject the Serena
preamble into `prp-plan.md`, `prp-implement.md`, and `plan.md` after they are confirmed present.

## Phase 3.8 — Serena wiring check

For each item, mark PRESENT or MISSING (the bootstrap will install the missing ones):

- `claude mcp list` shows `serena` (either `plugin:serena:serena` from the Anthropic
  marketplace plugin or `serena` from a manual `claude mcp add`) — checks that the Serena
  MCP is registered
- **`which serena-hooks`** returns a path (required by the hooks; installed via
  `uv tool install serena-agent` per `serena-playbook.md` §One-time-setup / Hybrid path) —
  the Anthropic plugin install provides the MCP only, **not** the `serena-hooks` binary
- `.serena/project.yml` exists at project root — checks the project is created
- `serena project health-check` is green (skip if the CLI is not on PATH — fall back to
  confirming the MCP's `mcp__..._serena__activate_project` succeeds) — checks the language
  server is installed for the project's primary language
- `.claude/settings.json` already contains the **four** recommended Serena hooks
  (SessionStart→activate, PreToolUse matcher=""→remind, PreToolUse
  matcher="mcp__serena__*"→auto-approve, PreToolUse
  matcher="mcp__plugin_serena_serena__*"→auto-approve, Stop→cleanup) per
  `serena-playbook.md` §"Recommended hooks"
- `.claude/settings.json` `permissions.allow` includes `mcp__serena__*` and
  `mcp__plugin_serena_serena__*` as a safety net in case `serena-hooks` is not installed
  on a given machine
- `.serena/memories/onboarding.md` (or at least one memory file under `.serena/memories/`)
  exists and is non-empty — i.e. `mcp__..._serena__onboarding` was run

## Phase 4 — Write the plan and STOP

Write the audit plan to:
  `.claude/PRPs/plans/ecc-audit-[kebab-project-name].md`

Use this exact template:

---
# ECC Audit Plan — [Project Name]

## Summary
[2-3 sentences: what this project is per `seed/tech-stack.md`, the shape of the pruning, and the
notable custom rules/skills proposed.]

## Project Fingerprint
- Language(s): [from `seed/tech-stack.md`]
- Frameworks: [...]
- Storage: [...]
- UI: [yes/no + platform]
- Testing stack: [unit runner + e2e tool]
- Explicit prohibitions: [from "What we are NOT using" in `tech-stack.md`]
- Domain sensitivities: [...]
- ML/AI: [...]
- External-app reverse-engineering needed: [yes/no + which app]
- Target platform: [...]
- Maturity: [prototype / MVP / production]

## Seed → Harness Traceability
| Seed file | Section | Harness decisions it drives |
|---|---|---|

## Context7 Findings
[Convention changes found via `/anthropics/claude-code`. If none: "No relevant convention changes found."]

## KEEP (N files)
| Path | Why (seed citation) |
|---|---|

## KEEP + TWEAK (M files)

### .claude/.../<file>
- Why keep: [seed citation]
- Why tweak: [what's misaligned with the seed]
- Exact edit:
  OLD: [line]
  NEW: [line]

## REMOVE (P files)
| Path | Why (absence in seed) |
|---|---|

## DEFER (Q files)
| Path | Blocking open question |
|---|---|

## Custom-Rules/Skills Proposals (R items — Phase 3.5 output)
| Type | Name | Path | description trigger | Source-of-truth (seed citation) | MCP deps |
|---|---|---|---|---|---|

## Roadmap Draft (Phase 3.6 output)
| # | Phase | Status | Plan (target path) | Report | Notes |
|---|---|---|---|---|---|

## PRP-Wiring Status (Phase 3.7 output)
| Command | Present? | Action |
|---|---|---|
| /prp-plan | yes/no | none / install from <source path> |
| /prp-implement | yes/no | none / install from <source path> |
| /prp-prd | yes/no | none / install from <source path> |
| /prp-commit | yes/no | none / install from <source path> |
| /prp-pr | yes/no | none / install from <source path> |

## Serena-Wiring Status (Phase 3.8 output)
| Check | Present? | Action |
|---|---|---|
| MCP registered (`claude mcp list` shows `serena` or `plugin:serena:serena`) | yes/no | none / `/plugin install serena@claude-plugins-official` or `claude mcp add ...` |
| `serena-hooks` CLI on PATH (`which serena-hooks`) | yes/no | none / `uv tool install serena-agent` (installs both `serena` + `serena-hooks`) |
| `.serena/project.yml` exists | yes/no | none / `mcp__..._serena__activate_project` (or `serena project create --index` if CLI installed) |
| `serena project health-check` green (skip if CLI missing) | yes/no | none / install language server then re-check |
| Four Serena hooks in `.claude/settings.json` (SessionStart→activate, PreToolUse matcher=""→remind, PreToolUse mcp__serena__*→auto-approve, PreToolUse mcp__plugin_serena_serena__*→auto-approve, Stop→cleanup) | yes/no | none / merge from `serena-playbook.md` §Recommended hooks |
| `permissions.allow` safety net entries for `mcp__serena__*` + `mcp__plugin_serena_serena__*` | yes/no | none / add to `settings.json` |
| `.serena/memories/` has ≥1 non-empty file (onboarding ran) | yes/no | none / call `mcp__..._serena__onboarding` |

## settings.json changes
- Permissions to remove: [specific entries with justification]
- Env vars to add: [only if seed explicitly requires them — cite]
- Hooks to add: [Serena hooks if missing; custom hooks from Phase 3.5]
- Hooks to disable: [only if they match removed tools]

## rules/ reshape
- Keep subdirs: common/, [primary-language]/
- Remove subdirs: [each with "no [language] in seed/tech-stack.md"]
- Add subdirs (Phase 3.5 proposals): [list]

## NOT doing in this audit
- No deletions or edits until this plan is approved
- No changes outside `.claude/` (bootstrap emits `roadmap.md`, `CLAUDE.md`, etc.)
- No changes to `.claude/PRPs/`

## Execution steps (after approval — handed to `kickoff-bootstrap.md`)
1. Delete REMOVE files
2. Apply KEEP+TWEAK edits
3. Update settings.json
4. Reshape rules/
5. Sanity check
6. Verify PRP framework + install missing commands
7. Wire Serena (only missing items)
8. Inject Serena preamble into `/prp-plan`, `/prp-implement`, `/plan`
9. Emit `roadmap.md` at project root
10. Emit custom rules/skills/agents/hooks from Phase 3.5
11. Generate framework files (CLAUDE.md, dev-runbook.md, README.md, CHANGELOG.md, plans/)
12. Draft Phase 0 plan via `/prp-plan`

## Approval
[Reserved for creator. Do not execute until filled.]
---

After writing the plan, end your turn with EXACTLY:

ECC Audit — [Project Name]
KEEP: N | TWEAK: M | REMOVE: P | DEFER: Q | Custom proposals: R
Plan at: .claude/PRPs/plans/ecc-audit-[project].md
Awaiting creator approval before any deletion or edit.
```

---

## After approval

Once you have reviewed and approved the audit plan, run the Phase 2 prompt from `kickoff-bootstrap.md`.
