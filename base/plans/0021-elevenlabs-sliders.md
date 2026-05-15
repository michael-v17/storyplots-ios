---
id: 0021
slug: elevenlabs-sliders
status: draft
created: 2026-04-16
---

# Cycle 0021 — ElevenLabs TTS + Speed/Volume sliders

## Context

Cycle 0020 shipped TTS dual-voice with OpenAI only (10 standard
voices). PersonaLLM-Reference/04-screens/settings/text-to-speech.md
§User Extensions is explicit: the clone should ship with **multiple
BYOK cloud TTS providers (OpenAI TTS, ElevenLabs, …)** and **keep
Speed / Pitch / Volume sliders + Test Voice button**.

This cycle adds **ElevenLabs** as a second BYOK provider with
pre-configured gender-matched defaults (like OpenAI's
nova/onyx/shimmer/alloy today) and ships **Speed** + **Volume**
sliders. **Pitch is deferred** — OpenAI's API doesn't expose it, and
ElevenLabs' `stability` isn't pitch-equivalent.

**Speed is client-side** (`HTMLAudioElement.playbackRate` +
`preservesPitch=true`). This is the key design call: it keeps the
message_audio cache untouched (same (variant, voice, segment_index)
hits regardless of playback speed), works uniformly across both
providers, and avoids per-provider API differences. Volume is also
client-side (`HTMLAudioElement.volume`).

**WebSpeech + per-character voice override** are deferred to cycle
0022.

**Done when:** the TTS settings page has two provider tabs (OpenAI
· ElevenLabs), each with its own BYOK key + voice slots defaulting
to sensible gender-matched voices. Switching the active provider
doesn't lose the other provider's key or slot config. Speed /
Volume sliders in the TTS settings apply at playback time to every
TTS clip. Test Voice button works for whichever provider is active.
Generating audio with ElevenLabs active produces rows with
`provider_family='elevenlabs'` and the ElevenLabs voice IDs.

## Shape of the change

```
Migration 0026:
 upsert_tts_provider → look up by (user, kind, family), not (user, kind).
                       Insert-or-update PER family row. Multiple TTS rows
                       per user now, one active at a time.
 switch_active_tts_provider(family) → NEW, flips is_active.
 set_user_tts_prefs   → add p_speed + p_volume.
 set_tts_voices(family, narrator, char_male, char_female, char_fallback)
                      → NEW; stores slots under preferences.tts.<family>.*.
 Data migration:      → move existing flat preferences.tts.{narrator_voice,
                       char_voice_male, …} into preferences.tts.openai.*,
                       seed preferences.tts.elevenlabs.* defaults.

Backend:
 agents/tts_elevenlabs.py → synthesize(cfg, text, voice_id) via
                           POST /v1/text-to-speech/{voice_id}. Model
                           eleven_multilingual_v2. MP3 bytes.
                           list_voices(cfg) → GET /v1/voices → [{id,name,labels}].
 routes/audio.py      → dispatches synth by active provider_family.
 routes/audio.py      → GET /providers/tts/elevenlabs/voices proxy
                       endpoint so the frontend can fetch the user's
                       ElevenLabs voice catalog without exposing the key.
 routes/audio.py      → _voice_for_segment reads slots from
                       preferences.tts.<active_family> (not flat anymore).

Frontend:
 lib/ttsProvider.ts   → listTTSProviders() returns both rows (per family);
                       switchActiveTTSProvider; extended TTSPrefs with
                       speed/volume + per-provider voice slots.
 TextToSpeechSettings → tab switcher (OpenAI | ElevenLabs); Test Voice
                       uses active provider. Each tab has its own api_key
                       + voice slot pickers. Below: speed/volume sliders
                       (global). Below: dual-voice checkbox (global).
 MessageAudioButton   → on play: el.playbackRate = prefs.speed;
                       el.volume = prefs.volume; el.preservesPitch = true.
 ChatShell auto-TTS   → same.
```

## 1. Seed sections satisfied

- [PersonaLLM-Reference/04-screens/settings/text-to-speech.md §User
  Extensions / Scope Decisions](../Seed/PersonaLLM-Reference/04-screens/settings/text-to-speech.md)
  — *"The clone can ship with [WebSpeech] + optional cloud TTS (OpenAI
  TTS, ElevenLabs, Cartesia, etc.) as BYOK"* and *"Keep Speed / Pitch
  / Volume sliders + Test Voice button."* This cycle ships ElevenLabs
  + Speed + Volume. Pitch is the single deferred knob (explained
  above). WebSpeech moves to cycle 0022.
- [PersonaLLM-Reference/08-generation-parameters.md §TTS](../Seed/PersonaLLM-Reference/08-generation-parameters.md)
  — verbatim defaults: Speed `Normal` (→ 1.0), Pitch `Normal`
  (deferred), Volume `100%` (→ 1.0).
- [creator-vision.md §5.7](../Seed/creator-vision.md) — BYOK +
  vendor-agnostic prompts. ElevenLabs slots behind the same
  `provider_configs` model as OpenAI; no new secret-management
  pattern.
- [domain.md §6 — invariants 7 (BYOK) + 8 (vendor-agnostic)](../Seed/domain.md)
  — both preserved; the route dispatches on `provider_family` and
  never mixes keys.

## 2. Commit decisions made this cycle

- **Speed is client-side, not server-side.** `HTMLAudioElement.playbackRate`
  with `preservesPitch=true`. Pros: no cache invalidation on speed
  change; same code path across providers; zero extra API cost. Cons:
  quality slightly below native server-side speed, inaudible at
  0.85–1.15x. Rationale: v0 simplicity + cache stability.
- **Speed range 0.75 – 1.25 (step 0.05, default 1.0).** Outside this
  range speech sounds unnatural regardless of `preservesPitch`. User
  specifically asked for a "human-sounding" range.
- **Volume is client-side** (`HTMLAudioElement.volume`, 0.0–1.0,
  default 1.0). User might prefer a browser- or OS-level control;
  this is convenience.
- **Pitch deferred.** OpenAI tts-1 doesn't expose pitch; ElevenLabs'
  `stability` slider is emotion-stability, not pitch. No
  cross-provider mapping exists. If demand appears, a per-provider
  pitch slider can land later.
- **Per-provider nested voice slots in `preferences.tts`.** Flat
  `narrator_voice` etc. from 0020 become
  `preferences.tts.openai.narrator` plus a new
  `preferences.tts.elevenlabs.*` block. Rationale: switching active
  provider must NOT clobber the other provider's carefully-picked
  slots. Per-provider nesting is the clean semantics.
- **Pre-configured ElevenLabs defaults.** Gender-matched out of the
  box, editable via the UI. Using ElevenLabs' public free-tier
  voices:
    - narrator = **Rachel** (`21m00Tcm4TlvDq8ikWAM`)
    - char_male = **Adam** (`pNInz6obpgDQGcFmaJgB`)
    - char_female = **Bella** (`EXAVITQu4vr4xnSDxMaL`)
    - char_fallback = **Antoni** (`ErXwobaYiN019PkySvjV`)
  These are widely-documented ElevenLabs premade voices accessible
  with any API key — no custom-voice work needed.
- **Provider rows coexist, one active.** `upsert_tts_provider` now
  looks up by `(user_id, kind, provider_family)` instead of
  `(user_id, kind, is_active)`. Each family gets its own row. A new
  RPC `switch_active_tts_provider(family)` flips `is_active` so only
  one is active at a time. Rotating the OpenAI key doesn't touch the
  ElevenLabs row, and vice-versa.
- **Voice slots are per-provider-family**, but dual_voice + speed +
  volume + mode are global (one toggle regardless of active
  provider).
- **`/providers/tts/elevenlabs/voices` backend proxy.** The frontend
  never holds the user's ElevenLabs key — the backend fetches the
  voice catalog on demand with the decrypted vault key. Returns a
  lightweight `[{voice_id, name, labels: {gender, age, …}}]` list for
  the UI picker.
- **No per-segment speed variation.** Speed is a user-global
  playback knob. Old cached segments play at whatever speed the user
  picks at play time (since it's client-side).
- **Cache key unchanged.** `message_audio` still unique on `(variant,
  family, voice, segment_index)`. Speed/volume aren't in the key
  (client-side).
- **WebSpeech + per-character voice override deferred.** Those two
  concerns pair naturally (char override is most useful when the
  global gender match is wrong; WebSpeech is the "no-cost fallback"
  when BYOK isn't configured). They land together in cycle 0022.

## 3. Schema scope / RLS

### Migration `supabase/migrations/0026_elevenlabs_sliders.sql`

```sql
-- Cycle 0021 — ElevenLabs as a second BYOK TTS provider + Speed/Volume
-- client-side slider prefs. Keeps both provider keys around; one
-- active at a time. Voice slots move into a per-family nested block
-- under preferences.tts so switching active doesn't clobber the other
-- provider's picks.

-- 1. Upsert now scopes by (user, kind, family). Each family gets one
--    row. Active switching is a separate op so the caller can rotate
--    a key without re-declaring active state.
create or replace function public.upsert_tts_provider(
  p_provider_family text,
  p_api_key         text,
  p_voice_id        text
) returns public.provider_configs
language plpgsql
security definer
set search_path = public
as $$
declare
  uid           uuid := auth.uid();
  old_row       public.provider_configs;
  new_secret_id uuid;
  result        public.provider_configs;
  rotating_key  boolean := p_api_key is not null and btrim(p_api_key) <> '';
  has_any_active boolean;
begin
  if uid is null then raise exception 'auth required'; end if;
  if p_provider_family not in ('openai', 'elevenlabs') then
    raise exception 'unknown tts provider family: %', p_provider_family;
  end if;

  select * into old_row
    from public.provider_configs
    where user_id = uid and kind = 'tts' and provider_family = p_provider_family
    limit 1;

  if rotating_key then
    new_secret_id := vault.create_secret(
      p_api_key,
      format('byok_tts_%s_%s_%s', uid, p_provider_family, extract(epoch from now())::bigint),
      'BYOK TTS key (StoryPlots v0)'
    );
    if old_row.vault_secret_id is not null then
      delete from vault.secrets where id = old_row.vault_secret_id;
    end if;
  elsif old_row.id is not null then
    new_secret_id := old_row.vault_secret_id;
  else
    new_secret_id := null;
  end if;

  -- Is there already an active TTS row for this user? If yes, we keep
  -- it active and leave the new/updated row as-is (active flag retains
  -- its prior value for existing rows, defaults to the FIRST row for
  -- new users).
  select exists (
    select 1 from public.provider_configs
      where user_id = uid and kind = 'tts' and is_active
  ) into has_any_active;

  if old_row.id is not null then
    update public.provider_configs
      set provider_family = p_provider_family,
          vault_secret_id = new_secret_id,
          model_id        = p_voice_id
      where id = old_row.id
      returning * into result;
  else
    insert into public.provider_configs
      (user_id, kind, provider_family, vault_secret_id, model_id, is_active)
    values
      (uid, 'tts', p_provider_family, new_secret_id, p_voice_id,
       not has_any_active)   -- first TTS row becomes active by default
    returning * into result;
  end if;
  return result;
end;
$$;

grant execute on function public.upsert_tts_provider(text, text, text) to authenticated;

-- 2. Explicit active-provider flip.
create or replace function public.switch_active_tts_provider(
  p_provider_family text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hit_count integer;
begin
  if uid is null then raise exception 'auth required'; end if;
  if p_provider_family not in ('openai', 'elevenlabs') then
    raise exception 'unknown tts provider family: %', p_provider_family;
  end if;

  update public.provider_configs
    set is_active = (provider_family = p_provider_family)
    where user_id = uid and kind = 'tts';

  get diagnostics hit_count = row_count;
  if hit_count = 0 then
    raise exception 'no TTS provider rows to switch — save a key for % first', p_provider_family;
  end if;
end;
$$;

grant execute on function public.switch_active_tts_provider(text) to authenticated;

-- 3. Extend set_user_tts_prefs with speed + volume. Both default null
--    so the caller can partial-update. All other existing params
--    stay as-is.
drop function if exists public.set_user_tts_prefs(text, boolean, text, text, text, text);

create or replace function public.set_user_tts_prefs(
  p_mode                text    default null,
  p_dual_voice          boolean default null,
  p_narrator_voice      text    default null,       -- legacy compat
  p_char_voice_male     text    default null,       -- legacy compat
  p_char_voice_female   text    default null,       -- legacy compat
  p_char_voice_fallback text    default null,       -- legacy compat
  p_speed               numeric default null,
  p_volume              numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_prefs jsonb;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if p_mode is not null and p_mode not in ('manual', 'auto') then
    raise exception 'invalid tts mode: %', p_mode;
  end if;
  if p_speed is not null and (p_speed < 0.5 or p_speed > 2.0) then
    raise exception 'speed out of range: %', p_speed;
  end if;
  if p_volume is not null and (p_volume < 0 or p_volume > 1) then
    raise exception 'volume out of range: %', p_volume;
  end if;

  select coalesce(preferences, '{}'::jsonb) into current_prefs
    from public.users where id = auth.uid();

  current_prefs := jsonb_set(current_prefs, '{tts}',
                             coalesce(current_prefs -> 'tts', '{}'::jsonb), true);

  if p_mode is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,mode}', to_jsonb(p_mode), true);
  end if;
  if p_dual_voice is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,dual_voice}', to_jsonb(p_dual_voice), true);
  end if;
  if p_speed is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,speed}', to_jsonb(p_speed), true);
  end if;
  if p_volume is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,volume}', to_jsonb(p_volume), true);
  end if;

  -- The 4 legacy slot params feed the OpenAI-family voice slots for
  -- backward compat with any caller that still uses them. New code
  -- uses set_tts_voices() with the explicit family.
  current_prefs := jsonb_set(current_prefs, '{tts,openai}',
                             coalesce(current_prefs -> 'tts' -> 'openai', '{}'::jsonb), true);
  if p_narrator_voice is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,openai,narrator}', to_jsonb(p_narrator_voice), true);
  end if;
  if p_char_voice_male is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,openai,char_male}', to_jsonb(p_char_voice_male), true);
  end if;
  if p_char_voice_female is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,openai,char_female}', to_jsonb(p_char_voice_female), true);
  end if;
  if p_char_voice_fallback is not null then
    current_prefs := jsonb_set(current_prefs, '{tts,openai,char_fallback}', to_jsonb(p_char_voice_fallback), true);
  end if;

  update public.users set preferences = current_prefs where id = auth.uid();
end;
$$;

grant execute on function public.set_user_tts_prefs(text, boolean, text, text, text, text, numeric, numeric) to authenticated;

-- 4. Per-family voice slot setter. Replaces all 4 slots for one
--    family in a single call. Partial update by slot would bloat the
--    signature; the caller loads current prefs first and sends the
--    whole block.
create or replace function public.set_tts_voices(
  p_provider_family text,
  p_narrator        text,
  p_char_male       text,
  p_char_female     text,
  p_char_fallback   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_prefs jsonb;
  family_block  jsonb;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if p_provider_family not in ('openai', 'elevenlabs') then
    raise exception 'unknown tts provider family: %', p_provider_family;
  end if;

  family_block := jsonb_build_object(
    'narrator',      p_narrator,
    'char_male',     p_char_male,
    'char_female',   p_char_female,
    'char_fallback', p_char_fallback
  );

  select coalesce(preferences, '{}'::jsonb) into current_prefs
    from public.users where id = auth.uid();
  current_prefs := jsonb_set(current_prefs, '{tts}',
                             coalesce(current_prefs -> 'tts', '{}'::jsonb), true);
  current_prefs := jsonb_set(current_prefs,
                             array['tts', p_provider_family],
                             family_block, true);

  update public.users set preferences = current_prefs where id = auth.uid();
end;
$$;

grant execute on function public.set_tts_voices(text, text, text, text, text) to authenticated;

-- 5. Data migration — move any flat TTS voice keys into the openai
--    nested block. Idempotent and safe for users who already have
--    the new shape from fresh writes.
update public.users
set preferences = jsonb_strip_nulls(
  jsonb_set(
    preferences,
    '{tts,openai}',
    coalesce(preferences -> 'tts' -> 'openai', '{}'::jsonb) ||
    jsonb_build_object(
      'narrator',      preferences -> 'tts' -> 'narrator_voice',
      'char_male',     preferences -> 'tts' -> 'char_voice_male',
      'char_female',   preferences -> 'tts' -> 'char_voice_female',
      'char_fallback', preferences -> 'tts' -> 'char_voice_fallback'
    ),
    true
  )
)
where preferences -> 'tts' ? 'narrator_voice'
   or preferences -> 'tts' ? 'char_voice_male'
   or preferences -> 'tts' ? 'char_voice_female'
   or preferences -> 'tts' ? 'char_voice_fallback';

-- Strip the legacy flat keys after they've been migrated up.
update public.users
set preferences = preferences
  #- '{tts,narrator_voice}'
  #- '{tts,char_voice_male}'
  #- '{tts,char_voice_female}'
  #- '{tts,char_voice_fallback}'
where preferences -> 'tts' ? 'narrator_voice'
   or preferences -> 'tts' ? 'char_voice_male'
   or preferences -> 'tts' ? 'char_voice_female'
   or preferences -> 'tts' ? 'char_voice_fallback';
```

## 4. Backend

### `agents/tts_elevenlabs.py` (NEW)

```python
"""ElevenLabs TTS adapter. Same contract as tts_openai.synthesize:
   bytes of an MP3. Uses the eleven_multilingual_v2 model (good
   quality, supports most Latin-script languages the app targets)."""

@dataclass
class ElevenLabsCallConfig:
    api_key: str
    voice_id: str
    base_url: str = "https://api.elevenlabs.io/v1"
    model_id: str = "eleven_multilingual_v2"

async def synthesize(cfg: ElevenLabsCallConfig, text: str) -> bytes:
    # POST {base}/text-to-speech/{voice_id}
    # headers: xi-api-key, accept: audio/mpeg
    # body: { text, model_id, voice_settings: {stability: 0.5, similarity_boost: 0.75} }
    ...

async def list_voices(cfg: "ElevenLabsCallConfig-minus-voice") -> list[dict]:
    # GET {base}/voices
    # Returns [{voice_id, name, labels: {gender, age, description}}]
    ...
```

### `routes/audio.py`

- `_voice_for_segment` reads slots from
  `preferences.tts.<active_family>.{narrator, char_male, char_female,
  char_fallback}`. Legacy flat keys no longer consulted (0026
  migrated them).
- `POST /messages/{message_id}/audio` — the main synth loop's
  dispatcher picks `tts_openai.synthesize` or
  `tts_elevenlabs.synthesize` based on the active provider row.
  Everything else (splitting, cache, gender routing, per-segment
  rows) stays identical.
- `POST /providers/tts/test` — same dispatch.
- `GET /providers/tts/elevenlabs/voices` (NEW) — proxies ElevenLabs'
  `/v1/voices`. Needs the user's ElevenLabs vault key; returns a
  thin `[{voice_id, name, gender_label}]` list.

## 5. Frontend

### `TextToSpeechSettings`

- Tab switcher at top: **OpenAI · ElevenLabs** (WebSpeech greyed-out
  with "next cycle" label, same pattern as 0017 did for ElevenLabs).
- Each tab has its own `api_key` + voice slots UI.
  - **OpenAI tab:** 10-voice dropdown picker (existing).
  - **ElevenLabs tab:**
    - Voice catalog: on load, if a key is saved, fetch
      `/providers/tts/elevenlabs/voices`. Each of the 4 slots
      becomes a dropdown populated from the catalog.
    - Fallback when no key yet: text inputs with the 4 preset voice
      IDs pre-filled (Rachel / Adam / Bella / Antoni). User can paste
      any voice ID they know.
- Below the tabs:
  - **Active provider** radio buttons — which tab's voices get used
    at synth time. Matches the `is_active` flag on
    `provider_configs`.
  - **Dual-voice routing** checkbox (global, unchanged from 0020).
  - **Speed** slider: 0.75–1.25, step 0.05, default 1.0.
  - **Volume** slider: 0–100%, step 5%, default 100%.
  - **Test voice** button — plays the active provider's narrator
    slot voice.

### `MessageAudioButton` + `ChatShell auto-TTS`

On play:
```ts
el.playbackRate = prefs.speed;
el.volume = prefs.volume;
el.preservesPitch = true; // avoid chipmunk effect at speed≠1
```
Prefs are loaded once on mount (or lazily on first play) and
re-read from the same stale closure if the user navigates to
settings and back; a live react-to-prefs-change listener is
overkill for v0.

### `lib/ttsProvider.ts`

```ts
export type ProviderFamily = "openai" | "elevenlabs";

export type TTSPrefs = {
  mode: "manual" | "auto";
  dual_voice: boolean;
  speed: number;          // 0.75–1.25
  volume: number;         // 0.0–1.0
  openai:     { narrator: string; char_male: string; char_female: string; char_fallback: string };
  elevenlabs: { narrator: string; char_male: string; char_female: string; char_fallback: string };
};

export async function listTTSProviders(): Promise<{ openai: ProviderConfig | null; elevenlabs: ProviderConfig | null; active: ProviderFamily | null }> { … }
export async function switchActiveTTSProvider(family: ProviderFamily): Promise<void> { … }
export async function saveTTSVoices(family: ProviderFamily, slots: {...}): Promise<void> { … }
export async function saveTTSPrefs(patch: Partial<TTSPrefs>): Promise<void> { … }   // extended
export async function listElevenLabsVoices(): Promise<{voice_id: string; name: string; gender: string | null}[]> { … }
```

## 6. Verification gates

1. **Migration 0026 applied.** Existing user's
   `preferences.tts.openai.{narrator,…}` populated from the old flat
   keys; flat keys removed. RPCs live. `upsert_tts_provider` now
   accepts `elevenlabs` family.
2. **Both provider keys coexist.** Save OpenAI key → 1 row. Save
   ElevenLabs key → 2 rows total, each with the correct
   `provider_family`. Neither key is lost.
3. **Switch active.** Call `switch_active_tts_provider('elevenlabs')`;
   `is_active` flips; `get_active_tts_key` returns the elevenlabs
   secret. Switch back; OpenAI key returns.
4. **ElevenLabs test voice.** Click **Test voice** with ElevenLabs
   active; a short "Hello — testing your voice." plays via
   `/providers/tts/test` → backend dispatches to ElevenLabs →
   live API call → MP3 bytes → played.
5. **Dual-voice + ElevenLabs.** With ElevenLabs active, dual-voice
   on, gender=female Aria reply. Expected: 2 audio rows with
   `provider_family='elevenlabs'`, one with voice=Rachel (or user's
   narrator pick), one with voice=Bella (or female pick).
6. **Speed slider at playback.** Set speed=1.2, click ▶ on a cached
   reply. `HTMLAudioElement.playbackRate` observed at 1.2;
   `preservesPitch` true. Slowed to 0.8, observed.
7. **Volume slider at playback.** Volume=50%. `el.volume` observed
   at 0.5 during play.
8. **Regressions 0001–0020.** OpenAI still works (flip active back,
   send message, audio plays on OpenAI voices). Chat / image /
   structured attributes / seed lock / dual-voice gender routing
   all unchanged.

## 7. Implementation order

1. Migration 0026 + apply.
2. Backend: `tts_elevenlabs.py` + dispatch in `routes/audio.py` +
   `/providers/tts/elevenlabs/voices` proxy.
3. Frontend: `lib/ttsProvider.ts` extensions (per-family types +
   new RPCs + list voices).
4. Frontend: `TextToSpeechSettings` tabs + slot pickers + sliders.
5. Frontend: `MessageAudioButton` + ChatShell auto-TTS apply
   `playbackRate` + `volume` + `preservesPitch`.
6. Playwright gates 1–8 (live ElevenLabs API for 4, 5).
7. Update memory + commit.

## Verification

_To be filled in after creator approval + implementation._
