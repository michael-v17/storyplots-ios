# Playwright Capture Pattern (background-spider style)

> Used by ECC projects that must reverse-engineer or continuously observe an external web application
> (an app the project will mirror, integrate with, or replace). Project-agnostic — adapt paths to your stack.

This pattern exists because driving a foreground browser per screen is too slow, leaks credentials,
and is easy to detect by anti-bot. The canonical recipe is: **persist a real-user session once,
then run autonomous headless walkers in the background** that emit a 9-file evidence packet per screen
and a single trace per journey.

---

## When to use this pattern

- The project must catalogue an external UI (competitor, vendor, legacy app you are replacing)
- You need stable, machine-readable artifacts (ARIA, DOM, network) — not just screenshots
- You need to replay or diff captures across runs
- The external app is anti-bot (rejects raw Playwright / blocks login from headless Chromium)

If you only need a one-off scrape, use `firecrawl` instead.
If you only need to test your own UI, use `/e2e` directly — no spider, no auth handoff.

---

## Standing condition — saved auth state

All spiders and per-screen captures load `playwright/.auth/state.json`. Two paths to produce it,
**never type credentials in a script**:

### Path A — CDP handoff (preferred when the user has Chrome locally)

The user runs **their own Google Chrome** (the real installation, the real profile) with remote
debugging enabled, signs into the target app **manually**, and Playwright connects via CDP to that
already-authenticated context.

```bash
# User runs (Windows example — adapt for macOS / Linux)
"C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --remote-debugging-port=9222 \
  --user-data-dir="<absolute path to user's Chrome data dir>" \
  --profile-directory="<the profile that's logged in>"
# Then: navigate to the target app and confirm you're signed in.
```

```bash
# Then a project script (example name) — runs inside venv with auth state saved on success
source venv/Scripts/activate
python scripts/connect_auth_state.py
# Internally: p.chromium.connect_over_cdp("http://localhost:9222")
#             pick first context, verify session, context.storage_state(path="playwright/.auth/state.json")
```

### Path B — Cookie import (fallback when CDP is unavailable)

The user exports cookies from their authenticated browser session via a Cookie-Editor extension
(or any cookie export tool) and saves the JSON to a known path. A converter script reshapes it into
Playwright's `state.json` format.

```bash
source venv/Scripts/activate
python scripts/import_auth_state_from_cookies.py path/to/cookies.json
```

### Verification step

Always confirm the saved state actually authenticates before launching any spider:

```bash
source venv/Scripts/activate
python scripts/discover_authenticated.py
# Expected: prints ≥ N URLs reachable only when logged in.
```

If verification fails: re-do the handoff. **Do not try to recover programmatically.**
Document the dead session in `reference/99-open-questions.md` (or your project's equivalent).

---

## Per-screen 9-file evidence packet

For every captured screen the spider (or `scripts/capture_screen.py`) emits:

| File                        | Source                                                            | Why                                                                  |
|-----------------------------|-------------------------------------------------------------------|----------------------------------------------------------------------|
| `summary.md`                | hand-written by Claude after walking                              | purpose of screen, key affordances, where it sits in the flow         |
| `aria.yaml`                 | `page.accessibility.snapshot()` → YAML                            | role + name tree (the structural truth)                              |
| `dom.html`                  | `page.content()` cleaned to landmarks/forms/lists/tables          | field names, validation attrs, repeated regions                       |
| `screenshot-desktop.png`    | `page.screenshot(full_page=True)` at desktop viewport             | visual ground truth                                                   |
| `screenshot-mobile.png`     | same at mobile viewport                                           | responsive truth                                                      |
| `requests.json`             | `page.on("request")` + `page.on("response")` filtered to XHR/fetch| API surface, endpoints, timing, entity IDs                            |
| `response-snippets.json`    | first ~500 chars of each XHR response                             | reveals payload field names without committing PII                    |
| `console.log`               | `page.on("console")`                                              | feature flags, deprecation notices, runtime warnings                  |
| `states-observed.md`        | hand-written by Claude                                            | which states we saw: loading / empty / success / validation-error / server-failure / permission-denied / no-results |

Folders are created **only when captured** — never speculative scaffolding.

---

## Background spider pattern

A spider is an autonomous walker that loads the saved state, observes the DOM, infers the next CTA,
advances, and captures a packet at each step. **Always launch the spider via Claude Code's
`run_in_background`** so the conversation continues while it works.

### Mandatory CLI flags

| Flag                            | Purpose                                                                   |
|--------------------------------|---------------------------------------------------------------------------|
| `--max-steps N`                 | Hard cap so a runaway spider doesn't burn API quota                        |
| `--resume <id-or-slug>`         | Continue mid-flow after a crash without re-walking from step 0             |
| `--branch-override key=value`   | Force a specific branch decision (e.g. `--branch-override pricing=per-seat`) |
| `--publish`                     | Final step click (e.g. "Activate", "Save & Publish") — **off by default**  |
| `--dry-run`                     | Walk + capture but do not click any state-changing CTA                     |
| `--out reference/<flow>/`       | Output root for the per-screen packets                                     |

### Hard rules for spider scripts

1. **No interactive waits.** Never call `input()`, never `page.pause()`. The spider must run unattended.
2. **Headless + saved state.** `browser.new_context(storage_state="playwright/.auth/state.json")`.
3. **Observe, don't assume.** Infer the next CTA from `aria.yaml` (button names, role tree),
   not from a hardcoded selector list. Hardcoded selectors break on every UI redesign.
4. **One context per spider run.** Reusing contexts across runs leaks state across captures.
5. **Idempotent capture.** Re-running on the same step path overwrites the packet; the file tree is
   the source of truth, not the run log.
6. **Cookie values are secrets.** Never `print()` cookie values, never paste them into source.
   Cookie **names** are fine to document.

### How Claude launches a spider

```text
1. Tell the user what's about to happen and the expected runtime.
2. Bash(run_in_background=true) the spider command — keep the shell id.
3. Continue the conversation: discuss what's been captured so far, plan the next phase,
   answer questions. The spider runs to completion in the background.
4. Periodically: BashOutput(id) to surface progress. Never sleep-poll.
5. On completion: read the new packets, update the inventory.
```

If the user asks to pause/abort: `KillShell(id)`. The captured packets so far are valid;
re-launch with `--resume <last-step-id>` when ready.

---

## Journey traces

For end-to-end user journeys (signup → first action, full booking, full checkout) record a **single trace** per journey alongside the per-screen packets:

```python
context.tracing.start(screenshots=True, snapshots=True, sources=True)
# ... walk the journey ...
context.tracing.stop(path="reference/journeys/<journey-name>/trace.zip")
```

View the trace locally with `playwright show-trace reference/journeys/<journey-name>/trace.zip`.

**Commit policy.** Commit `flow.md`, `state-matrix.md`, `requests.json` per journey.
**Gitignore `trace.zip`** — large binaries don't belong in git.

---

## Failure modes and what to do

| Failure                                                           | Response                                                                                          |
|-------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
| Auth dies mid-spider (saved cookie expired)                       | Stop. Re-run the auth handoff (Path A or B). Re-launch spider with `--resume <last-step-id>`.    |
| Spider stuck on the same step for N polls                         | KillShell. Open the last packet's `aria.yaml` — find the missing affordance. Update inference.   |
| External app changes UI mid-capture                               | Capture the rest. Open `99-open-questions.md` with diffs. Don't rewrite older packets.            |
| Captcha / bot detection                                           | Switch from Path A → Path B (real-browser cookies). If still blocked: surface to user, don't loop. |
| Unknown route encountered                                         | Log to `unknown-routes.md`. Do not recurse outside the agreed scope.                              |

---

## Generic script names (project-agnostic)

| Path (suggested)                                      | Job                                                                       |
|-------------------------------------------------------|---------------------------------------------------------------------------|
| `scripts/connect_auth_state.py`                       | CDP handoff → save `state.json`                                            |
| `scripts/import_auth_state_from_cookies.py`           | Cookie import → convert → save `state.json`                                |
| `scripts/discover_authenticated.py`                   | Verify saved state actually authenticates                                  |
| `scripts/capture_screen.py`                           | Capture a single screen (9-file packet)                                    |
| `scripts/spider_<flow>.py`                            | Autonomous walker for a named flow                                         |
| `scripts/dom_clean.py`                                | DOM scrubbing helper (landmarks/forms only)                                |

---

## Wiring into the harness

- The seed-implied skill `.claude/skills/reference-capture/SKILL.md` (see `custom-rules-skills-cookbook.md`)
  should reference this file in its body so future Claude sessions auto-load this playbook when the user
  asks to "capture", "snapshot", "record" an external app screen.
- The `/e2e` command must NOT be repurposed for spidering — it's for the project's own UI tests.
  Spiders live as ordinary Python scripts under `scripts/`, launched via `Bash(run_in_background=true)`.
- All scripts run inside the project's venv. Activation is the first line of every shell invocation.
