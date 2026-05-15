---
id: 0037
slug: rename-greeting-first-message-cleanup
status: shipped
created: 2026-04-17
---

# Cycle 0037 — Rename "Greeting" → "First Message" (UX) + cleanup stale Evelyn conversations

## Context

Follow-up de cycle 0036. El creator propuso renombrar "Greeting" a algo más amplio porque el primer mensaje del character no siempre es un saludo — puede ser una narración, una acción, cualquier línea de apertura. "First Message" captura el concepto mejor.

También pidió limpieza de conversaciones viejas de Evelyn (4 convos con greetings stale creados durante debugging de cycles 0034-0036).

**Alcance**:
- UI-only rename. La columna DB sigue siendo `characters.greeting`, el tipo TS sigue llamándose `greeting`, las APIs no cambian. Solo texto que ve el usuario.
- Cleanup puntual via DB delete (no migration).

**Done when**:
- `/character/{id}/edit` — la label dice "First Message" con helper explicando uso + placeholder referenciando `{{user}}` / `{{char}}`.
- Modal "Enrich with AI" — la confirmación dice "first message" en lugar de "greeting".
- 4 conversaciones stale de Evelyn eliminadas; queda solo `269ef256` (clean, 0 mensajes).

## Change

### `frontend/src/features/characters/CharacterForm.tsx`

1. Label línea 727: `"Greeting (character's first message, auto-sent)"` → `"First Message (what the character says or does when the chat opens — a greeting, a line, a narration. Leave empty to open straight into the scenario.)"`.
2. Placeholder línea 731: `"The character's opening line when a new conversation starts."` → `"The character's opening message. Optional. Use {{user}} and {{char}} to substitute the User Persona and Character names."`.
3. Enrich confirm línea 251: "...scenario / greeting / tagline..." → "...scenario / first message / tagline...".

`data-testid="greeting"` se mantiene (selectors de tests no deben romperse).

### DB cleanup (one-shot, via Playwright)

Borradas 4 conversaciones de Evelyn (`4c5d6650`, `cb643129`, `fe98d5e6`, `efca645b`) — todas tenían el greeting frozen de iteraciones anteriores y no tenían otros mensajes. Conservada `269ef256` (0 messages, creada post-fixes). Cascade del schema borra `messages` + `message_variants` automáticamente.

## Verification

- ✅ **TypeScript**: `npx tsc --noEmit` clean.
- ✅ **Playwright**: `/character/adbb8f1e-.../edit` → Info tab → label reads "First Message" con helper y placeholder nuevo. Screenshot confirma.
- ✅ **DB**: conversaciones de Evelyn antes: 5 (4 con stale greeting + 1 clean). Después: 1 (solo `269ef256`).
- ✅ **No regresión**: data-testids intactos; DB columns intactas; comments internos de código mantuvieron "greeting" donde eran referencias técnicas.

## Notes

- El código Python backend / migrations / schema docs siguen usando `greeting` — es el nombre de la columna. Solo el texto user-visible cambió.
- Si aparecen más characters con greeting stale, el creator puede eliminar esas conversaciones con el botón × del switcher "New Conversation ▾".
