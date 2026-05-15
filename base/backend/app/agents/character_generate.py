"""Character generation agent (cycle 0122).

Distinct from character_refine (cycle 0114): given a natural-language seed
idea + creative knobs (drama, tone, NSFW, gender/age hints), produces a
full character JSON from scratch. The user has no existing draft.

Returns the same `CharacterRefineResult` shape so downstream frontend
pipelines (CharacterForm + mergeRefinedIntoDraft) work unchanged.

Isolated agent per creator-vision §7: reads only the idea + knobs + SFW
flag + reasoning toggle. Never reads conversation state, never writes
Supabase.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import httpx

# Reuse the result type + coerce helpers from the refiner — same JSON shape
# means same parsing logic.
from .character_refine import (
    CharacterRefineResult,
    _coerce_dialogue_examples,
    _coerce_dict,
    _coerce_str_or_none,
    _coerce_tags,
)

logger = logging.getLogger(__name__)

_GENERATE_SYSTEM = (Path(__file__).parent.parent / "prompts" / "character_generate_system.txt").read_text().strip()


@dataclass
class CharacterGenerateCallConfig:
    base_url: str
    api_key: str
    model: str
    reasoning_enabled: bool = False  # mirror cycle 0114 toggle


DramaLevel = Literal["none", "light", "medium", "heavy"]
GenderHint = Literal["any", "female", "male", "non_binary", "unspecified"]
AgeRangeHint = Literal["any", "young_adult", "adult", "mid_life", "older"]
ToneHint = Literal["any", "slice_of_life", "contemporary", "historical", "fantasy", "scifi", "surreal"]


def _format_knobs(
    drama_level: DramaLevel,
    nsfw_allowed: bool,
    gender_hint: GenderHint,
    age_range_hint: AgeRangeHint,
    tone_hint: ToneHint,
) -> str:
    """Render the user's knob selections as readable lines for the model.
    Knobs are hints; the prompt instructs that the idea wins on contradictions."""
    age_labels = {
        "young_adult": "18–25",
        "adult": "25–40",
        "mid_life": "40–60",
        "older": "60+",
    }
    lines = [
        f"drama_level: {drama_level}",
        f"nsfw_allowed: {str(nsfw_allowed).lower()}",
    ]
    if tone_hint != "any":
        lines.append(f"tone_hint: {tone_hint}")
    if gender_hint != "any":
        lines.append(f"gender_hint: {gender_hint}")
    if age_range_hint != "any":
        lines.append(f"age_range_hint: {age_range_hint} ({age_labels[age_range_hint]})")
    return "\n".join(lines)


async def run_character_generate(
    cfg: CharacterGenerateCallConfig,
    idea: str,
    drama_level: DramaLevel,
    nsfw_allowed: bool,
    gender_hint: GenderHint = "any",
    age_range_hint: AgeRangeHint = "any",
    tone_hint: ToneHint = "any",
) -> CharacterRefineResult:
    """Generate a character from a free-text seed + knobs.

    Returns a CharacterRefineResult so the frontend can reuse the same
    apply / merge pipeline. detected_group_size is always 1 in this flow.
    """
    if not idea or not idea.strip():
        raise ValueError("idea is required")

    knobs_block = _format_knobs(drama_level, nsfw_allowed, gender_hint, age_range_hint, tone_hint)
    user_payload = (
        "Knobs (hints; the idea text below wins on direct contradictions):\n"
        f"{knobs_block}\n\n"
        "Seed idea (the user's free-text description):\n"
        f"{idea.strip()}"
    )

    system_prompt = _GENERATE_SYSTEM

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
        "temperature": 0.7,  # higher than refiner — more inventive
        "max_tokens": 3500,
    }
    if cfg.reasoning_enabled:
        payload["reasoning"] = {"effort": "medium"}
        payload["reasoning_effort"] = "medium"

    # Reasoning extends call latency 10-60s. Bump timeout when on.
    upstream_timeout = 240.0 if cfg.reasoning_enabled else 90.0
    async with httpx.AsyncClient(timeout=upstream_timeout) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            body = resp.text[:500]
            raise RuntimeError(f"Character generator provider error {resp.status_code}: {body}")
        data = resp.json()

    raw = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Character generator returned non-JSON: {raw[:200]}") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError(f"Character generator returned non-object JSON: {raw[:200]}")

    return CharacterRefineResult(
        name=str(parsed.get("name") or "").strip(),
        tagline=str(parsed.get("tagline") or "").strip(),
        system_prompt=str(parsed.get("system_prompt") or "").strip(),
        personality=_coerce_dict(parsed.get("personality"),
                                  ("core_traits", "fears_insecurities", "communication_style", "quirks_habits")),
        goals=_coerce_dict(parsed.get("goals"),
                            ("primary_goal", "secret_desire", "fears_to_overcome", "would_sacrifice")),
        worldbuilding=_coerce_dict(parsed.get("worldbuilding"),
                                    ("origin_birthplace", "backstory", "world_setting", "special_abilities")),
        scenario=str(parsed.get("scenario") or "").strip(),
        greeting=str(parsed.get("greeting") or "").strip(),
        tags=_coerce_tags(parsed.get("tags")),
        age=_coerce_str_or_none(parsed.get("age")),
        gender=_coerce_str_or_none(parsed.get("gender")),
        build=_coerce_str_or_none(parsed.get("build")),
        height=_coerce_str_or_none(parsed.get("height")),
        hair_color=_coerce_str_or_none(parsed.get("hair_color")),
        hair_style=_coerce_str_or_none(parsed.get("hair_style")),
        eye_color=_coerce_str_or_none(parsed.get("eye_color")),
        skin_tone=_coerce_str_or_none(parsed.get("skin_tone")),
        distinctive_features=_coerce_str_or_none(parsed.get("distinctive_features")),
        signature_style=_coerce_str_or_none(parsed.get("signature_style")),
        voice_style=_coerce_str_or_none(parsed.get("voice_style")),
        group_members_description=None,  # single-character flow only
        detected_group_size=1,
        dialogue_examples=_coerce_dialogue_examples(parsed.get("dialogue_examples")),
    )
