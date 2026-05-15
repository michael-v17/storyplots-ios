# Plan 0130 — Per-character Roleplay scaffolding overrides

## Objetivo

Hoy el Roleplay scaffolding (author framing / relationship pacing / style anchor)
es **global por usuario** (`users.preferences.rp`, cycle 0113 / migración 0039).
La página `/settings/roleplay` lo dice textual: *"Per-character overrides are not
exposed in this release."*

Este ciclo agrega el **override per-character** en el CharacterForm: cada personaje
puede fijar su propio `author_framing` / `pacing` / `style_anchor`, o dejar cada
campo en **"Inherit"** para heredar el default global. El pacing queda visible y
editable en la edición del personaje.

**Fuera de scope** (decidido con el creator, ciclos siguientes):
- Wiring de `characters.default_persona_id` + persona en el chat.
- Limpieza del `ChatControlsPanel` (filas disabled Autopilot/AutoTTS/Debug).
- Exponer el pacing dentro del drawer del chat (read-only o editable per-conv).

## Provenance

- Extiende **cycle 0113** (Roleplay scaffolding defaults — `prompt_assembly.py`
  AUTHOR_FRAMING_TEXT / PACING_*_TEXT / STYLE_ANCHOR_TEXT, migración
  `0039_roleplay_preferences.sql`, `lib/rpPrefs.ts`, `routes/RoleplaySettings.tsx`).
- Feature nuevo v0 (no en el Seed). CLAUDE.md "Estado actual": *"Features y extras
  nuevos son válidos aunque no estén en el Seed."*
- **Non-negotiable preservado**: snapshot semantics (creator-vision §8). El override
  se congela en `character_snapshot` al crear la conversación — editar el personaje
  después NO muta conversaciones existentes. Mismo patrón que `writing_style_snapshot`
  y `character_memory_enabled` (chat.py:244-255).
- Agent isolation, edit-as-trim, branching, grammar-off-default, SSE, BYOK,
  plain-text reply path: no tocados.

## Modelo de datos

`characters.rp_overrides jsonb` — nullable, default `null`. Shape:

```json
{ "author_framing": true, "pacing": "warm", "style_anchor": false }
```

- **Cualquier key ausente = heredar el default global** de ese key.
- `null` / `{}` = heredar todo (comportamiento idéntico al actual).
- `pacing` válido: `"off" | "slow_burn" | "warm"`.

Se snapshotea dentro de `character_snapshot` al crear la conversación (no es una
columna nueva en `conversations`). Conversaciones pre-0130 no tienen la key →
fallback a la fila viva de `characters` (igual que `character_memory_enabled`).

## Merge en backend (`chat.py` `_load_bundle`)

Hoy (chat.py:401-405) calcula `rp_author_framing` / `rp_pacing` / `rp_style_anchor`
desde `prefs.get("rp")`. Después de eso, mergear el override per-character key-by-key:

```
char_rp = char_snap.get("rp_overrides")
if not isinstance(char_rp, dict):     # pre-0130 conv → fallback fila viva
    chars = await sup.select(..., "rp_overrides", id=conv.character_id)
    char_rp = chars[0].get("rp_overrides") if chars else None
if isinstance(char_rp, dict):
    if isinstance(char_rp.get("author_framing"), bool):
        rp_author_framing = char_rp["author_framing"]
    if char_rp.get("pacing") in ("off","slow_burn","warm"):
        rp_pacing = char_rp["pacing"]
    if isinstance(char_rp.get("style_anchor"), bool):
        rp_style_anchor = char_rp["style_anchor"]
```

`prompt_assembly.py` no cambia — ya consume `bundle.rp_*` (líneas 417-418, 485).

## UX

CharacterForm, tab **Settings**, fieldset nuevo **"Roleplay scaffolding"** debajo
de "Default persona" / antes de "Character memory enabled":

- Texto corto: "Override the global Roleplay defaults for this character. Leave on
  *Inherit* to follow Settings → Roleplay."
- **Author framing**: select `Inherit (global) / On / Off`.
- **Relationship pacing**: select `Inherit (global) / Off / Slow-burn / Warm`.
- **Style anchor**: select `Inherit (global) / On / Off`.
- Cada label muestra el valor global heredado entre paréntesis (ej. "Inherit
  (Slow-burn)") cargando `loadRoleplayPrefs(userId)` — reusa `lib/rpPrefs.ts`.

Selects (no toggles) porque cada campo es tri-estado (inherit/on/off); el toggle
binario de `/settings/roleplay` no aplica. Tokens-only, patrón `data-form="stack"`.

## Surfaces afectadas

- `supabase/migrations/0045_character_rp_overrides.sql` — NUEVO.
- `backend/app/routes/chat.py` — merge per-character en `_load_bundle`.
- `frontend/src/lib/characters.ts` — `rp_overrides` en `Character` + `CharacterDraft`.
- `frontend/src/lib/conversations.ts` — `CharacterSnapshot` type + `buildCharacterSnapshot`.
- `frontend/src/features/characters/CharacterForm.tsx` — fieldset nuevo + emptyDraft.
- `frontend/src/features/import/mapCardToDraft.ts` — `rp_overrides: null` en el draft.
- `frontend/src/routes/CharacterGenerate.tsx` — `rp_overrides: null` en el draft.
- `frontend/src/lib/rpPrefs.ts` — exportar un `RP_OVERRIDE` type compartido (opcional).

## Domain invariants en juego

- **Snapshot semantics**: `rp_overrides` se congela en `character_snapshot` al crear
  la conversación; el trigger `conversations_snapshot_write_once_trg` lo protege.
- **Agent isolation**: el override viaja por conversación vía snapshot, no hay estado
  cross-conversation.
- RLS de `characters`: la columna nueva hereda las policies existentes (cycle 0004).

## Open questions

Ninguna nueva. El comportamiento global (cycle 0113) está documentado y la página
`/settings/roleplay` ya declara que el per-character override estaba pendiente —
este ciclo lo entrega.

## Implementation order (5 subtareas, verificación entre cada una)

1. **Migración + tipos.** `0045_character_rp_overrides.sql` (`alter table characters
   add column rp_overrides jsonb`). `Character` + `CharacterDraft` + `emptyDraft` +
   `mapCardToDraft` + `CharacterGenerate` con `rp_overrides`.
   *Verify (non-UI)*: `tsc` 0 errors; migración corre limpia en Supabase; `select
   rp_overrides from characters limit 1` devuelve `null`.

2. **Snapshot.** `CharacterSnapshot` type + `buildCharacterSnapshot` incluyen
   `rp_overrides`.
   *Verify (non-UI)*: `tsc` 0 errors; crear conversación nueva por Playwright y
   confirmar `character_snapshot.rp_overrides` presente en la fila.

3. **Backend merge.** `chat.py` `_load_bundle` mergea el override per-character sobre
   el global, con fallback a la fila viva para conversaciones pre-0130.
   *Verify (non-UI)*: `py_compile` OK. Test manual: personaje con `rp_overrides =
   {"pacing":"warm"}` → un turno de chat → log/inspección confirma `bundle.rp_pacing
   == "warm"` mientras el global sigue en `slow_burn`. Personaje sin override →
   `bundle.rp_pacing` == global.

4. **CharacterForm UI.** Fieldset "Roleplay scaffolding" con los 3 selects tri-estado
   + labels que muestran el valor global heredado. Patch al `draft.rp_overrides`.
   *Verify (Playwright L=1440×900 + S=375×812)*: abrir `/character/:id/edit` → tab
   Settings → el fieldset renderiza; cambiar pacing a "Warm" → Save → reload → el
   select persiste "Warm"; volver a "Inherit" → Save → reload → `rp_overrides.pacing`
   ausente.

5. **Regresión + close-out.** Personaje sin override = comportamiento idéntico al
   actual. `/settings/roleplay` global intacto.
   *Verify (Playwright)*: smoke de las flows tocadas — crear personaje (emptyDraft),
   editar personaje, abrir chat. `code-review` + `code-simplifier` pass. tsc 0 errors,
   reload×3 estable.

## Verification

**Migración**: aplicada por el creator en el Supabase activo (`mhdekknjaigoeuzrriey`).
Confirmado vía Playwright `browser_evaluate` → `select id,name,rp_overrides` devuelve la
columna con `null` en las 5 filas existentes.

**Subtarea 1 (tipos)**: `tsc --noEmit` 0 errores. `CharacterDraft` hereda `rp_overrides`
vía el `Omit<Character, …>`.

**Subtarea 2 (snapshot)**: con Gianni seteado a `rp_overrides = {"pacing":"warm"}`, se
llamó `createConversationFromCharacter` en page-context → el `character_snapshot` de la
conversación creada llevó `rp_overrides: {"pacing":"warm"}`. Conversación throwaway
borrada tras el check.

**Subtarea 3 (backend merge)**: el merge se extrajo a la función pura
`_apply_char_rp_override` (también una simplificación — testeable en aislamiento).
7 casos verificados con el venv del backend: sin override (`None`) → globales intactos;
`{}` → intactos; `{"pacing":"warm"}` → solo pacing cambia; override completo → los 3
cambian; `pacing` inválido → ignorado; `author_framing` no-bool → ignorado; input
no-dict (`"garbage"`) → intactos. `py_compile` OK. **No** se ejercitó un turno de chat
LLM real (sin API key activa en el entorno de test) — el merge que alimenta
`bundle.rp_pacing` queda cubierto por los 7 casos de la función pura.

**Subtarea 4 (UI)**: Playwright L=1440×900 + S=375×812. Fieldset "Roleplay scaffolding"
renderiza con los 3 selects mostrando los valores globales heredados ("Inherit (On)" /
"Inherit (Slow-burn)" / "Inherit (On)"). Pacing → "Warm" → Save → DB persiste
`{"pacing":"warm"}` → reload → select muestra "Warm" seleccionado. Pacing → "Inherit"
→ Save → DB persiste `null` (colapso del último key) → regresión-limpia. 0 console
errors. Screenshot `cycle-0130-rp-fieldset-L.png` aprobado visualmente por el creator.

**Subtarea 5 (close-out)**: `code-review` — 2 findings, ambos rechazados con rationale
(el reviewer asumió un gate por `mode` en `prompt_assembly.py` que no existe — el RP
scaffolding es mode-agnostic desde cycle 0113; gatear el fieldset por mode sería
*inconsistente* con el comportamiento real del backend). `code-simplifier` — 0 aplicados
(código ya mínimo); nota un follow-up opcional fuera de scope: unificar el ternary de
`pacingLabel` con `RoleplaySettings.tsx:152`. Non-negotiables intactos (snapshot
semantics vía `buildCharacterSnapshot` + trigger write-once; agent isolation; el override
viaja por conversación, sin estado cross-conversation).
