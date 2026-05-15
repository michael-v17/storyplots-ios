# Plan 0098 — Phantom image cascade cleanup

status: in_progress
date: 2026-05-05

## Motivation

Storage objects orphaned when their owning DB row is deleted. Evidence: 97 huérfanos observed in MVX project on 2026-05-04 — the egress crisis trigger. The DB cascade chain works (auth.users → public.users → characters/conversations/messages/generated_images all delete), but Supabase Storage is not part of any cascade, so blob remains live with no owner.

Two failure modes to fix:
1. **Going-forward** — every NEW delete (account, character, conversation, message regen replacement, persona) leaks Storage objects.
2. **Retroactive** — the 97+ MVX backlog still consuming Storage + Egress today.

Frontend deletes go directly through `supabase-js`'s `.from("...").delete()` — bypasses the backend entirely. Account deletion runs server-side via `delete_my_account()` RPC (cycle 0023) that cascades from auth.users. Wrapping every call site is impossible because cascades aren't observable from app code.

**Architectural call**: trigger-driven queue. `BEFORE DELETE` triggers on the three tables that hold storage paths capture them into `public.storage_orphans`. A separate sweeper consumes the queue and calls `storage.remove()`. The triggers fire under any deletion path (frontend RLS, cascade, RPC, backend).

## Implementation order

### Subtask 1 — Migration `0038_storage_orphan_queue.sql` ✅
- `public.storage_orphans` table (append-only, with `processed_at` + `process_error`).
- BEFORE DELETE triggers on `generated_images`, `characters`, `user_personas`. Skip empty/null path strings.
- `claim_storage_orphan_batch(p_limit)` RPC for sweeper (atomic FOR UPDATE SKIP LOCKED — two parallel sweeps don't fight).
- `fail_storage_orphan(p_id, p_error)` RPC for sweeper to bounce a row back into the queue on storage.remove failure.
- RLS enabled, no policies → service-role-only.
- Applied to xvm via `npx supabase db push`.

### Subtask 2 — Sweeper `scripts/sweep_storage_orphans.py` ✅
- Claims a batch (default 100) per pass via the RPC.
- Groups by bucket, calls `storage.from(bucket).remove(paths)`.
- On batch failure, calls `fail_storage_orphan` per row and continues.
- `--dry-run`, `--batch=N`, `--max-passes=N`, `--quiet` flags.
- Cron-friendly: needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env. Documented at top of file.

### Subtask 3 — Retroactive cleanup `scripts/cleanup_orphan_storage.py` ✅
- Walks Storage buckets `generated-media` and `avatars`, builds path lists.
- Builds active-refs set from `generated_images.storage_ref`+`bucket`, `characters.avatar_ref/reference_ref`, `user_personas.photo_ref/reference_ref`.
- Diffs → orphan list. Reports count + estimated bytes (from object metadata).
- Dry-run by default; `--apply` to actually `storage.remove` in chunks of 1000.
- Designed for MVX backlog when project is unpaused. xvm run today should report 0 orphans.

### Subtask 4 — Plan + commit ✅ (in progress)
- This plan file.
- code-review on the migration + 2 scripts.
- code-simplifier pass.
- Commit `feat(0098): storage orphan queue + sweeper + retroactive cleanup`.
- Update SESSION_HANDOFF roadmap.

## Critical files

| Layer | Path |
|---|---|
| Migration | `supabase/migrations/0038_storage_orphan_queue.sql` |
| Sweeper (cron-friendly) | `scripts/sweep_storage_orphans.py` |
| Backlog cleanup | `scripts/cleanup_orphan_storage.py` |

## Risks / considerations

- **Trigger overhead on cascades**: cascade-deleting a user with thousands of `generated_images` rows fires the trigger N times → N inserts to storage_orphans. Acceptable: each insert is a single row. If pathological, future optimization is a statement-level trigger that batch-inserts.
- **Sweeper backlog**: if storage.remove fails repeatedly, rows accumulate with non-null process_error. Future enhancement: alert when queue depth exceeds a threshold. For now, queue depth is observable via SQL.
- **Trigger only sees `OLD` row state**: if a future cycle changes how avatar_ref / reference_ref are stored (e.g. rename column), update the trigger function in the same migration.
- **External URLs (fal CDN)** are NOT enqueued — those expire on fal's side without any action needed.

## Verification

_(to be appended at close — including dry-run output on xvm to confirm 0 orphans)_
