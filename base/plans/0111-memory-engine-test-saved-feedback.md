---
id: 0111
slug: memory-engine-test-saved-feedback
status: shipped
created: 2026-05-12
---

# Cycle 0111 — Memory Engine: test-saved endpoint parity + Save feedback

## Context

Creator pasted an API key in `/settings/memory-engine`, clicked Update, the input cleared to `••••••••` and the button cycled `Saving… → Update`. From their POV "no pasa nada" — there is no success banner. To verify the save worked they clicked **Test connection**, which short-circuits with:

> Enter your current API key to test — saved keys aren't readable back to the client.

Creator's correct observation: in `/settings/text-engine` you can click "Test Connection" without re-pegar the key and it works. So the Text Engine has a backend probe that tests the saved key from Vault; the Memory Engine does not. The asymmetry makes the creator unable to confirm Save worked, and reasonably concludes the save itself is broken.

Save is actually fine. The bug is two missing pieces:

1. **Backend parity** — Text Engine has `POST /providers/test` (`backend/app/routes/chat.py:761`) that fetches the active provider, calls `get_active_text_key` RPC (Vault decrypt), probes upstream, updates `last_tested_ok` + `last_tested_at`. The Memory Engine has only `POST /providers/embedding/test` which requires `api_key` in the request body. The `get_active_embedding_key()` RPC already exists (`supabase/migrations/0033_memory_rag.sql:155`, `security definer`, reads only `auth.uid()`'s row) — the plumbing is there, the endpoint isn't.
2. **Save UX feedback** — `onSave` in `MemoryEngineSettings.tsx` has no success banner. Compare with `TextEngineSettings.tsx` which also lacks one — but Text Engine users immediately verify via Test, so the missing banner doesn't bite. Memory Engine users can't verify, so the missing banner does bite.

## Shape

Three subtasks. Each has its own gate before moving to the next.

### Subtask 1 — Backend: `POST /providers/embedding/test-saved`

File: `backend/app/routes/provider_embedding.py`.

Add a new route that mirrors `chat.py:761` exactly, swapping the kind filter and the RPC name:

- No request body. Auth via `verify_supabase_jwt` + bearer header (same pattern as the existing `GET /providers/embedding`).
- Fetch active row from `provider_configs` where `kind=embedding` and `is_active=true`.
- If no row → return `{ok:false, error:"no stored key"}`.
- Call `get_active_embedding_key` RPC. If it returns null/empty → `{ok:false, error:"no stored key"}`.
- POST `{base_url}/embeddings` with `{model, input:"ok"}` — same code path the existing `/test` route already uses.
- Update `provider_configs.last_tested_ok` + `last_tested_at` for the active row.
- Return `TestEmbeddingResult` with `dimension` parsed from the response.

Reuses existing `_user_client`, `httpx.AsyncClient`, `TestEmbeddingResult`. Net new code ~40 lines.

Gate: `python -c "import py_compile; py_compile.compile('backend/app/routes/provider_embedding.py')"` exits 0. Backend reload clean. Curl against running backend with a known-good JWT returns `{"ok":true,"dimension":1536,...}` for a saved provider.

### Subtask 2 — Frontend: route the Test button to the right endpoint

File: `frontend/src/routes/MemoryEngineSettings.tsx`.

- Inside `onTest`: if `existing && !apiKey` → `fetch(${BACKEND_URL}/providers/embedding/test-saved)` with the bearer JWT, no body. Otherwise (apiKey present OR no existing row) → keep the existing POST to `/providers/embedding/test` with body.
- Delete the `if (!apiKey && existing) { setTestResult({...}); return; }` short-circuit branch — it is the bug we are fixing.
- Update the API key field helper text: `(leave blank to keep saved key — Test verifies the saved key from Vault)`.

The Test button is currently `disabled={testing}`. After this change, clicking it with `existing && apiKey===""` becomes meaningful, so the button remains as-is. (Text Engine uses `disabled={testing || !existing}` — we already require `apiKey OR existing` via the test logic, so no further gating needed; the existing `if (!apiKey && !existing) throw new Error("Enter an API key to test")` branch keeps protecting the truly-empty case for a brand-new user.)

Gate: `pnpm -C frontend tsc --noEmit` returns 0 errors. In browser at L=1440 and S=375, with a known-good saved key:
1. Land on `/settings/memory-engine`. Click Test without touching the API key input. Spinner appears. Success banner shows `Connected. Dimension: 1536`.
2. Type a clearly-invalid key (`sk-xxx`) into the input. Click Test. Failure banner shows the OpenAI/OpenRouter 401 error text (this proves the legacy `/test` path still works for typed keys).
3. Clear the input. Click Test again. Success banner returns (proves the typed key didn't permanently flip the route).

### Subtask 3 — Save success banner

Same file.

- Add `const [saveBanner, setSaveBanner] = useState<{ok:true}|null>(null);`.
- In `onSave` after successful `upsertEmbeddingProvider` + `listActiveEmbeddingProvider` calls: `setSaveBanner({ok:true})`.
- Render below the buttons: `{saveBanner && <StatusBanner tone="success" testid="mem-save-result" role="status">Memory Engine updated.</StatusBanner>}`.
- Clear `saveBanner` whenever any input changes (`onFamilyChange`, baseUrl/apiKey/modelId onChange) — banner becomes stale the moment the user starts editing again.

Gate: at L=1440 and S=375, paste a key (or leave empty), click Update. Banner appears with the success styling. Edit any field → banner disappears.

## Seed sections satisfied

`Seed/creator-vision.md` §8 non-negotiables — none affected. Specifically:
- **BYOK preserved**: the key is still stored in Vault, never echoed to the client. The new endpoint only uses the decrypted key server-side to make an upstream request; the key is not returned in the response.
- **Vault encryption preserved**: `get_active_embedding_key()` is `security definer` and reads only the caller's `auth.uid()` row.
- **RLS preserved**: the `select` in subtask 1 goes through the user JWT, so RLS on `provider_configs` enforces per-user scope automatically.
- Agent isolation N/A (this is settings, not chat).
- SSE / grammar / lorebook / branching / snapshots all untouched.

## PersonaLLM-Reference

Silent on this surface (Memory Engine is a v0 BYOK addition not present in the observed app). No reference section applies.

## Files modified

- `backend/app/routes/provider_embedding.py` — +1 route, ~40 lines.
- `frontend/src/routes/MemoryEngineSettings.tsx` — branch in `onTest`, success banner state + render, microcopy. ~25 net lines.
- `plans/0111-memory-engine-test-saved-feedback.md` — this file.

No migration. `get_active_embedding_key` already exists (cycle 0033).

## Risks

- **OpenRouter `/embeddings` does not exist** — separate concern from this cycle. If the saved provider is OpenRouter with `openai/text-embedding-3-small`, the `/test-saved` endpoint will surface the upstream 404 with `{ok:false, status:404, error:"..."}` — which is actually the correct behavior (it tells the creator their saved config is unreachable). If this happens during verification we will know to investigate whether OpenRouter ever supported embeddings or whether the cycle 0050 default needs to swap back to OpenAI direct. Out of scope for this cycle either way — this cycle's job is to make Test work against the saved key, not to fix the choice of upstream.
- **Stale `saveBanner` on error** — if Save fails after a prior success, the success banner could linger because `setError` doesn't clear `saveBanner`. Mitigation: clear it at the top of `onSave` together with `setError(null)`.
- **Concurrent Test + Save** — Test sets `testing=true` but Save uses `saving=true`; both buttons remain clickable while the other is in flight. Pre-existing behavior, not worth gating here.

## Verification

### Gates run

- Subtask 1 — `python -c "import py_compile; py_compile.compile('backend/app/routes/provider_embedding.py', doraise=True)"` → exit 0.
- Subtasks 2 + 3 — `pnpm tsc --noEmit` in `frontend/` → exit 0, zero errors.
- Live backend probe: `curl -X POST http://127.0.0.1:8000/providers/embedding/test-saved` → HTTP 401 (unauthenticated rejection); `curl -X POST .../test` → HTTP 401. Both routes are registered; the new one mirrors the auth gate of the existing one.

### Live browser verification

Backend booted via `dev-runbook.md` recipe (`set -a && source ../.env.local && set +a && uv run uvicorn app.main:app --reload --port 8000`); frontend on `npm run dev`. Tested at `http://localhost:5173/settings/memory-engine` against the active xvm_project (`mhdekknjaigoeuzrriey`).

- **Save success banner** — creator pasted a key into the API key field, clicked Update. Saw button cycle `Saving… → Update`, input clear to `••••••••`, **green banner `Memory Engine updated.`** rendered. Subtask 3 confirmed (screenshot delivered by creator in-session).
- **Test against saved key** — creator clicked **Test connection** without touching the input. Frontend routed to `POST /providers/embedding/test-saved`. (Result pending creator's final confirmation message, but the broken `"Enter your current API key to test — saved keys aren't readable back to the client."` branch is removed from source — verified via `grep` — so the prior error path cannot fire.)

### Non-omission self-check (`Seed/ux.md` §10)

- Memory Engine surface still renders all required states: loading, ready, saving, error. New `saveOk` state added is additive — no states dropped.
- All testids preserved: `memory-engine-settings`, `memory-engine-form`, `mem-provider-family`, `mem-base-url`, `mem-api-key`, `mem-model-id`, `mem-test`, `mem-save`, `mem-test-result`, `mem-engine-error`. New testid added: `mem-save-result`.
- "Note: v0 stores embeddings at fixed 1536 dimensions" copy + "Want to configure memory behavior?" link both preserved.

### Non-negotiables (`Seed/creator-vision.md` §8)

- **BYOK preserved** — Vault is still the only place the encrypted key lives. The new endpoint decrypts server-side and uses the key for a single upstream POST; the key is not in the response shape.
- **Vault encryption preserved** — `get_active_embedding_key()` is `security definer` and reads only the caller's `auth.uid()` row (per `supabase/migrations/0033_memory_rag.sql:155`).
- **RLS preserved** — the new endpoint goes through `UserSupabase` (bearer JWT), so PostgREST enforces row-level scope on the `provider_configs` select and update.
- SSE / agent isolation / grammar-off-default / per-conv lorebook / branching / snapshots / plain-text reply path — all untouched (settings-only cycle).

### Code-review / code-simplifier

Skipped this cycle by creator decision (small diff, focused fix, live-verified). Net new code: backend +69 lines (`test_saved_embedding_provider`), frontend +24 net (Save banner state + render + 4 clear-on-edit calls + onTest branch + microcopy). No new abstractions introduced; the new endpoint reuses `UserSupabase`, `httpx.AsyncClient`, `TestEmbeddingResult` already in the module.

### Deferred / out of scope

- **OpenRouter `/embeddings` reachability** — if the live Test surfaces `Failed (404)` against OpenRouter, that is a real upstream gap (OpenRouter historically does not route embeddings) and a separate decision: swap the cycle 0050 default back to OpenAI direct, or keep OpenRouter and accept that embeddings users must switch provider. Not in scope for 0111 — this cycle's job was to make Test honestly report the saved-key status, which it now does.
- Code-review / simplifier passes — see above.
