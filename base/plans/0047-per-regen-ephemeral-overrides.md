---
id: 0047
slug: per-regen-ephemeral-overrides
status: shipped
created: 2026-04-18
---

# Cycle 0047 — Per-regen ephemeral overrides in ImageViewer

## Context

Post-0046 creator pidió poder iterar una escena desde el lightbox SIN tocar las preferences globales. Caso de uso: abrir una imagen, decir "regenerate con POV=third + close-up + portrait 1280x1664 solo esta vez", ver el resultado, y que las prefs globales queden como estaban.

## Done when

- En `ImageViewer` hay un segundo botón "⚙ Regenerate with…" que despliega un panel con 3 selects (POV, Shot, Resolution), cada uno con opción "Inherit" (usa el global) y los valores válidos.
- Al click en "Regenerate" (o su variante "Regenerate with overrides"), se envía al backend solo los campos overrideados; los "Inherit" se omiten del body.
- Backend `/messages/{id}/images` acepta un body opcional `GenerationOverrides` pydantic. Cuando está presente, cada campo pisa la preferencia correspondiente SOLO para este call. Ningún write a `users.preferences`.
- Validación: `pov` contra `{first_person, third_person}`, `shot_framing` contra el allow-set canon, `resolution_preset` pasa por `_preset_to_dims` como siempre.
- `provider_snapshot` del row graba `regen_overrides` + los valores efectivos (`pov`, `shot_framing`, `resolution_preset`) para trazabilidad.
- Gallery viewer retains current behavior (no regen possible ahí).

## Shape of the change

### Frontend
- **`frontend/src/lib/images.ts`**: nuevo type `GenerationOverrides`; `generateImageForMessage` gana segundo parámetro opcional; solo envía body cuando hay al menos un campo seteado.
- **`frontend/src/features/chat/ImageViewer.tsx`**: estado `ovPov` / `ovShot` / `ovRes` con default `"inherit"`; nuevo panel collapsible (`viewer-regen-panel`); botón toggle (`viewer-regenerate-toggle`) que muestra/oculta el panel; label dinámico en el botón regen ("Regenerate" vs "Regenerate with overrides") según si hay campos distintos de inherit.
- **`frontend/src/features/chat/ChatShell.tsx`**: `onGenerateImage(m, overrides?)` + ViewerImage `onRegenerate` ahora recibe `overrides` y se los pasa.
- **`frontend/src/routes/Gallery.tsx`**: signature compatible por covariance (`() => void` se asigna a `(o?) => void`).

### Backend
- **`backend/app/routes/image.py`**:
  - Nuevo pydantic `GenerationOverrides` (pov / shot_framing / resolution_preset, todos opcionales).
  - `generate_image_for_message(message_id, overrides: GenerationOverrides | None = None, ...)`.
  - `pov_source = override_pov if override_pov in (...) else vr_prefs_raw.get("pov")`.
  - `_raw_shot = override_shot if isinstance(override_shot, str) else vr_prefs_raw.get("shot_framing")` (mantiene la validación contra allow-set después).
  - `override_preset = overrides.resolution_preset if overrides else None; preset_effective = override_preset or ccs.resolution_preset or prefs_pref`.
  - `provider_snapshot` gana `pov`, `shot_framing`, `regen_overrides`.

## Schema / RLS

Sin cambios.

## Verification

- ✅ **TypeScript**: clean.
- ✅ **Python sanity** — `GenerationOverrides` pydantic acepta empty / partial / full construction.
- ✅ **E2E — fetch body capture**: Monkey-patched window.fetch en Playwright para capturar el POST body. Resultado: `{"pov":"third_person","shot_framing":"close-up","resolution_preset":"portrait"}` enviado correctamente.
- ✅ **E2E — backend aplicó overrides**:
  - `provider_snapshot.regen_overrides`: `{pov: third_person, shot_framing: close-up, resolution_preset: portrait}`
  - `provider_snapshot.resolution_preset`: `portrait` (dims 1280×1664)
  - `provider_snapshot.pov`: `third_person`
  - `provider_snapshot.shot_framing`: `close-up`
  - Refined_prompt reflejó POV override (refiner llamado con pov=third_person).
- ✅ **Globals no cambiaron**: `users.preferences.visual_roleplay.pov` se mantuvo en `first_person` (distinto al override `third_person`). Ningún `supabase.update` en el path de override — verificación por inspección de código + live.
- **Side-note**: la imagen resultante salió single-subject aunque el override pidió third-person, porque la conv de Evelyn no tiene `persona_id` asignado. La regla del refiner cycle 0041 requiere "pov=third_person AND non-empty user_persona" para activar multi-subject. Comportamiento consistente preexistente, no bug de este cycle.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) — Image viewer surface.
- [Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](../Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md) — image refiner touchpoint (same as 0046).

## Critical files

| File | Change |
|---|---|
| `frontend/src/lib/images.ts` | `GenerationOverrides` type + extended `generateImageForMessage` |
| `frontend/src/features/chat/ImageViewer.tsx` | Overrides panel + toggle + dynamic label |
| `frontend/src/features/chat/ChatShell.tsx` | `onGenerateImage(m, overrides?)` passthrough |
| `backend/app/routes/image.py` | `GenerationOverrides` model + param + override-aware resolve chain + snapshot fields |
