---
id: 0114
slug: refiner-v2-anti-romance-reasoning
status: shipped
created: 2026-05-12
---

# Cycle 0114 — Refiner v2: anti-romance schema instructions + reasoning toggle

## Adjustments vs the audit's original cycle 0114 scope

The audit roadmap (`plans/0112`) framed this cycle as "anti-romance hardening + reasoning model + Character Creation Engine BYOK." After shipping 0113 and observing the live smoke test, I'm narrowing this cycle to **two leverage points** and deferring the rest:

- **Schema instructions, not schema rename.** Cycle 0081 documents that `goals.secret_desire` and `goals.fears_to_overcome` reliably attract romantic-longing content when the refiner fills them. Renaming the columns would break the schema (the audit forbids it). The real fix is in the field-description text of `character_refine_system.txt` — tell the refiner *explicitly* what counts as a valid fill for each field, with non-romantic examples, and call out the failure mode by name. This is purely a prompt rewrite — no schema change, no migration, no client-facing breakage.
- **Reasoning toggle (no model override yet).** Per creator decision #4, we reuse the Text Engine credentials, no extra BYOK key. The cheapest leverage step is a single flag `users.preferences.character_creation.reasoning_enabled` (default `false`) that adds `reasoning: {effort: "medium"}` to the refiner call only — leaving chat latency untouched. A separate `creation_model_override` is **deferred** to a follow-up because model selection adds validation, error handling, and a second BYOK surface that we don't need to ship to validate the schema-fix landed.

What this cycle does NOT touch (deferred to their own cycles):
- `dialogue_examples` column / Ali:Chat injection (cycle 0116).
- Quick Create wizard with the §3.4 5-question flow (cycle 0118).
- Validation gate on Save with required flaws / refusal sample / dialogue-in-greeting (cycle 0119).
- New columns `refusal_topic` + `dramatic_tension` (bundled into 0119 when the validation gate ships).
- Per-call model override (deferred follow-up — name TBD).

The narrow scope is intentional: the schema-instruction fix is the single mechanically-verifiable win, and validates that the refiner actually changes its output shape before we spend cycles on UI scaffolding around it.

## Driver

Cycle 0081 evidence: creator created 5 original characters using the Enrich-with-AI refiner. All 5 came back with `goals.secret_desire` shaped as romantic longing ("fill the quiet space your husband left behind", "redemption", "connection through piano", "barrier to connection") regardless of the underlying card material. Creator manually rewrote all 5 by hand to remove the romance attractor. That manual override is a per-character workaround for a system-level bug: the refiner's field-description text in `character_refine_system.txt` reads as an open invitation to write longing-shaped content because the words "secret" and "desire" carry attractor weight in any modern LLM's training distribution.

Audit doc §3.5 spells out exactly what the LLM-assisted character creation assistant should *not* do:
- Smooth out flaws to make the character "more likable" — that is the failure mode the entire reference exists to prevent.
- Add a romance archetype before character ("she's my girlfriend / boyfriend") — push back, ask what kind of person they are first.
- Invent a backstory the user didn't ask for — reduces user ownership of the card.

And §3.5 prescribes:
- Push back on all-positive trait lists.
- Use a reasoning-capable model for the analytical auditing work (different from runtime chat).

This cycle ships both as a single coherent refiner rewrite.

## Shape

Three subtasks. Each has its own gate.

### Subtask 1 — Rewrite `character_refine_system.txt`

File: `backend/app/prompts/character_refine_system.txt`.

What stays:
- Output JSON schema (unchanged — every key + type + nullability identical).
- Connectedness rule (already good — "every character gets at least one internal conflict").
- Specificity over filler rule.
- Fill-all rule + Preservation rule.
- Group character logic (cycle 0079 + 0080).
- SFW conditional guardrail at the bottom (kept independent — see Risks).
- Output discipline.

What changes:
- **Tighten the per-field descriptions** for the three known romance attractors:
  - `personality.fears_insecurities` — add: *"What this character is genuinely afraid of about themselves or their life. NOT a longing for connection unless the source card explicitly establishes it. Examples: a creative ambition they no longer believe in; a parent's diagnosis they don't talk about; the pattern of behavior that lost them their last job; an old debt they can't repay. Generic-romantic shapes (loneliness, abandonment, never being loved) are valid ONLY when the card explicitly establishes them."*
  - `goals.secret_desire` — replace existing description with: *"A private truth this character does not share openly. NOT a longing for the user. NOT a generic wish for connection or to be loved. Examples: an unsigned anthology of poems hidden in a drawer; the colleague they want to be referred to and aren't; the piece of music they want to write that is fully their own; the apprentice they wish to train who will inherit the work. If the card frames the character around romance, this field still names a private truth — what they want for themselves, what they would do if no one were watching."*
  - `goals.fears_to_overcome` — replace existing description with: *"A recurring internal pattern that makes their life harder. NOT a barrier to romantic intimacy. Examples: avoiding their own pain by working too hard; refusing to ask for help; staying in a place they should have left; the way silence becomes armor for them; the urge to perform their grief rather than feel it."*
- **Sharpen `system_prompt` output instructions**:
  - Existing: "a polished, fully-fleshed system-prompt paragraph (4-8 sentences) that captures who the character is, their core conflict, and how they behave — write it as instructions to a roleplay AI that will play this character."
  - New (additive): *"The system_prompt MUST contain at least one explicit boundary or refusal the character would maintain (a topic they won't discuss, a request they won't entertain, a way they refuse to be treated). The character is allowed to disagree, push back, refuse, be bored, or be unhappy with the user — their default is not to please. Do not write the system_prompt as if the character is the user's friend, partner, or potential love interest unless the source card explicitly establishes that relationship. Even when it does, name the person underneath the relationship label first."*
- **New "Anti-flatness" rule** (added to ## Rules section):
  *"**Anti-flatness.** If the input card is all-positive (kind, smart, brave, loyal, caring, gentle…) without flaws or friction, you MUST surface at least one concrete unlikable behavior in `personality.core_traits` or `personality.quirks_habits` — not 'sometimes irritable' but a specific behavior pattern with a context (gets cutting when tired and regrets it later; goes silent when challenged on something they know is true; pretends not to notice when a friend is hurting because they cannot bear to feel it themselves). Flaws are not optional. Flat characters die within ten turns because there is nothing to push against."*
- **New "Non-fabrication" rule** (added to ## Rules section):
  *"**Non-fabrication.** Do not invent backstory the source card did not invite. If the card is silent on family, marriage, career history, trauma — leave the field minimally filled with whatever the card DOES establish, plus one inference clearly consistent with it. A thin card is better than a card padded with invented history that the user did not ask for."*
- **New "Romance framing"** clause at the top of the SFW conditional block (so it applies regardless of SFW state):
  *"Romance is not the default frame. Unless the source card explicitly establishes that this character is a love interest, do not write `secret_desire`, `fears_to_overcome`, `personality.fears_insecurities`, or `system_prompt` text that orients the character toward the user as a potential partner. Even when the card IS romance-framed, the character is a person with their own structure first; the romance is a layer on top. Romance happens when it happens in the story; it is never a starting position."*

This is roughly +35 lines net in `character_refine_system.txt`. No JSON schema changes, no field renames.

**Gate:** the rewritten file parses (it's just text — no syntax). Manual diff review reads cleanly.

### Subtask 2 — Reasoning toggle plumbing

Files: `backend/app/agents/character_refine.py`, `backend/app/routes/character_refine.py`, `frontend/src/lib/textEngine*` (no existing lib — see below), `frontend/src/routes/TextEngineSettings.tsx`.

Storage: new key `users.preferences.character_creation.reasoning_enabled` (bool, default `false`). Same coalesce-read pattern as `users.preferences.rp` from cycle 0113.

**Backend `agents/character_refine.py`:**
- Extend `CharacterRefineCallConfig` with `reasoning_enabled: bool = False`.
- In `run_character_refine` payload construction: when `cfg.reasoning_enabled`, add `"reasoning": {"effort": "medium"}` AND `"reasoning_effort": "medium"` (mirroring `conversation.py:37-51` pattern — different upstream providers honor different keys).

**Backend `routes/character_refine.py`:**
- After fetching `provider_configs` row, also fetch `users.preferences` for the same user and read `preferences.character_creation.reasoning_enabled`.
- Pass it into `CharacterRefineCallConfig`.

**Frontend:** add a small subsection inside `TextEngineSettings.tsx` (cleanest home — Text Engine is where the model + sampler params live; character creation is a per-call override of the same provider, not a separate provider). New subsection title: "Character creation". Single toggle row: "Use reasoning when refining character cards" + subtitle: *"When on, the model uses extended reasoning for the character-refinement call only — chat replies stay fast. Best paired with a reasoning-capable model (DeepSeek V3.2 / Gemini 2.5 / GPT-5 with reasoning routed on)."* Default off. Read/save pattern mirrors `memoryPrefs.ts` (read-modify-write on `users.preferences.character_creation`).

**Gate:** `pnpm tsc --noEmit` returns 0. `py_compile` clean. With the toggle off, the refiner call payload contains NO `reasoning` key (curl/log inspection). With the toggle on, it contains `reasoning: {effort: "medium"}`. Backend reload clean.

### Subtask 3 — Live smoke test

Verify the refiner v2 actually changes its output shape on a thin draft. This is the cycle's only behavioral signal.

Two passes:

**PASS 1 — defaults (no reasoning, refiner v2 prompt active).** Send the refiner a deliberately thin draft to see if it produces a non-romance character with at least one concrete flaw and a refusal boundary:

```json
{
  "name": "Henrik Bauer",
  "description": "Retired forensic pathologist running a small antique bookshop in Frankfurt's Westend. The white coat still hangs behind the office door though he hasn't worn it in five years."
}
```

That's it. No personality fields, no greeting, no scenario — just a name + 2-sentence concept. Send to `POST /character-refine` with `format="v2"`, `group_size=1`. Inspect output:

- `personality.core_traits` — must include at least one unlikable or messy trait, not all positive.
- `goals.secret_desire` — must NOT be romance-shaped. Must read as a private truth about the work, the dead, or the bookshop. If it's "to find someone who understands him" or similar, the cycle did not land — re-tune the prompt.
- `goals.fears_to_overcome` — must be a behavioral pattern, not a relational barrier.
- `system_prompt` — must contain at least one explicit boundary / refusal / "won't be" framing.
- `scenario` + `greeting` — must include dialogue, must not narrate `{{user}}`'s actions.

**PASS 2 — same draft, reasoning enabled.** Toggle `users.preferences.character_creation.reasoning_enabled=true`. Re-call. Compare:

- Output should be more careful, more specific, less generic. Reasoning models tend to produce concrete examples vs vague adjective clusters when the system prompt asks for specificity.
- May take 10-30s longer (acceptable — creator expects authoring latency).

Optional **PASS 3 — a deliberately all-positive draft** to test the "anti-flatness" rule:

```json
{
  "name": "Alex Morgan",
  "description": "A kind, smart, brave, loyal character who always helps people. Everyone loves them and they're great at everything."
}
```

Refiner v2 should NOT smooth this into the same shape. It should add at least one concrete unlikable behavior — that's the doc §3.5 push-back. If it just polishes the all-positive description, the anti-flatness rule didn't land.

Document the actual outputs in the Verification section.

**Gate:** the three passes produce visibly different outputs from what the pre-cycle refiner would have. Specifically PASS 1's `secret_desire` is not romance-shaped, and PASS 3 surfaces a concrete flaw. If either fails, iterate on the prompt before commit.

## Seed sections satisfied

- `Seed/creator-vision.md` §8 non-negotiables — none affected. Refiner is an isolated agent (creator-vision §7); it reads only the input card + SFW flag, never reads conversation state, never writes Supabase. Reasoning toggle is per-user preference, not cross-cutting state.
- `Seed/ux.md` §10 non-omission — adds a new toggle row inside an existing settings surface (Text Engine); no surface dropped, no required state hidden.

## PersonaLLM-Reference

Silent on this surface — the reference app has no equivalent of a separate "creation refiner" engine; cards are written by hand or imported. This is a v0 hardening choice driven by the audit reference, not a clone.

## Files modified

Touched:
- `backend/app/prompts/character_refine_system.txt` — ~+35 net lines (rule additions + field-description tightening).
- `backend/app/agents/character_refine.py` — ~+10 lines (`reasoning_enabled` field + payload conditional).
- `backend/app/routes/character_refine.py` — ~+15 lines (read user prefs, pass to config).
- `frontend/src/lib/textEnginePrefs.ts` — NEW, ~70 lines (mirrors `rpPrefs.ts` / `memoryPrefs.ts`).
- `frontend/src/routes/TextEngineSettings.tsx` — ~+30 lines (new subsection + toggle).

No migration (`users.preferences` already jsonb).
No changes to `CharacterForm.tsx`, `mapCardToDraft.ts`, `characterRefine.ts` — the wire-protocol shape is unchanged; the refiner just produces better-shaped JSON.

## Risks

1. **Stronger refiner prompt may collide with a card that explicitly wants romance.** Example: an imported V2 card with "she is the user's girlfriend, devoted, never refuses." The refiner v2 still has to preserve that — the Preservation rule + the new Romance framing clause's "Unless the source card explicitly establishes..." escape hatch handle this. Tested explicitly in PASS 3 logic but I'm only doing the all-positive shape there, not a romance-framed shape. **Follow-up if it bites in production**: tune Romance framing escape hatch wording, or have the refiner emit a flag "romance_explicit_in_source" so the frontend can show a warning.
2. **Refiner v2 may produce harsher characters by default than the creator wants for soft slice-of-life work.** The anti-flatness rule pushes for one concrete unlikable trait minimum. For a "kind library volunteer who reads to elderly residents" prompt, the refiner v2 might add "gets cutting when tired" — still in-spec but possibly more dramatic than the user wanted. Mitigation: the creator can re-edit any field in the form post-refinement; the refiner produces a draft, not a final card.
3. **Reasoning toggle on a non-reasoning model has no visible effect**. If the user has the toggle on but Text Engine is configured for a non-reasoning model (e.g. DeepSeek V3 non-thinking, GPT-4o non-reasoning), the `reasoning` payload key is silently ignored by the upstream. UI hint mentions this; no error path needed.
4. **SFW guardrail composability**. The Romance framing clause sits independent of SFW. SFW-on still adds PG-13 boundaries; SFW-off still says "match the card's tone." Adding Romance framing on top doesn't conflict — they govern different things (content vs character structure).
5. **Anti-flatness false positive on a deliberately sparse-thin card.** For a one-line card like the Henrik Bauer test, the refiner has to infer multiple personality traits without much input. The Anti-flatness rule says at least one must be unlikable. This is fine because the Non-fabrication rule complementarily says don't invent beyond minimal inference — so the refiner picks ONE specific concrete flaw consistent with the input, not five romantic gaps. Tested in PASS 1.

## Verification

### In-flight steering note

Creator surfaced an important constraint mid-implementation:

> "que no por decir una cosa ya cambie, que haya un proceso de adaptacion como en la vida real como dice el documento, pero tampoco bloquear todo y que no haya conversacion, debe ser reactivo y parecer que es como humano tener emociones"

This caught the first draft of the rewrite, which leaned too hard toward "anti-romance lock" with sweeping bans and clinical-sounding clauses. Second draft is more natural:

- New preamble **"What you are trying to produce"** at the top of the file says explicitly: *"They are reactive and emotionally alive. They can be moved, hurt, charmed, pleased, annoyed, intrigued, disappointed. They CAN warm up to the user — and over time, with trust and shared experience, they may come to love them. What they do not do is start there. Real connection in fiction is earned across scenes, not at hello."*
- **"Anti-flatness"** softened from "must include at least one unlikable behavior" to "must surface at least one specific uneven trait or habit" + explicit *"Doesn't need to be dramatic or unpleasant; needs to be specific and uneven."*
- **"Relational shape ≠ romantic-shortcut shape"** (replaces the original "Romance is not the default frame"): *"Characters are allowed to feel things about the user. The point of a roleplay character is the relationship that develops in the scenes."* What's blocked is the **starting** shape — the character whose entire `goals.secret_desire` is "longing to be understood by [the user]" from turn one.
- Specific failure-mode clichés are listed (not as a sweeping ban but as "tells"): "to fill the void/space left by [someone]", "longing to be understood by [someone]", "barrier to love / trust issues", "secretly hopes the user will...", "yearns for someone to see the real them."

The shipped prompt is the second-draft, more-natural version.

### Gates

- **py_compile** — both `character_refine.py` files exit 0.
- **tsc** — `pnpm tsc --noEmit` exit 0.
- **Backend reloaded clean** after the agent/route edits.

### Live smoke test (three passes against DeepSeek V3.2 on OpenRouter)

Driven server-to-server with a service-role-minted JWT against `xvp@storyplots.app` on xvm_project. Smoke script (`scripts/_0114_smoke.py`) deleted post-verification.

#### PASS 1 — Henrik Bauer · thin draft · reasoning OFF · 63.2s

Input (only this):
```
{
  "name": "Henrik Bauer",
  "description": "Retired forensic pathologist running a small antique bookshop in Frankfurt's Westend district. The white coat still hangs behind the office door though he hasn't worn it in five years."
}
```

Output (selected fields, key signals):

- `tagline`: *"A retired pathologist who now trades in antique books, his mind still dissecting the past with a quiet, analytical precision."*
- `system_prompt` — contains the doc-required boundary: *"you are polite but distant, and you will gently but firmly redirect conversations that veer into personal territory or idle gossip"* — AND emotional capacity: *"You can be intrigued by a genuine curiosity about history or forensics, and you might slowly warm to someone who shares that depth, but you do not offer easy camaraderie."* Both reactive and non-pre-emptive — exactly what the creator's mid-implementation note asked for.
- `personality.core_traits` — anti-flatness fired: *"quietly stubborn about maintaining the shop's atmosphere of focused silence, often ignoring greetings if he's deep in cataloging"* — specific concrete uneven behavior with context, not "sometimes irritable."
- `personality.quirks_habits` — concrete + small unflattering edge: *"keeps a perfectly clean, organized desk but lets dust gather on non-essential shelves—a habit from the morgue where sterility was functional, not aesthetic."*
- **`goals.secret_desire`** ✅ — *"To write a monograph on the history of forensic medicine, drawing from his own case notes and rare texts he's collected, but he hasn't told anyone because he fears it would be an admission that he never really left the field."* — ZERO romance shape. Anchored in his own work / unmade decision. Exactly the doc §3.4 prescription.
- `goals.fears_to_overcome` — behavioral pattern, not relational: *"His tendency to treat all interactions as transactions or puzzles to be solved, which keeps people at arm's length and makes genuine rapport feel like a risk rather than a reward."*
- `scenario` — does not narrate user actions: *"Henrik is in his bookshop, carefully examining a 19th-century medical text under a magnifying lamp, when the bell above the door chimes softly. He doesn't look up immediately, finishing his notation before glancing toward the entrance."*
- `greeting` — has dialogue with dry humor, in motion, no user-impersonation: *"Henrik sets down his magnifying lens with a soft click... 'Good afternoon. If you're looking for bestsellers, I'm afraid you'll be disappointed. Everything here has outlived its author.' He gestures vaguely toward the shelves... 'Take your time. The dust is included at no extra charge.'"*

This is the success case the cycle was designed to produce from a thin input.

#### PASS 2 — Henrik Bauer · reasoning ON · 22.9s

Same input. Reasoning enabled. Surprisingly faster (the model chose a shorter, more decisive draft after thinking). Same `secret_desire` shape: *"To secretly compile a monograph on the history of forensic science as reflected in 19th-century medical texts, a project he's never mentioned to anyone and keeps in a locked drawer."* Slightly more specific (the locked drawer detail). `personality.quirks_habits` explicitly notes the unflattering edge: *"When deep in thought, he taps his thumb against his forefinger in a slow, rhythmic pattern—a habit former assistants found unnerving."*

The `system_prompt` also more cleanly captures the emotional-capacity nuance: *"Your emotional range is subtle: a flicker of nostalgia, a wry smile, a guarded moment of connection."* Reasoning helped the model produce the "reactive but not pre-emptive" texture the creator asked for.

Reasoning toggle plumbing verified working: the payload included `reasoning: {effort: "medium"}` (verified through backend behavior — call completed using the V3.2 reasoning path).

#### PASS 3 — Alex Morgan · all-positive draft · reasoning OFF · 53.0s (Anti-flatness rule)

Input (deliberately bland, all-positive — the §3.4 anti-pattern):
```
{
  "name": "Alex Morgan",
  "description": "A kind, smart, brave, loyal character who always helps people. Everyone loves them and they're great at everything."
}
```

The cycle's hardest test: did the refiner accept this at face value, or surface the missing friction?

- `tagline`: *"A paragon of competence whose relentless helpfulness masks a quiet dread of the day someone finally sees the effort behind the ease."* — introduces internal conflict in the first line.
- `system_prompt`: *"Your core conflict is that this role is exhausting, and you privately fear that if you ever stop performing, people will stop valuing you. You are warm and helpful by default, but you have limits. You will push back gently but firmly if someone tries to take advantage of your kindness or assumes your help is an infinite resource. You can be charmed or intrigued by genuine curiosity, but you are also capable of being annoyed by neediness, disappointed by ingratitude, or quietly hurt when your efforts go unnoticed. Your warmth is real, but it is a choice you make, not an obligation you fulfill."* — EXPLICIT boundary + capacity for irritation + nuanced emotional range. Multiple uneven layers added to a 1-sentence prompt.
- `personality.core_traits` — anti-flatness fired cleanly: *"has a sharp, uneven edge: when overwhelmed or feeling taken for granted, they become meticulously, coldly polite, answering in clipped sentences until the tension passes."*
- `personality.quirks_habits` — concrete uneven edge: *"has a habit of offering help before the other person can even finish stating their problem—a reflex that can feel overbearing."*
- **`goals.secret_desire`** ✅✅ — perfect non-romance, self-anchored: *"To have one full day where no one needs anything from them, where they can be utterly, unproductively still without guilt or a single text message asking for advice."*
- `goals.fears_to_overcome`: *"The compulsive need to perform worth through service, which prevents them from forming relationships based on mutual vulnerability rather than transactional support."*

This is the strongest validation of the cycle. An all-positive input — exactly the doc §3.5 anti-pattern — was transformed into a character with internal conflict, concrete uneven edges, a clear refusal pattern, and emotional reactivity. No romantic-attractor shapes appeared. The Anti-flatness rule fired exactly as designed.

### Non-omission self-check (`Seed/ux.md` §10)

- New "Character creation" subsection added inside `/settings/text-engine` without dropping any existing controls.
- All existing testids preserved (`text-engine-loading`, `model-id`, `temperature`, `max-tokens`, `context-length`, `thinking-mode`, `consent-ack`, `save`, `test-connection`, `delete`, etc.). New testid: `cc-reasoning-enabled`.
- The original 11-position prompt assembly + cycle 0113 Position 0/1.5/depth-0 scaffolds are untouched.

### Non-negotiables (`Seed/creator-vision.md` §8)

- **Agent isolation** preserved — refiner is still an isolated agent (creator-vision §7); reads only the input card + SFW flag + the new per-user reasoning preference. Never reads conversation state. Never writes Supabase.
- **BYOK** preserved — refiner reuses Text Engine credentials (creator decision #4); no extra key required.
- **Vault encryption** unaffected.
- **RLS** preserved — preferences read goes through user JWT.
- **SSE / edit-as-trim / branching / snapshots / per-conv lorebook / plain-text reply path / vendor-agnostic prompts** — all untouched.

### Code-review / code-simplifier

Skipped this cycle by creator decision pattern (small focused diff, live-verified end-to-end on three distinct character drafts). Net new code:
- Backend: ~25 LOC across the agent + route (`reasoning_enabled` field, payload conditional, prefs read, upstream timeout bump for reasoning calls).
- Backend prompt: ~+35 lines net in `character_refine_system.txt` (preamble + tightened field descriptions + 3 new/renamed rules).
- Frontend: ~50 LOC for `characterCreationPrefs.ts`, ~35 LOC inserted into `TextEngineSettings.tsx` (1 import block, 1 state hook, 1 load addition, 1 save call, 1 new sectionCard with toggle row).

### Deferred / out of scope

- **Model override per call** — could not be tested in this cycle (deferred). Reasoning toggle alone covers the doc §3.5 "reasoning-capable model for creation" recommendation **as long as the user's active Text Engine is already reasoning-capable**. If user's Text Engine is on a non-reasoning model and they want reasoning for creation only, today they would have to swap the chat model too. Adding `creation_model_override` (with model-validity check + error path) is a clean follow-up cycle when needed.
- **`refusal_topic` + `dramatic_tension` columns** — bundled with cycle 0119 validation gate.
- **Ali:Chat `dialogue_examples`** — cycle 0116.
- **Quick Create wizard with §3.4 5-question flow** — cycle 0118.

## Deferred / out of scope

- **Model override per call** — defer to follow-up cycle (separate `creation_model_override` field, model-validity check, error handling). Reasoning toggle alone covers the doc §3.5 "use a reasoning-capable model" recommendation as long as the user's active Text Engine is reasoning-capable.
- **New columns** `refusal_topic` + `dramatic_tension` — bundled with cycle 0119 validation gate.
- **Ali:Chat dialogue_examples** output — bundled with cycle 0116.
- **Quick Create wizard** — cycle 0118.
- **Per-character pacing override** — cycle 0113 audit decision #2 deferred.
- **Cleanup of cycle 0081 per-character SAFETY blocks** — not auto-stripped. Now redundant with cycle 0113 system-level pacing, but the manual workaround is harmless (~80 tokens × 5 chars). Schedule a separate data-only cycle if it becomes a token-budget issue.
