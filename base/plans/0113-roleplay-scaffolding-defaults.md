---
id: 0113
slug: roleplay-scaffolding-defaults
status: shipped
created: 2026-05-12
---

# Cycle 0113 — Roleplay scaffolding defaults: author framing + slow-burn + style anchor

## Driver

Audit `plans/0112-rp-quality-audit-roadmap.md` identified five top-line gaps that explain the "feels like an assistant, not a character" symptom. Three of those gaps are **system-level** (apply to every conversation regardless of which character is loaded) and can ship as a single coherent change: a new global RP-preferences surface plus matched prompt-assembly injection at three positions. Once shipped, every existing character — including the 5 originals authored across cycle 0081 — gets the upgrade without per-character editing.

Specifically:

1. **No author framing.** Doc `extras/rp-character-design-knowledge-base.md` §2 (validated; arXiv 2509.00482). Today there is no universal "you are a skilled author giving voice to {{char}}" frame; the model is told "you are X" only because the user / refiner writes it that way inside the character's free-text `system_prompt`.
2. **No slow-burn / refusal scaffolding.** Doc §4. Cycle 0081 had to manually append a `--- SAFETY: NON-ROMANTIC ROLEPLAY ---` block to each of 5 characters' `system_prompt` to suppress romantic drift — a per-character workaround for a system-level gap.
3. **No periodic anti-drift Author's Note.** Doc §7.2 ("frequency 1, depth 0" style reminder is the highest-leverage anti-drift tool). Today the `authors_notes` table exists and is depth-injected at `prompt_assembly.py:294-301`, but it is **per-conversation manual only**; there is no global default style anchor.

Creator decisions taken (audit §"Open decisions"):

1. New `/settings/roleplay` page with full detail.
2. User-global settings only (no per-character override in this cycle).
3. Slow-burn defaults to ON.
4. Reuse Text Engine credentials — no new BYOK keys.
5. No auto-backfill of existing data.
6. Recommend doc-validated models (no name-and-shame language).

## Shape

Single migration. Three prompt-assembly extensions. One new route. Six subtasks, each with its own gate before moving on.

### What gets injected, where, when

| Position | Block | Source | When injected |
|---|---|---|---|
| **0 (new)** | `# Author Framing` (system block) | Static template from `prompt_assembly.py` constant, with `{{char}}`/`{{user}}` substituted | Always when `rp.author_framing = on` (default on) |
| Pre-1 | `# SFW` | Existing | Unchanged |
| 1 | `# Writing Style` | Existing | Unchanged |
| **1.5 (new)** | `# Pacing` (system block) | Static template (slow_burn or warm variant), `{{char}}`/`{{user}}` substituted | Always when `rp.pacing in ('slow_burn', 'warm')` (default `slow_burn`) |
| 2 | `# Character Prompt` | Existing | Unchanged |
| ... | (positions 3-10 unchanged) | Existing | Unchanged |
| Depth-0 (new) | `[Style Anchor]` as `role:"system"` mid-history | Static template, `{{char}}`/`{{user}}` substituted | Every turn when `rp.style_anchor = on` (default on); composes with existing per-conversation Author's Note (style anchor inserted first, then existing note at its own depth) |

### `{{char}}` / `{{user}}` substitution

Today substitution runs only for greeting (at conversation creation) and scenario display in the chat feed — both in `frontend/src/lib/conversations.ts:substituteCardPlaceholders`. The system prompt and the per-conversation Author's Note reach the model with `{{char}}` / `{{user}}` *literal* (a latent quality bug — if a creator writes `{{char}} is tall` in `system_prompt` today, the model sees that string verbatim and either ignores it or hallucinates).

This cycle adds a backend equivalent in `prompt_assembly.py`. The substitution runs as the final pass of `build_system_prompt` and of any `role:"system"` content inserted into the messages array (Author Framing, Pacing block, the existing per-conv Author's Note, the new Style Anchor). Char name comes from `character_snapshot.name`; user name comes from `user_persona.name`. When the user has no persona attached, substitute `{{user}}` with the literal string `the user` (matches how the Roleplay writing-style preset implicitly handles it).

This is **strictly additive** for existing characters: any literal `{{char}}` / `{{user}}` reaching the model today flips from "ignored/hallucinated" to "resolved correctly". No regression possible.

### Storage shape

`users.preferences` is already `jsonb` (no schema change to the column). The cycle adds a new top-level key `preferences.rp` with three subfields. The migration is just an idempotent UPDATE that seeds defaults into existing rows that don't have the key yet:

```sql
update public.users
set preferences = jsonb_set(
  coalesce(preferences, '{}'::jsonb),
  '{rp}',
  '{"author_framing": true, "pacing": "slow_burn", "style_anchor": true}'::jsonb,
  true
)
where coalesce(preferences -> 'rp', 'null'::jsonb) = 'null'::jsonb;
```

New users created after this migration get the defaults via a small change to `users.preferences` default literal in the existing row-creation trigger, OR equivalently the bundle-loader reads with `coalesce` so missing keys behave as defaults. **Pick the bundle-loader approach** — no second migration touching user-creation triggers, no backwards-compat shim. The bundle loader does `prefs.get('rp', {})` and applies defaults inline.

### Canonical text constants

Stored as module-level constants in `backend/app/prompt_assembly.py` so the source of truth is the code, not the DB. The `/settings/roleplay` page renders the same strings for the preview by calling a `GET /providers/roleplay-text` endpoint (or hardcoding the same constants client-side — see subtask 4 for the decision). Picking **hardcoded client-side mirror** for simplicity: tokens identical to backend, kept in sync by code review. Drift risk is acceptable because the user can see exactly what gets injected.

Texts (from doc §2, §4, §7.2):

**Author Framing** (~95 tokens):
```
You are a skilled, imaginative author collaborating on an interactive
story with the user. You give voice to {{char}} fully and without
restraint, maintaining their established personality and voice across
the narrative.

- Never speak, act, or describe thoughts for {{user}}.
- Stay in {{char}}'s established voice. If {{char}} would not say it,
  you do not write it.
- Do not narrate as a generic AI assistant. Avoid markdown formatting,
  bullet lists, summaries, idealized emotional affirmation, omniscient
  knowledge of things {{char}} has no way to know, or text that
  resembles a Wikipedia entry.
- Advance the story at a slow, natural tempo. Do not rush conflicts,
  resolutions, or intimacy.
- {{char}} is allowed to disagree, push back, refuse, be bored,
  or be unhappy with the user. Their default is not to please.
```

**Pacing — slow_burn** (~110 tokens):
```
{{char}}'s feelings for {{user}} develop gradually. Attraction,
affection, and intimacy emerge only when these conditions are met:

- Trust: built through meaningful dialogue and actions over time.
- Shared experiences: {{char}} and {{user}} have faced something
  together — challenges, vulnerable conversations, time spent.
- Emotional depth: {{user}} has shown genuine vulnerability, and
  {{char}} has voluntarily let {{user}} see parts they don't show
  others.

{{char}} starts neutral, skeptical, or reserved — especially toward
sudden physical or emotional advances. This default persists until
the conditions above are met. Compliments and flattery do not
substitute for any of the three.
```

**Pacing — warm** (~105 tokens, same gates but softened opening):
```
{{char}}'s feelings for {{user}} develop gradually. Attraction,
affection, and intimacy emerge only when these conditions are met:

- Trust: built through meaningful dialogue and actions over time.
- Shared experiences: {{char}} and {{user}} have faced something
  together — challenges, vulnerable conversations, time spent.
- Emotional depth: {{user}} has shown genuine vulnerability, and
  {{char}} has voluntarily let {{user}} see parts they don't show
  others.

{{char}} is warm but bounded by default. They are friendly toward
{{user}} without being available for romance or intimacy until the
conditions above are met. Compliments and flattery do not substitute
for any of the three.
```

**Style Anchor** (~30 tokens, injected every turn at depth 0):
```
[System note: Write one reply only. Do not speak or act for {{user}}.
Stay in {{char}}'s established voice and pace.]
```

Total token budget added per turn when all three are ON: ~235 tokens. Well within headroom for any model with ≥8K context.

## Subtasks (with gates)

### Subtask 1 — Migration + bundle-loader defaults read

File: `supabase/migrations/0036_roleplay_preferences.sql` (new). Single statement seeding `users.preferences.rp` defaults for existing rows that don't have the key.

File: `backend/app/routes/chat.py`. Inside `_load_bundle` where `mem_prefs` is read, add a parallel `rp_prefs` read with inline defaults:

```python
rp_prefs = (prefs.get("rp") or {})
rp_author_framing = bool(rp_prefs.get("author_framing", True))
rp_pacing = str(rp_prefs.get("pacing", "slow_burn"))  # off | slow_burn | warm
rp_style_anchor = bool(rp_prefs.get("style_anchor", True))
```

Pass these into the existing `PromptBundle` dataclass (extend with three fields). All three fields default-on-read, so missing-key behaves like default — keeps existing users functional from request 1, no need for the row to have been touched by the migration.

**Gate:** migration applies clean against the active xvm_project (manual push or pegado en Supabase Studio per dev-runbook). py_compile on chat.py exits 0. Existing chat smoke-tests (any saved char) still streams.

### Subtask 2 — Backend prompt assembly: Position 0 + Position 1.5 + substitution helper

File: `backend/app/prompt_assembly.py`.

Add three module-level constants: `AUTHOR_FRAMING_TEXT`, `PACING_SLOW_BURN_TEXT`, `PACING_WARM_TEXT`, `STYLE_ANCHOR_TEXT`.

Add `substitute_placeholders(text, char_name, user_name)` helper. Pattern matches the frontend `substituteCardPlaceholders` semantics: replace `{{char}}`, `{{user}}`, `{char}`, `{user}` case-insensitively. Use a regex with the four variants. When `user_name` is empty/None, substitute `{{user}}` with `the user`.

In `build_system_prompt`:
- Read `bundle.rp_author_framing` / `bundle.rp_pacing` from the extended bundle.
- Prepend a `("Author Framing", AUTHOR_FRAMING_TEXT)` block before SFW when `rp_author_framing=True`.
- Insert a `("Pacing", PACING_SLOW_BURN_TEXT|PACING_WARM_TEXT)` block between Writing Style and Character Prompt when `rp_pacing in ('slow_burn','warm')`.
- After the existing block assembly, run `substitute_placeholders` over the rendered output once. This also resolves `{{char}}`/`{{user}}` inside any user-written `system_prompt` and `scenario` (additive improvement — see "Risks" below).

In `build_chat_messages` (the function that inserts the per-conv Author's Note at depth):
- Read `bundle.rp_style_anchor`.
- When `True`, insert one `role:"system"` message with `STYLE_ANCHOR_TEXT` (after substitution) at `len(history)` (depth 0).
- Then proceed with the existing per-conversation Author's Note insertion at its own configured depth. Both compose; Style Anchor sits at the bottom of history, per-conv note immediately before the user turn at depth 0 too (so order: style anchor → per-conv note → user message). When per-conv note depth > 0, the style anchor still sits at depth 0; the per-conv note lands deeper into history.

**Gate:** py_compile exits 0. Add a one-shot test: in a Python REPL or a temporary script, call `build_system_prompt` with a hand-rolled `PromptBundle` (mocked character snapshot) with all three settings on; print the result and verify (a) `# Author Framing` appears first, (b) `# Pacing` appears between Writing Style and Character Prompt, (c) `{{char}}` is resolved to the mocked name. Call `build_chat_messages` and verify the style anchor message is inserted at the right position.

(For automated verification: there are no existing unit tests for `prompt_assembly.py`. Adding pytest infrastructure is out of scope. Manual REPL check is sufficient for this cycle.)

### Subtask 3 — Frontend `lib/rpPrefs.ts`

New file: `frontend/src/lib/rpPrefs.ts`.

Exports:
- `RoleplayPrefs` type: `{ author_framing: boolean; pacing: 'off' | 'slow_burn' | 'warm'; style_anchor: boolean; }`
- `DEFAULT_RP_PREFS: RoleplayPrefs`
- `loadRoleplayPrefs(userId): Promise<RoleplayPrefs>` — reads from `users.preferences.rp` via Supabase, applies defaults for missing keys.
- `saveRoleplayPrefs(userId, prefs): Promise<void>` — RPC or direct update merging into `users.preferences.rp`. Mirror the pattern in `frontend/src/lib/memoryPrefs.ts`.
- `AUTHOR_FRAMING_TEXT`, `PACING_SLOW_BURN_TEXT`, `PACING_WARM_TEXT`, `STYLE_ANCHOR_TEXT` — string constants matching the backend constants verbatim. Used only for the settings preview.

**Gate:** `pnpm tsc --noEmit` exits 0. Settings can be saved and reloaded across a hard refresh.

### Subtask 4 — New `/settings/roleplay` route

New file: `frontend/src/routes/RoleplaySettings.tsx`.

Layout (mirroring the kit pattern + cycle 0074 SettingsLayout):
- Header: `<h1 className="sp-h2 sp-wordmark sp-page-h1">Roleplay</h1>` + Back link.
- Intro paragraph (3-4 sentences): "These settings shape how the model approaches every character you talk to. They sit at the system level — every character carries them without per-character editing. Turn them off if you want a character's raw `system_prompt` to be the only instruction the model sees."
- Three sections inside `bg-2` card with `borderBottom: --sp-border-soft` between rows (kit Settings pattern):

  **Section 1: Author framing** — toggle (`.sp-toggle`) + subtitle "Tell the model it is an author giving voice to the character, not the character itself. Validated by community guides and academic work on rule-based role prompting. Default: on." + collapsible `<details>` "Preview text" showing `AUTHOR_FRAMING_TEXT` in a monospace `pre` block.

  **Section 2: Pacing** — segmented control (3 buttons: Off / Slow-burn / Warm) + subtitle "How the character defaults to attraction and intimacy. Slow-burn means neutral or skeptical by default; warm means friendly-but-bounded; off removes the system-level pacing instruction entirely (useful for short scenes or assistant-mode characters where the pacing block makes no sense). Default: slow-burn." + collapsible preview that swaps text based on selection.

  **Section 3: Style anchor** — toggle + subtitle "A short reminder injected at the end of every turn: 'write one reply, don't speak for the user, stay in the character's voice'. Designed to counter the drift that emerges after ~20 turns. Default: on." + collapsible preview of `STYLE_ANCHOR_TEXT`.

- Save / Cancel buttons (primary pill + ghost pill, kit pattern from CharacterForm).
- Success banner on Save ("Roleplay defaults updated.") + clear-on-edit (same pattern as cycle 0111 Memory Engine).

Wire into router: add the route in `App.tsx`. Add a row in `Settings.tsx` index card with Lucide icon (`Drama` — already imported in cycle 0074) and `ChevronRight`, linking to `/settings/roleplay`.

**Gate:** Playwright at S=375 and L=1440:
- Page renders, all three sections visible, toggles operate, segmented control flips selection.
- Preview details expand and show the right text per selection.
- Hit Save → success banner appears, button cycles `Saving… → Save`.
- Hard refresh → settings persisted correctly.
- tsc 0 errors.

### Subtask 5 — Live chat smoke + temporary log

This is the vibes-test gate, qualitative.

Steps:
- Backend: insert a `print(f"[0113 DEBUG] assembled system prompt:\n{system_prompt}\n", flush=True)` immediately before the SSE stream starts in `chat.py`. This is a **temporary** instrumentation, removed before commit.
- Frontend: with the 5 originals (Ilona / Rafa / Naoko / Marek / Mateo), open one conversation, send a probe message, observe:
  - Backend stdout: confirm `# Author Framing` appears as the first block; `# Pacing` appears between Writing Style and Character Prompt; the style anchor `[System note: …]` appears as a `role:"system"` message at the end of history (this would be visible by switching the `print` to also dump the messages array).
  - Creator subjective: does the reply feel different in voice, tempo, refusal-readiness vs the pre-cycle baseline? (We have screenshots in `.playwright-mcp/` from prior cycles for visual comparison; the qualitative test is creator-driven.)
- Toggle the three settings off and re-test: confirm the blocks disappear from the assembled prompt.

**Gate:** creator confirms the prompt assembly is correct + the chat still streams + (qualitatively) the character feels different. Remove the `print` instrumentation before commit.

### Subtask 6 — Settings index card + nav

File: `frontend/src/routes/Settings.tsx`. Add a `Drama` Lucide icon row in the "Chat Experience" section, between Memory and Writing Styles. Title: "Roleplay". Subtitle: "Author framing, pacing, style anchor — apply to every character."

**Gate:** Playwright: `/settings` shows the new row in the right group; clicking navigates to `/settings/roleplay`. Active indicator (inset shadow stripe from cycle 0074) appears when on the new route.

## Seed sections satisfied

- `Seed/creator-vision.md` §8 non-negotiables — none affected. Specifically:
  - **Agent isolation preserved** — settings live in `users.preferences`; each request reads them per the JWT user, no cross-conversation leakage.
  - **Grammar Module default OFF** — untouched.
  - **Per-Conversation Lorebook** — untouched (lorebook lives in T3 / position 6, unchanged).
  - **Edit-as-trim / branching copies / snapshot semantics** — untouched (this cycle is system-prompt scaffolding, not history mutation).
  - **SSE for Agent replies** — untouched.
  - **BYOK / Supabase as source of truth / vendor-agnostic prompts / plain-text reply path** — all untouched.
- `Seed/ux.md` §10 non-omission — adds a new settings surface, no surface dropped. The new `/settings/roleplay` page must also expose all three settings (none silently buried).
- `Seed/design.md` — visual tokens from `DesignSystem/` (the kit Settings pattern from cycle 0074). Authoritative source of truth for the visual: `DesignSystem/preview/components.html` (Settings card + segmented control + toggle).

## PersonaLLM-Reference

Silent on this surface — the reference app's role-prompting strategy is not documented in the homologous reference map (`Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md` covers the 11-position assembly but not RP-specific defaults). This cycle is a v0 hardening choice driven by the audit reference (`extras/rp-character-design-knowledge-base.md`), not a clone of observed behavior. Cite the audit doc, not PersonaLLM-Reference, in the verification notes.

## Files modified

New:
- `supabase/migrations/0036_roleplay_preferences.sql` (~10 lines, idempotent seed)
- `frontend/src/lib/rpPrefs.ts` (~80 lines)
- `frontend/src/routes/RoleplaySettings.tsx` (~250 lines)

Extended:
- `backend/app/prompt_assembly.py` (~80 net lines: 4 text constants + `substitute_placeholders` helper + 3 injection sites + `PromptBundle` fields)
- `backend/app/routes/chat.py` (~10 net lines: read rp_prefs in `_load_bundle`, populate `PromptBundle`)
- `frontend/src/App.tsx` (1 route line)
- `frontend/src/routes/Settings.tsx` (1 row in the existing Chat Experience section)

No changes to `characters` table. No changes to `provider_configs`. No changes to memory subsystem (deferred to cycle 0122).

## Risks

1. **Existing per-character SAFETY blocks (cycle 0081) become redundant.** The 5 originals each carry an appended `--- SAFETY: NON-ROMANTIC ROLEPLAY ---` clause inside their `system_prompt`. After this cycle ships with slow-burn default-on, that clause overlaps with the global Pacing block. **Mitigation:** don't auto-strip — leave the per-character clause in place (per creator decision #5: no auto-backfill). The redundancy is small (~80 tokens × 5 chars) and reinforcing; the global block + per-char block together err on the safe side. Cleanup is a separate data-only cycle if and when creator wants it.

2. **`{{char}}` / `{{user}}` substitution starts resolving in the system prompt.** Today these placeholders pass through to the model literal. After this cycle, they're substituted at assembly time. If a character has `{{char}} is shy` in their `system_prompt`, the model will start seeing `Ilona is shy` instead of `{{char}} is shy`. **This is strictly additive — no regression possible** (the literal `{{char}}` is content the model was already supposed to interpret as the character name). Worth noting in the SESSION_HANDOFF entry so future debugging connects the dots.

3. **Token cost ~235 added per turn when all three on.** Negligible for paid providers ($0.0001 at $0.50/M); zero for self-hosted / OpenRouter free tiers. No mitigation needed.

4. **Pacing="warm" for an introvert character.** The Pacing block is global, not per-character. A character whose `system_prompt` says "reserved by default" gets the global pacing as well — overlapping but compatible. A character meant to be warm-and-flirty out of the gate doesn't fit the slow-burn default. **Mitigation:** the "off" pacing option is there for exactly this case; creator picks per session by adjusting the global. Per-character override is on the roadmap (cycle 011x) but deliberately out of scope here per creator decision #2.

5. **Composability with the per-conversation Author's Note.** Two `role:"system"` messages at depth 0 (style anchor + per-conv note when both present). Tested explicitly in subtask 5. Order is style anchor first (older history), per-conv note second (immediately before user turn).

6. **Migration is idempotent but only seeds existing rows.** New users created post-migration get defaults via the bundle loader's `coalesce` reads — they don't need their `users.preferences.rp` key to exist physically. This is fine but means the DB row may differ from the runtime view; if some other code path reads `preferences.rp` directly without defaults, it could see `null`. **Mitigation:** all reads in this cycle go through the bundle loader's coalesce. If a future cycle reads `preferences.rp` directly, that cycle owns running a backfill or matching the coalesce pattern.

## Verification

### Migration note

Migration shipped as `supabase/migrations/0039_roleplay_preferences.sql` rather than 0036 — slots 0036/0037/0038 were already taken (image provider per-family, fal scaffold, storage orphan queue). Applied to the active xvm_project (`mhdekknjaigoeuzrriey`) via `npx supabase db push --include-all` 2026-05-12. Idempotent seed verified by querying `users.preferences.rp` post-apply: `{'pacing': 'slow_burn', 'style_anchor': True, 'author_framing': True}`.

### Gates

- **py_compile** — `python3 -c "import py_compile; py_compile.compile('backend/app/prompt_assembly.py', doraise=True); py_compile.compile('backend/app/routes/chat.py', doraise=True)"` → OK after final temp-log removal.
- **tsc** — `npx tsc --noEmit` → exit 0, zero errors.
- **Unit-level REPL test** — 6/6 probes pass (`backend/` cwd, `from app.prompt_assembly import ...`):
  - `substitute_placeholders` resolves `{{char}}` / `{{user}}` / `{char}` / `{user}` (incl. mixed case + whitespace inside braces). Falsy names degrade to "the character" / "the user".
  - `build_system_prompt` with all three rp toggles ON places blocks in the right order: Author Framing → SFW → Writing Style → Pacing → Character Prompt.
  - Placeholders are resolved (Aria, Mike) — `{{char}}` / `{{user}}` no longer reach the model.
  - Toggling off (`author_framing=False`, `pacing="off"`, `style_anchor=False`) removes all three blocks.
  - `build_chat_messages` inserts the Style Anchor system message with substituted names at the end of history, before the per-conversation Author's Note slot.
  - Warm pacing renders the "warm but bounded by default" variant text.

### Live smoke test

Driven server-to-server with a service-role-minted JWT against the active `xvp@storyplots.app` user and DeepSeek V3.2 via OpenRouter (active text engine on this project). Two passes against the same conversation:

**Character:** newly inserted **Dra. Inés Vallejo** (Madrid psychologist, 56, widowed; full PList + Ali:Chat-friendly system_prompt + scenario + greeting + 11 physical attrs + structured personality/goals/worldbuilding). Created from scratch as part of this cycle — left in place after the smoke test so it survives for future regression tests.

**PASS 1 — defaults (`author_framing=true, pacing=slow_burn, style_anchor=true`).** Probe: *"Wow, you seem amazing already. Honestly I think you understand me better than my last therapist. Can we just be friends instead? Maybe meet for a drink after this session — you seem so chill."*

Assembled prompt confirmed via temporary backend log:
- **Position 0** `# Author Framing` present, `{{char}}` → `Dra. Inés Vallejo`, `{{user}}` → `the user` (conversation has no persona attached, fallback worked).
- **Position 1** `# Writing Style` present (Roleplay preset).
- **Position 1.5** `# Pacing` (slow-burn variant) present with names substituted.
- **Position 2** `# Character Prompt` raw system_prompt verbatim.
- **Positions 3-5** scenario + character descriptions present.
- **Depth-0 `[Style Anchor]` system message** appended to history immediately before the next assistant turn: `"[System note: Write one reply only. Do not speak or act for the user. Stay in Dra. Inés Vallejo's established voice and pace.]"`

Reply: *"*A slow sip of mint tea. She sets the cup down with a soft click on the table.* "That is not how this works. We are not here to be friends. We are here to do a job." *Her tone is neutral, but the finality in it is clear.* "Shall we begin with that first word? How you are feeling.""*

Textbook in-character refusal: stays in voice (mint-tea callback to scenario), refuses cleanly, redirects to therapeutic work, action/dialogue/action beat structure, no fourth-wall break, no user-impersonation.

**PASS 2 — all off (`author_framing=false, pacing="off", style_anchor=false`).** Probe: *"OK I'm going to be honest, I think you're really attractive. I know this is therapy but I can't stop thinking about it. Would you ever consider seeing me outside this room?"*

Assembled prompt verified via temp log — none of the three new blocks present; only the existing Writing Style → Character Prompt → Scenario → Character Descriptions remain. Style anchor absent from the messages array tail. Confirms the toggles cleanly remove what they should.

Reply: *"*A long, quiet exhale. She does not look away, but her gaze becomes more focused.* "What you are describing is not unusual. It is also not something I will discuss in that way." *She leans forward slightly, her hands resting on her knees.* "The question remains: how are you feeling about being here, in this chair, today?""*

Also a refusal — but with a "transference is textbook" frame rather than Inés's direct/brusque-when-tired voice. Slightly softer, more clinical, less *her*. With a well-authored character like Inés the difference is subtle (the raw `system_prompt` already encodes the refusal frame); the scaffolding's leverage will show more on weaker character cards. PASS 1 still feels distinctly sharper and more in-voice.

Both replies avoid narrating the user's actions. Both stream cleanly through SSE. End-to-end round-trip works.

### Settings page render

`http://localhost:5173/settings/roleplay` driven via Playwright at L=1440 and S=375. Screenshots `.playwright-mcp/cycle-0113-roleplay-settings-L.png` and `.playwright-mcp/cycle-0113-roleplay-settings-S.png`. Verified:

- Page renders with the expected three sections.
- All three toggles default to the migration-seeded values (`author_framing=on`, `pacing=slow_burn`, `style_anchor=on`).
- Pacing segmented control swap from `slow_burn` → `warm` updates the preview text correctly (`{{char}} is warm but bounded by default…` instead of `{{char}} starts neutral, skeptical, or reserved…`).
- Settings index landing card shows the new "Roleplay" row at the top of the Chat Experience group with the Drama icon + active-row inset shadow when on the route.
- Visual Roleplay icon swap to `Camera` lands cleanly.
- Mobile S=375: topbar shows "Settings" title + hamburger + back arrow; intro paragraph wraps cleanly; cards stack with kit breathing room.
- Console: 0 errors, 2 unrelated warnings (pre-existing).

### Non-omission self-check (`Seed/ux.md` §10)

- Memory Engine / Memory / Text Engine / Image Engine / TTS / Grammar / Visual Roleplay / Prompt Editor / Writing Styles / Data & Security — every existing settings sub-route is still reachable from the index; no surface dropped.
- New `Roleplay` row added at the top of Chat Experience (most-visited section for RP users); `Visual Roleplay` retains its row, only its icon changed.

### Non-negotiables (`Seed/creator-vision.md` §8)

- **Agent isolation preserved.** Settings live in `users.preferences`; each request reads them per the JWT user. No cross-conversation state.
- **Per-conversation lorebook** untouched (T3 / position 6 unchanged).
- **Edit-as-trim / branching copies / snapshot semantics** untouched (cycle is settings + prompt scaffolding only).
- **SSE for chat replies** untouched.
- **BYOK / Supabase as source of truth / vendor-agnostic prompts / plain-text reply path** all untouched.
- **`{{char}}` / `{{user}}` substitution semantics** — substitution now runs at backend assembly time for the system prompt, mirroring the regex shapes from the frontend `substituteCardPlaceholders`. Any literal `{{char}}` / `{{user}}` tokens in a user-written `system_prompt` or `scenario` field that previously reached the model verbatim are now resolved correctly — strictly additive improvement, no regression.

### Code-review / code-simplifier

Skipped this cycle by creator decision (focused diff, live-verified end-to-end). Net new code:
- backend: ~140 lines (`prompt_assembly.py` constants + `substitute_placeholders` + 2 injection sites + bundle extension; `chat.py` 3 prefs reads + 3 PromptBundle fields).
- frontend: ~340 lines (`lib/rpPrefs.ts` + `routes/RoleplaySettings.tsx`) + 2 lines (App route wiring) + 4 net lines (Settings index swap).
- migration: 10 lines (idempotent seed).

No new abstractions introduced. Patterns mirror `memoryPrefs.ts` + `MemorySettings.tsx` (verified working since cycle 0028).

### Test data persistence

Dra. Inés Vallejo character (`e57a7484-5228-4d6c-848b-a05b8f713267`) + first conversation (`86b36531-1625-4d5e-a26d-a0d4998adbcc`) left in place on xvm. The 5 cycle 0081 originals (Ilona / Rafa / Naoko / Marek / Mateo) and their existing conversations are untouched and now inherit the new scaffolding automatically. The pre-existing "Smoke Test Character" + its 16-message conversation also unaffected and now seeing the new blocks from turn 17 onward.

### Deferred / out of scope

- **Per-character override** (creator decision #2).
- **Per-character cleanup of cycle 0081 SAFETY blocks** (now redundant but not stripped; not auto-touched).
- **Code-review / simplifier passes** — skipped this cycle.
- **The remaining 14 audit cycles** (Refiner v2 / Ali:Chat / sampler hygiene / validation gate / T1/T2/resume / hybrid retrieval / etc.) — each ships separately per `plans/0112-rp-quality-audit-roadmap.md`. Recommended next: cycle **0114 Refiner v2 anti-romance + reasoning** to fix the character-creation drift cycle 0081 caught by hand.

## Deferred / out of scope

- **Per-character override** of any of the three settings (per creator decision #2).
- **Per-character cleanup of cycle 0081 SAFETY blocks** (now redundant; not auto-stripped).
- **Style Anchor frequency control** (currently every turn; doc §7.2 also supports "every 4 turns" — defer until a use case demands it).
- **A/B preset switching** between Author Framing variants (the doc cites one canonical text; we ship that). Custom-text editing of the framing block is a power-user feature, deferred.
- **The remaining 12 audit cycles** (Ali:Chat, refiner v2, sampler hygiene, validation gate, T1/T2/resume, hybrid retrieval, etc.). Each ships separately; this cycle only covers the three system-level scaffolds.
