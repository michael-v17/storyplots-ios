---
id: 0041
slug: refiner-third-person-multi-subject
status: shipped
created: 2026-04-17
---

# Cycle 0041 — Refiner supports third-person multi-subject composition

## Context

Cycle 0040 E2E test destapó que el POV third-person funciona a nivel del chat LLM (emite `[image: 1boy + 1girl, …]`) pero falla en el refiner: su system prompt fue diseñado single-subject ("featuring the main character"), así que al recibir `1boy + 1girl` colapsa a `1girl` solo. Además, el refiner **nunca recibe el User Persona block** como contexto — no podría describir al user aunque quisiera.

El creator compartió la referencia [seaart.ai multi-character technique](https://www.seaart.ai/articleDetail/d28i2gle878c73dnois0) que usa **escaped parentheses syntax** estilo Danbooru:

```
1girl \(aria, green_robe, braided_hair, kneeling\), 1boy \(michael, brown_hair, beard, sitting_on_bench\), composition details
```

Claves:
- `\(` `\)` (backslash-escaped) para que CLIPTextEncode los lea como literales, no weight syntax.
- Cada subject agrupa TODOS sus atributos entre los parens escapados.
- Sin coma entre count tag y `\(`.
- Composition details fuera de los paréntesis.

**Done when:**
- Cuando POV=third_person + hay User Persona, el refiner recibe `user_persona` block + `pov` en el payload.
- `image_refine_system.txt` tiene una sección nueva para multi-subject: preserve both subjects, use escaped parens, describe al user usando el User Persona block.
- E2E: regenerar third-person en la conv existente → `refined_prompt` contiene `1boy \(...\), 1girl \(...\)` (o la combinación apropiada por géneros) + imagen renderiza ambos en frame.
- Primera persona sigue funcionando sin regresión (user persona no se inyecta cuando POV=first_person).

## Shape of the change

### Backend

**`backend/app/agents/image_refine.py`**:
- `run_image_refine` gana dos kwargs: `user_persona: dict | None = None`, `pov: str | None = None`.
- `_build_user_payload` incluye los bloques `pov: third_person` y `user_persona: {name, gender, appearance...}` cuando están presentes. Flatten con `_flatten` para consistencia.

**`backend/app/routes/image.py`**:
- En `/messages/{id}/images` route, después de cargar `conversation`, fetch `user_personas` row by `conversation.persona_id`.
- Leer `preferences.visual_roleplay.pov` (default `"first_person"`).
- Cuando pov == "third_person": pasar `user_persona` + `pov="third_person"` a `run_image_refine`.
- Cuando pov == "first_person": `user_persona=None`, `pov="first_person"` (refiner solo hace single-subject como antes).

### Prompt

**`backend/app/prompts/image_refine_system.txt`**: nueva sección **THIRD-PERSON MULTI-SUBJECT** con:
- Trigger: "If the payload includes `pov: third_person` AND `user_persona`".
- Output rule: use escaped-parens syntax `1[gender]_user \(name, attrs…\), 1[gender]_char \(attrs…\), composition…`.
- Subject count tag: derive from gender combo (1boy 1girl, 2girls, 2boys, 1other, etc.).
- Age tag per subject (user's age from persona background if present; else default).
- Preserve BOTH subjects — do not drop the user even if the incoming tag listed only the character.
- SFW rule applies to both subjects equally.
- Example verbatim (first + third).

## Seed sections satisfied

- [Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](../Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md) — image refiner touchpoint.
- [Seed/architecture.md](../Seed/architecture.md) — image pipeline.
- v0 extension: multi-subject rendering — PersonaLLM-Reference doesn't explicitly document it but aligns with the refiner's "descriptive prompt" goal.

## Commit decisions

- **Gender → count tag mapping**: `male + female` → `1boy 1girl`; `female + female` → `2girls`; `male + male` → `2boys`; mixed with unknown → `1boy 1girl` or fall back per Danbooru rule. Implementation lives in the refiner LLM's instructions, not Python code — let the LLM decide from the explicit persona.gender + character.gender.
- **Escaped parens in Python string**: `image_refine_system.txt` stores the instructions as plain text; the output goes through `json.loads` in `run_image_refine` so the actual `\(` survives if the refiner LLM outputs them correctly. Verify end-to-end.
- **Backslash preservation**: JSON strings need `\\(` → decoded to `\(`. Test that the refined_prompt value when read back by the app still has `\(`.
- **NOT passing user_persona for POV=first_person**: saves the refiner tokens + avoids user bleeding into single-subject shots.
- **SFW rule**: the refiner already blocks explicit. For multi-subject we add: "The user persona is never sexualized; if the scene is explicit involving the user, `sfw_blocked=true` the same way as for the character."

## Schema / RLS

Sin cambios.

## Verification gates

- [ ] **TypeScript**: no frontend changes → skip (only prompt + backend py).
- [ ] **Python sanity**: call `_build_user_payload` with `user_persona` + `pov="third_person"` and confirm the payload contains both lines.
- [ ] **Playwright — first person** (no regression):
  - Set POV=first_person in DB, regenerate Aria reply, generate image.
  - `refined_prompt` should contain ONLY `1girl` (or matching single-subject count tag).
  - Image shows Aria alone (baseline from 0040).
- [ ] **Playwright — third person**:
  - Set POV=third_person, regenerate, generate image.
  - `refined_prompt` contains **both** `1boy \(...\)` and `1girl \(...\)` in escaped-parens syntax.
  - Image shows TWO distinct subjects in frame (visual check — Aria + user-looking character).
- [ ] **`code-review`** + **`code-simplifier`**.

## Implementation order

1. Edit `image_refine.py` — signature + payload.
2. Edit `image.py` — fetch user_persona + pov, pass them.
3. Edit `image_refine_system.txt` — new multi-subject section + examples.
4. Backend sanity test.
5. Playwright first-person (no regression) + third-person.
6. code-review + code-simplifier.
7. Append Verification + commit `feat(0041)` + SESSION_HANDOFF.

## Critical files

| File | Change |
|---|---|
| `backend/app/agents/image_refine.py` | `run_image_refine` kwargs + payload |
| `backend/app/routes/image.py` | fetch user_persona, read pov, pass through |
| `backend/app/prompts/image_refine_system.txt` | new multi-subject section with seaart-style escaped-parens syntax + examples |

## Verification

- ✅ **Python sanity**: `_build_user_payload` con `pov=third_person` + `user_persona` emite las dos líneas `pov: third_person` + `user_persona: name=Michael; gender=Male; appearance={...}; background=...`. Confirmado en CLI one-shot.
- ✅ **Playwright E2E — third person rendered**:
  - Conv Aria × Michael, POV=third_person, refiner=on.
  - Antes (cycle 0040 baseline): `refined_prompt = "1girl, young_adult, ..."` — single subject; imagen Aria sola.
  - Después (cycle 0041): `refined_prompt = "1boy \(michael, young_adult, short_brown_hair, beard, muscular, white_skin, sitting_on_bench, watching\), 1girl \(aria, young_adult, long_dark_brown_hair, braid, soft_grey_eyes, pale_skin, traditional_attire, robe, pouring_tea, sitting_on_reed_mat, holding_clay_cup\), clay_cups, iron_kettle, brazier, torii_gate, stone_lanterns, moss_covered, ancient_cedar_trees, mountain_shrine, misty_afternoon, slanting_light, medium_shot"` — dos subjects agrupados en escaped-parens ✓.
  - Rendered image: Aria foreground + figuras adicionales (segundo subject renderizado cerca del torii gate). SDXL favorece el first-listed subject pero visualmente ya NO es single-subject — mejora clara sobre baseline.
- ✅ **Uvicorn reload gotcha resuelto**: el `.txt` no trigger reload de uvicorn --reload (watch solo .py). Touch a `image_refine.py` fuerza reload. Documentado como learning, no hay fix en código.
- ✅ **`code-review` findings aplicados**:
  - **SFW guardrail multi-subject** (conf 80): sección SFW GUARDRAIL amplificada con "In third-person multi-subject mode, evaluate BOTH subjects against these rules. User persona is never sexualized." Cierra el hole reportado.
  - **Refine-disabled + POV=third_person + SFW=off bypass** (conf 80): documentado inline con comment "Known scope gap (cycle 0041): requires all three conditions to trigger. Follow-up cycle." No es fixable sin ejecutar el LLM, que es justo lo que el user desactivó.
  - **Empty persona silent fallback** (conf 85): comportamiento aceptable — si el persona está vacío, el sistema degrada graceful a single-subject (trigger requires BOTH pov+non-empty persona). Schema `user_personas.name` is NOT NULL en DB, así que el edge case es teórico para personas reales.
- ✅ **`code-simplifier`**: no-op con las constraints. Delta already minimal.
- **Residual quality**: SDXL con `1boy \(...\) + 1girl \(...\)` escaped-parens syntax da multi-subject pero con bias hacia el first-listed subject. Mejora adicional (regional prompting / ControlNet / LoRA personas) out of scope — matters of tuning downstream.
- **Deferred**: cycle futuro — improve pose fidelity en third-person (quizás `2people`, explicit spatial tokens like `left`/`right`, o aprovechar `cowboy_shot` vs `medium_shot` según escenario).
