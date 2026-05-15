---
id: 0060
slug: grammar-dashboard-structure
status: shipped
created: 2026-04-19
---

# Cycle 0060 — Grammar dashboard structure

## Context

El creador marcó que `/grammar` "se ve como una barra": 9 cards verticales idénticos, todos mismo peso visual, sin jerarquía. No es un problema de diseño puro (eso se hará en fase de diseño) sino estructural — la información tiene jerarquía pero la presentación la aplana.

Estructura actual (9 bloques iguales):
1. Detected English Level → valor único (hero natural)
2. Most Common Errors → lista
3. Filler Words → lista
4. Overused Words → lista
5. Connector Analysis → lista
6. AI Narrative Feedback → texto largo
7. Improvement Suggestions → texto largo
8. Reinforcement Performance → valor único
9. Full Correction List → lista scrollable

Agrupación propuesta por naturaleza:
- **Hero row (2-col @ L)**: Detected Level + Reinforcement Performance — ambos son valores únicos resumen.
- **Stats grid (2×2 @ L, 2-col @ M, 1-col @ S)**: Errors + Fillers + Overused + Connectors — todos son listas top-N cortas.
- **Narrative row (2-col @ L)**: AI Feedback + Suggestions — dos bloques de texto largo, uno por columna.
- **Corrections**: Full list al fondo, estructura actual.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §Grammar screen (implicit — dashboard hierarchy).

## Done when

- [x] `routes/Grammar.tsx` reestructurado en 4 secciones con CSS grid responsive.
- [x] Hero card: Level más grande (font-size 1.8em), con label "Detected Level".
- [x] Stat cards: título + count + lista compacta.
- [x] Breakpoints: 1-col en móvil, 2-col @ M/L con auto-fit.
- [x] Mantiene todos los data-testids existentes (Playwright pass-through).
- [x] `npx tsc --noEmit` verde.
- [x] Playwright gates L y S OK.

## Out of scope (deferido)

- Diseño (tipografía, colors, gradients): fase de diseño futura.
- Collapsible "Full Correction List": por ahora queda abierto con scroll interno.

## Verification

TypeScript verde, Playwright verde 1440×900 y 375×812.
