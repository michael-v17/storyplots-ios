"""
Cycle 0098 — retroactive Storage orphan cleanup.

This script targets the historical mess: 97+ orphans observed in the
MVX project before Cycle 0098 wired the trigger-based queue. The
queue (`public.storage_orphans`) only catches deletes that happen
AFTER its triggers were installed; everything pre-trigger is stranded.

Approach: list every Supabase Storage object in `generated-media` and
`avatars`, list every active reference in DB (`generated_images
.storage_ref`, `characters.avatar_ref / reference_ref`,
`user_personas.photo_ref / reference_ref`), diff, and remove the
ones with no DB owner.

Run on MVX once that project is unpaused (post-grace-period); the
xvm project starts clean so this script is a no-op there.

Usage:

    set -a && source .env.local && set +a
    uv run --with supabase python scripts/cleanup_orphan_storage.py             # dry-run
    uv run --with supabase python scripts/cleanup_orphan_storage.py --apply     # actually delete

Output: counts + estimated bytes saved + (with --apply) live deletion.
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

from supabase import create_client

BUCKETS = ("generated-media", "avatars")


def list_bucket_objects(sb: Any, bucket: str) -> list[dict[str, Any]]:
    """List every object in a bucket, recursively walking user-id
    folders. Supabase storage list() returns up to 100 entries per
    folder by default; paginate if more."""
    seen: list[dict[str, Any]] = []
    # Top-level: user-id folders.
    top = sb.storage.from_(bucket).list("", {"limit": 1000, "offset": 0})
    for entry in top:
        # Folders have id=None and metadata={}; files have id=uuid.
        if entry.get("id") is None:
            # It's a folder (user_id). List inside.
            folder = entry.get("name", "")
            offset = 0
            while True:
                inner = sb.storage.from_(bucket).list(folder, {"limit": 1000, "offset": offset})
                if not inner:
                    break
                for f in inner:
                    if f.get("id") is None:
                        # Nested folder — flatten one more level (rare).
                        sub = sb.storage.from_(bucket).list(f"{folder}/{f.get('name','')}", {"limit": 1000})
                        for s in sub:
                            seen.append({"path": f"{folder}/{f.get('name','')}/{s.get('name','')}", **s})
                    else:
                        seen.append({"path": f"{folder}/{f.get('name','')}", **f})
                if len(inner) < 1000:
                    break
                offset += 1000
        else:
            seen.append({"path": entry.get("name", ""), **entry})
    return seen


def collect_db_refs(sb: Any) -> dict[str, set[str]]:
    """Return {bucket → set of storage paths actively referenced}."""
    refs: dict[str, set[str]] = {b: set() for b in BUCKETS}

    # generated_images.storage_ref → bucket col (default 'generated-media').
    rows = sb.table("generated_images").select("storage_ref,bucket").execute().data or []
    for r in rows:
        ref = (r.get("storage_ref") or "").strip()
        if not ref:
            continue
        bucket = (r.get("bucket") or "generated-media").strip()
        refs.setdefault(bucket, set()).add(ref)

    # characters: avatar_ref + reference_ref → 'avatars'.
    rows = sb.table("characters").select("avatar_ref,reference_ref").execute().data or []
    for r in rows:
        for col in ("avatar_ref", "reference_ref"):
            ref = (r.get(col) or "").strip()
            if ref:
                refs["avatars"].add(ref)

    # user_personas: photo_ref + reference_ref → 'avatars'.
    rows = sb.table("user_personas").select("photo_ref,reference_ref").execute().data or []
    for r in rows:
        for col in ("photo_ref", "reference_ref"):
            ref = (r.get(col) or "").strip()
            if ref:
                refs["avatars"].add(ref)

    return refs


def main() -> int:
    parser = argparse.ArgumentParser(description="Retroactively remove Storage objects with no DB owner.")
    parser.add_argument("--apply", action="store_true",
                        help="Actually delete orphans. Without this flag the script is read-only and prints what WOULD be removed.")
    parser.add_argument("--bucket", action="append", default=None,
                        help="Restrict to a single bucket (default: all of generated-media + avatars). Repeatable.")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env.", file=sys.stderr)
        return 2

    sb = create_client(url, service_key)

    target_buckets = tuple(args.bucket) if args.bucket else BUCKETS

    print(f"collecting DB refs … (buckets: {', '.join(target_buckets)})")
    db_refs = collect_db_refs(sb)
    for bucket in target_buckets:
        print(f"  {bucket}: {len(db_refs.get(bucket, set()))} active refs")

    total_orphans = 0
    total_orphan_bytes = 0
    for bucket in target_buckets:
        print(f"\nlisting bucket={bucket} …")
        objects = list_bucket_objects(sb, bucket)
        print(f"  {len(objects)} objects in bucket")

        active = db_refs.get(bucket, set())
        orphans = [o for o in objects if o["path"] not in active]

        bytes_sum = sum(int((o.get("metadata") or {}).get("size") or 0) for o in orphans)
        print(f"  orphans={len(orphans)} ≈ {bytes_sum / 1024 / 1024:.2f} MB")
        total_orphans += len(orphans)
        total_orphan_bytes += bytes_sum

        if args.apply and orphans:
            paths = [o["path"] for o in orphans]
            # Batch in chunks of 1000 (Supabase storage.remove supports up to ~1000 paths per call).
            for i in range(0, len(paths), 1000):
                chunk = paths[i:i + 1000]
                try:
                    sb.storage.from_(bucket).remove(chunk)
                    print(f"  removed {len(chunk)} (batch {i // 1000 + 1})")
                except Exception as exc:
                    print(f"  FAILED batch starting at {i}: {exc}", file=sys.stderr)

    print(f"\nsummary: {total_orphans} orphans ≈ {total_orphan_bytes / 1024 / 1024:.2f} MB across {len(target_buckets)} buckets")
    if not args.apply:
        print("(dry-run — pass --apply to actually delete)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
