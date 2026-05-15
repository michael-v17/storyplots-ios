# Preflight pattern — fast, safe validation before any work

Project-agnostic pattern for a single-command check that every developer (or agent)
runs at session start to confirm the local machine is actually ready:

1. The tools pinned in `seed/tech-stack.md` are installed and on PATH.
2. `.env.local` exists and has every variable name listed in `.env.example`.
3. Opaque credentials (API keys, JWTs, tokens) have the expected shape and
   length — without ever printing the values.
4. The project's external services are reachable with the credentials in
   `.env.local`.
5. Non-secret fingerprints (first N + last M chars) are printed so the reader
   can cross-check against the provider's dashboard.

The bootstrap emits two equivalent implementations — `preflight.ps1` (PowerShell,
Windows) and `preflight.sh` (bash, macOS/Linux/WSL/Git-Bash) — so whichever
terminal the developer is in, the same checklist runs.

**The preflight never prints secret values.** Shape, length, prefix (≤ 3 chars),
and fingerprint (`first 8…last 4`) are safe. Anything else gets compared with
`diff` / `awk` / `Where-Object` but never echoed.

---

## Why this pattern exists

Three real failure modes it catches before the developer wastes an hour:

- **Tools missing or wrong version** — `pnpm` not on PATH because Corepack
  wasn't activated; Python CLI installed globally but for the wrong Python;
  the cloud CLI pinned in the seed is absent. Every `pnpm install` /
  `make test` / `cargo build` in the plan depends on these.
- **`.env.local` drift from `.env.example`** — a new required variable was
  added to the template but the developer's local copy is stale. Runtime
  errors surface hundreds of requests later; preflight surfaces them in one
  command.
- **Cloud-provider auth shape evolved after the seed was written** — e.g.
  Supabase's new short-key format (`sb_publishable_*` / `sb_secret_*`) rejects
  the legacy `apikey`-only header shape and requires both `apikey` and
  `Authorization: Bearer`. If `seed/tech-stack.md` was authored before that
  change, its health-check curl returns `401` with valid keys, confusing
  everyone. Preflight runs the *actually-current* curl, flags the seed drift,
  and points at the OQ workflow below.

---

## What preflight MUST check (project-agnostic)

The shape emitted by the bootstrap is identical across projects; the *contents*
of each section are filled from `seed/tech-stack.md`.

### Section 1 — Tools

For every tool pinned in `seed/tech-stack.md §1 (pinned dependencies)`:

- Runtime(s) — Node / Python / Go / Rust / ...
- Package manager — pnpm / npm / uv / cargo / ...
- Cloud provider CLIs — Supabase / gcloud / aws / fly / ...
- Language-specific build tooling — tsc / ruff / rustc / ...

Print the version string (not the full path). Failures here block all other
sections — a missing runtime makes the rest of the checks irrelevant.

### Section 2 — Files

Check presence (not contents) of:

- `.env.example`, `.env.local`
- `package.json`, `pnpm-lock.yaml` / `uv.lock` / `Cargo.lock` / `go.sum`
- Any project-root directory that the seed promises will exist by Phase 1
  (e.g. `supabase/`, `migrations/`, `infra/`)

"MISSING" is expected for some files pre-Phase-1 and not a failure signal —
preflight is diagnostic, not a gate.

### Section 3 — `.env` parity

Extract the variable **names** (not values) from `.env.example` and `.env.local`
and diff them. Report `missing` / `extra` sets. Use line-level regex that
tolerates quoted values, whitespace, and comments — never read the values
into memory as a string you might accidentally print.

### Section 4 — Shape checks

For every credential in `.env.local`:

- **URL-shaped values** — does it match the expected host pattern
  (e.g. `^https://[a-z0-9]+\.supabase\.co/?$` for Supabase)?
  Is it still the placeholder that ships in `.env.example`
  (e.g. `your-project-ref`, `REPLACE_ME`)?
- **Opaque keys / tokens** — what is the prefix (first 3 chars)? What is
  the length? Accept **multiple** formats if the provider supports both
  legacy and modern (e.g. Supabase accepts legacy JWTs and new
  `sb_publishable_*` / `sb_secret_*` keys — preflight must not fail on
  either).
- **Invisible characters** — trailing CR/LF, inner whitespace, BOM at
  position 0. These are the #1 cause of "keys look right but server rejects
  them" on Windows copy-paste. Detect; don't print.

### Section 5 — Reachability

Hit one endpoint per external service with the credential from `.env.local`.
Prefer an endpoint that:

- Returns **200** with a valid key and **401** with an invalid key (clear
  signal), **not** one that returns 200 anonymously.
- Is stable across provider versions (e.g. Supabase's
  `/auth/v1/settings` works on both legacy-key and new-key projects).
- Is read-only — never a write endpoint, never one that triggers side
  effects.

Send **every header the provider documents as required**, even if historical
curls omitted one. When in doubt, send both `apikey: <key>` and
`Authorization: Bearer <key>` — modern API gateways (Supabase, Neon, Upstash,
many others) require this pair.

If any field in sections 1–4 was missing or placeholder, **skip** reachability
rather than hammer the endpoint with a known-bad key. Print "SKIPPED — fix env
first" instead of a failure.

### Section 6 — Fingerprints

For every opaque credential, print a non-secret fingerprint:
`<first 8 chars>......<last 4 chars>`. Plus the URL-derived project ref or
account id. Three sentences for the reader:

> Cross-check these against the provider's dashboard. If the reference/id
> doesn't match the project you think you're connecting to, the URL and key
> are from different environments. If the fingerprint doesn't match the key
> shown in the dashboard, the value in `.env.local` is stale.

Fingerprints are safe — an 8-char prefix + 4-char suffix out of a long random
string has no brute-force value. The middle (~hundreds of random chars) stays
secret.

---

## What the preflight skips (on purpose)

- **Semantic validity of keys** — a 46-char `sb_publishable_xxx` that's a
  perfectly-shaped string but was revoked last week will fail reachability;
  that's the right place to catch it. Shape checks don't re-derive the
  provider's JWT signature.
- **Latency / performance** — that belongs in the runbook's health-check
  monitoring, not in a 5-second preflight.
- **Migrations / schema state** — that's a phase-level concern, not a
  per-session one. Preflight doesn't talk to the DB beyond auth.
- **Everything in `.git/`** — preflight is a local-dev tool. CI has its own
  equivalents.

---

## Cloud-provider auth drift — the OQ workflow

When preflight surfaces a discrepancy between a health check that `seed/`
documents and the actual-current provider behavior:

1. **Fix `dev-runbook.md` immediately.** The runbook is at the project root,
   outside `seed/`, and is editable without creator approval. Replace the
   stale curl with the working one. Add a parenthetical noting the
   discrepancy with the seed and which `seed/…` sections contain the stale
   version.

2. **Append an entry to `seed/open-questions.md`** using the shape
   prescribed in `CLAUDE.md §Mid-phase decision memories`. Example:

   ```markdown
   ## OQ-PREFLIGHT-01 — Supabase health check requires Bearer header on new-key projects

   **Surfaced:** 2026-04-22 during Phase 1 preflight.
   **Seed impact:** `seed/tech-stack.md §1` + `seed/roadmap.md` Phase 0 both
     document the legacy single-header curl; on new-key projects it returns
     `401` despite valid credentials.

   **Committed default (applied in `dev-runbook.md`):**
     `curl -sf "$URL/auth/v1/settings" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"`
     hits `200` on both legacy and new-key projects.

   **Seed update needed:** creator to approve one edit to `seed/tech-stack.md §1`
     and one to `seed/roadmap.md` Phase 0 replacing the legacy curl with the
     above shape.
   ```

3. **Update the corresponding Serena memory** — usually
   `suggested_commands` — so the next session starts from the corrected
   command. Follow the memory-hygiene step in
   `CLAUDE.md §Verification ritual`.

4. **Leave the seed files untouched** until the creator approves. Per
   `CLAUDE.md §Guardrails` "Seed is read-only", a PR is required for any
   `seed/` edit beyond `open-questions.md`.

This is the general seed-drift pattern: editable files absorb the fix now;
the OQ is the audit trail; the seed catches up on the next creator review.

---

## Templates

The bootstrap generates these from `seed/tech-stack.md`. The templates below
are the canonical shape — a project-specific preflight fills the
`# PROJECT-SPECIFIC:` markers with the project's actual tools, env vars, and
endpoints.

### PowerShell template (`preflight.ps1`)

```powershell
# preflight.ps1 — <PROJECT_NAME> tooling + .env.local sanity check
# Run from repo root: pwsh ./preflight.ps1
# Never prints secret values — only shape/length/booleans/fingerprints.

$ErrorActionPreference = 'Continue'

Write-Host "`n=== <PROJECT_NAME> preflight ===" -ForegroundColor Cyan
Write-Host "CWD: $PWD"

# --- 1. Tools (PROJECT-SPECIFIC: add one line per tool from seed/tech-stack.md §1) ---
Write-Host "`n--- tools ---" -ForegroundColor Yellow
Write-Host "node    : $(node --version 2>&1)"
Write-Host "pnpm    : $(pnpm --version 2>&1)"
# Write-Host "python  : $(python --version 2>&1)"
# Write-Host "go      : $(go version 2>&1)"
# Write-Host "<cloud> : $(<cloud-cli> --version 2>&1)"

# --- 2. Files (PROJECT-SPECIFIC: add files the seed promises) ---
Write-Host "`n--- files ---" -ForegroundColor Yellow
foreach ($f in '.env.example', '.env.local', 'package.json', 'pnpm-lock.yaml') {
    $state = if (Test-Path $f) { 'present' } else { 'MISSING' }
    Write-Host ("{0,-18} {1}" -f $f, $state)
}

# --- 3. Parse .env.local (no values ever printed) ---
$env_vars = @{}
if (Test-Path .env.local) {
    Get-Content .env.local | ForEach-Object {
        if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$') {
            $env_vars[$matches[1]] = $matches[2].Trim('"').Trim("'")
        }
    }
}

# --- 4. .env parity ---
Write-Host "`n--- .env parity ---" -ForegroundColor Yellow
$example_keys = @()
if (Test-Path .env.example) {
    $example_keys = Get-Content .env.example |
        Where-Object { $_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=' } |
        ForEach-Object { ($_ -split '=')[0].Trim() }
}
$missing = $example_keys | Where-Object { $_ -notin $env_vars.Keys }
$extra   = $env_vars.Keys | Where-Object { $_ -notin $example_keys }
Write-Host ("missing : {0}" -f $(if ($missing) { $missing -join ', ' } else { 'none' }))
Write-Host ("extra   : {0}" -f $(if ($extra)   { $extra   -join ', ' } else { 'none' }))

# --- 5. Shape checks (PROJECT-SPECIFIC: replace with your service's URL + key shape) ---
Write-Host "`n--- shape checks ---" -ForegroundColor Yellow
$url  = ([string]$env_vars['<PRIMARY_URL_VAR>']).Trim().TrimEnd('/')
$key  = ([string]$env_vars['<PRIMARY_KEY_VAR>']).Trim()

$cloudShape = $url -match '<URL_REGEX — e.g. ^https://[a-z0-9]+\.supabase\.co/?$>'
$stillPlaceholder = ($url -match '<PLACEHOLDER_URL>') -or ($key -match '<PLACEHOLDER_KEY>')
$keyHasCR = $key -match "`r"; $keyHasLF = $key -match "`n"
$keyFormat = if     ($key -match '^<LEGACY_PREFIX>' -and $key.Length -gt 100) { 'legacy' }
             elseif ($key -match '^<NEW_PREFIX>')                             { 'modern' }
             else                                                             { 'UNKNOWN' }

Write-Host ("URL cloud-shaped      : {0}" -f $cloudShape)
Write-Host ("URL placeholder       : {0}" -f $stillPlaceholder)
Write-Host ("KEY format            : {0}  (len={1}, cr={2}, lf={3})" -f $keyFormat, $key.Length, $keyHasCR, $keyHasLF)

# --- 6. Fingerprints (safe) ---
function Get-Fingerprint([string]$s) {
    if ([string]::IsNullOrEmpty($s) -or $s.Length -lt 12) { return '(too short)' }
    return $s.Substring(0,8) + '......' + $s.Substring($s.Length - 4)
}
Write-Host ("KEY fingerprint       : {0}" -f (Get-Fingerprint $key))

# --- 7. Reachability (PROJECT-SPECIFIC: pick stable endpoint + send all documented headers) ---
Write-Host "`n--- reachability ---" -ForegroundColor Yellow
if ($cloudShape -and -not $stillPlaceholder -and $keyFormat -ne 'UNKNOWN') {
    try {
        $resp = Invoke-WebRequest `
            -Uri "$url/<HEALTH_PATH — e.g. /auth/v1/settings>" `
            -Headers @{ apikey = $key; Authorization = "Bearer $key" } `
            -UseBasicParsing -TimeoutSec 10
        Write-Host ("HTTP {0}  (expected 200)" -f $resp.StatusCode) -ForegroundColor Green
    } catch {
        $code = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { $null }
        Write-Host ("HTTP {0}  ERROR: {1}" -f $code, $_.Exception.Message) -ForegroundColor Red
    }
} else {
    Write-Host "SKIPPED — URL/keys invalid. Fix .env.local first." -ForegroundColor Red
}

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
```

### Bash template (`preflight.sh`)

```bash
#!/usr/bin/env bash
# preflight.sh — <PROJECT_NAME> tooling + .env.local sanity check
# Run from repo root: ./preflight.sh
# Never prints secret values — only shape/length/booleans/fingerprints.

set -uo pipefail

printf '\n=== <PROJECT_NAME> preflight ===\n'
printf 'CWD: %s\n' "$PWD"

# --- 1. Tools (PROJECT-SPECIFIC) ---
printf '\n--- tools ---\n'
printf 'node    : %s\n' "$(node --version 2>&1 || echo MISSING)"
printf 'pnpm    : %s\n' "$(pnpm --version 2>&1 || echo MISSING)"
# printf 'python  : %s\n' "$(python --version 2>&1 || echo MISSING)"

# --- 2. Files ---
printf '\n--- files ---\n'
for f in .env.example .env.local package.json pnpm-lock.yaml; do
    if [ -e "$f" ]; then printf '%-18s present\n' "$f"
    else                 printf '%-18s MISSING\n' "$f"
    fi
done

# --- 3. Parse .env.local keys only ---
declare -A ENV_VARS=()
if [ -f .env.local ]; then
    while IFS= read -r line; do
        if [[ $line =~ ^[[:space:]]*([A-Z_][A-Z0-9_]*)[[:space:]]*=[[:space:]]*(.*)$ ]]; then
            val="${BASH_REMATCH[2]}"
            val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
            ENV_VARS[${BASH_REMATCH[1]}]="$val"
        fi
    done < .env.local
fi

# --- 4. .env parity ---
printf '\n--- .env parity ---\n'
EXAMPLE_KEYS=()
if [ -f .env.example ]; then
    while IFS= read -r line; do
        if [[ $line =~ ^[[:space:]]*([A-Z_][A-Z0-9_]*)[[:space:]]*= ]]; then
            EXAMPLE_KEYS+=("${BASH_REMATCH[1]}")
        fi
    done < .env.example
fi
missing=()
for k in "${EXAMPLE_KEYS[@]}"; do [[ -v ENV_VARS[$k] ]] || missing+=("$k"); done
extra=()
for k in "${!ENV_VARS[@]}";     do [[ " ${EXAMPLE_KEYS[*]} " == *" $k "* ]] || extra+=("$k"); done
printf 'missing : %s\n' "${missing[*]:-none}"
printf 'extra   : %s\n' "${extra[*]:-none}"

# --- 5. Shape checks (PROJECT-SPECIFIC) ---
printf '\n--- shape checks ---\n'
url="${ENV_VARS[<PRIMARY_URL_VAR>]:-}"
key="${ENV_VARS[<PRIMARY_KEY_VAR>]:-}"
url="${url%/}"
[[ "$url" =~ <URL_REGEX> ]] && cloud=true || cloud=false
[[ "$url" == *"<PLACEHOLDER_URL>"* || "$key" == *"<PLACEHOLDER_KEY>"* ]] && placeholder=true || placeholder=false
fmt="UNKNOWN"
[[ "$key" == <LEGACY_PREFIX>* && ${#key} -gt 100 ]] && fmt="legacy"
[[ "$key" == <NEW_PREFIX>* ]]                       && fmt="modern"
printf 'URL cloud-shaped      : %s\n' "$cloud"
printf 'URL placeholder       : %s\n' "$placeholder"
printf 'KEY format            : %s (len=%s)\n' "$fmt" "${#key}"

# --- 6. Fingerprint (safe) ---
if [ "${#key}" -ge 12 ]; then
    printf 'KEY fingerprint       : %s......%s\n' "${key:0:8}" "${key: -4}"
fi

# --- 7. Reachability ---
printf '\n--- reachability ---\n'
if $cloud && ! $placeholder && [ "$fmt" != "UNKNOWN" ]; then
    code=$(curl -sS -o /dev/null -w '%{http_code}' \
        -H "apikey: $key" -H "Authorization: Bearer $key" \
        --max-time 10 "$url/<HEALTH_PATH>")
    printf 'HTTP %s (expected 200)\n' "$code"
else
    printf 'SKIPPED — fix .env.local first.\n'
fi

printf '\n=== done ===\n\n'
```

---

## Bootstrap emission contract

`kickoff-bootstrap.md` Step 7 emits these files alongside `dev-runbook.md`:

1. `preflight.ps1` and `preflight.sh` at the project root, derived from
   `seed/tech-stack.md §1 (tools)` + the env-var list in `.env.example`.
   The two scripts are kept in sync — if the developer edits one, re-run
   Step 7's emission (or port by hand) so bash and PowerShell stay
   equivalent.

2. A one-line entry in `README.md §Getting started`:

   > Run `./preflight.ps1` (or `./preflight.sh` on macOS/Linux) before
   > anything else. It verifies your tools, env parity, key shape, and
   > service reachability. Expected output: `HTTP 200` on the reachability
   > line.

3. A one-line entry in `CLAUDE.md §Starting a new session` so agents run
   preflight too, not just humans.

The bootstrap does **not** invent placeholder values — the reachability
section is left marked `SKIPPED — fix .env.local first` until the developer
populates real credentials, at which point the next run passes.

---

## When to extend preflight

As phases land, extend preflight only when the additional check is fast
(< 2 seconds), safe (no side effects, no DB writes), and stable (doesn't
depend on state that changes between sessions). Good additions:

- A second cloud service goes live → add its reachability line with that
  service's documented headers.
- A `.env.local` variable becomes required for a new feature → it's
  already covered by the parity check, no action needed.
- Generated artifact should exist after Phase N (e.g. `src/lib/supabase/types.ts`)
  → add to the files table, treat "MISSING" as a warning, not a failure.

Bad additions:

- Running `pnpm install` — too slow.
- Hitting a rate-limited API — risks quota.
- Checking DB schema version — phase-level concern, not session-level.

Preflight is a **fast, safe, repeatable** check. If it becomes slow or
flaky, split it into `preflight:quick` (the current scope) and
`preflight:full` (the heavier one that runs less often).

---

## Related

- `CLAUDE.md §Starting a new session` — preflight is step 1.5
- `CLAUDE.md §Verification ritual` — preflight re-runs at phase close
- `CLAUDE.md §Mid-phase decision memories` — where to record preflight-surfaced drift
- `seed/tech-stack.md` — source of truth for tools + pinned versions
- `seed/open-questions.md` — where drift gets logged for creator review
