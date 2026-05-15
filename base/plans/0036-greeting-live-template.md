---
id: 0036
slug: greeting-live-template
status: shipped
created: 2026-04-17
---

# Cycle 0036 — Greeting as live template: hide frozen greeting bubble when character.greeting is empty

## Context

Cycle 0035 hizo que el greeting fuera opcional para conversaciones NUEVAS (si el creator borra el greeting del character, la nueva conversation no inserta mensaje). Pero las conversaciones EXISTENTES seguían mostrando el greeting viejo (frozen en `messages.text` + `message_variants.content` desde cuando fueron creadas).

El creator abrió Evelyn con greeting vaciado en settings y reportó "aun asi en el feed se ve algo". Evidencia Playwright:

- `characters.greeting = null` ✓
- Pero 4/5 conversaciones tienen greeting messages persistidos con variants válidos (algunos de un backfill post-cycle 0034 para arreglar el NOT NULL bug de cycle 0008).

**Interpretación**: el creator trata al `greeting` como **character metadata live**, no como snapshot frozen. Es coherente con que `scenario` también se lee live desde `character.scenario` en el render (no desde `character_snapshot`). El `CharacterSnapshot` type en `conversations.ts` incluye `scenario` pero **NO incluye `greeting`** — confirma que greeting nunca fue parte del snapshot semántico; siempre fue un template.

**Done when**:
- Abrir una conversación existente con `character.greeting = null`: no aparece la burbuja greeting (aunque exista en DB). Scenario card y resto de mensajes del chat intactos.
- Abrir misma conversación con `character.greeting` repopulado: la burbuja greeting frozen vuelve a aparecer (la data nunca fue borrada).
- Nueva conversación (con o sin greeting): comportamiento igual a cycle 0035.

## Change

### `frontend/src/features/chat/MessageFeed.tsx`

1. Nueva prop `characterGreeting?: string | null`.
2. Derivar `characterHasGreeting = !!props.characterGreeting && trim().length > 0`.
3. Computar `visibleMessages = messages.filter` quitando el primer assistant si `!characterHasGreeting`.
4. `isEmpty` y el map usan `visibleMessages` en lugar de `messages`.

### `frontend/src/features/chat/ChatShell.tsx`

1. Pasar `characterGreeting={character.greeting}` a `<MessageFeed>`.

## Verification

- ✅ **TypeScript**: `npx tsc --noEmit` clean.
- ✅ **Playwright live — greeting null**:
  - Conversación `4c5d6650` tenía el greeting "*Evelyn smiles warmly at Michael*" en DB.
  - `characters.greeting = null` en settings.
  - Render: solo scenario card + "Send a message to begin.". Sin greeting bubble. ✓
- ✅ **Playwright live — greeting restaurado** (`*Evelyn smiles warmly at {{user}}*`):
  - Misma conversación `4c5d6650`.
  - Render: scenario + greeting bubble "Evelyn smiles warmly at Michael". ✓ La data frozen sobrevive — solo estaba oculta.
- ✅ **Non-regression**: regular assistant replies (index > 0) nunca se filtran; edit-as-trim y branching intactos (el filtrado es puramente visual).
- ✅ **Seed semantics**: `CharacterSnapshot` type no cambia; greeting nunca estuvo ahí. El filtrado es consistente con que `scenario` también se lee live desde `character.scenario`.

## Notes

- No se borró ningún mensaje de la DB. Si el creator repobla el greeting del character después, las conversaciones existentes vuelven a mostrar el greeting viejo (no el nuevo). Para actualizar a un greeting nuevo, el creator puede borrar la conversación y crear una nueva.
- Consideramos borrado en cascade (cuando `character.greeting` se setea a null, borrar todos los greeting messages). Rechazado por violar snapshot semantics y ser destructivo sin deshacer.
