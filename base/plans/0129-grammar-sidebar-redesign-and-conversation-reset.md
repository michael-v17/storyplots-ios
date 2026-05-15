---
id: 0129
slug: grammar-sidebar-redesign-and-conversation-reset
status: shipped
created: 2026-05-14
---

# Cycle 0129 — Grammar sidebar: redesign + per-conversation reset

## Context

Creator feedback on the in-chat Grammar sidebar panel:
1. "el grammar debe tener solo lo de la conversacion actual" — concern that it
   shows more than the current conversation.
2. "piensa como diseñador para ver como puede verse mejor" — the panel reads
   like a flat debug dump; wants a real visual pass.

**On (1):** verified the data IS already correctly scoped — the network call is
`grammar_corrections?select=*&conversation_id=eq.<id>&order=created_at.desc`, so
the DB cannot return other conversations' rows. The corrections shown are all
genuinely from the standing test conversation (accumulated across cycles 0126 +
0128). BUT: `ChatShell` is not remounted on conversation change (no `key=`), and
`corrections` state is not cleared at the top of the load effect — so there is a
transient window where the previous conversation's corrections render until
`listCorrectionsForConversation` resolves. Worth a defensive reset.

## Shape

Frontend-only, 3 files, no schema/backend/migration/dep.
- `ChatShell.tsx` — clear `corrections` when `conversation.id` changes.
- `GrammarSidebarPanel.tsx` — visual redesign (cards, diff highlight, category
  chips, header summary).
- `GrammarInlineRow.tsx` — re-theme the correction highlight to `--char-accent`.

### Creator follow-up (during the design sign-off)

The diff highlight + accents used `--sp-brand-1` (the generic brand amber).
Creator wants the grammar-correction colour to be the **conversation's character
accent** (`--char-accent`) so it reads as part of the chat, not a foreign UI
colour. Both surfaces live inside the ChatShell root that sets
`--char-accent: character.accent_color`, and the existing scenario-card pills +
action-rail chips already use `--char-accent` as a foreground colour — so this
is consistent precedent, not invention. Swap `--sp-brand-1` → `--char-accent`
for: inline-row changed-word colour + its left accent bar; sidebar changed-word
colour + the header count pill. (The overlay sidebar is `position: fixed` but
still a DOM descendant of the ChatShell root, so it inherits `--char-accent` —
unlike the portaled ImageViewer.)

## Seed sections satisfied / touched

- `Seed/ux.md §4.6` Chat → Grammar Panel — "plain-text `original → corrected`
  pairs (two lines per pair, newest first), **mini per-Conversation summary**,
  'Clear grammar for this Conversation' action". The redesign **adds the
  mini per-Conversation summary** (correction count) — a seed-required element
  currently missing. The explanation line (added in commit `8ac371e`) and the
  `error_categories` chips are creator-approved v0 extensions on top of the
  seed's "two lines per pair".
- `Seed/creator-vision.md §8` non-negotiable — **per-Conversation scoping**:
  reinforced by the reset. The Grammar Panel must only ever surface the active
  Conversation's corrections.
- Homologous: `Seed/PersonaLLM-Reference/06-chat-interaction-model.md` (grammar
  surfaces in-chat).

## Domain invariants

- Per-Conversation scoping (Lorebook/grammar are conversation-scoped, not
  global) — PRESERVED + reinforced. No cross-conversation read introduced.
- Grammar Agent isolation — untouched (this is a render/state change only).

## Schema / RLS

None.

## Frontend

### Part A — `ChatShell.tsx`: clear corrections on conversation change
- At the top of the `[conversation.id, userId]` load effect, before the async
  loads, call `setCorrections({})` so the panel/inline feed never shows the
  previous conversation's rows during the load window. The effect then
  repopulates from `listCorrectionsForConversation(conversation.id)`.
- **Verify:** Playwright — open conv A with the sidebar on, switch to conv B;
  assert the sidebar never shows A's correction text once B is active (and is
  empty/repopulated immediately, no stale flash).

### Part B — `GrammarSidebarPanel.tsx`: visual redesign
All token-driven (`colors_and_type.css` custom props via `tokens.css`):
- **Header**: "Grammar" title + a count pill ("N") = the seed's mini summary.
  Keep the close X in overlay mode.
- **Correction cards**: each correction renders as a card — `--sp-bg-3`
  background, `1px solid --sp-border-soft`, `--sp-radius`, padding, list
  separated by `gap` (drop the `border-bottom` divider pattern).
  - **Corrected text** — primary line, `--sp-fg`; added/changed words highlighted
    in `--sp-brand-1` via `diffWords().addedTokens` (consistency with
    `GrammarInlineRow`).
  - **Original text** — secondary, smaller (`~0.8em`), `--sp-fg-3`; changed words
    struck via `diffWords().removedTokens`.
  - **Explanation** — "why:" note, `--sp-fg-3`, small; only when present.
  - **Category chips** — `error_categories` as small pills (`--sp-bg-2` +
    `--sp-border-soft` + `--sp-fg-3`), labels humanized (`verb_tense` →
    "verb tense"). Only when non-empty.
- **Clear button** — unchanged (destructive ghost pill).
- **Empty state** — slightly more cared-for ("No corrections in this
  conversation yet.").
- Shared `body` JSX so inline (L) + overlay (S/M) both get the redesign.
- **Verify:** Playwright L=1440 (inline) + S=375 (overlay) — cards render,
  diff highlight present, chips present where categories exist; **screenshot
  shown to the creator at monitor size for explicit visual sign-off before
  commit** (per the visual-approval rule).

## Verification gates

- **GA** — switching conversations clears the sidebar; no stale flash.
- **GL** (L=1440) — redesigned cards render: header count, corrected w/ amber
  diff, struck original, why-note, category chips; Clear button intact.
- **GS** (S=375) — overlay mode shows the same redesign, usable, within viewport.
- **GR** — Mode A rows (no explanation) render fine without the why-note;
  corrections with no `error_categories` render without a chip row;
  `filterByFrequency` still applied (every / every_3 / every_5 / major_only).
- `npx tsc --noEmit` clean.
- **Visual sign-off** — creator OK on the L screenshot before commit.

## Implementation order

1. Part A — `ChatShell.tsx` reset → GA.
2. Part B — `GrammarSidebarPanel.tsx` redesign → tsc, GL/GS/GR Playwright.
3. Screenshot → creator visual sign-off.
4. `code-review` + `code-simplifier` → commit.

## Critical files

- `frontend/src/features/chat/ChatShell.tsx` — `setCorrections({})` reset.
- `frontend/src/features/chat/GrammarSidebarPanel.tsx` — redesign.

## Out of scope

- The `/grammar` Dashboard (separate macro surface, all-conversations by design).
- Decoupling explanation-generation from inline Mode A/B (noted in the
  `8ac371e` handoff entry as a possible future follow-up).
- `key={conversation.id}` remount of `ChatShell` — a broader fix for the whole
  stale-state class; deferred, the targeted `setCorrections({})` reset covers
  the grammar surface this cycle is about.

## Verification

Verified live against backend :8000 + Vite :5173 + hosted Supabase, signed in.

**GA — per-conversation scoping**
- ✅ Confirmed via DevTools network that `listCorrectionsForConversation` was
  already scoped (`grammar_corrections?...&conversation_id=eq.<id>`). The
  "showing other conversations" perception was accumulated test data in one
  standing test conversation, not a leak.
- ✅ Client-side switch Valeria → Tomás Lecuona: the settled sidebar shows only
  Tomás's 1 correction ("Wat are you doing?"), `hasValeriaText: false`. The
  `setCorrections({})` reset clears the prior conversation's rows immediately
  on conversation change instead of letting them linger through the load window.

**GL (L=1440×900)**
- ✅ Redesigned cards render: header "Grammar" + count pill, "N corrections in
  this conversation" summary, per-correction cards (struck original via
  `diffWords.removedTokens`, corrected line with changed words highlighted via
  `diffWords.addedTokens`, "WHY" note, humanized `error_categories` chips),
  Clear button intact.
- ✅ Highlight re-theme: on Tomás Lecuona (`--char-accent: #B45309`) the inline
  changed word, the inline left accent bar, the sidebar changed word, and the
  count pill all compute to `rgb(180, 83, 9)` = `--char-accent`. Matches the
  chat's accent (user bubble, action rail) instead of the generic brand amber.

**GS (S=375×812)**
- ✅ Overlay mode renders the same redesigned cards; panel measured 360px wide,
  `left: 15 / right: 375` — within the viewport after the `box-sizing:
  border-box` fix (was ~393px / overflowing before).

**GR (regression / robustness)**
- ✅ `filterByFrequency` still applied (count pill + summary track the filtered
  list).
- ✅ Cards with no `error_categories` render without a chip row; the "why" note
  only renders when `explanation` is present (Mode-A rows render clean).
- ✅ Post-fix re-check: card does not overflow (`scrollWidth ≤ clientWidth`),
  panel within viewport, 0 console errors.

`npx tsc --noEmit` clean throughout.

**code-review** — 3 findings, **all APPLIED**:
1. (conf 95) `key={c.id}` was unsafe — SSE-inserted optimistic corrections carry
   `id: ""`, so two in a session collide. Switched to `key={c.user_message_id}`
   (the `corrections` Record is already keyed by it → unique).
2. (conf 88) the corrections list + card used `display: grid` single-column —
   the documented `feedback_grid_overflow_pattern` gotcha (hit at 0075, 0108).
   Switched the list wrapper + card to `flex column`, added `minWidth: 0` +
   `overflowWrap: break-word` to the card.
3. (conf 82) pre-existing: `onEditConfirm` (edit-as-trim) pruned
   `variantsByMessage` but not `corrections` — trimmed-away messages' grammar
   rows lingered until reload. Hoisted the shared `toDrop` set and prune
   `corrections` too, mirroring `onRegenerate`. Reinforces the edit-as-trim +
   per-Conversation invariants.

**code-simplifier** — 0 changes. The one duplication (the `DiffToken[]` render
loop, 3× across 2 files) is not worth extracting: a shared component would need
a new module + a `highlightStyle` prop threaded from each call site and would
cross the deliberate `GrammarInlineRow` / `GrammarSidebarPanel` file boundary —
net more surface, not less. Style objects already hoisted to module scope.

Non-negotiables: per-Conversation scoping **reinforced** (reset on conversation
change + edit-as-trim prune); edit-as-trim correctness improved. No SSE /
agent-isolation / schema path touched. Visual sign-off: creator approved the L
+ S screenshots and the `--char-accent` re-theme before commit.
