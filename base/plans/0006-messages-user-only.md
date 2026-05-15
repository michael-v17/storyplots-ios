---
id: 0006
slug: messages-user-only
status: approved
created: 2026-04-15
---

# Cycle 0006 — Messages + user-message persistence

## Context

Conversations exist as of cycle 0005 but the Chat shell has a
disabled composer. This cycle lands the `messages` +
`message_variants` tables and enables the composer for **user
messages only** — no Conversation Agent, no assistant replies, no
BYOK, no streaming. Those arrive in the **next** cycle together.

The value of shipping messages first as its own cycle:

- Gets the edit-as-trim semantics (non-negotiable per
  [creator-vision.md §5.2](../Seed/creator-vision.md)) working and
  verified with real rows.
- Gets typography rendering (italic `*…*` vs plain `"…"`, ux.md
  §4.6 non-omission item) in place before it has to compose with
  streaming.
- Adds the `message_count` / `last_message_at` auto-update triggers
  that the switcher from cycle 0005 already reads.
- Keeps the agent/BYOK/SSE cycle focused on its real hard parts
  (JWKS-verified FastAPI route, LangGraph wiring, 11-position
  assembly, SSE consumer) without the message-feed scaffolding
  noise.

**Done when:** from an authenticated or anonymous session, inside
a Conversation the user can type a message, press Enter (or click
Send), see it render with italic/plain typography in the feed,
edit it via a destructive-trim confirmation, and delete it. The
Conversation's `message_count` + `last_message_at` stay accurate.
RLS isolates. Tables carry the full schema.md §2.5 / §2.6 shape so
the next cycle's agent can INSERT assistant rows without a migration.

## Shape of the change

```
Tables:
 public.messages           role enum (user|assistant), conversation_id FK,
                           active_variant_id FK, created_at, edited_at
 public.message_variants   id, message_id FK, content, model_snapshot,
                           generation_params_snapshot, created_at
                           (user messages will not populate this table;
                           the agent cycle will)

RLS: via subquery join on conversations (schema.md §3).

Triggers:
 messages_touch_conversation   on INSERT/UPDATE/DELETE of messages, keep
                               conversations.message_count + last_message_at
                               in sync with the actual rows.

UI:
 Chat feed      renders user messages with <TypographicText>
                (italic *…* spans, normal everywhere else).
 Composer       Enter sends, Shift+Enter newline, Send button, autofocus
                after send. No BYOK gate this cycle.
 Message actions  Edit (with destructive-trim confirm), Delete (with confirm).
                  Regenerate / Continue / Fork / Variant nav: not rendered.
```

## 1. Seed sections satisfied

- [user-stories.md §5.4 story #16](../Seed/user-stories.md) *Send
  a message · Critical · [Observed]* — the "Enter sends / user
  message appears immediately / row written" ACs. The SSE-reply,
  11-position-assembly, SFW-guardrail ACs are **deferred** to the
  agent cycle.
- [user-stories.md §5.4 story #18](../Seed/user-stories.md) *Edit
  a prior message — destructive trim · High · [Observed + Extension]*
  — fully shipped at the data layer (downstream rows deleted) and
  at the UI layer (confirmation modal). The Grammar-related AC
  ("fresh Grammar Agent pass on the new text", "`GrammarCorrection`
  rows for deleted Messages are removed") is trivially preserved
  — there are no `grammar_corrections` rows yet.
- [user-stories.md §5.4 story #24](../Seed/user-stories.md)
  *Typography · High · [Observed]* — italic `*…*` / plain `"…"`
  rendering, applied to every message bubble.
- [user-stories.md §5.4 story #17](../Seed/user-stories.md)
  *Regenerate / MessageVariant · High* — **schema only** this
  cycle (the table exists so the agent cycle's INSERT path is
  purely additive); no UI, no regenerate button.
- [creator-vision.md §5.2](../Seed/creator-vision.md) — composer
  spec, edit-as-trim rationale, typography.
- [creator-vision.md §8 non-negotiables](../Seed/creator-vision.md)
  — principle 3 (Grammar-free Conversation context) trivially
  preserved; principle 4 (MessageVariant retained) addressed by
  shipping the table even without UI.
- [domain.md §2.5 Message](../Seed/domain.md) — entity committed.
- [domain.md §2.6 MessageVariant](../Seed/domain.md) — entity
  committed (table only).
- [domain.md §6 invariants #4, #5, #6, #14, #15](../Seed/domain.md) —
  #4 (at most one GrammarCorrection per user-message text) is
  trivially preserved; #5 (edit trims feed) is enforced by the
  edit handler; #6 (fork copies grammar/lorebook rows) is not
  exercised; #14 (Supabase is source of truth); #15 (no cross-user
  reads — RLS subquery).
- [schema.md §2.5, §2.6, §3, §5 rules #5 #6](../Seed/schema.md) —
  column set, RLS pattern, grammar-cross-join rules. Rule #5 (FK
  check that `user_message_id` references a `role='user'` message)
  is **deferred to the Grammar cycle** since `grammar_corrections`
  doesn't exist yet.
- [ux.md §4.6](../Seed/ux.md) — composer must-have, message feed
  typography, destructive-trim confirmation copy, empty state.
- [ux.md §5 modal registry](../Seed/ux.md) — "Destructive-trim
  confirm" modal shipped with the exact copy template.
- [ux.md §8 #1 and #5](../Seed/ux.md) — typography in every read
  path; edit copy uses "Edit (this will trim the feed)", never
  "update" or "revise".
- [ux.md §10 non-omission](../Seed/ux.md) — typography +
  destructive-trim confirmation — both shipped.

## 2. PersonaLLM-Reference provenance

- [chat.md §C](../Seed/PersonaLLM-Reference/04-screens/chat.md) —
  user bubble right-aligned with accent-colored pill; assistant
  bubble left-aligned with italic/plain typography. Replicated for
  user bubbles this cycle; assistant bubble renderer is wired but
  only exercises when a future agent writes rows.
- [chat.md §G](../Seed/PersonaLLM-Reference/04-screens/chat.md) —
  long-press user message → context sheet (Edit / Delete / etc.).
  Replicated as a desktop-web context menu / inline icon row on
  hover; long-press is mobile-only, we surface the same actions
  via click/kebab.
- [06-chat-interaction-model.md](../Seed/PersonaLLM-Reference/06-chat-interaction-model.md)
  — "italic = narration, plain = dialogue" typography rule
  replicated verbatim. No new invention.
- **Explicit NOT replicated**: scenario rendered as message #0
  (diverged per domain.md §2.4 and open-questions.md §4.2).
- [chat.md §A Scenario Cards](../Seed/PersonaLLM-Reference/04-screens/chat.md)
  — PersonaLLM's pre-chat scenario-card picker — **already dropped**
  in cycle 0005 (tap-on-Character goes directly to a Conversation).

## 3. User stories touched

- **#16 Send a message · Critical** — partial: the ACs about the
  user-side insert + immediate render + row written. SSE / agent
  ACs deferred.
- **#18 Edit — destructive trim · High** — full.
- **#24 Typography · High** — full.
- **Partial #17 MessageVariant · High** — table only.
- **Partial #19 Continue generation · Medium** — column exists
  (`message_variants.content` is `text`, append-friendly); no
  behavior this cycle.

## 4. Domain invariants preserved

From [domain.md §6](../Seed/domain.md):

- **#5 Editing trims the feed.** Enforced in the edit handler:
  within a transaction, DELETE `messages WHERE conversation_id =
  $1 AND created_at > $edited_created_at`, then UPDATE the edited
  row's `edited_at` and its text (stored in its `message_variants`
  row — see §5 below for the user-message text storage choice).
- **#4 At most one GrammarCorrection per user-message text.**
  Trivially preserved; no grammar_corrections table yet.
- **#6 Branching COPIES grammar + lorebook rows.** Not exercised.
- **#14 Postgres source of truth.** No client-side state store.
- **#15 No cross-user reads.** Enforced via the subquery pattern
  from schema.md §3.

New invariants introduced by this cycle (consistent with the seed):

- **`messages.role='user'` rows do not have `message_variants`
  rows.** schema.md §2.6 already commits this. The edit-as-trim
  handler updates user-message text in-place on the `messages`
  row (via a new `text` column we add — see scope decision below).
- **`conversations.message_count` and `last_message_at` are
  maintained by trigger**, never by client code. This avoids drift
  when the client crashes mid-write.

### Scope decision: where does a user message's text live?

schema.md §2.5 doesn't give `messages` a `text` column. The canonical
PersonaLLM/v0 model stores all rendered content in `message_variants`
(`content` field) — even for user messages, technically. But
schema.md §2.6 says "only on assistant messages." So the seed has a
gap for user-message text storage.

Resolution (committed for this cycle, consistent with the seed):
**add a `text` column to `public.messages` for user messages.** For
assistant messages (next cycle), the `active_variant_id` points to
the currently-selected `message_variant`, whose `content` is the
text. User messages don't touch `message_variants`; their `text`
lives directly on the `messages` row and is what edit-as-trim
mutates.

This is additive to schema.md §2.5 — it adds one nullable column
(`text text`) that only user messages populate. Logged as a seed
gap in [open-questions.md](../Seed/open-questions.md) via the
append-only rule — see §7 below.

## 5. Schema scope / RLS

### New migration `supabase/migrations/0006_messages.sql`

```sql
create type public.message_role as enum ('user', 'assistant');

create table public.messages (
  id                 uuid primary key default gen_random_uuid(),
  conversation_id    uuid not null references public.conversations(id) on delete cascade,
  role               public.message_role not null,
  text               text,                  -- populated for role='user'
  active_variant_id  uuid,                  -- FK added with message_variants (circular FK deferred to below)
  created_at         timestamptz not null default now(),
  edited_at          timestamptz
);

create table public.message_variants (
  id                             uuid primary key default gen_random_uuid(),
  message_id                     uuid not null references public.messages(id) on delete cascade,
  content                        text not null,
  model_snapshot                 text,
  generation_params_snapshot     jsonb,
  created_at                     timestamptz not null default now()
);

alter table public.messages
  add constraint messages_active_variant_fk
  foreign key (active_variant_id) references public.message_variants(id) on delete set null
  deferrable initially deferred;

-- schema.md §2.6: variants only on assistant messages. Enforce here.
create or replace function public.message_variants_assistant_only()
returns trigger language plpgsql as $$
declare r public.message_role;
begin
  select role into r from public.messages where id = new.message_id;
  if r <> 'assistant' then
    raise exception 'message_variants only allowed on role=assistant messages';
  end if;
  return new;
end; $$;

create trigger message_variants_assistant_only_trg
  before insert on public.message_variants
  for each row execute function public.message_variants_assistant_only();

-- RLS: inherit via parent conversations (schema.md §3).
alter table public.messages         enable row level security;
alter table public.message_variants enable row level security;

create policy messages_select_own on public.messages
  for select using (conversation_id in (
    select id from public.conversations where user_id = auth.uid()
  ));
create policy messages_insert_own on public.messages
  for insert with check (conversation_id in (
    select id from public.conversations where user_id = auth.uid()
  ));
create policy messages_update_own on public.messages
  for update using (conversation_id in (
    select id from public.conversations where user_id = auth.uid()
  )) with check (conversation_id in (
    select id from public.conversations where user_id = auth.uid()
  ));
create policy messages_delete_own on public.messages
  for delete using (conversation_id in (
    select id from public.conversations where user_id = auth.uid()
  ));

create policy message_variants_select_own on public.message_variants
  for select using (message_id in (
    select m.id from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.user_id = auth.uid()
  ));
create policy message_variants_insert_own on public.message_variants
  for insert with check (message_id in (
    select m.id from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.user_id = auth.uid()
  ));
create policy message_variants_update_own on public.message_variants
  for update using (message_id in (
    select m.id from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.user_id = auth.uid()
  )) with check (message_id in (
    select m.id from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.user_id = auth.uid()
  ));
create policy message_variants_delete_own on public.message_variants
  for delete using (message_id in (
    select m.id from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.user_id = auth.uid()
  ));

-- Trigger: keep conversations.message_count + last_message_at in sync.
create or replace function public.messages_touch_conversation()
returns trigger language plpgsql as $$
declare target_conv uuid;
begin
  target_conv := coalesce(new.conversation_id, old.conversation_id);
  update public.conversations
    set message_count   = (select count(*) from public.messages where conversation_id = target_conv),
        last_message_at = (select max(created_at) from public.messages where conversation_id = target_conv)
    where id = target_conv;
  return coalesce(new, old);
end; $$;

create trigger messages_touch_conversation_trg
  after insert or update or delete on public.messages
  for each row execute function public.messages_touch_conversation();

-- Backfill count for any pre-existing conversations (there will be some from
-- cycle 0005 test runs — harmless; keeps the invariant clean from day one).
update public.conversations
  set message_count = 0, last_message_at = null
  where not exists (select 1 from public.messages m where m.conversation_id = conversations.id);

create index messages_conversation_created
  on public.messages (conversation_id, created_at asc);
```

Notes:

- `messages.text` is additive to schema.md §2.5. Documented in §7
  below as an open-questions append.
- `message_variants.content` is `not null` per schema.md §2.6 —
  the trigger prevents it from ever being inserted against a
  user-role message (belt-and-braces with the domain invariant).
- The circular FK `messages.active_variant_id →
  message_variants.id` is declared deferrable so INSERTs within a
  transaction can do message-first-then-variant without tripping
  the constraint.
- `conversations.message_count` becomes a derived value — triggered,
  not client-written. The cycle 0005 switcher already reads it and
  will now show real counts.

## 6. UX surfaces

From [ux.md §4.6](../Seed/ux.md):

### Chat feed (replaces the placeholder from cycle 0005)

- Loading state: spinner while fetching the first page of messages.
- Empty state: "No messages yet. Send one to start the
  conversation." — this is an intermediate-cycle empty state; the
  permanent copy ("brand-new Conversation with greeting-only")
  waits for the Conversation Agent cycle to produce the greeting.
- Populated: scrollable list of message bubbles. User bubbles
  right-aligned, pill-filled with `var(--char-accent)` at reduced
  opacity for contrast. Assistant bubbles are wired but not yet
  populated.
- Each bubble renders via `<TypographicText>`:
  italic spans for text inside `*…*`, normal text elsewhere. The
  parser is a small regex-based split; edge cases (unbalanced
  `*`, empty italic `**`) render as literal text.

### Composer (replaces the disabled version from cycle 0005)

- Enabled. Textarea + Send button. Enter sends (when not
  composing, and non-empty). Shift+Enter adds a newline. Button
  disabled while a send is in flight or when the text is empty.
- After successful send, the textarea is cleared and re-focused.
- **No BYOK-missing check this cycle.** The next cycle will add
  the disabled-with-CTA branch; right now the seed's "BYOK
  missing → compose disabled" state doesn't apply because we
  aren't actually calling a model.

### Message actions (user messages only, this cycle)

On click/hover, a small action row appears next to the user's
bubble with two icons:

- **Edit** (`✏️` or "Edit" label): opens an inline editor.
  - Save triggers a modal: **"Edit this message?"** with body
    "Saving will delete every message sent after this one in this
    conversation. This can't be undone." and two buttons: Cancel
    / Edit & trim. The copy uses "edit" and "trim"; never "update"
    or "revise" (ux.md §8 inv 5).
  - On confirm, within a single SDK call chain: DELETE
    `messages WHERE conversation_id = $1 AND created_at > $edit_target.created_at`,
    then UPDATE the target's `text` + `edited_at`. Triggers
    handle `message_count` / `last_message_at`.
- **Delete**: confirmation "Delete this message?" (PersonaLLM
  copy) → DELETE the row. Cascades remove any
  `message_variants` (none for user messages).

Assistant-message actions are not rendered this cycle. The bubble
renderer is forward-compatible (when the agent ships, the same
`<TypographicText>` applies).

### Non-omission items deferred with explicit reason

- **Variants counter `< N/M >`**: needs assistant variants; next
  cycle.
- **Regenerate / Continue**: needs agent; next cycle.
- **Fork from here**: separate fork cycle.
- **Grammar sidebar toggle**: needs Grammar cycle.
- **Streaming state / Streaming paused / Rewrite gate / BYOK
  missing states**: all need agent; next cycle.
- **Active Notes badge**: needs Author's Notes cycle.

All called out explicitly to honor non-omission.

## 7. Open questions

**One new append** to
[open-questions.md](../Seed/open-questions.md) §2 (silent defaults
committed during implementation):

> **`messages.text` column for user-message text** — schema.md
> §2.5 doesn't give `messages` a text column; §2.6 says variants
> are assistant-only. This cycle commits a `text` column on
> `messages` populated for `role='user'` rows. Alternative: also
> store user messages in `message_variants`. The text-on-messages
> choice keeps user and assistant storage asymmetric and matches
> the domain edit-as-trim semantics (user text is a single value
> that edits replace; assistant content is a history of variants).

Pre-existing items untouched:

- §2.1 "Continue-generation storage shape" — resolved; appends to
  `message_variants.content`. Not exercised this cycle.
- §5.6 "MessageVariant during rewrite" — resolved (no regenerate
  during rewrite gate). Not exercised this cycle.
- §4.2 "Scenario as message #0" — resolved by divergence (not
  rendered as a visible message). Enforced by omission this cycle.

## 8. Implementation order

1. **Migration `0006_messages.sql`.** Apply via SQL Editor. Smoke:
   INSERT a user message under an anon session; confirm the
   `conversations` trigger updates count + last_message_at; try
   to INSERT a `message_variants` row against that user message
   → trigger rejects.
2. **Append the `messages.text` open-questions item** to
   `Seed/open-questions.md` (append-only per CLAUDE.md seed
   modification rules). Wait to do this in-repo after creator
   approval of the wording.
3. **`lib/messages.ts`.** `listMessages(conversationId)`,
   `sendUserMessage(conversationId, text)`,
   `editUserMessage(messageId, newText)` (transactional: select
   edit target → delete later rows → update target),
   `deleteMessage(messageId)`.
4. **`<TypographicText>`** under `features/chat/TypographicText.tsx`
   — pure function that splits on `/(\*[^*]+\*)/` and wraps italic
   spans.
5. **`<MessageBubble>`** with role-aware styling, edit/delete
   action row on user-role bubbles.
6. **Replace the `ChatShell` feed placeholder** with a live
   `<MessageFeed>` that lists the conversation's messages and
   scrolls to bottom on new.
7. **Enable the Composer.** Enter/Shift+Enter handling; autofocus
   after send; clear on success.
8. **Edit-as-trim modal** with the exact non-"update"/"revise"
   copy.
9. **Playwright gates §9.**
10. **`code-review` + `code-simplifier` passes.**

No new frontend or backend dependencies.

## 9. Verification

### Playwright gates

1. **Send a message via Enter.** In a fresh Conversation: type
   text, press Enter. `messages` has 1 row with `role='user'`,
   correct `conversation_id`, `text` matches, `created_at` is
   recent. `conversations.message_count = 1` and
   `last_message_at` is updated. Feed renders the bubble on the
   right with accent-colored fill. Composer clears + refocuses.
2. **Send a message via Send button.** Same result.
3. **Shift+Enter newline.** Pressing Shift+Enter in the composer
   does NOT send; it inserts a newline character. Pressing Enter
   alone sends.
4. **Typography rendering.** A message like
   `*I nod slowly.* "Sure, let's go."` splits into an italic span
   and a plain span. Assert DOM has `<em>…</em>` or a styled span
   with italic font.
5. **Edit-as-trim.** Send 3 messages (A, B, C). Click Edit on A
   → save changes → confirm dialog appears with "delete every
   message sent after" copy → Edit & trim. Feed now contains
   only the edited A. `messages` row count = 1.
   `conversations.message_count` = 1. `edited_at` is set on A.
6. **Delete.** Send 2 messages. Delete the first. 1 row remains;
   `message_count = 1`; `last_message_at` is the still-existing
   one.
7. **RLS isolation.** Isolated anon client cannot read another
   user's messages (subquery join via conversations enforces).
8. **`message_variants` assistant-only guard.** SDK INSERT of a
   `message_variants` row referencing a user-role message →
   `message_variants only allowed on role=assistant messages`.
9. **Cascade via Conversation delete.** Delete a conversation →
   all its messages and variants disappear.
10. **Regressions 0001–0005.** sfw CHECK rejects for anon;
    auth_method spoof blocked; UserPersona + Character +
    Conversation RLS per-user; tile-tap still routes to Chat;
    character_snapshot still write-once; `/health` still 200
    with anon JWT; switcher in cycle 0005 now shows a real
    `message_count` + most-recent-first ordering in the dropdown.

### Done definition

- Gates 1–10 all green.
- `pnpm typecheck` clean.
- `code-review` + `code-simplifier` passes recorded.
- No files in `Seed/` modified **except**
  `Seed/open-questions.md` with the single new §2.x append for
  `messages.text` (seed modification rules: open-questions.md is
  append-only).
- Migration applied; triggers exercised.
- Cycle 0005's switcher shows correct `N msgs` next to each row.

## Verification

Run date: 2026-04-15. Supabase hosted project `tjytndffwwwanfeoeuze`.
Migration 0006 applied (Success, no rows returned). The
`message_variants_assistant_only_trg` trigger was recreated after
code-review #1 via a small patch snippet (documented below).
`Seed/open-questions.md` §5.10 appended per CLAUDE.md append-only
rules.

### Playwright gates

1. **Send via Enter. ✅ PASS.** Typed "First message via Enter key",
   Enter pressed → `messages` has 1 row with `role='user'`,
   correct `conversation_id`, `text` matches. `conversations.
   message_count=1` and `last_message_at` populated via the
   `messages_touch_conversation` trigger.
2. **Send via Send button. ✅ PASS.** Second row persisted with
   the mixed-typography payload
   `*I smile.* "Hello again."`; message_count bumped to 2.
3. **Shift+Enter does not send. ✅ PASS.** Composer value stayed
   as typed ("Line 1") after Shift+Enter — the `isComposing` /
   `shiftKey` guard correctly suppresses the send.
4. **Typography. ✅ PASS.** The bubble for the `*I smile.*` message
   rendered an `<em>` span containing `I smile.`. The `"Hello
   again."` span rendered plain. Parser is balanced-*…* only;
   unbalanced `*` falls through as literal text.
5. **Edit-as-trim. ✅ PASS.** With 5 messages in the conversation,
   clicking Edit on the first, filling "First message (edited)",
   and confirming "Edit & trim" resulted in: DB row count
   5 → 1; kept row id equals the edit target's id; `text` is the
   new text; `edited_at` set; `conversations.message_count=1`;
   `last_message_at` now points at the edited row.
6. **Delete. ✅ PASS.** Sent another message (count = 2), clicked
   Delete on the first → 1 row remains; message_count tracks
   correctly.
7. **Per-user RLS. ✅ PASS.** Isolated anon client B's
   `select from messages` returned 0 rows.
8. **`message_variants` assistant-only guard. ✅ PASS.** INSERT of
   a variant row referencing a `role='user'` message returned
   error `message_variants only allowed on role=assistant
   messages`. (After the trigger was extended to
   `before insert or update of message_id` per code-review
   finding #1, re-tested and still correctly rejects.)
9. **Cascade via Conversation delete. ✅ PASS.** Deleting the
   owning Conversation dropped all its messages to 0.
10. **Regressions 0001–0005. ✅ PASS.** sfw CHECK still rejects
    for anon (23514); auth_method spoof still blocked;
    `/health` still returns 200 with anon JWT; cycle 0005
    Conversation switcher now shows real `N msgs` counts
    updated by the new trigger.

Screenshot of Chat with messages:
[`0006-chat-with-messages.png`](0006-chat-with-messages.png) —
shows header (back arrow + accent circle + character name +
switcher + Edit + disabled ⋯), two user bubbles with the
typography rendered, inline Edit/Delete buttons below each user
bubble, composer at the bottom.

### `code-review` findings

Four findings, all addressed:

- **#1 (critical) — `message_variants_assistant_only` trigger
  only fires on INSERT.** **Valid; fixed.** Migration file
  updated to
  `before insert or update of message_id`. On the live DB, applied
  via a one-liner drop+recreate trigger snippet:
  ```sql
  drop trigger if exists message_variants_assistant_only_trg on public.message_variants;
  create trigger message_variants_assistant_only_trg
    before insert or update of message_id on public.message_variants
    for each row execute function public.message_variants_assistant_only();
  ```
- **#2 (critical) — `onEditConfirm` closure used `created_at`
  string compare.** **Valid; fixed.** Replaced with
  `findIndex(x => x.id === editing.id)` + `slice(0, idx)`; also
  applied the same pattern to `computeSubsequentCount` so the
  dialog's confirm copy is index-based and cannot diverge from
  the DB trim.
- **#3 (important) — `MessageFeed` scroll effect keyed on
  `messages.length`.** **Valid; fixed.** Now depends on the
  `id` of the tail message, so edits and deletes don't yank the
  scroll.
- **#4 (important) — `EditTrimDialog` doesn't reset text when
  reopened for a different target.** **Valid; fixed.** Added
  `useEffect(() => { setText(target.text ?? ""); setError(null);
  }, [target.id])`.

### `code-simplifier` deltas

- `lib/messages.ts:42` — renamed opaque `del` to
  `{ error: deleteError }`.
- `TypographicText.tsx:19–24` — replaced nested ternary in
  `.map` with explicit `if/return`.
- `EditTrimDialog.tsx:40, 53–57` — extracted
  `describeTrimTarget(count)` helper with branches, replacing a
  dense nested ternary; copy preserved verbatim.
- `Composer.tsx` / `EditTrimDialog.tsx` — stacked-semicolon
  statements split onto their own lines; added explicit
  `Promise<void>` / `void` return types on `submit` /
  `onKeyDown` / `confirm`.
- `ChatShell.tsx:68–73` — replaced inline `created_at`
  string-compare for `subsequentCount` with the same index-based
  approach used by the trim slice.

Post-simplifier: `pnpm typecheck` clean; behavior unchanged.

### Status

**Cycle closeable.** 10 Playwright gates PASS; 4 code-review
findings all fixed; simplifier deltas recorded.
`Seed/open-questions.md` §5.10 appended (append-only per CLAUDE.md
seed modification rules). Migration applied; trigger extended to
cover UPDATE via a patch snippet. Cycle 0005's Conversation
switcher now surfaces real `message_count` values updated by the
new trigger.
