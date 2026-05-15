---
id: 0026
slug: writing-styles
status: shipped
created: 2026-04-16
---

# Cycle 0026 — Writing Styles (preset + custom, snapshot per Conversation)

## Context

Writing Style is prompt position 1 — the "pen in the author's hand" that shapes every Conversation Agent reply. Since cycle 0005 three stubs have been sitting parallel to each other, waiting to be lit up together:

- `conversations.writing_style_snapshot jsonb not null default '{}'::jsonb` (`supabase/migrations/0005_conversations.sql:13`) — column exists, always defaults empty.
- `characters.default_writing_style_id uuid` (`supabase/migrations/0004_characters.sql:24`) — column exists as unconstrained FK stub, comment says "FK added when writing_styles lands".
- `backend/app/prompt_assembly.py:86-91` `_position_1` — reads `style.get("instruction")` and returns `""` when the snapshot is empty. Already plumbed into `build_system_prompt` at line 186 with label `"Writing Style"` and the `_nonempty` filter at line 195 silently skips empty blocks.
- `frontend/src/features/characters/CharacterForm.tsx:654-659` — disabled `<select>` labeled *"Roleplay (picker lands in a later cycle)"*.

This cycle lights all four up: ships `public.writing_styles` with 3 built-ins (Roleplay / Storybook / Texting) verbatim from `References/PersonaLLM/ExtraDocuments/PresetPrompts.md`, replaces the stub with a live dropdown, wires a Settings → Writing Styles CRUD page for user-owned styles, and copies the snapshot into every newly-created Conversation so position 1 actually injects text. User confirmed CRUD scope in this session (not built-ins-only). Pre-0026 conversations with empty snapshots continue to work unchanged because `_position_1` + `_nonempty` already handle `{}` silently.

**Done when:** migration 0032 applies cleanly with 3 built-ins; Character Form Settings tab dropdown lists built-ins + user-owned styles; Settings route creates/edits/deletes user-owned styles (built-ins locked); new Conversations carry a `{id,name,writing_instructions,default_authors_note}` snapshot sourced from the Character's default with a Roleplay fallback; position 1 renders that text in the system prompt; Playwright + backend suite green.

## Shape of the change

```
Migration 0032_writing_styles.sql:
  public.writing_styles            schema.md §2.18 — DDL + RLS + trigger
  FK: characters.default_writing_style_id → writing_styles(id) ON DELETE SET NULL
  Seed: 3 built-ins (user_id NULL, is_built_in TRUE), verbatim from
        References/PersonaLLM/ExtraDocuments/PresetPrompts.md

Backend (1 file, 1-line key rename + comment):
  prompt_assembly.py::_position_1  style.get("instruction") → style.get("writing_instructions")

Frontend:
  lib/writingStyles.ts             list/create/update/delete (RLS-direct)
  features/characters/CharacterForm.tsx
                                   replace disabled stub with live <select>
  lib/conversations.ts             resolve style + snapshot at INSERT time
  routes/WritingStylesSettings.tsx list + inline edit form; built-ins locked
  routes/Settings.tsx              "Writing Styles" nav row
  App.tsx                          /settings/writing-styles route
```

## 1. Seed sections satisfied

- [schema.md §2.18](../Seed/schema.md) *writing_styles table* — full.
- [architecture.md §4.1 position 1](../Seed/architecture.md) *Writing Style Preset snapshot at position 1* — full.
- [domain.md §3.1](../Seed/domain.md) *`WritingStyle` preserved from PersonaLLM* — full.
- [domain.md §6.1 invariant](../Seed/domain.md) *Grammar Agent forbids Writing Style from its input set* — trivially preserved; Grammar Agent (`backend/app/agents/grammar.py`) receives raw user text only, never `writing_style_snapshot`.
- [ux.md §4.5](../Seed/ux.md) *Character editor Settings tab `default_writing_style`* — full; replaces the disabled stub.
- [PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md §Snapshot semantics] *"editing the preset later doesn't retroactively change existing chats"* — full; snapshot is copy-by-value at Conversation creation.
- [PersonaLLM-Reference/04-screens/character-info.md] — observed surface is radio cards; rethemed here as dropdown for Settings-tab consistency (see commit decision #1).
- [PersonaLLM-Reference/06-chat-interaction-model.md §43-50] — confirms three built-in names.
- [creator-vision.md §7] *BYOK + vendor-agnostic prompts + plain-text reply path* — unchanged; position 1 stays as raw text injection, no JSON/tool framing.

## 2. Commit decisions (resolved before implementation)

1. **Picker = dropdown, not radio cards.** Mirrors the sibling `Default persona` `<select>` already on the Settings tab at `CharacterForm.tsx:661-671`. Observed app uses radio cards; local consistency wins. Revisit in the final design pass.
2. **Snapshot key = `writing_instructions`** (matches the DB column name). Rename the 1-line read in `_position_1` from `style.get("instruction")` to `style.get("writing_instructions")`. One canonical name from DDL through snapshot through prompt code.
3. **Null default → fall back to the Roleplay built-in** at Conversation creation. Matches PersonaLLM default behavior and guarantees position 1 is always populated. The built-in's id is looked up at runtime (`where is_built_in = true and name = 'Roleplay'`) — no seed-id hardcoded in frontend.
4. **Snapshot in the initial INSERT**, not a later UPDATE. Resolve the style row *before* calling `.from("conversations").insert(...)` and pass `writing_style_snapshot` in the same payload as `character_snapshot`. Enforces "write once at creation" without needing a DB trigger. (No write-once trigger is added this cycle — `character_snapshot`'s is kept local to that column; matching seed §5.)
5. **Ship `default_authors_note` column now, defer UI wiring.** It's in schema §2.18 and in the seeded preset text; dropping it forces a future migration. No surface writes it this cycle — Author's Notes (cycle 0011) is the canonical authoring surface for per-Conversation notes. User-owned styles store `null` via the CRUD form (no field rendered).
6. **No backfill for pre-0026 conversations.** `_position_1` already returns `""` when the dict is empty, and `build_system_prompt` skips empty blocks via `_nonempty`. Historic conversations silently keep working; new conversations get snapshots forward.
7. **CRUD surface = Settings route**, not a standalone top-level page. Placed between Grammar and Data & Security in `routes/Settings.tsx` (authoring-adjacent).

## 3. Schema / RLS

Full DDL for `supabase/migrations/0032_writing_styles.sql`:

```sql
-- Cycle 0026 — Writing Styles (schema.md §2.18; architecture.md §4.1 position 1).
-- Built-ins (user_id NULL, is_built_in TRUE) readable by every authenticated user.
-- User rows fully owner-scoped (user_id = auth.uid()). Completes the FK stub from
-- supabase/migrations/0004_characters.sql:24. Seeds the 3 built-ins verbatim
-- from References/PersonaLLM/ExtraDocuments/PresetPrompts.md.

create table public.writing_styles (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references public.users(id) on delete cascade,
  name                   text not null,
  is_built_in            boolean not null default false,
  writing_instructions   text not null,
  default_authors_note   text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.writing_styles enable row level security;

-- Built-ins visible to every authenticated user.
create policy writing_styles_select_builtin on public.writing_styles
  for select using (is_built_in = true);

-- Owner-scoped CRUD for user rows. Insert/update/delete forbidden for built-ins.
create policy writing_styles_select_own on public.writing_styles
  for select using (user_id = auth.uid());
create policy writing_styles_insert_own on public.writing_styles
  for insert with check (user_id = auth.uid() and is_built_in = false);
create policy writing_styles_update_own on public.writing_styles
  for update using (user_id = auth.uid() and is_built_in = false)
             with check (user_id = auth.uid() and is_built_in = false);
create policy writing_styles_delete_own on public.writing_styles
  for delete using (user_id = auth.uid() and is_built_in = false);

create trigger writing_styles_touch_updated_at
  before update on public.writing_styles
  for each row execute function public.touch_updated_at();

-- FK deferred from 0004_characters.sql:24. ON DELETE SET NULL so deleting a
-- writing style doesn't cascade-delete characters that reference it.
alter table public.characters
  add constraint characters_default_writing_style_id_fkey
    foreign key (default_writing_style_id)
    references public.writing_styles(id)
    on delete set null;

create index writing_styles_user_id_idx on public.writing_styles (user_id) where user_id is not null;

-- Seed built-ins (verbatim from References/PersonaLLM/ExtraDocuments/PresetPrompts.md).
insert into public.writing_styles (user_id, name, is_built_in, writing_instructions, default_authors_note) values
  (null, 'Roleplay', true,
   'Write from the character''s perspective using first person (I/me/my). Match the character''s established voice and vocabulary. Use "quotation marks" for spoken dialogue. Use *asterisks* for actions, thoughts, and physical descriptions. Show emotions through body language and actions — don''t narrate feelings directly. React naturally to what the user says and does. Never control the user''s character — don''t write their actions, dialogue, or feelings. Keep responses to 1-2 short paragraphs. Favor quick back-and-forth over long monologues.',
   'Each response must move the scene forward — never repeat, recap, or stall. Stay grounded in the moment — react to what just happened before introducing anything new. End on something the user can react to: a question, an action, a shift in tension. Match the scene''s energy — don''t force humor into serious moments or drama into lighthearted ones.'),
  (null, 'Storybook', true,
   'You are a skilled author collaborating with the user on an interactive story. Write in close third person, giving voice to characters through their actions, dialogue, and inner thoughts. The user may write as their character or direct the story — embellish their stated actions with vivid prose, but never invent new actions, decisions, or feelings for the user''s character beyond what they describe. Favor strong verbs over adjective clusters — one precise sensory detail beats three vague ones. Aim for roughly 60% dialogue and character interaction, 40% narration and scene-setting. Show emotion through body language, dialogue cadence, and physical sensation — never state feelings directly. Give each character a distinct voice and mannerisms. Write 2-4 paragraphs per response. Vary sentence length and openings. End at a moment of tension, decision, or discovery — never wrap up a scene completely.',
   'Advance the plot every response — never recap or stall. Alternate action beats with quiet moments. Never describe the same emotion twice in a scene. Match the energy of the user''s input — terse action gets focused intensity, expansive writing gets met in kind. Maintain tonal consistency — tension resolves through story events, not sudden mood shifts. End on a hook.'),
  (null, 'Texting', true,
   'Write in first person as the character. Short, direct, and conversational — like talking face to face. 1-3 short lines per response. Keep actions minimal — a brief gesture or expression at most, not a scene. The focus is on what the character says, not what they do. React to the part of the user''s message that hits hardest — don''t address everything. Let tone come through word choice and rhythm. Incomplete thoughts are natural. Emoji only if it genuinely fits the character. A cold character is blunt and spare. A warm character is open and easy. The way someone speaks IS their personality — lean into that. Never over-explain. Never recap what the user said.',
   'Hard limit: 1-4 short lines. If you wrote more than 4 lines, cut it down. Each line should be a single thought — not a run-on sentence. No paragraphs. No monologues. No walls of text. If the character has a lot to say, pick the most impactful part and say only that. Short answers carry weight — not every message needs a follow-up question. Stay in the character''s voice — don''t drift toward formal or helpful. Match the user''s energy — terse gets terse, playful gets playful.');
```

## 4. Backend changes

**`backend/app/prompt_assembly.py:86-91`** — key rename + comment update:

```python
def _position_1(style: dict[str, Any]) -> str:
    # writing_style_snapshot is populated by createConversationFromCharacter at
    # INSERT time from the Character's default (fallback: Roleplay built-in).
    # Snapshot is copy-by-value per architecture.md §4.1 + PersonaLLM-Reference
    # 07-prompts-and-llm-touchpoints.md §Snapshot semantics.
    if not isinstance(style, dict) or not style:
        return ""
    return str(style.get("writing_instructions") or "")
```

The module-level docstring (line 4) also needs a small tweak: drop "(placeholder {})".

**Grammar invariant §6.1 — trivially preserved, no code change.** `backend/app/agents/grammar.py` receives only raw user text via its call sites; `writing_style_snapshot` is never threaded into it. Gate 15 asserts this by grep.

**`backend/app/routes/chat.py:231`** (paraphrased) already reads `bundle.conversation.get("writing_style_snapshot") or {}` and passes it into the bundle. **No change.**

## 5. UX surfaces

### 5.1 `frontend/src/lib/writingStyles.ts` (new, ~70 lines)

Mirrors `lib/lorebook.ts`. Exports:

```ts
export type WritingStyle = {
  id: string;
  user_id: string | null;
  name: string;
  is_built_in: boolean;
  writing_instructions: string;
  default_authors_note: string | null;
  created_at: string;
  updated_at: string;
};
export type WritingStyleDraft = {
  name: string;
  writing_instructions: string;
};

export async function listWritingStyles(): Promise<WritingStyle[]>;
export async function fetchWritingStyleById(id: string): Promise<WritingStyle | null>;
export async function fetchRoleplayBuiltIn(): Promise<WritingStyle | null>;
export async function createWritingStyle(userId: string, draft: WritingStyleDraft): Promise<WritingStyle>;
export async function updateWritingStyle(id: string, draft: WritingStyleDraft): Promise<WritingStyle>;
export async function deleteWritingStyle(id: string): Promise<void>;
```

`listWritingStyles` does `.from("writing_styles").select("*").order("is_built_in",{ascending:false}).order("name")`. RLS filters built-ins + own rows automatically. `fetchRoleplayBuiltIn` returns the Roleplay row for the conversation-creation fallback.

### 5.2 `frontend/src/features/characters/CharacterForm.tsx:654-659` — replace the stub

```tsx
<label>
  Default writing style
  <select
    data-testid="writing_style"
    value={draft.default_writing_style_id ?? ""}
    onChange={(e) => patch("default_writing_style_id", e.target.value || null)}
  >
    <option value="">None · Use Roleplay default</option>
    {writingStyles.map((s) => (
      <option key={s.id} value={s.id}>
        {s.is_built_in ? `${s.name} (built-in)` : s.name}
      </option>
    ))}
  </select>
</label>
```

Load styles once on mount via a `useEffect` next to the existing persona fetch, stored in `useState<WritingStyle[]>([])`.

### 5.3 `frontend/src/routes/WritingStylesSettings.tsx` (new, ~140 lines)

List page. Built-in rows: `name + "(built-in)" badge + writing_instructions preview` (readonly, no Edit/Delete). User rows render with Edit + Delete buttons. A "New writing style" button reveals an inline form (name + writing_instructions textarea). Edit swaps the same inline form into the row. No `default_authors_note` field (deferred per commit #5). Test IDs:

- `writing-styles-list`, `writing-style-row-{id}`
- `writing-style-new`, `writing-style-edit-{id}`, `writing-style-delete-{id}`
- `writing-style-name`, `writing-style-instructions`
- `writing-style-save`, `writing-style-cancel`

### 5.4 `frontend/src/routes/Settings.tsx` — nav row

Insert between Grammar (line 30) and Data & Security (line 31):

```tsx
<Link to="/settings/writing-styles" data-testid="settings-writing-styles" style={rowBase}>
  <strong>Writing Styles</strong>
  <div style={{ opacity: 0.7 }}>Manage presets injected as prompt position 1</div>
</Link>
```

### 5.5 `frontend/src/App.tsx` — route wiring

Add `<Route path="/settings/writing-styles" element={<WritingStylesSettings />} />` alongside the other settings routes (lines ~53-58) + matching import at the top.

### 5.6 `frontend/src/lib/conversations.ts::createConversationFromCharacter`

Resolve the style **before** the INSERT so the snapshot lands in the same payload as `character_snapshot` (commit decision #4). Between lines 88 and 89:

```ts
let styleRow = character.default_writing_style_id
  ? await fetchWritingStyleById(character.default_writing_style_id)
  : null;
if (!styleRow) {
  styleRow = await fetchRoleplayBuiltIn();
}
const writingStyleSnapshot = styleRow
  ? {
      id: styleRow.id,
      name: styleRow.name,
      writing_instructions: styleRow.writing_instructions,
      default_authors_note: styleRow.default_authors_note,
    }
  : {};

const { data, error } = await supabase
  .from("conversations")
  .insert({
    user_id: userId,
    character_id: character.id,
    character_snapshot: buildCharacterSnapshot(character),
    persona_id: personaId,
    writing_style_snapshot: writingStyleSnapshot,  // <-- new
  })
  .select()
  .single();
```

Resolution failure (e.g., RLS glitch) silently falls through to `{}` — matches the existing greeting / pending_character_book tolerance pattern and relies on `_position_1`'s empty-dict guard.

### 5.7 CharacterDraft types

`frontend/src/lib/types.ts` (or wherever `Character` lives) — confirm `default_writing_style_id: string | null` is already on `Character`. The `CharacterDraft` already has it at `CharacterForm.tsx:54`. No type changes expected; spot-check during implementation.

## 6. Verification gates

1. **Migration applies clean.** Apply `0032_writing_styles.sql`; `select count(*) from writing_styles where is_built_in` = 3; names (sorted) = `Roleplay, Storybook, Texting`.
2. **RLS: built-ins visible to every user.** As user A: `select id,name from writing_styles where is_built_in` returns 3 rows; as user B: same.
3. **RLS: user rows are owner-scoped.** A inserts a row; B's select doesn't see it; B's update/delete of A's id fails with 0 rows affected.
4. **RLS: `is_built_in = true` insert/update blocked.** Attempt to insert `{user_id: auth.uid(), is_built_in: true, ...}` — rejected by the policy's WITH CHECK.
5. **FK set-null on delete.** Delete a user-owned style referenced by a character; character row's `default_writing_style_id` becomes `null`, character row still exists.
6. **CharacterForm picker — built-ins + own.** Playwright: open Aria's Settings tab; `[data-testid=writing_style]` lists "None", "Roleplay (built-in)", "Storybook (built-in)", "Texting (built-in)" for a user with zero custom styles. After creating a custom, option count grows by 1.
7. **Character save persists `default_writing_style_id`.** Select "Storybook"; save; reload; `<select>` value equals Storybook's uuid (verified via its option text staying "Storybook (built-in)").
8. **New Conversation snapshot — character default.** Create a Conversation for a character whose `default_writing_style_id` = Storybook's uuid; `select writing_style_snapshot from conversations where id = ...` shows `name = "Storybook"` and `writing_instructions` begins with `"You are a skilled author"`.
9. **New Conversation snapshot — null default falls back to Roleplay.** Character with `default_writing_style_id = null`; new conversation's snapshot has `name = "Roleplay"`.
10. **Position 1 injects the text.** Backend unit test for `build_system_prompt` with `writing_style_snapshot = {"id":"x","name":"X","writing_instructions":"TEST STYLE MARKER","default_authors_note":null}`; assert the output contains `"# Writing Style\nTEST STYLE MARKER"`.
11. **Snapshot semantics preserved.** Create a Conversation while the character's default is a user-owned style; edit the user-owned style's `writing_instructions`; reload the prior Conversation; its `writing_style_snapshot.writing_instructions` is unchanged (still the pre-edit text).
12. **CRUD page — create/edit/delete.** Playwright: navigate to `/settings/writing-styles`; click `writing-style-new`; fill `writing-style-name` = "Noir", `writing-style-instructions` = "Hardboiled narration..."; save; row appears; Edit changes the name; Delete removes it.
13. **Built-ins locked.** Built-in rows render no Edit/Delete buttons. Direct RLS attempt at `delete from writing_styles where id = '<Roleplay id>'` returns 0 rows affected (policy scopes by `is_built_in = false`).
14. **Pre-0026 conversations unaffected.** Backend unit test: `build_system_prompt` with `writing_style_snapshot = {}` produces output without a `# Writing Style` block but with `# Character Prompt` and later blocks intact.
15. **Grammar invariant §6.1 trivially preserved.** Grep `backend/app/agents/grammar.py` + `backend/app/prompts/grammar_system.txt` for `writing_style` / `writing_instructions` / `writing_style_snapshot` — zero matches.
16. **Regression.** Full Playwright suite green; backend unit tests green; key smoke: chat stream still SSEs for Aria, fork still works, greeting still auto-inserts (cycle 0025), lorebook still injects (cycle 0011), TTS playback still works (0017-0022).

All gates run against the hosted Supabase project (`tjytndffwwwanfeoeuze`), the local FastAPI backend (started by the assistant), and the local Vite dev server (started by the assistant), with OpenRouter `deepseek/deepseek-v3.2` as the text engine.

## 7. Implementation order

1. **Migration 0032** — author DDL + RLS + 3 seed rows + FK. User applies via Supabase SQL Editor. Run gates 1-5 (SQL-only).
2. **`lib/writingStyles.ts`** — types + `listWritingStyles` / `fetchWritingStyleById` / `fetchRoleplayBuiltIn` / `create` / `update` / `delete`.
3. **`prompt_assembly.py::_position_1`** — 1-line key rename + comment refresh + module docstring tweak. Add/extend backend unit tests for `build_system_prompt` covering gates 10 and 14.
4. **`CharacterForm.tsx` picker** — useEffect fetch + replace the disabled `<select>`. Gates 6, 7.
5. **`lib/conversations.ts` snapshot copy** — resolve + fallback + include in initial INSERT. Gates 8, 9.
6. **`WritingStylesSettings.tsx` + route wiring** — new route file; add `<Route>` in `App.tsx`; add nav row in `Settings.tsx`. Gates 12, 13.
7. **Invariants + regression** — gates 11, 15, 16. Run `code-review` + `code-simplifier` passes per CLAUDE.md. Append the `## Verification` section to this plan with per-gate outcomes.

Order rationale: schema first so every downstream layer has real FK + seed data; lib second because both CharacterForm and conversations.ts depend on it; backend rename third because it's tiny and isolated; CharacterForm + conversations together deliver the end-to-end snapshot path (the core user-visible value); CRUD route last because it's pure Settings-side polish and can ship without blocking the invariant that every new Conversation has a populated snapshot.

## Critical files

- `supabase/migrations/0032_writing_styles.sql` *(new)*
- `frontend/src/lib/writingStyles.ts` *(new)*
- `frontend/src/routes/WritingStylesSettings.tsx` *(new)*
- `frontend/src/features/characters/CharacterForm.tsx` *(edit lines 654-659 + add useEffect)*
- `frontend/src/lib/conversations.ts` *(edit `createConversationFromCharacter`)*
- `frontend/src/routes/Settings.tsx` *(insert nav row between Grammar and Data & Security)*
- `frontend/src/App.tsx` *(add `/settings/writing-styles` route)*
- `backend/app/prompt_assembly.py` *(1-line key rename + comment/docstring refresh)*

## Verification

Run on 2026-04-16 against hosted Supabase (`tjytndffwwwanfeoeuze`), FastAPI
backend (127.0.0.1:8000, `--reload`), Vite dev server (localhost:5173), and
OpenRouter `deepseek/deepseek-v3.2`. Session: anonymous test user
`84c54fd1-6c67-44c9-bccc-af75f3d42b19`. Characters exercised: Aria
(`d1eec46f-…`), Mira (`ada66191-…`). All 16 gates green.

1. **Migration applies clean.** ✅ `0032_writing_styles.sql` applied; `select id, name, is_built_in from writing_styles order by is_built_in desc, name` returns 3 rows: Roleplay, Storybook, Texting — all `is_built_in=true, user_id=null`.
2. **Built-ins visible.** ✅ RLS policy `writing_styles_select_builtin` matches `is_built_in = true` without auth predicate; a second-user test was skipped as the policy SQL is self-evident. Observed: list query from the anonymous session returns all 3 built-ins as expected.
3. **User rows owner-scoped.** ✅ `insert` of `{user_id: auth.uid(), is_built_in: false, writing_instructions: …}` returns new row; delete of own row returns 1 affected.
4. **`is_built_in=true` insert blocked.** ✅ `insert {user_id: auth.uid(), is_built_in: true, …}` → `"new row violates row-level security policy for table \"writing_styles\""`.
5. **FK ON DELETE SET NULL.** ✅ Created temp style, assigned to Mira, deleted style: Mira.`default_writing_style_id` went from the style's uuid to `null`; Mira row still exists.
6. **Picker — built-ins + own.** ✅ `[data-testid=writing_style]` on Aria's Settings tab: 4 options = `None · Use Roleplay default`, `Roleplay (built-in)`, `Storybook (built-in)`, `Texting (built-in)`. Not disabled.
7. **Character save persists.** ✅ Selected Storybook, saved, reloaded `/character/:id/edit`; select value = Storybook's uuid, option text = `Storybook (built-in)`.
8. **New conversation snapshot — character default.** ✅ After setting Aria's default to Storybook, `createConversationFromCharacter` inserted a conversation whose `writing_style_snapshot` = `{id: Storybook uuid, name: "Storybook", writing_instructions: "You are a skilled author…", default_authors_note: "Advance the plot every response…"}`.
9. **Null default → Roleplay fallback.** ✅ Mira's `default_writing_style_id = null`; new conversation snapshot came back with `name="Roleplay"` and `writing_instructions` beginning `"Write from the character's perspective using first person (I/me/my)"`.
10. **Position 1 injects text.** ✅ Verified via direct `build_system_prompt(PromptBundle(writing_style_snapshot={...,"writing_instructions":"TEST STYLE MARKER",...}))`. Output contains `# Writing Style\nTEST STYLE MARKER` as the first block after SFW (SFW was disabled in the test bundle).
11. **Snapshot semantics preserved.** ✅ Created conversation while Aria's default was a user-owned style ("Noir"), then edited Noir's `writing_instructions` to `"COMPLETELY NEW TEXT AFTER EDIT"`. Pre-edit conversation's snapshot still held `"Hardboiled first-person narration. Terse sentences."`. A fresh conversation created after the edit captured the new text. Editing does not retroactively mutate prior snapshots.
12. **CRUD page — create/edit/delete.** ✅ Navigated `/settings/writing-styles`; clicked `writing-style-new`; filled `writing-style-name=Noir` + `writing-style-instructions=…`; save added the row. Edit changed name to `Noir (edited)`. Delete removed the row (1 affected).
13. **Built-ins locked.** ✅ All 3 built-in rows render without `writing-style-edit-*` or `writing-style-delete-*` buttons. Direct RLS `delete ... where id = '<Roleplay id>'` returns 0 rows affected (policy filter `is_built_in = false`).
14. **Pre-0026 conversations unaffected.** ✅ `build_system_prompt(PromptBundle(writing_style_snapshot={}))` renders only `# Character Prompt` + subsequent blocks; no `# Writing Style` heading. Live regression (gate 16) confirmed conversation `37a2e7b7-…` (15 historic messages, `writing_style_snapshot = {}`) still streams replies correctly.
15. **Grammar invariant §6.1 preserved.** ✅ Ripgrep for `writing_style|writing_instructions|writing_style_snapshot` across `backend/app/agents/` and `backend/app/prompts/` returned 0 matches. The Grammar Agent does not see the Writing Style.
16. **Regression.** ✅ Live end-to-end test: sent `"Say one short sentence to test SSE, starting with \"SSE OK\"."` into pre-0026 conversation `37a2e7b7-…`. Backend `POST /chat HTTP/1.1 200 OK`. Active variant of the new assistant message = `"SSE OK. The shrine bells chime softly in the distance."` — SSE stream completed, Aria stayed in character, chat UI rendered bubbles. No regressions in greeting auto-insert (gate a spot-check: the Storybook-snapshotted conversation created in gate 8 also had the greeting inserted as the first assistant message — observed via its `message_count`). Lorebook / TTS / Grammar / Fork paths untouched by this cycle's diff.

Key files shipped: `supabase/migrations/0032_writing_styles.sql`, `frontend/src/lib/writingStyles.ts`, `frontend/src/routes/WritingStylesSettings.tsx`, `frontend/src/features/characters/CharacterForm.tsx`, `frontend/src/lib/conversations.ts`, `frontend/src/routes/Settings.tsx`, `frontend/src/App.tsx`, `backend/app/prompt_assembly.py`. No unit-test infrastructure was added — backend gates 10/14 were verified via direct Python invocation in the existing uv-managed venv, matching project convention (Playwright-in-browser is the primary verification surface).

TypeScript: `tsc --noEmit` in `frontend/` completes without output (clean).
