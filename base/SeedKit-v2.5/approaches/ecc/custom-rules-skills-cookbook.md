# Custom Rules & Skills Cookbook

> Read by `kickoff-audit.md` Phase 3.5. After fingerprinting the seed, the audit must propose
> **new** project-specific rules / skills / agents / hooks the seed implies — not just classify
> what the harness already ships. This file is the catalogue of common patterns.

The audit copies the relevant rows below into its plan as proposals. The bootstrap then writes
each approved proposal into `.claude/` using the canonical Claude-Code frontmatter (verified via
context7 against `/anthropics/claude-code`).

---

## How auto-loading actually works

Per the official Claude-Code plugin docs (context7 `/anthropics/claude-code`):

- **Slash commands** live at `.claude/commands/<name>.md`. Frontmatter: `description`, `argument-hint`, `allowed-tools`. Invoked explicitly via `/<name>`.
- **Agents** live at `.claude/agents/<name>.md`. Frontmatter: `name`, `description`, `tools`, `model`. Spawned via the `Agent` tool with `subagent_type: <name>`.
- **Skills** live at `.claude/skills/<name>/SKILL.md`. Frontmatter: `name`, `description`, `version`. **The `description` field is what the model matches against user intent to decide auto-load.** A vague description = a skill that never fires.
- **Hooks** live at `.claude/hooks/hooks.json`. Events: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PreCompact`, `SessionStart`, `Stop`, `SessionEnd`. Each hook entry has a `matcher` (tool/pattern) and a `command`.
- **Rules** live at `.claude/rules/<domain>/<name>.md`. Loaded as part of the project context via `CLAUDE.md` or rule-imports — they are always-active guidance, not auto-loaded by intent.

Implication: a custom **rule** is the right shape for "always remember X about this project"; a custom **skill** is the right shape for "when the user is about to do X, load this playbook"; a custom **agent** is the right shape for "delegate this whole class of decision"; a custom **hook** is the right shape for "block / warn / log on this event automatically".

---

## Seed-signal → artifact mapping

For each row, the columns mean:

- **Seed signal** — what to look for in `seed/user-stories.md` / `seed/tech-stack.md` / `seed/domain.md` / `seed/creator-vision.md`.
- **Artifact type** — rule / skill / agent / hook (per the canonical Claude-Code shapes above).
- **Suggested path** — where the bootstrap writes it.
- **`description:` trigger** — the sentence that goes in the artifact's frontmatter so the model matches user intent (or, for rules, the one-line summary that goes in `CLAUDE.md`'s rules index).

| Seed signal                                                  | Artifact | Suggested path                                  | `description:` trigger                                                       |
|--------------------------------------------------------------|----------|-------------------------------------------------|------------------------------------------------------------------------------|
| Healthcare / clinical / EMR / PHI                            | rule     | `.claude/rules/healthcare/phi.md`               | "PHI handling, HIPAA, EMR/EHR safety, de-identification"                     |
| Payments / cards / PCI scope                                 | rule     | `.claude/rules/payments/pci-dss.md`             | "card data, PAN, CVV, payment processing, PCI scope"                         |
| Money math / FX / invoices                                   | skill    | `.claude/skills/currency-arithmetic/SKILL.md`   | "currency math: decimal precision, rounding, FX, money formatting"           |
| Multi-region UI / translations                               | skill    | `.claude/skills/i18n-l10n/SKILL.md`             | "internationalization: ICU messages, locales, RTL, plurals, dates"           |
| Accessibility-first product                                  | rule     | `.claude/rules/web/accessibility.md`            | "WCAG 2.2 AA, ARIA roles, keyboard nav, contrast, screen-reader testing"     |
| EU users / GDPR / data subject rights                        | rule     | `.claude/rules/privacy/gdpr.md`                 | "personal data, lawful basis, retention, right to erase, DPIA"               |
| Multi-tenant SaaS / row-level isolation                      | rule     | `.claude/rules/architecture/tenancy.md`         | "tenant scoping, RLS, isolation, cross-tenant leak prevention"               |
| Append-only ledger / audit log / event-sourced               | rule     | `.claude/rules/data/append-only.md`             | "ledger immutability, append-only writes, audit trail, no destructive update" |
| Global users / scheduling / DST                              | skill    | `.claude/skills/timezones/SKILL.md`             | "time zones, DST transitions, scheduling across regions, UTC discipline"     |
| Reverse-engineering an external app (spider / capture)       | skill    | `.claude/skills/reference-capture/SKILL.md`     | "capture, snapshot, record screen of external app — Playwright spider"       |
| LLM in product (prompts, eval, cost)                         | rule     | `.claude/rules/ai/llm-product-discipline.md`    | "prompt versioning, eval harness, cost ceilings, fallback model"             |
| Real-time / WebSocket / presence                             | rule     | `.claude/rules/realtime/messaging.md`           | "websocket lifecycle, reconnection, backpressure, presence semantics"        |
| Heavy media (video / audio pipelines)                        | skill    | `.claude/skills/media-pipelines/SKILL.md`       | "video / audio pipeline: ffmpeg, transcoding, encoding ladders"              |
| Strict supply-chain / SBOM                                   | hook     | `.claude/hooks/hooks.json` (PreToolUse Bash)    | "block `npm install` / `pip install` without lockfile change in same commit"  |
| Conventional commits enforced                                | hook     | `.claude/hooks/hooks.json` (PreToolUse Bash git)| "block `git commit` whose message doesn't match conventional-commit regex"   |
| Schema migrations always reviewed                            | agent    | `.claude/agents/database-reviewer.md`           | "review every migration for safety: locking, backfills, downtime, RLS"       |
| Secrets in code is a recurring risk                          | hook     | `.claude/hooks/hooks.json` (PostToolUse Edit)   | "scan diffs for high-entropy strings; block on hit"                          |
| Domain language is non-trivial (DDD)                         | rule     | `.claude/rules/domain/ubiquitous-language.md`   | "approved nouns/verbs, forbidden synonyms, glossary citations"               |

The list is illustrative, not exhaustive. The audit may invent rows of its own — the same shape applies.

---

## How to write a new entry (per Claude-Code canonical schema)

### Skill (`.claude/skills/<kebab-name>/SKILL.md`)

```markdown
---
name: <kebab-name>
description: <one-sentence trigger — auto-load fires when user intent matches this sentence>
version: 0.1.0
---

# <Title>

## When to use
- <bullet of trigger situations>

## When NOT to use
- <bullet of false positives>

## Playbook
1. <step>
2. <step>
3. <step>

## References
- <links to seed sections, related rules, related skills>
```

The `description` field is the single most important line. Write it as a sentence the user might
plausibly say or imply. Vague descriptions = silent skills.

### Rule (`.claude/rules/<domain>/<name>.md`)

```markdown
# <Title>

## Why this rule exists
<one paragraph: which seed section made this non-negotiable>

## What is required
- <bullet>
- <bullet>

## What is forbidden
- <bullet>
- <bullet>

## How a reviewer checks
- <step a code-reviewer agent / human follows>
```

Rules are not auto-loaded by intent — they're loaded as part of always-on context via `CLAUDE.md`.
The bootstrap must add a one-line entry to `CLAUDE.md`'s "Custom rules & skills" section so future
sessions know the rule exists.

### Hook (added to `.claude/hooks/hooks.json`)

```jsonc
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node .claude/scripts/hooks/<your-hook>.js" }
        ]
      }
    ]
  }
}
```

The hook script lives under `.claude/scripts/hooks/`. Keep it small, fast, deterministic.
It must exit 0 to allow the tool, non-zero to block, and print a one-line reason on stderr.

### Agent (`.claude/agents/<name>.md`)

```markdown
---
name: <name>
description: <when to spawn this agent — written in the third person so the orchestrator can decide>
tools: Read, Grep, Glob, Bash
model: sonnet
---

# <Title>

You are <role>. You specialize in <scope>.

## Inputs
- <what the orchestrator gives you>

## Process
1. <step>
2. <step>

## Output
- <what you return>
```

---

## Where this file is consumed

- `kickoff-audit.md` Phase 3.5 — the audit reads this catalogue and proposes matching rows for the project.
- `kickoff-bootstrap.md` Step 6 — the bootstrap writes each approved proposal into `.claude/` and indexes it in `CLAUDE.md`.
- Future `/learn` runs may append new rows when a recurring pattern emerges.
