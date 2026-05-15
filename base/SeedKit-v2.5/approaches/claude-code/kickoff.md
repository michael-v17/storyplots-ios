# Kickoff — claude-code approach

Copy and paste the prompt below as the **first message** in a fresh Claude Code session
inside your project folder. Replace bracketed placeholders before sending.

---

## One-time prerequisites (before pasting the prompt)

These are per-machine installs, run once per developer. The kickoff prompt itself assumes
they're already done.

### Serena (MCP + CLI, hybrid install — required)

Serena is the default for code exploration and symbol-level edits. Full rationale and
install trade-offs are in
[`SeedKit-v2/approaches/claude-code/serena-playbook.md`](./serena-playbook.md).

```bash
# 1. Install uv (required for the Serena CLI) if missing
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Install the Serena CLI persistently — provides `serena` + `serena-hooks` on PATH
uv tool install serena-agent
which serena-hooks       # verify: /<home>/.local/bin/serena-hooks
```

```
# 3. Install the Serena MCP via the Claude Code plugin marketplace
#    Paste in a Claude Code session:
/plugin install serena@claude-plugins-official
/reload-plugins
```

```bash
# 4. Verify the MCP is connected
claude mcp list | grep serena     # expect: plugin:serena:serena ... ✓ Connected
```

### Other MCPs

```
# Always useful
/plugin install context7@claude-plugins-official

# If your project has a UI or reverse-engineers one
/plugin install playwright@claude-plugins-official
```

---

## Prompt

```
You are starting the implementation of [PROJECT NAME] against the seed at ./seed/.

## Step 1 — Read the seed

Read these files in order before doing anything else:
1. seed/README.md — precedence rules (which file wins on conflict)
2. seed/creator-vision.md — creator intent and non-negotiables
3. seed/tech-stack.md — stack, pinned versions, what we are NOT using, testing stack
4. seed/roadmap.md — phase sequence with exit criteria

Then read the remaining seed files as needed for Phase 0:
- seed/schema.md, seed/ux.md, seed/user-stories.md (and any conditionals present)

Do NOT read files outside ./seed/ as authoritative — if a sibling folder exists,
it is a separate concern. This seed is the sole source of truth.

## Step 2 — Activate Serena and generate framework files

After reading the seed, do these in order. Do not start Step 3 until all exist.

### 2.1 — Activate Serena for this project
Call `mcp__serena__activate_project` with project = current working directory.
Then call `mcp__serena__check_onboarding_performed`.
If onboarding has NOT been performed, call `mcp__serena__onboarding` — this writes the
six canonical memories (project_overview, tech_stack, suggested_commands,
style_and_conventions, task_completion_checklist, structure_and_layout) populated from
the seed you just read. If onboarding HAS been performed, skip it.

### 2.2 — CLAUDE.md
Generate from the claude-code CLAUDE.md template
(SeedKit-v2/approaches/claude-code/CLAUDE.md). Customize with the actual project name,
seed precedence, and active plugin list. Do NOT copy StoryPlots-specific rules — generate
fresh from the seed you just read. Preserve verbatim the §Serena, §Mid-phase decision
memories, §Verification ritual (step 9 memory hygiene), and §Cloud-provider auth drift
sections — they are load-bearing.

### 2.3 — dev-runbook.md
Generate from seed/tech-stack.md. For every service in the stack, produce:
- Service name, start command, port, health check command
- For Claude Code: all services use Bash(run_in_background=true). Logs via BashOutput.
  Never run a service in the foreground — it blocks the conversation.
- Include: how to restart a stuck service, how to clear a stuck port
- Include: what Claude does NOT manage (cloud DB setup, .env secrets, production deploy)
- Include: a "One-time setup" section naming the Serena plugin install + CLI install
  (`uv tool install serena-agent`) so teammates know the prerequisites.

### 2.4 — preflight.sh and preflight.ps1
Generate from seed/tech-stack.md following the pattern in
SeedKit-v2/approaches/claude-code/preflight-pattern.md. Both scripts must:
- Check every tool pinned in seed/tech-stack.md §1 is on PATH (Runtimes, package managers,
  cloud CLIs, language-specific build tooling).
- Check `.env.example` and `.env.local` parity (missing / extra variable NAMES, never values).
- Shape-check opaque credentials (prefix, length, accepted formats) without printing secrets.
- Send the actually-current header pair to every cloud provider's health endpoint
  (for Supabase-like APIs: both `apikey` and `Authorization: Bearer`).
- Print non-secret fingerprints (`first 8…last 4`) so the reader can cross-check against the
  provider's dashboard.
- Skip reachability if any prior section failed, rather than hammer with known-bad keys.

### 2.5 — .env.example
Generate from seed/tech-stack.md with every variable name the stack declares. Use
placeholders like `REPLACE_ME` — never real values. This is the source of truth for the
preflight parity check.

### 2.6 — README.md (if not present)
One paragraph: what the project is. Link to seed/ as source of truth.
Link to dev-runbook.md for how to start development.
Link to preflight.ps1 / preflight.sh for the pre-session health check.

### 2.7 — CHANGELOG.md
Create empty with a single header:
```
# Changelog
```

### 2.8 — SESSION_HANDOFF.md
Generate from the claude-code SESSION_HANDOFF.md template
(SeedKit-v2/approaches/claude-code/SESSION_HANDOFF.md). Initial state:
- Current phase: Phase 0 — [name from roadmap]
- Last commit: none (project starting)
- In-progress: kickoff complete, Phase 0 plan pending approval
- Next step: approve plans/0001-phase-0-[slug].md then start Phase 0

### 2.9 — plans/ directory
Create the empty directory.

### 2.10 — Verify Serena wiring
Confirm before moving on:
- `.serena/project.yml` exists at the project root
- `mcp__serena__list_memories` returns the six canonical memories
- `.claude/settings.json` contains the four Serena hooks
  (activate / remind / auto-approve / cleanup) per serena-playbook.md §Recommended hooks.
  If it doesn't, add them now.

## Step 3 — Draft Phase 0 plan

Read seed/roadmap.md Phase 0 scope, stories, and exit criteria.
Generate plans/0001-phase-0-[slug].md using the plan format from CLAUDE.md.

At the top of the plan (right after the title and metadata), include the Serena-first
preamble verbatim:

> **Serena-first.** Before any code exploration, read `serena-playbook.md` once per
> session. For every code-reading or code-editing decision in this phase, consult its
> decision matrix. Default: `get_symbols_overview` over `Read` for files > ~150 lines.
> For any rename or signature change planned by this phase, run
> `find_referencing_symbols` first and include the call sites in the plan.

The plan must:
- Cite the seed sections it satisfies (file + section)
- Enumerate 3–6 atomic subtasks, each with its own `Verify:` command (test, curl,
  grep gate, etc.) — tests are written JOINT with the subtask's code, not afterwards
- Name the non-negotiables from creator-vision.md that apply to this phase
- Include the Phase 0 exit criteria from roadmap.md verbatim in a ## Gate section
- NOT start implementation — stop here and wait for approval

## Step 4 — Wait

Do not write any implementation code until the plan is approved.
Ask me: "Phase 0 plan is at plans/0001-phase-0-[slug].md — ready to review?"

---

Rules for this session:
- All code, identifiers, comments, and commit messages must be in English
- Non-invention: if something important is not in the seed, flag it — do not invent it
- Non-omission: do not drop required screens, states, flows, or non-negotiables
- Ambiguity is a defect — surface it, do not resolve it in code
- For any external library API decision, query context7 before committing to a shape
- For any code exploration or symbol-level edit, prefer Serena tools over Read/Grep/Edit
  (see CLAUDE.md §Serena and serena-playbook.md)
```

---

## Usage notes

- **First session only.** For subsequent sessions, run `./preflight.sh` (or `preflight.ps1`)
  first, then read `SESSION_HANDOFF.md` and `.serena/memories/` and pick up from the current
  phase plan.
- **For each new phase:** generate the next `plans/NNNN-phase-slug.md` (use `/ultraplan` if
  available, or draft it manually following the plan format in CLAUDE.md). Always include
  the Serena-first preamble at the top. Same approval-before-implement rule applies.
- **Mid-phase decisions:** when a non-trivial trade-off surfaces (≥2 valid paths, library
  quirk, schema choice not in seed/schema.md, convention extension), capture it immediately
  as a `decision_<slug>_YYYY_MM_DD` Serena memory — don't wait for phase close. See
  CLAUDE.md §Mid-phase decision memories.
- **Phase close:** Verification ritual step 9 (memory hygiene) is a blocker before the
  single phase commit. The Serena memory writes land in the same commit as the code that
  justified them.
- **If the kickoff generates anything the seed doesn't support** (extra files, invented
  routes, unsupported packages): stop and ask for a seed citation. That's the drift signal.
