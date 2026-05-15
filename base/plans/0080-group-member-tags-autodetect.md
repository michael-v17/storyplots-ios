# Plan 0080 — Group member tags: diffusion-friendly format + auto-detect on import

status: pending-approval
created: 2026-04-22

## What and why

Two quality issues discovered after shipping plan 0079:

**Issue A — Vague appearance tags.** The `character_refine_system.txt` prompt asks for
`group_members_description` in a prose style ("sharp-featured with blonde hair (likely
styled confidently)"). The image refiner (`image_refine_system.txt`) consumes this as
comma-separated tokens — prose with hedging words ("likely", parenthetical guesses)
degrades diffusion quality. The format should be direct visual descriptors: `long blonde
hair, straight, athletic build, fair skin, sharp features, casual streetwear`.

**Issue B — Manual group_size on import.** When a Tavern card describes multiple
characters ("You are controlling Lily and Cassie…"), the importer always passes
`group_size=1` to the refiner, so `group_members_description` is never populated and
individual physical fields (wrong for a group) get filled instead. The user has to
manually switch to group_size=2 and re-run Enrich. The refiner reads the full card —
it can detect the group and set a `detected_group_size` output that the import flow
applies automatically.

## Seed / reference coverage

- Seed/domain.md §6 item 2 (non-negotiable: agent isolation) — the character refiner is
  already isolated; adding one output field does not change isolation.
- No new domain entities, schema columns, or RLS rules.
- UX surface: CharacterForm Avatar tab — the `group_size` segmented control and
  `group_members_description` textarea (already exist from plan 0079). No new surfaces.

## Implementation

### Subtask 1 — Better tag format in character_refine_system.txt

**File:** `backend/app/prompts/character_refine_system.txt`

Change the `group_members_description` field description and add a formatting rule:

- Schema comment: `// one line per member: "N. Name | gender | age | tag1, tag2, …" where tags are comma-separated visual descriptors (hair color, hair length/style, build, skin tone, eye color if known, distinctive marks, clothing style). Use only details stated in the card — no guesses, no "likely", no prose.`
- New rule under **Group characters**: "Tags must be direct visual descriptors suitable for a diffusion prompt — short, comma-separated, no prose sentences, no hedging words. Only include details the card explicitly states; omit anything not given."

**Verify:** Run Enrich with AI on Lily and Cassie — `group_members_description` should
contain tags like `long blonde hair, straight, athletic build, fair skin` not
`sharp-featured with blonde hair (likely styled confidently)`.

---

### Subtask 2 — Auto-detect group_size on import

The refiner always receives the full card. We add `detected_group_size` (int 1–4) to
its output schema, populated by examining whether the card name / description / system
prompt describes multiple distinct named characters. The import flow reads this value and
applies it to the draft's `group_size`.

**Files and changes:**

**`backend/app/prompts/character_refine_system.txt`**
- Add `"detected_group_size": 1 | 2 | 3 | 4` to the output schema with instruction:
  count distinct named characters the card controls. Default 1.
- Group rule: "Always emit `detected_group_size`. If the card controls multiple
  characters (e.g. name contains 'and'/'&', system_prompt says 'You are controlling X
  and Y'), set it to the number of distinct members and also populate
  `group_members_description` regardless of the `group_size` input."

**`backend/app/agents/character_refine.py`**
- Add `detected_group_size: int = 1` to `CharacterRefineResult`.
- Parse it: `max(1, min(4, int(parsed.get("detected_group_size") or 1)))`.

**`frontend/src/lib/characterRefine.ts`**
- Add `detected_group_size: number` to `RefinedDraft`.

**`frontend/src/routes/CharacterImport.tsx`**
- After refine, apply `refined.detected_group_size` when building the initial draft.
  The `navigateWithRefined` helper passes the refined object through; the receiving
  form (`CharacterCreate` / `CharacterForm`) merges it into the draft. Check how
  `navigateWithRefined` works and apply `group_size: refined.detected_group_size`
  alongside the other refined fields.

**`frontend/src/features/characters/CharacterForm.tsx`** (if needed)
- If `navigateWithRefined` uses a `location.state` object that the form reads,
  ensure `group_size` and `group_members_description` from the refined result are
  applied to the initial draft.

**Verify:** Import a Tavern card where the name is "Alice and Bob" and the system_prompt
says "You are controlling Alice and Bob" — after import the form should open with
`group_size=2` and `group_members_description` already populated.

---

## Subtask order

1. Subtask 1 (tag format) — backend only, 1 file.
2. Subtask 2 (auto-detect) — backend + frontend, 4-5 files.

Commit after all subtasks verified.

## Domain invariants preserved

- Agent isolation: character refiner receives only the raw card + flags (unchanged).
- No new Supabase columns or migrations needed.
- Single-character path unchanged — `detected_group_size=1` means no difference.
- Edit Enrich (existing character): `detected_group_size` is returned but ignored by
  `applyRefined` (which already reads `group_size` from draft). No regression.

## Open questions

None — behavior is fully specified by the card content the refiner already reads.
