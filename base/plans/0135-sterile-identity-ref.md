---
id: 0135
slug: sterile-identity-ref
status: proposed
created: 2026-05-14
---

# Cycle 0135 — Sterile identity reference + reduced visual weight in fal /edit

## Driver

La foto blanca de referencia (`characters.reference_ref`) está cumpliendo dos
roles que se contradicen entre sí:

1. **Rol declarado** — fuente de **identidad física** (build, complexion,
   estructura facial, marcas distintivas). Eso es lo que el creator quiere que la
   foto haga.
2. **Rol real hoy** — en el path **fal.ai (prod)**, `image.py:645-685` firma
   una URL del `reference_ref` y la pasa como `refs=image_urls` a
   `FalProvider.submit()`, que rutea al endpoint `/edit` de fal (image-to-image /
   IP-adapter). El modelo **ve toda la foto** — cuerpo, ropa, pose, expresión,
   fondo blanco, iluminación studio — y la usa como ancla visual de la escena
   generada. Resultado: **toda imagen generada en chat hereda ropa, pose neutra
   model-sheet y expresión inexpresiva de la foto, aunque la narración diga otra
   cosa**.

El path **ComfyUI local** no tiene este problema (no consume `reference_ref`),
pero prod corre 100% en fal.

Decisión del creator (AskUserQuestion ×2, 2026-05-14):

- La foto blanca es **sólo identity card** — body shape, face structure,
  complexion, distinctive marks. Todo lo demás (clothing, pose, expression,
  framing, background, lighting, mood) viene de la narración + prompt del
  refiner, escena por escena.
- Para **chars existentes** (Naoko, Ilona, Rafa, Marek, Mateo) **no migramos** la
  foto. Sólo los chars nuevos reciben `reference_ref` con prompt sterile.
- Outfit + location como estado mutable derivado se queda para **pieza 2**
  (SCENE_STATE via memory_extract), cycle separado.

## Provenance

- Conversación 2026-05-14: *"la foto blanca de referencia tiene puede tener una
  ropa, pero no es como que mantenga esa ropa todo el tiempo, puede ser como
  para el inicio pero no que lo mantenga siempre"* y *"siempre la foto blanca
  es como inexpresiva y está bien pero no vaya a ser que todas las fotos que
  genera son iguales, ahí debe adaptarse al contexto, por eso te decía que la
  imagen esa es la imagen como de la apariencia física nada más para que se
  parezcan entre sí"*.
- Memorias guardadas: [[project-image-pipeline-dual-path]] (separación fal vs
  ComfyUI), [[project-wardrobe-state-roadmap]] (pieza 1 vs pieza 2).
- **Seed / PersonaLLM-Reference:**
  - `Seed/PersonaLLM-Reference/03-data-model.md` §Character — `appearance_description`
    y `avatar` son **estáticos** per-character; PersonaLLM observado no tiene
    estado de wardrobe ni location mutable. Replicar esa premisa: la foto es
    estática y de identidad; lo mutable se infiere por turn.
  - `Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md` §Image
    refiner — el refiner es el componente que decide qué se renderiza; la foto
    debe ser **input subordinado** al refiner, no ancla visual independiente.
  - `Seed/PersonaLLM-Reference/08-generation-parameters.md` — generation params
    son tunables; `strength`/`image_strength` cae acá.
  - `Seed/open-questions.md` §2.2 (auto-image trigger) — relacionado pero no
    bloqueante; no resuelve scene-change detection (eso es pieza 2).
  - `Seed/domain.md` §6 — invariants relevantes: **#8** (character_snapshot es
    point-in-time → no retro-mutamos avatares existentes ✅), **#14** (Postgres
    source of truth → no agregamos estado nuevo en este cycle ✅), **#20** (mode
    immutable → no aplica; estos cambios son del image pipeline, ambos modes lo
    usan).

## Non-negotiables / domain

Sin cambios a:

- Agent isolation, per-Conversation Agent, edit-as-trim, branching copies,
  snapshot semantics, SSE, Supabase as source of truth, BYOK, vendor-agnostic
  prompts, plain-text reply path → cycle no toca prompt-assembly, ni
  Conversation Agent, ni schema.
- Grammar Module default OFF → no aplica.
- Per-Conversation Lorebook → no aplica.

Ningún testid existente afectado. No hay schema, no hay migration, no hay nuevo
endpoint, no hay UI nueva. **Backwards compatible** para chars existentes (sus
`reference_ref` quedan como están).

## Shape

Cuatro cambios coordinados:

1. **Identity-only prompt para `reference_ref`** en `avatar_generate.py`. Hoy
   `_build_portrait_prompt` produce una foto half-body neutral; reemplazamos por
   un prompt model-sheet **explícito**: pose neutral frontal, iluminación
   uniforme, fondo blanco, **ropa estandarizada minimal sin estilo** (e.g.,
   *"plain white t-shirt, neutral gray pants, no accessories"*), expresión
   neutral. La foto pretty (`avatar_ref`, la que se muestra en UI) **no cambia**
   — sigue con prompt + style suffix del user.

2. **Refuerzo en `image_refine_system.txt`** — nueva sección **"REFERENCE IMAGE
   SEMANTICS"** antes de las reglas POV/SFW, explicando al refiner que la foto
   provee **sólo identidad física** y que clothing, pose, expression, framing,
   background, lighting, mood vienen de `target_message` + `recent_turns` +
   campos del character card. Lista explícita de "qué hereda la foto" vs "qué
   se decide por escena" — tabla mental que evita drift.

3. **Renombrar bloque APPEARANCE en character_context** (`image.py:402-439`)
   para separar conceptualmente "physical identity" (foto + 11 fields) de
   "wardrobe baseline" (signature_style + appearance_description). El refiner
   recibe el mismo material pero **etiquetado** para que la prioridad sea
   inequívoca: `PHYSICAL_IDENTITY > WARDROBE_BASELINE > recent_turns` para
   clothing, con `recent_turns` ganando si hay conflicto.

4. **Reducir el peso visual de `reference_ref` en `FalProvider`**
   (`backend/app/providers/fal.py` o donde viva el call a fal). Investigar qué
   parámetro acepta el endpoint `/edit` del modelo Seedream para controlar
   image-to-image strength (probable: `image_strength`, `strength`, `denoise` o
   `guidance_scale`). Si está expuesto y el default es alto, bajarlo a un valor
   que use la foto como **guía débil de identidad** (~0.35–0.5 dependiendo del
   schema del modelo). Si no está expuesto en el SDK actual, documentar y dejar
   como follow-up.

Sin cambios a:

- `characters` schema, `conversations` schema, `messages` schema.
- `prompt_assembly.py` (Conversation Agent — image refiner es agente aparte).
- `memory_extract.py` (eso es pieza 2).
- Frontend (no hay UI nueva en este cycle).
- Avatar UI / `avatar_ref` / Gallery.
- ComfyUI workflow path.

## Implementation order

**Subtarea 1 — Identity-only prompt para `reference_ref`.**

Archivos: `backend/app/routes/avatar_generate.py`.

Hoy `_build_portrait_prompt` arma un prompt para una foto half-body genérica con
los 11 atributos físicos. Lo que falta: el prompt **no le pide explícitamente
ropa neutra** ni excluye estilo de personaje; arrastra cualquier `signature_style`
o style suffix del workflow.

Cambio: en la rama que produce `reference_ref` (la segunda generación,
half-body sin style suffix), agregar **descriptores model-sheet explícitos**:

```python
IDENTITY_REF_NEUTRAL_CLOTHING = (
    "plain white short-sleeve t-shirt, plain neutral pants, "
    "no accessories, no jewelry, no hat"
)
IDENTITY_REF_POSE = (
    "standing straight facing viewer, neutral relaxed expression, "
    "arms at sides, even studio lighting, plain white background"
)
```

Insertados en la construcción del positive prompt **después** de los 11
atributos físicos y **antes** de cualquier wrap. El `_build_portrait_negative`
sigue con anti-deformidad + SFW shield (cycle 0081); le agregamos negativos
para sobrescribir ropa cargada que el modelo pueda inferir del prompt
(`"detailed clothing, fashion, costume, elaborate outfit, signature outfit"`).

**Ámbito sólo el `reference_ref`** — el `avatar_ref` (pretty preview) **NO se
toca**, sigue con prompt + style suffix actuales.

**Verificación 1 (live):**
- Crear un char de prueba con campos físicos completos y `signature_style`
  cargado con algo distintivo (e.g., *"red leather jacket and combat boots"*).
- Trigger Generate Avatar.
- Inspeccionar el `avatar_ref` y `reference_ref` en el storage de Supabase.
- **Pass criterion:** `avatar_ref` puede mostrar la chaqueta roja (es la
  pretty); `reference_ref` muestra t-shirt blanca + pose neutra + cara neutra
  **sin** la chaqueta roja ni botas. La diferencia visual entre `avatar_ref` y
  `reference_ref` debe ser clara.

**Subtarea 2 — REFERENCE IMAGE SEMANTICS en `image_refine_system.txt`.**

Archivos: `backend/app/agents/image_refine_system.txt`.

Insertar nueva sección **antes** de las reglas POV (que ya están en el
sistema), formato directo:

```
--- REFERENCE IMAGE SEMANTICS ---
A reference image of the character is provided to the renderer as a weak
identity anchor. It conveys ONLY:
  - face structure and distinctive facial features
  - body build and proportions
  - skin tone and complexion
  - eye color, base hair color and base hair style
  - distinctive permanent marks (scars, tattoos described in the card)

It does NOT convey:
  - clothing (the reference is intentionally a sterile studio shot)
  - pose, framing, camera distance
  - facial expression or emotional state
  - background, location, time of day, lighting
  - mood or atmosphere

For each generated image, derive clothing from (priority): the most recent
narration in `recent_turns` if it describes a wardrobe change → otherwise
`signature_style` if non-empty → otherwise `appearance_description` →
otherwise a context-appropriate default for the scene. Derive pose,
expression, framing, background, lighting and mood from `target_message`
and the current narration, NOT from the reference image. The reference is
for matching the character across scenes, not for templating the scene.
```

Más una línea recordatoria al final de la sección de instrucciones de output:
*"Output prompt MUST explicitly describe clothing, pose, expression and
setting for the current scene. Do not omit these expecting the reference to
provide them."*

**Verificación 2 (live):**
- Tomar un char existente (no migrado) y forzar dos `[image:...]` en
  contextos distintos: una escena de cocina (mañana) y una escena
  de noche/exterior. Mismo char, distinta narración.
- Inspeccionar el `refined_prompt` que produce `run_image_refine` (log
  upstream del refiner).
- **Pass criterion:** los dos prompts difieren significativamente en
  clothing, pose, lighting, mood. No son variaciones triviales con la misma
  pose neutra. Ambos describen explícitamente clothing + pose +
  expression + setting (no quedan campos implícitos).

**Subtarea 3 — Renombrar bloque APPEARANCE en `character_context`.**

Archivos: `backend/app/routes/image.py` (las líneas ~402-439).

Hoy:

```
PHYSICAL_IDENTITY:
- age: 51
- gender: female
...
APPEARANCE:
black hair tied up, deep brown eyes, wearing kimono usually
```

El bloque `APPEARANCE` mezcla rasgos físicos permanentes con wardrobe
("wearing kimono usually"). El refiner no puede separar — los toma a todos
como "esto es la persona".

Cambio: separar en **dos bloques etiquetados** que el refiner ya verá
explicados por la sección nueva del system prompt (subtarea 2):

```
PHYSICAL_IDENTITY:
- age: 51
- gender: female
- build: petite
- hair_color: black
... (los 11 fields ya están etiquetados así hoy)

WARDROBE_BASELINE:
{signature_style if non-empty, else nothing}

APPEARANCE_NOTES:
{appearance_description, as today, but with clarifying header}
```

`PHYSICAL_IDENTITY` queda como hoy (el código que ya lo produce). Lo que
agregamos: cuando `signature_style` no está vacío, emitir un bloque aparte
`WARDROBE_BASELINE` con su contenido. `appearance_description` pasa a
`APPEARANCE_NOTES` (sólo rename del header, contenido idéntico). El bloque
`GROUP_MEMBERS` (cuando `group_size > 1`) sigue reemplazando `PHYSICAL_IDENTITY`
sin cambios.

**Verificación 3 (live + grep):**
- `grep` en el resultado de armar `character_context` para un char con
  `signature_style` no vacío: confirmar que aparecen los tres headers
  `PHYSICAL_IDENTITY:`, `WARDROBE_BASELINE:`, `APPEARANCE_NOTES:`.
- Para un char con `signature_style` vacío: `WARDROBE_BASELINE` no debe
  aparecer (skip-if-empty).
- Para un char con `group_size > 1`: `PHYSICAL_IDENTITY` ausente,
  `GROUP_MEMBERS` presente (regresión 0079).

**Subtarea 4 — Reducir image strength en fal `/edit`.**

Archivos: `backend/app/providers/fal.py` (o donde viva `FalProvider.submit`;
confirmar en `image.py:680-685` el path real).

Investigación previa (NO commit hasta tener evidencia):

1. Identificar el modelo fal exacto que está corriendo `/edit` (probablemente
   `fal-ai/seedream` o variante). Consultar `context7` o docs de fal-ai
   para el schema del endpoint — qué parámetros expone para image-to-image
   strength.
2. Inspeccionar `FalProvider.submit` para ver qué kwargs pasa hoy al endpoint
   y si el SDK acepta un campo de strength que estamos omitiendo.

Si el parámetro existe (probable: `image_strength`, `strength`, `denoise`,
`guidance_scale`, o `image_guidance_scale`):

- Exponerlo como kwarg en `FalProvider.submit` con un default conservador
  (~0.4 — fuerte enough para mantener identidad facial, suave enough para
  que el prompt domine ropa/pose/escena). Documentar el rango y el efecto
  en docstring.
- **No exponerlo en UI** en este cycle. El default va hardcoded en el
  provider. Si después se ve que necesita tuning per-user, se agrega a
  `/settings/image-engine` como un cycle aparte (backlog).

Si el parámetro **no** existe en el modelo actual de fal:

- Documentar en el plan que el modelo de fal en uso no expone strength
  (escribirlo en el resumen final del plan, en Verification).
- Mitigación parcial: el refuerzo prompt-side de subtarea 2 + el sterile
  identity_ref de subtarea 1 siguen aplicando para chars nuevos. Para
  reducción de peso visual fuerte habría que cambiar a un endpoint
  diferente (e.g. plain text-to-image sin refs, perdiendo consistencia
  facial) — eso queda fuera de cycle.

**Verificación 4 (live):**
- **Caso A — parámetro existe:** generar dos imágenes en chat con un char
  existente: una **antes** del cambio (commit anterior), una **después**
  con `strength=0.4`. Comparar lado a lado: la post-cambio debe mostrar
  más variedad en pose/expresión/background respecto al `reference_ref`
  que la pre-cambio, **sin perder** la consistencia facial.
- **Caso B — parámetro no existe:** confirmar con tests dirigidos (varias
  generaciones con el mismo char + narración variada) que al menos la
  subtarea 2 ya cambió el output del refiner — si los prompts difieren
  pero las imágenes siguen parecidas, es señal de que falta el strength
  control y queda registrado en backlog.

## Riesgos

- **R1 (alta probabilidad, impacto medio) — el SDK de fal-ai no expone
  strength para el endpoint en uso.** Mitigación: documentar y dejar
  follow-up; subtareas 1+2+3 ya entregan el grueso del valor.
- **R2 (baja probabilidad, impacto medio) — el prompt sterile del
  `reference_ref` produce una foto demasiado genérica que no captura
  rasgos distintivos.** Mitigación: los 11 atributos físicos siguen yendo
  al prompt; lo único neutro es ropa + pose + expresión. Si en
  verificación 1 el `reference_ref` pierde rasgos distintivos (cicatrices,
  color de pelo no estándar), ajustar el prompt para reforzar
  `distinctive_features` explícitamente.
- **R3 (baja, bajo) — el refiner ignora la nueva sección REFERENCE IMAGE
  SEMANTICS porque está después de tokens existentes ya tuneados.**
  Mitigación: posicionar la sección **antes** de las reglas POV y SFW
  para asegurar prioridad. Si verificación 2 muestra que sigue produciendo
  prompts inexpresivos, mover el bloque más arriba (top of system
  prompt) en un follow-up.
- **R4 (baja, bajo) — separar APPEARANCE en dos bloques rompe parsing
  downstream.** Mitigación: el refiner consume el `character_context` como
  texto opaco, no parsea headers programáticamente. El cambio es
  cosmético desde la perspectiva del refiner; solo cambia cómo interpreta
  semánticamente cada sección.

## Test characters (creator-requested addendum 2026-05-14)

Como parte de la verificación, creo **2 chars de prueba — un hombre y una
mujer** — en mi cuenta de test, **bajo el código nuevo** (sterile identity_ref
+ REFERENCE IMAGE SEMANTICS aplicados). Quedan **en mi cuenta solamente**
(no son públicos en este cycle). Sirven como vehículo de verificación para
las 4 subtareas. Credenciales del test account se pasan al creator si quiere
revisar visualmente antes del commit.

**Las dos personalidades** seguirán el patrón SFW slice-of-life de los 5
originals (Naoko/Ilona/Rafa/Marek/Mateo) — oficio específico, anti-romance
clause en system_prompt, secret_desire orientado a oficio, no romance. Una
de las dos será creada con flujo Enrich-with-AI (regression del cycle 0080
detect_group_size + diffusion-friendly tag format) y la otra 100% manual
(regression de la decisión 0081 de evitar romantic tropes del refiner).

## Forward link — Cycle 0136 (planeado, no escrito todavía)

**Public starter pack character feature.** Los 2 chars de test del 0135 son
candidatos a starter pack (sus `reference_ref` ya están sterile, no requieren
regeneración). El feature en sí — schema (`is_public boolean` o tabla
`starter_characters` separada, decidir en plan), RLS adjustment, signup flow
(copy-at-signup vs shared-read, decidir en plan), edit/delete semantics
para chars públicos, UI distinción visual — queda fuera de **este** cycle.
Plan separado 0136-public-starter-pack se escribe **después** de que 0135
verifique. Razón del split: domain invariant #15 ("no cross-user read at DB
layer") está en juego y no se mezcla con cambios de prompt pipeline.

## Out of scope (explícito)

- **Migración de los 5 chars existentes a sterile `reference_ref`** — creator
  dijo "dejar las existentes".
- **Hacer públicos los 2 chars de test** — eso es 0136, plan separado.
- **SCENE_STATE (outfit + location memory pipeline)** — pieza 2, cycle
  separado. Si subtarea 4 no logra suficiente reducción de homogeneidad
  visual, la pieza 2 es la siguiente palanca.
- **UI para outfit/location manual override** — creator confirmó auto-detect
  only.
- **Frontend changes** — ninguno. No hay Image Engine setting nuevo, no hay
  toggle de strength en UI.
- **ComfyUI path** — sigue sin consumir `reference_ref`; el problema no
  aplica.
- **Avatar regeneration UI changes** — `AvatarGenerateControls` no se toca,
  testids preservados (`avatar-generate`, `reference-view`, etc).

## Verification

### Subtarea 4 — fal strength reduction → **NOT VIABLE, DOCUMENTED**

Verificado via WebFetch contra
`https://fal.ai/models/fal-ai/bytedance/seedream/v5/lite/edit/api`
(2026-05-14): el endpoint NO expone `strength` / `image_strength` /
`denoise` / `guidance_scale` / `image_guidance_scale`. Inputs aceptados:
`prompt`, `image_urls`, `image_size`, `num_images`, `max_images`,
`sync_mode`, `enable_safety_checker`. **Sin lever para bajar peso visual
de la ref desde la API.** Mitigación: el peso visual baja por el
contenido de la foto (subtarea 1) y por la dominancia del prompt
(subtarea 2 + 3). Si la homogeneidad persiste tras live test, follow-up
sería evaluar switch de modelo (flux-schnell + LoRA, InstantID, o un
modelo de fal que sí exponga strength) — out of scope de 0135.

### Subtarea 1 — sterile `reference_ref` prompt → **DONE**

Cambios en `backend/app/lib/fal_avatar.py`:
- 2 constantes nuevas (`IDENTITY_REF_NEUTRAL_CLOTHING`,
  `IDENTITY_REF_NEUTRAL_EXPRESSION`) con docstring de bloque
  explicando el contrato.
- `_physical_attrs_line` gana kwarg `exclude_wardrobe: bool = False`.
  Cuando `True`, salta `signature_style` del loop. Default preserva el
  comportamiento del path preview.
- `build_reference_prompt` llama con `exclude_wardrobe=True` e inserta
  los 2 tokens en el parts list (clothing + expression).
- `build_avatar_preview_prompt` sin cambios — preview sigue con
  `signature_style` y prefix de usuario.

Sanity test Python con char ficticio "Aria" (signature_style="red
leather jacket, combat boots, fingerless gloves") confirmó:
- Preview prompt: contiene los 3 items + identidad + bg + style suffix.
- Reference prompt: NO contiene los 3 items; SÍ contiene "plain white
  short-sleeve t-shirt", "no jacket", "no accessories", "neutral
  relaxed expression"; mantiene scar, tattoo, hair, eye color, build,
  skin tone, distinctive_features.

`py_compile fal_avatar.py` OK. Sin callers rotos.

### Subtarea 2 — REFERENCE IMAGE SEMANTICS → **DONE**

Cambios en `backend/app/prompts/image_refine_system_seedream.txt`:
- Sección nueva insertada entre intro y output schema, con tres
  partes: (a) explicación de qué es la ref y por qué es sterile;
  (b) lista positiva "CARRIES" — face structure, body build, complexion,
  eye color, base hair, distinctive permanent marks; (c) lista negativa
  "DOES NOT CARRY" — clothing, footwear, accessories, pose, framing,
  camera distance, expression, emotional state, background, location,
  time of day, lighting, mood, atmosphere.
- 3 reglas MUST para cada output: derivar clothing desde
  narration→baseline→default; derivar pose/framing/expression/lighting/
  mood desde chat moment; describir clothing+pose+expression+setting
  explícitamente en cada paragraph para evitar homogeneidad model-sheet.
- Identity re-mention rule consolidada en la sección nueva; eliminada
  redundancia en el bullet de `refined_prompt` description del output
  schema.

Verificación final del impact es runtime (refiner output diverging por
escena) — parte de end-to-end con los 2 test chars.

### Subtarea 3 — PHYSICAL_IDENTITY / WARDROBE_BASELINE / APPEARANCE_NOTES → **DONE**

Cambios en `backend/app/routes/image.py:402-447`:
- `signature_style` removido del loop de PHYSICAL_IDENTITY → quedan 10
  fields (age, gender, build, height, hair_color, hair_style, eye_color,
  skin_tone, distinctive_features, voice_style).
- Bloque nuevo `WARDROBE_BASELINE:` después de PHYSICAL_IDENTITY, con
  el contenido de `signature_style` strip()ed; skip-if-empty.
- Bloque `APPEARANCE` → `APPEARANCE_NOTES` (rename only; contenido
  idéntico).
- Group filter (cycle 0079 logic) ampliado para descartar tanto
  `PHYSICAL_IDENTITY:` como `WARDROBE_BASELINE:` cuando `group_size > 1`
  — los miembros de un grupo no tienen un single signature_style.
- Docstring del builder reescrito documentando los 5 layers y la
  precedence chain.

Sanity test Python con 4 casos:
- Char con signature_style + appearance_description → 3 bloques presentes,
  signature_style NO aparece dentro de PHYSICAL_IDENTITY.
- Char sin signature_style → WARDROBE_BASELINE saltado.
- Grupo (group_size=2) → GROUP_MEMBERS reemplaza PHYSICAL_IDENTITY +
  WARDROBE_BASELINE; APPEARANCE_NOTES preservado.
- Char bare-bones (sin sig_style ni appearance) → solo PHYSICAL_IDENTITY.

Todos pasan. `py_compile image.py` OK.

### Drift colateral arreglado — `image_refine_system.txt` (ComfyUI/Danbooru path)

El system prompt del path ComfyUI mencionaba `signature_style` como
campo dentro de PHYSICAL_IDENTITY. Como cycle 0135 lo mueve a
WARDROBE_BASELINE, ese prompt quedaba desactualizado. Surgical edit:
- Lista de fields en PHYSICAL_IDENTITY actualizada (sin `signature_style`).
- Mención nueva del block `WARDROBE_BASELINE` con la regla "emit baseline
  descriptors as tags only when narration doesn't override".

### Live verification + 2 test characters → **DONE con findings**

Dos chars creados en cuenta dev `Roberth` bajo el código nuevo (backend
auto-reload picked up Python changes; seedream .txt se lee per-request).

**Maya Okonkwo** (id `ceddffd8-c198-409f-98c2-836e4ec81ee6`) — manual.
Marine biologist 34F en Simon's Town, signature_style="faded blue dive
instructor polo, khaki shorts, neoprene flip-flops, small canvas
sling-pack". Distinctive features sólo body markers: silver hoop en
left ear, scar en right shin, freckles. **Resultado: GREEN.** El
`avatar_ref` muestra el polo azul + khaki + sling-pack en escena
costera; el `reference_ref` muestra plain white t-shirt + neutral gray
pants en fondo blanco studio con expresión neutra. Identidad preservada
(cropped curly dark brown hair sun-bleached, freckles, scar en pierna
visible). Cero leak de signature_style. Screenshots:
`.playwright-mcp/0135-maya-1-avatar-ref-pretty.png` +
`.playwright-mcp/0135-maya-2-reference-ref-lightbox.png`.

**Hideo Tanigawa** (id `13371a14-9b07-4940-bb66-2d359dd4a3fe`) — AI
Generate. Yakitori cook 58M en Beppu, signature_style="Practical chef's
wear: indigo apron, white headband, rubber sandals…". **Resultado:
PARTIAL** con finding interesante. El `signature_style` fue
correctamente excluido del `reference_ref`. PERO el `reference_ref`
TODAVÍA muestra apron + headband — el leak vino por un campo distinto:
**AI Generate puso wardrobe en `distinctive_features`** (
*"Missing the tip of his left pinky finger. **Wears a navy indigo
noren-apron and a white cotton tenugui headband.**"*). El cycle 0135
`exclude_wardrobe` flag sólo excluye `signature_style` —
`distinctive_features` se mantiene en el reference como identity marker
(correcto para "missing pinky", pero contaminado cuando el AI mete
ropa).

Screenshots:
`.playwright-mcp/0135-hideo-1-avatar-ref-pretty.png` +
`.playwright-mcp/0135-hideo-2-reference-ref-lightbox.png`.

Diagnóstico: **el mechanism de cycle 0135 funciona** (signature_style
sale como esperado, identity preservada, neutral pose + expression +
background sterile). El leak residual de Hideo es upstream — AI
Generate mis-clasificó wardrobe como distinctive_features.

### Fix adicional incluido tras el finding de Hideo

Decisión del creator (2026-05-15): arreglar en código para futuros chars,
dejar Hideo as-is (la foto con apron es histórica, no se regenera).

Cambios:
- `backend/app/prompts/character_generate_system.txt` — anotaciones
  inline en los campos `distinctive_features` y `signature_style` del
  schema: distinctive_features es ONLY para marcas corporales
  permanentes (scars, tattoos, missing limbs / digits, eye anomalies,
  freckles, birthmarks, piercings, glasses, prosthetics); NEVER
  clothing / footwear / accessories / headwear. signature_style es el
  SOLE channel para clothing — no duplicar prendas en otros campos.
- `backend/app/prompts/character_refine_system.txt` — mismo refuerzo
  semántico (la flow Enrich-with-AI tiene el mismo riesgo). Reemplazó
  los comentarios laxos previos ("scars, tattoos, marks, unusual
  features" / "signature clothing/look") por la versión estricta del
  cycle 0135.

Estos dos prompts son user-overridable via `/settings/prompt-editor`,
así que el fix sólo aplica a users que no hayan customizado su
character_generate / character_refine — comportamiento aceptable para
una mejora de defaults.

### `code-review` → 2 findings (Important), ambos pre-existing — DOCUMENTADOS, no aplicados

**F1 (conf 85) — `_flatten()` colapsa los block headers de `character_context`.** `image_refine.py:113` aplica `_flatten` al `character_context` antes de mandarlo al LLM, comportamiento justificado en `image_refine.py:42-50` como prompt-injection defense (evita que un valor de field spoofeé un boundary fake como `\nrecent_turns:\n...`). Con eso los headers `PHYSICAL_IDENTITY:` / `WARDROBE_BASELINE:` / `APPEARANCE_NOTES:` quedan inline en la cadena flat, no en líneas separadas.

Decisión: **DISMISS — pre-existing pattern, no regresión.** PHYSICAL_IDENTITY funciona desde cycle 0018 con este flatten y la refinería lo parsea inline sin problemas. WARDROBE_BASELINE hereda el mismo convention. El reviewer mismo admite *"a language model will likely parse the flattened single-line header tokens correctly — WARDROBE_BASELINE: is still present and unambiguous as an inline label"*. Si en producción se observa parseo confuso, follow-up sería reemplazar `_flatten` por un serializer que preserve `\n` entre bloques pero strip dentro de field values — pero eso es deuda pre-existente, no scope de 0135.

**F2 (conf 80) — claim de "snapshot semantics preserved" overstated.** El image route hace SELECT contra `characters` live (`image.py:225-232`), no contra `conversations.character_snapshot`. Esto pre-existe a 0135. Si el user edita `signature_style` después de iniciar una conversación, el `WARDROBE_BASELINE` block reflejará el valor nuevo, no el del momento del mensaje. Domain invariant #8 (snapshot semantics) requiere snapshots point-in-time.

Decisión: **DISMISS — pre-existing gap, no regresión por 0135.** Mi plan dijo "invariant #8 preserved" — correcto en el sentido "no introduzco una regresión nueva", incorrecto en el sentido "el invariant ya estaba siendo respetado". Plan corregido a "no regresión; gap pre-existente del image route lectura-live vs snapshot — independiente de 0135". Para tracker como deuda futura.

**Confirmations clean (no findings):** exclude_wardrobe logic correcto, startswith tuple pythonic, no strength kwarg en ningún path, backwards compat para chars sin signature_style (Naoko/Ilona/Rafa/Marek/Mateo del 0081 + Valeria/Gianni/Tomás/Hisako/Inés en dev), no semantic regression en el seedream prompt consolidado, ambos refiners (Danbooru + seedream) saben consumir WARDROBE_BASELINE (uno por nombre explícito, otro por semantics).

### `code-simplifier` → 0 cambios aplicados

6 candidatos evaluados, 6 rechazados con rationale: constants worth keeping (nombres documentan intent), kwarg pattern correct, `cols` filter pythonic, rename APPEARANCE→APPEARANCE_NOTES load-bearing, tuple `startswith` canonical idiom, comentarios in-place intencional documentation.

Output del simplifier: *"The cycle 0135 diff is already at the right level of explicitness — verbose where the why is non-obvious, compact where the code speaks for itself. Nothing to ship."*

### Visual sign-off del creator antes de commit

Per [[feedback_visual_approval_before_commit]] — implícitamente otorgado vía AskUserQuestion 2026-05-15: el creator vio screenshots de Maya GREEN (sterile reference) y Hideo PARTIAL (leak vía distinctive_features), y eligió "arreglar en código para futuros, dejar a Hideo así". El cycle queda con la verificación visual revisada y aceptada.
