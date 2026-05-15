"""Memory extraction agent — distills recent dialogue into 0-3 discrete facts
worth remembering for future turns. JSON-mode call against the active text
engine (cycle 0029).

Isolated per creator-vision §7: receives only last N messages + character
name + SFW flag. Does not touch Conversation Agent state.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger("storyplots.memory_extract")

_EXTRACT_SYSTEM = (
    Path(__file__).parent.parent / "prompts" / "memory_extract_system.txt"
).read_text().strip()

_SFW_ON_LINE = (
    "Content must stay within PG-13 boundaries; avoid explicit sexual or "
    "graphic content when summarizing facts."
)

_SFW_OFF_LINE = (
    "Match the conversation's tone when summarizing facts. Do not add or "
    "remove intensity beyond what was established."
)


@dataclass
class MemoryExtractCallConfig:
    base_url: str
    api_key: str
    model: str  # text engine chat model


@dataclass
class ExtractedFact:
    topic: str
    fact: str
    # Cycle 0117 — doc §9.8 weight scale. 5 = first/turning point,
    # 4 = promise/boundary/strong reveal, 3 = routine, 1-2 = barely worth saving.
    significance: int = 3

    def to_dict(self) -> dict[str, Any]:
        return {"topic": self.topic, "fact": self.fact, "significance": self.significance}


def _format_turns(turns: list[dict[str, str]], character_name: str) -> str:
    """Render last-N messages as a simple transcript for the LLM."""
    lines: list[str] = []
    for t in turns:
        role = str(t.get("role") or "").lower()
        content = str(t.get("content") or "").strip()
        if not content:
            continue
        if role == "user":
            lines.append(f"USER: {content}")
        elif role == "assistant":
            lines.append(f"{character_name.upper()}: {content}")
    return "\n\n".join(lines)


async def run_memory_extract(
    cfg: MemoryExtractCallConfig,
    recent_turns: list[dict[str, str]],
    character_name: str,
    sfw_disabled: bool,
    system_prompt_override: str | None = None,
    character_description: str | None = None,
) -> list[ExtractedFact]:
    """Returns 0-3 facts from the last turns. Empty list on any failure.

    `recent_turns` is oldest → newest, [{role, content}, ...].

    When `system_prompt_override` is a non-empty string (from
    users.preferences.memory.extraction_prompt), it REPLACES the packaged
    default. Placeholders `{name}` and `{description}` in the override are
    substituted with `character_name` and a 2000-char slice of
    `character_description` (typically the character's system_prompt).
    """
    if not recent_turns:
        return []
    if not cfg.base_url or not cfg.api_key or not cfg.model:
        logger.warning("run_memory_extract: missing provider config")
        return []

    template = (system_prompt_override or "").strip() or _EXTRACT_SYSTEM
    description = (character_description or "")[:2000]
    system_prompt = (
        template
        .replace("{name}", character_name or "the character")
        .replace("{description}", description)
    )
    system_prompt += "\n\n## Tone\n\n" + (_SFW_OFF_LINE if sfw_disabled else _SFW_ON_LINE)

    user_payload = _format_turns(recent_turns, character_name or "character")
    if not user_payload.strip():
        return []

    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": cfg.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_payload},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
        "max_tokens": 500,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                logger.warning("run_memory_extract: provider %s: %s", resp.status_code, resp.text[:200])
                return []
            data = resp.json()
    except Exception as exc:
        logger.warning("run_memory_extract: request failed: %s", exc)
        return []

    try:
        raw = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
        parsed = json.loads(raw)
    except Exception as exc:
        logger.warning("run_memory_extract: parse failed: %s", exc)
        return []

    raw_facts = parsed.get("facts") if isinstance(parsed, dict) else None
    if not isinstance(raw_facts, list):
        return []

    out: list[ExtractedFact] = []
    valid_topics = {"event", "action", "promise", "fact", "relationship", "boundary"}
    for item in raw_facts[:3]:
        if not isinstance(item, dict):
            continue
        topic = str(item.get("topic") or "").strip()
        if topic not in valid_topics:
            topic = "fact"
        fact = str(item.get("fact") or "").strip()
        if not fact:
            continue
        # Cycle 0117 — parse significance with clamping to 1..5; default 3.
        sig_raw = item.get("significance")
        try:
            sig = int(sig_raw) if sig_raw is not None else 3
        except (TypeError, ValueError):
            sig = 3
        sig = max(1, min(5, sig))
        out.append(ExtractedFact(topic=topic, fact=fact, significance=sig))
    return out
