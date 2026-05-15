---
id: 0128
slug: grammar-correction-style-literal-vs-natural
status: shipped
created: 2026-05-14
---

# Cycle 0128 — Grammar: correction-style setting (Literal vs Natural)

## Context

Creator feedback on inline grammar: the corrections fix outright errors but
keep the user's literal phrasing — and the creator writes English that reads
like literal Spanish translations ("she continue thinking while she reach
home" → currently just "She continued thinking while she reached home", a
tense fix). The creator wants a **choosable correction style**: a Literal mode
that only fixes clear errors, and a Natural mode that rewrites the message into
the idiomatic phrasing a native American English speaker would use for the same
intent.

Cycle 0126 already pushed `grammar_system.txt` toward naturalness for *everyone*
— but with no user control, and the base prompt still corrects conservatively on
literal-translation phrasing. This cycle makes it an explicit setting.

**Not the seed's "Tier".** `architecture.md §115/§203` define a Grammar Agent
"Tier (Basic/Advanced)" — but that selects a **model ID only** (capability),
not correction behavior. The seed's Tier selector is a separate, still-unimplemented
surface; this cycle does **not** implement or conflate it. Correction *style* is
a new v0 extension on the v0 Grammar Module, creator-approved this session.

## Shape

Adds one pref (`correction_style: "literal" | "natural"`, default `"natural"`),
one UI control in `/settings/grammar`, threads it backend → grammar agent, and
restructures `grammar_system.txt` to be style-neutral with the agent appending
a style block. No migration (`users.preferences` is JSONB). No new dep.

## Seed sections satisfied / touched

- `Seed/ux.md §4.10.11` Settings → Grammar — adds a control to this v0-extension
  settings surface (alongside the existing Inline Mode A/B, Reinforcement,
  model override). Does **not** touch the seed's "Tier" line — that stays a
  documented gap.
- `Seed/architecture.md §118` Grammar Agent execution order — unchanged; the
  agent still runs once per user message, single-pass, isolated. Only the
  system prompt content varies by the new pref.
- `Seed/creator-vision.md §5.2` "how it should have been said" framing — Natural
  mode is the fuller expression of this; Literal mode is the conservative
  subset.
- Homologous: `Seed/PersonaLLM-Reference/01-overview.md` (grammar module base).

## User stories / flows touched

- `Seed/user-stories.md` F1 step 6 / F2 (Reinforcement loop). Per creator
  decision: in Natural mode the **rewrite gate uses the natural rewrite** — no
  special-casing, the gate already consumes whatever `corrected_text` the agent
  produces. The 3-strike cap still releases the gate, so the higher retype bar
  is bounded.

## Domain invariants

- `domain.md §6 #2` Grammar Agent **bidirectional isolation** — PRESERVED. The
  new pref is a style flag in the system prompt; the agent still receives ONLY
  the user's raw message text, no character/conversation context.
- Grammar Master **default OFF** (`creator-vision.md §8`) — PRESERVED. The new
  pref only matters when Master + Inline are on; default `"natural"` does not
  enable anything.

## Schema / RLS

None. `correction_style` is a new key inside the existing `users.preferences`
JSONB `grammar` object. `readGrammarPrefs` (frontend) and the `_GrammarPrefs`
parse in `chat.py` both default missing keys, so existing users transparently
get `"natural"` (= current post-0126 behavior — zero regression).

## Backend

### grammar_system.txt — restructure to style-neutral base
- Remove the naturalness-specific framing baked in by 0126 (the "show how a
  native speaker would have written it / smoothing non-native phrasing" goal
  line, the corrected_text field's "native speaker" wording, the "if grammatical
  but non-native, return idiomatic phrasing" rule, the "already_correct only
  when correct AND natural" clause).
- Keep all shared, style-independent contract: isolation statement, exact JSON
  shape, error categories, the preserve-meaning rules (do not add/drop content,
  do not change who does what, ambiguity → closest literal reading), the
  one-sentence explanation rule.
- The corrected_text / already_correct / explanation field descriptions become
  style-neutral; the appended style block defines *how far* to correct.

### grammar.py — `run_grammar_agent` gains `correction_style`
- New param `correction_style: str` ("literal" | "natural").
- After the existing `mode == "A"` append, append a style block:
  - **literal**: fix only outright errors (grammar, spelling, punctuation,
    capitalization, mechanics, verb tense, agreement, word order). Do NOT
    rephrase text that is free of outright errors even if a native speaker
    would word it differently; preserve the user's wording and structure;
    `already_correct=true` when there are no outright errors.
  - **natural**: in addition to fixing outright errors, rewrite the message
    into the natural idiomatic phrasing a native American English speaker would
    use for the SAME intent — even when the original is grammatically correct
    but reads like a literal translation; restructure freely as long as the
    meaning is identical; `already_correct=true` only when it is already both
    correct AND natural.
- Unknown/missing value defaults to `"natural"`.

### chat.py — thread the pref
- `_GrammarPrefs` dataclass += `correction_style: str`.
- Parse: `correction_style=g.get("correction_style", "natural")`.
- `_run_grammar_and_persist` passes `bundle.grammar.correction_style` to
  `run_grammar_agent`. Reinforcement path needs no change — it already streams
  whatever `corrected_text` the agent returned.

**Verify (backend):** restart uvicorn (the 0126 gotcha — `--reload` does not
watch `.txt`). Direct-invoke / curl the chat SSE for a literal-translation
message under each style; assert `literal` keeps phrasing + only fixes errors,
`natural` rephrases. Confirm the grammar agent still gets no character context.

## Frontend

### lib/grammar.ts
- `GrammarPrefs` type += `correction_style: "literal" | "natural"`.
- `defaultGrammarPrefs()` += `correction_style: "natural"`.
- `readGrammarPrefs` already spreads defaults — no change.

### GrammarSettings.tsx — new control in the Inline card
- Inside the existing "Inline" `sectionCard`, below the Mode A/B radio row, add
  a "Correction style" radio pair: **Literal** ("fix clear errors only — keeps
  your phrasing") and **Natural** ("rewrite like a native speaker — same
  meaning, natural words"). `data-testid` `grammar-style-literal` /
  `grammar-style-natural`.
- One-line note that the style shapes every correction (inline row, sidebar
  panel, dashboard) — it lives in the Inline card because that is the primary
  surface, but it is not inline-only.
- Wired through `patch({ correction_style })` + the existing Save flow.

**Verify (Playwright):** `/settings/grammar` shows the new radios; selecting
Natural/Literal + Save persists (reload → value retained). Live chat at L+S
with Master+Inline on: send the literal-translation example under each style,
assert the inline `grammar-inline-*` row content matches the style.

## Verification gates

- **GB** (backend): GB-a literal mode keeps phrasing, fixes only errors ·
  GB-b natural mode rephrases to idiomatic English, meaning preserved ·
  GB-c grammar agent still receives no character/conversation context (isolation).
- **GL** (L=1440): GL-a settings control renders + saves + persists on reload ·
  GL-b live chat literal vs natural produce visibly different inline rows.
- **GS** (S=375): GS-a settings control usable on mobile.
- **GR** (regression): GR-a existing users with no `correction_style` key get
  `"natural"` (= post-0126 behavior) · GR-b Mode A/B still orthogonal (A still
  suppresses explanation under both styles) · GR-c Reinforcement gate still
  fires and the 3-strike cap still releases it.
- `npx tsc --noEmit` clean; backend `py_compile` clean.

## Implementation order

1. **Backend prompt + agent.** Restructure `grammar_system.txt` style-neutral;
   add `correction_style` param + style blocks to `run_grammar_agent`. → GB-a/b/c
   via direct agent invocation with a literal-translation sample.
2. **chat.py thread-through.** `_GrammarPrefs` field + parse + pass to the
   agent. → curl the chat SSE under each style, assert correction differs.
3. **Frontend pref + settings UI.** `lib/grammar.ts` type/default;
   `GrammarSettings.tsx` radio control. → tsc, then GL-a / GS-a Playwright.
4. **Live end-to-end.** Master+Inline on, both styles, the creator's example
   message. → GL-b, GR-a/b/c.
5. tsc + `code-review` + `code-simplifier`.

## Critical files

- `backend/app/prompts/grammar_system.txt` — style-neutral base.
- `backend/app/agents/grammar.py` — `correction_style` param + style blocks.
- `backend/app/routes/chat.py` — `_GrammarPrefs` field + parse + pass-through.
- `frontend/src/lib/grammar.ts` — pref type + default.
- `frontend/src/routes/GrammarSettings.tsx` — settings control.

## Out of scope

- The seed's Grammar Agent **Tier (Basic/Advanced model selector)** —
  still unimplemented; documented gap, not bundled here.
- `GrammarInlineRow.tsx` / `GrammarSidebarPanel.tsx` / `Grammar.tsx` dashboard —
  no change; they render `corrected_text` as-is. (Natural mode will produce
  larger word-diffs in the amber inline highlight — acceptable, it shows the
  rephrase.)

## Verification

Verified live against backend :8000 + Vite :5173 + hosted Supabase, signed in,
on the Valeria Ruiz conversation with Grammar Master + Inline (Mode B) on.

**GB (backend)**
- GB-a ✅ — Literal mode, message "she continue thinking while she reach home"
  → corrected "She continues thinking **while** she reaches home." — only the
  verb agreement fixed, "while" + structure kept. Explanation: "Corrected verb
  tense to present tense for consistency."
- GB-b ✅ — Natural mode, same input → "She continued thinking **until** she
  reached home." — fixes the verbs AND rephrases "while" → "until". Explanation:
  "…'while' is replaced with 'until' for natural temporal flow." Visibly more
  than the Literal fix.
- GB-c ✅ — isolation preserved (code-review confirmed): `run_grammar_agent`
  receives only `user_text` + `mode` + `correction_style`; the new param is a
  plain string flag, carries zero character/conversation context.

**GL (L=1440×900)**
- GL-a ✅ — `/settings/grammar` shows the "Correction style" radio pair
  (`grammar-style-literal` / `grammar-style-natural`) inside the Inline card;
  selecting Literal + Save + reload → Literal still checked (persisted to the
  `users.preferences` JSONB).
- GL-b ✅ — live chat: the two styles produced visibly different inline rows
  (see GB-a/b).

**GS (S=375×812)**
- GS-a ✅ — control renders + usable on mobile; Natural checked, descriptions +
  note readable, within viewport.

**GR (regression)**
- GR-a ✅ — first settings load for the existing test user (no `correction_style`
  key in their JSONB prefs) showed Natural pre-selected → `readGrammarPrefs`
  default applied; backend `g.get("correction_style", "natural")` mirrors it.
- GR-b ✅ — Mode A/B orthogonal: Mode B stayed selected through both Literal and
  Natural tests, explanation shown under both styles.
- GR-c ✅ (by inspection + code-review) — the Reinforcement path is unchanged:
  `_run_grammar_and_persist` is the single shared code path for both the serial
  (reinforcement) and parallel branches; `correction_style` flows through
  `bundle` to both. The gate consumes whatever `corrected_text` the agent
  returns, so Natural mode's rewrite reaches the gate per the creator decision —
  no special-casing needed. 3-strike cap untouched.

`npx tsc --noEmit` clean; backend `py_compile` clean. 0 console errors across
all runs (2 pre-existing React Router future-flag warnings only).

**code-review** — 0 findings. Explicitly confirmed: agent isolation preserved,
Grammar Master default OFF preserved, backward-compat for existing users
(missing key → "natural" on both sides), call-site arg order matches the new
signature, style-block appended before the Mode A explanation-suppression line
(correct precedence), single code path applies the style to inline + sidebar +
dashboard + rewrite gate.

**code-simplifier** — 1 change applied: hoisted the two repeated inline style
objects in the new `GrammarSettings.tsx` radio rows into module-scope consts
`styleRadioRow` / `styleRadioHint`, matching the file's existing style-const
pattern. No behavior change. Backend files: no duplication worth touching.

Non-negotiables: Grammar Agent bidirectional isolation + Grammar Master
default-OFF both preserved. No schema/migration (JSONB pref key). No SSE /
edit-as-trim / agent-isolation code path structurally changed.

### Follow-up — `polish(0128)` commit `9898708`

The first Natural prompt produced only timid rephrases ("she continue thinking
while she reach home" → just `while`→`until`). Creator clarified Natural must
return what a native actually says — no weird/stiff/foreign phrasing — not a
mildly-smoothed original. Rewrote `_STYLE_NATURAL` to be forceful: eliminate
every word-for-word-translation pattern / unidiomatic collocation / clunky
construction, restructure freely so the output reads like natural casual
conversational English, meaning the only hard constraint, with a concrete
before→after example, and `already_correct=true` only when it already sounds
native. Verified live: "I have many years studying English but I want improve
more for not sound weird" → "I've studied English for many years, but I want to
improve more so I don't sound weird." — a genuine native rephrase. py_compile
clean, 0 console errors.
