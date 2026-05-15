---
id: 0064
slug: persona-avatar-generate
status: shipped
created: 2026-04-19
---

# Cycle 0064 — User persona avatar via AI

## Context

En `Profile.tsx` el botón "Generate photo" está disabled ("Configure an image provider in Settings"). El creador pidió que, igual que un Character tiene Generate Avatar con AI, la User Persona también pueda generar su foto con el engine de imágenes.

Los personas tienen menos datos que los characters (solo name + gender + appearance {skin, eyes, hair, extras} + background_story). Se reutiliza toda la infraestructura de `avatar_generate.py` — solo cambia el prompt-build y la tabla destino (`user_personas` en vez de `characters`).

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §Profile.
- [Seed/PersonaLLM-Reference/04-screens/user-profile.md](../Seed/PersonaLLM-Reference/04-screens/user-profile.md).

## Done when

- [x] Backend: nuevo endpoint `POST /personas/me/generate-avatar` en `avatar_generate.py`. Loads persona via RLS → image engine → builds portrait prompt from persona fields → submits → uploads `avatars/{user_id}/persona-{ts}.png` → updates `user_personas.photo_ref`.
- [x] `_build_persona_portrait_prompt()` helper que mapea appearance.{skin,eyes,hair,extras} a los tokens boosted weights (eye_color, skin_tone, hair_color como hair, distinctive_features como extras). Sin age_tier (personas no tienen age) — usa sólo gender token + prefijo + skin/eyes/hair/extras + suffix.
- [x] Frontend `generatePersonaAvatar()` en `avatarGenerate.ts`.
- [x] `Profile.tsx` — nuevo `PersonaAvatarGenerate` inline (idle → generar → error/no_engine). El botón "Generate photo" ya no disabled.
- [x] `npx tsc --noEmit` verde.
- [x] Backend syntax OK.

## Out of scope (deferido)

- Context-aware background refine (personas no tienen narrative context; el avatar usa "simple background" fijo).
- Locked seed (personas no tienen `image_seed`; random cada vez).

## Verification

TS verde, backend syntax OK, endpoint registrado en el router existente.
