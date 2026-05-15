---
id: 0043
slug: refiner-multi-subject-polish
status: shipped
created: 2026-04-17
---

# Cycle 0043 — Refiner multi-subject polish

## Context

Cycle 0042 E2E live confirmó que el refiner ahora emite multi-subject correcto con count tag + interaction tag + ≤5–6 tags per subject. Dos problemas detectados por el creator al revisar la salida:

1. **Orden de subjects invertido**: el refiner puso al USER primero y al CHARACTER segundo. SDXL sesga hacia el first-listed subject, así que poner al user primero hace que el character (foco de la conversación) pierda presencia. La convención anime Danbooru + UX del producto quieren al character primero.

2. **Slots muy agresivos — character drift**: cap de 5 slots + 1 opcional dejó fuera **skin_tone** y **distinctive_features** (scars, glasses, tattoos, wheelchair). Resultado: entre regens, la misma persona cambia demasiado (piel clara → piel oscura, sin gafas → con gafas). Para identidad consistente multi-subject hace falta un slot dedicado a skin_tone y uno a distinctive_features cuando existan.

3. **Negative prompt doble-contado**: el refiner emite su propia baseline (`lowres, worst_quality, bad_anatomy, deformed_face, extra_fingers` + SFW extras) que `_wrap()` junta con el `negative_prefix` + `negative_suffix` que el user configuró. Resultado: overlap ugly tipo `lowres, ... [baseline], ... lowres, ...`. El creator quiere que SOLO lo que él tipea en los inputs llegue al diffusion — nada auto-inyectado.

## Done when

- Multi-subject output pone al character en el PRIMER `\(...\)` group y al user en el segundo.
- Cada group incluye slot dedicado para `skin_tone` (cuando está disponible en character_appearance / user_persona) y `distinctive_features` (cuando existe una feature identity-defining). Cap sube a 7 tags por subject.
- El refiner retorna `negative_prompt: ""` siempre. El backend `_wrap()` ya pasa through cuando body es vacío, así que el negative final = `negative_prefix + negative_suffix` exactamente. Nada auto-inyectado.
- SFW guardrail sigue vivo vía `sfw_blocked` decision (refuse-to-generate). Las nsfw/nude tags que antes emitía el refiner quedan como responsabilidad del user (ya están en su `negative_prefix` Nova-style por default).
- E2E: regen third-person → character listed first + al menos un feature adicional (skin o distinctive) cuando el character_appearance lo provee + refined.negative_prompt vacío en el DB row.

## Shape of the change

**Solo** `backend/app/prompts/image_refine_system.txt`:

1. **THIRD-PERSON MULTI-SUBJECT section** — reordenar:
   - Ejemplo verbatim invertido: `1boy 1girl, eye_contact, 1girl \(aria,...\), 1boy \(michael,...\), composition` (character primero).
   - Nueva regla explícita: "List the CHARACTER first, the USER second. The character is the focal point of the conversation — SDXL favors the first-listed subject."
   - Slot list expandido a 8 (7 core + 1 optional distinctive):
       1. subject name
       2. age tag
       3. hair color
       4. hair length/style
       5. **skin_tone** (from appearance / persona.appearance.skin_tone)
       6. **build / contextura** (slim, muscular, stocky, petite, tall, plus-size, …)
       7. ONE key clothing/accessory OR one pose
       8. ONE distinctive_feature (scar, eyepatch, tattoo, glasses, wheelchair) — omit if none documented
   - Regla: "Emit skin_tone, build, and distinctive_features whenever the source documents provide them — they are the identity anchors that keep subjects stable across regens."

2. **NEGATIVE PROMPT section** — rescribir: "Always return `negative_prompt: \"\"`. The caller composes the final negative prompt from its own configured prefix/suffix inputs; the refiner no longer contributes baseline negatives."

## Seed sections satisfied

- [Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](../Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md) — image refiner touchpoint.
- [Seed/creator-vision.md](../Seed/creator-vision.md) §8 — SFW guardrail (preserved via `sfw_blocked`, not lost).

## Commit decisions

- **SFW negative tags offloaded to user**: the Nova-style default `negative_prefix` already includes `worst quality, bad quality, deformed, ugly, ...` — a full-coverage list that subsumes the refiner's old 5-tag baseline. The user can add `nsfw, nude, explicit` to their suffix if they want auto-SFW when toggling SFW mode. This simplifies the pipeline: ONE negative source instead of two-that-can-conflict.
- **Distinctive features cap**: emit ONLY ONE distinctive_feature per subject even if the source documents multiple. SDXL with escaped-parens handles 1 distinctive cue reliably; 2+ degrade.
- **Order not parameterized**: character-first is hard-coded in the instructions, not an option. The creator's call.

## Schema / RLS

Sin cambios.

## Verification gates

- [ ] **Python sanity**: call `run_image_refine` against deepseek with pov=third_person + user_persona; confirm refined_prompt lists character (aria) group before user (michael) group AND negative_prompt is "".
- [ ] **Playwright — third-person regen**:
  - `refined_prompt` starts with `1boy 1girl, [interaction?], 1girl \(aria, …\), 1boy \(michael, …\)`.
  - Aria's group includes `pale_skin` or similar skin tag (from her appearance data).
  - Michael's group includes `white_skin` / skin tag (from persona appearance).
  - `refined.negative_prompt` in the DB row is empty string.
- [ ] **`code-review`** + **`code-simplifier`** (may be no-ops given single-file prompt edit).

## Implementation order

1. Plan (este).
2. Edit `image_refine_system.txt`: swap subject order + expand slots + rewrite NEGATIVE PROMPT.
3. Touch `image_refine.py` to force reload.
4. Playwright third-person regen + verify.
5. code-review/code-simplifier (quick).
6. Verification block + commit + SESSION_HANDOFF.

## Critical files

| File | Change |
|---|---|
| `backend/app/prompts/image_refine_system.txt` | reorder multi-subject, expand slots to 7–8, drop refiner's negative emission, JSON-escape instruction |

## Verification

- ✅ **Playwright — third-person regen (live)**:
  ```
  1boy 1girl, facing_each_other,
  1girl \(aria, young_adult, dark_brown_hair, braid, pale_skin, slender, green_robe, prayer_cords\),
  1boy \(michael, mature_male, brown_hair, short_hair, white_skin, muscular, beard\),
  sitting, pouring_tea, clay_cups, wooden_staff, shrine, torii_gate, ancient_cedar_trees, stone_lanterns, misty_afternoon, slanting_light, medium_shot
  ```
  - ✓ CHARACTER listed first (`1girl \(aria,...\)` antes de `1boy \(michael,...\)`).
  - ✓ Backslash-escaped parens preservados — la instrucción explícita sobre JSON double-backslash funcionó (primera regen sin ella los perdió; segunda regen con ella los trae correctos).
  - ✓ Aria slots: name, age, hair_color (dark_brown_hair), hair_length (braid), **skin_tone (pale_skin)**, **build (slender)**, clothing (green_robe), distinctive (prayer_cords) — los 8 slots llenos porque su data es rica.
  - ✓ Michael slots: name, age, hair_color, hair_length, **skin_tone (white_skin)**, **build (muscular)**, distinctive (beard) — 7 slots, dropea clothing/pose slot porque beard es más identity-defining en este contexto.
  - ✓ Interaction tag canon (`facing_each_other`).
- ✅ **Primer regen sin escape JSON hint** (regresión encontrada y corregida en el mismo cycle):
  - La primera regen emitió `1girl (aria,...), 1boy (michael,...)` sin backslashes — confirmó que DeepSeek JSON-mode silenciosamente dropea `\(` porque no es un escape JSON válido.
  - Añadí instrucción explícita: "en JSON output, escribe `\\(` y `\\)` (double backslash)". Segunda regen sí preservó el escape.
  - Lesson reused: cualquier escape SDXL que vive en JSON output strings necesita instrucción explícita sobre el double-backslash.
- ✅ **Negative prompt vacío**: el refiner ahora instruye explícitamente `Always return negative_prompt: ""`; el backend `_wrap(prefix, "", suffix)` ya skippeaba el body vacío (línea 513 de `image.py`), así que el final negative = exactly `negative_prefix + "\n\n" + negative_suffix` que el user configuró. Sin duplicación automática.
- **Residual**: la composition afuera de los paréntesis tiene varios tags (sitting, pouring_tea, clay_cups, wooden_staff, shrine, torii_gate, ...) que podrían simplificarse. Es un nice-to-have, no blocking — SDXL maneja bien tags compositivos múltiples.
- **Code-review / simplifier**: cambio es single-file prompt .txt, no aplica a los agents automatizados. Verificación directa via E2E live sirvió como gate.
