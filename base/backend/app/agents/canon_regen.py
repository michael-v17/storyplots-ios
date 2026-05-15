"""Character canon regeneration agent (cycle 0119 — audit doc §9.5).

Reads the user's T1 character_memories and produces a short in-character
prose summary of "where we are now" with this character. Stored at
character_canon for retrieval at session-resume time.

Isolated agent per creator-vision §7: receives only the character snapshot
+ user persona + T1 memories. Never touches Supabase or conversation state.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)


@dataclass
class CanonRegenCallConfig:
    base_url: str
    api_key: str
    model: str


_SYSTEM = (
    "You are an in-character summarization agent. Read the memories below and "
    "write a short prose narrative — 2-3 paragraphs, no more than 220 words "
    "total — describing where the relationship between {name} and the user "
    "stands right now.\n"
    "\n"
    "Write in {name}'s voice. First person. The 'I' is {name}. The 'they' or "
    "'the user' is the user. Tone: how {name} would describe it to themselves, "
    "not how a third party would record it.\n"
    "\n"
    "Anchor every claim in the memories provided. Do NOT invent events that "
    "are not in the memories. If a particular memory is a promise or boundary, "
    "name it concretely — those are reference points that should survive into "
    "any future scene. Mood at the end of the most recent memories matters: "
    "name where things stand emotionally, even briefly.\n"
    "\n"
    "Output: prose only. No headings. No bullet points. No JSON. Plain text. "
    "Do not write 'Dear reader' or address anyone — this is {name}'s internal "
    "summary of the relationship."
)


async def run_canon_regen(
    cfg: CanonRegenCallConfig,
    character_name: str,
    memories: list[dict[str, Any]],
) -> str | None:
    """Return a fresh canon string, or None on any failure."""
    if not memories:
        return None
    if not cfg.base_url or not cfg.api_key or not cfg.model:
        return None

    system_prompt = _SYSTEM.replace("{name}", character_name or "the character")

    # Format memories oldest-first so the narrative arc reads naturally.
    lines: list[str] = []
    for m in memories:
        topic = m.get("topic") or "fact"
        sig = m.get("significance") or 3
        content = (m.get("content") or "").strip()
        if not content:
            continue
        lines.append(f"[{topic}, significance {sig}] {content}")
    user_payload = "Memories (oldest first):\n\n" + "\n".join(lines)

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
        "temperature": 0.4,
        "max_tokens": 600,
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                logger.warning("canon_regen: provider %s: %s", resp.status_code, resp.text[:200])
                return None
            data = resp.json()
    except Exception as exc:
        logger.warning("canon_regen: request failed: %s", exc)
        return None

    try:
        text = data["choices"][0]["message"]["content"]
    except Exception:
        return None
    text = (text or "").strip()
    if not text:
        return None
    return text
