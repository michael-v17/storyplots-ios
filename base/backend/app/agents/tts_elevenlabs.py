"""ElevenLabs TTS adapter.

Same contract as agents.tts_openai.synthesize: returns MP3 bytes.
We use the `eleven_multilingual_v2` model (higher quality, supports
Spanish + English + most Latin-script languages the app targets)
instead of the faster `eleven_turbo_v2_5` — quality matters more
than latency for a read-back UX.

The four v0 defaults (Rachel / Adam / Bella / Antoni) are public
premade voices available to every ElevenLabs API key; no custom-
voice work is required to light the feature up.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx


# Public premade voices used as v0 gender-matched defaults. Mirrors the
# presets surfaced by the frontend so the backend can validate a
# voice_id hasn't been wiped out by a migration or malformed input.
# The frontend additionally lets the user pick ANY voice from their
# ElevenLabs account via /providers/tts/elevenlabs/voices — this list
# is only the "has something sensible before any user action" baseline.
ELEVENLABS_DEFAULT_VOICES: dict[str, str] = {
    "Rachel (narrator)":  "21m00Tcm4TlvDq8ikWAM",
    "Adam (male)":        "pNInz6obpgDQGcFmaJgB",
    "Bella (female)":     "EXAVITQu4vr4xnSDxMaL",
    "Antoni (fallback)":  "ErXwobaYiN019PkySvjV",
}


@dataclass
class ElevenLabsCallConfig:
    api_key: str
    voice_id: str
    base_url: str = "https://api.elevenlabs.io/v1"
    model_id: str = "eleven_multilingual_v2"


async def synthesize(cfg: ElevenLabsCallConfig, text: str) -> bytes:
    url = f"{cfg.base_url.rstrip('/')}/text-to-speech/{cfg.voice_id}"
    payload = {
        "text": text,
        "model_id": cfg.model_id,
        # Neutral defaults; emotion-stability + similarity-boost tweaks can
        # move into user prefs if demand appears.
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
        },
    }
    headers = {
        "xi-api-key": cfg.api_key,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
    }
    timeouts = httpx.Timeout(connect=10.0, read=60.0, write=15.0, pool=5.0)
    async with httpx.AsyncClient(timeout=timeouts) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            body = resp.text[:500]
            raise RuntimeError(f"ElevenLabs error {resp.status_code}: {body}")
        return resp.content


async def list_voices(api_key: str, base_url: str = "https://api.elevenlabs.io/v1") -> list[dict]:
    """GET /v1/voices — returns the user's full voice catalog
    (premades + cloned/custom). The backend proxies this so the
    user's key stays server-side.

    Shape trimmed to what the frontend picker needs.
    """
    url = f"{base_url.rstrip('/')}/voices"
    headers = {"xi-api-key": api_key, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            body = resp.text[:500]
            raise RuntimeError(f"ElevenLabs error {resp.status_code}: {body}")
        data = resp.json()
    out: list[dict] = []
    for v in data.get("voices") or []:
        labels = v.get("labels") or {}
        out.append({
            "voice_id": v.get("voice_id"),
            "name":     v.get("name"),
            "gender":   labels.get("gender"),
            "age":      labels.get("age"),
            "accent":   labels.get("accent"),
            "category": v.get("category"),
        })
    return out
