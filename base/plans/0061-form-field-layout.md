---
id: 0061
slug: form-field-layout
status: shipped
created: 2026-04-19
---

# Cycle 0061 — Form field layout (label-above-input)

## Context

El creador observó que los forms de `CharacterForm` y `Profile` se ven "desordenados": los inputs quedan a la derecha de la etiqueta o tomando ancho default del navegador. PersonaLLM-Reference muestra consistentemente label-arriba + input full-width (ver character-info.md §3.b Basic Info, Personality, Goals & Worldbuilding — todos son listas verticales de campos con label encima e input/textarea que toma el ancho del card).

Esto es estructural (distribución de label vs input), no cosmético (tipografía/colores). Se arregla ahora en lugar de esperar a la fase de diseño.

Estrategia: opt-in vía `data-form="stack"` en los `<form>` afectados + reglas CSS globales en `index.html` que apliquen `display:block / width:100%` a inputs/textareas/selects dentro de labels del form. Mantiene backward compat (sólo los forms marcados se ven afectados; checkboxes/radios excluidos del full-width).

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §Character editor / Profile.
- [Seed/PersonaLLM-Reference/04-screens/character-info.md](../Seed/PersonaLLM-Reference/04-screens/character-info.md) §3.b.
- [Seed/PersonaLLM-Reference/04-screens/user-profile.md](../Seed/PersonaLLM-Reference/04-screens/user-profile.md) (form layout).

## Done when

- [x] `frontend/index.html` CSS block con reglas `[data-form="stack"] label { display:block }` + inputs full-width + padding/border consistente, excluyendo `input[type="checkbox"]`, `input[type="radio"]`, `input[type="file"]`.
- [x] `features/characters/CharacterForm.tsx` — `<form data-form="stack">`.
- [x] `routes/Profile.tsx` — `<form data-form="stack">`.
- [x] `npx tsc --noEmit` verde.
- [x] Playwright verifica CharacterForm y Profile live (inputs toman el ancho del card).

## Out of scope (deferido)

- Tipografía, colores, focus ring definitivo — fase de diseño.
- Otros forms del app: Settings sub-páginas se migran en futuro si muestran el mismo pattern (corto alcance aquí).

## Verification

TypeScript verde. Playwright verde en 1440 y 375.
