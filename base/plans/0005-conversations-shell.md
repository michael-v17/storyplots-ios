---
id: 0005
slug: conversations-shell
status: approved
created: 2026-04-15
---

# Cycle 0005 — Conversations shell (no messages, no Agent)

## Context

Characters exist as of cycle 0004. This cycle introduces
`Conversation` — the thread entity that every future chat,
message, grammar row, lorebook entry, memory document, and author's
note will hang off. Scope is the **shell**: the table, RLS,
creating a Conversation from a Character, listing Conversations
per Character, a top-bar switcher, and a stub Chat route that
renders the Character header and a disabled composer. Messages,
LLM calls, streaming, and the Conversation Agent all land in a
later cycle that also ships BYOK.

The cycle also **completes the Character tile-tap UX** that has
been a placeholder since 0004. Home and `/characters` now navigate
to the most recent Conversation (or create one + navigate) per
[open-questions.md §2.1](../Seed/open-questions.md) and
[ux.md §4.2](../Seed/ux.md).

**Done when:** from an authenticated or anonymous session, tapping
a Character tile either opens its most recent Conversation or
creates a new one and opens it; the Chat route renders Character
header + switcher + disabled composer; `character_snapshot` is
written at creation and cannot be mutated thereafter (invariant #8);
all 0001–0004 regressions stay green.

## Shape of the change

```
Routes:
 /chat/:characterId/:conversationId     new Chat shell
 (Home / /characters tile tap → find most-recent conv or create new)

Tables:
 public.conversations                   full schema.md §2.4 column set,
                                        RLS, write-once character_snapshot,
                                        touch_updated_at, cascade FK to
                                        characters (and therefore users).

Components:
 ChatShell                              header, switcher, disabled composer
 ConversationSwitcher                   dropdown of conv rows + "New"
 lib/conversations.ts                   list / load / createFromCharacter /
                                        delete / findOrCreateForCharacter
```

## 1. Seed sections satisfied

- [user-stories.md §5.3 story #12](../Seed/user-stories.md) *Start
  a new Conversation · Critical · [Observed]* — all the
  character-snapshot + per-Conversation-Lorebook ACs this cycle can
  satisfy without messages. The "initial assistant turn renders the
  Character's greeting" AC is **partial**: the snapshot captures
  the greeting-relevant fields (via `scenario` in the snapshot) but
  no greeting message is rendered this cycle; landing on an empty
  Chat shell is the correct pre-Agent state, flagged in §6 below.
- [user-stories.md §5.3 story #13](../Seed/user-stories.md) *Switch
  between Conversations · High · [Observed]* — top-bar switcher,
  URL `/chat/:characterId/:conversationId`.
- [user-stories.md §5.3 story #15](../Seed/user-stories.md) *Delete
  a Conversation · Medium* — delete action in the switcher with
  confirmation. Cascade to not-yet-existing tables (messages,
  lorebook_entries, etc.) is declared `on delete cascade` so it
  works correctly once those tables land.
- [creator-vision.md §2](../Seed/creator-vision.md) — "A Character
  can have multiple Conversations (PersonaLLM-style) — each is an
  independent thread with its own memory, Lorebook, and Grammar
  history."
- [creator-vision.md §5.2](../Seed/creator-vision.md) — top-bar
  Conversation switcher; 1:1 Character model.
- [creator-vision.md §8 principles 3, 4, 7, 10](../Seed/creator-vision.md)
  — no Grammar in Conversation context (trivially preserved — no
  Agent yet); multiple Conversations per Character; Supabase is
  source of truth.
- [domain.md §2.4](../Seed/domain.md) — entity definition, fields,
  invariants.
- [domain.md §6 invariants #8, #11, #14, #15](../Seed/domain.md) —
  character_snapshot write-once (enforced by DB trigger); anon RLS
  identical; Postgres is source of truth; no cross-user reads.
- [schema.md §2.4](../Seed/schema.md) — full column set
  (including `branch_*` columns; forking not shipped this cycle,
  but the columns exist so the fork cycle is additive).
- [schema.md §5 items #1, #2, #7](../Seed/schema.md) — per-user
  RLS; anon-identical RLS; `character_snapshot` write-once.
- [ux.md §1 sitemap](../Seed/ux.md) —
  `/chat/:characterId/:conversationId` added.
- [ux.md §4.2 / §4.4](../Seed/ux.md) — "tap a Character → most
  recent Conversation or new one" finally implemented.
- [ux.md §4.6 Chat screen](../Seed/ux.md) — must-have sections
  shipped this cycle: top bar (character avatar + name +
  Conversation switcher), empty message feed placeholder,
  Composer (disabled). Must-have sections **deferred** with
  explicit placeholders: Chat Controls button (⋯), Grammar sidebar
  toggle, Active Notes badge — those land when their features land.

## 2. PersonaLLM-Reference provenance

- [PersonaLLM-Reference/04-screens/chat.md](../Seed/PersonaLLM-Reference/04-screens/chat.md)
  — replicated: per-Character Conversations list, top-bar
  switcher, accent-color theming of the chat view root.
  **Intentionally diverged** (named in
  [open-questions.md §4.1](../Seed/open-questions.md)): v0 does
  **not** render scenario as message #0 and does **not** show a
  PersonaLLM-style character-landing screen. Tap lands directly
  in most-recent / new Conversation per
  [open-questions.md §2.1](../Seed/open-questions.md).
- [PersonaLLM-Reference/05-flows.md F6, F7](../Seed/PersonaLLM-Reference/05-flows.md)
  — replicated tap → Conversation navigation; F6 step 2 (scenario
  as message #0) intentionally dropped per v0 seed decision.
- [PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](../Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md)
  — documents what `character_snapshot` must contain so the future
  11-position assembly can read it. This cycle writes the snapshot
  in the committed shape; no assembly code is built.
- [PersonaLLM-Reference/04-screens/chat-controls.md](../Seed/PersonaLLM-Reference/04-screens/chat-controls.md)
  — **not replicated this cycle**; the ⋯ button is not even
  rendered. Chat Controls arrive with the feature that consumes
  them (Lorebook, Author's Notes, Autopilot).

## 3. User stories touched

- **#12 Start a new Conversation · Critical** — structural ACs (row
  creation, snapshot, empty Lorebook). The "initial assistant
  greeting" AC is partially deferred (no message system yet). The
  "scenario injected into system prompt" AC is pre-satisfied at the
  data layer (snapshot carries `scenario`); the consumer lands with
  the Agent.
- **#13 Switch between Conversations · High** — switcher + URL.
- **#15 Delete a Conversation · Medium** — basic delete on the
  switcher row. Cascade target tables don't exist yet.
- **Flow F6/F7 landing points** — navigation wired; the screens
  these flows land on render the shell, not a full chat.

## 4. Domain invariants preserved

From [domain.md §6](../Seed/domain.md):

- **#1 Per-user RLS** — new `conversations_*_own` policies.
- **#8 `character_snapshot` point-in-time** — enforced by a new
  `conversations_snapshot_write_once` BEFORE UPDATE trigger that
  raises if `new.character_snapshot IS DISTINCT FROM
  old.character_snapshot`. The fork cycle will either relax this
  trigger or route its writes around it; documented in the plan
  as a known future touch point.
- **#11 Anonymous RLS identical** — no branch on `auth_method`.
- **#14 Postgres is source of truth** — no client-side state
  store; all reads/writes go through Supabase.
- **#15 No cross-user reads** — RLS.

Non-negotiables from creator-vision.md §8 that **this cycle does
not yet exercise** but must not break:

- **Agent isolation** (no Agent yet).
- **Grammar Module default OFF** (no Grammar yet; cycle 0001's
  `preferences.grammar.master=false` default still holds).
- **Per-Conversation Lorebook** — enforced structurally: Lorebook
  table (future) will FK on `conversations.id`, not on
  `characters.id`. Nothing in this cycle to enforce.
- **Edit-as-trim, Branching copies** — no messages yet.
- **SSE / BYOK / vendor-agnostic prompts / plain-text reply path**
  — no Agent yet.

## 5. Schema scope / RLS

### New migration `supabase/migrations/0005_conversations.sql`

```sql
create type public.branch_mode as enum ('keep_messages', 'summarize_fresh');

create table public.conversations (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid not null references public.users(id) on delete cascade,
  character_id                    uuid not null references public.characters(id) on delete cascade,
  title                           text not null default 'New Conversation',
  character_snapshot              jsonb not null,
  writing_style_snapshot          jsonb not null default '{}'::jsonb,
  persona_id                      uuid references public.user_personas(id) on delete set null,
  last_message_at                 timestamptz,
  message_count                   integer not null default 0,
  branch_parent_conversation_id   uuid references public.conversations(id) on delete set null,
  branch_parent_message_id        uuid,                 -- FK added with messages table
  branch_mode                     public.branch_mode,
  parent_branch_summary           text,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

alter table public.conversations enable row level security;

create policy conversations_select_own on public.conversations
  for select using (user_id = auth.uid());
create policy conversations_insert_own on public.conversations
  for insert with check (user_id = auth.uid());
create policy conversations_update_own on public.conversations
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());
create policy conversations_delete_own on public.conversations
  for delete using (user_id = auth.uid());

create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row execute function public.touch_updated_at();

-- Invariant #8 / schema.md §5 #7: character_snapshot is write-once.
create or replace function public.conversations_snapshot_write_once()
returns trigger language plpgsql as $$
begin
  if new.character_snapshot is distinct from old.character_snapshot then
    raise exception 'conversations.character_snapshot is write-once';
  end if;
  return new;
end; $$;

create trigger conversations_snapshot_write_once_trg
  before update on public.conversations
  for each row execute function public.conversations_snapshot_write_once();

create index conversations_character_id_last_message_at
  on public.conversations (character_id, last_message_at desc nulls last, created_at desc);
```

**Scope notes:**

- `writing_style_snapshot` is seeded as `'{}'` because the
  `writing_styles` table doesn't exist yet. When it lands, the
  server-side default changes; the column shape is an opaque JSON
  blob that the future prompt assembly reads, so nothing in this
  cycle depends on its contents.
- `branch_parent_message_id` has no `REFERENCES` clause yet —
  `messages` doesn't exist. Added in the messages cycle.
- The fork cycle (future) will need to write `character_snapshot`
  on INSERT of the child Conversation, which bypasses the
  write-once trigger (trigger fires on UPDATE only). Documented so
  the fork cycle doesn't re-discover it.

## 6. UX surfaces

### `/chat/:characterId/:conversationId` — new Chat shell route

Renders:

- **Top bar**:
  - Character avatar placeholder (accent-color circle for now;
    avatar upload is a later cycle) + Character name + tagline.
  - `ConversationSwitcher` dropdown: lists the Character's
    Conversations with title + timestamp; "+ New conversation" row
    at the top creates a fresh one and navigates to it; a small
    trash icon on each row deletes that Conversation after
    confirmation (story #15).
  - Chat Controls button (⋯) rendered **disabled** with tooltip
    "Chat Controls land with Lorebook / Author's Notes /
    Autopilot". (Non-omission per ux.md §4.6.)
- **Message feed**: empty-state placeholder box. Copy: "Messages
  arrive in the next cycle." No scrollback, no typography, no
  streaming.
- **Composer**: textarea + Send button both **disabled**, with an
  inline note "Sending messages requires a model provider (BYOK)
  which lands in the next cycle."

Accent-color theming is applied via an inline CSS variable
`--char-accent` scoped to the chat root, per
[chat.md Extension note](../Seed/PersonaLLM-Reference/04-screens/chat.md).

### Navigation updates

- `CharacterCard` (cycle 0004) currently routes to
  `/character/:id/edit`. This cycle changes it to a smart handler:
  click → `findOrCreateForCharacter(characterId)` →
  navigate to `/chat/:characterId/:conversationId`. Same applies
  to Home's recent tiles.
- `/character/:id/edit` remains accessible from the context menu
  or from a small "Edit Character" link on the Chat top bar.

### Required states (ux.md §4.6)

- Loading — spinner while fetching Conversation + character
  snapshot.
- Empty — brand-new Conversation: the placeholder empty-feed copy
  above. (This is the only "empty" surface this cycle can offer;
  the "greeting-only" variant lands with messages.)
- Error — 404-ish: "Conversation not found" when the URL targets a
  row RLS hides or that's been deleted.
- **Explicitly deferred** (rendered as absent-with-rationale, not
  dropped): Streaming, Streaming paused, Rewrite-gate active,
  Grammar disabled, BYOK missing. Those all arrive with their
  features.

### Non-omission checklist items still out of reach this cycle

- Typography for `*…*` / `"…"` — needs messages; deferred.
- Destructive-trim confirmation copy — needs edit-as-trim;
  deferred.
- Active Notes badge — needs Author's Notes; deferred.
- Grammar sidebar toggle — needs Grammar; deferred.

All are called out here rather than silently dropped.

## 7. Open questions

No new ones. Pre-existing items relevant to this cycle:

- [open-questions.md §1.1](../Seed/open-questions.md) — re-validate
  PersonaLLM edit semantics. This cycle's write-once snapshot is
  the seed default; the open question is about *confirming*
  PersonaLLM actually behaves that way, which is hands-on, not
  code.
- [open-questions.md §2.1](../Seed/open-questions.md) (tap-on-
  Character navigation target): committed — this cycle implements
  it. Not a new open question.
- [open-questions.md §4.1](../Seed/open-questions.md) (scenario
  not as message #0): committed — enforced by omission (no message
  feed renders scenario).

## 8. Implementation order

1. **Migration `0005_conversations.sql`.** Write + apply. Smoke:
   insert a row as anon with a fabricated `character_snapshot`;
   try to UPDATE it → trigger rejects; delete the owning Character
   → cascade removes the Conversation row.
2. **`lib/conversations.ts`.** Helpers:
   - `buildCharacterSnapshot(char)` — serializes the committed
     subset of Character fields into the snapshot JSON shape.
   - `createConversationFromCharacter(userId, character,
     personaId)` — builds snapshot, inserts, returns the row.
   - `listConversationsForCharacter(characterId)` — ordered by
     `last_message_at desc nulls last, created_at desc`.
   - `findOrCreateForCharacter(userId, character)` — returns the
     most-recent Conversation for (user, character) or creates
     a new one.
   - `deleteConversation(id)`.
3. **`ChatShell`** under `features/chat/ChatShell.tsx` — renders
   the header, switcher, disabled composer, accent theming.
4. **`ConversationSwitcher`** — dropdown list + "New" + delete
   per-row.
5. **Route `/chat/:characterId/:conversationId`.** Wrapper that
   loads both Character (for header info — the header reads from
   the live Character row, not the snapshot, since top-bar UX
   should reflect the latest Character name/avatar) and the
   Conversation.
6. **Navigation wiring.** Update `CharacterCard` to the
   `findOrCreateForCharacter` handler; update Home and
   `/characters` tile targets.
7. **Playwright verification §9.**
8. **`code-review` + `code-simplifier` passes.**

No new backend work, no new dependencies.

## 9. Verification

### Playwright gates

1. **Tile-tap → create first Conversation.** Authed user with one
   Character and zero Conversations. Click the Home tile → lands
   on `/chat/<charId>/<convId>`; `public.conversations` has one
   row with `user_id=auth.uid()`, `character_id=<charId>`,
   `title='New Conversation'`, `character_snapshot` containing the
   committed subset of fields from the Character (name,
   system_prompt, mode, personality, goals, worldbuilding,
   english_style, scenario, plus assistant fields if mode=assistant).
2. **Tile-tap → reuse most-recent.** Same Character, click the
   tile again; no new row; the URL lands on the same
   `:conversationId` as step 1.
3. **`character_snapshot` write-once (invariant #8).** SDK UPDATE
   of that column on the existing row → raises
   `conversations.character_snapshot is write-once`. UPDATE to
   `title` still works (tests that the trigger is column-scoped).
4. **Character edit doesn't retroactively mutate snapshot.** Edit
   Character name → the Conversation's `character_snapshot.name`
   is unchanged (still old name), while the Chat shell header
   renders the new live name (separation confirmed).
5. **Switcher creates a new Conversation.** Click "+ New
   conversation" in the switcher → a second row exists; URL
   changes to the new Conversation's id; the old Conversation
   still exists under the dropdown.
6. **Switcher delete.** Click trash on a switcher row → confirm
   → that row is removed from the dropdown and from `public.
   conversations`. Remaining Conversations unaffected; URL
   changes if the deleted row was the active one.
7. **Per-user RLS.** Isolated anon client cannot see the first
   user's Conversations; inserting its own stays isolated.
8. **Cascade via Character delete.** Delete the parent Character
   → all its Conversations disappear.
9. **Regressions 0001–0004.** sfw CHECK still rejects for anon;
   auth_method spoof still blocked; UserPersona still readable;
   Characters still readable; `/health` still 200 for anon.

### Done definition

- Gates 1–9 green.
- `pnpm typecheck` clean.
- `code-review` + `code-simplifier` passes recorded.
- No files under `Seed/` modified.
- Migration committed; trigger verified.
- The Character tile-tap target placeholder from cycle 0004 is
  retired — tapping a tile now lands on the correct route.

## Verification

Run date: 2026-04-15. Supabase hosted project `tjytndffwwwanfeoeuze`.
Migration 0005 applied via SQL Editor (Success, no rows returned).

### Playwright gates

1. **Tile-tap → create first Conversation. ✅ PASS.** Seeded a
   Character via SDK, clicked Home tile → navigated to
   `/chat/<charId>/<convId>`. `public.conversations` has 1 row
   with `title='New Conversation'`,
   `character_snapshot = { name, system_prompt, mode, personality,
   goals, worldbuilding, english_style, scenario, expertise_areas,
   communication_style_assistant, rules }` (all 11 prompt-relevant
   fields per schema.md §2.4), and the Chat shell rendered with
   the character's name, disabled composer, disabled ⋯ button,
   and "Messages arrive in the next cycle." placeholder.
2. **Tile-tap → reuse most-recent. ✅ PASS.** Back to Home →
   second click → same conversation URL, row count still 1.
3. **`character_snapshot` write-once (invariant #8). ✅ PASS.**
   SDK UPDATE of `character_snapshot` → Postgres error
   `conversations.character_snapshot is write-once`. Concurrent
   UPDATE of `title` succeeded, confirming the trigger is
   column-scoped.
4. **Character edit not retroactive. ✅ PASS.** Changed the
   Character's name to "Lyra (updated)". The Conversation's
   `character_snapshot.name` stayed `"Lyra"`. Separation between
   live Character (used by the Chat header) and point-in-time
   snapshot (used by the future prompt assembly) is confirmed.
5. **Switcher "+ New conversation". ✅ PASS.** From the switcher
   → new conversation created → URL changed to the new id; row
   count went from 1 → 2.
6. **Switcher delete (active row). ✅ PASS.** Trash on the
   currently-active row → `confirm()` stubbed → row removed,
   navigation fell back to the remaining conversation; row count
   2 → 1.
7. **Per-user RLS. ✅ PASS.** Isolated anon client B's
   `select from conversations` returned 0 rows. A's data stayed
   invisible.
8. **Cascade via Character delete. ✅ PASS.** Deleted the owning
   Character → all its Conversations disappeared
   (1 → 0 via `on delete cascade`).
9. **Regressions 0001–0004. ✅ PASS.** `sfw_disabled` CHECK still
   rejects for anon (23514); `auth_method` spoof still blocked;
   `user_personas` + `characters` still per-user isolated;
   `/health` still 200 with anon JWT.

Screenshot: [`0005-chat-shell.png`](0005-chat-shell.png) — shows
the header (back arrow + avatar circle + name + tagline + "New
Conversation" switcher + Edit link + disabled ⋯), empty feed
placeholder, disabled composer.

### `code-review` findings

Four findings, all addressed:

- **#1 (critical) — `listConversationsForCharacter` not user-scoped.**
  **Valid; fixed.** Added a `userId` parameter and `.eq("user_id",
  userId)` predicate. Defense-in-depth against any RLS
  misconfiguration; also makes `findOrCreate` impossible to route
  into another user's row even under a hypothetical bypass.
- **#2 (critical) — stale-closure in `onConversationsChange`.**
  **Valid; fixed.** Switched to a functional `setState((prev) =>
  ...)` in `Chat.tsx`.
- **#3 (important) — bare `await deleteConversation`.** **Valid;
  fixed.** Wrapped in try/catch; on error, set a local error
  message and return before mutating the list or navigating.
- **#4 (important) — bare `await createConversationFromCharacter`
  in `onNew`.** **Valid; fixed.** Same try/catch treatment;
  surfaces the error inside the switcher panel.

### `code-simplifier` deltas

- `ChatShell.tsx:19-28` — inlined single-use `chatRootStyle` local
  into the `style` prop.
- `ConversationSwitcher.tsx:54-55` — flattened nested-if in the
  post-delete navigation branch into guard-return + single ternary
  `nav()`.
- `lib/conversations.ts:4,8,40` — downgraded three unused-external
  symbols (`BranchMode`, `CharacterSnapshot`, `buildCharacterSnapshot`)
  from `export` to module-local since the only caller is in-file.

Post-simplifier: `pnpm typecheck` clean; all 9 Playwright gates
remain green (no behavior change).

### Status

**Cycle closeable.** 9 Playwright gates PASS; 4 code-review
findings all fixed; simplifier deltas recorded. `Seed/`
untouched. Write-once trigger enforced at DB; snapshot
non-retroactive confirmed. Character tile-tap placeholder from
cycle 0004 retired — tiles now route to the correct
`/chat/:characterId/:conversationId` surface.
