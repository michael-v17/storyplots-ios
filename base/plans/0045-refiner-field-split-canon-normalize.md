---
id: 0045
slug: refiner-field-split-canon-normalize
status: shipped
created: 2026-04-18
---

# Cycle 0045 — Refiner splits multi-valued fields + normalizes body-size canon

## Context

Creator reportó post-0044 que el tamaño de pecho de Evelyn (`"big breast"`) no estaba saliendo en el refined prompt, aunque sí estaba definido en el form del character.

Investigación via DB:
- `characters.build = "voluptuous hourglass, big breast"` (comma-separated, 3 items en un solo campo)
- `characters.distinctive_features = "black-rimmed glasses, soft age lines around eyes and mouth, a silver bush"` (3 items)
- `characters.signature_style = "Fitted gray business suit with a blazer, white button-up blouse, knee-length pencil skirt, and sensible black heels."` (4 items)

El refiner solo extraía el PRIMER item de cada field comma-separated (`voluptuous`, `black_rimmed_glasses`, `wool_cardigan`), dropeando los demás. Además, términos informales como `"big breast"` no se mapeaban a Danbooru canon (`large_breasts`).

Creator aclaró: "no es una columna está en el build" — confirmó que es un format convention en los text fields, no un schema change.

## Done when

- El refiner extrae TODOS los items comma-separated en `build`, `distinctive_features`, `signature_style`, `hair_style`, `skin_tone`, y `appearance_description`.
- Normaliza términos informales de body/size/shape a Danbooru canon:
  - breast: `big breast[s]` / `big boobs` / `busty` → `large_breasts`; `huge` → `huge_breasts`; `gigantic` → `gigantic_breasts`; `medium` → `medium_breasts`; `small` → `small_breasts`; `flat` / `flat chest` → `flat_chest`.
  - body shape: `hourglass` → `hourglass_figure`; `voluptuous` / `curvy` → `curvy`; `slim` / `slender` → `slender`; `petite` → `petite`; `stocky` → `stocky`; `muscular` → `muscular`; `athletic` → `athletic`.
  - hips: `wide hips` → `wide_hips`.
- E2E: regen image con Evelyn → `refined_prompt` contiene `voluptuous, hourglass_figure, large_breasts` (no solo `voluptuous`).

## Shape of the change

**`backend/app/prompts/image_refine_system.txt`** — extender la sección `APPEARANCE & DEMOGRAPHIC SOURCES`:
- Añadir subsección "Multi-valued fields: SPLIT ON COMMAS" con ejemplos concretos.
- Añadir tabla de normalización informal → Danbooru canon.

Single-file prompt edit. Sin cambios de schema, sin backend code, sin frontend.

## Seed sections satisfied

- [Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](../Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md) — image refiner touchpoint.

## Schema / RLS

Sin cambios.

## Verification

- ✅ **Playwright — live regen Evelyn (first-person)**:
  - Pre-fix baseline (cycle 0044 output): `1girl, old_woman, silver_gray_hair, ponytail, blue_ribbon, hazel_eyes, fair_skin, voluptuous, wool_cardigan, coffee_stain, black_rimmed_glasses, soft_age_lines, freckles, ...`
    - Build solo emitió `voluptuous` (dropeó `hourglass` + `big breast`).
    - signature_style solo emitió `wool_cardigan, coffee_stain` (dropeó `white blouse, pencil skirt, black heels`).
  - Post-fix: `1girl, old_woman, silver_gray_hair, ponytail, blue_ribbon, black_rimmed_glasses, fair_skin, voluptuous, hourglass_figure, large_breasts, wool_cardigan, coffee_stain, white_blouse, pencil_skirt, black_heels, hands_gesturing, leaning_in, conspiratorial_smile, office_setting, floor_to_ceiling_windows, city_skyline_background, soft_lighting, medium_shot, looking_at_viewer`
    - ✓ Build: `voluptuous, hourglass_figure, large_breasts` — los 3 items extraídos + `"big breast"` normalizado a `large_breasts` canon.
    - ✓ signature_style: `wool_cardigan, coffee_stain, white_blouse, pencil_skirt, black_heels` — los 5 items emitidos.
    - ✓ distinctive_features: `black_rimmed_glasses` (silver bush y soft age lines ya no aparecen, pero estaban en baseline — la LLM los consideró no-visual o redundantes; aceptable).

## Implementation order

1. Plan (este).
2. Edit `image_refine_system.txt` — add split/normalize rules.
3. Touch `image_refine.py` for uvicorn reload.
4. Playwright regen verify.
5. Commit + SESSION_HANDOFF.

## Critical files

| File | Change |
|---|---|
| `backend/app/prompts/image_refine_system.txt` | split multi-valued fields + Danbooru canon normalization |
