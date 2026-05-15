"""POST /character-generate — AI Generate from idea + knobs (cycle 0122).

Mirror of /character-refine but for invention-from-seed: the user provides
a free-text idea + creative knobs and the agent invents a full character.
Returns the same CharacterRefineResult shape so the frontend pipeline
(applyRefined → CharacterForm prefill) is unchanged.
"""
from __future__ import annotations

import os
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from ..agents.character_generate import CharacterGenerateCallConfig, run_character_generate
from ..deps.jwt import AuthUser, verify_supabase_jwt
from ..deps.supabase import UserSupabase

router = APIRouter()

SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")


def _user_client(authorization: str) -> UserSupabase:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    if not SUPABASE_ANON_KEY:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "SUPABASE_ANON_KEY not configured")
    return UserSupabase(jwt=token.strip(), apikey=SUPABASE_ANON_KEY)


class GenerateRequest(BaseModel):
    idea: str = Field(..., min_length=20, max_length=2000)
    drama_level: Literal["none", "light", "medium", "heavy"] = "medium"
    nsfw_allowed: bool = False
    gender_hint: Literal["any", "female", "male", "non_binary", "unspecified"] = "any"
    age_range_hint: Literal["any", "young_adult", "adult", "mid_life", "older"] = "any"
    tone_hint: Literal["any", "slice_of_life", "contemporary", "historical", "fantasy", "scifi", "surreal"] = "any"


@router.post("/character-generate")
async def character_generate(
    body: GenerateRequest,
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(default=""),
):
    sup = _user_client(authorization)

    async with httpx.AsyncClient(timeout=10.0) as client:
        providers = await sup.select(client, "provider_configs", {
            "select": "base_url,model_id",
            "kind": "eq.text",
            "is_active": "eq.true",
            "limit": "1",
        })
        if not providers:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="no_text_engine")

        api_key = await sup.rpc(client, "get_active_text_key")
        if not api_key:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="no_text_engine")

        users = await sup.select(client, "users", {
            "select": "sfw_disabled,preferences",
            "id": f"eq.{user.id}",
            "limit": "1",
        })
        urow = users[0] if users else {}
        sfw_disabled = bool(urow.get("sfw_disabled"))
        prefs = urow.get("preferences") or {}
        cc_prefs = prefs.get("character_creation") if isinstance(prefs.get("character_creation"), dict) else {}
        reasoning_enabled = bool(cc_prefs.get("reasoning_enabled", False))

    # Server-side NSFW gate: client may have sent nsfw_allowed=True, but if the
    # user hasn't opted into mature content via /settings/data-security (column
    # users.sfw_disabled), silently coerce to SFW. No 400 — softer UX. Backend
    # is source of truth.
    nsfw_effective = bool(body.nsfw_allowed) and sfw_disabled

    p = providers[0]
    cfg = CharacterGenerateCallConfig(
        base_url=str(p.get("base_url") or ""),
        api_key=str(api_key),
        model=str(p.get("model_id") or ""),
        reasoning_enabled=reasoning_enabled,
    )

    try:
        result = await run_character_generate(
            cfg,
            idea=body.idea,
            drama_level=body.drama_level,
            nsfw_allowed=nsfw_effective,
            gender_hint=body.gender_hint,
            age_range_hint=body.age_range_hint,
            tone_hint=body.tone_hint,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"llm_error: {exc}") from exc

    return result.to_dict()
