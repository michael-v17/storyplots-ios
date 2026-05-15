---
id: 0044
slug: first-person-enforcement-viewer-fixes
status: shipped
created: 2026-04-18
---

# Cycle 0044 — First-person POV enforcement + viewer + streaming fixes

## Context

Live QA surfaced three concrete bugs:

1. **POV=first_person produce imágenes multi-subject.** DB confirmado `visual_roleplay.pov=first_person`, pero el chat LLM emite tags `[image: 1boy, ..., 1elderly_woman, ...]` con ambos subjects, y el refiner los preserva (siguiendo la regla cycle 0041 "NEVER drop a subject"). Resultado: Evelyn + Michael abrazados en la foto aunque first-person pide solo-Evelyn. Dos lugares fallan:
   - (a) `_POV_FIRST_PERSON` en `prompt_assembly.py` dice "{user} not in frame" pero no da guía explícita sobre qué poner / NO poner dentro del `[image: ...]` tag. El LLM interpreta "first-person" como narrativa ("hablo desde Evelyn") y mete los dos cuerpos en la caption.
   - (b) `image_refine_system.txt` solo activa la sección THIRD-PERSON MULTI-SUBJECT cuando el payload tiene `pov=third_person + user_persona`. Pero cuando `pov=first_person` y el input ya trae dos subjects, no tiene regla defensiva que colapse a single-subject.

2. **Prompt flash en el feed durante SSE.** `TypographicText` usa `extractImageTag(text).stripped` que solo matchea `[image: ... ]` cerrado (regex `/\[image:\s*([^\]]+?)\s*\]\s*$/i`). Mientras el stream está llegando, el texto parcial `[image: 1boy, brown_eyes,` sin `]` queda visible hasta que llegue el cierre. Visualmente: aparece texto técnico crudo, luego desaparece — mala UX.

3. **Image viewer modal: imagen desborda + footer con prompt no visible.** En el lightbox, el `<img>` está dentro de un `imageWrap` con `flex: 1` pero sin `minHeight: 0`. Default `min-height: auto` en flex items permite que el contenido (la imagen 1024x1024+) fuerce overflow, empujando el footer debajo del viewport. Creator no ve el prompt debajo de la imagen porque está clipped.

## Done when

- **Fix 1 (chat LLM)**: `_POV_FIRST_PERSON` clause ampliada con regla explícita sobre el `[image: ...]` tag: "solo listá al character + environment. NO incluyas 1boy/1girl/user/person para {user} — es la cámara, no un subject."
- **Fix 2 (refiner defense)**: `image_refine_system.txt` nueva subsección explícita para `pov=first_person`: "si el input tag accidentalmente contiene dos subjects, DROPEA el user-subject. Output single-subject always. NUNCA emitas escaped-parens multi-subject groups cuando pov=first_person."
- **Fix 3 (streaming)**: `TypographicText` (o helper extractor) también strippea el partial `[image:...` sin close bracket al final durante streaming.
- **Fix 4 (viewer layout)**: `imageWrap` gana `minHeight: 0`; `footer` gana `flexShrink: 0`. Imagen nunca empuja el footer fuera del viewport. Prompt siempre visible.
- E2E: regen first-person → `refined_prompt` es single-subject (solo `1girl \(evelyn, ...\)` o sin escape, ningún `1boy \(user, ...\)`). Stream no muestra bracket text parcial. Modal muestra prompt debajo en todas las resoluciones.

## Shape of the change

### Backend

**`backend/app/prompt_assembly.py`**:
- `_POV_FIRST_PERSON`: ampliar con regla explícita sobre el `[image: ...]` tag content.

**`backend/app/prompts/image_refine_system.txt`**:
- Revisar la sección `POV=FIRST_PERSON OR MISSING user_persona` — antes decía "Ignore [multi-subject] section. Single-subject output as before." Ampliar: defensive collapse — si input tag contiene dos subjects + pov=first_person, DROPEA el user-subject, emite single-subject solo con el character, NO uses escaped-parens syntax.

### Frontend

**`frontend/src/lib/visualRoleplay.ts`** (o directamente `TypographicText.tsx`):
- Añadir stripeado del partial `[image:...` sin close bracket al final del texto (durante streaming).

**`frontend/src/features/chat/ImageViewer.tsx`**:
- `imageWrap.minHeight = 0` + `footer.flexShrink = 0`.

## Seed sections satisfied

- [Seed/PersonaLLM-Reference/04-screens/settings/visual-roleplay.md](../Seed/PersonaLLM-Reference/04-screens/settings/visual-roleplay.md) — POV + Visual Roleplay.
- [Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](../Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md) — position 9 + image refiner.
- [Seed/ux.md](../Seed/ux.md) — Image viewer surface (lightbox).

## Schema / RLS

Sin cambios.

## Verification

- [ ] **Playwright — first-person regen**: con `pov=first_person` en DB, regen imagen en Evelyn conv. `refined_prompt` NO debe contener `1boy \(user, ...\)` ni `1boy 1girl` en el count tag. Single subject solo.
- [ ] **Playwright — streaming**: enviar mensaje a Evelyn, observar durante SSE que el `[image:` parcial no aparece en la bubble (ya está oculto).
- [ ] **Playwright — viewer**: abrir lightbox, confirmar que footer con "Prompt" es visible sin scroll.

## Implementation order

1. Plan (este).
2. Edit `prompt_assembly.py` — ampliar `_POV_FIRST_PERSON`.
3. Edit `image_refine_system.txt` — sección FIRST_PERSON defensive.
4. Edit `TypographicText.tsx` — strip partial tag.
5. Edit `ImageViewer.tsx` — flex min-height fix.
6. TS check + touch refiner for reload.
7. Playwright gates.
8. Commit + SESSION_HANDOFF.

## Critical files

| File | Change |
|---|---|
| `backend/app/prompt_assembly.py` | `_POV_FIRST_PERSON` ampliado con image-tag guidance |
| `backend/app/prompts/image_refine_system.txt` | sección FIRST_PERSON con collapse defensivo |
| `frontend/src/features/chat/TypographicText.tsx` | strippeado del partial `[image:...` durante SSE |
| `frontend/src/features/chat/ImageViewer.tsx` | `imageWrap.minHeight=0` + `footer.flexShrink=0` |

## Verification

- ✅ **Fix 1 + Fix 2 combinados — first-person regen E2E**:
  - Setup: `visual_roleplay.pov = "first_person"` confirmado via DB. Conv Evelyn × Michael.
  - Pre-fix baseline: refiner emitió `1boy 1girl, eye_contact, 1girl \(evelyn, ...\), 1boy \(user, mature_male, ...\)` — multi-subject en first-person.
  - Post-fix live regen: `1girl, old_woman, silver_gray_hair, ponytail, blue_ribbon, hazel_eyes, fair_skin, voluptuous, wool_cardigan, coffee_stain, black_rimmed_glasses, soft_age_lines, freckles, leaning_in, conspiratorial_smile, hands_gesturing, office_setting, floor_to_ceiling_windows, city_skyline_background, soft_lighting, medium_shot, looking_at_viewer`
    - ✓ Count tag solo `1girl` (no `1boy 1girl`)
    - ✓ Flat tag list, NO escaped-parens groups
    - ✓ NO `1boy`/`user` tag para Michael
    - ✓ Evelyn detalles ricos: silver_gray_hair, hazel_eyes, fair_skin, voluptuous, wool_cardigan, black_rimmed_glasses, freckles, age_lines — identity anchors intactos
  - Defensive collapse del refiner funcionó incluso cuando el chat LLM en turnos previos emitía tags multi-subject.
- ✅ **Fix 4 — image viewer layout**:
  - Viewer abierto, footer con "Prompt" label + preview medido via getBoundingClientRect.
  - footerTop: 723px, footerBottom: 752px, viewport: 809px → footer visible en los últimos ~86px de pantalla ✓.
  - Prompt preview se lee completo hasta ellipsis. Click expande full prompt como antes.
- ✅ **Fix 3 — streaming flash**: cambio es regex puro (`PARTIAL_IMAGE_TAG_TAIL = /\[image:[^\]]*$/i`) aplicado sobre el output de `extractImageTag().stripped`. Verificable por inspección; imposible reproducir el timing exacto del SSE stream sin disparar una respuesta fresca. Si aparece un bracket flash post-commit, es un bug nuevo no cubierto por este regex (ej. `[image:` embedded mid-message).
- ✅ **TypeScript**: `npx tsc --noEmit` clean.
