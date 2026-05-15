"""Thin PostgREST client keyed on the caller's Supabase JWT.

Each request gets its own ``UserSupabase`` instance — the JWT is passed
on every call so RLS + SECURITY DEFINER functions enforce isolation
without the backend ever needing a service-role key.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")


@dataclass
class UserSupabase:
    jwt: str
    apikey: str  # publishable / anon key — required by PostgREST even with a bearer JWT

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.jwt}",
            "apikey": self.apikey,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def rpc(self, client: httpx.AsyncClient, name: str, args: dict[str, Any] | None = None) -> Any:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/rpc/{name}",
            headers=self._headers(),
            json=args or {},
        )
        r.raise_for_status()
        return r.json() if r.content else None

    async def select(
        self,
        client: httpx.AsyncClient,
        table: str,
        params: dict[str, str],
    ) -> list[dict[str, Any]]:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers=self._headers(),
            params=params,
        )
        r.raise_for_status()
        return r.json()

    async def insert(
        self,
        client: httpx.AsyncClient,
        table: str,
        row: dict[str, Any],
    ) -> dict[str, Any]:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers={**self._headers(), "Prefer": "return=representation"},
            json=row,
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if isinstance(rows, list) else rows

    async def update(
        self,
        client: httpx.AsyncClient,
        table: str,
        filter_params: dict[str, str],
        patch: dict[str, Any],
    ) -> dict[str, Any] | None:
        r = await client.patch(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers={**self._headers(), "Prefer": "return=representation"},
            params=filter_params,
            json=patch,
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    async def upload_bytes(
        self,
        client: httpx.AsyncClient,
        bucket: str,
        path: str,
        content: bytes,
        content_type: str,
    ) -> None:
        """Upload raw bytes to a Supabase storage bucket under the caller's JWT.

        RLS on storage.objects is enforced the same way as on public tables.
        For per-user isolation, callers MUST include the user id as the first
        path segment (e.g. `{uid}/...`) so the bucket policy permits the write.
        """
        r = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}",
            headers={
                "Authorization": f"Bearer {self.jwt}",
                "apikey": self.apikey,
                "Content-Type": content_type,
            },
            content=content,
        )
        r.raise_for_status()

    async def remove_object(
        self,
        client: httpx.AsyncClient,
        bucket: str,
        path: str,
    ) -> None:
        """Best-effort delete of a storage object. Missing object is not an
        error (returns 200/404 → both treated as "gone")."""
        r = await client.delete(
            f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}",
            headers={
                "Authorization": f"Bearer {self.jwt}",
                "apikey": self.apikey,
            },
        )
        if r.status_code not in (200, 204, 404):
            r.raise_for_status()

    async def delete(
        self,
        client: httpx.AsyncClient,
        table: str,
        filter_params: dict[str, str],
    ) -> None:
        r = await client.delete(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers=self._headers(),
            params=filter_params,
        )
        r.raise_for_status()

    async def create_signed_url(
        self,
        client: httpx.AsyncClient,
        bucket: str,
        path: str,
        expires_in: int = 60 * 60,
    ) -> str:
        """Create a signed URL for a private Storage object. RLS still
        applies — the caller's JWT must permit a SELECT on
        storage.objects for the row. Used by Cycle 0094 to hand a
        public-readable reference image URL to fal.ai's /edit endpoint
        (fal's CDN dereferences it once at gen time, then caches its
        own copy).
        """
        r = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/sign/{bucket}/{path}",
            headers={
                "Authorization": f"Bearer {self.jwt}",
                "apikey": self.apikey,
                "Content-Type": "application/json",
            },
            json={"expiresIn": expires_in},
        )
        r.raise_for_status()
        body = r.json()
        signed = body.get("signedURL") or body.get("signedUrl")
        if not signed:
            raise RuntimeError(f"create_signed_url: missing signedURL in response: {body}")
        # Supabase returns a relative path under /storage/v1; prepend host.
        if signed.startswith("/"):
            signed = f"{SUPABASE_URL}/storage/v1{signed}"
        return signed
