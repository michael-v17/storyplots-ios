"""Supabase JWT verification.

product.md §9: "Auth is Supabase JWT only. FastAPI validates against
Supabase's public key. No custom token emission."

Supports both signing modes Supabase emits locally:
  * Asymmetric (RS256/ES256) — verified against JWKS at
    ${SUPABASE_URL}/auth/v1/.well-known/jwks.json, cached for 10 min.
  * Symmetric (HS256) — verified against SUPABASE_JWT_SECRET.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient

SUPABASE_URL = os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
JWKS_TTL_SECONDS = 600

_jwks_client: PyJWKClient | None = None
_jwks_client_loaded_at: float = 0.0


def _get_jwks_client() -> PyJWKClient | None:
    """Return a cached PyJWKClient, or None if JWKS is unreachable/empty."""
    global _jwks_client, _jwks_client_loaded_at
    now = time.monotonic()
    if _jwks_client is not None and (now - _jwks_client_loaded_at) < JWKS_TTL_SECONDS:
        return _jwks_client
    try:
        resp = httpx.get(JWKS_URL, timeout=5.0)
        resp.raise_for_status()
        if not resp.json().get("keys"):
            return None
        _jwks_client = PyJWKClient(JWKS_URL, cache_keys=True, lifespan=JWKS_TTL_SECONDS)
        _jwks_client_loaded_at = now
        return _jwks_client
    except (httpx.HTTPError, ValueError):
        return None


@dataclass(frozen=True)
class AuthUser:
    id: str
    claims: dict[str, Any]


def _decode(token: str) -> dict[str, Any]:
    headers = jwt.get_unverified_header(token)
    alg = headers.get("alg")

    if alg and alg.startswith(("RS", "ES", "PS")):
        client = _get_jwks_client()
        if client is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "JWKS unavailable")
        key = client.get_signing_key_from_jwt(token).key
        return jwt.decode(token, key, algorithms=[alg], audience="authenticated")

    if alg == "HS256":
        if not SUPABASE_JWT_SECRET:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "SUPABASE_JWT_SECRET not set")
        return jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")

    raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Unsupported alg: {alg}")


def verify_supabase_jwt(authorization: str | None = Header(default=None)) -> AuthUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = _decode(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {exc}") from exc
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing sub")
    return AuthUser(id=sub, claims=claims)


CurrentUser = Depends(verify_supabase_jwt)
