"""OpenAI TTS adapter.

POST /v1/audio/speech with model=tts-1 (cheapest, $15/1M chars) and the
user-chosen voice. Returns MP3 bytes. See https://platform.openai.com/docs/
api-reference/audio/createSpeech — the REST shape mirrors the text
provider, so this adapter is intentionally tiny.

Dual-voice routing (splitting italic narration from quoted dialogue) is
deferred to cycle 0018 along with ElevenLabs + WebSpeech. For 0017 the
whole text is read with one voice.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import httpx

# OpenAI's closed set of standard voices. Keep in sync with the picker in
# frontend/src/routes/TextToSpeechSettings.tsx.
OPENAI_VOICES = ("alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer")

# `[image: tags]` tag stripped before synth so TTS doesn't pronounce the tag
# emitted by Visual Roleplay auto-mode (cycle 0016). Mirrors the JS
# extractImageTag tail-anchored regex — we accept a trailing newline or two.
_IMAGE_TAG_TAIL = re.compile(r"\[image:\s*[^\]]+?\s*\]\s*$", re.IGNORECASE)
_IMAGE_TAG_ANY = re.compile(r"\[image:\s*[^\]]+?\s*\]", re.IGNORECASE)


def strip_image_tag(text: str) -> str:
    """Same contract as the frontend's extractImageTag().stripped."""
    if not text:
        return ""
    m = _IMAGE_TAG_TAIL.search(text)
    if m:
        return text[: m.start()].rstrip()
    m = _IMAGE_TAG_ANY.search(text)
    if m:
        cleaned = text[: m.start()] + text[m.end() :]
        return re.sub(r"[ \t]+\n", "\n", cleaned).rstrip()
    return text


@dataclass
class TTSCallConfig:
    api_key: str
    voice_id: str
    base_url: str = "https://api.openai.com/v1"
    model: str = "tts-1"


async def synthesize(cfg: TTSCallConfig, text: str) -> bytes:
    url = cfg.base_url.rstrip("/") + "/audio/speech"
    payload = {
        "model": cfg.model,
        "voice": cfg.voice_id,
        "input": text,
        "response_format": "mp3",
    }
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
    }
    # 60s read: a 1000-char reply synthesizes in ~2-5s over LAN, but we keep
    # headroom for slow connections. Connect timeout stays short.
    timeouts = httpx.Timeout(connect=10.0, read=60.0, write=15.0, pool=5.0)
    async with httpx.AsyncClient(timeout=timeouts) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            body = resp.text[:500]
            raise RuntimeError(f"TTS provider error {resp.status_code}: {body}")
        return resp.content
