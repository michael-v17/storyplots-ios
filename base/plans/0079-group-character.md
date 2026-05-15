# Plan 0079 — Group Character support

status: pending-approval
created: 2026-04-22

## What and why

A StoryPlots character currently always represents exactly one NPC. Some characters
are actually pairs or small groups (a couple, twins, a duo). The system has no way to
express this and forces everything through single-subject image paths:

- `avatar_generate.py` always emits `solo, (1girl:1.4)` — one person, blended.
- `image_refine_system.txt` POV=first_person forces a single-subject collapse.
- CharacterForm has no way to indicate the character is a group.

The LLM chat agent already handles groups naturally through `system_prompt` — the
creator just writes "You are Alex and Mia, a young couple…". The fix is surgical:
add a flag + one structured text field, then branch avatar and image-refiner paths
when the flag says N > 1. Single-character path (N = 1, the default) is untouched.

## Member description format

When group_size > 1 the creator fills a single textarea with one line per member:

```
1. Alex | male | 28 | short brown hair, athletic build, tan skin, beard
2. Mia | female | 25 | long black hair, slender, olive skin, freckles
```

Fields per line (pipe-separated): `N. Name | gender | age | free-form appearance`.
The backend parser splits on ` | ` after stripping the leading `N. ` prefix.

## Seed / reference citations

- **Schema:** Seed/schema.md §5 — additive change to `characters` table; RLS unchanged.
- **Domain invariants (Seed/domain.md §6):** Agent isolation intact (one agent per
  Conversation, `system_prompt` already describes the group to the chat LLM). Edit-as-trim,
  branching, snapshots, per-conv Lorebook, Grammar default-OFF — all unaffected.
- **Non-negotiables (Seed/creator-vision.md §8):** None violated. `group_size` is UI
  metadata; the SSE/reply path and BYOK image engine are unchanged.
- **PersonaLLM-Reference:** Group characters are not documented in the observed app.
  This is a v0 extension — provenance is creator request (2026-04-22), not
  PersonaLLM-Reference. No observed-behavior baseline to consult.
- **UX surfaces (Seed/ux.md):** CharacterForm (avatar tab + info tab), image generation
  during chat (no new route — existing flow).

## User stories touched

- US-14: Character CRUD — CharacterForm gains group_size control.
- US-8: Chat image generation — refiner handles N-subject character.
- US-9: Generate Avatar — portrait prompt built for N subjects.

## Schema changes (manual migration)

```sql
ALTER TABLE characters
  ADD COLUMN group_size smallint NOT NULL DEFAULT 1
    CHECK (group_size BETWEEN 1 AND 4);

ALTER TABLE characters
  ADD COLUMN group_members_description text;
```

Append to `db/schema.sql` as a comment block at the end:
```sql
-- Cycle 0079: group character support
-- group_size=1 is the default (single NPC, existing behavior unchanged).
-- group_members_description is populated when group_size > 1.
```

## Implementation order — 4 subtasks

### Subtask 1 — Schema migration + TypeScript type

**Files:** `db/schema.sql` (append), `frontend/src/lib/characters.ts`

- SQL: run the two ALTER TABLE statements above in Supabase SQL Editor.
- `characters.ts` `Character` type: add `group_size: number` and
  `group_members_description: string | null`.
- `CharacterDraft` inherits via `Omit<Character, ...>` — no change needed there.
- `emptyDraft` in `CharacterForm.tsx`: add `group_size: 1, group_members_description: null`.

**Verify (non-UI):** `npx tsc --noEmit` in `frontend/` — 0 errors. New columns visible
in Supabase Table Editor → characters.

---

### Subtask 2 — CharacterForm UI

**File:** `frontend/src/features/characters/CharacterForm.tsx`

Location: the "Avatar" tab section (above the Physical attributes fieldset). The
group_size control lives between the appearance_description textarea and the Physical
attributes fieldset so the visual flow is:

```
Appearance description  (unchanged)
───────────────────────
Group size  [1] [2] [3] [4]   ← new segmented control
───────────────────────
When group_size = 1:           When group_size > 1:
  Physical attributes          Group members description
  fieldset (unchanged)         textarea with template/placeholder
```

**Changes:**

1. Add `group_size` stepper — a mini segmented pill control (4 buttons: 1/2/3/4).
   Style matches the existing `tabButtonStyle` pattern (active = `--sp-brand-1` bg +
   white, inactive = transparent + `--sp-fg-2`). Small: font 13, padding 4px 10px.
   Label row: "Group size" in `--sp-fg-3` 12px.

2. Conditional physical attributes section:
   ```tsx
   {draft.group_size === 1 ? (
     <fieldset>…Physical attributes (existing, no change)…</fieldset>
   ) : (
     <div>
       <label>
         Group members
         <small style={{color:'var(--sp-fg-3)'}}>
           One line per member: Name | gender | age | appearance
         </small>
       </label>
       <textarea
         data-testid="group-members-description"
         rows={draft.group_size * 2 + 1}
         placeholder={
           "1. Alex | male | 28 | short brown hair, athletic build, tan skin, beard\n" +
           "2. Mia | female | 25 | long black hair, slender, olive skin, freckles"
         }
         value={draft.group_members_description ?? ""}
         onChange={(e) => patch("group_members_description", e.target.value || null)}
       />
     </div>
   )}
   ```

3. No changes to save/load logic — the new fields are included in the existing
   spread that writes all `CharacterDraft` fields to Supabase.

4. When group_size changes from > 1 back to 1: physical fields re-appear with their
   stored values (nothing is cleared — `group_members_description` stays in the DB but
   the physical fields are what drive generation when group_size = 1).

**Verify (Playwright, both breakpoints L=1440 S=375):**
- Navigate `/character/:id/edit`.
- Click group_size button "2" → physical attributes fieldset hidden, group textarea
  visible with placeholder.
- Type member text → `data-testid="group-members-description"` has value.
- Click group_size button "1" → physical attributes fieldset visible again.
- Save + reload → group_size and group_members_description round-trip.

---

### Subtask 3 — Avatar generation multi-subject

**File:** `backend/app/routes/avatar_generate.py`

**New helpers (added before `generate_character_avatar`):**

```python
def _parse_group_members(text: str) -> list[dict]:
    """Parse "N. Name | gender | age | description" lines."""
    members = []
    for line in text.strip().splitlines():
        line = line.strip()
        if not line or not line[0].isdigit():
            continue
        line = re.sub(r"^\d+\.\s*", "", line)
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 4:
            continue
        members.append({
            "name": _sanitize(_flatten(parts[0])),
            "gender": parts[1].strip().lower(),
            "age": _sanitize(_flatten(parts[2])),
            "appearance": _sanitize(_flatten(", ".join(parts[3:]))),
        })
    return members


def _group_count_tag(members: list[dict]) -> str:
    genders = [_gender_class(m["gender"]) for m in members]
    males = genders.count("male")
    females = genders.count("female")
    n = len(members)
    if n == 2:
        if males == 2:
            return "2boys"
        if females == 2:
            return "2girls"
        return "1boy 1girl"
    if n == 3:
        if males == 3:
            return "3boys"
        if females == 3:
            return "3girls"
        return "multiple_people"
    return "multiple_people"


def _build_group_portrait_prompt(
    members: list[dict],
    *,
    user_prefix: str | None = None,
    user_suffix: str | None = None,
    background_tags: list[str] | None = None,
) -> str:
    """Multi-subject portrait prompt for group characters (cycle 0079)."""
    parts: list[str] = []

    # Count tag
    parts.append(_group_count_tag(members))

    # Prefix — strip "solo" if user_prefix contains it; use a group default
    # when None (i.e. user left Prompt Editor at default).
    GROUP_PREFIX_DEFAULT = "medium shot portrait, looking at viewer"
    # "solo" is stripped but "looking at viewer" is kept: avatars are portraits
    # (profile-picture context), so subjects facing the camera is correct here.
    # Chat images are handled by the image refiner which derives framing from scene.
    raw_prefix = GROUP_PREFIX_DEFAULT if user_prefix is None else user_prefix
    cleaned_prefix = re.sub(r"\bsolo\b,?\s*", "", raw_prefix, flags=re.IGNORECASE).strip(", ")
    if cleaned_prefix:
        parts.append(_sanitize(_flatten(cleaned_prefix)))

    # Per-member escaped-parens group (same format as image refiner multi-subject)
    for m in members:
        gender_cls = _gender_class(m["gender"])
        gender_tag = {"male": "1boy", "female": "1girl"}.get(gender_cls or "", "1other")
        age_tier = _age_tier_tokens(
            m["age"] or None,
            is_male=gender_cls == "male",
            is_female=gender_cls == "female",
        )
        name_tag = m["name"].lower().replace(" ", "_") if m["name"] else ""
        inner: list[str] = []
        if name_tag:
            inner.append(name_tag)
        if age_tier:
            inner.append(age_tier)
        if m["age"]:
            inner.append(f"({m['age']}:1.3)")
        if m["appearance"]:
            # Each comma-separated appearance descriptor becomes a tag
            for tag in [t.strip() for t in m["appearance"].split(",") if t.strip()]:
                inner.append(tag)
        group_str = f"{gender_tag} \\({', '.join(inner)}\\)"
        parts.append(group_str)

    # Background
    if background_tags:
        parts.extend(background_tags)
    else:
        parts.append(AVATAR_BACKGROUND_FALLBACK)

    # Suffix
    suffix_value = AVATAR_SUFFIX_DEFAULT if user_suffix is None else user_suffix
    if suffix_value.strip():
        parts.append(_sanitize(_flatten(suffix_value.strip())))

    return ", ".join(parts)
```

**In `generate_character_avatar` endpoint**, after loading the character (step 1),
add a branch at step 4b (building the portrait prompt):

```python
group_size = int(character.get("group_size") or 1)
group_members_text = character.get("group_members_description") or ""
use_group_mode = group_size > 1 and bool(group_members_text.strip())

if use_group_mode:
    members = _parse_group_members(group_members_text)
    if members:
        portrait_prompt = _build_group_portrait_prompt(
            members,
            user_prefix=user_prefix,
            user_suffix=user_suffix,
            background_tags=background_tags or [],
        )
    else:
        # Parsed empty → graceful fallback to single-subject
        portrait_prompt = _build_portrait_prompt(
            character, user_prefix=user_prefix, user_suffix=user_suffix,
            background_tags=background_tags or [],
        )
else:
    portrait_prompt = _build_portrait_prompt(
        character, user_prefix=user_prefix, user_suffix=user_suffix,
        background_tags=background_tags or [],
    )
```

The rest of the endpoint (workflow submission, upload, DB update) is unchanged.

**Verify (non-UI):** `python -m py_compile backend/app/routes/avatar_generate.py` —
no syntax errors. Manual prompt inspection: for a 2-member group with known fields,
the generated string contains `1boy 1girl, medium shot portrait, ...1girl \(mia,...\),
1boy \(alex,...\)` (no `solo`, no `(1girl:1.4)` single-subject token).

---

### Subtask 4 — Image refiner: payload + system prompt

**Files:**
- `backend/app/agents/image_refine.py`
- `backend/app/routes/image.py`
- `backend/app/prompts/image_refine_system.txt`

#### 4a — `image_refine.py`

Add optional params to `_build_user_payload` and `run_image_refine`:

```python
def _build_user_payload(
    ...
    character_group_size: int | None = None,
    character_group_members: str | None = None,
) -> str:
    ...
    # After existing lines, before recent_turns:
    if character_group_size and character_group_size > 1:
        lines.append(f"character_group_size: {character_group_size}")
        if character_group_members and character_group_members.strip():
            lines.append(f"character_group_members:\n{character_group_members.strip()}")
    ...
```

Same two params in `run_image_refine` signature → threaded to `_build_user_payload`.

#### 4b — `image.py`

- Update the characters SELECT string to include `group_size,group_members_description`.
- After building `context_parts`, add this branch:

```python
group_size = int(character.get("group_size") or 1)
group_members_text = (character.get("group_members_description") or "").strip()

if group_size > 1 and group_members_text:
    # Replace PHYSICAL_IDENTITY with a GROUP_MEMBERS block so the refiner
    # sees structured per-member data instead of the empty single-subject fields.
    context_parts = [p for p in context_parts
                     if not p.startswith("PHYSICAL_IDENTITY:")]
    context_parts.insert(0, f"GROUP_MEMBERS:\n{group_members_text}")
```

- Pass to `run_image_refine`:
```python
refine = await run_image_refine(
    refine_cfg,
    appearance=group_members_text if group_size > 1 and group_members_text
              else (appearance if include_appearance else None),
    character_context=character_context if include_appearance else None,
    ...
    character_group_size=group_size if group_size > 1 else None,
    character_group_members=group_members_text if group_size > 1 and group_members_text else None,
)
```

Note: when group_size > 1, `group_members_text` is passed as `appearance` regardless
of `append_appearance_to_image_prompts` — the group description IS the appearance and
skipping it would leave the refiner blind about who the characters are.

#### 4c — `image_refine_system.txt`

Append the GROUP CHARACTER section **between** the POV=FIRST_PERSON block and the
SFW GUARDRAIL block:

```
GROUP CHARACTER (only when character_group_size > 1)
The "character" in this conversation is a GROUP of multiple individuals who always
appear together. The `character_group_members` field lists them in the format:
  1. Name | gender | age | appearance description
  2. Name | gender | age | appearance description

Rules when character_group_size > 1:

- OVERRIDE single-subject rules. The "character" counts as N subjects.
- Use the same escaped-parens syntax as THIRD-PERSON MULTI-SUBJECT above — one
  `gender_tag \(...\)` group per member, ordered as listed in character_group_members
  (first member is focal and listed first).
- Count tag: derive from the COMBINED genders of all group members.
  - 2 females → `2girls`; 2 males → `2boys`; 1 male + 1 female → `1boy 1girl`;
    3 → `3boys` / `3girls` / `multiple_people`; 4+ → `multiple_people`.
  - Do NOT fold the user persona into this count when the payload also has user_persona
    (third-person). In that case: group members + user = total. Add the user as an extra
    subject after the group members (group members always listed first as focal point).
- POV=FIRST_PERSON with a group character: ALL group members are visible in frame.
  The user is still the camera (not rendered), but the group IS the subject — all N
  members appear together. Apply EXACTLY the same multi-subject rules as
  THIRD-PERSON MULTI-SUBJECT above, with these adaptations:
  - Do NOT apply the first-person single-subject collapse or defensive-collapse.
  - Do NOT force `facing_viewer` or `looking_at_viewer`. The interaction tag is
    ALWAYS derived from the scene narrative (target_message + recent_turns) —
    the same logic used in third-person. If the couple is whispering to each other,
    use `facing_each_other`; if they are both looking at something off-frame, omit an
    interaction tag; if they are both glancing toward the camera, use `looking_at_viewer`.
    Never invent an interaction tag that the scene does not support.
  - Count tag: group members only — do NOT add the user (they are the camera).
    2 females → `2girls`; 2 males → `2boys`; 1 male + 1 female → `1boy 1girl`.
  - Framing: derive from scene context; default `medium_shot` for two subjects;
    never `close-up` (cannot fit two subjects reliably).
  - ACTION + CONTEXT WEIGHTING still applies (first-person section above): read
    target_message + recent_turns and weight relevant actions/props per member.
- POV=THIRD_PERSON with a group character + user_persona: total subjects =
  N group members + 1 user. Group members listed first (they are the focal point),
  user last. Count tag covers all subjects combined.
- NEVER blend group members' attributes across groups. Each member's tags stay
  inside their own `\(...\)` group.
- Per-group-member slot cap: same 7-slot rule as multi-subject above.
```

**Verify (Playwright):** Open a chat with a character that has group_size=2 and
group_members_description filled. Send an assistant message containing `[image: ...]`.
Confirm the generated image shows two subjects. Verify at both L=1440 and S=375.
Verify POV=first_person: both group members visible; interaction tag matches scene,
NOT forced to `looking_at_viewer`.
Verify POV=third_person: three subjects (2 group members + user) if user_persona
exists, or two subjects if no persona.

---

## Risks / mitigations

| Risk | Mitigation |
|---|---|
| group_members_description empty but group_size > 1 | Graceful fallback to single-subject in both avatar_generate and image.py |
| Creator enters malformed lines | `_parse_group_members` silently skips lines that don't match the `N. ... \| ...` pattern; minimum 4 pipe-segments required |
| User avatar prefix contains `solo` | `_build_group_portrait_prompt` strips `solo,?` with regex before using the prefix |
| Existing characters: new columns are NULL / 0 | `DEFAULT 1` on group_size means all existing rows behave exactly as before |
| image_refine_system.txt LLM override in Image Engine settings | If the user has a custom refiner system prompt, it won't include the GROUP CHARACTER section. This is pre-existing behavior (custom override replaces file default). Acceptable — documented. |

## Files touched

| File | Change |
|---|---|
| `db/schema.sql` | Append 2 ALTER TABLE statements |
| `frontend/src/lib/characters.ts` | +2 fields to Character type |
| `frontend/src/features/characters/CharacterForm.tsx` | group_size control + conditional physical/group UI |
| `backend/app/routes/avatar_generate.py` | +3 helpers + branch in endpoint |
| `backend/app/agents/image_refine.py` | +2 optional params threaded to payload builder |
| `backend/app/routes/image.py` | UPDATE select string + context_parts branch + pass new params |
| `backend/app/prompts/image_refine_system.txt` | +GROUP CHARACTER section (~35 lines) |

## Out of scope

- Saving per-member accent colors — group uses the character's single `accent_color`.
- Per-member TTS voice overrides — single character voice applies to the group.
- Memory RAG or Lorebook per group member — scoped to Conversation as before.
- Prompt Editor avatar prefix auto-stripping UI warning — user can manually remove
  `solo` from their prefix if they notice it in the generated prompt.
- The Enrich with AI path (`character_refine.py`) — group characters get the same
  single-entity enrichment; creator manages group framing in `system_prompt`.
