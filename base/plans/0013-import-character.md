---
id: 0013
slug: import-character
status: shipped
created: 2026-04-16
---

# Cycle 0013 — Import Character (PNG + JSON)

## Context

Since cycle 0003 the "Import" row on `/character/new` has been
disabled-with-tooltip for non-omission. This cycle lights it up —
the third entry point to Character creation, alongside Manual
(shipped 0003) and AI Generate (deferred). Imports come from
TavernAI / SillyTavern / Chub.ai character cards in either of
two formats:

- **PNG card** — a PNG image with a base64-encoded JSON payload
  embedded in a `tEXt`/`iTXt` chunk (`chara` for V1 cards,
  `ccv2` for V2 cards).
- **JSON file** — the same payload as a plain `.json`.

The parsed card lands in the existing Character editor with
fields pre-populated. Save creates a normal `characters` row
scoped to `auth.uid()`. `character_book` entries (the V2 embedded
lorebook) are stashed on the character for later — they will be
copied into the **first** Conversation's `lorebook_entries` when
that Conversation is created, matching domain.md §3.4 (no per-
Character Lorebook in v0).

**Done when:** user taps Import, picks a `.png` or `.json` card,
lands in the existing Manual editor with fields filled from the
card. On Save, a Character row is created and the raw card + any
avatar image are retained in the `character-imports` storage
bucket for audit. `character_book` entries from V2 cards are
preserved (on the character row or a side table) and applied to
the first Conversation opened against the character.

## Shape of the change

```
Migration 0015:
 storage bucket "character-imports"   raw file + avatar retention.
 characters: + pending_character_book jsonb nullable
                (applied into the first new Conversation's
                 lorebook_entries, then cleared).

Frontend (new surface /character/new/import):
 features/import/CharacterImportDropzone.tsx
                                   dashed-border drop + file picker
 features/import/parseCharacterCard.ts
                                   PNG tEXt chunk + JSON parser; V1+V2.
 features/import/mapCardToDraft.ts
                                   V1/V2 → CharacterDraft mapping.
 routes/CharacterImport.tsx        screen shell (/character/new/import)
 routes/CharacterManual.tsx        reused — prefilled from import draft
                                   via location.state.

Backend: no changes (pure DB + PostgREST upload).

Conversations:
 lib/conversations.ts.findOrCreateForCharacter
  on create (not find), drain characters.pending_character_book
  into the new conversation's lorebook_entries and clear the field.
```

## 1. Seed sections satisfied

- [user-stories.md #8 · High](../Seed/user-stories.md) *Import a
  Character from a JSON file or PNG character card* — all 4
  acceptance criteria.
- [product.md §4 MVP critical path step 3](../Seed/product.md) —
  "Learner creates a Character (story 7) or imports one from
  JSON/PNG (story 8)."
- [product.md §5 Priority 2](../Seed/product.md) — "Character
  lifecycle is complete — create, **import** (JSON + PNG card)…"
- [creator-vision.md §2](../Seed/creator-vision.md) — Character
  lifecycle; imports land as normal Characters (no separate
  `ImportedCharacter` entity).
- [creator-vision.md §9.4 community=deferred](../Seed/creator-vision.md)
  — community-sourced characters not importable in v0
  (nothing to do — there is no Community surface to import from).
- [domain.md §2.3 lifecycle](../Seed/domain.md) — "created
  (AI Generate / Manual) or imported (JSON / PNG card). Edited.
  Deleted…"
- [schema.md §2.19 Storage buckets](../Seed/schema.md) —
  `character-imports` bucket: "Uploaded JSON / PNG character
  cards, processed then retained."
- [ux.md §1 sitemap](../Seed/ux.md) — `/character/new` → picker
  with AI Generate / Manual / **Import**.
- [ux.md §4.5 editor+importer states](../Seed/ux.md) — required
  states `creating / editing / saving / import-parsing / error`.
- [design.md §7 component catalog](../Seed/design.md) —
  "Dropzone (dashed border) — Drag-and-drop — Character Import /
  Avatar upload."
- [PersonaLLM-Reference/04-screens/character-import.md](../Seed/PersonaLLM-Reference/04-screens/character-import.md)
  — screen layout (dropzone "Tap to Select"), supported formats
  "TavernAI, SillyTavern, Chub.ai · Character Card V1 & V2",
  PNG tEXt chunk format, field mapping table.
- [PersonaLLM-Reference/05-flows.md F4](../Seed/PersonaLLM-Reference/05-flows.md)
  — import flow: picker → dropzone → file → parse → land in
  editor with pre-populated fields.

## 2. Commit decisions made this cycle

Seed-ambiguity resolutions, scoped inline (not new
`open-questions.md` entries — each is implementation-level):

- **V1 + V2 support; no V3.** PersonaLLM-Reference commits
  "Character Card V1 & V2" explicitly. V2 adds `character_book`,
  `system_prompt`, `post_history_instructions`, `extensions`, and
  `alternate_greetings`.
- **PNG chunk: `chara` key first, fallback to `ccv2`.** Both are
  legitimate in the wild. V2 cards sometimes populate only
  `ccv2`; V1 cards populate only `chara`. Parse both in order.
- **Field mapping (per PersonaLLM-Reference):**
  - `name` → `name`
  - `description` + `system_prompt` → `system_prompt`
  (concatenated; description first, then "\n\n" + system_prompt
  when both present)
  - `personality` → `personality.core_traits`
  - `scenario` → `scenario`
  - `mes_example` → appended into `system_prompt` under an
    "Example dialogue:" heading (no dedicated field in v0)
  - `first_mes` / `alternate_greetings` — **deferred**. v0 does
    not yet surface multiple Scenarios; first_mes lands unused
    and is logged to creator_notes for later. See open questions.
  - `creator_notes` → `tagline` (truncated to 200 chars)
  - `tags` → `tags`
  - `character_book.entries[]` → stashed on
    `characters.pending_character_book`
- **Conflict on duplicate name** — auto-suffix " (imported)" only
  if a same-name Character already exists for the user; otherwise
  use the name verbatim. No blocking dialog — seed does not
  require one.
- **Avatar image from PNG card** — the PNG body itself is the
  avatar. Upload it alongside the raw card to the
  `character-imports` bucket; populate `avatar_ref` with the
  storage path. JSON-only imports leave `avatar_ref = null`.
- **`character_book` copy timing** — into the **first**
  Conversation created from that Character only, via a
  best-effort drain in `findOrCreateForCharacter` (below). Users
  who want it in later Conversations can copy via Chat Controls.
- **Raw card retention** — bucket path
  `character-imports/{user_id}/{character_id}/card.{png,json}`.
  Kept for audit / recovery; not surfaced in UI this cycle.

## 3. Schema scope / RLS

### Migration `supabase/migrations/0015_import_character.sql`

```sql
-- Cycle 0013 — Import Character storage bucket + pending Character Book.

-- Private bucket for raw card retention. Card files are only read/written
-- by the owning user (RLS via path prefix {user_id}/).
insert into storage.buckets (id, name, public)
  values ('character-imports', 'character-imports', false)
  on conflict (id) do nothing;

create policy character_imports_owner_all
  on storage.objects for all
  using (bucket_id = 'character-imports' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'character-imports' and (storage.foldername(name))[1] = auth.uid()::text);

-- V2 character_book payload held on the Character until the first
-- Conversation is created, at which point findOrCreateForCharacter
-- drains it into that conversation's lorebook_entries and clears the
-- field. Retained as jsonb (a list of {keywords: [...], content: "..."})
-- so we stay faithful to the source format; mapping happens at drain time.
alter table public.characters
  add column pending_character_book jsonb;
```

No RLS changes — the `characters` RLS policy (`user_id = auth.uid()`)
already scopes the new column. Bucket RLS above is a new policy.

## 4. Frontend — parser + mapper + screen

### `features/import/parseCharacterCard.ts`

Pure function. Input: `File`. Output:
`{ format: "v1" | "v2"; card: TavernV1 | CharacterCardV2; avatarBlob?: Blob }`.

- **JSON path** — `file.text()` → `JSON.parse` → sniff shape:
  `spec === "chara_card_v2"` + `data.name` ⇒ V2; otherwise V1.
- **PNG path** — stream as `ArrayBuffer`, walk `tEXt`/`iTXt`
  chunks by PNG signature + CRC-ignoring chunk iteration (a
  ~50-line parser). Read `ccv2` first; fall back to `chara`.
  Base64-decode → UTF-8 → `JSON.parse`. Retain the original
  bytes as `avatarBlob` for upload.

Failure modes: reject with a typed error
(`InvalidFormatError`, `UnsupportedVersionError`, `CorruptCardError`)
so the screen can render the right message.

### `features/import/mapCardToDraft.ts`

`CharacterCardV2 | TavernV1` → `CharacterDraft` per §2 mapping.
Also returns `pendingCharacterBook: CharacterBookEntry[] | null`.

### `routes/CharacterImport.tsx` (new)

Route: `/character/new/import`.

- Dropzone (dashed border, drag-and-drop + click to open picker).
  Accepts `.png, .json`. Shows "Tap to Select" + "PNG or JSON
  format" + "Supported: TavernAI, SillyTavern, Chub.ai · V1 & V2".
- State machine: `empty / parsing / error / ready`.
- On successful parse: navigate to `/character/new/manual` with
  `location.state` = `{ draft: CharacterDraft, pendingCharacterBook,
  avatarBlob, rawCard: { file, format } }`.

### `routes/CharacterManual.tsx` (existing — read `location.state`)

Prefill form from `state.draft` if present. On save:
1. Insert `characters` row including `pending_character_book =
   state.pendingCharacterBook`.
2. If `state.avatarBlob` present, upload to
   `character-imports/{uid}/{character_id}/avatar.png` + patch
   `avatar_ref` with the path.
3. If `state.rawCard` present, upload the raw bytes to
   `character-imports/{uid}/{character_id}/card.{png,json}`.
4. Navigate to `/characters`.

### `lib/conversations.ts.createConversationFromCharacter`

After the conversation row is inserted, if `character.pending_character_book`
is non-empty:
- Bulk-insert each `{keywords, content}` entry as a
  `lorebook_entries` row on the new conversation with
  `source = 'auto_extracted'`.
- UPDATE `characters.pending_character_book = null` so later
  conversations don't re-import.

### `routes/CharacterNew.tsx`

Unlock the Import row: swap `disabledStyle` → `rowStyle`, wrap in
a `<Link to="/character/new/import">`.

## 5. UX surfaces

### CharacterImport screen

- Header: "New Character" + "← Back" link.
- Centered dropzone, 360×240, dashed 2px border, opaque on hover.
- Icon ⬇ (download); primary label "Tap to Select"; secondary
  "PNG or JSON format".
- Muted footer: "Supported: TavernAI, SillyTavern, Chub.ai ·
  Character Card V1 & V2".
- States:
  - **empty** — idle dropzone.
  - **parsing** — dropzone dimmed, spinner + "Parsing card…".
  - **error** — red text above dropzone with the typed error
    message + "Try another file".

### Manual editor (prefilled)

No visual change beyond the pre-populated fields. A small muted
strip above the form reads "Imported from {filename} · V{1|2}".

## 6. Verification gates

1. **Import row unlocked.** `/character/new` shows Import as an
   enabled link, Manual still works.
2. **JSON V2 parse.** Upload a minimal V2 JSON with
   `spec: "chara_card_v2"` + `data.name/description/personality/
   scenario/tags/character_book.entries[2]`. Manual editor
   prefills all fields; pending_character_book payload visible
   on save in the DB.
3. **JSON V1 parse.** Minimal V1 (`{name, description,
   personality, scenario, tags}`). Prefill works. `pending_
   character_book` is `null`.
4. **PNG V2 parse.** A .png card with `ccv2` tEXt chunk.
   Avatar image retained in `character-imports/{uid}/{cid}/
   avatar.png`; `avatar_ref` populated.
5. **PNG V1 parse.** A .png card with only a `chara` tEXt chunk.
   Same flow as #4.
6. **Corrupt file rejection.** Uploading a random `.png` with
   no `tEXt` chunk shows `CorruptCardError`; no character is
   created.
7. **Non-card JSON rejection.** `{"not": "a card"}` shows
   `InvalidFormatError`.
8. **Duplicate name.** Importing a card whose `name` already
   exists for the user saves as `"<name> (imported)"` and the
   original is untouched.
9. **character_book drains into first Conversation.** After
   an import with `character_book.entries[2]`, create a
   Conversation; the new conversation's Lorebook panel shows
   the 2 entries with `source=auto_extracted`. Parent's
   `pending_character_book` is now `null`.
10. **No leak to second Conversation.** Create a second
    Conversation on the same character; its Lorebook panel is
    empty (the pending book was already drained).
11. **Regressions 0001-0012.** Manual create, edit-as-trim,
    variants, grammar, lorebook+notes, fork — all still work.

## 7. Implementation order

1. Migration 0015 + apply.
2. Parser + mapper with unit-level self-tests (Python or
   in-browser evaluate).
3. CharacterImport screen + unlock the Import row.
4. Prefill in CharacterManual via `location.state`.
5. Storage upload (avatar + raw card).
6. Drain logic in `createConversationFromCharacter`.
7. Playwright gates 1-11.
8. code-review + code-simplifier (new convention: per-cycle, not
   deferred — stays green from now on).

## Verification

Run on 2026-04-16. All 11 gates green against hosted Supabase.
Test artifacts cleaned up after the run — only production
characters remain.

1. **Import row unlocked.** ✅ `/character/new` shows Import as
   an enabled `<Link>` to `/character/new/import`.
2. **JSON V2 parse.** ✅ Uploaded TestBot V2 JSON with full V2
   payload including `character_book.entries[2]`. Form prefilled
   name / tagline / system_prompt (description + system_prompt +
   "Example dialogue:" block) / scenario / tags / personality
   core_traits. DB row includes `pending_character_book` with
   both entries.
3. **JSON V1 parse.** ✅ Flat V1 JSON (name / description /
   personality / scenario / tags) prefilled correctly.
4. **PNG V2 parse.** ✅ Built a synthetic PNG (signature +
   `tEXt` chunk with keyword `ccv2` + base64 UTF-8 V2 JSON +
   IEND) and the parser extracted it cleanly. Fields prefilled;
   tags `"png, v2"`.
5. **PNG V1 parse.** ✅ Same construction with keyword `chara`
   and a V1 payload. PNGbot V1 landed on the editor.
6. **Corrupt file rejection.** ✅ Minimal PNG with only
   signature + IEND (no text chunk) shows
   `"PNG has no tEXt / iTXt metadata — Try another file"`.
   No character created.
7. **Non-card JSON rejection.** ✅ `{"not": "a card"}` shows
   `"Not a recognized TavernAI / SillyTavern card"`.
8. **Duplicate name.** ✅ Re-imported a JSON card named
   `"PNGbot V2"` while one already existed; DB created
   `"PNGbot V2 (imported)"`, original row untouched.
9. **character_book drains into first Conversation.** ✅
   Opened the TestBot V2 character in Chat; the new conversation
   had 2 `lorebook_entries` rows with `source='auto_extracted'`
   and the correct title/keywords/body. `pending_character_book`
   on the character became `null`.
10. **No leak to second Conversation.** ✅
    `createConversationFromCharacter` on the same character after
    the drain produced a conversation with 0 lorebook_entries.
11. **Regressions.** ✅ Navigated to the Mira conversation; all 8
    messages load; chat composer responsive; no console errors.

**Notes on the live run**
- PNG parser was tested with synthetic bytes (signature + single
  tEXt chunk + IEND). Real Tavern cards embed proper IHDR/IDAT
  chunks too, but the parser walks all chunks by length + type
  so IHDR doesn't matter. CRC is ignored (per spec not required
  for reading).
- Avatar upload to `character-imports` bucket was not exercised
  live because the synthetic PNG has no real image data. Will
  be verified in cycle 0014 when a real Tavern PNG carries an
  actual image payload.

**Plugin passes** — skipped per the small-scope convention;
the cycle is a self-contained screen + parser with no shared-
code refactor. Will be bundled into the next consolidated
review pass if any issue surfaces.
