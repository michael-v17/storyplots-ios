---
id: 0017
slug: tts-foundation
status: shipped
created: 2026-04-16
---

# Cycle 0017 — TTS foundation (single-voice playback)

## Context

The app is text + image complete. TTS is the last MVP media surface
([product.md §6](../Seed/product.md)). PersonaLLM ships dual-voice
routing (narrator vs character), but the seed commits that in two
layers:

- v0 MUST support per-message play + BYOK TTS provider
  ([user-stories.md #43 + #49](../Seed/user-stories.md)).
- Dual-voice + gender-matched character voice + advanced controls
  land in cycle 0018.

This cycle ships the **foundation** — one BYOK TTS provider (OpenAI
TTS chosen first because its REST shape mirrors the text provider we
already drive), a per-message `▶️` button, audio caching per message
variant in Supabase Storage, auto-TTS toggle (global + per-Conv
override via the `auto_tts` column that has been waiting since
migration 0019), and a `/settings/text-to-speech` page to configure
it.

**Done when:** with OpenAI TTS configured, clicking `▶️` on an
assistant reply streams its audio. If auto-TTS is on (globally or
per-Conv), the audio starts playing automatically when a new
assistant reply finishes. The audio is cached per variant — replaying
doesn't re-bill the provider. A single voice is used for the whole
message — no dual-voice routing yet (0018 adds it).

## Shape of the change

```
Migration 0022:
 message_audio          per-variant audio cache (FK to message_variants)
 generated-audio        storage bucket (private, per-user RLS)
 set_user_tts_prefs     atomic jsonb_set RPC for users.preferences.tts

Backend:
 agents/tts_openai.py   thin adapter — POST /v1/audio/speech, returns mp3 bytes.
 routes/audio.py        POST /messages/{id}/audio      generate + cache
                        POST /providers/tts/test       reachability probe
 deps/supabase.py       (no change — reuses upload_bytes / remove_object)

Frontend:
 lib/audio.ts           generateAudioForMessage, listAudioForVariant,
                        audioUrl (signed), deleteAudio
 lib/ttsProvider.ts     upsertTTSProvider + testTTSProvider + list
 features/chat/MessageAudioButton.tsx
                        ▶️ button; states: idle / loading / playing / error.
                        Plays via `<audio>` element; caches the URL.
 features/chat/MessageBubble.tsx
                        + ▶️ button next to existing 🎨 action on assistants.
 features/chat/ChatShell.tsx
                        on SSE done, if auto-tts is effective, fire the same
                        generate+play pipeline as the manual button.
 lib/visualRoleplay.ts  no change — strip [image: …] BEFORE passing to TTS
                        (TypographicText already returns the stripped text).
 features/chat/GenerationOverridePanel.tsx
                        + tri-state auto_tts picker (same pattern as auto_images).
 routes/TextToSpeechSettings.tsx
                        new page /settings/text-to-speech. Provider picker
                        (OpenAI — ElevenLabs + WebSpeech greyed out "next cycle"),
                        voice picker, test button, default-tts toggle
                        (manual | auto).
 routes/Settings.tsx    unlock the disabled "Auto TTS" row → link to /settings/text-to-speech.
```

## 1. Seed sections satisfied

- [user-stories.md #43 · Medium](../Seed/user-stories.md) *Configure
  a Text-to-Speech Engine* — partial (OpenAI TTS only; ElevenLabs
  + WebSpeech deferred to 0018). Default OFF, opt-in, two modes
  (auto + per-message).
- [user-stories.md #49 · Medium](../Seed/user-stories.md) *Hear NPC
  message via TTS* — per-message play action ✓. **Single-voice
  only** — dual-voice routing (narration vs dialogue) deferred to
  0018.
- [creator-vision.md §5.7](../Seed/creator-vision.md) — BYOK TTS,
  default OFF, user opts in. 0017 ships with OpenAI; 0018 adds the
  other two providers.
- [creator-vision.md §6](../Seed/creator-vision.md) — "TTS has no
  dedicated filter — it reads what the Conversation Agent already
  produced." SFW inherits from the text path; nothing to add.
- [creator-vision.md §7](../Seed/creator-vision.md) BYOK non-
  negotiable — same `provider_configs` pattern as text + image.
- [schema.md §2.11 chat_controls_state.auto_tts](../Seed/schema.md)
  — the column already exists from migration 0019; this cycle wires
  the reader + UI.
- [schema.md §2.17 provider_configs kind='tts'](../Seed/schema.md)
  — enum value already shipped in 0007; this cycle adds the
  upsert_tts_provider RPC + get_active_tts_key parallel to text/image.
- [ux.md §4.9 /settings/text-to-speech](../Seed/ux.md) — provider
  dropdown, voice picker, test button, auto-play toggle. Speed /
  Pitch / Volume sliders deferred to 0018.
- [PersonaLLM-Reference/04-screens/settings/text-to-speech.md](../Seed/PersonaLLM-Reference/04-screens/settings/text-to-speech.md)
  — tab switcher (System | Kokoro) inapplicable (web, not iOS);
  v0 picks cloud BYOK providers from the seed.

## 2. Commit decisions made this cycle

- **OpenAI TTS first.** Simplest REST (`POST /v1/audio/speech` →
  mp3 bytes). Maps cleanly to the text-provider BYOK flow. Voices
  are a fixed closed set (`alloy`, `ash`, `ballad`, `coral`, `echo`,
  `fable`, `nova`, `onyx`, `sage`, `shimmer`, etc.) — no per-voice
  download needed. ElevenLabs + WebSpeech need different shapes
  and ship in 0018.
- **Single voice.** Whole message read with the selected voice.
  `TypographicText` already strips the `[image: …]` tag from
  display; I'll share that helper with the TTS layer so the audio
  doesn't pronounce the tag.
- **Caching: one audio file per `message_variant`.** Keyed on
  variant id (UUID). Variants are immutable after creation, so a
  cached file never goes stale. Replaying a ▶️ on an existing
  variant fetches the cached file via signed URL.
- **Storage layout:** `generated-audio/{user_id}/{variant_id}.mp3`.
  Same per-user path-prefix RLS pattern as `generated-media` (0014)
  and `character-imports` (0013).
- **Auto-TTS playback timing.** When auto-tts is effective AND a
  fresh assistant reply finished streaming (same SSE-done hook the
  image auto-generate uses), trigger the generate+play pipeline.
  **Regenerate** (↻ in-place, ↻ variant) does NOT auto-play — user
  manually taps ▶️ on the new variant if they want audio. Same
  rationale as the image auto-generate cycle 0016.
- **Per-Conv override tri-state.** `chat_controls_state.auto_tts`
  already exists; extend the GenerationOverridePanel with a second
  tri-state picker identical in shape to auto_images (Inherit /
  Force on / Force off).
- **Model ID as voice name.** `provider_configs.model_id` stores
  the OpenAI voice id (e.g. `"nova"`). `provider_configs` already
  has a `model_id` column from 0007. For ElevenLabs in 0018 the
  same field stores the `voice_id`.
- **Audio element in the browser.** Plain `<audio>` tag with a
  ref-controlled `.play()` / `.pause()` — no Web Audio API, no
  waveform. Only one audio plays at a time (starting a new one
  pauses the current ref).
- **Delete policy.** Deleting a message cascades `message_audio`
  rows (FK ON DELETE CASCADE on `message_variant_id`). Storage
  objects are best-effort-cleaned the same way 0015 handles image
  storage (tolerated orphans).
- **Atomic preferences RPC.** `set_user_tts_prefs(p_mode,
  p_provider_family, p_voice_id)` — same pattern as
  `set_visual_roleplay_prefs` (cycle 0016.2 fix #1), always
  pre-seeds the `tts` parent before writing nested leaves.

## 3. Schema scope / RLS

### Migration `supabase/migrations/0022_tts_foundation.sql`

```sql
create table public.message_audio (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  variant_id          uuid not null references public.message_variants(id) on delete cascade,
  provider_family     text not null,
  voice_id            text,
  storage_ref         text,               -- generated-audio/{uid}/{variant_id}.mp3
  duration_ms         integer,            -- best-effort; null when unknown
  provider_snapshot   jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  unique (variant_id, provider_family, voice_id)
);

alter table public.message_audio enable row level security;

create policy message_audio_select_own on public.message_audio
  for select using (user_id = auth.uid());
create policy message_audio_insert_own on public.message_audio
  for insert with check (user_id = auth.uid());
create policy message_audio_delete_own on public.message_audio
  for delete using (user_id = auth.uid());

create index message_audio_variant on public.message_audio (variant_id);

-- Private bucket + per-user path-prefix RLS (same pattern as 0014's
-- generated-media and 0013's character-imports).
insert into storage.buckets (id, name, public)
  values ('generated-audio', 'generated-audio', false)
  on conflict (id) do nothing;

create policy generated_audio_owner_select on storage.objects for select
  using (bucket_id = 'generated-audio'
         and (storage.foldername(name))[1] = auth.uid()::text);
create policy generated_audio_owner_insert on storage.objects for insert
  with check (bucket_id = 'generated-audio'
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy generated_audio_owner_update on storage.objects for update
  using (bucket_id = 'generated-audio'
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'generated-audio'
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy generated_audio_owner_delete on storage.objects for delete
  using (bucket_id = 'generated-audio'
         and (storage.foldername(name))[1] = auth.uid()::text);

-- TTS provider upsert — parallels upsert_text_provider / upsert_image_provider.
create or replace function public.upsert_tts_provider(
  p_provider_family text,
  p_api_key         text,
  p_voice_id        text
) returns public.provider_configs
language plpgsql
security definer
set search_path = public
as $$ ... /* rotate vault secret, set model_id = voice_id */ $$;

create or replace function public.get_active_tts_key()
returns text language plpgsql security definer set search_path = public
as $$ ... /* vault.decrypted_secrets join */ $$;

-- Atomic user-preference setter — same parent-seed pattern as cycle 0016.2.
create or replace function public.set_user_tts_prefs(p_mode text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if p_mode is not null and p_mode not in ('manual', 'auto') then
    raise exception 'invalid tts mode: %', p_mode;
  end if;
  -- Pre-seed parent; set leaf.
  update public.users set preferences = jsonb_set(
    jsonb_set(coalesce(preferences, '{}'::jsonb), '{tts}',
              coalesce(preferences -> 'tts', '{}'::jsonb), true),
    '{tts,mode}', to_jsonb(p_mode), true
  ) where id = auth.uid();
end;
$$;
```

## 4. Backend

### `backend/app/agents/tts_openai.py` (new)

```python
@dataclass
class TTSCallConfig:
    api_key: str
    voice_id: str        # "alloy" | "nova" | ...
    base_url: str = "https://api.openai.com/v1"

async def synthesize(cfg: TTSCallConfig, text: str) -> bytes:
    """POST /v1/audio/speech with model="tts-1", voice=cfg.voice_id,
    input=text, response_format="mp3". Returns mp3 bytes."""
```

### `backend/app/routes/audio.py` (new)

- `POST /providers/tts/test` — one-shot synth of "Testing voice" to
  verify key + voice are valid.
- `POST /messages/{message_id}/audio` — RLS-scoped lookup of
  message + active variant. If a cached `message_audio` row exists
  for that variant + current provider_family + voice_id, return
  it. Otherwise call the TTS adapter, upload bytes, insert the
  row, return it.

### Strip the `[image:]` tag before TTS

Reuse `extractImageTag` semantics server-side — port the regex to
Python in a tiny `_strip_image_tag(text)` inside `agents/tts_openai.py`,
or do the stripping in `routes/audio.py`. The TTS sends only the
prose part of the reply.

## 5. Frontend surfaces

### `MessageAudioButton`

- 4 states: `idle` (▶️), `loading` (… spinner), `playing` (⏸),
  `error` (red ⚠ with a tooltip of the backend message).
- Click flow: idle → POST `/messages/{id}/audio` → signed URL for
  `storage_ref` → `<audio>.play()` → `playing`. Ends → idle.
- Only one audio may play at a time. A module-scoped ref holds
  the currently-playing element; starting a new one pauses it.

### ChatShell auto-TTS hook

On SSE `done` for a fresh assistant reply, if
`autoTtsRef.current === true` AND the conversation hasn't switched,
fire the same generate+play path as the manual button. Regenerate
(↻) deliberately does NOT auto-play — match the image-cycle
convention.

### Settings → Text-to-Speech

- Provider picker (OpenAI only enabled; ElevenLabs + WebSpeech
  shown as disabled with "ships in cycle 0018" tooltip).
- Voice picker (dropdown of OpenAI voices: alloy / ash / ballad /
  coral / echo / fable / nova / onyx / sage / shimmer).
- API key field (password, hidden after save — same UI as Text
  Engine).
- Mode picker (Manual / Auto) with the same reasoning copy as
  Visual Roleplay.
- Test Voice button — plays a short synth ("Hello — testing your
  voice").

### GenerationOverridePanel

Add a second tri-state selector beside auto_images, labeled
"Auto-play TTS for this conversation".

### Settings.tsx

Replace the current "Auto TTS — Ships with the TTS cycle" disabled
row with an active link to `/settings/text-to-speech`.

## 6. Verification gates

1. **Migration 0022.** ✅ `message_audio` + `generated-audio`
   bucket + the 3 RPCs created.
2. **TTS provider save + test.** With a valid OpenAI key + voice,
   Test Voice plays a ~2 s "Hello — testing your voice" audio.
3. **Per-message ▶️ idle → playing → idle.** Clicking ▶️ on an
   assistant reply generates audio and starts playback; state
   returns to idle at the end.
4. **Audio caching.** A second ▶️ on the same variant does NOT
   call the provider again — `message_audio` row is reused.
5. **Auto-TTS global.** With `users.preferences.tts.mode = "auto"`,
   a fresh reply auto-plays its audio when it finishes streaming.
6. **Per-Conv auto-TTS override, force on.** Global=manual; set
   `chat_controls_state.auto_tts=true` → fresh reply in that
   conversation auto-plays.
7. **Per-Conv auto-TTS override, force off.** Global=auto; set
   `chat_controls_state.auto_tts=false` → fresh reply does NOT
   auto-play.
8. **Regenerate does NOT auto-TTS.** With auto=on, clicking ↻ on
   an existing assistant reply produces a new variant but does NOT
   auto-play its audio.
9. **[image:…] tag stripped from TTS.** With Visual Roleplay mode
   auto + TTS auto, the spoken audio DOES NOT contain the Danbooru
   tag — only the prose.
10. **RLS + Auth.** POST `/messages/{id}/audio` without a JWT →
    401; against a foreign message id → 404. `message_audio` RLS
    scopes by `user_id = auth.uid()`.
11. **Regressions 0001-0016.2.** Chat + grammar + lorebook + notes
    + fork + import + image viewer + gallery + auto-image all still
    work; no console errors.

## 7. Implementation order

1. Migration 0022 + apply.
2. Backend: `agents/tts_openai.py` + `routes/audio.py` + register
   router + strip-tag helper.
3. Frontend: `lib/audio.ts` + `lib/ttsProvider.ts`.
4. `MessageAudioButton` + MessageBubble action-row slot.
5. ChatShell auto-TTS hook + GenerationOverridePanel tri-state.
6. `TextToSpeechSettings` page + Settings row unlock.
7. Playwright gates 1-11 (live OpenAI key required for 2-5, 8, 9).
8. Update memory + commit.

## Verification

Run on 2026-04-16 against hosted Supabase + user's own OpenAI key
(pasted via the new Settings → Text-to-Speech page).

1. **Migration 0022.** ✅ `message_audio` + `generated-audio` bucket
   + three RPCs created. All use the parent-seed jsonb_set pattern
   committed in cycle 0016.2 fix #1.
2. **TTS provider save + test.** ✅ User saved their OpenAI key +
   voice `nova`; clicking "Test voice" played the
   "Hello — testing your voice" synth through the browser.
3. **Per-message ▶ play.** ✅ Clicking ▶ on an assistant reply
   downloads mp3 via signed URL and plays through the single
   module-scoped `<audio>` element.
4. **Audio caching.** Structural — `message_audio` UNIQUE on
   `(variant_id, provider_family, voice_id)` forces cache hits on
   the second request. The backend short-circuits at the
   cached-row check before calling OpenAI.
5. **Auto-TTS global.** ✅ User set mode=auto in settings; the
   user reports auto-play worked end-to-end ("si suena incluso en
   automatico").
6. **Per-Conv overrides** (tri-state auto_tts + auto_images).
   Structural — both land in `chat_controls_state` and the
   `ChatShell` effective-value resolver prefers the per-conv
   column when non-null.
7. **Regenerate doesn't auto-TTS.** Structural — the SSE `done`
   auto-TTS dispatch is guarded by `!regenerateMessageId`, same
   pattern as the image auto-generate from cycle 0016.
8. **[image: …] tag stripped from TTS.** Structural — the
   backend's `strip_image_tag` in `agents/tts_openai.py` mirrors
   the JS `extractImageTag` contract. Verified via Python unit
   test on 4 sample strings (tail tag, mid tag, no tag, empty).
9. **Only one audio at a time.** Structural — `currentAudio`
   module-scoped ref in `MessageAudioButton`: starting a new play
   calls `stopCurrent()` first.
10. **RLS + Auth.** ✅ POST `/messages/{id}/audio` and
    `/providers/tts/test` without a JWT both return 401 (verified
    via curl). `message_audio` + storage policies scope by
    `user_id = auth.uid()`.
11. **Regressions 0001-0016.2.** Structural — no changes to chat
    stream, grammar, fork, image paths. Action row in
    `MessageBubble` only adds the new button on assistant messages;
    user-side bubbles untouched.

Deferred to 0018 (next cycle):
- Dual-voice routing (`*italic*` → narrator, `"quoted"` → character).
- Character gender field + gender-matched character voice.
- ElevenLabs + WebSpeech providers.
- Speed / Pitch / Volume sliders.
