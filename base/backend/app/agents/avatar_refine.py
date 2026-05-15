"""Avatar background refiner — JSON-mode LLM call.

Cycle 0048. Small LLM pass that turns a character's narrative context
(`system_prompt` + personality + goals + worldbuilding + scenario) into
4–8 Danbooru-style background / setting / lighting tags. Invoked by
`routes/avatar_generate.py` so character portraits show the world the
character belongs in instead of a flat `simple_background`.

Reuses `ImageRefineCallConfig` (base_url + api_key + model) to avoid
duplicating HTTP scaffolding. System prompt lives in
`prompts/avatar_refine_system.txt`.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

from .image_refine import ImageRefineCallConfig

_AVATAR_REFINE_SYSTEM = (
    Path(__file__).parent.parent / "prompts" / "avatar_refine_system.txt"
).read_text().strip()


@dataclass
class AvatarBackgroundResult:
    tags: list[str]
    block_reason: str | None


def _flatten(s: str) -> str:
    return " ".join(s.split())


async def run_avatar_background_refine(
    cfg: ImageRefineCallConfig,
    character_context: str,
) -> AvatarBackgroundResult:
    """Return a short list of background / setting / lighting tags.

    Empty list + a reason when the context is too sparse to infer a
    setting. Never raises for LLM-content issues; the caller handles
    empty-tag fallback. Raises only for HTTP / config failures.
    """
    ctx = _flatten(character_context or "").strip()
    if len(ctx) > 2000:
        ctx = ctx[:2000] + "…"
    if not ctx:
        return AvatarBackgroundResult(tags=[], block_reason="empty context")

    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": cfg.model,
        "messages": [
            {"role": "system", "content": _AVATAR_REFINE_SYSTEM},
            {"role": "user", "content": f"character_context:\n{ctx}"},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.4,
        "max_tokens": 200,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            raise RuntimeError(
                f"Avatar refiner provider error {resp.status_code}: {resp.text[:300]}"
            )
        data = resp.json()

    raw = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # The caller will fall back; don't blow up the avatar flow for a
        # malformed JSON response.
        return AvatarBackgroundResult(tags=[], block_reason="invalid_json")

    raw_tags = parsed.get("tags") or []
    tags: list[str] = []
    if isinstance(raw_tags, list):
        for t in raw_tags:
            if isinstance(t, str):
                cleaned = t.strip().lower().replace(" ", "_")
                if cleaned and cleaned not in tags:
                    tags.append(cleaned)
    # Soft cap: the prompt says ≤8, enforce it defensively.
    tags = tags[:8]

    block_reason = parsed.get("block_reason")
    if not isinstance(block_reason, str) or not block_reason.strip():
        block_reason = None

    return AvatarBackgroundResult(tags=tags, block_reason=block_reason)
