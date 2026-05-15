---
id: 0034
slug: greeting-placeholders-hide-controls
status: shipped
created: 2026-04-17
---

# Cycle 0034 — Greeting: substitute `{{user}}`/`{{char}}` + hide bubble controls

## Context

El creator reportó dos bugs visibles en la primera conversación abierta contra Dr. Aris Thorne (character importado en cycle 0027):

1. **Placeholder literal**: el greeting del character (que vino de una V2 card) dice `"{{user}} enter Aris's serene virtual counseling space…"`. El texto `{{user}}` se muestra crudo. La V2 Tavern convention de PersonaLLM-Reference ([PersonaLLM-Reference/06-chat-interaction-model.md](../Seed/PersonaLLM-Reference/06-chat-interaction-model.md)) usa `{{user}}` y `{{char}}` como placeholders que se expanden al nombre del User Persona activo y del character respectivamente. El insert del greeting en `conversations.ts` línea 131 inserta `character.greeting` raw, sin substituir nada.

2. **Botones de interacción en el greeting**: el bubble del greeting muestra **Regenerate / Fork / Generate image / Play** debajo. Esos controles no aplican:
   - **Regenerate**: no hay user turn previo desde el cual regenerar — el greeting es un seed text del character.
   - **Fork**: forkear "desde el greeting" no aporta divergencia, no hay historia.
   - **Generate image**: la imagen de la escena greeting se define a nivel de character settings (ya existen avatar / generate avatar); el bubble no debería ofrecerlo.
   - **Play (TTS)**: el creator dijo explícitamente que todos esos controles deben desaparecer del greeting.

Ambos bugs se fixean en frontend, sin migration, sin backend.

**Principle 5 (Observed vs. Extended).** Substituir `{{user}}`/`{{char}}` es **observed** — PersonaLLM-Reference §6 documenta este comportamiento como canónico de V2 cards. Ocultar los botones del greeting es una **extensión v0** — la app observada muestra el greeting con la misma affordance que cualquier otro mensaje; nosotros decidimos restringir el scope porque esos controles semánticamente no aplican al seed text.

**Done when:**
- Al abrir (o crear) una Conversation con un character cuyo `greeting` contiene `{{user}}` / `{user}` / `{{char}}` / `{char}`, esos placeholders se expanden a nombres reales antes de persistir el mensaje.
- El bubble del greeting no muestra Regenerate / Fork / Generate image / Play (ni en mobile ni en desktop). El resto de mensajes assistant siguen mostrando los 4.
- User messages (right side) con su context menu (Edit/Delete/Fork) no se alteran.

## Shape of the change

Single-file-scope no aplica — toca 3 archivos:

1. `frontend/src/lib/conversations.ts` — substituir placeholders antes del insert en `createConversationFromCharacter`.
2. `frontend/src/features/chat/MessageFeed.tsx` — detectar `isGreeting` por índice + rol y pasarlo al bubble.
3. `frontend/src/features/chat/MessageBubble.tsx` — ocultar el action row si `isGreeting`.

**Detección de greeting**: por **índice + rol**, no por columna DB. Regla: `messageIndex === 0 && message.role === 'assistant'`. Justificación:
- Conversaciones normales empiezan con user (el greeting auto-insertado es lo único que pone el primer assistant-index-0).
- Forks en `keep_messages` copian toda la historia — el primer mensaje vuelve a ser assistant (greeting), mismo trato.
- Forks en `summarize_fresh` no copian el greeting; el primer mensaje es el user's siguiente input. No hace falta gating aquí.
- Sin migration. Sin backfill. Sin coupling con `message_variants`.

Alternativa descartada: columna `messages.is_greeting boolean`. Más robusta, pero requiere migration 0035 + backfill de conversaciones existentes + invalidación de caches. Overkill para el safety net actual.

## Seed sections satisfied

- [Seed/user-stories.md](../Seed/user-stories.md) §5/§6 — conversation start flow.
- [Seed/PersonaLLM-Reference/06-chat-interaction-model.md](../Seed/PersonaLLM-Reference/06-chat-interaction-model.md) — V2 card placeholder convention `{{user}}`/`{{char}}`.
- [Seed/ux.md](../Seed/ux.md) — chat message affordances.

## Commit decisions

- **Placeholders soportados**: `{{user}}`, `{user}`, `{{char}}`, `{char}` (ambos delimitadores, case-sensitive). La V2 Tavern spec usa doble-brace; aceptamos single-brace como fallback porque vi cards que lo usan (ej. la de Dr. Aris Thorne mezclaba).
- **Nombre del user**: resolver desde `personas.name` si `personaId` está set; fallback a `"User"` si no hay persona (nunca debería pasar en práctica — siempre hay default persona — pero no queremos fallar duro).
- **Nombre del char**: `character.name` directo.
- **Where**: substitución en el momento del insert del greeting (frontend). No mutamos `character.greeting` en la tabla `characters` — el template crudo debe sobrevivir (si el creator cambia de User Persona, la Conversation nueva toma el nombre nuevo).
- **Gating de botones**: ocultar el **entire action row** en MessageBubble si `isGreeting`. No ocultar granularmente — los 4 controles caen juntos.

## Schema / RLS

Sin cambios.

## Backend

Sin cambios.

## Frontend

### `frontend/src/lib/conversations.ts`

1. Añadir helper privado:
   ```typescript
   function substitutePlaceholders(text: string, userName: string, charName: string): string {
     return text
       .replace(/\{\{user\}\}/g, userName)
       .replace(/\{user\}/g, userName)
       .replace(/\{\{char\}\}/g, charName)
       .replace(/\{char\}/g, charName);
   }
   ```
2. En `createConversationFromCharacter`, antes del insert del greeting (líneas 123-154):
   - Resolver `userName`: si `personaId` está set, `supabase.from("personas").select("name").eq("id", personaId).maybeSingle()` (best-effort — si falla, fallback a `"User"`).
   - `charName = character.name`.
   - `const greetingText = substitutePlaceholders(character.greeting, userName, charName);`
   - Usar `greetingText` en el insert de `messages.text` Y en el insert de `message_variants.content`. Ambos deben coincidir.

### `frontend/src/features/chat/MessageFeed.tsx`

1. En el `.map`, computar `isGreeting` por índice: `(index === 0 && m.role === "assistant")`. Acceder al índice vía segundo argumento de `map`.
2. Pasar como prop: `isGreeting={isGreeting}` al `MessageBubble`.

### `frontend/src/features/chat/MessageBubble.tsx`

1. Añadir prop `isGreeting?: boolean;` al tipo `Props`.
2. En el render del action row (línea 147), cambiar la condición:
   ```tsx
   {!isUser && !props.isGreeting && (
     <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem" }}>
       …
     </div>
   )}
   ```

## Verification gates

- [ ] **TS check**: `npx tsc --noEmit` clean.
- [ ] **Live verification — placeholder**:
  - [ ] Abrir `/chat/Dr.%20Aris%20Thorne` (o equivalente) — primer mensaje muestra el nombre real del User Persona en vez de `{{user}}`.
  - [ ] Crear nueva Conversation contra un character con `{{char}}` en greeting (crear test character si no existe) — se expande al nombre del character.
- [ ] **Live verification — botones**:
  - [ ] El bubble del greeting NO muestra Regenerate / Fork / Generate image / Play.
  - [ ] Enviar un user message → reply del LLM → ese bubble SÍ muestra los 4 botones (no regresión).
  - [ ] User messages siguen con context-menu (right-click → Edit/Delete/Fork).
- [ ] **Regresión**: forkear una Conversation con `keep_messages` — el fork también oculta controles en su primer mensaje (assistant-index-0, que es el greeting copiado).
- [ ] **`code-review` pass** (agent).
- [ ] **`code-simplifier` pass** (agent).

## Implementation order

1. Edit `conversations.ts` — helper + persona fetch + substitución.
2. Edit `MessageBubble.tsx` — prop `isGreeting` + gate del action row.
3. Edit `MessageFeed.tsx` — pasar `isGreeting` por índice.
4. `npx tsc --noEmit` clean.
5. Live verification con creator (Playwright MCP sigue lockeado; verificación manual en la misma instancia de Chrome del creator).
6. `code-review` + `code-simplifier` en paralelo.
7. Llenar `## Verification`.
8. Commit `feat(0034): …` + update SESSION_HANDOFF.

## Critical files

| File | Change |
|---|---|
| `frontend/src/lib/conversations.ts` | helper + fetch persona + substitución antes del insert |
| `frontend/src/features/chat/MessageFeed.tsx` | pasar `isGreeting` por índice+rol |
| `frontend/src/features/chat/MessageBubble.tsx` | nueva prop + gate del action row |

## Scope expansion — discovered live

Durante verificación con Playwright aparecieron dos bugs adicionales que no estaban en el plan original; se incorporaron al mismo cycle porque compartían el área (conversation start) y contexto:

### Bug 3 — Scenario card rendering con `{{user}}` literal

El **scenario card** (renderizado por `MessageFeed.tsx` antes del primer mensaje, cycle 0025) se pintaba raw desde `character.scenario`. El fix original del plan sólo tocaba el greeting; el scenario quedaba con el placeholder visible. Fix: renombrar el helper `substituteGreetingPlaceholders` → `substituteCardPlaceholders`, exportarlo desde `conversations.ts`, e invocarlo en el render del scenario usando `props.userName` + `props.characterName`. Scenario se substituye at-render-time (live con la persona activa); greeting sigue siendo frozen at-creation-time.

### Bug 4 — Greeting bubble vacío (raíz: NOT NULL sin backfill desde cycle 0008)

Root cause: [supabase/migrations/0008_conversation_agent.sql](../supabase/migrations/0008_conversation_agent.sql) hizo `message_variants.model_snapshot` y `.generation_params_snapshot` NOT NULL. Cycle 0025 (greeting auto-insert) inserta variants sin esas columnas. Bajo el `try { … } catch {}` del bloque greeting el insert del variant fallaba silenciosamente → `messages.text` quedaba populado pero `active_variant_id` NULL. [MessageFeed](../frontend/src/features/chat/MessageFeed.tsx) renderiza assistant desde `variants.find(active)?.content ?? ""` — resultado: bubble vacío con avatar solo. El bug llevaba rompiendo greetings desde cycle 0025 pero nadie lo notó porque las pocas conversaciones afectadas tenían bubbles en blanco que parecían un glitch visual.

Fix: al insertar el variant del greeting, popular con sentinels:
- `model_snapshot: "greeting"` (string explícito, distingue variants de greeting vs LLM-generated).
- `generation_params_snapshot: {}` (satisface NOT NULL sin valores falsos).

**Backfill one-shot**: corrido desde Playwright via supabase-js (3 mensajes broken, nuevos variants creados + `active_variant_id` actualizado). Resultados registrados abajo; no se hizo migration 0035 porque el volumen era minúsculo y el state corrupto solo existía para el tester (creator). Para otros users, si aparecen greetings vacíos, re-correr el snippet:

```js
// One-shot backfill: nueva variant para greetings rotos del pre-fix.
const { data: brokenMsgs } = await supabase.from('messages')
  .select('id, text')
  .eq('role', 'assistant').is('active_variant_id', null).not('text', 'is', null);
for (const m of (brokenMsgs || [])) {
  if (!m.text) continue;
  const { data: v } = await supabase.from('message_variants')
    .insert({ message_id: m.id, content: m.text,
              model_snapshot: 'greeting', generation_params_snapshot: {} })
    .select('id').single();
  if (v) await supabase.from('messages')
            .update({ active_variant_id: v.id }).eq('id', m.id);
}
```

### Bug 5 (defensive, from code-review) — `canRegenerate` coherente con `isGreeting`

`MessageFeed` pasaba `canRegenerate: true` incluso en el greeting; el botón se ocultaba sólo por el gate interno `!props.isGreeting` en MessageBubble. Si ese gate se remueve en refactor futuro, un user podría regenerar el greeting — ahora que el variant existe, la LLM sí crearía una segunda variant. Fix defensivo: `canRegenerate={!isGreeting && role==="assistant" && streamingMessageId===null}`.

## Verification

- ✅ **TypeScript**: `npx tsc --noEmit` clean, dos pasadas (post-plan + post-defensive fix).
- ✅ **Playwright live (Evelyn Hart)**:
  - Scenario card: antes `"It's Evelyn's first day as {{user}}'s personal assistant…"`, después `"It's Evelyn's first day as Michael's personal assistant…"`. Los dos `{{user}}` del texto substituyen correctamente.
  - Greeting bubble: antes vacío con avatar solo, después muestra los 517 chars completos del greeting de Evelyn.
  - Botones en greeting: `hasRegen/hasFork/hasImage/hasAudio = false` via query al DOM.
- ✅ **Backfill DB**: 3 greetings rotos (4954600e-…, 898b81c0-…, ba7b2163-…) tienen variant nueva con `active_variant_id` poblado. Verificado via supabase-js query post-fix.
- ✅ **Non-regression**: assistant messages no-greeting siguen mostrando los 4 controles (layout inspeccionado en DOM).
- ⚠️ **`{{char}}` live test**: no hay characters en DB con `{{char}}` en scenario/greeting; la ruta regex es simétrica con `{{user}}` (verificado) y el helper trata ambas equivalentemente.
- ✅ **`code-review` (feature-dev:code-reviewer)**:
  - Finding 1 (persona asymmetry greeting frozen vs scenario live): aceptado por diseño, noted.
  - Finding 2 (`canRegenerate` defensive): aplicado inline.
  - Finding 3 (`model_snapshot: "greeting"` sentinel downstream): future-only concern para Insights Job; no hay consumer hoy (backend `chat.py` L469 lee model_snapshot pero no escribe "greeting" ni branchea sobre él). Documentar para cuando se construya Insights: guard contra `"greeting"`.
- ✅ **`code-simplifier`**: no changes needed — helper tiene un definition y dos callers, comments son load-bearing (provenance de bug de NOT NULL), greetingText se computa una vez y se reusa en dos inserts.
- **Playwright MCP liberado** (después de `/reload-plugins`) — primera vez en esta sesión que pude usarlo directo. Gate cumplido via snapshot + evaluate + screenshot en lugar de manual.
