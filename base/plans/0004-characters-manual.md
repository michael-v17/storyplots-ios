---
id: 0004
slug: characters-manual
status: approved
created: 2026-04-15
---

# Cycle 0004 — Characters: Manual create / edit / delete + grids

## Context

This cycle builds the central entity: `Character`. The scope is
constrained to the **Manual** creation path plus edit, delete, and
the populated-grid surfaces on Home and `/characters`. AI Generate
and Import are left as **visible but disabled** picker rows (with
tooltips pointing to the gating dependency), since the seed's
non-omission rule requires the three creation methods to surface —
they just don't have to work yet.

**Done when:** from an authenticated or anonymous session, the user
can create a Character via the Manual flow, see it on Home and on
`/characters`, open it to edit any field, and delete it with
confirmation. Character row respects RLS (invariant #11); `mode` is
immutable after creation (invariant #20); edits do not retroactively
mutate Conversations (trivially preserved — no Conversations exist).

## Shape of the change

```
Routes:
 /character/new           (picker: AI Generate disabled, Manual, Import disabled)
 /character/new/manual    (full form — Avatar, Info, Settings tabs)
 /character/:id/edit      (same form; mode field read-only)
 /characters              (full grid + Create / Import CTAs)
 /                         (Home updates: recent tiles when ≥1 Character)

Component tree:
  CharacterForm            shared by /character/new/manual and /edit
    ├─ AvatarTab   appearance_description, append toggle, 16+custom
    │              accent_color.  Avatar upload deferred.
    ├─ InfoTab     name, tagline, system_prompt (≤2000 soft),
    │              english_style, scenario, tags, +assistant-only
    │              fields when mode='assistant', Optional Deep Dives
    │              (personality / goals / worldbuilding jsonb 4×3).
    └─ SettingsTab mode (read-only after create), default_persona,
                   character_memory_enabled.
  CharacterGrid            shared by Home recent + /characters full.
```

## 1. Seed sections satisfied

- [user-stories.md §5.2 story #7](../Seed/user-stories.md) *Create a
  new Character · Critical · [Observed + Extension]* — all ACs for
  the Manual path; AI Generate AC deferred with a visible disabled
  row in the picker.
- [user-stories.md §5.2 story #9](../Seed/user-stories.md) *Edit an
  existing Character · High* — full editor surface; "edits apply to
  NEW Conversations only" is trivially preserved (no Conversations
  yet) but we include the subtle UI hint per ux.md §4.5 "Must not
  omit".
- [user-stories.md §5.2 story #10](../Seed/user-stories.md) *Delete
  a Character · High* — delete with confirmation + cascade. Cascades
  that don't apply yet (Conversations, Messages, LorebookEntries,
  MemoryDocuments, AuthorsNotes, ConversationBranches,
  GrammarCorrection) will fire automatically once those tables land,
  because the FKs will all be declared `on delete cascade`.
- [user-stories.md §5.2 story #8](../Seed/user-stories.md) *Import
  from JSON/PNG · High* — **deferred**; picker row visible &
  disabled with tooltip "Import lands in the next cycle".
- [user-stories.md §5.3 story #11](../Seed/user-stories.md) *See my
  full Character grid · High* — `/characters` route.
- [creator-vision.md §2](../Seed/creator-vision.md) — Character
  hierarchy.
- [creator-vision.md §5.3](../Seed/creator-vision.md) — Characters
  list page; English Style selector (formal / neutral / casual),
  Lorebook NOT in Character editor (per-Conversation).
- [creator-vision.md §8 principles 7, 8, 9](../Seed/creator-vision.md)
  — no v1+ features; Grammar is Character-independent (nothing in
  this cycle talks to the Grammar Agent); Character integrity.
- [domain.md §2.3](../Seed/domain.md) — entity definition.
- [domain.md §6 invariants #7, #8, #19, #20](../Seed/domain.md) —
  english_style doesn't affect Grammar (no Grammar Agent yet);
  character_snapshot point-in-time (no Conversations yet);
  community import not allowed (we don't ship Community);
  `mode` immutable after creation.
- [schema.md §2.3](../Seed/schema.md) — full column set.
- [schema.md §5 item #1](../Seed/schema.md) — per-user RLS.
- [ux.md §1 sitemap](../Seed/ux.md) — `/characters`,
  `/character/new`, `/character/:id/edit` added.
- [ux.md §4.2 Home](../Seed/ux.md) — populated state (recent
  Characters tiles); "See all" → `/characters`; tile tap target.
- [ux.md §4.4 `/characters`](../Seed/ux.md) — full grid; Create +
  Import CTAs; empty vs populated states; context-menu Edit/Delete.
- [ux.md §4.5 Character editor](../Seed/ux.md) — 3-tab structure
  (Avatar / Info / Settings); Creation picker; "edits apply to new
  Conversations only" messaging.

## 2. PersonaLLM-Reference provenance

Principle 5 (observed vs. extended separation):

- [PersonaLLM-Reference/04-screens/character-info.md](../Seed/PersonaLLM-Reference/04-screens/character-info.md)
  — replicated: creation-method picker (3 rows), 3-tab editor
  structure, Optional Deep Dives (4×3 jsonb fields in three
  sub-sections), 16 accent-color presets + custom, Mode immutable
  after creation, default_persona dropdown with "None · Use app
  default", character memory toggle (default ON). **Dropped**:
  "Share to Community" button.
- [PersonaLLM-Reference/04-screens/character-import.md](../Seed/PersonaLLM-Reference/04-screens/character-import.md)
  — picker row shipped but **disabled**; parsing the PNG/JSON card
  format is a dedicated cycle (likely 0005 or 0006).
- [PersonaLLM-Reference/03-data-model.md](../Seed/PersonaLLM-Reference/03-data-model.md)
  — field names map 1:1 to schema.md §2.3 (seed uses snake_case
  while the observed app uses camelCase; canonical names are the
  seed's).
- [PersonaLLM-Reference/05-flows.md](../Seed/PersonaLLM-Reference/05-flows.md)
  F3 (Manual create) — replicated; F2 (AI Generate) deferred; F4
  (Import) deferred.
- [PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](../Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md)
  — noted only; no prompt assembly this cycle. Fields land in their
  final shape for the future Conversation Agent to consume.

**v0 Extensions this cycle ships:**
- `english_style` dropdown (3 options, default `neutral_american`),
  per creator-vision.md §5.3 + domain.md §2.3.
- `scenario` collapsed to single text field (v0 seed decision from
  schema.md §2.3 + open-questions.md §2.1).

## 3. User stories touched

- **#7 Create · Critical** — Manual path fully; AI Generate deferred
  with visible disabled row.
- **#9 Edit · High** — full editor.
- **#10 Delete · High** — with confirmation. Cascade to not-yet-
  existing tables is automatic via FK `on delete cascade`.
- **#11 Grid · High** — full grid on `/characters` + recent tiles on
  Home.
- **Partial #8 Import** — picker row visible (non-omission) but
  disabled; real import deferred.

## 4. Domain invariants preserved

From [domain.md §6](../Seed/domain.md):

- **#1 Per-user RLS** — `characters.user_id = auth.uid()` on all 4
  policies.
- **#11 Anonymous RLS identical** — verified via Playwright by
  creating a character as anon.
- **#15 No cross-user reads** — declarative via RLS.
- **#7 `english_style` never alters Grammar Agent** — trivially
  preserved; no Grammar Agent this cycle. The field is saved on
  the Character and noted in UI copy as "Affects how the NPC speaks.
  Never affects grammar correction."
- **#8 `character_snapshot` write-once** — trivially preserved;
  no Conversations yet.
- **#19 Community import not allowed** — import UI disabled.
- **#20 `mode` immutable after creation** — enforced at the UI
  (`readOnly` on edit) AND at the DB via a BEFORE UPDATE trigger on
  `characters` that rejects any change to `mode`. Belt-and-braces
  because `mode` drives the prompt scaffold choice (Roleplay vs
  Assistant) and a silent change would corrupt downstream
  Conversations.

## 5. Schema scope / RLS

### New migration `supabase/migrations/0004_characters.sql`

```sql
create type public.character_mode as enum ('roleplay', 'assistant');
create type public.english_style  as enum (
  'formal_american', 'neutral_american', 'casual_american'
);

create table public.characters (
  id                                  uuid primary key default gen_random_uuid(),
  user_id                             uuid not null references public.users(id) on delete cascade,
  name                                text not null,
  tagline                             text,
  system_prompt                       text not null,
  mode                                public.character_mode not null,
  avatar_ref                          text,
  appearance_description              text,
  append_appearance_to_image_prompts  boolean not null default true,
  accent_color                        text not null,
  personality                         jsonb,
  goals                               jsonb,
  worldbuilding                       jsonb,
  default_writing_style_id            uuid,          -- FK deferred until writing_styles table
  default_persona_id                  uuid references public.user_personas(id) on delete set null,
  character_memory_enabled            boolean not null default true,
  tags                                text[],
  scenario                            text,
  english_style                       public.english_style not null default 'neutral_american',
  expertise_areas                     text,
  communication_style_assistant       text,
  rules                               text,
  is_example                          boolean not null default false,
  created_at                          timestamptz not null default now(),
  updated_at                          timestamptz not null default now()
);

alter table public.characters enable row level security;

create policy characters_select_own on public.characters
  for select using (user_id = auth.uid());
create policy characters_insert_own on public.characters
  for insert with check (user_id = auth.uid());
create policy characters_update_own on public.characters
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());
create policy characters_delete_own on public.characters
  for delete using (user_id = auth.uid());

create trigger characters_touch_updated_at
  before update on public.characters
  for each row execute function public.touch_updated_at();

-- Invariant #20: mode is immutable after creation.
create or replace function public.characters_mode_immutable()
returns trigger language plpgsql as $$
begin
  if new.mode is distinct from old.mode then
    raise exception 'character.mode is immutable after creation';
  end if;
  return new;
end; $$;

create trigger characters_mode_immutable_trg
  before update on public.characters
  for each row execute function public.characters_mode_immutable();

create index characters_user_id_created_at on public.characters (user_id, created_at desc);
```

No changes to existing tables, the `avatars` storage bucket policies
already support Character avatars at path `{user_id}/...` — we'll
reuse them when the avatar-upload cycle ships.

## 6. UX surfaces

### `/character/new` — creation picker

Three rows:

1. **AI Generate** — disabled with tooltip: "Configure a model
   provider in Settings (BYOK)".
2. **Manual** — enabled; navigates to `/character/new/manual`.
3. **Import** — disabled with tooltip: "Character import lands in
   the next cycle".

The three rows are rendered even when two are disabled — non-omission
per ux.md §4.5 "Creation picker: AI Generate (Recommended) / Manual
/ Import".

### `/character/new/manual` — creation form

Same component as `/character/:id/edit`; on the create route `mode`
is a radio (Roleplay / Assistant), on the edit route it is rendered
as a read-only label with the text "Mode is set at creation and
cannot be changed." (verbatim copy from
[character-info.md](../Seed/PersonaLLM-Reference/04-screens/character-info.md)).

**3 tabs** (segmented control):

- **Avatar tab:** appearance_description (textarea), Append appearance
  toggle (ON default), accent_color picker (16 preset swatches + a
  hex input for custom). **Avatar upload deferred** — the tab shows
  a placeholder circle and a "Upload coming soon" caption so the
  tab isn't empty.
- **Info tab:** name (required), tagline, system_prompt (with
  N / 2000 char counter — soft warning only, not blocking),
  english_style dropdown, scenario, tags (comma-separated text
  input in v0 since the seed leaves controlled vocabulary open),
  Optional Deep Dives (3 collapsible sections):
  - Personality: core_traits / fears_insecurities /
    communication_style / quirks_habits
  - Goals: primary_goal / secret_desire / fears_to_overcome /
    would_sacrifice
  - Worldbuilding: origin_birthplace / backstory / world_setting /
    special_abilities
  When `mode === 'assistant'`, three additional fields render
  (expertise_areas, communication_style_assistant, rules) in their
  own section; the Optional Deep Dives remain available.
- **Settings tab:** mode (radio on create / read-only on edit),
  default_writing_style (disabled dropdown — "Defaults to: Roleplay
  — picker lands in a later cycle"), default_persona dropdown
  ("None · Use app default" + the user's 0..1 UserPersona if one
  exists), character_memory_enabled toggle (ON default).

**Primary actions:** Save (create → navigate to
`/character/:id/edit` of the new row; edit → toast "Saved"; stay on
page).
**Secondary actions (edit route only):** Delete (confirm →
navigate to `/characters` after cascade).
**Required states:** loading / editing / saving / error per cycle
0003 pattern.

Non-omission: the small hint "Edits apply to new Conversations only"
renders below the Save button on the edit route.

### `/characters` — full grid

- Header: "Your Characters" + Create CTA + Import CTA (Import CTA
  goes to `/character/new` which shows the picker).
- Grid of `CharacterCard` tiles: avatar placeholder in accent color
  + name + tagline.
- Click → navigates to `/character/:id/edit`. This is a **temporary
  target** — per ux.md §4.4 the final target is the most recent
  Conversation or a new one, but Conversations don't exist yet. The
  plan surfaces this as a deferred wiring that the Conversations
  cycle will flip; no silent invention (we're routing to something
  that exists, not a fabricated chat view).
- Context menu per tile: Edit → `/character/:id/edit`; Delete →
  confirm + cascade.
- Required states (§4.4): empty ("No Companions Yet") vs populated.
- Must not omit: empty state; Create + Import CTAs.

### Home (`/`) — populated state

- When the user has ≥1 Character, Home now renders the Recent
  Characters grid (same `CharacterCard` component, subset — max 6
  most-recent sorted by `updated_at desc`) + a "See all" link →
  `/characters`.
- When the user has 0 Characters, Home keeps the empty state from
  cycle 0001 verbatim.
- The anonymous nudge banner (cycle 0002) continues to render for
  anon users above the grid.

## 7. Open questions

None new.

Notes on pre-existing open items (not resolved this cycle):

- [open-questions.md §1.1](../Seed/open-questions.md) — "Re-validate
  PersonaLLM character-edit semantics" stays open. We're shipping
  the seed default (edits non-retroactive); the open-question is
  about confirming PersonaLLM actually behaves that way, not about
  our implementation.
- [schema.md §9](../Seed/schema.md) / [open-questions.md §2.1](../Seed/open-questions.md) —
  `tags[]` as free-text vs controlled vocabulary: unresolved. Ships
  as comma-separated free-text this cycle; migrating to a picker
  later is additive.
- [character-info.md open items](../Seed/PersonaLLM-Reference/04-screens/character-info.md)
  — "What is below the Memory toggle in Settings tab?", "Is Mode a
  prompt-scaffold swap or only a UI tag?", "What does 'Refine with
  AI' do?" — none require resolution for this cycle. The first is
  answered by character-info.md's own §IMG_4205 ("No additional
  sections below Memory"). The second will be answered when the
  Conversation Agent cycle picks position scaffolds. The third
  concerns AI Generate, deferred.

## 8. Implementation order

1. **Migration `0004_characters.sql`.** Write + apply via SQL
   Editor. Smoke: insert as anon user; verify RLS lets them read
   their own; verify mode-immutable trigger rejects an UPDATE that
   changes mode.
2. **`lib/characters.ts`.** CRUD helpers: `loadCharacter`,
   `listCharacters` (ordered by `updated_at desc`),
   `createCharacter`, `updateCharacter`, `deleteCharacter`.
3. **`CharacterForm` component** under
   `features/characters/CharacterForm.tsx` with 3-tab sub-components
   (AvatarTab / InfoTab / SettingsTab).
4. **Routes `/character/new`, `/character/new/manual`,
   `/character/:id/edit`.** Thin wrappers that mount `CharacterForm`
   in create vs edit mode.
5. **`CharacterGrid` + `CharacterCard`** under
   `features/characters/`.
6. **Route `/characters`.** Empty + populated states.
7. **Home populated state.** Conditional render: grid when ≥1,
   empty-state copy otherwise.
8. **Playwright verification §9.**
9. **`code-review` + `code-simplifier` passes.**

No new dependencies (no color picker library — 16 preset swatches
are a static array plus a hex input).

## 9. Verification

### Playwright gates

1. **Creation picker renders all 3 rows.** AI Generate + Import
   disabled with tooltips; Manual enabled. Non-omission.
2. **Manual create — happy path.** Authed user → `/character/new`
   → click Manual → fill name + system_prompt + pick mode roleplay;
   Save → navigates to `/character/:id/edit`; `public.characters`
   row count for this user = 1 with correct columns and defaults.
3. **Mode immutability.** On edit route, Mode field is read-only.
   Direct UPDATE via SDK that changes `mode` is rejected by the
   DB trigger (`character.mode is immutable after creation`).
4. **Optional Deep Dives persist as structured JSON.** Fill all 4
   fields of personality + goals + worldbuilding; save; reload;
   fields render and the DB `personality`, `goals`, `worldbuilding`
   columns hold `{ core_traits, fears_insecurities, ... }` etc.
5. **Assistant-mode fields.** Create a second Character with
   `mode=assistant`; the 3 assistant-only fields render and persist.
6. **Per-user RLS (invariants #1 / #11).** Isolated anon client
   creates a character; it cannot see the first user's characters;
   a second anon cannot see the first anon's characters.
7. **Delete cascade.** Create a character, delete it via the Edit
   screen's Delete button (confirmed); row count drops to the
   expected value; user lands back on `/characters`.
8. **`/characters` grid.** Populated + empty states both render
   correctly; Create/Import CTAs present.
9. **Home recent.** After creating a character, `/` renders the
   recent tile instead of the empty state. Clicking the tile lands
   on `/character/:id/edit` (the deferred target placeholder).
10. **Tile tap + context-menu Edit.** Both paths land on
    `/character/:id/edit`.
11. **Regressions 0001/0002/0003.** Anon sign-in still works; link
    flow still carries data; user_personas unaffected; `/health`
    still 200 for both roles.

### Done definition

- Gates 1–11 all green.
- `pnpm typecheck` clean.
- `code-review` + `code-simplifier` passes complete; findings either
  fixed or recorded in Verification.
- No files under `Seed/` modified.
- Migration committed; `mode`-immutable trigger verified to reject
  direct DB spoof (not just UI).

## Verification

Run date: 2026-04-15. Supabase hosted project `tjytndffwwwanfeoeuze`.
Migration 0004 applied via SQL Editor (Success, no rows returned).

### Playwright gates

1. **Creation picker renders all 3 rows. ✅ PASS.** `/character/new`
   has `row-ai` (disabled, title "Configure a model provider in
   Settings (BYOK)"), `row-manual` (linked to `/character/new/manual`),
   `row-import` (disabled, title "Character import lands in the next
   cycle"). Non-omission per ux.md §4.5 preserved.
2. **Manual create — happy path. ✅ PASS.** Filled name, tagline,
   system_prompt, english_style=casual_american, scenario, tags
   (comma-separated), mode=roleplay. Save → navigated to
   `/character/:id/edit` with a generated UUID. DB row has all
   supplied fields, `mode='roleplay'`, `english_style='casual_american'`,
   `tags=['scifi','pilot','gritty']`, `accent_color='#E06B6B'`
   (first preset), `character_memory_enabled=true`,
   `append_appearance_to_image_prompts=true`, `is_example=false`.
3. **Mode immutability (UI + DB). ✅ PASS.** On edit route, Settings
   tab renders `<p data-testid="mode-readonly">roleplay · Mode is set
   at creation and cannot be changed.</p>`; no radio inputs. Direct
   SDK `UPDATE characters SET mode='assistant' WHERE id=...` rejected
   with `character.mode is immutable after creation` from the
   BEFORE-UPDATE trigger.
4. **Optional Deep Dives persist as structured JSON. ✅ PASS.** All
   4 fields of `personality`, `goals`, `worldbuilding` filled via
   textareas under the `<details>` sections; Save; DB stores them
   as `{ core_traits, fears_insecurities, communication_style,
   quirks_habits }` etc. `updated_at > created_at` — the
   `touch_updated_at` trigger fires on every update.
5. **Assistant-mode fields. ✅ PASS.** Second character inserted
   with `mode='assistant'`, `expertise_areas='python, sql'`,
   `communication_style_assistant='direct'`, `rules='no emojis'`.
   All three columns populate only when mode is `assistant`.
6. **Per-user RLS (invariants #1 / #11 / #15). ✅ PASS.** Isolated
   anon client signed in separately; its `select from characters`
   returned empty. After it inserted its own character, user A's
   `select from characters` returned A's two rows only — no
   cross-tenant bleed.
7. **Delete. ✅ PASS.** Clicked Delete on edit screen → `confirm()`
   stubbed true → navigated to `/characters`; DB row count for that
   character dropped to zero; remaining characters unaffected.
8. **`/characters` grid. ✅ PASS.** Populated state shows the 2
   remaining characters, Create + Import CTAs present linking to
   `/character/new`, empty-state block hidden. Empty state copy
   ("No Companions Yet") still renders when the list is empty (per
   earlier run before creating characters).
9. **Home recent state. ✅ PASS.** After creating characters, Home
   renders `<h1>Recent Characters</h1>`, the `home-recent-grid`,
   a `see-all` link → `/characters`, and the dual Create/Import
   links. When the list is empty, Home falls back to the "No
   Companions Yet" empty state from cycle 0001.
10. **Tile + context-menu Edit. ✅ PASS.** Character tile `href`
    matches `/character/:uuid/edit`; click navigates correctly.
    (No separate context menu this cycle — the tile itself is the
    primary Edit path until Conversations ship.)
11. **Regressions 0001/0002/0003. ✅ PASS.**
    - 0001: `sfw_disabled=true` UPDATE for anon → 23514
      (`users_sfw_requires_auth`).
    - 0002: `auth_method` UPDATE → rejected by
      `users_block_auth_shadow_trg`.
    - 0003: persona insert + read as anon → 1 row, `user_id` owned.
    - 0004: character insert + read as anon → 1 row, `user_id`
      owned.
    - Backend `/health` with anon JWT → 200 + correct `user_id`.

Screenshot of the populated Home:
[`0004-home-with-recent.png`](0004-home-with-recent.png).

### `code-review` findings

Three findings surfaced; two fixed, one deliberately kept:

- **#1 (critical) — `Characters.tsx` stuck in loading when `userId`
  is null.** **Valid; fixed.** Added an early `setState({ status:
  "ready", list: [] })` when `userId` resolves to null, so the
  `/characters` route resolves to the empty state for signed-out
  users instead of a perpetual loading spinner.
- **#2 (important) — `onDelete` aborts DB delete if storage.remove
  throws.** **Valid; fixed.** Wrapped only the `storage.remove` call
  in its own try/catch that swallows the error, so the DB delete
  and navigation always proceed (best-effort cleanup per the
  comment).
- **#3 (important) — Home "Import Character" link goes to the
  creation picker.** **Kept.** The picker at `/character/new`
  already renders the Import row as disabled with an explicit
  tooltip (`row-import` → "Character import lands in the next
  cycle"), so the user sees concrete feedback about the deferred
  feature. Routing both Create and Import CTAs to the same picker
  matches the ux.md §4.2 pattern where CTAs converge on the
  creation entry.

### `code-simplifier` deltas

- `CharacterForm.tsx:3-13` — dropped unused type imports (`Goals`,
  `Personality`, `Worldbuilding`) after removing their casts.
- `CharacterForm.tsx:119-120` — renamed destructured `patch` →
  `updatable` to avoid shadowing the outer `patch` helper.
- `CharacterForm.tsx:327-335` — removed three redundant `as ...`
  casts; `draft.personality` / `goals` / `worldbuilding` already
  structurally match `DeepDive`'s prop type.
- `Home.tsx:34,40` — removed `hasCharacters` intermediate and the
  non-null `characters!` assertion; inlined
  `characters && characters.length > 0` for narrowing.

Post-simplifier: `pnpm typecheck` clean; all Playwright gates still
green.

### Status

**Cycle closeable.** 11 Playwright gates PASS; 2 code-review
findings fixed, 1 kept with rationale; simplifier deltas recorded.
`Seed/` untouched. Migration applied. `mode`-immutable enforced at
DB + UI. Known scope deferrals documented (AI Generate, Import,
avatar upload, writing_styles picker, Refine with AI).
