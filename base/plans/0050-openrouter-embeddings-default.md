---
id: 0050
slug: openrouter-embeddings-default
status: shipped
created: 2026-04-19
---

# Cycle 0050 — OpenRouter embeddings as default Memory Engine

## Context

Memory Engine (cycle 0029) usa OpenAI `text-embedding-3-small` directamente como default. Creator pidió agregar **OpenRouter** como opción para que el user pueda usar el mismo modelo vía el mismo provider que ya tiene configurado para text (OpenRouter/deepseek) — una sola API key, un solo account para billing. OpenRouter expone el modelo como [`openai/text-embedding-3-small`](https://openrouter.ai/openai/text-embedding-3-small) por su `/api/v1/embeddings` endpoint, 1536-dim, OpenAI-compatible.

OpenAI direct permanece como opción (los user que ya tienen OpenAI keys no se ven forzados a migrar).

## Done when

- Dropdown "Provider" en `/settings/memory-engine` lista **OpenRouter (recommended)** como primera opción, luego **OpenAI**, luego **Jina AI**, luego **Custom**.
- Default seleccionado para users sin config previa es OpenRouter con `base_url=https://openrouter.ai/api/v1` y `model=openai/text-embedding-3-small`.
- Guardar con OpenRouter → DB row `provider_family="OpenRouter"`, base_url + model_id apropiados; Vault encrypta la API key.
- Test connection con OpenRouter creds devuelve `ok: true, dimension: 1536`.
- Memory extraction + retrieval siguen funcionando sin cambios (el agent `embed_text` ya es provider-agnostic OpenAI-compatible).
- Copy update: la intro del screen menciona OpenRouter como default.

## Shape of the change

### Frontend (único lugar tocado)

**`frontend/src/lib/providers.ts`**:
- Add `{ family: "OpenRouter", label: "OpenRouter (recommended)", default_base_url: "https://openrouter.ai/api/v1", default_model: "openai/text-embedding-3-small" }` como PRIMERA entry en `EMBEDDING_PROVIDERS`.
- OpenAI pierde el "(recommended)" del label — queda `"OpenAI"`.

**`frontend/src/routes/MemoryEngineSettings.tsx`**:
- Initial `providerFamily` state: `"OpenAI"` → `"OpenRouter"`.
- Intro copy actualiza para mencionar OpenRouter como default.

### Backend

Sin cambios. `embed_text(cfg)` ya POSTea a `{base_url}/embeddings` con `{model, input}` — OpenRouter acepta este payload idéntico al de OpenAI y devuelve `{data: [{embedding: [...]}], ...}` con la misma shape.

## Seed sections satisfied

- [Seed/PersonaLLM-Reference/04-screens/settings/memory.md](../Seed/PersonaLLM-Reference/04-screens/settings/memory.md) — Memory Engine.
- [Seed/domain.md](../Seed/domain.md) — BYOK per kind.

## Commit decisions

- **Model id con prefix `openai/`**: OpenRouter namespace-s sus modelos por upstream provider. El model id correcto en su catálogo es `openai/text-embedding-3-small`. OpenAI direct usa `text-embedding-3-small` sin prefix — cada family tiene su default_model correcto.
- **Nuevos users → OpenRouter default**: coherente con que OpenRouter también es el default/recomendado para Text Engine en este proyecto.
- **No migración de rows existentes**: el user con OpenAI configurado hoy sigue usando OpenAI. Puede cambiar manualmente si quiere.
- **No hay cambio en `v0 fixed 1536-dim` constraint**: ambos (OpenAI direct y OpenRouter) devuelven 1536-dim para text-embedding-3-small. Existing schema compat.

## Schema / RLS

Sin cambios.

## Verification

- [ ] TS clean.
- [ ] UI: dropdown lista OpenRouter primero, default seleccionado.
- [ ] Test connection con OpenRouter key real → `ok: true, dimension: 1536`.
- [ ] Save → DB inspection: `provider_family="OpenRouter"`, `base_url=https://openrouter.ai/api/v1`, `model_id=openai/text-embedding-3-small`.

## Implementation order

1. Plan (este).
2. Edit `providers.ts` — reorder + add OpenRouter.
3. Edit `MemoryEngineSettings.tsx` — default state + intro copy.
4. TS check.
5. Playwright verify dropdown + save roundtrip.
6. Commit + SESSION_HANDOFF.

## Critical files

| File | Change |
|---|---|
| `frontend/src/lib/providers.ts` | add OpenRouter to EMBEDDING_PROVIDERS, first, relabel OpenAI |
| `frontend/src/routes/MemoryEngineSettings.tsx` | default state "OpenRouter", intro copy |

## Verification

- ✅ TS `npx tsc --noEmit` clean.
- ✅ **UI dropdown order**: `[OpenRouter (recommended), OpenAI, Jina AI, Custom / self-hosted]` — verified via live DOM inspection.
- ✅ **Switch to OpenRouter auto-populates defaults**:
  - Initial page state loaded the creator's existing OpenAI row (family=OpenAI, baseUrl=https://api.openai.com/v1, model=text-embedding-3-small) — correct: existing configs preserved, no forced migration.
  - Selecting OpenRouter from the dropdown → baseUrl=`https://openrouter.ai/api/v1`, model=`openai/text-embedding-3-small` applied via `onFamilyChange`.
- ✅ **Backend unchanged**: `embed_text(cfg)` in `agents/embeddings.py` already POSTs `{base_url}/embeddings` with `{model, input}` — OpenRouter is byte-for-byte OpenAI-compatible at that endpoint. No code change needed.
- **Migration note**: users with an existing OpenAI embedding row continue on OpenAI until they manually switch. Opt-in migration — no silent rewrites of Vault-stored keys.
