---
id: 0048
slug: avatar-context-background
status: shipped
created: 2026-04-19
---

# Cycle 0048 — Avatar background from character context

## Context

Avatar generation (cycle 0028/0038) construye un prompt determinista con los atributos físicos + `avatar_prefix/suffix` del user (cycle 0039) + `_prompt_wrap` del provider (cycle 0042). El default `avatar_prefix` incluye `simple background` hardcoded — así que todos los avatars quedan con fondo plano incluso cuando el character tiene un `system_prompt` / `worldbuilding` / `scenario` rico que describe el mundo donde vive (Evelyn → oficina/modeling agency; Aria → mountain shrine; Dr. Aris → therapy office). Creator pidió que el generador tome en cuenta el contexto narrativo del character y genere un background acorde.

## Done when

- Nuevo helper `avatar_refine.py` hace una llamada LLM pequeña (JSON mode) que lee un `character_context` construido del `system_prompt + worldbuilding + scenario + personality + goals` y devuelve 4–8 tags Danbooru de background/setting/lighting.
- `avatar_generate.py` construye ese context, invoca el refiner, y splicea los tags devueltos dentro del positive prompt después de los atributos físicos y antes del suffix.
- Default `AVATAR_PREFIX_DEFAULT` pierde `simple background`. Cuando el refiner devuelve tags, esos son los que definen el setting. Cuando el refiner falla (no hay text provider, timeout, JSON inválido), fallback a `simple background` para no romper el flujo.
- Nueva pref `prompt_editor.avatar_background_refine_enabled` (default `true`). Toggle en PromptEditor UI — si el user lo apaga, skip del refiner (equivalente a fallback).
- `avatar_prefix/suffix` del user y `_prompt_wrap` del provider siguen aplicando sin cambios.
- E2E: regen avatar de Evelyn (grandmother en modeling agency) → positive prompt final contiene tags tipo `office_setting, floor_to_ceiling_windows, warm_lighting` (o similares acordes al character) en vez de solo `simple background`.

## Shape of the change

### Backend

**`backend/app/agents/avatar_refine.py`** (NEW):
- `AvatarBackgroundResult` dataclass con `tags: list[str]` y `block_reason: str | None` para SFW-style bloqueos.
- `run_avatar_background_refine(cfg, character_context: str) -> AvatarBackgroundResult`. Reusa `ImageRefineCallConfig` existente (ya tiene base_url + api_key + model).
- System prompt from `prompts/avatar_refine_system.txt` — instruye al LLM a devolver JSON `{"tags": ["..."], "block_reason": null}` con 4-8 Danbooru background tags.

**`backend/app/prompts/avatar_refine_system.txt`** (NEW):
- Breve, enfocado. "You are an avatar background extractor for an anime SDXL character portrait. Given a character's personality, world, and scenario, output 4-8 Danbooru-style tags describing the most fitting background + lighting + mood. Tags only. No subject/body tags. Output JSON."

**`backend/app/routes/avatar_generate.py`**:
- Construir `character_context` con layered order: `system_prompt + PERSONALITY + GOALS + WORLDBUILDING + SCENARIO` (similar a como lo hace image.py).
- Cargar `refine_model` + text provider key (mismo patrón que image.py).
- Leer pref `users.preferences.prompt_editor.avatar_background_refine_enabled` — default true.
- Si enabled + text provider existe: invocar `run_avatar_background_refine`. Si OK y tags no vacíos → spliceAll tags al positive_body. Si falla (exception, empty) → fallback.
- Fallback: inyectar `simple background` como antes.
- Remover `simple background` del `AVATAR_PREFIX_DEFAULT`.

### Frontend

**`frontend/src/lib/promptEditorPrefs.ts`**:
- Añadir `avatar_background_refine_enabled: boolean` (default `true`) a `PromptEditorPrefs` + defaults + merge.
- Constante `AVATAR_PREFIX_DEFAULT` pierde `simple background`.

**`frontend/src/routes/PromptEditor.tsx`**:
- En `AvatarPromptEditor`, añadir checkbox "Append background from character context" debajo del prefix/suffix textareas. Hint: "Uses a short LLM call to pick background/lighting tags from the character's world + scenario. Off → `simple background`."

## Seed sections satisfied

- [Seed/PersonaLLM-Reference/04-screens/settings/prompt-editor.md](../Seed/PersonaLLM-Reference/04-screens/settings/prompt-editor.md) §3.a Avatar Generation.
- [Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](../Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md) — new touchpoint: Avatar background refiner.
- v0 extension: context-aware avatar background (creator request).

## Commit decisions

- **Reusa ImageRefineCallConfig** para no duplicar el scaffolding httpx + JSON-mode. El file queda ~60 líneas.
- **Default enabled=true**: la mejora es perceptible inmediatamente. User puede apagar si quiere avatars planos.
- **Fallback a `simple background`** (no a vacío): mantener compat con checkpoints que rinden mejor con *algún* background hint explícito.
- **Context size**: trim a ~2000 chars antes de enviar al refiner, igual que image.py hace con character_context.
- **SFW**: avatars ya son SFW por default vía negative tags. No se hace SFW check en este refiner — solo devuelve tags.

## Schema / RLS

Sin cambios.

## Verification

- [ ] TS clean.
- [ ] Python sanity: `run_avatar_background_refine` con context dummy devuelve tags parseados.
- [ ] Playwright: regen avatar de Evelyn → positive prompt final contiene background tags derivados (office/agency/etc.), no solo `simple background`.
- [ ] Playwright: apagar el toggle en PromptEditor + regen → fallback a `simple background`.

## Implementation order

1. Plan (este).
2. `avatar_refine.py` + `avatar_refine_system.txt`.
3. `avatar_generate.py` — build context + call refiner + splice + fallback. Remove `simple background` from default.
4. `promptEditorPrefs.ts` — extend type + defaults + merge. Update frontend default constant.
5. `PromptEditor.tsx` — checkbox.
6. TS check + uvicorn reload.
7. Playwright gate.
8. Commit + SESSION_HANDOFF.

## Critical files

| File | Change |
|---|---|
| `backend/app/agents/avatar_refine.py` | NEW — small LLM helper returning background tags |
| `backend/app/prompts/avatar_refine_system.txt` | NEW — instruction for background tag extraction |
| `backend/app/routes/avatar_generate.py` | build context, call refiner, splice tags, fallback, drop `simple background` from default |
| `frontend/src/lib/promptEditorPrefs.ts` | new `avatar_background_refine_enabled` field |
| `frontend/src/routes/PromptEditor.tsx` | new checkbox in Avatar Generation section |

## Verification

- ✅ **TS**: `npx tsc --noEmit` clean.
- ✅ **Python sanity**: `avatar_refine` module imports, `AvatarBackgroundResult` dataclass works, `_flatten` collapses whitespace.
- ✅ **E2E live — Evelyn avatar regen**:
  - Generate Avatar click en `/character/adbb8f1e.../edit` → endpoint success, `characters.avatar_ref` updated a `character-adbb8f1e-...-1776617481813.png`.
  - Generated avatar (visual inspection):
    - Evelyn's full character attrs (silver hair, blue ribbon, glasses, gray business suit) ✓
    - **Background contextual**: office ceiling panels, floor-to-ceiling windows, city skyline visible, wooden desk with hourglass prop, warm afternoon lighting.
  - Pre-cycle baseline: avatars tenían `simple background` plano; post-cycle: el refiner deriva el setting del `system_prompt + worldbuilding + scenario` del character.
- **Fallback paths verified by code inspection**:
  - No text provider → skip refiner, inject `AVATAR_BACKGROUND_FALLBACK = "simple background"`.
  - Refiner exception / invalid JSON → caught in try/except, empty tags list, same fallback.
  - User toggles off → `bg_refine_enabled = False`, skip refiner entirely.
  - Empty tags array from LLM → falls to `AVATAR_BACKGROUND_FALLBACK`.
