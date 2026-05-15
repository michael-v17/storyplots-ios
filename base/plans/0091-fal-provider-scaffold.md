# Plan 0091 — fal.ai provider scaffold + DB schema

status: in_progress
date: 2026-05-05

## Motivation

Cycle 0090 wired the fal.ai BYOK section in Settings + research findings. **No fal call path is live yet** — `image.py` and `avatar_generate.py` still dispatch only to ComfyUI. This cycle adds the abstraction layer + DB schema so cycles 0093/0094 can call fal without touching the dispatcher again.

Goals:
1. Provider abstraction: `ImageProvider` base class + `FalProvider` + thin `ComfyUIProvider` wrapper (preserves all current behavior). One place for compress + upload + storage_ref convention.
2. DB schema for everything downstream needs: dual-store URLs, per-image style/engine snapshot, character reference_ref + avatar_style, bucket column for cascade-delete (Cycle 0098).
3. Backend dispatcher branches `provider_family='fal'` correctly but **flag-gated**: still falls back to ComfyUI if fal isn't fully wired (Cycles 0093/0094 flip the switch).

Provenance: master plan `~/.claude/plans/floofy-painting-karp.md`. Decisions A–E from `plans/0090-fal-seedream-research.md` (half-body whitebg ref + natural-language prose + dual-store + per-character style snapshot).

Non-goals:
- No actual fal call execution (that's 0093/0094).
- No UI changes (0093 + 0095 own the UI).
- No image compression integration (0092 owns the WebP pipeline).

## Implementation order

### Subtask 1 — Migration `0037_fal_scaffold.sql`
Single migration consolidating all column additions:
- `generated_images.style` (text, nullable) — snapshot of style at gen.
- `generated_images.engine` (text, nullable) — `'comfyui' | 'fal'`.
- `generated_images.external_url` (text, nullable) — fal CDN URL captured at gen.
- `generated_images.external_url_provider` (text, nullable) — e.g. `'fal'`.
- `generated_images.external_url_captured_at` (timestamptz, nullable).
- `generated_images.bucket` (text, default `'generated-media'`, NOT NULL) — for cascade-delete (Cycle 0098).
- `generated_images.bytes_size` (int, nullable) — for compression telemetry (Cycle 0092).
- `characters.reference_ref` (text, nullable) — Storage path for the white-bg reference image.
- `characters.avatar_style` (text, nullable) — style snapshot at avatar gen.
- `characters.avatar_external_url`, `characters.avatar_external_url_captured_at` — dual-store mirror.
- `characters.reference_external_url`, `characters.reference_external_url_captured_at`.
- `user_personas.reference_ref`, `user_personas.avatar_style`, persona dual-store URL columns.

All additive + nullable (or with safe defaults). No data backfill needed — null = "ComfyUI generated" or "pre-fal" semantics in code.

**Verify**: `npx supabase db push`; migration applies. Spot-check `\d generated_images` in psql shows new columns.

### Subtask 2 — Backend provider abstraction
- New `backend/app/agents/image_provider.py`:
  - Abstract base class `ImageProvider` with async methods:
    - `submit(prompt: str, refs: list[str] | None, params: dict) -> ProviderResult`
    - `ProviderResult` dataclass: `bytes`, `external_url: str | None`, `external_url_provider: str | None`, `external_url_captured_at: datetime | None`, `seed: int | None`, `model: str | None`.
  - Family-agnostic helpers (compress is owned by Cycle 0092; just leave a hook).
- New `backend/app/agents/fal_provider.py`:
  - `FalProvider(ImageProvider)`. Reads `vault_secret_id` from the active provider_configs row → decrypts via `get_active_image_key()` (existing RPC, family-agnostic). Calls fal via `fal-client` Python SDK with `model_slug` from `workflow_config.model_slug`. Method-routes: `submit` with `refs=None` → `/text-to-image`; with `refs` → `/edit`.
- Refactor `backend/app/agents/comfyui.py` → wrap existing `submit_and_wait` in `ComfyUIProvider(ImageProvider).submit(...)`. **Behavior preserved bit-for-bit** — existing tests / verifications stay green.
- Add `fal-client` to `backend/requirements.txt`.

**Verify**: `pytest backend` (if any tests touch this path); manual: hit existing avatar-generate endpoint with `xvp@storyplots.app` switched to ComfyUI provider, confirm avatar still generates the same way (regression guard for the comfyui refactor).

### Subtask 3 — Dispatcher branches in `image.py` + `avatar_generate.py`
- `image.py:307-334` (provider resolution): instantiate `FalProvider` when `provider_family == 'fal'`, else `ComfyUIProvider`. **Both paths return a `ProviderResult`**, so the call sites unify.
- `avatar_generate.py:444-635, 697-818`: same dispatcher pattern.
- **Flag-gate**: if `FalProvider.submit` is invoked but fal returns an error (or feature flag `image.fal_enabled` is false in user prefs), gracefully fall back to error response. Cycles 0093/0094 lift this flag.

**Verify**: Existing ComfyUI flow regression — Playwright generate avatar with `xvp@storyplots.app` set to ComfyUI, image renders as before. fal path returns "fal provider not yet enabled" error (expected — it's not wired until 0094).

### Subtask 4 — Code-review + simplifier + commit
- code-review on `image_provider.py`, `fal_provider.py`, `comfyui.py` refactor, dispatchers.
- code-simplifier on the abstraction (watch for over-engineering — the base class shouldn't pre-bake compression / storage hooks that 0092 will add).
- Commit `feat(0091): fal provider scaffold + DB schema for dual-store + per-character style`.
- Update SESSION_HANDOFF marking 0091 done.

## Critical files

| Layer | Path |
|---|---|
| Migration | `supabase/migrations/0037_fal_scaffold.sql` (new) |
| Provider base | `backend/app/agents/image_provider.py` (new) |
| fal client | `backend/app/agents/fal_provider.py` (new) |
| ComfyUI wrap | `backend/app/agents/comfyui.py` (refactor) |
| Dispatcher | `backend/app/routes/image.py:307-334`, `backend/app/routes/avatar_generate.py:444-635, 697-818` |
| Deps | `backend/requirements.txt` |

## Risks

- **Refactor of `comfyui.py`** without changing behavior: highest-risk subtask. Mitigate by keeping `submit_and_wait` as the underlying impl, the new class just wraps it. Snapshot existing call signature; the wrapper preserves it.
- **Migration order**: column adds are safe but if any downstream view depends on `generated_images` shape, recreate. Spot-check with `\d+ generated_images` post-apply.
- **Vault key access for FalProvider**: `get_active_image_key()` uses `auth.uid()`. Backend usually authenticates per-request via JWT → `auth.uid()` returns the requesting user. Verify the call flow.

## Verification

_(to be appended at close)_
