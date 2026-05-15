---
id: 0046
slug: shot-framing-selector
status: shipped
created: 2026-04-18
---

# Cycle 0046 — Shot framing selector (Auto / Close-up / Portrait / Medium / Cowboy / Full body)

## Context

POV selector (cycle 0040) vive en el Prompt Editor ↦ Visual Roleplay y persiste en `users.preferences.visual_roleplay.pov` via direct RMW. Creator pide un selector análogo para **shot framing** — el tag Danbooru canon que define la distancia de cámara. Hoy el refiner emite `medium_shot` por default salvo que el contexto diga otra cosa. Con el selector, el usuario puede forzar una preferencia (ej. "siempre close-up por default") o dejar `auto` para que el refiner decida.

## Done when

- En `/settings/prompt-editor`, la sección Visual Roleplay tiene una nueva fila "Shot framing" con 6 radios: Auto (default), Close-up, Portrait, Medium shot, Cowboy shot, Full body.
- La preferencia persiste en `users.preferences.visual_roleplay.shot_framing` via direct RMW (mismo patrón que `pov`).
- Backend lee la preferencia, valida contra set permitido (fall back `auto`) y pasa al refiner como kwarg `shot_framing`.
- Refiner: cuando `shot_framing != auto`, emite el tag Danbooru canonical correspondiente como el framing tag al cierre del prompt, skippeando auto-inference del contexto. Cuando `shot_framing=auto`, el refiner decide según narrativa como hoy.
- Tags canon usados: `close-up`, `portrait`, `upper_body`, `cowboy_shot`, `full_body`.
- E2E: regen con `shot_framing=close-up` → `refined_prompt` termina en `close-up` (no `medium_shot`).

## Shape of the change

### Frontend
- **`frontend/src/lib/visualRoleplay.ts`**:
  - `VisualRoleplayShot` type = `"auto" | "close-up" | "portrait" | "medium_shot" | "cowboy_shot" | "full_body"`.
  - Extend `VisualRoleplayPrefs` with `shot_framing: VisualRoleplayShot` (default `"auto"`).
  - Load: read `vr.shot_framing`, fall back `"auto"` si no está en el set permitido.
  - Save: `saveVisualRoleplayShot()` paralelo a `saveVisualRoleplayPov()`, direct RMW.
  - `saveVisualRoleplayPrefs(patch)` extendido para manejar `shot_framing`.
- **`frontend/src/routes/PromptEditor.tsx`**:
  - `useState<VisualRoleplayShot>` + cargar + `onShotChange` handler análogo a `onPovChange`.
  - Pass `shot`/`onShotChange` al `VisualRoleplayPromptEditor`.
  - Dentro del component, añadir `<label>` con 6 radios (mismo estilo que POV).

### Backend
- **`backend/app/routes/image.py`**:
  - Leer `vr_prefs_raw.get("shot_framing")`, validar, fall back `"auto"`.
  - Pasar a `run_image_refine(..., shot_framing=...)`.
- **`backend/app/agents/image_refine.py`**:
  - `run_image_refine` gana kwarg `shot_framing: str | None = None`.
  - `_build_user_payload` añade línea `shot_framing: <value>` cuando hay valor != auto.
- **`backend/app/prompts/image_refine_system.txt`**:
  - Nueva sección "SHOT FRAMING" que documenta el kwarg. Mapping: `close-up` → `close-up`, `portrait` → `portrait`, `medium_shot` → `medium_shot`, `cowboy_shot` → `cowboy_shot`, `full_body` → `full_body`. Cuando el payload tiene `shot_framing` distinto de auto (o ausente), emite ese tag como el framing tag en vez de auto-inferir del contexto. Es compatible tanto con single-subject como multi-subject (reemplaza el default `medium_shot` que aparece en los ejemplos).

## Seed sections satisfied

- [Seed/PersonaLLM-Reference/04-screens/settings/visual-roleplay.md](../Seed/PersonaLLM-Reference/04-screens/settings/visual-roleplay.md) — Visual Roleplay UI.
- [Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](../Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md) — image refiner.
- v0 extension: shot framing user preference (creator request).

## Schema / RLS

Sin cambios — extensión de JSONB existente.

## Verification

- [ ] **TypeScript**: clean.
- [ ] **Playwright — save/load roundtrip**: cambiar shot_framing a "close-up", recargar, confirmar persistencia.
- [ ] **Playwright — regen con close-up**: `refined_prompt` termina en `close-up` (no `medium_shot`).
- [ ] **Playwright — regen con auto**: refiner elige según contexto (baseline `medium_shot` or similar).

## Implementation order

1. Plan (este).
2. Edit `visualRoleplay.ts` — type + save helper + load parse.
3. Edit `PromptEditor.tsx` — state + handler + radios.
4. Edit `image.py` — read + pass kwarg.
5. Edit `image_refine.py` — kwarg + payload line.
6. Edit `image_refine_system.txt` — SHOT FRAMING section.
7. TS check + touch refiner for reload.
8. Playwright gates.
9. Commit + SESSION_HANDOFF.

## Critical files

| File | Change |
|---|---|
| `frontend/src/lib/visualRoleplay.ts` | `VisualRoleplayShot` type + `saveVisualRoleplayShot` RMW + extend `VisualRoleplayPrefs` |
| `frontend/src/routes/PromptEditor.tsx` | new 6-radio row inside `VisualRoleplayPromptEditor` |
| `backend/app/routes/image.py` | read `shot_framing` pref, validate, forward to refiner |
| `backend/app/agents/image_refine.py` | kwarg + `_build_user_payload` line |
| `backend/app/prompts/image_refine_system.txt` | SHOT FRAMING section |

## Verification

- ✅ **TypeScript**: `npx tsc --noEmit` clean.
- ✅ **UI renders**: Los 6 radios (`auto`, `close-up`, `portrait`, `medium_shot`, `cowboy_shot`, `full_body`) presentes en `/settings/prompt-editor` con testids `pe-vr-shot-*`. Auto checked por default.
- ✅ **Save/load roundtrip**: Seleccionar `cowboy_shot` → DB `users.preferences.visual_roleplay.shot_framing = "cowboy_shot"` (verified via REST).
- ✅ **Refiner applies override — E2E live**: Con `shot_framing=cowboy_shot` en prefs, regen imagen en Evelyn conv. Refined prompt (last 120 chars): `...soft_lighting, cowboy_shot`. NO contiene `medium_shot`. Override funcionó: el refiner emite el tag exacto pedido en vez del default.
- **Regresión Auto**: al dejar en `auto` o cambiar a `auto`, el `shot_framing` pref se guarda como `"auto"` pero el backend lo filtra (allow-set = 5 valores explícitos, todo lo demás → `None`). Resultado: no se envía la línea `shot_framing:` al refiner, que infiere del contexto como antes. Mantengo el comportamiento histórico.
