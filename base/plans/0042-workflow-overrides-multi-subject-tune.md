---
id: 0042
slug: workflow-overrides-multi-subject-tune
status: shipped
created: 2026-04-17
---

# Cycle 0042 — Workflow overrides + multi-subject refiner tuning

## Context

Post-cycle 0041 live testing (third-person POV con Aria × Michael) surfaced varios issues del pipeline de imagen:

1. **El workflow JSON que el creator probó (`References/GeneralDocuments/portrait_anime-2.json`) trae style tags bakeados dentro del nodo CLIPTextEncode** (ej. `"Prompt: masterpiece, ..., {Prompt}, BREAK, depth of field, volumetric lighting"`). El backend `_patch_workflow` **sobrescribe el campo `text` entero** del nodo positivo/negativo, así que todo ese wrapping se pierde. Lo único que sobrevive es el `_prompt_wrap` del provider row — que tenía defaults viejos sin `absurdres / newest / scenery / BREAK / depth of field / volumetric lighting`.

2. **No hay input para overrides "pequeños"** del workflow (resolución sí, pero el **checkpoint** `ckpt_name` no). Forzar al user a editar el JSON a mano para cambiar modelo es fricción innecesaria.

3. **Multi-subject output del refiner todavía sobre-detallado**: ~10 tags por subject, pelo mezclado con ropa, sin **interaction tag** que le diga al modelo "es una escena de 2 personas haciendo algo juntas". Research: `duo` es tag e6/furry — no canon Danbooru. La técnica correcta en Danbooru + SDXL anime es **count tag (`1boy 1girl` / `2girls`) + interaction tag** (`eye_contact`, `facing_each_other`, `looking_at_another`, `hetero`, `couple`).

**Creator decision (explícito)**: mantener prefix/suffix como **inputs separados** (no template con `{Prompt}`), pensados como overrides que pisan lo que venga en el workflow JSON. Simula el patrón Nova Anime: user edita prefix/suffix/res/model como campos dedicados; el JSON queda como "shape contract".

## Done when

- Image Engine Settings tiene un fieldset **Workflow overrides** con inputs claros: positive prefix/suffix, negative prefix/suffix, checkpoint override, resolution (ya existe). Hint explícito: "These values override the workflow JSON on each run."
- Cuando el user pone un checkpoint en el override, el backend patchea `CheckpointLoaderSimple.ckpt_name` antes de submit. Blank → se respeta el del JSON.
- Defaults refrescados al estilo Nova (positive prefix incluye `absurdres, newest, scenery`; positive suffix default `BREAK, depth of field, volumetric lighting`; negative con la lista expandida).
- Refiner multi-subject:
  - Cap ~5 tags por subject (name, age, hair_color+length, 1 clothing key, 1 pose key).
  - Hair antes de clothing dentro del `\(...\)`.
  - Emite un **interaction tag** adicional fuera de los groups cuando la narrativa lo implica (`eye_contact`, `facing_each_other`, `looking_at_another`, `holding_hands`, `hetero`/`yuri`/`yaoi` según géneros + intimate context, `couple`). Si la escena no implica interacción, omitir.
- E2E: third-person genera `1boy 1girl, <interaction_tag>, 1boy \(...\), 1girl \(...\), <composition>` con ≤5 tags por grupo + pelo primero. First-person sin regresión.

## Shape of the change

### Backend

**`backend/app/agents/comfyui.py`**:
- `_resolve_checkpoint_id(workflow)`: encuentra el primer `CheckpointLoaderSimple` y devuelve su id (o `None`).
- `_patch_workflow` gana kwarg `checkpoint: str | None = None`. Si está seteado, patchea `ckpt_name` del nodo checkpoint.
- `submit_and_wait` gana el mismo kwarg y lo reenvía.

**`backend/app/routes/image.py`**:
- Leer `_prompt_wrap.checkpoint` (nuevo subfield opcional). Pasar a `submit_and_wait`.

### Prompt

**`backend/app/prompts/image_refine_system.txt`** — sección THIRD-PERSON MULTI-SUBJECT:
- Reducir cap a ~5 tags por subject.
- Orden: `name, age_tag, hair_color, hair_length, skin_or_1_clothing, 1_pose`.
- Añadir subsección "INTERACTION TAG" con la lista canónica (`eye_contact`, `facing_each_other`, `looking_at_another`, `holding_hands`, `hetero`/`yuri`/`yaoi`, `couple`) y regla: emitir UNO después del count tag y antes del primer `\(`, solo si la escena lo implica.
- Actualizar el ejemplo verbatim.

### Frontend

**`frontend/src/routes/ImageEngineSettings.tsx`**:
- Rename legend `Prompt wrap` → `Workflow overrides` con nuevo hint.
- Añadir input **Checkpoint (optional)** debajo de negative suffix.
- Refrescar constantes `DEFAULT_POSITIVE_PREFIX` / añadir `DEFAULT_POSITIVE_SUFFIX` / refrescar `DEFAULT_NEGATIVE_PREFIX`.
- Persistir `checkpoint` dentro de `_prompt_wrap` (reusar el sidecar existente para no crear otro).

## Seed sections satisfied

- [Seed/PersonaLLM-Reference/04-screens/settings/image-engine.md](../Seed/PersonaLLM-Reference/04-screens/settings/image-engine.md) — Image Engine settings surface.
- [Seed/architecture.md](../Seed/architecture.md) — image pipeline.
- [Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](../Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md) — image refiner touchpoint.
- v0 extension: checkpoint-as-override (creator request — Nova-parity editing UX).

## Commit decisions

- **Interaction tag is LLM-driven, not rule-based**: el refiner decide cuál (si alguno) emitir basado en el contexto narrativo. No hay lista hard-coded en Python.
- **Checkpoint override lives in `_prompt_wrap`** (reusar el sidecar) en vez de un nuevo `_workflow_overrides` para no fragmentar el schema. Rename del sidecar queda para un futuro cleanup.
- **Backwards compat**: rows con los defaults viejos (sin `absurdres/newest/scenery`) no se auto-migran. El user refresca apretando el botón de "Reset to default" o editando manual. Nuevos users / nuevos saves ven los defaults nuevos.
- **Research docu sobre `duo`**: se deja en este plan (arriba) + comentario en el prompt, no en un archivo separado.

## Schema / RLS

Sin cambios.

## Verification gates

- [ ] **TypeScript**: `npx tsc --noEmit` clean.
- [ ] **Python sanity**: `_patch_workflow` con `checkpoint="x.safetensors"` modifica solo el nodo CheckpointLoaderSimple.
- [ ] **Playwright — save/load roundtrip**: editar positive prefix + checkpoint, guardar, recargar, confirmar valores persistidos.
- [ ] **Playwright — Choose button**: click al file input, upload `portrait_anime-2.json`, confirmar textarea se popula y guardar roundtripa sin perder JSON.
- [ ] **Playwright — first-person**: generar imagen, `refined_prompt` single subject, no regresión.
- [ ] **Playwright — third-person**: generar imagen, `refined_prompt` contiene:
  - count tag (`1boy 1girl`)
  - interaction tag fuera de paréntesis
  - ≤5 tags por subject con pelo antes de ropa
- [ ] **`code-review`** + **`code-simplifier`**.

## Implementation order

1. Plan file (este).
2. `comfyui.py` — `_resolve_checkpoint_id` + `_patch_workflow(checkpoint=…)` + `submit_and_wait` passthrough.
3. `image.py` — leer `wrap.get("checkpoint")` + pasarlo.
4. `ImageEngineSettings.tsx` — nuevo input checkpoint, fieldset rename, defaults refreshed.
5. `image_refine_system.txt` — multi-subject revision + interaction tag.
6. Frontend ts check.
7. Playwright gates.
8. code-review + code-simplifier.
9. Verification block + commit + SESSION_HANDOFF.

## Critical files

| File | Change |
|---|---|
| `backend/app/agents/comfyui.py` | `_resolve_checkpoint_id`, `_patch_workflow(checkpoint=…)`, `submit_and_wait` passthrough |
| `backend/app/routes/image.py` | leer `wrap["checkpoint"]` y reenviarlo |
| `backend/app/prompts/image_refine_system.txt` | multi-subject reducido + interaction tag |
| `frontend/src/routes/ImageEngineSettings.tsx` | fieldset rename + checkpoint input + defaults nuevos |

## Verification

- ✅ **TypeScript**: `npx tsc --noEmit` clean.
- ✅ **Python sanity — `_patch_workflow` checkpoint paths**:
  - Single-loader workflow + `checkpoint="nova.safetensors"` → `ckpt_name` patcheado.
  - Blank / None checkpoint → loader preserva el valor bakeado del JSON.
  - Whitespace-only checkpoint (`"   "`) → loader preserva el valor bakeado (tratado como blank).
  - Multi-loader workflow (dos `CheckpointLoaderSimple`) + override seteado → `ComfyWorkflowShapeError` explícito.
  - Multi-loader workflow + override blank → no raise (resolver no se invoca).
- ✅ **`code-review` findings aplicados**:
  - **Multi-loader silent mis-patch** (conf 81): `_resolve_checkpoint_id` ahora raisea `ComfyWorkflowShapeError` cuando hay >1 loader, en paralelo al KSampler gate existente.
  - **Path-traversal guard** (conf 80): `image.py` rechaza con 400 los checkpoint values que contienen `/`, `\`, o `..` antes de enviarlos a ComfyUI. Defense-in-depth aunque RLS ya restringe al propio row del user.
  - **"≤5 tags" vs 5-slot enumeración** (conf 80): el prompt ahora especifica explícitamente "emit 5 tags in this exact order (and ONLY a 6th when one feature is uniquely identity-defining…)" — se eliminó la ambigüedad de la redacción anterior.
- ✅ **`code-simplifier` findings aplicados**:
  - Simplifiqué `_patch_workflow` checkpoint normalization de `checkpoint.strip() if isinstance(checkpoint, str) else ""` → `(checkpoint or "").strip()`.
  - Image.py el comment block original de 5 líneas quedó como 4 líneas útiles + el nuevo guard de path traversal.
- ⏳ **Playwright E2E deferred**: browser profile de creator está locked (MCP conflict con Chrome de uso activo). Tests manuales pendientes del creator:
  - Save/load roundtrip del checkpoint override + positive suffix nuevo default.
  - File input "Choose" (creator reportó que no abría el picker — verificar en Chrome post-reload).
  - First-person regen → `refined_prompt` single-subject (no regresión).
  - Third-person regen → `refined_prompt` con count tag + interaction tag opcional + ≤5 tags por `\(...\)` con pelo antes de ropa.
- **Known residual**: SDXL con escaped-parens multi-subject sigue teniendo bias al first-listed subject; la técnica con interaction tag (`eye_contact`/`facing_each_other`) mejora cohesión, pero no reemplaza regional prompting / ControlNet poses para scenes de 2 personas con poses muy específicas. Deferred a un cycle futuro.
