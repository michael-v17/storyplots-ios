"""
Cycle 0094 — fal.ai Storage backfill sweeper.

The dual-store strategy decided 2026-05-05: every fal chat-scene gen
returns the row IMMEDIATELY with the fal CDN URL captured in
`generated_images.external_url`, leaving `storage_ref` NULL. The
frontend renders straight from the CDN for the first 24h (zero
Supabase Egress during the period the user is most likely to read
the chat). After that window the frontend falls back to a signed
Storage URL — which only works if this sweeper has populated
`storage_ref` first.

Job: find rows where engine='fal' AND storage_ref IS NULL, download
from `external_url`, compress with the same Cycle 0092 helper the
sync paths use, upload to Storage, set storage_ref + bytes_size on
the row. Idempotent: if a previous run set storage_ref, the WHERE
filter skips the row.

Cron-friendly. Run every 30-60 minutes; the 24h dual-store window
gives plenty of slack. If a fal CDN URL expires before the sweeper
processes it, the row stays storage_ref=NULL and the frontend's
<img onError> fallback kicks in (placeholder + regenerate hint).

Usage:

    set -a && source .env.local && set +a
    cd backend && uv run python ../scripts/storage_backfill.py             # dry-run
    cd backend && uv run python ../scripts/storage_backfill.py --apply

The `cd backend && uv run` form pulls in the backend venv where
Pillow + supabase + httpx already live; the script imports
compress_for_storage from app.lib.image_compress so the sync and
async paths produce identical WebP output.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

# Make the backend package importable when this script is run from
# anywhere (e.g. cron). When invoked as `cd backend && uv run python
# ../scripts/...`, `app` is already on sys.path; the insert is a no-op
# in that case but matters for direct invocations.
_BACKEND = Path(__file__).resolve().parent.parent / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

import httpx  # noqa: E402
from supabase import create_client  # noqa: E402

from app.lib.image_compress import compress_for_storage  # noqa: E402


_DOWNLOAD_TIMEOUT_S = 60.0


def fetch_pending_batch(sb: Any, limit: int) -> list[dict[str, Any]]:
    """Pick rows that need backfilling. Order by capture time so the
    oldest (closest-to-CDN-expiry) get processed first.
    """
    resp = (
        sb.table("generated_images")
        .select("id,user_id,external_url,external_url_captured_at,bucket")
        .eq("engine", "fal")
        .is_("storage_ref", "null")
        .not_.is_("external_url", "null")
        .order("external_url_captured_at", desc=False)
        .limit(limit)
        .execute()
    )
    return list(resp.data or [])


def download_image(url: str) -> bytes:
    """Synchronous httpx GET. The sweeper is run as a single-process
    cron job — no asyncio event loop to worry about; httpx's sync
    client suffices and is simpler to reason about.
    """
    with httpx.Client(timeout=_DOWNLOAD_TIMEOUT_S) as c:
        r = c.get(url)
        r.raise_for_status()
        return r.content


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill Storage from fal.ai CDN URLs (cycle 0094 dual-store sweeper).",
    )
    parser.add_argument("--batch", type=int, default=25,
                        help="Max rows to process per pass (default 25 — keeps memory bounded).")
    parser.add_argument("--max-passes", type=int, default=20,
                        help="Stop after N passes (default 20 → 500 rows max per run).")
    parser.add_argument("--apply", action="store_true",
                        help="Actually download / compress / upload / update. Without this flag the sweep is read-only — useful for sanity checking row counts.")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress per-row log lines.")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env.", file=sys.stderr)
        return 2

    sb = create_client(url, service_key)

    total_seen = 0
    total_uploaded = 0
    total_skipped = 0
    total_failed = 0

    for pass_idx in range(args.max_passes):
        rows = fetch_pending_batch(sb, args.batch)
        if not rows:
            break
        total_seen += len(rows)
        if not args.quiet:
            print(f"pass={pass_idx} pending={len(rows)}")

        for row in rows:
            row_id = row["id"]
            ext_url = row.get("external_url")
            user_id = row.get("user_id")
            bucket = row.get("bucket") or "generated-media"

            if not ext_url or not user_id:
                if not args.quiet:
                    print(f"  skip id={row_id}: missing external_url or user_id")
                total_skipped += 1
                continue

            if not args.apply:
                if not args.quiet:
                    print(f"  DRY id={row_id} → would download + compress + upload")
                continue

            try:
                raw_bytes = download_image(ext_url)
                compressed = compress_for_storage(raw_bytes, kind="scene")
                storage_ref = f"{user_id}/{row_id}.webp"
                upload = sb.storage.from_(bucket).upload(
                    path=storage_ref,
                    file=compressed.bytes,
                    file_options={"content-type": compressed.mime, "upsert": "true"},
                )
                # supabase-py 2.x returns a dict / object; we don't need
                # the response value — successful upload doesn't raise.
                _ = upload
                sb.table("generated_images").update({
                    "storage_ref": storage_ref,
                    "bytes_size": compressed.bytes_size,
                    "dimensions": {"w": compressed.width, "h": compressed.height},
                }).eq("id", row_id).execute()
                total_uploaded += 1
                if not args.quiet:
                    print(f"  ok id={row_id} → {storage_ref} ({compressed.bytes_size // 1024} KB)")
            except Exception as exc:
                total_failed += 1
                if not args.quiet:
                    print(f"  FAILED id={row_id}: {exc}", file=sys.stderr)
                # Don't mark anything on the row — next sweep retries.

    print(
        f"backfill complete: seen={total_seen} uploaded={total_uploaded} "
        f"skipped={total_skipped} failed={total_failed}"
    )
    return 0 if total_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
