---
id: 0019
slug: character-seed-lock
status: shipped
created: 2026-04-16
---

# Cycle 0019 — Character image seed lock

## Context

Image generation currently picks a new random seed per call
(`seed = random.randint(1, 2**31 - 1)` in `backend/app/routes/image.py:457`).
Same prompt + different seed = different composition/pose/facial
interpretation. The cycle 0018 structured attributes pin the
character's identity at the prompt level; a fixed seed pins it at
the diffusion level. Together they produce more visually consistent
characters across scenes.

We don't make this mandatory — a fixed seed fights composition
variety for wildly different scenes (bar vs forest vs sleeping).
So it's an **opt-in per-character toggle** on the Avatar tab.

**Done when:** the Avatar tab has a "Lock seed for consistency"
checkbox under Physical attributes. Toggling it on assigns a random
seed stored on the character and uses it for every subsequent image
generation. Toggling off clears it and returns to per-call random.

## Shape of the change

```
Migration 0024:
 characters + image_seed bigint nullable (null = random per gen)

Backend (routes/image.py):
 seed = int(character["image_seed"]) if character.get("image_seed") is not None
        else random.randint(1, 2**31 - 1)

Frontend (CharacterForm Avatar tab):
 Inside "Physical attributes" group, add a checkbox row:
   [x] Lock seed for visual consistency
       Seed: 1234567890 [roll new]
 Unchecked → image_seed = null
 Checked   → image_seed assigned on first check (random int)
             "roll new" button reassigns a fresh random int
```

## 1. Seed sections satisfied

- [creator-vision.md §5.5](../Seed/creator-vision.md) — ComfyUI
  BYOK + per-style workflows. Seed control is a standard
  ComfyUI knob; exposing it at the Character level does not
  invent behavior, only opts into a ComfyUI primitive that
  already exists.
- [PersonaLLM-Reference/08-generation-parameters.md](../Seed/PersonaLLM-Reference/08-generation-parameters.md)
  — observed app exposes seed at generation level. Scoping
  it to the Character instead of per-call is a v0 extension,
  per CLAUDE.md principle 5 (observed-vs-extended separation).
- This cycle does **not** touch domain invariants, agent
  isolation, SSE path, grammar, lorebook, branching, snapshots,
  or BYOK. Purely additive to the image pipeline.

## 2. Commit decisions

- **Single nullable `bigint` column, not two.** `image_seed` nullable
  represents both state (locked vs random) and value. `null` = random
  per gen; any number = locked to that seed. Cheaper than a boolean
  + int pair, and toggling off just writes null.
- **Default ON.** Migration backfills every existing character with
  its own random seed; `emptyDraft()` + import `baseDraft()` assign
  a fresh random seed on new-character creation. User uncheckes
  per-character if they want variety. Rationale: consistency is the
  thing the structured-attributes cycle (0018) was optimising for,
  so defaulting this toggle ON continues that trajectory. Historical
  images are unaffected — `generated_images.seed` already persists
  whatever was used.
- **Checkbox assigns a random seed on first check**, not a
  user-chosen value. v0 users don't need to hand-pick seed numbers.
  A "roll new" button gives them an escape hatch if the locked
  composition turns out to be bad.
- **Seed is displayed** (read-only number next to the checkbox) so
  advanced users can screenshot / remember a specific good seed.
  Not editable in v0.
- **Scope stays per-character**, not per-conversation. Per-Conv
  override already exists for resolution + provider; adding it
  for seed would bloat the Chat Controls surface without obvious
  gain (you typically want a character to look consistent across
  ALL her conversations).
- **No retroactive write-back.** Past images in gallery keep their
  historical seed. Only future generations use the locked seed.

## 3. Schema

```sql
-- supabase/migrations/0024_character_image_seed.sql
alter table public.characters
  add column image_seed bigint;

-- Default ON — backfill a per-row random seed for every existing
-- character. New rows inherit null from the column default; the
-- frontend emptyDraft()/baseDraft() assign a random seed at
-- creation time, so new chars also land with a locked seed.
update public.characters
  set image_seed = floor(random() * 2147483647)::bigint + 1
  where image_seed is null;

-- Seed values fit in bigint comfortably (ComfyUI accepts up to
-- 2^63-1). No CHECK constraint — any non-null bigint is valid.
-- No new RLS: 0004 policies cover the new column.
```

## 4. Backend

`backend/app/routes/image.py:457` — before the KSampler submit:

```python
locked = character.get("image_seed")
seed = int(locked) if isinstance(locked, int) else random.randint(1, 2**31 - 1)
```

Character select (line ~200s) already narrows to named columns —
add `image_seed` to the list so the loaded character dict has it.

`generated_images.seed` still persists whatever was actually used,
so the row is self-describing (locked vs random not distinguished
in the row, only the effective seed value).

## 5. Frontend

### Type

`frontend/src/lib/characters.ts`:
```ts
export type Character = {
  // ...
  image_seed: number | null;
};
```

### Form (CharacterForm Avatar tab)

Inside the existing Physical attributes fieldset, append a row
**above** "Signature style" (before the multi-line fields):

```tsx
<label style={attrLabel}>
  <input
    type="checkbox"
    data-testid="attr-seed-lock"
    checked={draft.image_seed != null}
    onChange={(e) => {
      if (e.target.checked) {
        patch("image_seed", Math.floor(Math.random() * (2**31 - 1)) + 1);
      } else {
        patch("image_seed", null);
      }
    }}
  />
  <span>Lock seed for visual consistency</span>
  {draft.image_seed != null && (
    <span style={{ opacity: 0.7 }}>
      Seed: {draft.image_seed}
      {" "}
      <button type="button"
        data-testid="attr-seed-roll"
        onClick={() =>
          patch("image_seed", Math.floor(Math.random() * (2**31 - 1)) + 1)
        }
      >roll new</button>
    </span>
  )}
</label>
```

### `emptyDraft()` + import `baseDraft()`

Both assign a fresh random seed at creation time (default ON):
```ts
image_seed: Math.floor(Math.random() * (2 ** 31 - 1)) + 1,
```
Explicit helper `freshSeed()` colocated with the form keeps the
expression DRY.

## 6. Verification gates

1. Migration 0024 applied; `image_seed` column exists. Backfill
   populated both Aria and Mira with non-null seed values (default
   ON).
2. Open Aria's editor — checkbox is CHECKED by default, seed
   number visible.
3. Form round-trip: change nothing → save → reload → seed still
   the same number.
4. With seed locked on Aria, generate 2 images on the same message
   via Regenerate → both `generated_images.seed` rows match the
   character's `image_seed`.
5. Uncheck the box → save → generate 2 more → each has a
   different random seed (neither equals the old locked value).
6. "Roll new" button changes the stored seed → next generation
   uses the new one.
7. New manual character → emptyDraft assigns a seed automatically;
   checkbox CHECKED by default.
8. Regressions 0001-0018: chat, image gen, TTS, structured
   attributes all still work.

## 7. Implementation order

1. Migration 0024 + apply.
2. Frontend `Character` type + `CharacterDraft` + `emptyDraft()` +
   `baseDraft()` in import mapper.
3. `CharacterForm` Avatar tab checkbox row.
4. Backend `routes/image.py` seed selection.
5. Playwright gates 1-7.
6. Update memory + commit.

## Verification

### Review findings (fixed in-cycle)

- **Data-loss on uncheck→recheck** (code-review, confidence 80):
  original onChange called `freshSeed()` every time the box was
  checked, silently overwriting the loaded character's seed if
  the user toggled the checkbox off and back on. Fixed by
  introducing `lastSeedRef: useRef<number>` initialized from the
  current draft seed. Uncheck stashes the current seed into the
  ref; recheck restores from the ref. The "roll new" button also
  updates the ref so subsequent toggling preserves the rolled
  value. Confirmed live: initial 275822988 → uncheck (null) →
  recheck → still 275822988.
- **Duplicate `freshSeed` formula** (code-simplifier): the range
  `Math.floor(Math.random() * (2 ** 31 - 1)) + 1` appeared in
  both `CharacterForm.tsx` and `mapCardToDraft.ts`. Centralised
  as `export function freshSeed()` on `lib/characters.ts`;
  both sites now import it. Matches SQL backfill range and
  backend `random.randint(1, 2**31 - 1)` for cross-pipeline
  consistency.
- **Rejected: `isinstance(int)` → `or` simplification** in
  backend. The simplifier suggested `seed = character.get("image_seed") or random.randint(...)`.
  I kept the explicit `isinstance` guard — it's one extra token
  that self-documents the intent (seed values are strictly int,
  never bool/str), and tips future readers that the locked-seed
  branch is deliberate.

### Gate results

| # | Gate | Result |
|---|---|---|
| 1 | Migration 0024 + `image_seed` column | ✅ applied |
| 2 | Default-ON backfill | ✅ Mira=608422774, Aria=275822988 |
| 3 | Aria editor shows checkbox checked + seed | ✅ 275822988 displayed with "roll new" button |
| 4 | Two consecutive regens reuse locked seed | ✅ both images seed=275822988 (20:37:57, 20:39:12); visual consistency visible (same face/hair parting/pose silhouette) |
| 5 | Uncheck → save → regen uses random seed | ✅ image_seed=null in DB; next image seed=1087992906 (≠ previous lock values) |
| 6 | "roll new" updates seed value + DB | ✅ 275822988 → 451718671 in UI + persisted |
| 7 | New manual char defaults to locked w/ random seed | ✅ fresh form: checked=true, seed=1937163420 |
| 8 | Regressions 0001-0018: chat / image / TTS | ✅ 4 image gens across gates, chat reply stream OK, TTS pipeline unchanged (only seed branch modified) |

### Visual evidence

- `aria-seed-locked-v2.png` + `aria-seed-locked-v3.png` — two
  consecutive regens with the same locked seed (275822988) but
  slightly different refined prompts; the face and hair parting
  are visibly reused (same angular chin, same forehead ribbon
  position, same long hair drape).
