"""Memory Engine provider routes (cycle 0029).

Mirrors the Text Engine / Image Engine pattern:
  GET  /providers/embedding             → current active embedding config (no api_key)
  POST /providers/embedding/test        → reachability probe with just-typed credentials
  POST /providers/embedding/test-saved  → probe the saved key from Vault (cycle 0111)

The Memory Engine is a dedicated BYOK provider kind ('embedding') so the
server stays light — no local ML deps. Default family is OpenAI
(text-embedding-3-small, 1536-dim) but architecture is open.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel

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


class TestEmbeddingRequest(BaseModel):
    base_url: str
    api_key: str
    model: str


class TestEmbeddingResult(BaseModel):
    ok: bool
    status: int | None = None
    error: str | None = None
    dimension: int | None = None


@router.get("/providers/embedding")
async def get_embedding_provider(
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(default=""),
) -> dict[str, Any] | None:
    del user
    sup = _user_client(authorization)
    async with httpx.AsyncClient(timeout=10.0) as client:
        rows = await sup.select(client, "provider_configs", {
            "select": "id,provider_family,base_url,model_id,is_active,last_tested_ok,last_tested_at",
            "kind": "eq.embedding",
            "is_active": "eq.true",
            "limit": "1",
        })
    return rows[0] if rows else None


@router.post("/providers/embedding/test", response_model=TestEmbeddingResult)
async def test_embedding_provider(
    body: TestEmbeddingRequest,
    user: AuthUser = Depends(verify_supabase_jwt),
) -> TestEmbeddingResult:
    del user
    if not body.base_url or not body.api_key or not body.model:
        return TestEmbeddingResult(ok=False, error="base_url, api_key, and model are all required")

    url = body.base_url.rstrip("/") + "/embeddings"
    headers = {
        "Authorization": f"Bearer {body.api_key}",
        "Content-Type": "application/json",
    }
    payload = {"model": body.model, "input": "ok"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
    except Exception as exc:
        return TestEmbeddingResult(ok=False, error=str(exc))

    if resp.status_code != 200:
        return TestEmbeddingResult(ok=False, status=resp.status_code, error=resp.text[:200])

    try:
        data = resp.json()
        vec = (data.get("data") or [{}])[0].get("embedding") or []
        return TestEmbeddingResult(ok=True, status=200, dimension=len(vec) if isinstance(vec, list) else None)
    except Exception as exc:
        return TestEmbeddingResult(ok=False, status=200, error=f"response parse failed: {exc}")


@router.post("/providers/embedding/test-saved", response_model=TestEmbeddingResult)
async def test_saved_embedding_provider(
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(default=""),
) -> TestEmbeddingResult:
    """Probe the saved Memory Engine key from Vault (cycle 0111 parity with /providers/test)."""
    del user
    sup = _user_client(authorization)
    async with httpx.AsyncClient(timeout=10.0) as client:
        rows = await sup.select(client, "provider_configs", {
            "select": "id,base_url,model_id",
            "kind": "eq.embedding",
            "is_active": "eq.true",
            "limit": "1",
        })
        if not rows:
            return TestEmbeddingResult(ok=False, error="no stored key")
        provider = rows[0]
        api_key = await sup.rpc(client, "get_active_embedding_key")
        if not api_key:
            return TestEmbeddingResult(ok=False, error="no stored key")

        base_url = provider.get("base_url") or ""
        model = provider.get("model_id") or ""
        if not base_url or not model:
            return TestEmbeddingResult(ok=False, error="saved provider missing base_url or model")

        url = base_url.rstrip("/") + "/embeddings"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {"model": model, "input": "ok"}
        try:
            resp = await client.post(url, headers=headers, json=payload)
        except Exception as exc:
            result = TestEmbeddingResult(ok=False, error=str(exc))
        else:
            if resp.status_code != 200:
                result = TestEmbeddingResult(ok=False, status=resp.status_code, error=resp.text[:200])
            else:
                try:
                    data = resp.json()
                    vec = (data.get("data") or [{}])[0].get("embedding") or []
                    result = TestEmbeddingResult(
                        ok=True,
                        status=200,
                        dimension=len(vec) if isinstance(vec, list) else None,
                    )
                except Exception as exc:
                    result = TestEmbeddingResult(ok=False, status=200, error=f"response parse failed: {exc}")

        await sup.update(
            client,
            "provider_configs",
            {"id": f"eq.{provider['id']}"},
            {
                "last_tested_ok": bool(result.ok),
                "last_tested_at": datetime.now(timezone.utc).isoformat(),
            },
        )
    return result
