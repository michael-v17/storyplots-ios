"""Character-refinement agent — JSON-mode LLM call.

Takes a raw Tavern V1/V2/V3 character card and returns a fully-filled
CharacterDraft (personality/goals/worldbuilding deep dives, scenario,
greeting, optimized system_prompt, 11 physical attrs). Runs during import
so the user lands in the form with rich content instead of sparse heuristic
mappings.

Isolated agent per creator-vision §7: receives only the raw card + SFW flag.
Never reads Conversation state, never writes Supabase.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Literal

import httpx

_REFINE_SYSTEM = (Path(__file__).parent.parent / "prompts" / "character_refine_system.txt").read_text().strip()

_SFW_ON_LINE = (
    "Content must stay within PG-13 boundaries; avoid explicit sexual or graphic content. "
    "Emotional intensity, danger, and adult themes are fine; explicit physical description is not."
)

_SFW_OFF_LINE = (
    "Match the card's tone. Do not add explicit content the card did not invite; "
    "do not remove intensity the card established. Let the source material set the tenor."
)


@dataclass
class CharacterRefineCallConfig:
    base_url: str
    api_key: str
    model: str
    # Cycle 0114 — when True, ask the upstream to use extended reasoning for
    # the refiner call. Routed through OpenRouter / DeepSeek / Anthropic with
    # the same two keys conversation.py uses for chat thinking_mode. Has no
    # effect on providers that don't honor reasoning hints (silently ignored).
    reasoning_enabled: bool = False


@dataclass
class CharacterRefineResult:
    name: str
    tagline: str
    system_prompt: str
    personality: dict[str, str]
    goals: dict[str, str]
    worldbuilding: dict[str, str]
    scenario: str
    greeting: str
    tags: list[str]
    # Cycle 0115 — Ali:Chat voice samples; 3-5 entries with ≥1 refusal.
    dialogue_examples: list[dict[str, str]] = field(default_factory=list)
    age: str | None = None
    gender: str | None = None
    build: str | None = None
    height: str | None = None
    hair_color: str | None = None
    hair_style: str | None = None
    eye_color: str | None = None
    skin_tone: str | None = None
    distinctive_features: str | None = None
    signature_style: str | None = None
    voice_style: str | None = None
    group_members_description: str | None = None
    detected_group_size: int = 1

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _coerce_dict(d: Any, keys: tuple[str, ...]) -> dict[str, str]:
    out: dict[str, str] = {}
    if isinstance(d, dict):
        for k in keys:
            v = d.get(k)
            out[k] = str(v).strip() if isinstance(v, str) else ""
    else:
        for k in keys:
            out[k] = ""
    return out


def _coerce_str_or_none(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        return s if s else None
    return None


def _coerce_tags(v: Any) -> list[str]:
    if not isinstance(v, list):
        return []
    out: list[str] = []
    for t in v:
        if isinstance(t, str) and t.strip():
            out.append(t.strip())
    return out


def _coerce_dialogue_examples(v: Any) -> list[dict[str, str]]:
    """Cycle 0115 — accept list of {user_msg, char_reply, kind} entries.
    Drop malformed rows silently; the refiner spec requires the structure
    but we don't want a single bad row to kill the refinement."""
    if not isinstance(v, list):
        return []
    out: list[dict[str, str]] = []
    valid_kinds = {"everyday", "refusal", "unguarded"}
    for entry in v:
        if not isinstance(entry, dict):
            continue
        user_msg = entry.get("user_msg")
        char_reply = entry.get("char_reply")
        kind = entry.get("kind")
        if not isinstance(user_msg, str) or not user_msg.strip():
            continue
        if not isinstance(char_reply, str) or not char_reply.strip():
            continue
        kind_norm = kind if isinstance(kind, str) and kind in valid_kinds else "everyday"
        out.append({
            "user_msg": user_msg.strip(),
            "char_reply": char_reply.strip(),
            "kind": kind_norm,
        })
    return out


async def run_character_refine(
    cfg: CharacterRefineCallConfig,
    raw_card: dict[str, Any],
    card_format: Literal["v1", "v2", "v3"],
    sfw_disabled: bool,
    group_size: int = 1,
) -> CharacterRefineResult:
    system_prompt = _REFINE_SYSTEM
    # Inject SFW guardrail (conditional) as an additional system line.
    if sfw_disabled is False:
        system_prompt = system_prompt + "\n\n## SFW guardrail\n\n" + _SFW_ON_LINE
    else:
        system_prompt = system_prompt + "\n\n## Tone guidance\n\n" + _SFW_OFF_LINE

    user_payload = json.dumps({"format": card_format, "group_size": group_size, "card": raw_card}, ensure_ascii=False)

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
        "temperature": 0.4,
        "max_tokens": 3000,
    }
    if cfg.reasoning_enabled:
        # Mirror conversation.py:38-49 thinking_mode pattern — different upstream
        # providers honor different keys; sending both is safe.
        payload["reasoning"] = {"effort": "medium"}
        payload["reasoning_effort"] = "medium"

    # Reasoning extends the call by 10-60s depending on provider. Bump the
    # client timeout when reasoning is on (cycle 0114).
    upstream_timeout = 240.0 if cfg.reasoning_enabled else 60.0
    async with httpx.AsyncClient(timeout=upstream_timeout) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            body = resp.text[:500]
            raise RuntimeError(f"Character refiner provider error {resp.status_code}: {body}")
        data = resp.json()

    raw = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Character refiner returned non-JSON: {raw[:200]}") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError(f"Character refiner returned non-object JSON: {raw[:200]}")

    return CharacterRefineResult(
        name=str(parsed.get("name") or "").strip(),
        tagline=str(parsed.get("tagline") or "").strip(),
        system_prompt=str(parsed.get("system_prompt") or "").strip(),
        personality=_coerce_dict(parsed.get("personality"), ("core_traits", "fears_insecurities", "communication_style", "quirks_habits")),
        goals=_coerce_dict(parsed.get("goals"), ("primary_goal", "secret_desire", "fears_to_overcome", "would_sacrifice")),
        worldbuilding=_coerce_dict(parsed.get("worldbuilding"), ("origin_birthplace", "backstory", "world_setting", "special_abilities")),
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
        group_members_description=_coerce_str_or_none(parsed.get("group_members_description")),
        detected_group_size=max(1, min(4, int(parsed.get("detected_group_size") or 1))),
        dialogue_examples=_coerce_dialogue_examples(parsed.get("dialogue_examples")),
    )
