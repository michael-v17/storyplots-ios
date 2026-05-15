# Plugins smoke test — 2026-04-15

Purpose: prove the 6 enabled plugins listed in [.claude/settings.json](../.claude/settings.json) are invocable end-to-end, not just "enabled" in `/plugin`.

## Environment before the test

- Deleted legacy [.mcp.json](../.mcp.json) (was duplicating the playwright MCP that the plugin already provides, plus an unused figma HTTP MCP).
- Removed `mcp__figma__*` from `permissions.allow` in [.claude/settings.json](../.claude/settings.json) (no figma plugin installed).
- Kept `mcp__playwright__*` and `mcp__context7__*` in the allow list — the plugins use them.

## Plugin inventory (discovered from `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/`)

| Plugin | Invocation surface |
|---|---|
| `feature-dev` | slash command `/feature-dev` (`plugins/feature-dev/commands/feature-dev.md`) |
| `code-review` | slash command `/code-review` (`plugins/code-review/commands/code-review.md`) |
| `code-simplifier` | subagent `code-simplifier` (`plugins/code-simplifier/agents/code-simplifier.md`) |
| `frontend-design` | skill `frontend-design` (`plugins/frontend-design/skills/frontend-design`) |
| `context7` | MCP — tools namespace `mcp__context7__*` |
| `playwright` | MCP — tools namespace `mcp__playwright__*` |

## Results

### ✅ `playwright` — PASS

Executed the smoke test directly from this session:

```
mcp__playwright__browser_navigate  url=about:blank   → OK
mcp__playwright__browser_snapshot                    → OK (empty yaml, expected for about:blank)
mcp__playwright__browser_close                       → OK
```

Browser automation is live. A side-effect directory `.playwright-mcp/` was created at the project root — safe to add to `.gitignore` once the repo is initialized.

### 🟡 `context7` — CONNECTED (per `/plugin`), not invoked in this session

`/plugin` UI reports `context7 MCP · connected`. The MCP tools (`mcp__context7__resolve-library-id`, `mcp__context7__get-library-docs`) are not surfaced in the current agent session's tool catalog, so a direct smoke call was not possible from here. This is a session-scope limitation, not a plugin failure — the MCP connection itself is live.

**To complete the verification**, in a normal interactive Claude Code session run:

> "Use context7 to resolve the library id for `supabase` and fetch a short doc snippet."

Expect: Claude returns a Context7 library ID and a docs excerpt. If it falls back to web search or says the tool is unavailable, treat as FAIL and surface.

### 🟡 `feature-dev`, `code-review` — slash commands present, not invoked in this session

Command files exist on disk (see inventory above). The `SlashCommand` tool is not loaded in this agent session, so these cannot be smoke-tested from here.

**To complete the verification**, in a normal interactive session run:

- `/feature-dev describe what this plugin does` → expect a structured response describing the plugin's workflow.
- `/code-review` (with [CLAUDE.md](../CLAUDE.md) or any small file as target) → expect review output.

### 🟡 `code-simplifier` — subagent present, not invoked in this session

The subagent definition exists at `plugins/code-simplifier/agents/code-simplifier.md`, but `code-simplifier` is not in this session's exposed `subagent_type` list (only `general-purpose`, `Explore`, `Plan`, `statusline-setup`, `claude-code-guide` are available to the current meta-agent).

**To complete the verification**, in a normal interactive session:

> "Run the code-simplifier on [CLAUDE.md](../CLAUDE.md)."

Or invoke the `simplify` skill surface. Expect: a simplification pass or a "nothing to simplify" result.

### 🟡 `frontend-design` — skill present, not invoked in this session

Skill exists at `plugins/frontend-design/skills/frontend-design/`, but the `frontend-design` skill name is not in this session's `Skill` tool catalog.

**To complete the verification**, in a normal interactive session:

> "Use the frontend-design skill to sketch an empty-state treatment for [Seed/ux.md](../Seed/ux.md)'s Conversations list."

Expect: structured frontend-design output. If the skill is unavailable, treat as FAIL.

## Root-cause diagnosis — why only `playwright` surfaced in this session

All 6 plugins are correctly **installed** and their MCPs are **running**. Evidence:

- [~/.claude/plugins/installed_plugins.json](~/.claude/plugins/installed_plugins.json) lists every plugin under `claude-plugins-official` at both local and project scopes with valid `installPath`s.
- `ps aux` shows `npm exec @upstash/context7-mcp` (context7) and `npm exec @playwright/mcp@latest` (playwright, plugin) both running. The pre-existing `npm exec @playwright/mcp --browser chrome` (from the deleted [.mcp.json](../.mcp.json)) was also still alive at diagnosis time.
- Plugin manifests are valid: `external_plugins/context7/.mcp.json` and `external_plugins/playwright/.mcp.json` declare their `npx` spawn commands; the four other plugins declare commands/agents/skills in the marketplace.

Why the agent sub-session running this smoke test only sees `playwright` tools in its catalog:

- The sub-session's tool catalog is **fixed at session init** and does not refresh when plugins change state.
- `playwright` MCP tools were catalogued because the project had them declared in [.mcp.json](../.mcp.json) at session start (and still had `mcp__playwright__*` in `permissions.allow`).
- `context7` MCP tools were never catalogued into this sub-session because they only come from the plugin, and plugin-only MCPs aren't visible to this agent meta-layer.
- Plugin **slash commands** (`/code-review`, `/feature-dev`), **subagents** (`code-simplifier`), and **skills** (`frontend-design`) are surfaced to the **interactive Claude Code CLI**, not to this agent sub-session's tool catalog.

Net effect: this is a **sub-session catalog limitation**, not a plugin installation failure.

## Summary (post-reload, 2026-04-15)

After restarting the Claude Code session the plugin MCPs re-registered under a `mcp__plugin_<name>_<name>__*` namespace, which made them directly callable from this agent layer.

| Plugin | Installation | Smoke test | Status |
|---|---|---|---|
| `playwright` | ✅ | `mcp__plugin_playwright_playwright__browser_navigate` → `about:blank` → `browser_close` | ✅ PASS |
| `context7` | ✅ | `mcp__plugin_context7_context7__resolve-library-id` with `Supabase` → returned `/supabase/supabase` + 4 related IDs with Code Snippets, Source Reputation, Benchmark Score | ✅ PASS |
| `feature-dev` | ✅ | Slash command — not exposed to this agent layer | 🟡 Interactive check needed |
| `code-review` | ✅ | Slash command — not exposed to this agent layer | 🟡 Interactive check needed |
| `code-simplifier` | ✅ | Subagent — not in this layer's `subagent_type` catalog | 🟡 Interactive check needed |
| `frontend-design` | ✅ | Skill — not in this layer's skill catalog | 🟡 Interactive check needed |

No FAIL results. Only one plugin — `playwright` — was directly exercised end-to-end from this sub-session (PASS). The other five require a brief check from a normal interactive Claude Code prompt. Run the prompts above, and if anything misbehaves, update this note with the failure and surface to the creator before the first `/ultraplan` cycle.

## Recommended next step before the first `/ultraplan` cycle

Reload the Claude Code session (restart VSCode extension or run `/clear`) so the freshly-cleaned config takes effect:

- [.mcp.json](../.mcp.json) is gone → no more duplicate `playwright MCP` at project level.
- `mcp__figma__*` permission removed → no dead permission.
- Plugin-provided MCPs will be the sole source for `playwright` and `context7`.

After the reload, run the 5 interactive smoke prompts above and tick them off here.
