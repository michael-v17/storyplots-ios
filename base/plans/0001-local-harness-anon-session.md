---
id: 0001
slug: local-harness-anon-session
status: approved
created: 2026-04-15
---

# Cycle 0001 — Local dev harness + anonymous session + empty Home

## Context

StoryPlots v0 is a greenfield build: the repository currently contains only
the frozen `Seed/`, `References/`, `CLAUDE.md`, and a plugins smoke-test note.
No application code exists yet. Before any feature can be implemented, the
project needs a runnable three-service harness (React+Vite SPA, FastAPI
backend, Supabase local stack) and the single lowest-level invariant every
later cycle depends on: **per-user isolation via RLS on a `users` table,
identical for anonymous and authenticated users**.

This cycle's goal is therefore the smallest change that makes the project
*runnable end-to-end* and proves the auth/RLS foundation works. It stops
short of BYOK, Characters, Conversations, Chat, Grammar, and LangGraph —
those are subsequent cycles. Deferring them here keeps the cycle reviewable
and front-loads the single piece of architecture that everything else
assumes.

**Done when:** from a clean clone, `pnpm dev`, `uvicorn`, and `supabase
start` all come up; a first visit silently creates an anonymous Supabase
User; the Home route renders the PersonaLLM empty state; and Playwright
confirms one anonymous session cannot read another's `users` row.

## Shape of the change

```
┌───────────────────────────┐        ┌──────────────────────────────┐
│ React + Vite SPA (TS)     │        │ FastAPI (Python)              │
│  src/app/boot.ts          │        │  app/deps/jwt.py              │
│    └─ ensureAnonSession() │        │    └─ verify_supabase_jwt()   │
│  src/routes/Home.tsx      │        │  app/routes/health.py         │
│    └─ empty-state UI      │        │    └─ GET /health (auth'd)    │
└─────────────┬─────────────┘        └──────────────┬───────────────┘
              │                                     │
              │        Supabase JS SDK              │  PyJWT + JWKS
              │  (auth.signInAnonymously)           │  (Supabase public key)
              ▼                                     ▼
┌───────────────────────────────────────────────────────────────────┐
│ Supabase (local, `supabase start`)                                 │
│  migrations/0001_users.sql                                         │
│   • public.users    (PK = auth.users.id, auth_method, preferences) │
│   • RLS: id = auth.uid()                                           │
│   • trigger: on auth.users INSERT → create public.users row        │
└───────────────────────────────────────────────────────────────────┘
```

Only `public.users` (plus its RLS policy and the auth-hook trigger) is
created in this cycle. All other tables in `schema.md §2` are out of scope
and land in later cycles as the features that need them land.

## 1. Seed sections satisfied

- [creator-vision.md](../Seed/creator-vision.md) §6 *Authentication* —
  Supabase Auth JWT; anonymous sign-in produces a real `User` row + JWT.
- [creator-vision.md](../Seed/creator-vision.md) §11 *Tech Stack Direction*
  — React+Vite, Python+FastAPI, Supabase; *Local development* — `supabase
  start`, shared env vars `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`.
- [product.md](../Seed/product.md) §9 *Major constraints* — "Auth is
  Supabase JWT only. FastAPI validates against Supabase's public key. No
  custom token emission."
- [architecture.md](../Seed/architecture.md) §1 *Stack at a glance*, §3
  *Frontend responsibilities* (SPA routing, Supabase SDK CRUD), §4
  *Backend responsibilities* (FastAPI thin, JWT validation), §7 (auth).
- [schema.md](../Seed/schema.md) §2.1 *`users`* (only this table is
  created), §3 *RLS policies (summary)*, §5 *Scoping & isolation rules*
  items 1, 2.
- [ux.md](../Seed/ux.md) §1 *Sitemap* (`/` only), §2 *Navigation model*
  (sidebar+top-bar shell deferred; Home can render full-width in this
  cycle), §4.2 *Home* (empty state "No Companions Yet" + Create/Import
  CTAs — CTAs render but are no-ops this cycle), §6 *Required states*
  (loading, empty).

## 2. User stories touched

- **#2 — Use the app as a guest without signing up · Critical** —
  anonymous Supabase sign-in on first visit; a real `users` row + JWT;
  per-user RLS applies identically to anonymous users; guest data
  persists across return visits.
- **Partial #1 — Sign up · Critical** — only the RLS-enforcement AC.
- **Partial #11 — Home full Character grid** — only the empty-state copy
  and Create/Import CTA shells.

## 3. Domain invariants preserved

From [domain.md §6](../Seed/domain.md):

- **#11 — Anonymous Users get identical RLS to authenticated Users.** The
  RLS policy on `public.users` uses `auth.uid()` only; no branching on
  `auth_method`.
- **#14 — Supabase Postgres is the source of truth for Conversation
  state.** Trivially preserved (no checkpointer).
- **#15 — No cross-user read is possible at the database layer.**
  Declarative RLS; Playwright smoke test.
- **#12 — `sfw_disabled = true` requires authenticated User.** Enforced
  via `CHECK (NOT (sfw_disabled AND auth_method = 'anonymous'))`.
- **#17 — Grammar master toggle defaults OFF for every new `User`.**
  Default committed in `preferences` jsonb.

## 4. Schema scoping / RLS rules applied

From [schema.md §5](../Seed/schema.md):

- **#1 — Per-user RLS on every user-scoped table.** `public.users` gets
  `ENABLE ROW LEVEL SECURITY` and policies `where id = auth.uid()`.
- **#2 — Anonymous users get identical RLS.**
- **#10 — `users.sfw_disabled = true` requires `auth_method !=
  'anonymous'`.** CHECK constraint.

### Migration detail (`supabase/migrations/0001_users.sql`)

- `public.users` columns per schema.md §2.1.
- Partial unique index on `email where email is not null`.
- CHECK: `NOT (sfw_disabled AND auth_method = 'anonymous')`.
- `on auth.users` AFTER INSERT trigger that inserts a matching
  `public.users` row with `auth_method` derived from
  `NEW.raw_app_meta_data->>'provider'` (`'anonymous'` for anon sign-in).
- RLS policies: `select_own`, `update_own`, `delete_own` all `using (id =
  auth.uid())`.

## 5. UX surfaces affected

- **`/` Home (§4.2)** — empty state. CTAs "Create Character" / "Import
  Character" render but are stubs.
- **Required states (§6):** loading + empty.
- **Sitemap (§1):** only `/` exists; other routes render minimal 404.

## 6. Open questions hit

None that this cycle needs to resolve.

## 7. Implementation order

1. Repo skeleton + `.gitignore` + `.env.example`.
2. Supabase config + `0001_users.sql`.
3. Frontend Vite+React+TS skeleton.
4. Backend FastAPI + PyJWT.
5. Root dev scripts + README.
6. Verification.

## 8. Verification

See `## Verification` below after implementation.

## Verification

Run date: 2026-04-15. Supabase: hosted project `tjytndffwwwanfeoeuze`
(free tier, Americas). Local stack (Docker + CLI) not used — hosted
proved sufficient for every gate.

### Playwright run (all 5 checks PASS)

Frontend booted via `pnpm --prefix frontend dev` (Vite on :5173), backend
via `uv run uvicorn app.main:app --port 8000`. Browser driven via the
Playwright MCP plugin.

1. **F1 step 1 — anon sign-in + empty-state render.** `GET /` renders
   "No Companions Yet" + Create/Import buttons. `localStorage` holds
   one `sb-<ref>-auth-token` entry with `is_anonymous: true`,
   `role: authenticated`, `aud: authenticated`. Querying
   `public.users` via the authed client returns exactly one row with
   `auth_method='anonymous'`, `sfw_disabled=false`,
   `preferences.grammar.master=false` (invariant #17 preserved).
2. **RLS cross-user isolation (invariants #11 / #15).** Second
   independent anonymous session created in-page via a fresh
   `createClient` with an isolated storage object. Two distinct
   `auth.uid()`s emerged. Client A's `select from users` returned
   `[userA]`; client B's returned `[userB]`. No cross-user read.
3. **CHECK constraint rejects `sfw_disabled=true` for anon (invariant
   #12).** `supabase.from('users').update({ sfw_disabled: true })` as
   the anonymous user returned Postgres error code `23514`, constraint
   `users_sfw_requires_auth`.
4. **Backend JWT smoke.**
   - `curl -H "Authorization: Bearer <anon-jwt>" /health` → `200
     {"ok":true,"user_id":"d716b4c2-..."}`. JWKS verification of
     Supabase's ES256 key succeeded end-to-end.
   - `curl -H "Authorization: Bearer not.a.jwt" /health` → `401
     Invalid token`.
   - `curl /health` (no header) → `401 Missing bearer token`.
5. **ux.md §10 non-omission.** `document.body.innerText` on `/`
   contains no match for `/grammar/i` or `/snapshot/i`. Master is OFF
   by default, so no widget is rendered — matches invariant #17.

Screenshot of the rendered empty state: [`0001-home-empty-state.png`](0001-home-empty-state.png).

### `code-review` plugin pass

Three findings surfaced; disposition:

- **#1 (critical) — "JWT `audience='authenticated'` will reject
  anonymous tokens."** **Invalid.** Empirically disproven by
  Playwright check #4 above (anonymous JWT → HTTP 200). Decoded anon
  token shows `aud='authenticated'` with `is_anonymous: true` —
  reviewer conflated the `aud` claim with the `role` field. No change.
- **#2 (important) — "`byok_keys` should be NOT NULL with default per
  schema.md §2.1."** **Valid seed violation; fixed.** Migration
  amended: `byok_keys bytea not null default ''::bytea`. Since the
  hosted DB already applied the bad DDL from the earlier run, follow
  up on the live database with:
  ```sql
  update public.users set byok_keys = ''::bytea where byok_keys is null;
  alter table public.users alter column byok_keys set default ''::bytea;
  alter table public.users alter column byok_keys set not null;
  ```
- **#3 (important) — "Sync `httpx.get` in `_get_jwks_client` blocks the
  event loop; global state not thread-safe."** **Acknowledged; not
  fixed this cycle.** `verify_supabase_jwt` is a `def` FastAPI
  dependency, which FastAPI runs in a threadpool, so it does not block
  the event loop. The global race under many workers is real but not
  material for a single-worker dev harness; rewriting to
  `asyncio.Lock` + async probe is speculative complexity the plan
  doesn't require (CLAUDE.md non-invention). Revisit if/when we add
  multi-worker Uvicorn or put the backend behind heavy traffic.

### `code-simplifier` plugin pass

Pruned:

- `frontend/src/lib/supabase.ts` — removed the explicit `SupabaseClient`
  type annotation (inferred from `createClient`) and the
  `persistSession/autoRefreshToken` options block (both SDK defaults).
- `frontend/src/app/boot.ts` — removed the redundant "Idempotent"
  comment.
- `frontend/src/routes/Home.tsx` — removed the `stub` factory wrapping
  `console.warn`; buttons are now bare no-ops, closer to the plan's
  "render but do nothing" spec.
- `backend/app/deps/jwt.py` — condensed docstring on
  `_get_jwks_client`; removed an inline comment that restated the next
  line.

Everything else was already minimal per plan; the simplifier
explicitly left the migration, JWT verification logic, `/health`
endpoint, `ensureAnonSession` signature, and all three plan-required
App.tsx branches (loading / error / 404) intact.

Post-simplifier regressions checked: `pnpm typecheck` passes;
`uv run python -c "from app.main import app"` succeeds.

### Static checks (passing)

- `pnpm install` in `frontend/` resolves cleanly (React 18.3, Vite 5.4,
  `@supabase/supabase-js` 2.103, TS 5.9).
- `pnpm typecheck` (strict) passes with zero errors.
- `pnpm build` produces a 341 kB bundle with no diagnostics (built with
  placeholder env so TS + bundler see the code paths end-to-end).
- `uv sync` in `backend/` resolves FastAPI 0.135, Uvicorn 0.44,
  PyJWT 2.12 [crypto], httpx 0.28.
- `uv run python -c "from app.main import app"` lists `/health` in the
  FastAPI route table — imports clean, no circulars.

### Migration review (not executed against Postgres)

- `supabase/migrations/0001_users.sql` authored to match schema.md §2.1
  column-for-column (including `preferences` default built from §4, the
  `users_sfw_requires_auth` CHECK, the partial unique index on `email`,
  and the `on auth.users` AFTER INSERT trigger).
- RLS policies `users_select_own`, `users_update_own`, `users_delete_own`
  all use `id = auth.uid()` — no `auth_method` branch, satisfying
  domain.md §6 #11.
- No client-visible INSERT policy — inserts flow only through the
  SECURITY DEFINER trigger, matching schema.md §2.1's "Insert handled by
  Supabase Auth hooks."

### Status

**Cycle closeable.** All five Playwright gates, the `code-review` pass,
and the `code-simplifier` pass have run green (or been dispositioned
with a written reason). One follow-up ALTER on the hosted DB is listed
under `code-review` finding #2 and should be applied before any real
user data lands in `public.users`. No files under `Seed/` were touched.

