---
id: 0065
slug: framing-aware-refiner
status: shipped
created: 2026-04-19
---

# Cycle 0065 — Framing-aware detail suppression in refiner

## Context

El creador reportó que cuando el encuadre es `close-up`, `portrait` o `cowboy_shot`, el refiner LLM sigue emitiendo tags de bottoms/footwear (pants, shoes, skirt, boots) — esos tags hacen que el checkpoint SDXL tienda a renderizar la escena como full_body aunque el framing tag diga lo contrario, porque el modelo prioriza la presencia de garments concretos sobre el framing verbal.

La solución es educar al refiner para que, en framings cercanos, suprima explícitamente detalles que caen fuera del crop. El sistema ya tiene la sección "SHOT FRAMING" pero sólo dice qué tag usar, no qué tags dejar de emitir.

## Seed sections satisfied

- [Seed/architecture.md](../Seed/architecture.md) §Image refiner (agent-level prompt).

## Done when

- [x] `backend/app/prompts/image_refine_system.txt` gana una sub-sección bajo SHOT FRAMING con reglas de supresión por framing:
  - `close-up`, `portrait`, `upper_body`: no footwear, no legwear, no full-body poses (sitting/walking). Face-focus tags only.
  - `medium_shot`, `cowboy_shot`: no footwear. Pants/skirts OK.
  - `full_body`, `wide_shot`: todo permitido.
- [x] Backend syntax check — es un .txt, verifico que el archivo se carga correctamente.
- [x] Playwright manual no aplica — cambio de prompt LLM. Verificable cuando el creador regenere con close-up.

## Out of scope

- Hard filter en el parsed refined_prompt (ej. post-process que elimine shoe tags si framing=close-up). Preferible confiar en el refiner + eval manual que añadir un filter hardcoded que pueda causar regresiones.

## Verification

El prompt se carga desde archivo; el backend lee en runtime. El creador verifica con un regen real.
