---
id: 0137
slug: seedream-prompt-sync
status: proposed
created: 2026-05-15
---

# Cycle 0137 — Seedream system prompt sync: POV / multi-subject / shot framing / group

## Driver

Creator reportó (2026-05-15): *"el image con third person no muestra al third
person, debería incluir al user ahí en la escena"*. Investigación encontró
que el bug es síntoma de un gap arquitectónico mucho más amplio: el system
prompt de Seedream (`image_refine_system_seedream.txt`, 38 líneas) **ignora
4 de los 9 parámetros que `image_refine.py:_build_user_payload` le manda**, y
maneja sólo parcialmente un 5to. El path Danbooru/ComfyUI
(`image_refine_system.txt`, 157 líneas) sí los maneja completamente, así que
los usuarios reciben comportamiento drásticamente distinto según qué image
engine tengan activo.

Esto viola el principio de **vendor-agnostic prompts** del Seed
(`Seed/creator-vision.md` §8 non-negotiables: *"vendor-agnostic prompts"*).
El abstraction layer expone POV, shot framing, group characters y user
persona como features de la conversación; ambos providers deberían producir
output equivalente.

### Audit completo — Danbooru vs Seedream coverage

| Payload field (image_refine.py) | Danbooru handling | Seedream handling | Gap |
|---|---|---|---|
| `sfw` | manejado completamente | manejado completamente | OK ✅ |
| `character_appearance` | uso completo | uso completo | OK ✅ |
| `character_context` (PHYSICAL_IDENTITY / WARDROBE_BASELINE / APPEARANCE_NOTES post cycle 0135) | uso completo | uso completo | OK ✅ |
| `recent_turns` + `target_message` | uso completo | uso completo | OK ✅ |
| `pov: first_person` | secciones POV=FIRST_PERSON (lines 114-118) + ACTION+CONTEXT WEIGHTING (lines 119-129) + defensive collapse | **NO MENCIONA** `pov` en absoluto | **GAP** ❌ |
| `pov: third_person` | sección THIRD-PERSON MULTI-SUBJECT (lines 47-91), 45 líneas de reglas | **NO MENCIONA** `pov` en absoluto | **GAP** ❌ |
| `user_persona` | manejado (líneas 47-91, 82, 83, 84) | **NO MENCIONA** `user_persona` en absoluto | **GAP** ❌ |
| `shot_framing` | sección SHOT FRAMING (lines 87-91) con 5 tags canónicos + FRAMING-AWARE DETAIL SUPPRESSION (lines 93-112) | menciona "framing" genéricamente; sin reglas explícitas para los 5 valores | **GAP PARCIAL** ⚠️ |
| `character_group_size` + `character_group_members` | sección GROUP CHARACTER (lines 131-145) con reglas multi-subject | **NO MENCIONA** group | **GAP** ❌ |

**Resultado observable:** cuando un user fija POV=third_person + tiene una
User Persona configurada + usa fal.ai como image engine (prod default desde
cycle 0090), las imágenes generadas en chat muestran sólo al character — el
user persona es invisible. Equivalente bug latente: group characters
(cycle 0079, 0080) producen imágenes sólo del primer miembro o blending
visual entre miembros porque el Seedream prompt no sabe que es grupo.

## Provenance

- Creator: feedback live 2026-05-15 sobre third-person + user persona.
- Investigación: `image_refine.py:82-126` (payload builder), `image_refine_system.txt`
  (157 líneas, Danbooru), `image_refine_system_seedream.txt` (38 líneas, Seedream).
- **Seed / PersonaLLM-Reference:**
  - `Seed/creator-vision.md` §8 non-negotiables: *"vendor-agnostic prompts"* —
    rule violated por el gap actual. Mismo abstraction expuesto al usuario
    (POV switch en Settings → Roleplay; Group character form), comportamiento
    distinto según engine.
  - `Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md` §image refiner —
    refiner se enmarca como provider-agnostic.
  - `Seed/PersonaLLM-Reference/06-chat-interaction-model.md` — POV switching
    es feature observada del flow base; ambos paths deben soportarla.
  - `Seed/ux.md` §10 non-omission — required states no son droppables; POV
    setting tiene UI exposure (Settings → Roleplay POV picker, cycle 0041)
    así que su comportamiento backend no puede degradarse silenciosamente
    en un provider.
- Cycle 0094 (fal.ai chat scene gen) introdujo el seedream prompt sin portar
  las secciones POV / multi-subject / group del Danbooru (lo cual era
  razonable en ese momento — el scope del 0094 era "make fal work for
  single-subject scenes"). Esta deuda quedó latente hasta hoy.

## Non-negotiables / domain

Sin cambios a:
- Agent isolation, per-Conversation Agent, edit-as-trim, branching, snapshot,
  SSE, Supabase truth, BYOK, plain-text reply path → cycle es prompt-only.
- Grammar Module default OFF → no aplica.
- Per-Conversation Lorebook → no aplica.
- Cycle 0135's REFERENCE IMAGE SEMANTICS section → se preserva intacta;
  las nuevas secciones se INSERTAN, no reemplazan.

Schema: 0. Migration: 0. Frontend: 0. Backend Python: 0. Testid changes: 0.
Backwards-compat: 100% — chars existentes y flujos existentes no cambian.

## Shape

**Una sola edición a `backend/app/prompts/image_refine_system_seedream.txt`**:
agregar 5 secciones nuevas en prosa que traduzcan semánticamente las reglas
Danbooru. Orden en el archivo (después de REFERENCE IMAGE SEMANTICS, antes
del Output JSON schema):

1. **PAYLOAD FIELDS** — breve enumeración para que el LLM sepa qué inputs
   leer (`pov`, `shot_framing`, `character_appearance`, `character_context`,
   `user_persona`, `character_group_size`, `character_group_members`,
   `recent_turns`, `target_message`).
2. **POV & SCENE COMPOSITION** — first-person (single-subject, user es la
   cámara) vs third-person + user_persona (two-subject) + defensive
   collapse.
3. **SHOT FRAMING** — prosa de los 5 valores canónicos (`close-up`,
   `portrait`, `medium_shot`, `cowboy_shot`, `full_body`) + reglas de
   coexistence (no close-up en multi-subject).
4. **FRAMING-AWARE DETAIL CONSISTENCY** — versión light del Danbooru de
   no-describir-pants-en-close-up. Prosa naturalmente tiende a omitir
   detalles out-of-frame pero vale el recordatorio.
5. **ACTION + CONTEXT WEIGHTING (first-person)** — versión prose del
   énfasis: cuando POV=first_person, el verbo de la acción + el prop que el
   character interactúa con son foreground; mencionar "extiende un plato de
   galletas hacia ti" en lugar de "está sonriendo".
6. **GROUP CHARACTER** — N miembros visibles en frame siempre; combinatoria
   con POV (first_person + group = N members no user; third_person + group +
   persona = N + 1).

El target final: el Seedream prompt crece de 38 → ~95-110 líneas. Sigue
siendo más corto que el Danbooru porque la prosa cubre menos sintaxis (no
escaped-parens, no attention-weight, no 7-slot caps).

## Implementation order

### Subtask 1 — PAYLOAD FIELDS enumeration

Archivo: `backend/app/prompts/image_refine_system_seedream.txt`.

Insertar después del intro paragraph (entre línea 3 actual y la sección
REFERENCE IMAGE SEMANTICS):

```
--- PAYLOAD FIELDS YOU RECEIVE ---

The user message you receive contains these fields (lines starting with the field name + colon):
  pov                       "first_person" or "third_person" — who the camera is.
  shot_framing              optional: close-up / portrait / medium_shot / cowboy_shot / full_body. When present, lock the framing.
  character_appearance      free-form appearance summary for the focal character (or character group).
  character_context         multi-line context: PHYSICAL_IDENTITY (10 fields), optional WARDROBE_BASELINE (signature outfit), optional APPEARANCE_NOTES (free-form description), plus system_prompt / personality / goals / worldbuilding / scenario.
  user_persona              optional: appears only when pov=third_person AND the conversation has a persona configured. name / gender / appearance / background_story of the human in the scene.
  character_group_size      optional: 2-4 when the character entity is a group (couple / trio / quartet).
  character_group_members   optional: appears with character_group_size. Pipe-separated lines: "N. Name | gender | age | visual descriptors".
  recent_turns              the last few USER + ASSISTANT messages of the conversation.
  target_message            the assistant message you are illustrating right now (the scene anchor).

Treat absent fields as "default for the simple case": no pov line → assume first_person; no user_persona → single subject; no character_group_size → single character (not a group).
```

**Verificación 1:** grep del archivo confirma que la sección está después
del intro y antes de REFERENCE IMAGE SEMANTICS.

### Subtask 2 — POV & SCENE COMPOSITION

Insertar después de REFERENCE IMAGE SEMANTICS y antes del Output JSON
schema. Aproximadamente:

```
--- POV & SCENE COMPOSITION ---

The `pov` field determines who is in the frame.

**WHEN `pov: first_person` (default if missing) AND `user_persona` is absent — OR `pov: first_person` regardless of user_persona:**

  - Single-subject scene. The viewer is the user; the user is NOT rendered.
  - Your paragraph describes ONLY the character (or all members of the character group, see GROUP CHARACTER).
  - The scene is shown from the user's POV — what they see through their own eyes. Phrases like "she leans toward you", "his eyes meet yours" are natural; "you are seated at the counter" is allowed but the user's BODY is never rendered.
  - **Defensive collapse:** if `target_message` or `recent_turns` contain an explicit description of the user's body (rare but possible in narrative that says "you adjust your auburn ponytail"), IGNORE that description. The user is the camera. Render only the character.

**WHEN `pov: third_person` AND `user_persona` is present:**

  - Two-subject scene. Your paragraph describes BOTH the character AND the user persona, together in frame.
  - **NEVER drop the user.** Even if `target_message` / `recent_turns` describe only the character's actions, infer a complementary pose for the user persona — sitting beside them, standing in the doorway, listening across the counter, walking alongside on the path. The user is present and visible in every third-person scene.
  - Subject ordering: mention the character first (it is their scene), then introduce the user persona. Use the user persona's `name` if available; otherwise refer to them by gender + a contextual descriptor pulled from `user_persona.background_story`.
  - **User persona identity sources** (pull from the `user_persona` block, in order):
      1. `name` — use this as the user persona's name.
      2. `gender` — "a man", "a woman", "a person" if non-binary or unspecified.
      3. `appearance` sub-fields — skin tone, build, hair color/length, eye color, distinguishing details, signature clothing if present.
      4. `background_story` — skim for age cues ("68 years old" → an elderly man), profession, posture hints.
  - **No reference image for the user.** The reference image Seedream consumes anchors the CHARACTER only — the user persona is text-only. Describe the user persona's identity (hair, eyes, build, skin tone, clothing) more concretely in your paragraph than you would for the character, since text is the sole signal Seedream gets for them. Do not skip identity attributes the user_persona block provides.
  - **Wardrobe for the user:** if `recent_turns` describe a wardrobe change for the user, use that. Otherwise use the persona's `appearance` clothing fields if present. Otherwise a plausible default for the setting. Same four-axis rule applies (clothing + pose + expression + setting) for both subjects.
  - **SFW guardrail extends equally to both subjects.** If the scene depicts nudity / sexual acts / explicit content involving EITHER the character OR the user, set `sfw_blocked=true`.

**WHEN `pov: third_person` AND `user_persona` is absent (persona not configured):**

  - Same as first-person. Single subject (the character). The user is not in frame because there is no persona data to render.
```

**Verificación 2:** live test con un char manual + tu User Persona
configurada en `/settings/persona`. Forzar `[image:...]` con
`pov=third_person` (via Settings → Roleplay → POV) y verificar que la
imagen muestra 2 personas. Comparar contra `pov=first_person` (debe
mostrar 1).

### Subtask 3 — SHOT FRAMING (prose version of canonical tags)

Insertar después de POV & SCENE COMPOSITION:

```
--- SHOT FRAMING ---

The `shot_framing` field, when present, locks the camera distance. When absent (user selected "Auto"), infer framing from the scene's intimacy.

Canonical values and their prose translation — embed the corresponding description into your refined_prompt:

  close-up        Head and shoulders crop. Tight focus on the face. The crop sits just below the collarbone; the setting beyond the subject's hairline is mostly out of frame, hinted at by lighting and atmosphere alone. Use for intimate dialogue moments, an expression that carries the scene, a single reaction.
  portrait        Crown to mid-chest. The subject's torso is partly visible; some of the setting frames them at the edges. Use for standard dialogue, an introspective beat, a posed depiction.
  medium_shot     Waist up. Hands and arms enter the frame; objects on a counter, a desk, a held cup become visible. Use for general action, social interaction at conversational distance, scenes where the character is doing something with their hands.
  cowboy_shot     Thighs up. Hips and lower torso visible; the figure's gait or stance reads. Use for confident standing scenes, a character approaching, an action moment that needs the body but not the floor.
  full_body       Feet to head. Complete figure. Lots of setting context. Use for wide environmental shots, dance / combat / movement, scenes where ground and footing matter.

Rules:

  - When `shot_framing` is set, your prose must DESCRIBE that exact framing. Do not write a full-body description for a close-up request and vice versa.
  - When `shot_framing` is absent: infer from the scene. Intimate face moments → close-up or portrait. Hands doing something → medium_shot. Whole body movement / environment → cowboy_shot or full_body.
  - **NEVER use close-up in two-subject scenes.** Two subjects cannot fit a head-and-shoulders crop. Prefer medium_shot or cowboy_shot or wide_shot for two subjects, regardless of what `shot_framing` says. If `shot_framing: close-up` arrives with `pov: third_person + user_persona`, override to medium_shot and note the framing as "medium two-shot" in the prose.
  - **NEVER use close-up in group character scenes** (when `character_group_size > 1`). Same reason.
```

**Verificación 3:** generar imágenes con los 5 valores de shot_framing
explícitos para Maya (single-subject) y confirmar visualmente que el crop
de la imagen matches el descriptor. Más confirmar la regla close-up → medium
en third-person + persona.

### Subtask 4 — FRAMING-AWARE DETAIL CONSISTENCY

Insertar después de SHOT FRAMING. Versión light del Danbooru (prosa no
necesita la disciplina obsesiva de "drop pants tags", pero el principio
ayuda):

```
--- FRAMING-AWARE DETAIL CONSISTENCY ---

Match the level of detail to the framing — do not describe what isn't in the frame, and do not omit what is.

  close-up / portrait: describe face, hair, expression, eyes, neckline / collar / jewelry / glasses / headwear. Do NOT describe pants, footwear, full-body pose (standing / walking / sitting at desk). If the narrative says "she walks toward the window", translate to a face-level cue ("she turns her head toward the light") for a close-up.
  medium_shot / cowboy_shot: describe upper-body and hands; clothing items on the torso; pose from the waist up. Footwear and floor-level pose can be omitted unless narrative requires.
  full_body / wide_shot: full garment set including footwear; full pose; ground / setting context.

Scene-required exception: if `target_message` or `recent_turns` EXPLICITLY mention an out-of-frame detail ("she looks down at her worn boots", "his hands rest on the floor"), keep that detail — the narrative requires it. Default is to suppress.
```

**Verificación 4:** generar una escena close-up de Maya con narration que
incluye su signature_style completo (incluye boots+shorts). Confirmar que
la imagen no muestra boots (out-of-frame for close-up). Repeat con
full_body — boots presentes.

### Subtask 5 — ACTION + CONTEXT WEIGHTING (first-person)

Insertar después de FRAMING-AWARE DETAIL CONSISTENCY:

```
--- ACTION + CONTEXT WEIGHTING (FIRST-PERSON SCENES) ---

In first-person (POV) scenes the viewer sees what is happening RIGHT NOW, not a static portrait. When `pov: first_person`, the verb the character is performing and the props they interact with are first-class subjects of the prose — not afterthoughts.

  - Read `target_message` and the LAST 1-2 assistant turns of `recent_turns`. Extract every concrete action and every prop the character is holding, offering, pointing at, or touching.
  - Mention the action and the prop together, prominently, near the front of the paragraph (after the character's identity):
    - "offering cookies to the user" → "She extends a plate of warm chocolate-chip cookies toward you, her hand steady."
    - "pouring tea into a cup" → "She tilts the dark cast-iron teapot, hot tea streaming into the small white cup in front of you."
    - "handing over a book" → "He holds out a worn leather-bound book, spine cracked from years of use, the title gilded on the cover."
  - Use second-person addressing the camera ("toward you", "in front of you", "meets your eyes") — natural in first-person prose, signals to the model that the subject is interacting with the viewer.
  - Do NOT substitute a generic pose ("she smiles, looking at you") for the actual action described in the narrative. If the narrative says she offers cookies, the prose MUST contain the cookies and the offering gesture — otherwise the scene loses its meaning.
  - Prop precedence: if a prop conflicts with framing suppression (rule 4) — for instance the character is handing a pair of shoes toward the camera in a close-up — the PROP wins. Drop the garment-on-body interpretation, keep the hand-held-item description.
```

**Verificación 5:** chat scene en first-person donde el char ofrece algo
concreto (vino, libro, foto). Verificar la imagen muestra el char + el
objeto extendido hacia el viewer, no un retrato genérico sonriendo.

### Subtask 6 — GROUP CHARACTER

Insertar después de ACTION + CONTEXT WEIGHTING:

```
--- GROUP CHARACTER (when `character_group_size` > 1) ---

The "character" in this conversation is a GROUP of multiple individuals who always appear together — a couple, trio, or quartet. The `character_group_members` block lists them in the format:

  1. Name | gender | age | visual descriptors
  2. Name | gender | age | visual descriptors
  …

When `character_group_size` > 1:

  - ALL N group members are visible in frame, regardless of POV. Even in first-person (where the user is the camera), the user STILL sees all N group members — they appear together as the focal subjects.
  - Order the members in the prose as listed in `character_group_members` (first member is the focal subject, others around).
  - Use each member's name, age, and visual descriptors from the block. Do not collapse them into a single composite person.
  - Interaction between members: derive from the scene narrative (target_message + recent_turns). Examples: "they sit shoulder to shoulder at the bar", "the taller one rests a hand on the smaller one's back", "they argue across the kitchen counter, knife in mid-cut". Do not force eye contact or specific interactions if the narrative is silent.
  - **POV=first_person with a group character:** N members + 0 user (user is the camera). The user is not a subject in the frame.
  - **POV=third_person with a group character AND user_persona:** N members + 1 user persona = N+1 subjects in frame. Group members listed first, user persona listed last, with the same "complementary pose" rule from POV & SCENE COMPOSITION.
  - **No close-up in group scenes.** Multiple subjects do not fit a head-and-shoulders crop. Use medium_shot, cowboy_shot, or wide_shot.
  - **SFW guardrail extends to every subject equally** — character group + user persona. Any explicit content involving any subject sets `sfw_blocked=true`.
```

**Verificación 6:** crear un char de prueba con `group_size=2` (un couple
SFW slice-of-life), generar imágenes con pov=first_person (debe mostrar
2 personas) y pov=third_person + persona (debe mostrar 3). NOTA: este
verification puede diferirse si no querés crear un group char solo para
test — el caso no-regresión es que cycle 0079/0080 tests passing antes de
0137 sigan passing después.

### Subtask 7 — Live verification matrix (end-to-end)

Una vez los 6 subtasks aplicados, ejercitar la matriz combinatoria mínima
con chars existentes:

| # | Char | POV | Persona | Group | Expected |
|---|---|---|---|---|---|
| A | Maya (Roberth dev) | first_person | Roberth | no | single-subject Maya, user invisible |
| B | Maya | third_person | Roberth | no | two-subject Maya + Roberth |
| C | Maya | first_person | (sin persona) | no | single-subject Maya |
| D | Maya | third_person | (sin persona) | no | single-subject Maya (graceful degradation) |
| E | Hideo | first_person, close-up | Roberth | no | head & shoulders Hideo, no apron (close-up suppresses signature_style apron lower-body items via 0135 + framing-aware) |
| F | Maya | first_person, offering scene | Roberth | no | Maya + prop (action+context weighting) |

Cases A-D verifican POV path. E verifica shot_framing + interaction con
cycle 0135. F verifica action weighting. Group cases deferidos.

**Pass criterion:** todos los casos generan imagen que matches expected. Si
algún caso falla, escalar finding antes de cerrar el cycle.

## Riesgos

- **R1 (alta probabilidad, impacto bajo) — prompt grows substancialmente
  (38 → ~110 líneas).** Más tokens al refiner → más cost + más latencia.
  Mitigación: el refiner usa temperature 0.3 + max_tokens 600 (image_refine.py:162-163);
  el system prompt no afecta max_tokens del output. Cost extra ~3K tokens
  por request — aceptable para ganar 4 features.
- **R2 (media, impacto medio) — el LLM puede confundirse con la combinatoria
  POV × persona × group.** Mitigación: cada combinación está enumerada
  explícitamente en las secciones, no como reglas que el LLM deba combinar.
  Si live test descubre confusion, refinar el wording con ejemplos concretos.
- **R3 (baja, impacto bajo) — backwards-compat con
  conversaciones existentes.** Las conversaciones donde antes funcionaba el
  Seedream prompt (single-subject, first_person, no group) deben seguir
  funcionando idéntico. El subtask 1 (PAYLOAD FIELDS) y el "default for the
  simple case" wording garantizan esto. Cases A + C de la matrix son la
  regresión check.
- **R4 (media, impacto medio) — el wording de POV third_person can confuse
  the model into describing the user CAMERA pose** (e.g. "el user persona
  Roberth is filming from across the bar"). Mitigación: el wording dice
  explícitamente "the user persona is IN frame, not behind the camera".
  Tests catch this if it happens.

## Out of scope

- **Cambios al `image_refine_system.txt` (Danbooru/ComfyUI path)** — ya
  cubre todo correctamente.
- **Cambios al `image_refine.py` (payload builder)** — los payload fields
  ya están bien armados; el bug está en el system prompt no usándolos.
- **Cambios al schema, frontend, UI** — cero.
- **Nuevo provider** — no estamos agregando un provider, sólo sincronizando
  prompts.
- **Tests automatizados** — el refiner es LLM call; tests determinísticos
  requieren mocks; out of scope para esta deuda prompt. Live verification
  con la matrix es suficiente.
- **Group character creation as part of verification** — si no hay group
  char en dev account, subtask 6 verification se difiere; el código nuevo
  no rompe regresivamente group chars existentes (cycle 0079/0080).

## Verification

### Subtasks 1-6 (prompt content) → **DONE**

`image_refine_system_seedream.txt` creció de 38 → 164 líneas (+126).
7 secciones en orden lógico:
1. PAYLOAD FIELDS YOU RECEIVE (cycle 0137 — line 5)
2. REFERENCE IMAGE SEMANTICS (cycle 0135 — line 21, preservada)
3. POV & SCENE COMPOSITION (cycle 0137 — line 39)
4. SHOT FRAMING (cycle 0137 — line 70)
5. FRAMING-AWARE DETAIL CONSISTENCY (cycle 0137 — line 90)
6. ACTION + CONTEXT WEIGHTING (cycle 0137 — line 110)
7. GROUP CHARACTER (cycle 0137 — line 125)

Cada sección traduce semánticamente las reglas Danbooru a prosa
(no escaped-parens, no 7-slot caps, no attention-weight syntax) y se
referencia explícitamente las otras secciones donde aplica (e.g.
SHOT FRAMING menciona el override a medium_shot cuando hay two-subject;
GROUP CHARACTER menciona que ACTION + CONTEXT WEIGHTING aplica cuando
el group interactúa con la cámara).

Tokens estimados del prompt completo: ~2400 tokens, vs ~750 pre-cycle.
Aceptable — el max_tokens del response sigue siendo 600
(`image_refine.py:163`).

### Subtask 7 — Live verification → **PRIMARY CASE GREEN**

Priorización del creator: single ya verificó en 0135; focus en third + otras
combinaciones.

**Case B (Maya third_person + Roberth user_persona) → GREEN.**

Setup:
- POV: third_person (global en `/settings/prompt-editor`, ya estaba seteado).
- User Persona: "Roberth" (sidebar muestra el name; persona_id se honra
  per cycle 0131 + flow `useCharacterOpen`).
- Char: Maya Okonkwo (manual creation del 0135, signature_style="faded
  blue dive instructor polo, khaki shorts...").

Flow: new conversation con Maya → enviar mensaje "Hi Maya. I'd love to
ask about the penguins..." → Maya respondió in-voice (incluye "Ja, no,
good") → click "Generate an image from this reply" → fal.ai genera
imagen.

Resultado: **dos sujetos visibles** en el frame:
- Maya (izq): cropped curly dark brown hair sun-bleached, dark amber eyes,
  faded blue dive polo (WARDROBE_BASELINE del cycle 0135 aplicado),
  sosteniendo coffee mug, en el porche del "MAYA'S DIVE SHOP" (setting del
  scenario).
- Roberth (der): mid-30s male, brown hair, brown shirt, mirando a Maya.

Two-subject medium-shot composition natural. Setting matches el scenario.
Identidad de Maya preservada del reference_ref sterile. User persona
"Roberth" rendered con identity attributes derivados de su appearance
fields (no reference image — solo text). NEVER-DROP-USER rule respected.

Screenshot: `.playwright-mcp/0137-case-B-maya-third-person-with-roberth.png`.

**Pre-0137 baseline (sin estos cambios):** misma combinación habría
producido una imagen sólo con Maya (single-subject), porque el Seedream
prompt no sabía que `pov: third_person + user_persona: ...` significa
two-subject scene. El bug está fixed.

### Cases D / E / F → diferidos a verification orgánica

Per creator priority "single ya sirve" + tiempo de fal generation (~30-60s
por imagen, ~3 min por caso end-to-end):

- **Case D (third_person + sin persona → single graceful):** código path
  cubierto en POV & SCENE COMPOSITION sección "third_person AND
  user_persona absent". Verificable en próxima conversación que se
  inicie sin persona, o forzando persona_id=null vía DB. Comportamiento
  esperado: prose describe solo el character, sin observer body. Riesgo
  bajo de regresión.
- **Case E (shot_framing=close-up + third_person + persona → medium
  override):** código path cubierto en SHOT FRAMING sección "NEVER use
  close-up in two-subject scenes". Verificable cambiando
  `/settings/prompt-editor` → Shot framing → Close-up + regenerando una
  imagen con persona presente. Output esperado: prosa describe un medium
  two-shot, no un head-and-shoulders.
- **Case F (first_person + offering scene → action+context weighting):**
  código path cubierto en ACTION + CONTEXT WEIGHTING sección. Verificable
  switching pov a first_person y prompting Maya/Hideo a ofrecer algo
  concreto. Output esperado: prosa lidera con el verbo+prop ("she extends
  X toward you").

Los 3 casos quedan trackeados como follow-up de verificación organic; si
alguno falla en uso real, abrimos cycle de fix.

### Group character verification → diferida

No hay group char en dev account; verificación de subtask 6 (GROUP
CHARACTER section) depende de crear uno o esperar hasta que un user real
genere uno. Código path es prosa adicional al prompt — no rompe
regresivamente el path single-character. Si en futuro un user reporta
problema con group chars, abrir cycle de revisión.

### `code-review` → prompt-consistency pass

Manual review de consistencia interna del prompt:
- Las 7 secciones se referencian entre sí correctamente:
  - POV & SCENE COMPOSITION refiere a GROUP CHARACTER ✓
  - SHOT FRAMING refiere a "two-subject scenes" (POV section) ✓
  - FRAMING-AWARE DETAIL CONSISTENCY refiere a WARDROBE_BASELINE (cycle
    0135 REFERENCE IMAGE SEMANTICS) ✓
  - ACTION + CONTEXT WEIGHTING se referencia desde GROUP CHARACTER ✓
- Cero contradicciones detectadas entre las reglas (e.g. dos secciones
  diciendo cosas distintas sobre lo mismo).
- Cycle 0135 REFERENCE IMAGE SEMANTICS preservado intacto.
- Output JSON schema sin cambios — backwards compat con `image_refine.py`
  parser (`ImageRefineResult` keys).

### `code-simplifier` → n/a (prompt-only, no code changes)

### Visual sign-off del creator

Otorgado vía AskUserQuestion (creator vio Case B screenshot y aprobó la
matriz priorizada en lugar del set completo).
