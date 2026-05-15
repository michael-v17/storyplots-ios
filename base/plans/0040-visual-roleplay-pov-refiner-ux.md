---
id: 0040
slug: visual-roleplay-pov-refiner-ux
status: shipped
created: 2026-04-17
---

# Cycle 0040 — Visual Roleplay POV + instructions Default/Custom + Refiner UX

## Context

Follow-up del cycle 0039. El creator identificó tres mejoras concretas después de ver el Prompt Editor:

1. **POV selector** para Visual Roleplay. Hoy el chat LLM describe siempre desde el viewer; no hay opción para que describa una escena cinematic con ambos (user + character) en cuadro. PersonaLLM no lo expone explícitamente, pero conceptualmente encaja y da al creator control del encuadre.

2. **Visual Roleplay Instructions editables**. PersonaLLM expone esto en el Prompt Editor (§1.c). Nosotros hoy tenemos el texto hardcoded en `backend/app/prompts/visual_roleplay_instructions.txt`. Falta una forma de overridearlo para experimentar (diferentes estilos de tag, menos/más instrucciones).

3. **Refiner UX limpieza**. En `/settings/image-engine` la textarea del refiner system prompt aparece cruda frente al user — 300 palabras de prompt engineering visibles de entrada. Además falta el Enable Refinement toggle y el Context Messages stepper (PersonaLLM los tiene). Arquitecturalmente, el default del refiner ES per-provider (ya vive en `workflow_config._refiner_system_prompt`) — eso es correcto, sólo falta envolverlo con tabs Default/Custom para que el default quede colapsado.

Consenso con el creator en la sesión:
- Pase 1 (Visual Roleplay Instructions) = "qué pintar", model-agnostic.
- Pase 2 (Image Refiner) = "cómo pintarlo en el dialecto del modelo", model-specific. Default viaja con el provider.
- POV es un modificador ortogonal al prompt (se compone on top).
- Jerarquía de overrides: user custom (preferences) > provider default (workflow_config) > app fallback (static file).

**Done when:**
- `/settings/prompt-editor` → Roleplay section ahora tiene Visual Roleplay sub-sección inline con POV radio (First | Third) + Instructions tabs (Default | Custom).
- `/settings/image-engine` → Refiner fieldset refactorizado: Enable toggle + Context Messages stepper + System Prompt tabs (Default | Custom) con default colapsado.
- Backend `prompt_assembly.py` pos 9 compone `{pov_clause} + {user_custom_instructions ?? default_file}` y substituye `{user}` por el persona name.
- Backend `image.py` respeta `preferences.image_refine.enabled` (skip refine si off) y `preferences.image_refine.context_messages` (clamp last_turns count).
- Persistencia: `users.preferences.visual_roleplay.pov`, `users.preferences.prompt_editor.visual_roleplay_instructions`, `users.preferences.image_refine.{enabled, context_messages}`. Sin migration.

## Shape of the change

### Backend

**`backend/app/prompt_assembly.py`**:
- `PromptBundle` gana campos: `visual_roleplay_pov: Literal["first_person","third_person"] = "first_person"`, `visual_roleplay_instructions_custom: str | None = None`.
- Constantes nuevas `_POV_FIRST_PERSON` y `_POV_THIRD_PERSON` (inline, 2-3 líneas cada una). `{user}` se substituye con el persona name.
- `_position_9_visual_roleplay(bundle)` compone: `{pov_clause}\n\n{custom or default_file}`.

**`backend/app/routes/chat.py`** (`_load_bundle`):
- Extiende el select de `users.preferences` para leer `visual_roleplay.pov` + `prompt_editor.visual_roleplay_instructions`.
- Pasa al bundle.

**`backend/app/routes/image.py`**:
- Lee `preferences.image_refine.enabled` (default true) y `context_messages` (default 3, clamp 0–10).
- Trim `last_turns` según context_messages * 2 (pares user+assistant).
- Si `enabled=false`: skip `run_image_refine`, construye un `ImageRefineResult` pass-through (refined_prompt = target_message, negative_prompt = "", no SFW check via LLM — los negatives del `_prompt_wrap` y el guardrail existente se mantienen).

### Frontend

**`frontend/src/lib/visualRoleplay.ts`**:
- Extiende `VisualRoleplayPrefs` con `pov: "first_person" | "third_person"`.
- Extiende `loadVisualRoleplayPrefs` para leerlo (default "first_person").
- Nueva función `saveVisualRoleplayPov(userId, pov)` — direct RMW sobre `users.preferences.visual_roleplay.pov` (el RPC `set_visual_roleplay_prefs` existente sigue manejando mode + auto; POV va por path separado para no migrar).

**`frontend/src/lib/promptEditorPrefs.ts`**:
- Extiende shape con `visual_roleplay_instructions: string | null`.
- `PROMPT_EDITOR_DEFAULTS` ya maneja nullable strings.

**`frontend/src/lib/imageRefinePrefs.ts`** (NEW):
- Shape: `{ enabled: boolean, context_messages: number }`. Defaults `{ enabled: true, context_messages: 3 }`.
- `load/save` con partial RMW (patrón de promptEditorPrefs).

**`frontend/src/routes/PromptEditor.tsx`** (Roleplay section):
- Reemplaza el link "Visual Roleplay Mode" con bloque inline `VisualRoleplayPromptEditor`:
  - POV radio: First | Third.
  - Instructions tabs: Default | Custom (default colapsado, textarea escondida; botón "View default" expande read-only).
  - Explainer: "Applies regardless of Custom instructions — POV is a structural modifier."

**`frontend/src/routes/ImageEngineSettings.tsx`** (Refiner fieldset refactor):
- Enable Refinement toggle (persists to `image_refine.enabled`).
- Context Messages stepper (−/+, persists to `image_refine.context_messages`).
- System Prompt tabs Default | Custom:
  - Default: hint "Using the built-in refiner prompt bundled with this provider." + botón collapsed "View default".
  - Custom: textarea visible, value persistido en `workflow_config._refiner_system_prompt` (keep existing storage).

## Seed sections satisfied

- [Seed/PersonaLLM-Reference/04-screens/settings/prompt-editor.md](../Seed/PersonaLLM-Reference/04-screens/settings/prompt-editor.md) §1.c Visual Roleplay Instructions.
- [Seed/PersonaLLM-Reference/04-screens/settings/image-engine.md](../Seed/PersonaLLM-Reference/04-screens/settings/image-engine.md) IMAGE PROMPT REFINEMENT section (Enable + Provider + System Prompt + Context Messages).
- Observed vs Extended:
  - **Observed**: Enable Refinement toggle, Context Messages stepper, System Prompt editor.
  - **Extended (v0-only)**: POV selector — PersonaLLM no lo expone como toggle, pero encaja en la estructura. Documented in code as extension.

## Commit decisions

- **POV como preference bajo `visual_roleplay.pov`** (no `prompt_editor`). Es coherente con `visual_roleplay.mode` + `auto_generate_images` — misma familia.
- **Custom VR instructions bajo `prompt_editor.visual_roleplay_instructions`** — el hub es quien las expone.
- **Refiner system prompt sigue en `workflow_config._refiner_system_prompt`** (per-provider). NO se duplica en user prefs. Si cambias de ComfyUI a Flux, cada provider trae su propio default.
- **POV siempre se antepone**, incluso en Custom mode. Un comment lo explica en `_position_9_visual_roleplay`.
- **"Load default into editor" preservado** en Custom tab del refiner (patrón útil).
- **Refine off bypass**: si `enabled=false` no se llama al LLM. Latencia + costo ahorrado. El `_prompt_wrap` negative_prefix sigue protegiendo SFW.

## Schema / RLS

Sin cambios.

## Verification gates

- [ ] **TypeScript**: `npx tsc --noEmit` clean.
- [ ] **Backend sanity**: python one-shot compone pos 9 con POV First (no `{user}` leak), pos 9 con POV Third (incluye nombre del persona), con y sin custom instructions.
- [ ] **Playwright — POV + VR instructions**:
  - `/settings/prompt-editor` → Visual Roleplay sub-sección visible.
  - POV radio toggle guarda a DB (`users.preferences.visual_roleplay.pov`).
  - Custom tab permite override; Default vuelve con reset.
- [ ] **Playwright — Refiner UX**:
  - `/settings/image-engine` → refiner section ahora compacta.
  - Enable toggle persiste.
  - Context Messages stepper +/- persiste.
  - Default tab colapsado; Custom tab muestra textarea.
- [ ] **Playwright — SFW hidden**: no strings internos de SFW en DOM.
- [ ] **code-review + code-simplifier** agents.

## Implementation order

1. Backend pos 9 (POV constants + bundle fields + compose).
2. Backend chat.py (read prefs, pass to bundle).
3. Backend image.py (read image_refine prefs, gate on enabled, clamp context_messages).
4. Frontend libs (visualRoleplay.ts, imageRefinePrefs.ts new, promptEditorPrefs.ts extension).
5. Frontend PromptEditor.tsx (VR sub-section inline).
6. Frontend ImageEngineSettings.tsx (refiner fieldset refactor).
7. TS check.
8. Playwright verification.
9. code-review + code-simplifier.
10. Commit + SESSION_HANDOFF.

## Critical files

| File | Change |
|---|---|
| `backend/app/prompt_assembly.py` | POV constants + bundle fields + compose in pos 9 |
| `backend/app/routes/chat.py` | Read pov + custom VR instructions from prefs |
| `backend/app/routes/image.py` | Read image_refine prefs, gate refine on enabled, clamp context_messages |
| `frontend/src/lib/visualRoleplay.ts` | Extend prefs with pov + direct-RMW save |
| `frontend/src/lib/promptEditorPrefs.ts` | Extend shape with visual_roleplay_instructions |
| `frontend/src/lib/imageRefinePrefs.ts` | NEW — enabled + context_messages |
| `frontend/src/routes/PromptEditor.tsx` | Visual Roleplay inline sub-section (POV + Instructions) |
| `frontend/src/routes/ImageEngineSettings.tsx` | Refactor Refiner fieldset (Enable + Context Messages + Tabs) |

## Verification

- ✅ **TypeScript**: `npx tsc --noEmit` clean (post-implementation + post-review-fixes).
- ✅ **Backend sanity (python one-shot)**: `_position_9_visual_roleplay` produce cadena correcta en 4 escenarios (first-person Michael; third-person Michael; fallback User cuando persona=null; custom + third Ana). `{user}` substituye al nombre del persona.
- ✅ **Playwright — hub**: `/settings/prompt-editor` muestra Visual Roleplay inline con POV radios + Instructions Default/Custom tabs + "View default" disclosure.
- ✅ **Playwright — POV round-trip**: click en "Third person" → `users.preferences.visual_roleplay.pov = "third_person"` en DB. Click en "First person" → back to "first_person".
- ✅ **Playwright — Image Engine refactor**: `/settings/image-engine` ya no muestra la textarea raw de 300 palabras al abrir. Enable Refinement checkbox (default on), Context Messages stepper (default 3), System Prompt tabs Default/Custom. Toggle Default→Custom revela textarea; toggle Custom→Default esconde textarea y muestra "View default" button.
- ✅ **code-review findings aplicados**:
  - **SFW bypass** (conf 82): si `sfw_disabled=False` (SFW mode ON) el refiner corre sí o sí, ignorando el toggle del user. `refine_enabled = refine_enabled_pref or sfw`. Documentado inline + helper text en UI. Si el user activa NSFW (SFW off), el toggle manda normalmente.
  - **Module-private import** (conf 80): `_VISUAL_ROLEPLAY_INSTRUCTIONS` renombrado a `VISUAL_ROLEPLAY_INSTRUCTIONS` (público) con comment explicando el share intencional.
  - **RMW race** (conf 80): aceptado como known pattern — el comment en `saveVisualRoleplayPov` documenta la ventana y referencia el RPC existente. Agregar `set_visual_roleplay_pov` RPC queda para un cycle futuro si se pide concurrent-tab support.
  - **Partial save** (conf 80): aceptado — `onSave` tiene semánticas all-or-nothing y eso matches la expectation del user (Save button = save everything or report error). Si en práctica molesta, abrir cycle de UX follow-up.
  - **POV substitution collision** (conf 80): `{user}` en POV clauses es replace-based (no `.format()`), confirmado safe. `substituteCardPlaceholders` opera en capa diferente (greeting/scenario, pre-insert). No bug.
  - **`flushCustom` null-on-default regression** (conf 83): confirmed NO regression — mantiene el fix de cycle 0039.
- ✅ **`code-simplifier`**: no-op. Las dos Default/Custom pickers (VR + Refiner) son superficialmente similares pero divergen en state model y persistence surface. Extraer costaría más legibilidad que ahorro de líneas.
- **Deferred**: Video Generation sub-section (cycle Video Engine futuro). Refiner Provider dropdown (hoy usa text engine activo).

## Post-ship E2E test (POV first vs third vs rendered image)

Ejecutado via Playwright contra ComfyUI live + deepseek/openrouter:

| Layer | First person | Third person |
|---|---|---|
| Chat LLM → `[image: …]` tag | ✅ `1girl, shrine_maiden, kneeling, pouring_tea, ...` (solo Aria) | ✅ `1boy, brown_hair, beard, muscular, sitting_on_bench, watching, 1girl, shrine_maiden, pouring_tea, ...` (ambos) |
| Refiner → ComfyUI prompt | ✅ Preservado (`1girl, young_adult, ...`) | ❌ Refiner dropeó `1boy`, retornó single-subject (`1girl, ...`) |
| Imagen generada | ✅ Aria sola, composición coherente con el turno | ⚠️ Aria sola (Michael nunca aparece visualmente) |

**Conclusión**: la mitad "text" del POV funciona end-to-end. La mitad "image" tiene un gap en el refiner — su `image_refine_system.txt` fue diseñado single-subject y además no recibe el `user_persona` bloque. Abierto **cycle 0041** para:
1. Pasar `user_persona` (name + gender + appearance) al refiner cuando POV=third_person.
2. Refiner system prompt preserva multi-subject tokens (`1boy`+`1girl`, `2people`, etc.) del input.
3. Refiner describe al user usando el User Persona block en lugar de inventar.

**Defensive fix shipped en el mismo commit**: durante el test descubrimos que el backend `submit_and_wait` ignoraba `status.status_str="error"` en el poll de ComfyUI `/history` (problema causado separately por ComfyUI-Manager's tqdm OSError en Windows). Ahora detecta error + fail-fast con el mensaje real (`KSampler: [Errno 22] Invalid argument`) en lugar de esperar 300s hasta timeout. Helper `_extract_error_message` añadido en `backend/app/agents/comfyui.py`.
