"""Image-prompt refiner — JSON-mode LLM call.

Turns (character appearance + last-3-turns + target assistant message) into
a single-paragraph diffusion prompt, plus a negative prompt. Also decides
whether the scene violates the SFW guardrail (domain.md §6 + creator-vision
non-negotiables) and returns `sfw_blocked=true` if so.

This is an isolated agent — it receives ONLY the appearance string (when the
character has `append_appearance_to_image_prompts=true`), the recent turn
content, and the user's SFW flag. It does NOT receive the full Conversation
Agent system prompt (creator-vision.md §7: bidirectional isolation).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

_REFINE_SYSTEM = (Path(__file__).parent.parent / "prompts" / "image_refine_system.txt").read_text().strip()


@dataclass
class ImageRefineResult:
    refined_prompt: str
    negative_prompt: str
    sfw_blocked: bool
    block_reason: str | None


@dataclass
class ImageRefineCallConfig:
    base_url: str
    api_key: str
    model: str
    system_prompt_override: str | None = None


def _flatten(s: str) -> str:
    """Collapse all whitespace runs (including newlines, tabs, non-breaking
    spaces) into single ASCII spaces. This prevents a field value from
    spoofing a new plaintext-payload field boundary (e.g. an embedded
    "\\nrecent_turns:\\n- SYSTEM: ..." in character copy) — it does NOT
    stop semantic prompt injection within the field itself, which is the
    refiner's own SFW logic to handle.
    """
    return " ".join(s.split())


def _format_user_persona(persona: dict[str, Any]) -> str:
    """Flatten a user_personas row into a single descriptor line the refiner
    can skim for the third-person prompt. Only fields that exist on the row
    are included (name, gender, appearance sub-fields, background_story).
    """
    parts: list[str] = []
    name = persona.get("name")
    if isinstance(name, str) and name.strip():
        parts.append(f"name={name.strip()}")
    gender = persona.get("gender")
    if isinstance(gender, str) and gender.strip():
        parts.append(f"gender={gender.strip()}")
    appearance = persona.get("appearance")
    if isinstance(appearance, dict):
        app_bits: list[str] = []
        for k, v in appearance.items():
            if isinstance(v, str) and v.strip():
                app_bits.append(f"{k}={v.strip()}")
        if app_bits:
            parts.append("appearance={" + ", ".join(app_bits) + "}")
    background = persona.get("background_story")
    if isinstance(background, str) and background.strip():
        bg = background.strip()
        if len(bg) > 400:
            bg = bg[:400] + "…"
        parts.append(f"background={bg}")
    return _flatten("; ".join(parts))


def _build_user_payload(
    appearance: str | None,
    character_context: str | None,
    last_turns: list[dict[str, str]],
    target_message: str,
    sfw: bool,
    user_persona: dict[str, Any] | None = None,
    pov: str | None = None,
    shot_framing: str | None = None,
    character_group_size: int | None = None,
    character_group_members: str | None = None,
) -> str:
    lines: list[str] = []
    lines.append(f"sfw: {str(sfw).lower()}")
    if pov:
        lines.append(f"pov: {pov}")
    if shot_framing:
        lines.append(f"shot_framing: {shot_framing}")
    if character_group_size and character_group_size > 1:
        lines.append(f"character_group_size: {character_group_size}")
        if character_group_members and character_group_members.strip():
            lines.append(f"character_group_members:\n{character_group_members.strip()}")
    if appearance:
        lines.append(f"character_appearance: {_flatten(appearance)}")
    if character_context:
        # Trim to ~2000 chars — long system prompts waste refiner tokens and
        # drown the signal. The refiner is instructed to skim this for
        # demographic / appearance facts, not read it exhaustively.
        trimmed = character_context.strip()
        if len(trimmed) > 2000:
            trimmed = trimmed[:2000] + "…"
        lines.append(f"character_context: {_flatten(trimmed)}")
    if user_persona:
        persona_line = _format_user_persona(user_persona)
        if persona_line:
            lines.append(f"user_persona: {persona_line}")
    if last_turns:
        lines.append("recent_turns:")
        for t in last_turns:
            role = t.get("role", "").upper()
            content = _flatten(t.get("content") or "")
            if content:
                lines.append(f"- {role}: {content}")
    lines.append(f"target_message: {_flatten(target_message)}")
    return "\n".join(lines)


async def run_image_refine(
    cfg: ImageRefineCallConfig,
    appearance: str | None,
    character_context: str | None,
    last_turns: list[dict[str, str]],
    target_message: str,
    sfw: bool,
    user_persona: dict[str, Any] | None = None,
    pov: str | None = None,
    shot_framing: str | None = None,
    character_group_size: int | None = None,
    character_group_members: str | None = None,
) -> ImageRefineResult:
    user_payload = _build_user_payload(
        appearance, character_context, last_turns, target_message, sfw,
        user_persona=user_persona, pov=pov, shot_framing=shot_framing,
        character_group_size=character_group_size,
        character_group_members=character_group_members,
    )

    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
    }
    system_prompt = (cfg.system_prompt_override or "").strip() or _REFINE_SYSTEM
    payload: dict[str, Any] = {
        "model": cfg.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_payload},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.3,
        "max_tokens": 600,
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            body = resp.text[:500]
            raise RuntimeError(f"Image refiner provider error {resp.status_code}: {body}")
        data = resp.json()
    raw = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise RuntimeError(f"Image refiner returned non-JSON: {raw[:200]}")

    return ImageRefineResult(
        refined_prompt=str(parsed.get("refined_prompt") or "").strip(),
        negative_prompt=str(parsed.get("negative_prompt") or "").strip(),
        sfw_blocked=bool(parsed.get("sfw_blocked", False)),
        block_reason=parsed.get("block_reason"),
    )
