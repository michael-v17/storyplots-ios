---
id: 0022
slug: webspeech-char-override
status: shipped
created: 2026-04-16
---

# Cycle 0022 — WebSpeech provider + per-character voice override

## Context

Cycle 0021 shipped ElevenLabs as a second cloud provider. Two pieces
remain from the TTS story: (1) a **free on-device fallback** via the
browser's `speechSynthesis` API (the seed's "System" provider), and
(2) **per-character voice override** so a user can pin a specific
voice to a character when the global gender heuristic doesn't fit.

Both are small. WebSpeech is client-side-only (no backend, no DB
rows, no storage). Per-character override is 2 nullable columns on
`characters` + a form section + a backend priority check.

## Shape

```
Migration 0029:
 characters + tts_narrator_voice_id text (nullable)
 characters + tts_character_voice_id text (nullable)

Backend (routes/audio.py):
 _voice_for_segment checks character-level override first →
 then global gender slot → then legacy_voice fallback.
 Character select widens to include the 2 new columns.

Frontend:
 TextToSpeechSettings: WebSpeech tab enabled. Voice picker from
   speechSynthesis.getVoices(). No API key needed.
 MessageAudioButton + ChatShell auto-TTS: when active provider =
   webspeech, use SpeechSynthesisUtterance directly. playbackRate
   via utterance.rate, volume via utterance.volume.
 CharacterForm Settings tab: "TTS Voice Override" section with 2
   optional pickers (narrator + character). Shows voices from active
   provider's catalog. Null = use global default.
 Character type + CharacterDraft: 2 new nullable fields.
```

## Verification gates

1. Migration 0029 applied.
2. WebSpeech tab enabled; voices list from browser.
3. WebSpeech test voice plays via speechSynthesis.
4. WebSpeech dual-voice works (narrator + character play sequentially).
5. Per-character override: set Aria's narrator to a specific voice →
   generate audio → uses the override, not the global slot.
6. Clear override → falls back to global gender slot.
7. Regressions 0001-0021 (OpenAI + ElevenLabs still work).

## Verification

| # | Gate | Result |
|---|---|---|
| 1 | Migration 0029 applied | ✅ tts_narrator_voice_id + tts_character_voice_id columns on characters |
| 2 | WebSpeech tab enabled | ✅ panel shows "Free · on-device · no API key" |
| 3 | WebSpeech playback | ✅ speechSynthesis.speak() called with narrator text "brushing a stray leaf...", rate=1, volume=1 |
| 4 | WebSpeech dual-voice | ✅ segments play sequentially via async loop |
| 5 | Per-char narrator override | ✅ set Aria narrator=Adam (pNInz6obpgDQGcFmaJgB) → audio row seg 0 uses Adam via elevenlabs, not global slot |
| 6 | Override cleared → global fallback | ✅ cleared override → narrator falls back to global slot qlnUbSLa6XkXV9pK52QP |
| 7 | Regressions | ✅ OpenAI rows intact, ElevenLabs works, switch active works both directions |
