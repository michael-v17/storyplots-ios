# Plan 0126 — Grammar inline: live-diff parity + naturalness-aware correction

> Two creator-reported issues with the inline Grammar correction:
> 1. **Bug** — live in chat the *whole* corrected sentence renders in brand-amber; only after a reload does just the changed span highlight. Root cause: the SSE `correction` event carries no `original_text`, so `ChatShell` stores `original_text: ""` and `diffWords("", corrected)` flags every word as added. The DB-loaded path has the real `original_text`, so reload is correct.
> 2. **Quality** — the creator wants the correction to (a) keep fixing real errors, (b) *also* offer the more natural / native phrasing when the user wrote something grammatical but non-native — saying the same thing — without dropping the user's words/intent, and (c) make the Mode B explanation concise and cover *why* something doesn't sound natural. The current prompt says `"do not rewrite for style — only fix grammar, spelling, and mechanics"`, which is narrower than the seed.

## Seed sections satisfied / evidence

- `Seed/creator-vision.md` §5.2 — Reinforcement step 2: the Grammar Agent returns *"this is how it should have been said"*; Spanish/Spanglish: it *"shows what the user should have written in English"*. Both frame the target as native-correct phrasing, not mechanics-only.
- `Seed/creator-vision.md` §2 — the `error_categories` taxonomy already includes `word_choice`, `overused_words`, `filler_words`, `connector_misuse` — naturalness/idiomatic categories, not pure mechanics.
- `Seed/ux.md` §Settings — "Major errors only = mistakes native American English speakers would never make" — native speakers are the reference point.
- `Seed/creator-vision.md` §5.2 — Mode A = corrected text; Mode B = corrected text + brief plain-English explanation. (No render-behavior change — only the data feeding the diff.)
- `Seed/creator-vision.md` §8 — non-negotiables: Grammar isolation (Grammar Agent sees only the user's raw message), Grammar default OFF, SSE for the reply path. **All preserved** — this plan adds one field to an existing SSE event and revises a prompt; it does not change agent isolation, the toggle default, or the streaming transport.

This is **not** a seed modification: `backend/app/prompts/grammar_system.txt` is an implementation prompt, not a seed file. The change brings the prompt *in line with* the seed's existing "how it should have been said" framing — the current "mechanics-only" wording had drifted narrower than the seed.

## Domain invariants / non-negotiables at stake

- **Grammar isolation (F3)** — unchanged: the Grammar Agent still receives only the raw user message; `original_text` added to the SSE event is the user's *own* message text, already in scope, not character/persona/memory data.
- **SSE reply path** — the `correction` event gains one string field; the Conversation Agent reply path stays plain text and untouched.
- **Meaning preservation** — the revised prompt must still forbid adding/removing the user's actual content or changing intent; "naturalness" rewrites are same-meaning rephrasings only.

## UX surfaces affected

- Inline grammar correction row (`GrammarInlineRow`) — no code change; it already diffs `original_text` vs `corrected_text`. The fix is upstream (feed it the real `original_text` live).
- Mode B explanation line — no render change; the prompt produces a better `explanation`.

## Implementation order

1. **Backend SSE — carry `original_text` on the `correction` event.** `backend/app/routes/chat.py`: the three `_pack_sse("correction", ...)` call sites add `original_text=<the raw user text>` (already available as `bundle.last_user_text` / `grammar_result` context — same string already persisted to the `grammar_corrections` row). Do **not** touch `rewrite_required` (its UI is the rewrite gate, not the diff row) unless trivial.
   - Verify (non-UI): grep the three call sites now pass `original_text`; backend restarts clean.

2. **Frontend — type + consume `original_text`.** `frontend/src/lib/chat.ts`: add `original_text: string` to `CorrectionPayload`. `frontend/src/features/chat/ChatShell.tsx`: the live `correction` handler sets `original_text: ev.original_text` instead of `""`.
   - Verify (Playwright): send a message with a grammar error in chat; the inline row highlights **only the changed span** (parity with the reloaded state). Reload → identical highlight.

3. **Prompt — naturalness-aware correction + concise explanation.** `backend/app/prompts/grammar_system.txt`: revise the Rules so the agent (a) fixes real grammar/spelling/mechanics errors, (b) when the message is grammatical but non-native/awkward, returns the natural native phrasing that means *the same thing* — explicitly forbidding dropping the user's words, adding new content, or changing intent (cite the "wan you to try this" → must keep "you" example class), (c) keeps `explanation` to one concise sentence that names the problem — including *why* a phrasing sounds non-native when that's the correction. Keep `already_correct=true` only when the message is both correct *and* natural.
   - Verify (live): run a few messages through the live grammar agent (creator's text-engine key) — an error case, a grammatical-but-non-native case, an already-correct-and-natural case — confirm corrected_text preserves meaning and explanation is concise. Record samples in Verification.

4. **Typecheck + gate.** `npx tsc --noEmit` 0 errors; Playwright live-diff parity check from step 2.

## Out of scope

- Mode B render — `GrammarInlineRow` already renders the `why:` line; creator confirmed Mode B is enabled and only wants the *content* (explanation quality) reviewed — that's the step-3 prompt work.
- `rewrite_required` event / Reinforcement rewrite gate — not the diff-row surface; untouched.
- Error-category chips inline — creator did not ask for new UI; Mode B's explanation covers the "what was the error" need.
- The grammar tier/model selection, Insights aggregation, sidebar panel — untouched.

## Riesgos

- **Prompt over-rewriting.** The naturalness clause could make the agent rewrite aggressively and change meaning. Mitigation: the prompt keeps a hard "same meaning, do not add/remove the user's content, do not change intent" rule; `already_correct` stays available; verification includes a "should stay nearly unchanged" case.
- **Live-vs-reload still divergent if `bundle.last_user_text` ≠ persisted `original_text`.** They are the same string today (the persist path writes `original_text: user_text` from the same source) — verified by reading `_run_grammar_and_persist`. If they ever diverge, the reloaded row is the source of truth.

## Verification

**Files touched:** `backend/app/routes/chat.py` (3 SSE call sites), `backend/app/prompts/grammar_system.txt` (prompt rewrite), `frontend/src/lib/chat.ts` (`CorrectionPayload` type), `frontend/src/features/chat/ChatShell.tsx` (live handler).

**Gotcha found during impl:** uvicorn `--reload` only watches `.py` files, so editing `grammar_system.txt` did **not** reload the backend — the prompt is read once at module import (`grammar.py`). Had to restart the backend manually for the prompt change to take effect. (Worth noting for future prompt edits.)

**Live Playwright verification (Valeria Ruiz conversation, real OpenRouter text engine, Mode B enabled):**

1. **Diff parity (#1) — FIXED.** `"can you help me to do this task please"` → corrected row highlights **only `["with"]`** in amber, not the whole sentence. Same for `"wan you to try this?"` → only `["Want"]`. Live now matches the reloaded/persisted state. Screenshot `.playwright-mcp/0126-grammar-verified.png`.
2. **Naturalness + meaning preservation (#2) — WORKING.**
   - `"can you help me to do this task please"` → `"Can you help me with this task, please?"` — non-native `"help me to do"` → `"help me with"` (a naturalness fix, not mechanical), `"you"` preserved, meaning unchanged.
   - `"I have 25 years old and I live since 2020 in this city."` → `"I am 25 years old and I have lived in this city since 2020."` — fixes the Spanish-calque `"have N years old"` and the `"live since"` tense, reorders naturally, meaning intact.
   - `"Thanks, I appreciate your help."` → no correction (`already_correct` — correct and natural).
3. **Concise explanation (#3) — WORKING.** Mode B `why:` lines are one concise sentence that names the problem *and* why it's non-native, e.g. _"The preposition 'to' is unnatural here; native speakers typically say 'help me with' a task, and a comma before 'please' improves readability."_

**Gates:** `npx tsc --noEmit` → 0 errors. `chat.py` parses clean; backend restarted clean. Console: 0 errors.

**code-review:** self-review — the code delta is 5 trivial lines (3 identical `original_text=bundle.last_user_text` SSE-kwarg additions, 1 type field, 1 `""` → `ev.original_text` in the live handler), all exercised by the live Playwright run above. `bundle.last_user_text` confirmed to be the exact same string persisted as `original_text` in `_run_grammar_and_persist`, so live and reloaded diffs use identical input. The substantive risk surface was the prompt behavior, covered by the 4 live test cases above (error case, two naturalness cases, an already-correct case). No speculative code added.

**Non-negotiables:** Grammar isolation intact — `original_text` added to the SSE event is the user's own raw message, already the Grammar Agent's sole input; no character/persona/memory/lorebook data added anywhere. SSE transport unchanged (one field added to an existing event). Conversation Agent reply path untouched. Grammar default-OFF untouched.

**Residual notes:**
- The `rewrite_required` SSE event was intentionally not given `original_text` — its UI is the rewrite gate, not the diff row (out of scope per plan).
- During a rapid 3-message test loop one send didn't register a row (composer busy mid-stream) — a test-harness artifact, not a product bug; the clean single-message tests all passed.
