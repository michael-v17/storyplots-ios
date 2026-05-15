# Kickoff — spec-driven approach

Copy and paste the prompt below as the **first message** in a fresh Claude Code session
inside your project folder. Replace bracketed placeholders before sending.

---

## Prompt

```
You are starting the implementation of [PROJECT NAME] using the spec-driven methodology.
The seed is at ./seed/ and is the sole authoritative source for what to build.

## Step 1 — Read the seed

Read these files in order:
1. seed/README.md — precedence rules
2. seed/creator-vision.md — creator intent and non-negotiables
3. seed/tech-stack.md — stack, versions, prohibitions, testing stack
4. seed/roadmap.md — phase sequence; each phase will become one or more feature specs
5. seed/user-stories.md — the source for spec.md user stories
6. seed/schema.md — the source for data-model.md content
7. seed/ux.md (if present) — the source for acceptance scenarios and contracts/

## Step 2 — Generate framework files

### constitution.md (at project root)
A condensed extract of seed/creator-vision.md for quick spec-phase checking.
Format it as spec-kit constitution style: named principles, each 2–4 lines.
Include:
- Core non-negotiables from creator-vision.md (the invariants that can never be violated)
- Tech prohibitions from seed/tech-stack.md "What we are NOT using"
- A governance rule: "constitution.md is derived from seed/creator-vision.md — on conflict, the seed wins"

Do NOT invent principles. Extract only what creator-vision.md explicitly states.

### CLAUDE.md
Generate from the spec-driven CLAUDE.md template (SeedKit-v2/approaches/spec-driven/CLAUDE.md).
Customize with project name, seed precedence, and active plugin list.

### dev-runbook.md
Generate from seed/tech-stack.md. For every service:
- Service name, start command, port, health check command
- All services use Bash(run_in_background=true). Never foreground.
- Logs via BashOutput. Kill via KillShell.
- Include: restart procedure, port-clear procedure
- Include: what Claude does NOT manage (cloud DB, .env secrets, production)

### README.md (if not present)
One paragraph: what the project is. Link to seed/ as source of truth.

### CHANGELOG.md
Empty, single header: `# Changelog`

### specs/ directory
Create the empty directory. This is where all feature specs will live.

### SPEC-STATUS.md
Generate from the spec-driven SPEC-STATUS.md template. Initial state:
- No active feature yet
- Next action: create first feature spec from seed/roadmap.md Phase 0

## Step 3 — Create first feature spec

Read seed/roadmap.md Phase 0. Identify the features it contains.
Create specs/[001-phase-0-slug]/spec.md for the first feature.

The spec.md must:
- Cite the seed sections it draws from (file + section)
- List user stories from seed/user-stories.md that apply (with their IDs)
- Give each story a priority (P1 = must-have for this feature, P2 = important, P3 = nice-to-have)
- Write acceptance scenarios: Given / When / Then format
- Name the non-negotiables from seed/creator-vision.md that apply
- State explicit out-of-scope for this feature

Use context7 to look up any library API that the spec references before writing acceptance
scenarios that depend on specific API behavior.

## Step 4 — Wait for approval

Do NOT create plan.md or write any code until spec.md is approved.
Ask: "Feature spec is at specs/[001-phase-0-slug]/spec.md — ready to review?"

---

Rules for this session:
- All code, identifiers, comments, and commit messages must be in English
- Non-invention: if not in the seed, don't invent it — flag it in seed/open-questions.md
- Non-omission: don't drop required screens, flows, stories, or non-negotiables
- Ambiguity is a defect — surface it, don't resolve in code
- For any library API: query context7 before writing spec scenarios or plan contracts
```

---

## Subsequent sessions

**Starting a session:** read SPEC-STATUS.md → check active branch → open `specs/[active]/tasks.md`
→ find first unchecked task → start dev services from dev-runbook.md → resume.

**Starting a new feature:** read seed/roadmap.md for the next scope → create new branch →
create `specs/[###-feature]/spec.md` → get approval → plan.md → get approval → tasks.md → implement.

**Feature done:** all tasks checked, all acceptance scenarios from spec.md pass,
code-review + code-simplifier passes, PR merged, CHANGELOG.md updated, SPEC-STATUS.md updated.
