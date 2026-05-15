---
id: 0057
slug: lazy-load-images
status: shipped
created: 2026-04-19
---

# Cycle 0057 — Lazy load images

## Context

Creator pidió fluidez perceibida al cargar imágenes. Auditoría del código:
- `<img>` elements: 5 (MessageImage, ImageViewer, CollapsedUserAvatar, Profile avatar, CharacterForm lightbox).
- Background-image avatars: 9 sitios (character cards, sidebar persona, recent chats, message avatars, gallery tiles, etc.).

Las background-images NO soportan `loading="lazy"` nativo, así que la mejora más alta-impact es:
1. Agregar `loading="lazy" decoding="async"` a todos los `<img>` → el browser difiere download + decode para imágenes fuera del viewport.
2. Gallery.tsx específicamente tiene muchas tiles → convertir su background-image a `<img loading="lazy">` anidado (overlay con `position:absolute inset:0; objectFit:cover`).

Avatares chicos (24-40px) en sidebar/cards NO se convierten a `<img>` — ya están above-the-fold en casi todos los casos y el bookkeeping de swap CSS agrega más complejidad que el ahorro perceptible.

## Seed sections satisfied

- [Seed/design.md](../Seed/design.md) §6 performance / responsiveness (implicit).

## Done when

- [x] MessageImage `<img>` gana `decoding="async"` (ya tenía `loading="lazy"`).
- [x] ImageViewer `<img>` gana `decoding="async"`. Sin `loading="lazy"` (modal → user explícitamente lo abrió; lazy no aplica).
- [x] CollapsedUserAvatar `<img>` gana `loading="lazy" decoding="async"`.
- [x] Profile persona `<img>` gana `loading="lazy" decoding="async"`.
- [x] CharacterForm lightbox `<img>` gana `decoding="async"`.
- [x] Gallery tile convertido de background-image → `<img loading="lazy" decoding="async">` anidado con `position:absolute inset:0; objectFit:cover`.
- [x] `npx tsc --noEmit` verde.

## Out of scope (deferido)

- IntersectionObserver para difererir el fetch del signed URL de avatares antes de que el `<img>` se pinte. Impacto chico en nuestra escala actual; costo alto en código.
- Convertir background-image avatars chicos (24-40px) a `<img>` — above-the-fold en la mayoría de pantallas, ahorro marginal.

## Verification

TypeScript clean. Live perceibido: gallery ahora usa `<img loading="lazy">`, el browser difiere imágenes off-screen hasta que el usuario scrollea cerca. MessageImage dentro del feed se beneficia de `loading="lazy"` cuando el feed es largo y los mensajes viejos están fuera de viewport.
