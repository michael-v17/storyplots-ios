# Reference Map — StoryPlots iOS

> Mapa de fuentes de verdad para la migración del frontend a iOS nativo.
> Este archivo no aparece en el `SEED-GUIDE.md` v2 estándar — fue agregado porque este seed **no es greenfield**:
> es una re-implementación del frontend sobre un backend y dominio ya productivos.
> Sin este mapa, los demás archivos del seed no saben de dónde extraer evidencia.

---

## 1. Naturaleza de este seed

StoryPlots tiene un proyecto web completo y funcionando en `base/` (89+ ciclos shipped, FastAPI + React + Supabase). El frontend iOS no se construye desde cero conceptualmente — se construye **migrando el comportamiento observable y los contratos existentes** a una capa nativa. Por eso:

- **No regeneramos** `schema.md`, `domain.md`, `product.md`, `user-stories.md` desde cero. Esos viven implícitamente en el código, en las migraciones de Supabase, en las rutas del backend, y en los flows del frontend web.
- **Sí regeneramos** `tech-stack.md`, `ux.md`, `design.md`, `api-contract.md`, `roadmap.md`. Son los archivos que cambian al pasar de web a iOS nativo.
- `base/Seed/` (el seed v1 original del proyecto) **no se usa como autoridad**. Quedó atrás respecto al código real. Se mantiene como contexto histórico, no como spec.

---

## 2. Precedencia general (de mayor a menor autoridad)

Cuando una decisión iOS necesita evidencia, consultar en este orden. Lo de arriba gana sobre lo de abajo si entran en conflicto:

1. **`seed/creator-vision.md`** — intención y principios para esta migración iOS. Autoridad absoluta sobre intención.
2. **`seed/tech-stack.md`, `seed/api-contract.md`, `seed/ux.md`, `seed/design.md`** — decisiones formalizadas para iOS. Autoridad operativa diaria.
3. **Código productivo de `base/`** — fuente de verdad sobre comportamiento real (rutas, esquemas, flows, tokens). Más confiable que cualquier doc.
4. **Web vivo levantado vía Playwright** — autoridad sobre comportamiento que no es obvio leyendo el código (animaciones efectivas, ritmo de streaming, edge cases visuales).
5. **`base/Seed/PersonaLLM-Reference/`** — origen conceptual del proyecto. Útil cuando algo del comportamiento no tiene explicación obvia en el código y conviene entender la motivación.
6. **`base/Seed/`** (vision/architecture/domain/schema/ux/design/product/user-stories/open-questions) — referencia histórica. Lectura solo si necesitás entender por qué algo fue diseñado así fundacionalmente. **No** se cita como autoridad de implementación.

Regla práctica: **si una decisión iOS contradice a `base/` el código, asumimos que el código tiene razón** (es la verdad ejecutada). Si una decisión iOS contradice a `base/Seed/`, asumimos que el seed v1 quedó atrás.

---

## 3. Mapa de fuentes por tema

### Dominio, schema, invariantes

| Pregunta | Dónde mirar primero |
|---|---|
| Qué tablas existen y sus columnas | `base/supabase/migrations/*.sql` — orden numérico, cada archivo aplica un cambio |
| Qué relaciones entre entidades hay | Mismas migraciones + `base/backend/app/routes/*.py` (queries y joins) |
| Reglas de negocio que cruzan tablas | `base/backend/app/routes/` (lógica de aplicación) y `base/backend/app/prompt_assembly.py` (orquestación de chat) |
| RLS / políticas de acceso | `base/supabase/migrations/` (search `policy` o `RLS`) |
| Origen conceptual de las entidades | `base/Seed/PersonaLLM-Reference/03-data-model.md` |

**No** consultar `base/Seed/schema.md` ni `base/Seed/domain.md` como autoridad — son v1 y pueden estar desactualizados respecto a las migraciones reales.

### API y contratos backend

| Pregunta | Dónde mirar primero |
|---|---|
| Inventario de rutas y métodos | `base/backend/app/routes/` — un archivo por familia (chat.py, fork.py, image.py, etc.) |
| Auth, validación de JWT | `base/backend/app/deps/jwt.py` |
| Modelos Pydantic (request/response shapes) | Dentro de cada archivo en `routes/` — la decoración `@router.post` lista shapes |
| Streaming (SSE) | `base/backend/app/routes/chat.py` + cliente real `base/frontend/src/lib/chat.ts` (parser SSE de referencia) |
| Prompt assembly | `base/backend/app/prompt_assembly.py` + `base/backend/app/prompts/*.txt` |
| Providers externos (OpenAI, ElevenLabs, fal.ai, ComfyUI) | `base/backend/app/agents/` |

**Para iOS**: el contrato canónico es lo que devuelve el backend, no lo que el cliente TS espera. Si el cliente TS hace adaptaciones, eso es decisión del cliente — iOS puede elegir distinto.

### UX y flows

| Pregunta | Dónde mirar primero |
|---|---|
| Qué rutas y screens existen | `base/frontend/src/routes/` (28 archivos top-level) |
| Cómo se compone cada screen | `base/frontend/src/features/{chat,characters,shell,settings,auth,import}/` |
| Cómo se llama al backend (clientes API JS) | `base/frontend/src/lib/*.ts` (un archivo por familia: chat.ts, characters.ts, conversations.ts, etc.) |
| Estado de UI persistido | `base/frontend/src/lib/*Prefs.ts` (sidebarPrefs, samplerPrefs, homePrefs, etc.) |
| Patrones de interacción específicos (long-press, fork, edit-trim) | Buscar por nombre en `features/chat/` (e.g. `MessageContextMenu.tsx`, `ForkDialog.tsx`, `EditTrimDialog.tsx`) |
| Comportamiento real al usuario en vivo | Levantar web (`base/frontend && pnpm dev`) y usar Playwright |

### Diseño visual

| Pregunta | Dónde mirar primero |
|---|---|
| Paleta de colores, tokens base | `base/frontend/src/styles/tokens.css` — **fuente concreta de verdad para esta migración** |
| Tipografía | `tokens.css` + fuentes en `base/frontend/public/fonts/` (SF Pro Text + Display) |
| Componentes visuales de referencia | `base/frontend/src/features/` (sobre todo `chat/MessageBubble.tsx`, `characters/CharacterCard.tsx`) |
| Estética en operación real | Playwright contra el web vivo |

**Nota importante**: `base/CLAUDE.md` referencia un folder `DesignSystem/` con `colors_and_type.css`, `ui_kits/`, `preview/`, etc. **Ese folder no existe en `base/` en el filesystem actual.** Los tokens vivos están en `base/frontend/src/styles/tokens.css` (que dice "copiado verbatim de DesignSystem/colors_and_type.css"). Para esta migración, tratamos `tokens.css` como la única fuente visual concreta. Si el DesignSystem completo aparece más adelante, podemos elevar su autoridad — pero hoy no bloquea.

### Contexto histórico (consultar solo cuando hace falta)

| Cuándo | Dónde |
|---|---|
| Entender por qué chat funciona como funciona (11 posiciones de prompt assembly, etc.) | `base/Seed/PersonaLLM-Reference/06-chat-interaction-model.md`, `07-prompts-and-llm-touchpoints.md` |
| Entender por qué hay character accents y per-character coloring | `base/Seed/PersonaLLM-Reference/09-design-system.md` |
| Entender flows fundacionales del producto | `base/Seed/PersonaLLM-Reference/05-flows.md` |
| Sesiones ya ejecutadas, decisiones del pasado | `base/SESSION_HANDOFF.md`, `base/plans/0001-*.md`..`base/plans/0129-*.md` |

---

## 4. Reglas para usar `base/`

1. **Read-only.** `base/` no se modifica desde la migración iOS. Si el backend necesita un cambio para iOS, ese cambio se hace en `base/backend/app/routes/v2/` (o `routes/ios/`) — nunca tocando `routes/v1`. Cualquier otro cambio en `base/` se discute con el creator antes.
2. **No copiar código TS a Swift verbatim.** El TS expresa idioms web. Swift tiene su propio idioma — adaptar, no transcribir.
3. **Tokens y reglas visuales sí se respetan literalmente.** Mismos valores hex, misma escala tipográfica, mismas semánticas (destructive, success, brand). El polish nativo de iOS se logra con `tokens` correctos + animaciones nativas + componentes nativos, no inventando una paleta nueva.
4. **Web vivo es para inspección, no para verificación iOS.** Playwright se usa para *entender* cómo se comporta un flow en el web cuando el código solo no alcanza. Para verificar el código iOS se usa Xcode MCP / simulator MCP, no Playwright.

---

## 5. Cómo levantar el web vivo (para inspección Playwright)

> Necesario solo cuando el código de `base/frontend/` no aclara un comportamiento (animación efectiva, ritmo, edge case visual).

Backend:
```bash
cd base/backend
uv sync               # solo primera vez
uv run uvicorn app.main:app --reload --port 8000
```

Frontend:
```bash
cd base/frontend
pnpm install          # solo primera vez
pnpm dev              # corre Vite, por defecto en :5173
```

Supabase: el `base/frontend/.env.local` apunta a la instancia productiva o de staging configurada. Para Playwright contra el web vivo, se reusa esa misma sesión (auth queda en localStorage del browser controlado por Playwright). Para inspección **anónima** de flows que no requieren auth, basta navegar las rutas públicas (`/sign-in`, `/sign-up`, splash).

**Patrón de inspección recomendado:**
1. Navegar a la ruta que querés observar.
2. Tomar un snapshot del DOM con Playwright.
3. Si la duda es animación o timing, grabar (o tomar múltiples snapshots espaciados) y describir el patrón observado.
4. Anotar la observación en el archivo del seed que la motivó (no dejarla volátil).

**Playwright es para el web vivo en `base/`, no para verificación iOS.** La verificación iOS va por los 3 MCPs nativos (Apple Xcode MCP `RenderPreview` / `RunAllTests`, XcodeBuildMCP para device físico, ios-simulator-mcp para flujos interactivos). Playwright nunca toca el simulador iOS.

---

## 6. Alcance de este seed

- **Plataforma**: iPhone únicamente. No iPad, no Mac Catalyst, no watchOS, no widgets, no App Clip — al menos no en el ciclo inicial.
- **Idioma de la UI**: el web sirve en español/inglés (revisar — la app actual parece tener algunos textos hardcoded en español dentro de `base/CLAUDE.md`, pero el seed v1 está en inglés). Para iOS: lo tratamos como decisión abierta en `open-questions.md` hasta confirmar.
- **Paridad de features con web**: se busca paridad funcional cercana, no idéntica. Hay liberty para repensar UX en términos iOS sin perder capacidades clave.

---

## 7. Qué NO está en este mapa

- Cómo *implementar* algo en Swift — eso vive en `tech-stack.md` y en los plans.
- Decisiones de arquitectura iOS (capas, módulos, navegación) — `tech-stack.md` + `ux.md`.
- El roadmap de fases — `roadmap.md` (último archivo, después de tech-stack/ux/design).
- Convenciones de Git, commits, branches — eso es del kickoff del approach (ECC podado).

---

## 8. Mantenimiento de este archivo

Este mapa se actualiza cuando:
- Aparece una fuente nueva (e.g. una doc del backend recién escrita, un repo de design tokens publicado aparte).
- Una fuente desaparece o cambia de path.
- Cambia la precedencia (e.g. si el seed v1 de `base/` se actualiza y vuelve a ser autoridad).

No se actualiza por cada plan ni por cada ciclo. Es un documento de orientación, no un log.
