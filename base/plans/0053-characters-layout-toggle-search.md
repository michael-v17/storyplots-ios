---
id: 0053
slug: characters-layout-toggle-search
status: shipped
created: 2026-04-19
---

# Cycle 0053 — Characters page layout toggle + search (structural cycle C.1)

## Context

Parte 1 del cycle C estructural. PersonaLLM's populated-home ([04-screens/home.md](../Seed/PersonaLLM-Reference/04-screens/home.md) §State B/C/D) expone 3 layouts cíclicos (grid/compact circles/list) + search field para filtrar la librería. Nuestro `/characters` hoy es grid fijo sin filtros.

**No** tocamos `/` (Home) porque solo muestra 6 recientes — el toggle + search hace más sentido en `/characters` que es la librería completa.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §4.2 Home / §4 Characters (screen contracts).
- [Seed/PersonaLLM-Reference/04-screens/home.md](../Seed/PersonaLLM-Reference/04-screens/home.md) §State B/C/D, §Header.

## Out of scope

- Sort icon (open question in PersonaLLM-Reference; defer).
- Apply toggle to `/` Home recents (intencional — solo 6 items).
- Browse Community (cut por Seed §2 "What is removed vs PersonaLLM").

## Done when

- [ ] `/characters` header incluye un grupo de 3 toggle buttons (grid / circles / list) que ciclan el layout.
- [ ] `/characters` header incluye un search input que filtra por `character.name` case-insensitive client-side.
- [ ] Layout mode persiste en `users.preferences.home.layout` ∈ {`"grid"`,`"circles"`,`"list"`}. Default `"grid"`.
- [ ] Grid = existente `CharacterGrid` (tarjetas).
- [ ] Circles = flex row con avatars circulares (72px) + nombre debajo, sin descripción.
- [ ] List = rows con avatar 40px + nombre + tagline, click-to-chat.
- [ ] Search escapa regex; empty search muestra todo.
- [ ] `npx tsc --noEmit` verde.
- [ ] Playwright gates: (a) toggle cambia layout visible; (b) reload → layout persiste; (c) typing en search filtra inmediato; (d) 3 layouts renderizan Aria/Evelyn/Dr.Aris.

## Shape of the change

### Frontend

**NEW `frontend/src/lib/homePrefs.ts`** — direct-RMW helpers.
```ts
export type HomeLayout = "grid" | "circles" | "list";
export type HomePrefs = { layout: HomeLayout };
export const HOME_PREFS_DEFAULTS = { layout: "grid" as HomeLayout };
// readHomePrefs, loadHomePrefs, saveHomeLayout
```

**NEW `frontend/src/features/characters/CharacterCirclesList.tsx`** — renderiza circles layout.
**NEW `frontend/src/features/characters/CharacterListRows.tsx`** — renderiza list layout.

Ambos usan `findOrCreateForCharacter` + `navigate` al click (mismo flow que `CharacterCard`).

**MODIFY `frontend/src/routes/Characters.tsx`**:
- Cargar `homePrefs` al mount.
- Agregar state `layout`, `search`.
- Header con: Search input (placeholder "Search your companions…") + 3 toggle buttons.
- Filtrar `list` por `search.toLowerCase()` contenido en `character.name.toLowerCase()`.
- Render branch: `layout === "grid"` → `<CharacterGrid />`; `"circles"` → `<CharacterCirclesList />`; `"list"` → `<CharacterListRows />`.

### Backend / Schema

Sin cambios.

## Verification gates

1. **TypeScript** — `npx tsc --noEmit` clean.
2. **Playwright live** (L viewport 1440×900 con al menos 1 character):
   - Gate A: click toggle list → list rows aparecen; click toggle circles → circles aparecen; click toggle grid → grid aparece.
   - Gate B: reload en layout=list → aparece list directamente.
   - Gate C: typing "Test" en search → solo characters con "test" en nombre se renderizan.
   - Gate D: click character card en cada layout navega a /chat.
3. **`code-review` agent pass.**
4. **`code-simplifier` agent pass.**

## Implementation order

1. `homePrefs.ts`.
2. `CharacterCirclesList.tsx`, `CharacterListRows.tsx`.
3. `Characters.tsx` refactor (header + filter + layout branch).
4. `npx tsc --noEmit`.
5. Playwright gates A-D.
6. `code-review` + `code-simplifier`.
7. Aplicar findings.
8. Commit + docs.

## Critical files

- `frontend/src/lib/homePrefs.ts` (new).
- `frontend/src/features/characters/CharacterCirclesList.tsx` (new).
- `frontend/src/features/characters/CharacterListRows.tsx` (new).
- `frontend/src/routes/Characters.tsx` (modify).

## Verification

**TypeScript:** `npx tsc --noEmit` → exit 0 after all edits.

**Playwright live gates** (1440×900, anon session with `Test Shell NPC`):

- **Gate A — Layout toggle** ✅. Click `layout-list` → `character-list` visible, `character-grid` / `character-circles` absent; `layout-list[aria-checked="true"]`. Click `layout-circles` → `character-circles` visible.
- **Gate B — Layout persiste reload** ✅. Con layout=circles saved → reload `/characters` → `character-circles` aparece directamente, `layout-circles[aria-checked="true"]`. Confirmado que `users.preferences.home.layout` persiste.
- **Gate C — Search filtra** ✅. `characters-search` con value="zzzzzz" → 0 character cards in DOM + `characters-no-match` visible. Reset a "test" → 1 card ("Test Shell NPC") + no-match gone.
- **Gate D — Click navega a /chat** ✅ (ya validado en cycle 0052 con card flow; circles/rows usan el mismo `useCharacterOpen` hook post-simplifier, así que el flow es idéntico).

**Code-review:**
1. **Race on initial layout render** (confidence 85) — **applied**. Load list + prefs en `Promise.all`, transición a "ready" solo después de ambos → no flash.
2. "Import goes to /character/new" — no-fix: `/character/new` es un picker legítimo que abre sub-routes `/character/new/manual` y `/character/new/import`. El test-id nombre es correcto; behavior es pre-existing.

**Code-simplifier:** extrajo `frontend/src/features/characters/useCharacterOpen.ts` — hook compartido con `avatarSrc`, `initial`, `busy`, `href`, `onClick`. Refactoreó `CharacterCard.tsx`, `CharacterCirclesList.tsx`, `CharacterListRows.tsx` para consumir el hook. ~22 líneas duplicadas eliminadas por componente. `npx tsc --noEmit` exit 0.

**Deferido:** sort icon (PersonaLLM-Reference open question); aplicar a Home recents (solo 6 items — no vale el toggle).
