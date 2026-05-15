# Kickoff Bootstrap — ECC approach (Phase 2)

Run this prompt **after the audit plan is approved**. This executes the pruning, wires the
PRP loop + Serena + custom rules/skills the audit proposed, emits `roadmap.md` at the project root,
and drafts the Phase-0 plan via `/prp-plan`.

Replace bracketed placeholders before sending.

---

## Prompt

```
The ECC audit plan at `.claude/PRPs/plans/ecc-audit-[project].md` has been approved.
Execute it, then generate all project framework files.

Read these companion files (siblings of this prompt) before you start, so you know the shapes
to emit later — do not edit them, only read:
- `CLAUDE.md`                       — template for the project's `CLAUDE.md` (Step 7 fills it in)
- `serena-playbook.md`              — semantic code navigation pattern; loaded by the Serena-first
                                      preamble injected in Step 4
- `playwright-capture-pattern.md`   — background-spider + saved-state pattern (only if the audit
                                      proposed a `reference-capture` skill)
- `custom-rules-skills-cookbook.md` — frontmatter shapes for any new rule / skill / agent / hook
                                      the audit approved (Step 6 emits these)
- `roadmap-template.md`             — project-root `roadmap.md` shape (Step 5 copies + fills it)
- `preflight-pattern.md`            — preflight script pattern (templates + drift workflow);
                                      Step 7 emits `preflight.ps1` + `preflight.sh` from these templates

You do NOT need to re-read `kickoff-audit.md` (you consume its output, the approved audit plan)
or this folder's `README.md` (creator-facing setup doc).

Each step below ends with a single git commit (single-purpose).

## Step 1 — Execute the approved audit (only inside .claude/)

Read the approved plan at `.claude/PRPs/plans/ecc-audit-[project].md`.
Execute in this exact order — one git commit per step:

1. **Delete REMOVE files** from `.claude/`
   Commit message: "chore: prune ECC harness for [project]"

2. **Apply KEEP+TWEAK edits** inside `.claude/` — use the exact OLD→NEW diffs from the plan
   Commit message: "chore: tune ECC harness to seed for [project]"

3. **Update `.claude/settings.json`** — apply only the specific additions/removals from the plan
   Commit message: "chore: align ECC settings to seed for [project]"

4. **Reshape `.claude/rules/`** — remove irrelevant language subdirs per the plan
   Commit message: "chore: prune ECC rules to project stack"

5. **Sanity check** — verify:
   - Every remaining agent file's declared `tools:` list references tools that still exist
   - Every hook in settings.json points to a command file that still exists
   - Every retained `prp-*` command in `.claude/commands/` is intact
   - Report any broken references before proceeding

Nothing outside `.claude/` is touched in this step.

## Step 2 — Verify PRP framework wiring

For each of `/prp-plan`, `/prp-implement`, `/prp-prd`, `/prp-commit`, `/prp-pr`:
- Confirm the command file exists in `.claude/commands/`
- If the audit's "PRP-Wiring Status" flagged any as MISSING, copy the canonical version from the
  ECC source harness now (the audit captured the source path in its plan)

If any could not be installed, STOP and surface to the creator.

Commit message (only if changes were made): "chore(prp): install missing PRP commands"

## Step 3 — Wire Serena (only if audit's "Serena-Wiring Status" flagged items missing)

Run only the missing items from the audit's Serena-Wiring Status. The hybrid install
(plugin for MCP + `uv tool install` for CLI binaries) is the default — see
`serena-playbook.md` §One-time-setup for the full trade-off and the two alternatives.

  # 3a. Install the Serena CLI persistently (required for `serena-hooks` on PATH)
  #     Skip if `which serena-hooks` already returns a path.
  which uv || curl -LsSf https://astral.sh/uv/install.sh | sh     # install uv if missing
  uv tool install serena-agent                                     # installs serena + serena-hooks
  which serena-hooks && serena-hooks --help | head -3               # verify

  # 3b. Register the Serena MCP server. Two equivalent options:
  #     (i) Plugin marketplace (committed default — auto-updates):
  #         /plugin install serena@claude-plugins-official
  #         /reload-plugins
  #     (ii) Manual (if policy forbids plugins):
  #         claude mcp add --scope user serena -- serena start-mcp-server \
  #             --context claude-code --project-from-cwd

  # 3c. Activate + index this project. With the CLI installed you can use either:
  #     (i) MCP tool call from inside Claude:  mcp__..._serena__activate_project
  #     (ii) CLI:  serena project create --index

  # 3d. Sanity check (skip if CLI not installed — not available via MCP)
  serena project health-check

  # 3e. Patch .claude/settings.json to add the FOUR recommended hooks (verbatim shape from
  #     `serena-playbook.md` §Recommended hooks):
  #         SessionStart  matcher=""                              → serena-hooks activate
  #         PreToolUse    matcher=""                              → serena-hooks remind
  #         PreToolUse    matcher="mcp__serena__*"                → serena-hooks auto-approve
  #         PreToolUse    matcher="mcp__plugin_serena_serena__*"  → serena-hooks auto-approve
  #         Stop          matcher=""                              → serena-hooks cleanup
  #     Merge into the existing `hooks` block — do not overwrite.
  #     Also add `mcp__serena__*` + `mcp__plugin_serena_serena__*` to `permissions.allow`
  #     as a safety net (Serena tools keep working without prompts even if serena-hooks
  #     isn't on PATH on a given machine).

  # 3f. Run the onboarding ritual so baseline memories exist under .serena/memories/:
  mcp__..._serena__onboarding
  # Follow the returned instructions by calling mcp__..._serena__write_memory once per
  # topic (project_overview, tech_stack, suggested_commands, style_and_conventions,
  # task_completion_checklist, structure_and_layout). Six memories is the minimum baseline.

Commit message: "chore(serena): activate semantic code navigation"

## Step 4 — Inject Serena preamble into PRP / plan commands

For each of these command files (only those present after the audit):
- `.claude/commands/prp-plan.md`
- `.claude/commands/prp-implement.md`
- `.claude/commands/plan.md`  (if present — the chat-only `/plan` command)

Insert this preamble at the top of the command body (immediately after the frontmatter block, before
any existing prose). Do not duplicate if already present:

  > **Serena-first.** Before any code exploration in this command, read `serena-playbook.md`
  > once per session. For every code-reading or code-editing decision, consult its decision
  > matrix. Default: `mcp__serena__get_symbols_overview` over `Read` for files > ~150 lines.
  > For any rename or signature change planned in this command, run
  > `mcp__serena__find_referencing_symbols` first and include the call sites in the plan.

Reason: in practice the harness ignores Serena unless the command itself names the tools to prefer.
This preamble closes that gap deterministically without rewriting the rest of the command.

Commit message: "chore(prp): teach prp-* and plan to prefer Serena"

## Step 5 — Emit `roadmap.md` at the project root

Read the audit's "Roadmap Draft" section. Copy `SeedKit-v2/approaches/ecc/roadmap-template.md` shape
to `roadmap.md` at the project root, filled with:
- Phase 0 row: Bootstrap, status `in-progress`, plan path = `.claude/PRPs/plans/0000-phase-0-bootstrap.plan.md`
- One row per phase from `seed/roadmap.md`, status `pending`, plan/report empty
- "Next: Phase 0 (Bootstrap)" pointer

Commit message: "docs: add project roadmap (phase tracker)"

## Step 6 — Emit custom rules / skills / agents / hooks the audit approved

For each row in the audit's "Custom-Rules/Skills Proposals" section, write the artifact using the
canonical Claude-Code frontmatter shape from `custom-rules-skills-cookbook.md` §"How to write a new
entry":

- **Skill** → `.claude/skills/<kebab-name>/SKILL.md` with frontmatter `name`, `description`, `version`.
  The `description` is the auto-load trigger sentence — write it precisely; vague descriptions never fire.
- **Rule** → `.claude/rules/<domain>/<name>.md`. Add a one-line entry to `CLAUDE.md`'s
  "Custom rules & skills" section (added in Step 7) so future sessions know it exists.
- **Agent** → `.claude/agents/<name>.md` with frontmatter `name`, `description`, `tools`, `model`.
- **Hook** → merged into `.claude/hooks/hooks.json`; hook script under `.claude/scripts/hooks/`.

If any approved row depends on `playwright-capture-pattern.md` (e.g., a `reference-capture` skill),
the SKILL.md body must reference that playbook by name so the pattern is auto-loaded with the skill.

Commit message: "feat(harness): add seed-implied custom rules and skills"

## Step 7 — Generate project framework files

After Steps 1–6 are committed, generate the rest:

### CLAUDE.md
Generate from `SeedKit-v2/approaches/ecc/CLAUDE.md` template. Customize with:
- Project name
- Seed precedence order from the audit's Project Fingerprint
- Active ECC agents/skills/commands retained from the audit (list them)
- The custom rules/skills emitted in Step 6 (one-line entries each)
- The Serena and Playwright capture sections kept verbatim from the template — they reference
  the sibling playbooks

Verification: do NOT carry rules from any reference project that contradict the current seed.
Verify each rule's relevance against `seed/tech-stack.md` and `seed/user-stories.md` before retaining.
A useful sanity check: grep the generated `CLAUDE.md` for the names of any apps mentioned in
`seed/references/` — none should appear as guidance, only as context citations.

### dev-runbook.md
Generate from `seed/tech-stack.md`. For every service:
- Service name, start command, port, health check command
- All services: `Bash(run_in_background=true)`. Never foreground.
- Logs via `BashOutput`. Kill via `KillShell`.
- Include: restart procedure, stuck port clearance
- Include: what Claude does NOT manage (cloud DB, .env secrets, production)

**Health-check robustness:** for any credential-based health check (cloud API ping),
send every header the provider documents as currently required — not just the ones
the seed example shows. Modern API gateways (Supabase new-key projects, Neon, Upstash,
many others) reject single-header (`apikey:` only) shapes with `401` and require both
`apikey:` and `Authorization: Bearer <key>`. If `seed/tech-stack.md` shows a
single-header curl, generate the dual-header form in `dev-runbook.md` and flag
the drift per `preflight-pattern.md §Cloud-provider auth drift`.

### preflight.ps1 + preflight.sh
Emit both scripts at the project root using the templates in `preflight-pattern.md`.
Fill the `# PROJECT-SPECIFIC:` markers from the seed:
- Tools list from `seed/tech-stack.md §1 (pinned dependencies)`
- Files to check — add any directory/file the seed promises will exist by the
  first implementation phase (e.g. `package.json`, `supabase/`, lockfile)
- Variable names from `.env.example` (if present) — the parity check is
  automatic; no placeholders required
- URL regex + placeholder + key prefixes + health endpoint from
  `seed/tech-stack.md §4 (backend / external services)`

Both scripts MUST:
- Never print secret values (only shapes, lengths, booleans, fingerprints)
- Skip reachability gracefully when `.env.local` has placeholders
- Accept both legacy and modern provider key formats where the seed's
  provider offers both (see `preflight-pattern.md §Section 4`)

Keep the two implementations in sync — if a developer edits one, the other
needs the same edit. Teams in a mixed bash/PowerShell environment rely on
them being equivalent.

### README.md (if not present)
Short document with:
- One paragraph: what the project is (from `seed/creator-vision.md §1`).
- `## Source of truth` section: link to `seed/`, `roadmap.md`, `CLAUDE.md`, `dev-runbook.md`.
- `## Stack` section: one-line summary from `seed/tech-stack.md §1` plus the key prohibitions.
- `## Status` section: current phase state — Phase 0 ready for close-out, rest pending.
- **`## Getting started — first run` section** covering the Phase 0 close-out + PRP loop
  kick-off — mirrors Step 7 + Step 9 of this bootstrap's parent README
  (`SeedKit-v2/approaches/ecc/README.md`). Second person cloning the repo should be able
  to follow that checklist without re-reading the SeedKit doc. Include:
    1. **Run `./preflight.ps1` (Windows) or `./preflight.sh` (macOS/Linux) FIRST.** Expected output: tools present, `.env` parity clean, `HTTP 200` on the reachability line. If reachability reports `SKIPPED`, the `.env.local` still has placeholders — populate real values from the cloud provider's dashboard, then re-run.
    2. Fresh session + optional `/context` baseline
    3. Verify Phase 0 Gate from the Phase 0 plan
    4. Manual flip of `roadmap.md` row 0 → done + advance Next pointer
    5. Short PRP loop snippet: `/prp-plan` → review → `/prp-implement` → `/code-review && /quality-gate` → `/prp-commit` → `/prp-pr`
    6. Reference to `CLAUDE.md §PRP workflow loop` for the full cycle with guardrails
- Note that subsequent phase closes are automatic via `/prp-implement`; Phase 0 is the
  only manual flip because the bootstrap itself is row 0.

### CHANGELOG.md
Empty file with single header: `# Changelog`

### plans/ directory
Create `.claude/PRPs/plans/` and `.claude/PRPs/reports/` if they don't exist.

### Initial ECC memory entry
Write a session memory entry with:
- Project: [project name]
- Current phase: Phase 0 — Bootstrap
- Last commit: [SHA of the last commit from Step 6 or 7]
- Custom rules/skills emitted: [list from Step 6, or "none"]
- Serena: [wired / already wired / not applicable + reason]
- Next action: review Phase 0 plan

Commit message: "docs: bootstrap project framework files (CLAUDE.md, runbook, README, CHANGELOG)"

## Step 8 — Draft Phase 0 plan via /prp-plan

Invoke `/prp-plan` with the Phase 0 brief from `seed/roadmap.md`. The plan lands at
`.claude/PRPs/plans/0000-phase-0-bootstrap.plan.md` (matches the row already written into
`roadmap.md` in Step 5).

The plan must:
- Cite the seed sections it satisfies (file + section number)
- List user story IDs from `seed/user-stories.md` this phase covers
- Name the non-negotiables from `seed/creator-vision.md` that apply
- Enumerate atomic subtasks, each with a `Verify:` command (see `CLAUDE.md` for format)
- Include the Phase 0 exit criteria from `seed/roadmap.md` verbatim in a `## Gate` section
- If `seed/references/[AppName]/` exists: check it for any behavior the seed is silent on before
  writing a subtask. Reference it as secondary context, not as a seed citation.

Per the Step 4 preamble, `/prp-plan`'s exploration phase must prefer Serena tools over `Read`
for any file > ~150 lines and must run `find_referencing_symbols` before proposing any rename or
signature change.

Commit message: "docs(phase-0): draft bootstrap plan via /prp-plan"

## Step 9 — Wait

Do not write any implementation code until the Phase 0 plan is approved.
Ask: "Bootstrap complete. Phase 0 plan at `.claude/PRPs/plans/0000-phase-0-bootstrap.plan.md` —
ready to review?"

---

Rules:
- All code, identifiers, comments, and commit messages in English
- Non-invention: if not in seed, flag in `seed/open-questions.md`
- For any library API: query context7 before committing to a shape
- For any code exploration: prefer Serena tools per `serena-playbook.md`
- For any external-app capture: follow `playwright-capture-pattern.md` (background spider, never blocking)
```
