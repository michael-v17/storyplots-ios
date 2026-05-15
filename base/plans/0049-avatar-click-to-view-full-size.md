---
id: 0049
slug: avatar-click-to-view-full-size
status: shipped
created: 2026-04-19
---

# Cycle 0049 — Avatar click-to-view full size

## Context

El avatar del character en `/character/:id/edit` se renderiza como un círculo 96×96 con `background-image`. No se puede inspeccionar la imagen completa para verificar detalles (ej. background contextual del cycle 0048, atributos físicos, artefactos SDXL). El creator pidió poder dar click y ver la imagen completa para analizarla.

## Done when

- El círculo de preview del avatar se vuelve clickable cuando hay `avatar_ref` cargado.
- Click abre un lightbox overlay (fullscreen, background semitransparente) con la imagen full-size centrada.
- Close via click en el backdrop, en el botón X, o tecla Escape.
- Image constrained al viewport (no desborda — usa el fix de flex `minHeight: 0` del cycle 0044).
- Sin regenerar / delete / favorite aquí — el form ya tiene su propio Generate Avatar button y la imagen no es un `generated_images` row.

## Shape of the change

**`frontend/src/features/characters/CharacterForm.tsx`** — único archivo tocado:
- Nuevo estado `avatarLightbox: boolean`.
- El `<div>` del avatar preview cambia a `<button type="button">` — clickable, `data-testid="avatar-preview-open"`, disabled cuando no hay url. Cursor `zoom-in` cuando active.
- Nuevo subcomponent `AvatarLightbox` renderizado después del `</form>`:
  - `role="dialog" aria-modal="true"`, `data-testid="avatar-lightbox"`.
  - useEffect con keydown listener para Escape.
  - Click en backdrop cierra; `e.stopPropagation()` en el img y botón close previene close accidental al clickear dentro.
  - Layout: flex column — header con botón X, wrapper flex-1 con `minHeight: 0, overflow: hidden` para que el img `maxHeight: 100%, objectFit: contain` caps al viewport.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) — Character form surface / avatar preview pattern.
- [Seed/PersonaLLM-Reference/04-screens/character-form.md](../Seed/PersonaLLM-Reference/04-screens/character-form.md) — si existe.

## Schema / RLS

Sin cambios.

## Verification

- ✅ TS `npx tsc --noEmit` clean.
- ✅ **Playwright — click avatar**: preview-open button clickable, lightbox renders con `data-testid="avatar-lightbox"`, close button present, img src correctly set, Escape keybind active.
- ✅ **Visual screenshot** (`cycle-0049-avatar-lightbox-loaded.png`): Evelyn avatar rendered a full-size con todos los detalles legibles (silver hair + blue ribbon, glasses, age lines, wool cardigan, office background con windows + skyline + hourglass).

## Implementation order

1. Plan (este).
2. Edit `CharacterForm.tsx`: state + button + lightbox subcomponent.
3. TS check.
4. Playwright visual verify.
5. Commit + SESSION_HANDOFF.

## Critical files

| File | Change |
|---|---|
| `frontend/src/features/characters/CharacterForm.tsx` | preview becomes clickable, new `AvatarLightbox` subcomponent |
