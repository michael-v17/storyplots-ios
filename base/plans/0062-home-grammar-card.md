---
id: 0062
slug: home-grammar-card
status: shipped
created: 2026-04-19
---

# Cycle 0062 — Home grammar snapshot as a card

## Context

Creator reportó que el snapshot de Grammar en Home "se ve solo como una línea que corta la pantalla, es raro". El elemento actual (`snapshotStyle` en `routes/Home.tsx`) es un `<Link>` full-width fuera del `<main>` con `borderTop`, padding 0.5rem — visualmente es una barra/strip que parte la pantalla a lo ancho.

Reestructurar como un card dentro del `<main>` con título + contenido en 2-col (level a la izquierda, top errors a la derecha), alineado al mismo `maxWidth` que el grid de characters. Fuera de fase de diseño — cambio puramente estructural.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §Home — Grammar snapshot es una widget secundaria, no un footer bar.
- [Seed/PersonaLLM-Reference/04-screens/home.md](../Seed/PersonaLLM-Reference/04-screens/home.md) — Home es grid-card layout, widgets como cards.

## Done when

- [x] Snapshot movido dentro del `<main>` como card con borde + radius + padding.
- [x] Layout 2-col: level (hero) + top 3 errors (lista compacta con counts).
- [x] Se mantiene `data-testid="grammar-snapshot"` + el `<Link to="/grammar">`.
- [x] Sólo se renderiza si `grammarMasterOn && grammarSnapshot?.detected_level` (misma condición).
- [x] `npx tsc --noEmit` verde.
- [x] Playwright live OK.

## Verification

TypeScript verde, Playwright live verde.
