# Plan 0131 — Honor `characters.default_persona_id` (persona always present)

## Objetivo

`characters.default_persona_id` existe en el schema (migración 0004), está en el
`Character` type y tiene un select "Default persona" en el CharacterForm — **pero
nunca se lee** al crear una conversación. Las 3 rutas de creación
(`useCharacterOpen`, `CharacterForm.handleClose`, `ConversationSwitcher.onNew`)
hacen cada una `loadPersona(userId)` (la persona global única) e ignoran el campo
del personaje.

Además, `findOrCreateForCharacter` devuelve la conversación existente tal cual —
una conversación vieja creada con `persona_id = null` (antes de que el usuario
tuviera persona, o por algún path que pasó null) se queda sin persona para
siempre, y el modelo nunca recibe el bloque "User Persona" (posición 4) en esa
conversación.

Este ciclo:
1. **Cablea `default_persona_id`** — al abrir un personaje, la conversación usa
   `character.default_persona_id` si está seteado; si no, cae a la persona global
   del usuario. (decisión del creator: "Honrar default_persona_id + mantener
   fijo", sin switcher en el chat).
2. **Garantiza "siempre salga la persona"** — `findOrCreateForCharacter`
   backfillea `persona_id` en conversaciones existentes que lo tengan en `null`,
   resolviendo la misma persona. Nunca pisa un `persona_id` ya seteado
   ("mantener fijo").

## Provenance

- `characters.default_persona_id` — migración 0004 (`schema.md §2.3`), campo
  declarado y nunca consumido. Esto cierra ese gap.
- Decisión del creator (AskUserQuestion, sesión 2026-05-14): "Honrar
  default_persona_id + mantener fijo … cayendo a la persona global del usuario.
  Sin switcher en el chat."
- Interpretación explícita del creador "que por defecto siempre salga la persona
  del user": para que sea cierto en conversaciones **existentes** con
  `persona_id` null, hace falta el backfill on-open. Se asume y se documenta acá.
- **Non-negotiables preservados**: `persona_id` es una FK mutable por diseño
  (`on delete set null`, migración 0005) — no es el `character_snapshot`
  write-once. El backfill toca solo `persona_id`, no dispara el trigger
  `conversations_snapshot_write_once_trg`. Agent isolation intacto: cada
  conversación resuelve su propia persona, sin estado compartido.

## Modelo de datos

Ningún cambio de schema. Solo se empieza a **leer** `characters.default_persona_id`
y a **escribir** `conversations.persona_id` en el backfill.

## Cambios

`frontend/src/lib/conversations.ts`:
- Nuevo helper interno `resolvePersonaId(userId, character)`:
  `character.default_persona_id ?? (await loadPersona(userId))?.id ?? null`.
- `createConversationFromCharacter(userId, character)` — se le **quita el param
  `personaId`**; resuelve la persona internamente vía `resolvePersonaId`.
- `findOrCreateForCharacter(userId, character)` — se le quita el param; si la
  conversación existente tiene `persona_id === null`, la backfillea con
  `resolvePersonaId` (UPDATE de solo `persona_id`) y devuelve la fila
  actualizada; si ya tiene persona, la devuelve sin tocar.

Call sites (los 3 dejan de hacer `loadPersona` + pasar el id):
- `frontend/src/features/characters/useCharacterOpen.ts`
- `frontend/src/features/characters/CharacterForm.tsx` (`handleClose`)
- `frontend/src/features/chat/ConversationSwitcher.tsx` (`onNew`)

## Surfaces afectadas

- `lib/conversations.ts`, `useCharacterOpen.ts`, `CharacterForm.tsx`,
  `ConversationSwitcher.tsx`.
- `ChatShell.tsx` / `YourPersonaCard.tsx` / `CollapsedUserAvatar.tsx` — **no se
  tocan**: siguen mostrando la persona vía `loadPersona` para el display del
  feed/sidebar; este ciclo es sobre la persona que viaja al prompt
  (`conversation.persona_id`).

## Domain invariants

- Snapshot semantics — no se toca `character_snapshot`.
- Agent isolation — sin estado cross-conversation.
- RLS de `conversations` — el UPDATE del backfill cae bajo
  `conversations_update_own` (migración 0005).

## Open questions

Ninguna nueva.

## Implementation order (3 subtareas)

1. **`conversations.ts` — helper + firmas.** `resolvePersonaId` + quitar el param
   `personaId` de `createConversationFromCharacter` y `findOrCreateForCharacter` +
   backfill en `findOrCreateForCharacter`.
   *Verify (non-UI)*: `tsc` — espera errores en los 3 call sites (param de más),
   se arreglan en la subtarea 2; el archivo `conversations.ts` en sí compila.

2. **Call sites.** `useCharacterOpen` / `CharacterForm` / `ConversationSwitcher`
   dejan de importar/llamar `loadPersona` y de pasar el id.
   *Verify (non-UI)*: `tsc` 0 errores.

3. **Verificación E2E (Playwright L=1440 + S=375).**
   - Personaje con `default_persona_id` null + conversación existente con
     `persona_id` null → abrir → la conversación queda con `persona_id` = id de
     la persona global (backfill verificado por query).
   - Setear `default_persona_id` de un personaje a la persona del usuario en el
     CharacterForm → nueva conversación (vía ConversationSwitcher → New) → su
     `persona_id` = ese id.
   - Personaje sin persona global y sin `default_persona_id` → conversación con
     `persona_id` null, sin error (caso degenerado intacto).
   - `code-review` + `code-simplifier` pass. tsc 0, 0 console errors.

## Verification

**Subtarea 1 + 2**: `tsc --noEmit` 0 errores tras quitar el param de los 3 call sites.

**Subtarea 3 (E2E, page-context — ejercita el código de producción real)**:
- **Test A (backfill)**: se puso `persona_id = null` en una conversación existente
  de Gianni (simulando una conversación pre-persona) → `findOrCreateForCharacter`
  → la fila devuelta **y** la fila en DB quedaron con `persona_id` = la persona
  global. `pass: true`.
- **Test B (fallback)**: `createConversationFromCharacter` para Gianni
  (`default_persona_id` null) → `persona_id` = persona global. `pass: true`.
  Conversación throwaway borrada.
- **Test C (default_persona_id honrado)**: `createConversationFromCharacter` para
  Valeria (`default_persona_id` seteado) → `persona_id` = `default_persona_id` de
  Valeria. `pass: true`. Throwaway borrada.
- **UI happy-path**: click en la card de Gianni desde `/characters` → navega a
  `/chat/.../ed55c442-…`, 0 console errors.
- No se verificó S=375 por separado: el ciclo es lógica pura (`conversations.ts` +
  call sites), no cambió ninguna superficie visual.

**Subtarea 5 (close-out)**: `code-review` — 3 findings. **F2 aplicado** (predicado
`.eq("user_id", userId)` defense-in-depth en el UPDATE del backfill, consistente
con `listConversationsForCharacter`). **F1 rechazado** — el reviewer asumió que
`characters.default_persona_id` no es `on delete set null` (lo es, migración 0004),
y el caso cross-user ya está bloqueado por la RLS de `user_personas` en
`chat.py._load_bundle` (lee bajo el JWT del usuario). **F3 rechazado/nota** —
re-fetch de la persona en el bloque greeting es código pre-existente fuera del
diff. `code-simplifier` — 0 cambios (diff ya mínimo; el helper `resolvePersonaId`
tiene 2 call sites reales, no es abstracción especulativa). Non-negotiables
intactos: `character_snapshot` write-once no tocado; el backfill solo escribe
`persona_id` (FK mutable por diseño); agent isolation — cada conversación resuelve
su propia persona.
