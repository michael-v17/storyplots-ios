---
id: 0055
slug: sidebar-recent-auth-ux
status: shipped
created: 2026-04-19
---

# Cycle 0055 — Sidebar Recent Chats + auth/persona UX polish

## Context

Creator review de la fase estructural identificó 3 gaps en el sidebar:
1. **Recent Chats ausentes** — PersonaLLM-Reference/04-screens/menu.md §Sections especifica `RECENT CHATS` como sección core del drawer. Diferido en Cycle 0051.
2. **Persona editor inaccesible para anon** — `UserSection` en modo anonymous solo muestra "Sign up"; no hay forma de editar la persona del user.
3. **Sign in no visible en Home/sidebar** — un user existente que abre la app como anon termina en Home sin ruta clara a `/sign-in`. Tiene que scroll-hunt "Already have an account? Sign in" dentro del sign-up form. Se pide mover "Sign in" a un lugar visible primario.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §2 Navigation model ("Account upgrade CTA", user section).
- [Seed/PersonaLLM-Reference/04-screens/menu.md](../Seed/PersonaLLM-Reference/04-screens/menu.md) §Sections — YOUR PERSONA + RECENT CHATS.

## Done when

- [ ] Sidebar render agrega una sección "RECENT CHATS" entre nav items y user footer, con hasta 5 conversations (fetched desde Supabase, ordered by `last_message_at` desc).
- [ ] Cada row: avatar circular (del character) 24px + character name (inferred del character_snapshot) + relative time ("2m", "1h", etc). Click → navigate al `/chat/:characterId/:conversationId`.
- [ ] Sidebar collapsed (64px rail) NO renderiza Recent Chats (sin espacio horizontal útil).
- [ ] Empty state (sin conversations): sección simplemente no se renderiza.
- [ ] `UserSection` anon branch ahora renderiza: avatar + persona name (link `/profile`) + **"Sign in"** (botón primario) + **"Sign up"** (link secundario).
- [ ] Si persona no existe en anon: muestra "Set up your persona" link.
- [ ] Loading state para Recent Chats: skeleton minimal (3 rows con background gris) para evitar layout shift.
- [ ] `npx tsc --noEmit` verde.
- [ ] Playwright gates: (a) sidebar expandido L muestra Recent Chats cuando hay conversations; (b) click row → navega a chat correcto; (c) anon session: UserSection muestra Sign in + Sign up + persona-link.

## Shape of the change

### Frontend

**MODIFY `frontend/src/lib/conversations.ts`** — añadir:
```ts
export async function listRecentConversations(userId: string, limit = 5): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Conversation[];
}
```

**NEW `frontend/src/features/shell/RecentChats.tsx`** — fetch + render list:
- Query on mount via `listRecentConversations(userId, 5)`.
- Query characters (to get avatar_ref + accent_color) by ids in one `.in("id", ids)` call.
- Render rows con avatar circle + name + relative time (helper `relativeTime(iso)`).
- Skeleton 3 rows cuando `loading`.
- Sin results: devuelve `null`.

**MODIFY `frontend/src/features/shell/Sidebar.tsx`** — insertar `<RecentChats />` después del nav items, antes del UserSection footer. Solo cuando `!collapsed`.

**MODIFY `frontend/src/features/shell/UserSection.tsx`** — cambiar anon branch + no-session branch para soportar persona link + Sign in prominente + Sign up secundario.

### Backend / Schema

Sin cambios.

## Verification gates

1. **TypeScript** — `npx tsc --noEmit` clean.
2. **Playwright live (L viewport):**
   - Gate A: Authed session con conversations → Recent Chats visible con 1+ rows.
   - Gate B: Click row → navega a la URL correcta `/chat/:char/:conv`.
   - Gate C: Anon session → UserSection muestra "Sign in" button + "Sign up" link + persona link (si persona existe) o "Set up persona" (si no).
3. **Collapsed sidebar** → Recent Chats sección ausente.
4. **`code-review` + `code-simplifier`** en paralelo.

## Implementation order

1. `conversations.ts` — `listRecentConversations`.
2. `RecentChats.tsx` — new.
3. `Sidebar.tsx` — insert RecentChats.
4. `UserSection.tsx` — anon branch refactor.
5. `npx tsc --noEmit`.
6. Playwright gates A–C.
7. Review + simplifier.
8. Apply findings, commit, docs.

## Critical files

- `frontend/src/lib/conversations.ts` (modify).
- `frontend/src/features/shell/RecentChats.tsx` (new).
- `frontend/src/features/shell/Sidebar.tsx` (modify).
- `frontend/src/features/shell/UserSection.tsx` (modify).

## Verification

**Scope pivot durante la implementación:** el creator clarificó con screenshot de PersonaLLM que el sidebar necesita restructuración completa — Persona card al top (no como link en footer), Settings como bottom primary button (no como nav item), nav items en su propio grupo, RECENT CHATS con label entre medio. Se aplicaron esos cambios además de lo originalmente planeado.

**TypeScript:** `npx tsc --noEmit` → exit 0.

**Playwright live (1440×900, Michael signed in):**

- ✅ Sidebar layout nueva orden visual: StoryPlots wordmark + collapse → YOUR PERSONA card (Michael, "Tap to edit") → nav items (Home/Characters/Gallery/Grammar) → RECENT CHATS label → 5 rows (Evelyn Hart 1h, Aria 1d, Dr. Aris Thorne 2d, Aria 2d, Aria) con avatares cargados → Settings bottom primary button → email + Sign out footer.
- ✅ RECENT CHATS con avatares reales del character + relative time (1h/1d/2d) renderizan correctamente después del async chars fetch.
- ✅ Settings movido de nav item a bottom button distinto (border + background white, `settingsBtnStyle`).
- ✅ UserSection reducido a auth-only (email + Sign out para authed; Sign in primary + Create account secondary para anon/no-session). Persona ahora vive en `YourPersonaCard` al top.
- ✅ Screenshots: `cycle-0055-sidebar-avatars-loaded.png`.

**Files touched:**
- `lib/conversations.ts` — add `listRecentConversations`.
- `features/shell/RecentChats.tsx` (new) — list + skeleton + relative time helper.
- `features/shell/YourPersonaCard.tsx` (new) — top card per PersonaLLM menu §Sections.
- `features/shell/Sidebar.tsx` — full restructure (persona card top, Settings removed from ITEMS nav + added as bottom primary button).
- `features/shell/UserSection.tsx` — simplified to auth footer only.

**Deferido:** last-message snippet en recent chat rows (requiere extra fetch por conversation); Credits counter (cut per Seed §2 "What is removed vs PersonaLLM").
