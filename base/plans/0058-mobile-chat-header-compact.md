---
id: 0058
slug: mobile-chat-header-compact
status: shipped
created: 2026-04-19
---

# Cycle 0058 — Mobile chat header compacto

## Context

Creator reportó que en móvil el Chat header ocupa demasiado alto: el `character.tagline` se envuelve a 5 líneas y el `ConversationSwitcher` muestra el título completo junto con `Edit`. Con hamburger + ← + avatar + título + tagline + switcher + Edit + ⋯, el header se siente pesado.

Referencia PersonaLLM (06-chat-interaction-model §header): el header móvil es una fila ceñida con nombre + una descripción corta ellipsizada, y las acciones secundarias se colapsan a iconos.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §mobile-adaptation (implicit — densidad y touch targets).
- [Seed/PersonaLLM-Reference/06-chat-interaction-model.md](../Seed/PersonaLLM-Reference/06-chat-interaction-model.md) header behavior.

## Done when

- [x] `character.tagline` en `ChatShell` header truncado a 1 línea con ellipsis (todas las anchuras).
- [x] `character.name` también trunca si es largo.
- [x] `ConversationSwitcher` toggle: en móvil (bp !== "L") muestra solo `▾` + título sr-only; en desktop muestra título truncado + `▾`.
- [x] `Edit` link en header: en móvil se reemplaza por ✏ icon (aria-label="Edit character").
- [x] `npx tsc --noEmit` verde.
- [x] Playwright @ 375×812: header no se envuelve, ocupa ~1 línea visible bajo avatar.

## Out of scope (deferido)

- Tipografía/spacing global del header (corresponde a la fase de diseño).
- Acciones `⋯` / `←` (ya son iconos).

## Verification

- TypeScript limpio.
- Live @ 1440×900: header desktop sin cambios visibles salvo tagline 1-línea + switcher truncado.
- Live @ 375×812: tagline ellipsis en 1 línea, switcher solo `▾`, Edit como ✏. Header deja de ocupar ~7 líneas.
