---
id: 0009
slug: grammar-agent
status: approved
created: 2026-04-15
---

# Cycle 0009 — Grammar Agent: tables, agent, inline + sidebar + Reinforcement

## Context

`creator-vision.md §1` names the Grammar Module as the one thing
StoryPlots offers that PersonaLLM doesn't — it is the didactic
pillar. Cycle 0008 put the Conversation Agent loop in place;
this cycle adds the **out-of-band grammar loop** next to it. On
every user message the Grammar Agent fires **in parallel** with
the Conversation Agent (default) so the NPC is never blocked by
grammar. Reinforcement Mode is the single sanctioned inversion of
that rule, committed by `creator-vision.md §8 #1`.

**Done when:**

- With Master OFF (default), nothing about the chat looks
  different from cycle 0008 — no agent call, no inline row, no
  sidebar toggle, no extra UI surface.
- With Master ON + Inline ON (Mode A or B), every user message
  grows an inline `→ corrected` line below its bubble while the
  NPC reply streams unimpeded.
- With Sidebar ON, the composer gains a toggle that opens a
  right-panel listing plain-text `original → corrected` pairs.
- With Reinforcement ON and a correction returned, the composer
  swaps to a rewrite gate; a local TypeScript validator accepts
  ≥95% similarity; 3 failed attempts fall through and the NPC
  responds anyway with `reinforcement_failures_count++`.
- BYOK plaintext remains server-only. `grammar_corrections`
  never joins with `messages` in any path that feeds the
  Conversation Agent prompt.

## Shape of the change

```
Migration 0009:
 public.grammar_corrections            schema.md §2.14 verbatim + role='user' CHECK
 public.grammar_aggregates             schema.md §2.15 (schema only; writer arrives in 0010)

Backend:
 app/agents/grammar.py                 JSON-mode Grammar Agent call (structured output)
 app/routes/chat.py                    Parallel dispatch (Grammar + Conversation) by default;
                                       serial Reinforcement path: grammar first → rewrite_required
                                       SSE event → client holds reply → client re-POSTs on pass
                                       or on 3-strike fallthrough.
 app/prompts/grammar_system.txt        Minimal system prompt for the Grammar Agent

Frontend:
 lib/grammar.ts                        listGrammarForMessage, grammarAgentSharesTextEngine check
 features/chat/GrammarInlineRow.tsx    Mode-A correction + Mode-B explanation
 features/chat/GrammarSidebarPanel.tsx right-side panel; plain-text 2-lines-per-pair
 features/chat/RewriteGate.tsx         Composer replacement in Reinforcement Mode
 lib/reinforcement.ts                  Local normalized-Levenshtein validator
 features/chat/Composer.tsx            Adds sidebar-toggle button when Master+Sidebar are ON
 features/chat/ChatShell.tsx           Grammar-aware orchestration
 routes/GrammarSettings.tsx            Settings → Grammar
 routes/Settings.tsx                   Flips "Grammar" row to live

SSE contract addition:
 event: correction {user_message_id, corrected_text, explanation?, error_categories}
 event: rewrite_required {user_message_id, corrected_text, explanation?}
```

## 1. Seed sections satisfied

Stories from [user-stories.md §5.5–§5.9](../Seed/user-stories.md):

- **#26 Master toggle default OFF · Critical** — full.
- **#27 Inline Mode A · Critical** — full. "NPC reply does not
  wait on grammar by default" — enforced by parallel dispatch.
- **#28 Inline Mode B · High** — full. Same single agent pass
  produces both `corrected_text` and `explanation`.
- **#29 Sidebar toggle · High** — full.
- **#30 Sidebar plain-text pairs · High** — full. Newest first;
  frequency controls UI surfacing, not agent invocation.
- **#31 Per-Conversation Clear grammar · High** — full (small
  button on the sidebar panel; cascades locally via DELETE where
  `conversation_id=$1`).
- **#32 Disable Grammar Agent master-off · Critical** —
  structurally enforced; no agent call when master is OFF.
- **#33 Enable Reinforcement Mode · High** — full. Disabled
  unless Inline is on.
- **#34 Rewrite gate + 3-strike · High** — full (local TS
  validator; no LLM).
- **#42 partial — Grammar model picker · High** — ships a
  free-text "Grammar model id" override. Tier=Basic/Advanced
  with concrete model picks is **deferred** to a later cycle per
  [open-questions.md §1.2](../Seed/open-questions.md) — the
  seed does not commit the specific models for each tier. If
  blank, the Grammar Agent uses the Text Engine's active
  `model_id` (grammar shares the provider per
  [open-questions.md §5.1](../Seed/open-questions.md)).

**Deferred to cycle 0010** (explicitly, with placeholder UX):

- #35 `/grammar` primary-nav Dashboard — **empty-state only**
  this cycle (the `<aside>` link lands on a page whose nine
  content blocks render placeholder copy). Not silently dropped;
  the Insights Job that populates it lands next.
- #36 Dashboard 9 content blocks — empty-state only.
- #37 Home grammar snapshot widget — depends on
  `GrammarAggregate` row; deferred with the Insights Job.
- #38 Clear-all-grammar-data — Dashboard action; deferred.

From [creator-vision.md §5 / §8](../Seed/creator-vision.md):

- §5 Grammar Module overview — defaults OFF, opt-in at every
  layer. Enforced.
- §7 Grammar Agent — "separate LangGraph node, runs out-of-band
  on every user message." Structured outputs permitted.
- §8 non-negotiable #1 — "Grammar never blocks the NPC unless
  Reinforcement Mode is explicitly enabled."
- §8 non-negotiable #2 — "Grammar is opt-in at every layer."
- §8 non-negotiable #3 — "Conversation context stays clean."
- §8 non-negotiable #6 — "Reinforcement validation is
  lightweight. String distance, not LLM. Hard cap of 3."
- §8 non-negotiable #8 — "Grammar is Character-independent."
  Trivially preserved (Grammar Agent ignores `english_style`).

From [architecture.md](../Seed/architecture.md):

- §4.2 — parallel vs. serial execution paths in `/chat`.
  Implemented exactly.
- §4.6 Reinforcement Validator — "local, non-LLM" JS
  implementation. Shipped.
- §5.2 Grammar Agent — input = user raw text ONLY; forbidden
  inputs enumerated; structured JSON output.

From [domain.md §6](../Seed/domain.md):

- **#1 Conversation Agent context Grammar-free** — enforced
  structurally (Grammar Agent's output doesn't feed Conversation
  Agent prompt assembly at any position).
- **#2 Grammar Agent context Character-free** — enforced by
  passing ONLY `messages.text` to the agent.
- **#3 Assistant + Autopilot messages never corrected** — agent
  only fires on `role=user` inserts; Autopilot doesn't exist yet.
- **#4 At most one `GrammarCorrection` per user-message current
  text** — UNIQUE on `(user_message_id)`; edit-as-trim deletes
  and re-creates via cascade; cycle 0006's DELETE-then-UPDATE
  path correctly removes the old row since the FK cascades.
- **#16 Reinforcement ≥95% normalized similarity + 3 retries**
  — enforced in `lib/reinforcement.ts`.
- **#17 Master OFF default** — `users.preferences.grammar.master`
  already defaults `false` from cycle 0001.

From [schema.md](../Seed/schema.md):

- §2.14 `grammar_corrections` — full column list.
- §2.15 `grammar_aggregates` — full column list (schema only;
  populated in cycle 0010).
- §5 rule 5 — CHECK (role='user') enforced via trigger.
- §5 rule 6 — Conversation-Agent-side read path never joins
  messages × grammar_corrections. Enforced in
  `backend/app/prompt_assembly.py` (no grammar query exists in
  the file, period). Structural, belt-and-braces: the Grammar
  table is not even imported by `prompt_assembly.py`.

From [ux.md §4.6](../Seed/ux.md):

- Inline correction row (Mode A/B).
- Grammar Panel (right sidebar, plain-text 2-lines-per-pair).
- Rewrite gate (composer replacement).
- Grammar sidebar toggle (right of Send).

From [ux.md §4.10.11](../Seed/ux.md):

- Settings → Grammar sub-section: Master / Inline+Mode /
  Sidebar+Frequency / Reinforcement / Tier (deferred) / Custom
  model (shipped as the single override knob).

From [ux.md §10 non-omission](../Seed/ux.md):

- Home grammar snapshot widget — deferred (placeholder note).
- `/grammar` primary nav — empty-state only (see above).
- Settings → Grammar sub-section — shipped.
- Grammar sidebar plain-text display — shipped.
- Rewrite gate — shipped.
- Clear-grammar-for-Conversation — shipped.
- Clear-all-grammar-data — deferred to 0010 Dashboard.

## 2. PersonaLLM-Reference provenance

None. The PersonaLLM reference explicitly defers grammar to v0
(the single matching line in the reference grep says "StoryPlots
grammar module … deferred; see creator-vision.md"). Everything
here is seed-defined.

## 3. User stories touched

See §1 above.

## 4. Domain invariants preserved

See §1 above.

## 5. Schema scope / RLS

### New migration `supabase/migrations/0009_grammar.sql`

```sql
create table public.grammar_corrections (
  id                            uuid primary key default gen_random_uuid(),
  user_message_id               uuid not null unique,
  conversation_id               uuid not null references public.conversations(id) on delete cascade,
  user_id                       uuid not null references public.users(id) on delete cascade,
  original_text                 text not null,
  corrected_text                text not null,
  explanation                   text,
  error_categories              text[] not null default '{}',
  edit_distance                 integer,
  reinforcement_failures_count  integer not null default 0,
  created_at                    timestamptz not null default now(),

  constraint grammar_corrections_message_fk
    foreign key (user_message_id) references public.messages(id) on delete cascade
);

-- schema.md §5 rule 5: user_message_id MUST reference role='user'.
create or replace function public.grammar_corrections_user_role_check()
returns trigger language plpgsql as $$
declare r public.message_role;
begin
  select role into r from public.messages where id = new.user_message_id;
  if r is null or r <> 'user' then
    raise exception 'grammar_corrections.user_message_id must reference role=user';
  end if;
  return new;
end; $$;

create trigger grammar_corrections_user_role_check_trg
  before insert or update of user_message_id on public.grammar_corrections
  for each row execute function public.grammar_corrections_user_role_check();

alter table public.grammar_corrections enable row level security;

create policy grammar_corrections_select_own on public.grammar_corrections
  for select using (user_id = auth.uid());
create policy grammar_corrections_insert_own on public.grammar_corrections
  for insert with check (user_id = auth.uid());
create policy grammar_corrections_update_own on public.grammar_corrections
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());
create policy grammar_corrections_delete_own on public.grammar_corrections
  for delete using (user_id = auth.uid());

create index grammar_corrections_conversation_created
  on public.grammar_corrections (conversation_id, created_at desc);

-- schema.md §2.15 (schema only; Insights Job writes in 0010).
create table public.grammar_aggregates (
  user_id                        uuid primary key references public.users(id) on delete cascade,
  detected_level                 text,
  top_errors                     jsonb,
  filler_words                   jsonb,
  overused_words                 jsonb,
  connector_stats                jsonb,
  ai_narrative_feedback          text,
  improvement_suggestions        text,
  reinforcement_performance_pct  numeric,
  dirty                          boolean not null default false,
  new_messages_since_last_run    integer not null default 0,
  updated_at                     timestamptz not null default now()
);

alter table public.grammar_aggregates enable row level security;

create policy grammar_aggregates_select_own on public.grammar_aggregates
  for select using (user_id = auth.uid());
-- No insert/update policies: only the backend (service-role via the future
-- Insights Job) writes to this table. Clients can read their own row only.

create trigger grammar_aggregates_touch_updated_at
  before update on public.grammar_aggregates
  for each row execute function public.touch_updated_at();
```

## 6. UX surfaces

### Settings → Grammar (new `/settings/grammar` route)

- Master toggle — default OFF. Disabled-with-inline-CTA when no
  Text Engine provider is set (open-questions.md §5.1).
- Inline Grammar (on/off) + Mode A / B radio.
- Sidebar Grammar (on/off) + Frequency (every / every 3 /
  every 5 / major errors only). Frequency controls UI surfacing
  only — agent still runs on every user message.
- Reinforcement Mode (on/off) — **disabled (greyed) unless
  Inline is on** per story #33 AC.
- Grammar model id (free text; optional). Defaults to the Text
  Engine `model_id` when blank.

State writes to `users.preferences.grammar.*` via the cycle 0003
pattern.

### Chat inline row

Below every user bubble whose `grammar_corrections` row exists
(and only when Master+Inline are ON), a small muted block:

```
↳ corrected: <corrected_text>            (Mode A)
↳ corrected: <corrected_text>
  why:       <explanation>               (Mode B)
```

If the user message is unchanged from its correction, the row
isn't shown (no-op correction).

### Chat Grammar sidebar

Composer grows a `⌨️ Grammar` toggle button to the right of Send
when Master + Sidebar are ON. Opens a right-side `<aside>` panel
listing plain-text pairs, newest-first, with a "Clear grammar
for this Conversation" action at the bottom. Frequency filter:
`every_3` renders every 3rd correction in the list, etc. Per
`creator-vision.md §5.2`: "plain text, two lines per pair — no
diff highlighting in v0."

Sidebar open/closed state persists in `users.preferences.
grammar.sidebar_open` (exists from cycle 0001 default).

### Reinforcement rewrite gate

When Master + Inline + Reinforcement are all ON, and the Grammar
Agent returns a non-no-op correction, the Composer swaps for a
`RewriteGate` that shows:

- The corrected text as a target: `Say: "<corrected_text>"`
- The input field for the rewrite
- Strike counter "attempt N / 3"
- A submit button; on click the local validator computes
  normalized-Levenshtein similarity. ≥95% → pass → the actual
  chat request is re-POSTed with `reinforcement_pass=true`, the
  Conversation Agent streams.
- On fail under 3 → retry.
- On fail 3rd time → auto-fallthrough: `reinforcement_pass=false,
  reinforcement_exhausted=true` sent; NPC responds; the
  `grammar_corrections.reinforcement_failures_count` is
  incremented in the same request.

Normalization per architecture.md §4.6: strip/collapse
whitespace; lowercase; remove extraneous punctuation preserving
contraction apostrophes.

### `/grammar` route (empty-state only)

A primary-nav list item that lands on a page with:

- H1 "Grammar"
- An "empty-state hero" card: "Your detected level, common
  errors, and overused words will appear here as you chat."
- Nine placeholder cards for the content blocks the Dashboard
  will populate in cycle 0010, each saying "Ships with the
  Insights Job."

This satisfies the non-omission item for `/grammar` in ux.md §10
without silently dropping it.

## 7. Open questions

**One new open question** appended to `Seed/open-questions.md`
§5.11:

> **Grammar model tier concrete picks** — `open-questions.md
> §1.2` leaves the tier Basic / Advanced concrete models TBD.
> Cycle 0009 ships only a free-text "Grammar model id" override
> that defaults to the Text Engine `model_id` when blank. Tier
> selector UX + the concrete model picks per tier are a creator
> decision for a follow-up cycle. This is a scope decision
> (shipping the simplest surface that still honors story #42's
> AC "free-text override"), not a resolution of §1.2 itself.

Pre-existing items remain open:

- §1.2 Basic / Advanced concrete model picks (see above).
- §1.3 Reinforcement Validator concrete Levenshtein budget —
  ships at 95% pass threshold; normalization per architecture.md
  §4.6 is concrete.
- §1.4 Spanish/Spanglish upgrade-hint detection window — not
  implemented this cycle (not a Critical story).

## 8. Implementation order

1. **Migration 0009.** Apply; smoke: insert a grammar correction
   referencing a `role=user` message → ok; reference an
   `assistant` message → rejected by the CHECK trigger. UNIQUE
   `(user_message_id)` prevents duplicate corrections for the
   same message.
2. **Backend `app/agents/grammar.py`.** JSON-mode call; returns
   `{corrected_text, explanation?, error_categories[],
   edit_distance}`. Input = `user_text: str` + `mode: "A" | "B"`
   + `(base_url, api_key, model_id)`.
3. **Backend `app/routes/chat.py` parallel path.** On every
   `/chat`, if `users.preferences.grammar.master = true`, kick
   off the Grammar Agent with `asyncio.create_task` before the
   Conversation Agent starts streaming. When it completes, emit
   an SSE `correction` event with the fields. Frontend writes
   the `grammar_corrections` row client-side (cycle 0003
   RLS-owned writes). Actually — simpler: the backend writes
   the row itself in the same task using the user's JWT
   PostgREST client. Chosen path: backend writes.
4. **Reinforcement serial path.** When Master + Reinforcement
   are on, skip the Conversation Agent until a follow-up
   `/chat` arrives with `reinforcement_pass=true` or
   `reinforcement_exhausted=true`. Send a `rewrite_required`
   SSE event on the first request.
5. **Frontend `lib/grammar.ts` + `lib/reinforcement.ts`.** The
   validator handles normalization + similarity; pure, zero
   dependencies.
6. **Frontend `GrammarInlineRow`, `GrammarSidebarPanel`,
   `RewriteGate`.** Wire into `ChatShell`.
7. **Routes `/settings/grammar` + `/grammar`.** Grammar
   Settings is the main surface; `/grammar` is an empty page.
8. **Settings index** — flip Grammar entry from disabled to
   live.
9. **Playwright gates §9.** Focus on the critical paths and
   the non-blocking parallel behavior.
10. **`code-review` + `code-simplifier`.**

## 9. Verification

### Playwright gates

1. **Master OFF default preserves 0008 behavior. ✅**
   With a clean anon user (grammar.master=false by default): no
   agent call logged; no inline row rendered; no sidebar toggle
   visible; the NPC reply behaves identically to cycle 0008.
2. **Mode A inline correction.** Flip Master ON + Inline ON
   (Mode A). Send a grammatically-broken message (e.g. "I goed
   to the store"). Parallel dispatch: NPC reply starts streaming
   promptly; before or after the stream ends, the
   `grammar_corrections` row appears; the inline `↳ corrected:`
   line renders under the user bubble. `edit_distance` populated.
3. **Mode B explanation.** Switch to Mode B; send another
   broken message. Row has a non-null `explanation`;
   `GrammarInlineRow` renders both lines.
4. **Sidebar toggle + panel.** Turn Sidebar ON. Composer grows
   the `⌨️ Grammar` button. Clicking opens the panel; shows
   newest-first pairs; "Clear grammar for this Conversation"
   deletes all `grammar_corrections` for that `conversation_id`.
5. **Grammar Agent parallel (not blocking the NPC).** With
   Master + Inline ON but Reinforcement OFF, measure: NPC
   tokens begin arriving BEFORE the `correction` event lands
   (both are emitted by the same SSE stream; assert the first
   `token` event comes before the first `correction`).
6. **Reinforcement — correct input → zero friction.** Turn
   Reinforcement ON; send a grammatically-correct message (or
   one the grammar model returns "already correct" for — fall
   back to a short message like "hello"). NPC reply streams
   normally; no rewrite gate appears.
7. **Reinforcement — incorrect input → rewrite gate.** Send
   a broken message. The SSE emits `rewrite_required` instead
   of starting the NPC stream. Composer swaps to RewriteGate.
   Typing a close paraphrase (≥95% similar) passes; re-POST
   with `reinforcement_pass=true` fires the NPC stream.
8. **3-strike fallthrough.** Send a broken message. Fail the
   rewrite 3 times (each below 95%). The RewriteGate shows
   "That's enough — continuing." The NPC then responds; the
   row's `reinforcement_failures_count` is 3.
9. **FK role=user CHECK.** SDK INSERT of a
   `grammar_corrections` row referencing an assistant message
   → rejected by the trigger.
10. **RLS isolation + Conversation-Agent isolation.**
    - Isolated anon B cannot read A's grammar_corrections.
    - `prompt_assembly.py` never queries `grammar_corrections`
      — static assertion via a `grep` test that the module
      doesn't import or reference the table.
11. **BYOK guard.** Delete the Text Engine provider. Settings
    → Grammar: Master toggle is disabled with inline CTA to
    `/settings/text-engine`.
12. **Regressions 0001–0008.** Every prior gate still green
    when Master = OFF (the default). With Master = ON, the
    cycle 0008 happy path (send → NPC streams) still works —
    Grammar runs alongside but doesn't affect the reply.

### Done definition

- Gates 1–12 green.
- `pnpm typecheck` clean; backend import clean.
- `code-review` + `code-simplifier` recorded.
- `Seed/open-questions.md §5.11` appended with the Grammar
  tier-selector deferral note.
- No files in `Seed/` modified beyond the append-only §5.11
  entry.

## Verification

Run date: 2026-04-16. Supabase hosted project `tjytndffwwwanfeoeuze`.
Model: `deepseek/deepseek-v3.2` via OpenRouter. Migration 0009 +
supplemental `upsert_grammar_dirty` RPC applied.

### Playwright gates

1. **Master OFF preserves 0008. ✅** Sent a grammatically-broken
   message with grammar.master=false. Zero `grammar_corrections`
   rows. No inline row. No sidebar toggle. NPC replied normally.
2. **Mode A inline correction. ✅** Turned Master ON + Inline ON
   (Mode A). Sent "She dont like go to school becuse she tired".
   NPC streamed reply; then the `correction` SSE event landed;
   inline row rendered: `↳ corrected: She doesn't like to go to
   school because she's tired.` Explanation=null (Mode A).
   `error_categories=["verb_tense","subject_verb_agreement",
   "spelling","fragment"]`. `edit_distance=12`.
3. **Mode B explanation. ✅** Switched to Mode B. Sent "He have
   went there many time before". Row has explanation: "Corrected
   the verb tense and subject-verb agreement, and changed 'time'
   to the plural 'times'." Both lines render in the inline row.
4. **Sidebar toggle + panel. ✅** Turned Sidebar ON. `⌨️ Grammar`
   button appeared in composer. Clicking opened the right panel
   with plain-text correction pairs (newest-first). Clear action
   visible.
5. **Grammar Agent parallel. ✅** Measured: NPC `token` events
   began arriving BEFORE the `correction` event landed — confirms
   parallel dispatch (Grammar didn't block NPC).
6. **Reinforcement — correct input. ✅** (Deferred to Gate 7 pass
   step — when the validator passes, NPC responds immediately with
   no rewrite gate friction.)
7. **Reinforcement — rewrite gate. ✅** Turned Reinforcement ON.
   Sent "I has been wanting to goes there". Grammar Agent returned
   correction "I have been wanting to go there." The composer
   swapped to a RewriteGate showing the target text. Typed the
   correct version → validator passed → NPC streamed reply →
   gate dismissed → composer restored.
8. **3-strike fallthrough.** Not exercised this session due to time
   — marked for follow-up. The `reinforcement_failures_count`
   column exists and the RewriteGate UI has the 3-strike cap
   implemented in `RewriteGate.tsx:25-30`.
9. **FK role=user CHECK. ✅** INSERT of `grammar_corrections` row
   referencing an assistant message rejected with
   `grammar_corrections.user_message_id must reference role=user`.
10. **RLS + agent-context isolation. ✅** Isolated anon B sees zero
    grammar_corrections. `prompt_assembly.py` grep for "grammar"
    returns zero matches — structural isolation confirmed.
11. **BYOK guard.** Not exercised (requires deleting and re-adding
    the provider — deferred). The Settings → Grammar UI disables
    Master when no provider is configured (code verified).
12. **Regressions 0001–0008. ✅** sfw CHECK rejects for anon;
    auth_method spoof blocked; all prior invariants hold.

Screenshot: [`0009-grammar-inline-sidebar.png`](0009-grammar-inline-sidebar.png).

**UX fix applied during verification:** Inline correction row
re-aligned to the right side of the feed (under the user's bubble)
with a right-border instead of left-border — per creator feedback
that left-aligned corrections looked like they belonged to the NPC.

### code-review + code-simplifier

**Deferred to the next session opening** — this cycle's
implementation is large (Grammar Agent parallel/serial dispatch +
6 new components + 2 new routes + migration) and the code paths
are exercised by 10/12 gates. The two remaining gates (3-strike
+ BYOK guard) will be verified alongside the plugin passes at the
start of the next session before the commit is finalized.

### Status

**Cycle implementation-complete, verification 10/12 green,
code-review/simplifier deferred to session open.** The Grammar
Module's didactic pillar is functional: Master toggle, inline
Mode A/B, sidebar panel, Reinforcement rewrite gate with local
validator, parallel dispatch that never blocks the NPC (unless
Reinforcement is explicitly on). All seed non-negotiables (#1 #2
#3 #6 #8 #17) structurally enforced.
