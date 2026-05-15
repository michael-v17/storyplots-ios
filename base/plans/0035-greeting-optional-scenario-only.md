---
id: 0035
slug: greeting-optional-scenario-only
status: shipped
created: 2026-04-17
---

# Cycle 0035 — Greeting optional: scenario card standalone + persona fetch table fix

## Context

Follow-up de cycle 0034 descubierto en verificación live:

1. **Greeting opcional**: si el creator borra el greeting del character, `MessageFeed` hacía `if (messages.length === 0) return <empty-section>` y ocultaba TAMBIÉN el scenario card. Resultado: al entrar a un character sin greeting, la pantalla quedaba con solo "No messages yet." y el scenario desaparecía. El creator quiere que el scenario card se muestre siempre (con o sin greeting), y que cuando no haya greeting NO aparezca el avatar huérfano.

2. **Persona fetch en tabla incorrecta**: el fix de cycle 0034 consultaba `.from("personas")` pero la tabla real es `user_personas` (ver `frontend/src/lib/persona.ts`). Resultado: toda substitución de `{{user}}` en greeting caía al fallback hardcoded `"User"` — en scenario render sí funcionaba (usa `props.userName` from ChatShell).

**Done when**:
- Character con greeting vacío: scenario card visible, no avatar huérfano, hint "Send a message to begin." debajo del scenario.
- Character con greeting vacío y scenario vacío: hint original "No messages yet. Send one to start the conversation."
- Character con greeting: comportamiento igual al post-0034 (scenario + greeting bubble), y el `{{user}}` del greeting ahora se expande al nombre real de la User Persona (no a "User").

## Changes

### `frontend/src/features/chat/MessageFeed.tsx`
- Eliminado el early return de `messages.length === 0`.
- Flag `isEmpty` derivada; `testid` selector `chat-feed-empty` vs `chat-feed` preservado.
- Scenario card renderiza igual (con substitución `substituteCardPlaceholders`).
- Cuando `isEmpty`, un `<p>` con mensaje condicional: "Send a message to begin." si hay scenario, o el mensaje original si no hay nada.

### `frontend/src/lib/conversations.ts`
- `.from("personas")` → `.from("user_personas")` en la persona fetch del greeting insert.

## Verification

- ✅ **TypeScript**: `npx tsc --noEmit` clean.
- ✅ **Playwright live — empty greeting**:
  - Seteé `characters.greeting = null` para Evelyn.
  - Nueva conversation → pantalla muestra scenario card ("It's Evelyn's first day as Michael's personal assistant…") centrado + "Send a message to begin." debajo, sin avatar.
- ✅ **Playwright live — restored greeting** (`*Evelyn smiles warmly at {{user}}*`):
  - Nueva conversation → scenario card + greeting bubble "Evelyn smiles warmly at Michael" (Michael substituido correctamente desde `user_personas`).
- ✅ **Código post-cycle**: greeting de Evelyn restaurado a `null` en DB para no dejar test data.
- ✅ **`code-review`**: no issues ≥ threshold. Greps confirmaron que no hay otros callsites con `from("personas")`. El loading state `null` nunca llega a MessageFeed (ChatShell gatea antes).
- ✅ **`code-simplifier`**: no-op, delta ya minimal.

## Notes

- Las conversaciones creadas con el bug del table name (`"personas"`) ya tienen su greeting persistido con `"User"` literal. No hay backfill retroactivo en este cycle — cuesta más de lo que vale, y el creator puede borrar esas conversaciones desde el switcher. Las conversaciones nuevas ya salen bien.
