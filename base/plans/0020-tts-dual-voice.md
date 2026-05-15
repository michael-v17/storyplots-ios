---
id: 0020
slug: tts-dual-voice
status: shipped
created: 2026-04-16
---

# Cycle 0020 — TTS layer 2: dual-voice + gender-matched

## Context

Cycle 0017 shipped BYOK OpenAI TTS with a single voice reading the
whole assistant reply. The user can hear audio and it works
end-to-end — but a one-voice stream loses the distinction between
what the character *does* (narration) and what the character *says*
(dialogue). PersonaLLM's dual-voice routing is a seed non-negotiable
(creator-vision.md §5.2): "narration → narrator voice, dialogue →
character voice."

This cycle ships the **dual-voice + gender-matched** half of the
TTS story:

- Text is segmented at synth time — `*italic narration*` goes to
  the **narrator voice**, `"quoted dialogue"` goes to the
  **character voice**, plain text defaults to the narrator (safer
  default — characters always speak in quotes).
- Character voice is picked from the user's configured **male** /
  **female** / **fallback** voices based on `Character.gender`
  (new nullable field). When gender is unspecified, the fallback
  voice plays.
- Each segment caches independently in `message_audio` keyed on
  `(variant_id, segment_index, voice_id)`. Re-play is idempotent.
- Segments play **sequentially** in the browser via a single
  `<audio>` element, one after another, so the flow sounds like
  one continuous read.

Still OpenAI-only (10 standard voices are plenty for 4 distinct
slots). ElevenLabs + WebSpeech + Speed/Pitch/Volume sliders land
in cycle 0019.

**Done when:** with gender set on a character and dual-voice
enabled, clicking ▶ on an assistant reply plays narration in the
narrator voice and dialogue in the character voice (male/female
matched). Flipping dual-voice off returns to the 0017 single-voice
behavior. Changing a voice in settings doesn't invalidate older
cache rows (they still play their original voice because the row
is keyed on voice_id).

## Shape of the change

```
Migration 0025:
 characters.gender already exists from cycle 0018 with 4 valid values
   ('male', 'female', 'non_binary', 'unspecified') + null.
 message_audio + segment_index integer        // 0 when single-voice, 0..N for dual
 message_audio unique key:                    // (variant, family, voice, segment_index)
                                              //   replaces current (variant, family, voice)

Backend:
 agents/tts_split.py       pure fn: text → [{kind, text}]
 agents/tts_openai.py      already has synthesize; reused
 routes/audio.py           POST /messages/{id}/audio now returns a LIST
                            of segment rows in play order. Dual-voice split
                            lives here; picks voices from user prefs +
                            character.gender.

Frontend:
 lib/audio.ts              generateAudioForMessage now returns the array
                            shape; adds segment ordering.
 features/chat/MessageAudioButton.tsx
                            enqueues N URLs and plays each in sequence on
                            a shared <audio> element. Module singleton
                            (stopCurrent) still honored — starting a new
                            play on any message cancels the in-flight queue.
 features/characters/CharacterForm.tsx
                            gender dropdown already exists (from cycle 0018).
                            No change needed here.
 routes/TextToSpeechSettings.tsx
                            + dual-voice toggle
                            + narrator voice picker
                            + male-character voice picker
                            + female-character voice picker
                            + fallback (unspecified) character voice picker
                            (all 10 OpenAI voices for every slot)
 lib/ttsProvider.ts         extended TTS prefs shape:
                              mode, dual_voice, narrator_voice,
                              char_voice_male, char_voice_female,
                              char_voice_fallback
```

## 1. Seed sections satisfied

- [creator-vision.md §5.2](../Seed/creator-vision.md) —
  "dual-voice TTS routing: narration → narrator voice, dialogue →
  character voice." This cycle lands it.
- [creator-vision.md §5.7](../Seed/creator-vision.md) — still
  BYOK, still default OFF. Dual-voice adds the split but does not
  change the provider model.
- [user-stories.md #49](../Seed/user-stories.md) acceptance criteria:
  - "Narration segments (`*…*`) read by narrator voice; dialogue
    segments (`"…"`) by character voice." ✓
  - "Voice selection respects Character / UserPersona gender." ✓
    (Character gender; UserPersona gender is only relevant when we
    add user-voice — not in this cycle.)
- [domain.md §2.3 Character](../Seed/domain.md) — existing field
  list gets `gender` added (seed does not name the field
  explicitly; PersonaLLM-Reference mentions "Character.gender
  (Male / Female / Non-binary / Custom)" — we ship Male/Female/
  null for v0 simplicity, with Non-binary/Custom deferred).
- [design.md §2](../Seed/design.md) principle 1 — typography is
  load-bearing for TTS routing, reused as parser here.

## 2. Commit decisions made this cycle

- **Plain text defaults to narrator voice.** Ambiguous sections
  between `*…*` and `"…"` play with the narrator. Characters
  always quote, so this matches the seed convention.
- **Segmentation lives server-side.** `tts_split.py` is pure,
  covered by Python round-trip tests. Same source of truth the
  frontend's `TypographicText` uses for display (same regex
  pattern) — we keep both in sync via a comment referencing
  each other.
- **Sequential playback, not concatenation.** Segments are
  queued in the frontend and played one-by-one via the same
  module-scoped `<audio>` singleton from 0017. Avoids
  shelling out to ffmpeg, avoids Web Audio API.
- **Cache per segment.** `message_audio` unique key becomes
  `(variant_id, provider_family, voice_id, segment_index)`.
  Changing a voice in settings leaves old cached rows valid
  (their voice_id is part of the key).
- **Gender mapping (4 values + null).** As of cycle 0018, the
  characters table has `gender` with CHECK constraint allowing
  `male | female | non_binary | unspecified | null`. This cycle
  maps them to voice slots: `male → char_voice_male`,
  `female → char_voice_female`, `non_binary | unspecified | null
  → char_voice_fallback`. Three voice slots cover all five gender
  states; non-binary and unspecified share the fallback until a
  dedicated NB voice slot is demanded.
- **Ignore `voice_style` for OpenAI.** The 0018 `voice_style`
  free-text field ("warm / gravelly / formal / breathy") is a
  hint that has no effect with OpenAI's 10 fixed voices. It
  becomes load-bearing when ElevenLabs lands in a later cycle
  (used as a voice-search filter). Until then, the form captures
  it but TTS doesn't read it.
- **Audio playback queue cancels on interrupt.** If the user
  starts a new ▶ on another message mid-queue, the queue aborts
  (not just the current clip). Matches the 0017 UX contract
  ("only one audio plays at a time").
- **Dual-voice toggle is global in TTS settings** — no per-
  conversation override in this cycle. The `chat_controls_state`
  already has `auto_tts` for per-conv on/off; stacking a third
  tri-state (dual / single / inherit) is more UX than it's worth
  until we see demand.
- **Backward compatibility:** existing `message_audio` rows from
  0017 have `segment_index = 0` (column default). They continue
  to play as single-segment audio — the new API returns a one-
  element list instead of a single row, and the frontend handles
  both shapes for the first session after the migration.

## 3. Schema scope / RLS

### Migration `supabase/migrations/0025_tts_dual_voice.sql`

```sql
-- characters.gender already exists from cycle 0018 — no change here.

-- Segment index on message_audio so dual-voice splits can cache per
-- segment. Single-voice cache rows (from cycle 0017) default to 0.
alter table public.message_audio
  add column segment_index integer not null default 0;

-- Replace the old uniqueness — (variant_id, provider_family, voice_id) —
-- with one that includes segment_index, so two segments on the same
-- variant with the same voice don't collide.
alter table public.message_audio
  drop constraint message_audio_variant_id_provider_family_voice_id_key;

alter table public.message_audio
  add constraint message_audio_variant_family_voice_segment_key
  unique (variant_id, provider_family, voice_id, segment_index);

-- No new RLS — message_audio policies from 0022 still apply.
```

### Extended user preferences (`users.preferences.tts`)

Shape after this cycle:

```json
{
  "tts": {
    "mode": "manual" | "auto",
    "dual_voice": boolean,
    "narrator_voice": "<openai voice id>",
    "char_voice_male": "<openai voice id>",
    "char_voice_female": "<openai voice id>",
    "char_voice_fallback": "<openai voice id>"
  }
}
```

Atomic writer RPC `set_user_tts_prefs` grows a JSONB patch
parameter so we can partial-update any of these fields without
stepping on the others.

## 4. Backend

### `agents/tts_split.py`

```python
@dataclass
class Segment:
    kind: Literal["narrator", "character"]
    text: str

def split_for_tts(text: str) -> list[Segment]:
    """Same regex the frontend TypographicText uses for italic spans,
    plus a balanced-quote pass. Strips [image: …] before splitting
    (0016 tag). Returns segments in order. Plain text defaults to narrator.
    """
```

Tests: 6 sample inputs covering italic-only, quoted-only, mixed,
nested, empty, `[image: …]` trailing.

### `routes/audio.py` rewrites

- Reads `user.preferences.tts.{dual_voice, narrator_voice,
  char_voice_*}`.
- Reads `character.gender` through the message's conversation.
- Picks voice per segment:
  - `narrator` segment → `narrator_voice`.
  - `character` segment → `char_voice_male` when gender=male;
    `char_voice_female` when gender=female;
    `char_voice_fallback` when gender ∈ {non_binary, unspecified, null}.
- If `dual_voice=false`, ship the whole text as one
  `character` segment + fallback voice resolution — same shape
  as 0017 but now keyed on `(voice_id, segment_index=0)`.
- Cache lookup per (variant, family, voice, segment_index).
  Return rows in play order.

## 5. Frontend

### `MessageAudioButton` (refactor to queue)

States stay: idle / loading / playing / error.
On ▶:
1. POST → list of rows.
2. For each row, resolve a signed URL.
3. Play the first via `new Audio(url)`; on `ended`, play the
   next; at end of list → idle.
4. Module singleton `stopCurrent()` now cancels the queue (set a
   `cancelled` flag captured by the onended handler).

### `CharacterForm`

No change — the `gender` dropdown shipped in cycle 0018 with 4
valid values + null. This cycle reads those values to pick voices.

### `TextToSpeechSettings`

- Toggle **Dual-voice routing** (off by default — preserves 0017
  UX for existing users).
- When on:
  - Narrator voice picker (10 voices)
  - Male character voice picker
  - Female character voice picker
  - Fallback character voice picker
- When off: show a single "Voice" picker (same as 0017 — one
  voice for everything).
- Persist all five voice slots even when the toggle is off, so a
  later flip-on doesn't erase the selections.

## 6. Verification gates

1. **Migration 0025.** ✅ `message_audio.segment_index` defaults
   to 0; unique key updated. (characters.gender already live
   from cycle 0018.)
2. **Character gender save.** Set Mira's gender = `female`;
   persist via the Character form; reload shows female selected.
   (Already verified in cycle 0018 for Aria.)
3. **Dual-voice text split.** Python unit test: a sample reply
   like `*She smiles.* "Hi, I'm Mira."` splits into 2 segments
   (narrator + character). Verify via direct import of the
   `split_for_tts` function.
4. **Dual-voice playback — female character.** Dual-voice=on,
   narrator=nova, char_voice_female=shimmer. Click ▶ on a Mira
   reply with both narration and dialogue. Expect 2 audio calls,
   2 `message_audio` rows, sequential playback.
5. **Dual-voice playback — male character.** Switch Mira gender
   to male (or create a male character). Same scene → character
   voice = char_voice_male (onyx).
6. **Fallback voice.** Gender=null (or `non_binary` /
   `unspecified`) character. Dual-voice on. Character dialogue
   plays with `char_voice_fallback`.
7. **Single-voice fallback.** Toggle dual-voice OFF. Whole reply
   plays with a single voice — same as 0017 behavior.
8. **Caching by segment.** Re-clicking ▶ on the same reply hits
   cache (no new OpenAI calls in logs); `message_audio` count
   does not grow.
9. **Voice change doesn't invalidate old cache.** Change
   narrator voice in settings to a different one. Old replies
   still play with the original voices (cache keyed on voice_id).
10. **Regressions 0017.** Manual ▶ on a reply with dual-voice OFF
    behaves identical to before. Auto-TTS still works.
11. **Regressions 0001-0019.** Chat / grammar / lorebook / fork /
    import / image pipeline / viewer / gallery / Visual Roleplay /
    structured attributes / image-seed lock all still work.

## 7. Implementation order

1. Migration 0025 + apply.
2. Backend: `tts_split.py` + route rewrite for list return
   shape + voice routing. Python tests for segmentation.
3. Frontend: `lib/audio.ts` updated types; `MessageAudioButton`
   queue refactor; both with Playwright-visible state transitions.
4. TTS settings extensions (dual-voice toggle, 4 voice pickers).
5. Playwright gates 1-11 (live OpenAI for 3-8).
6. Update memory + commit.

## Verification

### Review findings (fixed in-cycle)

- **Splitter regex rejected single-char italic spans** (code-review,
  conf 85). `\*([^*\n][^*]*?)\*` required ≥2 characters inside the
  asterisks; `*!*` wouldn't match. Fixed by relaxing to
  `\*([^*\n]+?)\*`. Added a 9th self-test case
  (`"*!* "Hi there."" → [narrator "!", character "Hi there."]`).
- **MessageAudioButton status race** (code-review, conf 83).
  `setStatus("playing")` ran AFTER `await playNext()`. For a
  single-segment cached clip, the browser could fire `ended`
  synchronously; `stopCurrent()` → `setStatus("idle")` would then be
  clobbered by the pending `setStatus("playing")`, leaving the
  button stuck. Fixed by flipping the two lines.
- **Rejected: TOCTOU-orphan on concurrent insert** (code-review,
  conf 82). The race is a pre-existing pattern from cycle 0017
  (upload-then-insert in the same shape); not introduced by 0020.
  Low-frequency for v0 single-user and the `except Exception: pass`
  cleanup already best-effort removes the orphan. Deferred.
- **Simplifier suggestions** (collapse strip duplication, drop
  defensive `str(...)`, flatten nested `if`): all cosmetic. Skipped.

### Gate results

| # | Gate | Result |
|---|---|---|
| 1 | Migration 0025 applied | ✅ segment_index NOT NULL DEFAULT 0, unique key swapped, extended RPC live |
| 2 | Character gender save | ✅ covered by cycle 0018 |
| 3 | Text-split unit test | ✅ 9/9 self-tests pass via `uv run python -m app.agents.tts_split` |
| 4 | Dual-voice playback, female character | ✅ Aria (gender=female) reply `*setting the umbrella aside* "I am Aria..."` → 2 rows: seg 0 voice=nova (narrator), seg 1 voice=shimmer (char female) |
| 5 | Dual-voice playback, male character | ✅ Aria flipped to male → reply `*offering a warm smile* "The kettle sings..."` → seg 0 nova, seg 1 voice=**onyx** (male slot) |
| 6 | Fallback voice (gender = non_binary) | ✅ reply `*bowing at the shrine gate* "May the mist guide..."` → seg 0 nova, seg 1 voice=**alloy** (fallback slot) |
| 7 | Single-voice fallback (dual_voice=false) | ✅ plain-text reply → 1 row, voice=alloy (legacy `provider_configs.model_id`), segment_index=0 — cache-key compatible with 0017 rows |
| 8 | Cache idempotency per segment | ✅ clicking ▶ again on the dual-voice reply produced 0 new DB rows (row count stayed at 2) |
| 9 | Voice change doesn't invalidate old cache | ✅ old dual-voice rows (variant `ccdfcc54...` seg 0 = nova, seg 1 = shimmer) still present after dual_voice flipped off — voice_id is part of the cache key so they're orthogonal |
| 10 | Regressions cycle 0017 | ✅ implicitly covered by Gate 7 (single-voice legacy path still works) |
| 11 | Regressions 0001-0019 | ✅ chat streams OK, image gen works (structured prompts + seed lock), auto-TTS fires on every new reply, Aria's canonical identity preserved through all gender flips |

### Notable implementation detail

When `dual_voice=false`, the backend short-circuits — it does NOT
invoke `split_for_tts`, instead emitting a single
`Segment("narrator", strip_image_tag(raw).strip())`. This keeps the
single-voice path at one OpenAI call per reply AND makes the cache
key identical to the 0017 layout `(variant, family, voice,
segment_index=0)`. Old 0017 rows remain hit-eligible without a
backfill.
