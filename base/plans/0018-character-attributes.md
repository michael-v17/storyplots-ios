---
id: 0018
slug: character-attributes
status: shipped
created: 2026-04-16
---

# Cycle 0018 — Character attributes (structured canonical identity)

## Context

Character identity today lives in two places: a big free-form
`system_prompt` (what the user pastes or imports) and an optional
`appearance_description` free-form text. Everything downstream
(image refiner, future TTS, import mapper, future Insights surfaces)
must *parse prose* to extract canonical facts like age, gender,
build, hair color, voice style. This works but wastes tokens on
every image generation, produces inconsistent extraction quality,
and blocks features that would benefit from structured data
(gender-matched TTS, ElevenLabs voice search, character gallery
filters, accurate PNG card export).

This cycle **structures the canonical identity** — the set of
facts that stay stable across a character's whole lifetime — into
typed columns on `characters`. Dynamic state (what the character
is wearing *right now*, where they are, what they're doing) stays
where it belongs: in the conversation context (`recent_turns`
already drives that for the image refiner, per cycle 0014.1).

**Done when:** the Character form has a new "Physical attributes"
fieldset on the Avatar tab. Saving populates typed columns. The
image refiner reads those columns as its primary source of
character facts (falling back to `appearance_description` prose
only for anything not covered). Existing characters without
attributes still work — the refiner degrades gracefully to the
old prose-parse behavior. PNG/JSON imports fill attributes from
V2 card fields + tags heuristically.

## Shape of the change

```
Migration 0023:
 characters +
   age                  text       -- "17" / "mid-30s" / "elderly" / null
   gender               text       -- check (male|female|non_binary|unspecified) or null
   build                text       -- "athletic" / "plus-size" / "petite" / ...
   height               text       -- "5'7\"" / "tall" / ...
   hair_color           text
   hair_style           text
   eye_color            text
   skin_tone            text
   distinctive_features text       -- multi-line: scars, tattoos, glasses, etc.
   signature_style      text       -- canonical attire / fashion default
   voice_style          text       -- TTS: warm / gravelly / formal / breathy

Backend (`routes/image.py`):
 character_context now prefers structured fields + falls back to
 the prose `appearance_description` for anything not in the
 structured set. Less wasted tokens, more consistent extraction.

Frontend:
 CharacterForm Avatar tab gains a "Physical attributes" fieldset
 grouped as: Demographics / Face / Body / Style / Voice.
 CharacterCard tile can optionally show age + gender as subtitle
 (deferred — not in this cycle).

Import mapper (0013):
 V2 cards with `tags: [...]` are scanned for obvious tokens
 ("elderly" → age="elderly", "1boy" → gender="male") as a best-
 effort pre-fill. The user can correct in the form after import.
```

## 1. Seed sections satisfied

- [domain.md §2.3 Character](../Seed/domain.md) — entity
  definition gains structured physical attributes. Seed lists
  `appearance_description` but doesn't forbid adding structured
  fields; PersonaLLM-Reference 03-data-model.md §character
  mentions age/gender fields explicitly.
- [PersonaLLM-Reference/03-data-model.md](../Seed/PersonaLLM-Reference/03-data-model.md)
  — observed app has Character.gender (Male / Female / Non-binary
  / Custom). We ship Male / Female / Non-binary / Unspecified and
  defer Custom (string) until there's demand.
- [creator-vision.md §5.2](../Seed/creator-vision.md) — "dual-voice
  TTS routing ... voice selection respects Character gender." Sets
  up 0019 TTS dual-voice to read these.
- [user-stories.md #7 create character](../Seed/user-stories.md) —
  the form already exists; this cycle extends it.
- [ux.md §4.5 character editor](../Seed/ux.md) — Avatar tab
  already has accent color + appearance fieldset; the new
  Physical attributes section slots in alongside.

## 2. Commit decisions made this cycle

- **Flat columns, not a jsonb blob.** Typed columns give us
  indexes (if we ever need "find all elderly characters" in
  Gallery), simpler form validation, and cheaper access than
  nested jsonb. The cost is schema migrations for future
  additions — acceptable at v0 scale.
- **All fields are free-text except `gender`.** `age` as text
  keeps flexibility ("17", "mid-30s", "ageless"). `build` /
  `hair_style` / `voice_style` as text instead of enums so the
  user isn't boxed in. `gender` is the one field with a
  CHECK constraint because the TTS + image pipelines branch on
  it explicitly.
- **Gender: male / female / non_binary / unspecified / null.**
  Adding `non_binary` up front even though 0019 only maps male +
  female voices — non_binary will use the same `fallback` voice
  slot as unspecified until a better design lands.
- **`appearance_description` stays.** We don't migrate existing
  prose into the new columns. New chars start structured; old
  chars keep working as-is. The refiner reads both, structured
  first.
- **Dynamic state stays in conversation context.** The image
  refiner still reads `recent_turns` + target message for
  clothing / pose / props / location — those override the
  canonical `signature_style` when the scene mentions different
  attire. This is already how 0014.1 works; no change needed
  beyond the new character_context assembly order.
- **No UI for the attributes on CharacterCard / Home tile in
  this cycle.** The tile stays minimal; we keep the cycle scoped
  to the backend + editor change. Surfacing the structured data
  on tiles / Gallery filters is a future cycle when demand
  appears.
- **Import heuristics are best-effort.** A small `tagsToAttributes`
  map on the frontend mapper converts recognizable tokens
  (`elderly`, `young_adult`, `1boy`, `1girl`, common hair/eye
  colors) into attributes. The user sees pre-filled fields after
  import and can correct anything wrong. Unknown tokens stay in
  `tags[]` untouched.
- **Refiner ordering**: canonical attributes first, then
  `appearance_description` as supplementary, then `recent_turns`
  as dynamic override. Same three-tier layering the mapper spec
  from 0014.1 implies.

## 3. Schema scope / RLS

### Migration `supabase/migrations/0023_character_attributes.sql`

```sql
-- Canonical physical identity — stable across a character's lifetime.
-- Dynamic state (current clothing / pose / location / mood) stays in
-- the conversation context, not here.

alter table public.characters
  add column age                  text,
  add column gender               text,
  add column build                text,
  add column height               text,
  add column hair_color           text,
  add column hair_style           text,
  add column eye_color            text,
  add column skin_tone            text,
  add column distinctive_features text,
  add column signature_style      text,
  add column voice_style          text;

alter table public.characters
  add constraint characters_gender_valid
  check (gender is null or gender in ('male', 'female', 'non_binary', 'unspecified'));

-- No new RLS — characters policies from 0004 still cover all new columns.
```

## 4. Backend

### `backend/app/routes/image.py` — `character_context` refactor

Current:

```python
if character.get("system_prompt"):
    context_parts.append(f"SYSTEM_PROMPT:\n...")
for key in ("personality", "goals", "worldbuilding"):
    ...
if character.get("scenario"):
    ...
```

New order (**canonical first**):

```python
# 1. Canonical identity (structured) — highest signal-to-noise.
ident_parts: list[str] = []
for key in ("age", "gender", "build", "height",
            "hair_color", "hair_style", "eye_color", "skin_tone",
            "distinctive_features", "signature_style", "voice_style"):
    v = character.get(key)
    if isinstance(v, str) and v.strip():
        ident_parts.append(f"- {key.replace('_', ' ')}: {v.strip()}")
if ident_parts:
    context_parts.append("PHYSICAL_IDENTITY:\n" + "\n".join(ident_parts))

# 2. Free-form appearance (legacy / supplementary).
if character.get("appearance_description"):
    context_parts.append(f"APPEARANCE:\n{character['appearance_description']}")

# 3. System prompt + personality / goals / worldbuilding (personality signal).
if character.get("system_prompt"):
    context_parts.append(f"SYSTEM_PROMPT:\n...")
for key in ("personality", "goals", "worldbuilding"):
    ...
if character.get("scenario"):
    ...
```

The refiner reads this in order; structured identity dominates
for age/gender/appearance tags, and the existing 2000-char trim
still applies. System prompts that paraphrase age/gender in prose
now have less influence on the final tags (correct — the typed
field is authoritative).

Character table select list updated to include the new columns.

## 5. Frontend surfaces

### `CharacterForm` — Avatar tab gains a "Physical attributes" fieldset

Grouped into compact sub-sections (each is a label + input; no
additional nesting) so the form stays scannable:

- **Demographics**: age, gender (dropdown).
- **Face**: hair_color, hair_style, eye_color.
- **Body**: build, height, skin_tone.
- **Style**: signature_style (multi-line), distinctive_features
  (multi-line).
- **Voice**: voice_style (text input with placeholder
  "warm / gravelly / formal / breathy").

Each field helpers:

```tsx
patchStr<K extends "age" | "gender" | ...>(key: K, value: string) {
  setDraft((d) => ({ ...d, [key]: value.trim() || null }));
}
```

### `Character` type + `CharacterDraft`

Add the 11 new optional fields. TypeScript strict mode forces
every insert/update to include them (current rows use defaults).

### Import mapper heuristics (`mapCardToDraft.ts`)

```ts
// Cheap pre-fill from V2 card tags — not authoritative; the user
// will see the attributes in the form and can correct anything.
function inferAttributesFromTags(tags: string[]): Partial<CharacterDraft> {
  const t = new Set(tags.map((s) => s.toLowerCase()));
  const out: Partial<CharacterDraft> = {};
  if (t.has("1boy")    || t.has("male"))    out.gender = "male";
  if (t.has("1girl")   || t.has("female"))  out.gender = "female";
  if (t.has("elderly") || t.has("old_man") || t.has("old_woman")) out.age = "elderly";
  if (t.has("teenager")) out.age = "teenager";
  if (t.has("young_adult")) out.age = "young adult";
  if (t.has("mature_male") || t.has("mature_female")) out.age = "mature";
  for (const c of ["black", "brown", "blonde", "red", "silver", "white", "blue", "green", "pink"]) {
    if (t.has(`${c}_hair`)) out.hair_color = c;
    if (t.has(`${c}_eyes`)) out.eye_color = c;
  }
  return out;
}
```

Called in `mapV1` / `mapV2` and merged into the base draft.

## 6. Verification gates

1. **Migration 0023.** ✅ 11 new columns on `characters`; gender
   check constraint enforced.
2. **Form save round-trip.** Open Mira's Character editor → fill
   all 11 fields (gender=female, age="young_adult", hair_color=
   "black", etc.) → save → reload → all values persisted.
3. **Existing characters unaffected.** Mira's existing fields
   (name, system_prompt, personality) untouched after the form
   save. No default coercion.
4. **Image refiner uses structured fields first.** With all
   attributes populated, a new generate produces `refined_prompt`
   that starts with the structured tags
   (`1girl, young_adult, black_hair, green_eyes, ...`) —
   confirm via the DB row's `refined_prompt` column.
5. **Refiner legacy fallback.** A character with ONLY
   `appearance_description` prose (no structured fields) still
   produces a reasonable `refined_prompt` — refiner reads the
   APPEARANCE block. Compare against Mira's pre-0018 output.
6. **Gender check constraint.** Attempting to UPDATE directly
   with `gender = 'alien'` fails with a CHECK violation. Form
   doesn't allow invalid values.
7. **Import heuristics.** Importing a V2 card with
   `tags: ["1girl", "elderly", "gray_hair"]` pre-fills
   gender=female, age=elderly, hair_color=gray on the manual
   editor.
8. **Dynamic state still overrides.** With signature_style =
   "combat armor", send a message like "She changes into a
   simple dress." The next image generation's tags reflect the
   dress (from recent_turns), not the combat armor — the seed's
   3-tier layering still works.
9. **RLS isolation.** Structural — 0004 policies cover the new
   columns by default (`user_id = auth.uid()`).
10. **Backward compat with existing draft shape.** Creating a
    brand-new Manual character without touching any new field
    saves fine (all fields nullable).
11. **Regressions 0001-0017.** Chat / grammar / lorebook / fork /
    import / image viewer / gallery / Visual Roleplay auto /
    TTS all still work.

## 7. Implementation order

1. Migration 0023 + apply.
2. Frontend `Character` type + `CharacterDraft` updated;
   `emptyDraft()` + `baseDraft()` in import mapper updated.
3. `CharacterForm` Avatar tab fieldset.
4. Import heuristics `inferAttributesFromTags`.
5. Backend `routes/image.py` `character_context` reorder.
6. Playwright gates 1-11.
7. Update memory + commit.

## Verification

### Review findings (fixed in-cycle)

- **Missing `Unspecified` gender option** (`CharacterForm.tsx`) — the
  `<select>` had `<option value="">Unspecified</option>` that coalesced
  to `null`, making the DB-valid `"unspecified"` literal unreachable
  from the UI. Fixed by relabelling the blank option to `—` (null) and
  adding an explicit `<option value="unspecified">Unspecified</option>`.
- **Tavern `grey_hair` spelling variant** (`mapCardToDraft.ts`) — the
  COLORS loop only matched `gray`. Western Tavern cards commonly use
  `grey`; added a normalisation line: `grey_hair → gray`,
  `grey_eyes → gray`.
- **Review claim that 0018 regressed `include_appearance` semantics**
  was rejected — `git show dce9aee:backend/app/routes/image.py` shows
  `include_appearance` already gated the entire `character_context`
  block pre-0018 (system_prompt + personality + scenario too), and the
  new PHYSICAL_IDENTITY block is semantically appearance data, so it
  correctly joins that same gate.
- **Simplifier suggestions** (shared `emptyDraft` helper, ternary →
  lookup maps, inline `attrLabel`, drop `isinstance` guard) all
  declined — CLAUDE.md rules against adding abstractions the plan
  doesn't require; the 11-key loop is already the compact form.

### Gate results

| # | Gate | Result |
|---|---|---|
| 1 | Migration 0023 applied | ✅ 11 columns + CHECK constraint live |
| 2 | Form save round-trip (Aria, all 12 fields) | ✅ All fields persisted after navigate-away + reload |
| 3 | Existing characters unaffected (Mira) | ✅ `appearance_description` + `system_prompt` intact; all 11 new fields null |
| 4 | Refiner uses structured first (Aria w/ all fields) | ✅ `refined_prompt` leads with `1girl, young_adult, long_hair, black_hair, red_ribbon, violet_eyes, pale_skin, crescent_moon_pendant, miko, shrine_maiden, white_and_red_robes` — canonical identity first, then legacy APPEARANCE (`wooden_staff, prayer_cords`), then scene |
| 5 | Legacy fallback (Mira, no structured) | ✅ `refined_prompt` = `1girl, young_adult, short_black_hair, green_eyes, burgundy_wool_cardigan, wool_scarf, leather_boots, ...` — refiner extracted tags from appearance_description prose alone |
| 6 | Gender CHECK enforced | ✅ `UPDATE gender='alien'` → code 23514; `male`/`female`/`non_binary`/`unspecified`/`null` all accepted |
| 7 | Import heuristics (V2 tags) | ✅ `['1girl','elderly','grey_hair','blue_eyes']` → `gender='female'`, `age='elderly'`, `hair_color='gray'` (grey alias), `eye_color='blue'` |
| 8 | Dynamic state overrides signature_style | ✅ After user writes "she changes into a plain indigo cotton yukata", next image's `refined_prompt` drops `miko, shrine_maiden, white_and_red_robes, wooden_staff, prayer_cords` and adds `indigo_yukata, paper_umbrella`; canonical fields (1girl/young_adult/black_hair/red_ribbon/violet_eyes/pale_skin/crescent_moon_pendant) preserved |
| 9 | RLS isolation | ✅ Structural — 0004 policies cover the new columns by default |
| 10 | Minimal char saves w/o attributes | ✅ `INSERT` with only name + system_prompt succeeds; all 11 fields remain null |
| 11 | Regressions 0001-0017 | ✅ Chat stream OK (Aria + Mira); image gen OK on both; TTS auto-played new yukata reply + cache hit on re-click |

### Visual verification (screenshots saved by Playwright)

- `aria-structured-gate4.png` — Aria tea scene (all structured fields
  visually present: violet eyes, black hair with red ribbon, crescent
  moon pendant, miko robes, staff with prayer cords, stirring the pot).
- `aria-yukata-gate8.png` — Aria yukata scene (canonical identity
  preserved, miko robes replaced by indigo yukata + paper umbrella,
  forest path in light rain — crescent moon visible in sky as scene
  bonus).
