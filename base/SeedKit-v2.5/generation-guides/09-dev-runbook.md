# Generation Guide: dev-runbook.md

## 1. When to include

**Always.** It is one of the most critical files for the AI's autonomous operation. Without it, the AI cannot start or restart development services — the creator has to do it manually before each session, which destroys the feedback loop.

> **Position note:** `dev-runbook.md` lives in the **project root**, not inside `seed/`. It is generated during the **framework kickoff** (Layer 4), after the seed is complete — not during seed authoring. This guide exists here because it is critical and because its quality depends directly on how well `seed/tech-stack.md` §Dev services is documented.

---

## 2. Prerequisites

These must exist and be **approved** before generating this file:

- [ ] `seed/tech-stack.md` ✓ approved — **especially the §Dev services section** (services table with commands, ports, health checks). Without that section, the runbook cannot be concrete.
- [ ] The complete seed (the 5 spark files) — the kickoff generates the runbook as part of the initial bootstrap

**Critical prerequisite in tech-stack.md:**
The "Dev services" section of `tech-stack.md` (see guide `03-tech-stack.md`) must have for each service:
- Service name
- Exact start command
- Port it runs on
- Health check command that returns a verifiable response
- Where the logs are

If `tech-stack.md` does not have that table, the generated runbook will be generic and useless.

---

## 3. Session opening prompt

This prompt is used in the **framework kickoff** session (the first session after the seed is complete):

```
We are going to generate dev-runbook.md in the project root. This file tells the AI
exactly how to start, verify, restart, and clean up all development services. The AI
will read this file at the start of each session and use it to manage the development
environment autonomously.

Read the following file before starting:
1. seed/tech-stack.md  — especially the "Dev services" section with the services table

Produce dev-runbook.md with this structure:
- Services table: name / start command / port / health check / logs
- How the AI starts the full stack at session start
  (each service with run_in_background=true; never in foreground)
- How to restart a specific service (kill + re-run)
- How to clear ports occupied by previous sessions
- What the AI manages and what it does NOT manage (secrets, cloud setup, production)
- What to do if a service fails 3 times in a row (escalate to creator)

CRITICAL RULES:
- All services are started in background (run_in_background=true)
- NEVER foreground — a foreground process blocks the conversation
- After starting each service, wait for the health check to respond
  before starting the next one
- If the health check does not respond in 15 seconds → retry once; then escalate
- Commands must be exact and complete (not "npm start" but the real command with flags)
- Include how the AI reads logs after starting (BashOutput(id) for the background process)
```

---

## 4. Extraction map

### From `seed/tech-stack.md` §Dev services

This is the **only required source** for generating the runbook. If the section is well written, the runbook is generated in a single pass.

Extract:
- The services table (name, command, port, health check, logs)
- The startup order if there are dependencies (e.g.: DB must be ready before the backend)
- Any flag or environment variable required for local development (e.g.: `NODE_ENV=development`)
- The package manager and workspace structure (pnpm, npm workspaces, monorepo)

---

## 5. Required output structure

### 5.1 Services table

```markdown
## Services

| Service | Start command | Port | Health check | Logs |
|---|---|---|---|---|
| Frontend (Vite) | `pnpm --filter frontend dev` | 5173 | `curl -s localhost:5173 → HTML` | process stdout |
| Backend (Hono) | `pnpm --filter api dev` | 3000 | `curl localhost:3000/health → {"status":"ok"}` | process stdout |
| Supabase local | `supabase start` | 54321 | `supabase status → Active` | supabase logs |
```

### 5.2 How the AI starts the stack

Step-by-step sequence the AI executes at the start of each session:

```markdown
## Startup sequence (run at session start)

1. Start Supabase local:
   `supabase start` — run_in_background=true
   Wait for: `curl localhost:54321/rest/v1/ → 200` (timeout 30s)

2. Start backend:
   `pnpm --filter api dev` — run_in_background=true
   Wait for: `curl localhost:3000/health → {"status":"ok"}` (timeout 15s)

3. Start frontend:
   `pnpm --filter frontend dev` — run_in_background=true
   Wait for: `curl -s localhost:5173 → HTML` (timeout 15s)

4. Verify all three are healthy before proceeding.
   If any fails health check after 15s → restart once → if still failing, stop and tell the creator.
```

**Absolute rule**: all processes with `run_in_background=true`. Never foreground.

### 5.3 How to restart a service

```markdown
## Restarting a service

To restart the backend:
1. Find the process: `lsof -ti:3000` (returns PID)
2. Kill it: `kill -9 <PID>` (or use KillShell(id) if started with run_in_background)
3. Re-run: `pnpm --filter api dev` — run_in_background=true
4. Wait for health check before continuing

To restart the frontend:
1. KillShell(id) the frontend process
2. Re-run: `pnpm --filter frontend dev` — run_in_background=true
3. Wait for health check
```

### 5.4 How to clear occupied ports

```markdown
## Clearing stuck ports (from a previous session)

If a port is already in use when starting a service:
- Port 5173 (frontend): `lsof -ti:5173 | xargs kill -9`
- Port 3000 (backend): `lsof -ti:3000 | xargs kill -9`
- Port 54321 (Supabase): `supabase stop` then `supabase start`

Run this if a service fails to start with "address already in use".
```

### 5.5 How to read logs

```markdown
## Reading logs

After starting a service with run_in_background=true, Claude receives a process ID.
To read its output: BashOutput(id)

Read logs after:
- Starting a service (to confirm it started without errors)
- After a failed health check (to diagnose the problem)
- When the creator reports unexpected behavior
```

### 5.6 What the AI manages vs what it does NOT

```markdown
## What Claude manages vs does NOT manage

**Claude manages:**
- Starting all local dev services at session start
- Restarting services when they fail or need a code reload
- Clearing stuck ports
- Reading service logs for diagnosis

**Claude does NOT manage:**
- `.env` file — copy `.env.example` to `.env` and fill in real values before the first session; Claude never reads or writes secrets
- Supabase project creation or cloud setup — one-time manual setup
- Database migrations — the creator runs `supabase db push` explicitly
- Production deploys — outside the scope of dev sessions
- npm/pnpm install of new packages without creator approval
```

### 5.7 Escalation rule

```markdown
## Escalation rule

If a service fails its health check after 2 restarts:
- Stop trying
- Report to the creator: which service, the exact error from logs, what was attempted
- Do NOT proceed with development until the service is healthy

This prevents a cascade where Claude works for 30 minutes on broken infrastructure.
```

---

## 6. Quality gates before approving

- [ ] Each service in the project has its row in the services table
- [ ] The startup sequence has an explicit health check for each service (not just "wait X seconds")
- [ ] All start commands use `run_in_background=true` (not foreground)
- [ ] There is a "how to read logs" section with `BashOutput(id)`
- [ ] There is a "What Claude does NOT manage" section with `.env`, secrets, and production
- [ ] There is an escalation rule for when services fail
- [ ] Commands are exact and complete (not generic like "start the server")
- [ ] Health check commands return a verifiable response (not just HTTP 200 — specify the expected body)

---

## 7. Common failure modes

**1. Generic commands instead of concrete ones**
The AI writes "start the development server" instead of `pnpm --filter api dev`. Detect: look for instructions without the exact command. Solution: each step of the startup sequence must have the literal, copy-pasteable, executable command.

**2. Omitting health checks per service**
The AI writes "start all services and wait" without verifying each one. Consequence: the AI assumes services are ready when they are actually crashing in the background, and then development errors look like code bugs when they are infrastructure problems. Detect: verify that each service in the startup sequence has its own health check command. Solution: add health check per service before approving.

**3. Services in foreground**
The AI writes `pnpm dev` without `run_in_background=true`. A foreground process blocks the conversation — Claude cannot do anything else while the server is running. Detect: look for start commands without the run_in_background note. Solution: all long-running services go in background.

**4. Absence of "What Claude does NOT manage" section**
Without this section, the AI attempts to manage secrets, migrations, or deploys and breaks things the creator did not expect it to touch. Detect: verify that the section exists with the critical items (`.env`, secrets, explicit migrations, production). Solution: add it before approving.

**5. Not documenting how to read logs**
The AI starts services in background but has no instructions for reading their output. Consequence: when a service fails silently, Claude cannot diagnose it without the creator saying "read the log with BashOutput". Detect: verify that the "Reading logs" section exists with the `BashOutput(id)` instruction. Solution: add it before approving.

**6. Generic runbook because tech-stack.md §Dev services was empty**
This is the most common failure and the hardest to detect after the fact. If `tech-stack.md` did not have the services table with exact commands, the AI invented generic commands that probably do not work. Detect: compare each command in the runbook against the services table in `tech-stack.md`. If they do not match, there is invention. Solution: complete `tech-stack.md` §Dev services first and regenerate the runbook.
