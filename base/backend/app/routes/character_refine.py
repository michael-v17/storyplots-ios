"""POST /character-refine — Character Import Refiner (cycle 0027).

Takes a raw Tavern V1/V2/V3 character card as JSON and asks the user's
active text engine to produce a fully-filled CharacterDraft. Meant to run
after the client-side parseCharacterCard so the user lands in the form
with rich, connected content instead of sparse heuristic mappings.

Isolated agent per creator-vision §7. Does not touch Conversation state.
"""

from __future__ import annotations

import os
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from ..agents.character_refine import CharacterRefineCallConfig, run_character_refine
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


class RefineRequest(BaseModel):
    raw_card: dict[str, Any] = Field(...)
    format: Literal["v1", "v2", "v3"]
    group_size: int = Field(default=1, ge=1, le=4)


@router.post("/character-refine")
async def character_refine(
    body: RefineRequest,
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
        # Cycle 0114 — read users.preferences.character_creation.reasoning_enabled
        # with coalesce defaults. Missing key → reasoning off (same provider
        # behavior as pre-cycle).
        prefs = urow.get("preferences") or {}
        cc_prefs = prefs.get("character_creation") if isinstance(prefs.get("character_creation"), dict) else {}
        reasoning_enabled = bool(cc_prefs.get("reasoning_enabled", False))

    p = providers[0]
    cfg = CharacterRefineCallConfig(
        base_url=str(p.get("base_url") or ""),
        api_key=str(api_key),
        model=str(p.get("model_id") or ""),
        reasoning_enabled=reasoning_enabled,
    )

    try:
        result = await run_character_refine(cfg, body.raw_card, body.format, sfw_disabled, body.group_size)
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"llm_error: {exc}") from exc

    return result.to_dict()
