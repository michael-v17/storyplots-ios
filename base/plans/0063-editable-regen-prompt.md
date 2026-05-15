---
id: 0063
slug: editable-regen-prompt
status: shipped
created: 2026-04-19
---

# Cycle 0063 — Editable prompt on image regenerate

## Context

El creador pidió poder editar el prompt al regenerar una imagen desde el `ImageViewer`. Hoy el prompt (los tags Danbooru refinados) es read-only — el flujo es:

1. Usuario pulsa "Regenerate with…" en el viewer.
2. Puede editar POV / Shot / Resolution.
3. Backend vuelve a correr el LLM refiner y genera un prompt nuevo a partir del contexto.

Esto es frustrante cuando el refiner alucina un detalle (ej. pose, setting) que el usuario quiere ajustar. Agregar una textarea editable al panel de overrides: si el usuario edita el prompt, el backend lo usa verbatim (skip refiner) envuelto por `_prompt_wrap`.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §Image Viewer.
- [Seed/PersonaLLM-Reference/04-screens/image-viewer.md](../Seed/PersonaLLM-Reference/04-screens/image-viewer.md).

## Done when

- [x] Backend `GenerationOverrides` gana `prompt_override: str | None`. En image.py, cuando viene no-vacío, se salta el refiner LLM y se usa como `refine.refined_prompt` verbatim (sigue pasando por `_prompt_wrap`).
- [x] Frontend `GenerationOverrides` gana `prompt_override?: string`.
- [x] `ImageViewer` agrega `<textarea>` al panel de regen, prellenado con `refined_prompt || prompt`. Si el usuario edita y se regenera, se envía `prompt_override`.
- [x] Si el textarea queda igual al original, no se envía (caso normal → refiner).
- [x] `provider_snapshot.regen_overrides` incluye si se usó `prompt_override` (traza).
- [x] `npx tsc --noEmit` verde.
- [x] Backend: pasa syntax check.

## Out of scope (deferido)

- Cycle 0064: User persona avatar generation (separate cycle por tamaño).
- Editar negative_prompt (rara vez útil, rompe el mental model simple).

## Verification

TS verde, backend syntax OK. Live probable verificado con regen.
