"""
Cycle 0098 — Storage orphan queue sweeper.

Reads `public.storage_orphans` rows enqueued by the BEFORE DELETE
triggers in migration 0038, batch-removes the corresponding objects
from Supabase Storage, marks `processed_at`. Idempotent: re-running
after a crash skips already-processed rows; `claim_storage_orphan_batch`
uses `for update skip locked` so two parallel sweeps don't fight over
the same row.

Usage (one-off, manual):

    set -a && source .env.local && set +a
    uv run --with supabase python scripts/sweep_storage_orphans.py [--dry-run] [--batch=100]

Usage (recurring, e.g. cron):

    */15 * * * * cd /path/to/repo && set -a && source .env.local && set +a && \\
        uv run --with supabase python scripts/sweep_storage_orphans.py --quiet >> /var/log/storyplots-sweep.log 2>&1

Auth: needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env (the queue
table + claim RPC are service-role-only).
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from typing import Any

from supabase import create_client


def main() -> int:
    parser = argparse.ArgumentParser(description="Drain the storage_orphans queue.")
    parser.add_argument("--batch", type=int, default=100,
                        help="Max rows to claim per pass (default 100).")
    parser.add_argument("--max-passes", type=int, default=20,
                        help="Stop after N passes — safety cap (default 20 → 2000 rows).")
    parser.add_argument("--dry-run", action="store_true",
                        help="Claim but do not call storage.remove. Marks the row as processed regardless — use only for testing.")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress per-row log lines; print only the summary.")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env.", file=sys.stderr)
        return 2

    sb = create_client(url, service_key)

    total_claimed = 0
    total_removed = 0
    total_failed = 0
    for pass_idx in range(args.max_passes):
        # claim_storage_orphan_batch atomically marks rows processed_at = now()
        # and returns them. If the storage.remove fails we'll fail_storage_orphan
        # to clear processed_at + record the error.
        resp = sb.rpc("claim_storage_orphan_batch", {"p_limit": args.batch}).execute()
        rows: list[dict[str, Any]] = resp.data or []
        if not rows:
            break

        total_claimed += len(rows)
        if not args.quiet:
            print(f"pass={pass_idx} claimed={len(rows)}")

        # Group by bucket so we can use storage.remove()'s batch form.
        by_bucket: dict[str, list[tuple[int, str]]] = defaultdict(list)
        for r in rows:
            by_bucket[r["bucket"]].append((r["id"], r["storage_ref"]))

        for bucket, items in by_bucket.items():
            paths = [path for _, path in items]
            ids = [oid for oid, _ in items]
            if args.dry_run:
                if not args.quiet:
                    print(f"  DRY-RUN bucket={bucket} would_remove={len(paths)}")
                total_removed += len(paths)
                continue
            try:
                sb.storage.from_(bucket).remove(paths)
                total_removed += len(paths)
                if not args.quiet:
                    print(f"  bucket={bucket} removed={len(paths)}")
            except Exception as exc:
                # Mark each row in the batch as failed so a future sweep
                # picks them up. Bulk failures are rare; per-row would be
                # cleaner but Supabase storage.remove doesn't return
                # per-path status, so we treat the batch as one unit.
                total_failed += len(paths)
                err_msg = str(exc)[:500]
                for oid in ids:
                    try:
                        sb.rpc("fail_storage_orphan", {"p_id": oid, "p_error": err_msg}).execute()
                    except Exception:
                        pass
                if not args.quiet:
                    print(f"  bucket={bucket} FAILED batch_size={len(paths)} error={err_msg[:100]}", file=sys.stderr)

    print(f"sweep complete: claimed={total_claimed} removed={total_removed} failed={total_failed} passes={pass_idx + 1}")
    return 0 if total_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
