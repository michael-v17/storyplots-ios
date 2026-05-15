# Serena Playbook — semantic code navigation for claude-code projects

> Claude Code can register the Serena MCP and never use it. This playbook exists to make sure
> Serena is the **default** for code exploration and symbol-level edits, not an afterthought.
> Read at session start and cited from every phase plan so the symbol-first habit propagates
> into every workflow.

Verified against context7 `/oraios/serena`. Adapt paths to your stack — playbook itself is project-agnostic.

---

## Why Serena

Serena is a language-server-backed MCP that lets Claude read and edit **symbols** (functions, classes,
methods, variables) instead of full files. For any non-trivial codebase that means:

- **Less context spent.** `get_symbols_overview` of a 2000-line file returns the symbol tree in
  ~30 lines. Reading the whole file would burn ~6000 tokens.
- **Safer edits.** `replace_symbol_body` swaps an entire function atomically; line-based `Edit` can
  desynchronise on whitespace, accidental near-duplicates, or partial matches.
- **Refactor-aware search.** `find_referencing_symbols` finds every caller across the project,
  including dotted paths, overloads, and re-exports — `Grep` misses these.
- **Cross-session memory.** `write_memory` / `read_memory` persist non-trivial findings (auth flow
  layout, schema invariants, build pipeline quirks) under `.serena/memories/` so the next session
  re-hydrates context without re-exploring.

The single biggest failure mode in practice: **a registered Serena MCP that the harness ignores**
because no skill / command / rule tells Claude to prefer it. This playbook fixes that by being
loaded as an always-on reference at session start and explicitly cited from the phase plan file
at the start of every phase (plus `/ultraplan` if the plan is generated with it).

---

## One-time setup (two install paths)

Serena needs **two components** to work with Claude Code at full fidelity:

| Component | Why | Options |
|---|---|---|
| MCP server | Exposes `mcp__..._serena__*` tools to the agent | Plugin marketplace **or** manual `claude mcp add` |
| CLI binaries (`serena`, `serena-hooks`) | Powers the 4 `settings.json` hooks (activate / remind / auto-approve / cleanup) | `uv tool install serena-agent` (or equivalent PyPI install) |

The Anthropic plugin marketplace install provides the **MCP server only** (ephemeral `uvx`) —
not the `serena-hooks` binary. To get full hook functionality, install the CLI **in
addition to** the plugin (hybrid path). See the §Trade-offs section below.

### Hybrid path (RECOMMENDED for most teams)

```bash
# 1. Install the Serena CLI persistently (one-time per machine)
# Requires `uv` (https://astral.sh/uv). If missing:
curl -LsSf https://astral.sh/uv/install.sh | sh

uv tool install serena-agent             # installs `serena` + `serena-hooks` on PATH
which serena-hooks                        # verify: /<home>/.local/bin/serena-hooks
serena-hooks --help | head -5             # verify: lists activate/remind/auto-approve/cleanup
```

```
# 2. Install the Serena MCP via Claude Code plugin marketplace (one-time per machine)
# Paste in a Claude Code session:
/plugin install serena@claude-plugins-official
/reload-plugins
```

```bash
# 3. Verify the MCP is connected
claude mcp list | grep serena            # expect: plugin:serena:serena ... ✓ Connected

# 4. Activate + onboard THIS project (done via MCP tools inside Claude, not CLI)
# Inside a Claude Code session in the project root, call:
#   mcp__plugin_serena_serena__activate_project  (project = $(pwd))
#   mcp__plugin_serena_serena__onboarding
# The bootstrap does both automatically.
```

### Pure-CLI path (manual install, no plugin)

Full fidelity, no plugin dependency, but no marketplace auto-updates:

```bash
# 1. Install the CLI (same as step 1 above)
uv tool install serena-agent

# 2. Register Serena MCP for Claude Code (user scope, project resolved per-cwd)
claude mcp add --scope user serena -- serena start-mcp-server --context claude-code --project-from-cwd

# 3. Create + index THIS project (run from project root)
serena project create --index

# 4. Sanity check — flags missing language servers, broken indexes, ignored paths
serena project health-check
```

The `claude-code` context is purpose-built — it pre-selects the tool set best suited to Claude Code's
reasoning style. Do not pick `agent` or `desktop-app` instead.

### Plugin-only path (no CLI — minimal, LIMITED)

Works but the hooks in `settings.json` fail silently. Only choose this if you cannot install
the CLI for policy or environment reasons (e.g. locked-down machines without `uv`/`pip`).

```
/plugin install serena@claude-plugins-official
```

Then remove the `hooks` block from `settings.json` and rely on `permissions.allow` entries
for `mcp__serena__*` + `mcp__plugin_serena_serena__*` so tool calls don't prompt.

You lose: SessionStart project auto-activate, PreToolUse anti-drift `remind` + `auto-approve`,
Stop cleanup. Serena tools themselves still work when called.

---

## Recommended hooks (added to `.claude/settings.json` by bootstrap)

The 4 hooks below match the official oraios/serena docs
(<https://github.com/oraios/serena/blob/main/docs/02-usage/030_clients.md>).
They require `serena-hooks` on PATH (hybrid or pure-CLI path above).

```jsonc
{
  "hooks": {
    "SessionStart": [
      { "matcher": "", "hooks": [
        { "type": "command", "command": "serena-hooks activate --client=claude-code" }
      ]}
    ],
    "PreToolUse": [
      { "matcher": "", "hooks": [
        { "type": "command", "command": "serena-hooks remind --client=claude-code" }
      ]},
      { "matcher": "mcp__serena__*", "hooks": [
        { "type": "command", "command": "serena-hooks auto-approve --client=claude-code" }
      ]},
      { "matcher": "mcp__plugin_serena_serena__*", "hooks": [
        { "type": "command", "command": "serena-hooks auto-approve --client=claude-code" }
      ]}
    ],
    "Stop": [
      { "matcher": "", "hooks": [
        { "type": "command", "command": "serena-hooks cleanup --client=claude-code" }
      ]}
    ]
  }
}
```

What each does:

- `SessionStart → activate` — prompts the agent to activate the project at session start and
  read Serena's instruction manual. Without it the agent may skip Serena entirely.
- `PreToolUse matcher="" → remind` — **critical anti-drift hook**. Nudges the agent toward
  Serena's symbolic tools instead of `Read`/`Grep`/`Edit` on every tool call. Silent when
  Serena is already being used; only injects reminders when drift is detected.
- `PreToolUse matcher="mcp__serena__*" → auto-approve` — auto-approves destructive Serena
  tools (`replace_symbol_body`, `rename_symbol`, `insert_after_symbol`) in edit mode so the
  flow isn't interrupted by permission prompts.
- `PreToolUse matcher="mcp__plugin_serena_serena__*" → auto-approve` — same as above but
  for the plugin-namespaced tool names emitted by the Anthropic marketplace plugin.
- `Stop → cleanup` — clears per-session hook state.

**Safety net** — also add `mcp__serena__*` and `mcp__plugin_serena_serena__*` to
`settings.json` `permissions.allow`. If `serena-hooks` is missing on some machine, the hooks
no-op (exit non-zero, Claude continues) and the allow list keeps Serena tools usable without
prompts. The hybrid path makes this redundant in practice but cheap insurance.

---

## Trade-offs — plugin vs CLI install

| Aspect | Plugin only | Hybrid (plugin + CLI) | Pure CLI |
|---|---|---|---|
| `mcp__..._serena__*` tools work | ✅ | ✅ | ✅ |
| `activate` hook fires on SessionStart | ❌ | ✅ | ✅ |
| `remind` hook prevents agent drift | ❌ | ✅ | ✅ |
| `auto-approve` for destructive edits | ❌ (use `permissions.allow`) | ✅ | ✅ |
| `cleanup` at Stop | ❌ (no-op, harmless) | ✅ | ✅ |
| `serena project health-check` CLI | ❌ | ✅ | ✅ |
| Plugin marketplace auto-updates | ✅ | ✅ (MCP side) | ❌ (manual `uv tool upgrade`) |
| Install steps per machine | 1 | 2 | 2 |
| Git-trackable config | `enabledPlugins` in settings.json | `enabledPlugins` + hooks in settings.json | hooks in settings.json |

**Recommendation by team shape:**

- **Solo dev, one machine** — plugin-only is fine; you can always upgrade to hybrid later.
- **2-4 devs sharing a repo** — hybrid. `serena-hooks` prevents agent drift consistently
  across machines; `dev-runbook.md` documents the per-machine `uv tool install` step.
- **CI / locked-down machines** — pure CLI, because there's no interactive session to run
  `/plugin install` in anyway.

---

## Decision matrix — which tool to reach for first

| I need to…                                              | Use                                                                | Not                                       |
|---------------------------------------------------------|--------------------------------------------------------------------|-------------------------------------------|
| Get a feel for what's in a file                         | `mcp__serena__get_symbols_overview` (depth=1)                      | `Read` whole file                          |
| Read one specific function/class body                   | `mcp__serena__find_symbol name_path=… include_body=true`           | `Read`                                     |
| Find every caller of `foo()` before refactoring         | `mcp__serena__find_referencing_symbols`                            | `Grep` (misses overloads, dotted paths)    |
| Fuzzy / regex search across the repo (no symbol target) | `mcp__serena__search_for_pattern`                                  | `Read`. (`Grep` is fine for trivial substrings.) |
| Edit a function body in place                           | `mcp__serena__replace_symbol_body`                                 | line-based `Edit`                          |
| Add a new method right after an existing one            | `mcp__serena__insert_after_symbol`                                 | `Edit`                                     |
| Add an import / new top-level decl above existing one   | `mcp__serena__insert_before_symbol`                                | `Edit`                                     |
| Rename a symbol everywhere                              | `mcp__serena__rename_symbol`                                       | manual find-and-replace                    |
| Recall what I learned last session                      | `mcp__serena__read_memory`                                         | re-explore from scratch                    |
| Capture a finding worth keeping                         | `mcp__serena__write_memory`                                        | rely on chat history                       |
| Verify the project is fully onboarded                   | `mcp__serena__check_onboarding_performed`                          | assume                                    |

### Hard rule

> If the file is **> ~150 lines** OR you **don't yet know which symbol you want**, start with
> `get_symbols_overview`. Never `Read` the whole file as the first action.

The 150-line threshold is heuristic, not magic — the principle is *cost*. A 60-line config file is
fine to `Read` outright. A 600-line module almost never is.

---

## Memories workflow — three-layer model

Serena memories only pay off if the next cold session can trust them. Memories written
once at bootstrap decay quickly: new migrations land, new scripts are added, a rule file
extends — and three phases later the memories describe a codebase that no longer exists.
The next session either reads stale truth (worse than none) or learns to ignore the memory
layer entirely.

To prevent that, claude-code operates on a **three-layer memory model** with an explicit
maintenance ritual wired into the phase-close ritual. The project's own `CLAUDE.md` codifies the
operational rules (`§Verification ritual` memory-hygiene step + `§Mid-phase decision
memories` section); this playbook explains the *why* behind each layer.

### Layer 1 — the six canonical onboarding memories

A fixed set every session expects to find in `.serena/memories/`. These are what
`mcp__serena__onboarding` writes the first time (see §Onboarding ritual below) and what
the phase-close hygiene ritual keeps current thereafter:

| Memory                    | Purpose                                                                                                              | Typical trigger to refresh                                                     |
|---------------------------|----------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| `project_overview`        | What the project is, scope + anti-goals, non-negotiables, critical flows, current phase                              | A phase closes user stories, flows, or shifts phase status                     |
| `tech_stack`              | Exact-pinned versions, prohibitions, architecture discipline                                                         | Version bump, new pinned dep, a prohibition is lifted by a seed edit           |
| `suggested_commands`      | One-time setup, dev/build/test/migration commands, phase-close grep gates, Serena cheat-sheet                        | A new runtime script lands or a grep gate changes                              |
| `style_and_conventions`   | Naming, immutability, validation boundary, i18n, testid grammar, tenant isolation, design tokens, commit discipline  | A new rule file or convention is codified                                      |
| `task_completion_checklist` | Phase-Gate checklist + phase→flow map + escalation rules                                                           | The Verification ritual in `CLAUDE.md` changes                                 |
| `structure_and_layout`    | Top-level tree, seed/, .claude/, .serena/, target src/ layout                                                        | **Any** phase that creates or renames paths (i.e. almost every phase)          |

These are the only memories guaranteed to be current truth. A session can `read_memory`
any of them and treat the content as load-bearing.

**Why a fixed set**: a fresh Claude session scans `list_memories` and has to decide which
are relevant. If the set is free-form and grows uncapped, signal-to-noise collapses. Six
memories with well-known names let the session bootstrap deterministically. These six
names also match what `mcp__serena__onboarding` produces out of the box, so the ritual
and the tool agree on the canonical set.

### Layer 2 — phase-close memory-hygiene ritual

Codified in the project `CLAUDE.md` as **a blocker before the phase commit**. Before the
single phase commit is created, the implementer updates whichever of the six canonical
memories the phase touched:

- **Always**: update `structure_and_layout` with the new paths/files that now exist.
- **If new runtime scripts landed** (`pnpm`/`npm`/`make`/`cargo`/etc.): update `suggested_commands`.
- **If the tech stack shifted** (version bump, new pinned dep, prohibition lifted): update `tech_stack`.
- **If a convention was added or clarified**: update `style_and_conventions`.
- **If user stories / flows / non-negotiables closed**: update `project_overview`.

Prefer `write_memory` to overwrite in full (cheaper than diff-patching six files); use
`edit_memory` only for small incremental additions expressible as a regex replace.

**Why it's a blocker for the phase commit**: the memory writes land in the same commit as
the code that justified them. That keeps the memory layer and the codebase in lockstep
across the git history — the phase commit is the only atomic unit we have, so the memory
refresh has to live inside it. Defer it and you get the old failure mode: memories
describe a state that existed three phases ago.

**Why it's attached to phase close specifically**: closing a phase is the only moment
that touches the codebase at phase-scale. Running the hygiene step there covers ~100% of
the drift vectors; there is no other place where many files move in a single coordinated
change.

### Layer 3 — mid-phase decision memories

Codified in the project `CLAUDE.md` §Mid-phase decision memories. When a **non-trivial
decision** surfaces mid-phase — a choice between ≥2 valid paths, a library workaround
with a citation, a schema trade-off not captured verbatim in `seed/schema.md`, a
convention extension, or a seed-ambiguity resolved in code before the OQ was updated —
capture it the moment it's decided as its own memory:

```text
mcp__serena__write_memory(
  name="decision_<slug>_YYYY_MM_DD",
  content="""
  # <one-line title>

  **Decided:** YYYY-MM-DD during Phase N subtask X.Y
  **Seed anchors:** [citations]
  **Related OQ:** [if any]

  ## Options considered
  1. <Option A> — pros / cons
  2. <Option B> — pros / cons (this is what shipped)

  ## Why the chosen path
  <2–4 sentences. The *why*, not the *what*.>

  ## What a future session needs to know
  - <Invariant or trap that could regress the decision>
  - <File(s) or symbol(s) that embody it>
  - <The symptom if someone violates it>
  """
)
```

Example names (abstract so they apply to any project):

- `decision_host_middleware_2026_04_23`
- `decision_write_through_cache_2026_05_02`
- `decision_event_naming_grammar_2026_05_18`

**Why a separate memory layer instead of putting it in the plan / report**: the plan is a
forward contract ("what we intend to build"), the report is a backward audit trail ("what
we built and what passed"). Neither is the right home for *"here's a non-obvious
trade-off a future session has to understand before touching this file"*. That lives in
decision memories — they're operational context, not process artifacts.

**Why capture at decision time, not at phase close**: the reasoning chain that produced
the decision is at its sharpest in the turn where it's made. Reconstructing it three
hours later at phase close loses the rejected options and the *why*, which are the
load-bearing parts. Write it once, cross-reference it from the phase report, move on.

**What does NOT go into a decision memory**:

- Anything already in `seed/` — the seed wins; don't duplicate.
- Anything a fresh reader could derive from a single `get_symbols_overview` + `find_symbol`
  call. Code is self-documenting for local decisions.
- Ephemeral task progress — that belongs in `SESSION_HANDOFF.md` (living project state), not in a Serena memory.

### Why this three-layer split matters

The three layers separate by **decay rate**:

- **Layer 1 (canonical)** decays at the pace the codebase evolves — refreshed every phase,
  always current. Finite, named set.
- **Layer 3 (decisions)** decays slowly; each memory describes an invariant. A decision
  written in Phase 4 about data-flow shape is still correct in Phase 8 unless someone
  re-opens the trade-off. Grows over time but each entry is narrow.
- **Session-scoped memories** (`session_bootstrap_*`, `session_phase_*_closed_*`) decay
  fastest and are intentionally outside the canonical set. They're operational breadcrumbs
  for the next session's warm-up, not project truth.

The memory-hygiene ritual targets Layer 1 specifically, because that's the layer a fresh
session loads first. Layer 3 is write-once. Session memories are disposable.

### Verifying the discipline holds

After any phase closes, a fresh session should be able to answer these four questions
**using only `list_memories` + `read_memory`**, without rereading the codebase:

1. "Which phase just closed and what does the project ship now?" → `project_overview`
2. "What paths exist in the codebase?" → `structure_and_layout`
3. "Which build/test/migration commands are available today?" → `suggested_commands`
4. "Are there non-obvious decisions I should know about before editing area X?"
   → `list_memories` | grep `decision_.*` (filter by slug)

If any of those four answers requires a `Read` or `Grep` of the working tree to recover,
the hygiene ritual slipped somewhere. Fix it in the *next* phase's memory-hygiene step;
don't try to backfill retroactively outside the phase-close ritual.

### Legacy free-form memories (avoid unless Layer 1 doesn't fit)

Past Serena guidance suggested topic-tagged memories like `auth-flow`, `db-schema`,
`build-pipeline`, `external-integrations`. Those are still valid for **one-off
explorations** outside a phase boundary (e.g. a research spike), but for normal phase
work the three layers above are load-bearing:

- Content that was going into `auth-flow` → now lives inside `structure_and_layout`
  (where the module is) + `style_and_conventions` (the auth-boundary convention) +
  optionally a `decision_auth_provider_YYYY_MM_DD` memory if the vendor pick was
  non-obvious.
- Content that was going into `db-schema` → lives inside `structure_and_layout` + the
  seed's `schema.md` (source of truth) + decision memories for denormalization choices.
- Content that was going into `build-pipeline` → lives inside `suggested_commands` +
  `tech_stack`.

In other words: the three-layer model subsumes the old topic-tag table. Don't write
free-form memories that duplicate what the canonical six already cover — that's the
drift vector we're trying to eliminate.

---

## Onboarding ritual (run once per project; safe to re-run when stack changes)

```text
mcp__serena__onboarding
```

Walks Claude through writing the **six canonical memories** documented above:
`project_overview`, `tech_stack`, `suggested_commands`, `style_and_conventions`,
`task_completion_checklist`, `structure_and_layout`. Output lands under
`.serena/memories/`. After the ritual, `check_onboarding_performed` returns true on every
subsequent session.

The bootstrap step `6b` runs this automatically.

**Re-running onboarding mid-project**: safe and encouraged when the bootstrap-era
memories have drifted noticeably from reality (rare if the Layer 2 hygiene ritual is
being followed). The re-run **overwrites** the six canonical memories; any
`decision_*_YYYY_MM_DD` memories and session-scoped memories are left alone. Prefer a
targeted re-run (prompt: "Re-run Serena onboarding for this project — overwrite the
existing memories with fresh ones") over manual editing of all six.

---

## When NOT to use Serena

- Files outside the indexed project (returns empty — falls through to `Read`/`Grep`).
- Generated files / vendor directories / build outputs.
- Markdown / JSON / YAML / SQL config — no symbol tree exists; use `Read`.
- Trivial substring searches you already know the literal of — `Grep` is fine and cheaper.
- Anything in the seed/ or plans/ folders — those are docs, use `Read`.

---

## Per-language notes

Language servers backing Serena (verified via `serena project health-check`):

- **Python** — pyright (default) or pylsp; install in project venv.
- **TypeScript / JavaScript** — typescript-language-server; works on flat or workspace projects.
- **Go** — gopls; needs `GOPATH` and module mode.
- **Rust** — rust-analyzer; first index is slow (cargo metadata).
- **Java / Kotlin** — Eclipse JDT LS / kotlin-language-server.
- **C# / Dart / Swift / Ruby** — supported with their respective LS; check `health-check` output.

For monorepos with multiple languages, register each project root under `.serena/projects/`.

---

## How the phase plan and kickoff use this playbook

Every phase plan file (`plans/NNNN-phase-slug.md`, generated manually or via `/ultraplan`)
includes this preamble near the top:

```markdown
> **Serena-first.** Before any code exploration, read `serena-playbook.md` once per session.
> For every code-reading or code-editing decision in this phase, consult its decision matrix.
> Default: `get_symbols_overview` over `Read` for files > ~150 lines.
> For any rename or signature change planned by this phase, run `find_referencing_symbols`
> first and include the call sites in the plan.
```

This makes the symbol-first habit propagate into every phase without relying on Claude
"remembering" a generic rule from `CLAUDE.md`. The kickoff prompt includes the same preamble
when it drafts the Phase 0 plan, so the habit is set from the very first phase.

---

## Verification checklist (post-bootstrap)

Run after the bootstrap to confirm Serena is actually wired:

- [ ] `claude mcp list` shows `serena` (active)
- [ ] `.serena/project.yml` exists at project root
- [ ] `serena project health-check` is green (no missing LS)
- [ ] `.claude/settings.json` contains the Serena hooks (activate / remind / auto-approve / cleanup)
- [ ] `.serena/memories/` contains the six canonical memories after onboarding:
      `project_overview`, `tech_stack`, `suggested_commands`, `style_and_conventions`,
      `task_completion_checklist`, `structure_and_layout`.
- [ ] A fresh Claude session can answer "where does the auth flow live?" using only
      `mcp__serena__list_memories` + `mcp__serena__read_memory` + `mcp__serena__get_symbols_overview`
      — no full-file `Read`.
- [ ] The project's `CLAUDE.md` contains **both** the §Verification ritual memory-hygiene
      step (a blocker before the phase commit) **and** the §Mid-phase decision memories
      section. These encode the three-layer model so it survives across sessions.
- [ ] A dry-run of the four verification questions (see §Memories workflow — three-layer
      model → Verifying the discipline holds) can be answered from memory alone.

If the last three bullets fail, tighten the §Serena section in `CLAUDE.md`, re-confirm
the Serena-first preamble is present at the top of the current `plans/NNNN-phase-slug.md`,
and make sure the kickoff emitted the memory-hygiene ritual into the project `CLAUDE.md`
(it's part of the template since the first three-layer-model update — any pre-update project
can cherry-pick it from `SeedKit-v2/approaches/claude-code/CLAUDE.md`).
