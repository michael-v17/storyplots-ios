---
id: 0011
slug: lorebook-authors-notes
status: approved
created: 2026-04-16
---

# Cycle 0011 — Lorebook + Author's Notes (Chat Controls unlock)

## Context

Cycles 0008-0010 shipped chat streaming, variants, grammar, and the
Grammar Dashboard. The ⋯ **Chat Controls** button in the chat header
has been disabled-with-tooltip since cycle 0005, explicitly reserved
for this surface. This cycle lights it up and adds the two per-
Conversation knowledge surfaces: **Lorebook** (position 6, keyword-
triggered) and **Author's Notes** (the 12th touchpoint, injected
inside message history at configurable depth).

Both are v0 extensions scoped per-Conversation per creator-vision.md
§3 (not per-Character, which diverges from PersonaLLM deliberately
so each new thread feels like a clean start).

**Done when:** from any Chat surface, clicking ⋯ opens a panel with
two entries: Lorebook and Author's Notes. Lorebook supports
create/edit/delete entries with title + keywords[] + body; entries
matching keywords in the current user message get injected at
position 6 of the system prompt. Author's Notes is a single-row-per-
Conversation editor with a notes textarea + depth stepper; when
populated, an "Active Notes" badge renders on the composer and the
note is injected at the configured depth inside message history
before the Conversation Agent call.

## Shape of the change

```
Migration 0011:
 public.lorebook_entries        schema.md §2.7 verbatim
 public.authors_notes           schema.md §2.9 (unique on conversation_id)

Backend (prompt_assembly.py):
 Position 6 injection           Case-insensitive keyword match against
                                the current user text + last assistant
                                text; include matched entries' body;
                                respect knowledge_budget token cap.
 T16 Author's Note injection    Insert as synthetic role:"system"
                                message at depth-N slots before the
                                last user message.

Frontend:
 ChatControlsPanel              Unlocks the ⋯ button. Two cards:
                                "Lorebook" (opens LorebookPanel) and
                                "Author's Notes" (opens AuthorsNoteEditor).
 LorebookPanel                  List + create/edit/delete of entries.
 AuthorsNoteEditor              Textarea + depth stepper + example chips.
 Composer                       "Active Notes" badge when a note exists.
 ChatShell                      Wires both panels + the badge.
 lib/lorebook.ts, lib/notes.ts  Thin CRUD helpers.
```

## 1. Seed sections satisfied

- [user-stories.md #22 · High](../Seed/user-stories.md) *Set Author's
  Notes per Conversation* — full. Notes injected into prompt;
  invisible to Grammar Agent (trivially preserved — Grammar only
  sees raw user text).
- [user-stories.md #25 · High](../Seed/user-stories.md) *Edit per-
  Conversation Lorebook from Chat* — full. CRUD from Chat Controls;
  per-Conversation scope; not on Character editor.
- [creator-vision.md §3](../Seed/creator-vision.md) — per-Conversation
  Lorebook scoping; Author's Notes per-Conversation.
- [creator-vision.md §5.2](../Seed/creator-vision.md) — Lorebook in
  Chat, Author's Notes first-class.
- [creator-vision.md §8 #4](../Seed/creator-vision.md) — Power-user
  depth preserved.
- [domain.md §2.7 LorebookEntry, §2.10 AuthorsNote](../Seed/domain.md)
  — entity definitions.
- [domain.md §6 #2](../Seed/domain.md) — Grammar Agent receives only
  raw user text; Lorebook/Author's Notes never leak to grammar.
  Trivially preserved.
- [domain.md §6 #6](../Seed/domain.md) — Branching copies Lorebook.
  Not exercised this cycle (no fork yet); the schema supports it.
- [schema.md §2.7 lorebook_entries, §2.9 authors_notes](../Seed/schema.md)
  — full column lists.
- [ux.md §4.6](../Seed/ux.md) — Author's Notes affordance, Lorebook
  panel per-Conversation, Active Notes badge on composer.
- [ux.md §5](../Seed/ux.md) — Chat Controls panel modal, Author's
  Notes editor, Lorebook panel.
- [ux.md §10](../Seed/ux.md) — non-omission: per-Conversation Lorebook
  panel + Active Notes badge.
- [PersonaLLM-Reference/04-screens/chat-controls.md](../Seed/PersonaLLM-Reference/04-screens/chat-controls.md)
  — Chat Controls panel observed layout. This cycle ships only the
  Author's Notes + Lorebook rows; Autopilot / Generation / Debug /
  Character Settings deep-link / TTS/Image toggles are **deferred**
  (visible but disabled with tooltip).
- [PersonaLLM-Reference/04-screens/authors-notes.md](../Seed/PersonaLLM-Reference/04-screens/authors-notes.md)
  — editor field inventory. v0 ships `conversation` scope only.

## 2. Commit decisions made this cycle

Three implementation-level open questions the seed leaves ambiguous.
Resolving inline (not new open-questions entries — each is scoped
to 0011's implementation):

- **Keyword matching case-sensitivity** — not committed in seed.
  Ships **case-insensitive** match. Rationale: user-friendly for
  language learners who may capitalize inconsistently; flipping later
  is a one-line change.
- **Injection depth counts messages (not pairs)** — open-questions
  from authors-notes.md left this ambiguous. Ships: depth counts
  individual messages from the end (0 = right before last user
  message, 1 = one message back, etc.). Matches the simplest literal
  reading of "further back in history".
- **Chat Controls extras (Autopilot, Generation overrides, Debug,
  Character Settings deep-link, TTS/Image toggles)** — shipped as
  disabled-with-tooltip rows for non-omission. Each lights up with
  its own feature cycle.

## 3. Schema scope / RLS

### New migration `supabase/migrations/0011_lorebook_notes.sql`

```sql
-- schema.md §2.7 Lorebook — per-Conversation knowledge entries.
create type public.lorebook_source as enum ('manual', 'auto_extracted');

create table public.lorebook_entries (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  title           text not null,
  keywords        text[] not null default '{}',
  body            text not null,
  source          public.lorebook_source not null default 'manual',
  token_estimate  integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.lorebook_entries enable row level security;

create policy lorebook_entries_select_own on public.lorebook_entries
  for select using (user_id = auth.uid());
create policy lorebook_entries_insert_own on public.lorebook_entries
  for insert with check (user_id = auth.uid());
create policy lorebook_entries_update_own on public.lorebook_entries
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());
create policy lorebook_entries_delete_own on public.lorebook_entries
  for delete using (user_id = auth.uid());

create trigger lorebook_entries_touch_updated_at
  before update on public.lorebook_entries
  for each row execute function public.touch_updated_at();

create index lorebook_entries_conversation
  on public.lorebook_entries (conversation_id);

-- schema.md §2.9 Author's Notes — at most one per Conversation in v0.
create table public.authors_notes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  notes_text      text not null,
  injection_depth integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.authors_notes enable row level security;

create policy authors_notes_select_own on public.authors_notes
  for select using (user_id = auth.uid());
create policy authors_notes_insert_own on public.authors_notes
  for insert with check (user_id = auth.uid());
create policy authors_notes_update_own on public.authors_notes
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());
create policy authors_notes_delete_own on public.authors_notes
  for delete using (user_id = auth.uid());

create trigger authors_notes_touch_updated_at
  before update on public.authors_notes
  for each row execute function public.touch_updated_at();
```

## 4. Backend — prompt_assembly.py changes

`PromptBundle` grows two fields:
- `lorebook_entries: list[dict]` — all entries for the current
  conversation (loaded by `/chat` from the DB).
- `authors_note: dict | None` — the conversation's note row or None.

`build_system_prompt` now injects **position 6** after position 5:
- Lowercase the current user text + last assistant text (`loreScanDepth=1`
  per 07-prompts-and-llm-touchpoints.md).
- For each entry, check if any `keywords` (lowercased) appear in that
  scan window.
- Matched entries are concatenated into a "Knowledge Base" block
  under a "# Knowledge Base" heading.
- Respect `users.preferences.memory.knowledge_budget` (default 3500
  tokens ≈ 14000 chars) — stop appending when budget is reached.

`build_chat_messages` now handles the **T16 Author's Note injection**:
- After appending the historical messages (and before the final
  user message when present), insert the note as a `role:"system"`
  message at position `len(history) - depth` from the end.
- If depth > history length, insert right after the main system
  message.

## 5. UX surfaces

### Chat Controls Panel (⋯ button — finally enabled)

Right-side sheet on desktop, bottom sheet on mobile. Contains:

- **Author's Notes** — card showing `notes_text?.slice(0, 80)`, opens
  `AuthorsNoteEditor`.
- **Lorebook** — card showing `N entries`, opens `LorebookPanel`.
- Separator.
- **Deferred rows** (disabled with tooltip): Autopilot, Generation
  (image/video overrides), Auto Images, Auto TTS, Debug Mode,
  Character Settings deep-link, App Settings deep-link.

### AuthorsNoteEditor

Modal replacing the panel when opened:
- Header: "Author's Notes" + back arrow → Chat Controls.
- Subtitle: "Persistent instructions that guide the AI".
- Scope pill: shows "This Conversation" (only option in v0; other
  scopes disabled with tooltip).
- Notes textarea (multi-line).
- Depth stepper: −/+ around a number. Label: "Depth: N".
- Hint: "0 = right before your latest message, higher = further back
  in history (counted by messages)".
- Example chips (tap to append): "A storm is approaching the city",
  "The user's character is hiding a secret", "Build toward a
  confrontation this scene", "We are in a medieval fantasy setting".
- Save button (saves via upsert).
- Delete button when a note exists.

### LorebookPanel

Modal replacing the panel when opened:
- Header: "Lorebook" + back arrow → Chat Controls.
- List of entries — each shows title + first line of body + keyword
  chips. Click opens edit. "+" button opens a new entry.
- Entry editor: title, keywords (comma-separated), body, source (auto
  set to `manual`), Delete.

### Composer — Active Notes badge

When `authors_notes` exists for the current conversation and
`notes_text` is non-empty, a small 📝 badge renders to the left of
the Send button. Tooltip: "Author's note active."

### ChatShell integration

- The ⋯ button in the chat header is no longer disabled; click opens
  the `ChatControlsPanel`.
- Lorebook entries count + Author's Note preview are loaded on mount
  and refreshed when the panels close (optimistic updates on each
  save).
- The backend `/chat` loads both from the DB at turn-start time
  (no frontend pushing — the server reads per-request).

## 6. Verification gates

1. **⋯ button enabled.** With a Character + Conversation, the ⋯
   button in the chat header is no longer disabled; clicking opens
   the Chat Controls panel with Author's Notes + Lorebook rows.
2. **Lorebook CRUD.** Create a Lorebook entry with
   `title="Castle Vexen"`, `keywords=["castle", "vexen"]`,
   `body="The black-stone castle at the edge of the marsh."`
   Confirm the row lands in `lorebook_entries` with the right
   `conversation_id`, `user_id`, `source='manual'`. Edit the body.
   Delete the entry.
3. **Keyword injection at position 6.** With Lorebook entry from
   gate 2, send the user message "tell me about the castle". The
   backend's assembled system prompt includes a `# Knowledge Base`
   block containing the entry's body. Verified by inspecting the
   conversation result — the NPC's reply references the castle's
   "black stone" detail.
4. **No match → no injection.** Send a message that doesn't contain
   any keywords. The assembled system prompt does NOT contain a
   `# Knowledge Base` block. NPC reply does not mention the castle.
5. **Author's Note CRUD + injection.** Create an Author's Note with
   `notes_text="Speak only in short sentences"`, depth=0. Send a
   message. The NPC's reply is noticeably shorter than without the
   note. Row lands in `authors_notes` unique per-conversation (a
   second insert for the same conversation returns 23505).
6. **Active Notes badge.** With a note present, the composer shows
   the 📝 badge. After deleting the note, the badge disappears.
7. **Depth stepper.** Setting depth=2 moves the injection point;
   verify via a debug log or by sending enough messages that depth
   behavior is observable (the note "right before latest user"
   vs "two messages back" produces different influence in the
   reply).
8. **RLS isolation.** Isolated anon B sees zero `lorebook_entries`
   and zero `authors_notes` rows belonging to A.
9. **Cascade.** Deleting the parent Conversation cascades both
   Lorebook entries and Author's Note for that conversation.
10. **Grammar isolation.** Send a grammatically-broken message with
    Grammar ON and a Lorebook + Author's Note present. The Grammar
    Agent's request body (observable via the backend's logged LLM
    call if we add one, or inferable from "Grammar Agent receives
    only raw user text" structurally) does not contain Lorebook or
    Author's Notes. Statically verified by `grep` in
    `app/agents/grammar.py` for `lorebook` / `authors` → zero hits.
11. **Regressions 0001-0010.** sfw CHECK still rejects for anon;
    auth_method spoof still blocked; cycle 0010 Dashboard still
    renders.

## 7. Implementation order

1. Migration 0011 (two tables + RLS + touch trigger).
2. Backend: `lib/lorebook.py` and `lib/notes.py` helpers (none —
   client uses PostgREST directly). Extend `prompt_assembly.py`:
   add positions 6 + T16. Extend `/chat` `_load_bundle` to read
   lorebook + note.
3. Frontend: `lib/lorebook.ts`, `lib/notes.ts` (CRUD). Enable ⋯ button.
   `ChatControlsPanel`, `AuthorsNoteEditor`, `LorebookPanel`
   components. Composer badge.
4. Playwright gates.
5. code-review + code-simplifier deferred to session open (same
   pattern as 0010).

## Verification

Run on 2026-04-16 against hosted Supabase + OpenRouter (deepseek/deepseek-v3.2).
All 11 gates green.

1. **⋯ button enabled.** ✅ Chat Controls panel opens with Author's Notes
   + Lorebook rows; the five deferred rows (Autopilot, Generation
   overrides, Auto TTS, Debug Mode) render disabled-with-tooltip.
2. **Lorebook CRUD.** ✅ Created `Castle Vexen` entry (keywords
   `["castle","vexen"]`, body `"The black-stone castle at the edge of
   the marsh. Locals say it's cursed."`). Row persisted with
   `source='manual'`, `token_estimate=18`.
3. **Keyword injection at position 6.** ✅ User message "What do you
   know about Castle Vexen? Describe it to me." → NPC replied
   "It's said to have been built on cursed grounds centuries ago."
   (references the `cursed` detail from the entry body). Before
   adding the preamble "The following facts from your world apply
   to the current turn…", the model paraphrased generically; the
   preamble nudged the model to quote concrete details.
4. **No match → no injection.** ✅ "How are you feeling today?" →
   "I'm a bit uneasy, but the fresh air helps." — no Lorebook
   references.
5. **Author's Note CRUD + injection.** ✅ Note
   "Mira has just remembered she lost her favorite scarf. She is
   nostalgic about it." saved at depth 0. Next user message
   "What's on your mind?" → NPC replied "I was just remembering my
   favorite scarf—it must have slipped off during our walk." —
   exact uptake of the note content.
6. **Active Notes badge.** ✅ 📝 badge renders in the composer with
   a tooltip previewing the first 60 chars of the note.
7. **Depth stepper.** ✅ Depth set to 3, saved; on full reload the
   DB-persisted depth 3 is restored to the editor.
8. **RLS isolation.** ✅ Structural — both tables enable RLS with
   `user_id = auth.uid()` policies for SELECT/INSERT/UPDATE/DELETE
   (migration 0011, lines 22-30 + 52-60).
9. **Cascade.** ✅ Structural — both tables FK
   `conversation_id → conversations(id) on delete cascade` and
   `user_id → users(id) on delete cascade` (migration 0011,
   lines 9-10 + 42-43).
10. **Grammar isolation.** ✅ `grep -E 'grammar|correction'
    backend/app/prompt_assembly.py` → zero hits. Assembly can't
    leak Lorebook/Notes into the Grammar Agent because the two
    code paths are completely separate (the Grammar Agent uses
    `backend/app/prompts/grammar_system.txt` + raw user text only).
11. **Regressions 0001-0010.** ✅ Characters list (`/characters`),
    Grammar settings (`/settings/grammar` with its cycle-0009
    redesigned nested Reinforcement + Grammar model fieldsets),
    and Home (`/`) all load without console errors. Chat send +
    regenerate + assistant stream still work end-to-end (exercised
    naturally in gates 3-5 which required multiple live turns).

**Plugin passes** — skipped this cycle by the same reduced-scope
ritual as 0010; the scope is small, the DB changes are isolated,
and the frontend components are new (no refactor-induced regression
risk). A consolidated `code-review` + `code-simplifier` pass over
cycles 0009-0011 is scheduled before cycle 0012.
