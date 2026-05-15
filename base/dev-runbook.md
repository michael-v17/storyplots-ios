# dev-runbook.md

Comandos para arrancar/parar servicios del proyecto. Consultar antes de asumir que algo está corriendo.

## Backend — FastAPI
Working dir: backend/

**Critical**: `uvicorn` NO lee `.env.local` automáticamente. Hay que sourcearlo antes de arrancar — sin esto el JWT secret no carga y todo request da 401. Single-line incantation:

    set -a && source ../.env.local && set +a && uv run uvicorn app.main:app --reload --port 8000

Stop: Ctrl+C
Reload: cambios Python recargan solos vía `--reload`.

## Frontend — Vite
Working dir: frontend/
Start: `npm run dev` (puerto 5173, IPv6 `[::1]:5173` por default — usar `http://localhost:5173/...` desde Playwright, no `127.0.0.1:5173`)
Build: `npm run build`
Typecheck: `npx tsc --noEmit`
Notes: TypeScript strict, cero errores antes de commit.

## Database — Supabase hosted
Project (current): `mhdekknjaigoeuzrriey` — xvm_project, org xvp (PG 17)
Project (paused): `tjytndffwwwanfeoeuze` — MVX (PG 17). Switch back here cuando renueve la quota free.
Migrations: usar `npx supabase db push` (linkeado al proyecto activo). Files in `supabase/migrations/NNNN_*.sql`. Si por algún motivo no se puede hacer push, fallback es pegar el SQL en el Editor del dashboard.
Switch project: `npx supabase link --project-ref <ref>` y actualizar `.env.local` (root) + `frontend/.env.local`.

## ComfyUI — Image generation (legacy provider)
Host: 192.168.0.7:8188 (verificar IP actual con creator si falla connect)
NOT auto-managed — creator inicia/para manualmente.

## fal.ai — Image generation (default provider after Cycle 0090–0098)
- BYOK: cada user pega su key en Settings → Image Engine → fal.ai tab. Encriptada en Supabase Vault via `provider_configs.vault_secret_id`.
- Backend usa `fal-client` Python SDK con AsyncClient(key=...) per call (concurrency-safe).
- Avatares: dual-gen sincrónico (preview + reference white-bg). Storage primero, render desde Storage siempre.
- Chat scenes: dual-store async. Response inmediato con `external_url` (fal CDN, <24h render directo); sweeper popula `storage_ref` para ≥24h.
- Style picker (realistic / anime / custom): per-user global default + per-character snapshot + per-image override.

## Storage backfill sweeper (Cycle 0094)
Procesa rows pendientes (engine='fal' + storage_ref=null), descarga desde fal CDN, comprime WebP, sube a Storage, popula storage_ref.

**Critical**: los tres sweepers (este + los dos del 0098 abajo) requieren `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` para bypassear RLS al hacer storage.upload/remove. La key viene del Supabase dashboard → Project Settings → API → "Project API keys" → service_role (secret). Sin ella el script aborta con `ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env.`

Manual:

    set -a && source .env.local && set +a
    cd backend && uv run python ../scripts/storage_backfill.py             # dry-run
    cd backend && uv run python ../scripts/storage_backfill.py --apply

Cron sugerido (cada 30 min — el dual-store window es 24h, sobra slack):

    */30 * * * * cd /path/to/repo && set -a && source .env.local && set +a && \
        cd backend && uv run python ../scripts/storage_backfill.py --apply --quiet \
        >> /var/log/sp-backfill.log 2>&1

## Storage orphan sweeper (Cycle 0098)
Drena la queue `public.storage_orphans` poblada por triggers BEFORE DELETE. Idempotente.

    set -a && source .env.local && set +a
    uv run --with supabase python scripts/sweep_storage_orphans.py [--dry-run] [--batch=100]

## Storage orphan retroactive cleanup (Cycle 0098)
Para el backlog histórico (97+ huérfanos en MVX cuando vuelva). Diff Storage objects vs DB refs, dry-run + --apply.

    set -a && source .env.local && set +a
    uv run --with supabase python scripts/cleanup_orphan_storage.py             # dry-run
    uv run --with supabase python scripts/cleanup_orphan_storage.py --apply

xvm arranca limpio — el script reporta 0 huérfanos hasta que se acumulen.

## Tests
Playwright: `npx playwright test`
Backend: no hay suite formal todavía
Manual smoke (post-cycle): drive Playwright via MCP (`mcp__plugin_playwright_playwright__*`) sobre `http://localhost:5173`.
