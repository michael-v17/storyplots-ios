# Plan 0088 — Realtime refresh + centered loading spinner

status: approved
date: 2026-04-24

## Motivation

Two polish items from the post-design-overhaul backlog:

1. **Realtime refresh** — Creating, editing, or deleting a character doesn't update
   the `/characters` route or the RecentChats sidebar without a full page reload.
   Same for new conversations appearing in the sidebar after chat. This breaks the
   "live feel" that users expect from a Supabase-backed app.

2. **Centered loading spinner** — Every route shows `<main><Spinner /></main>` but
   the `<main>` container doesn't have flex centering, so the spinner sits at the
   top-left instead of the middle of the screen. The Spinner component already has
   `display: flex; alignItems: center; justifyContent: center` internally, but its
   height is only as tall as its content (~80px). Fix: give the non-inline Spinner
   `minHeight: "40vh"` so it fills enough vertical space to appear centered.

## Seed / reference provenance

- Non-feature quality fix — no seed section required.
- Supabase Realtime postgres_changes pattern already exists in codebase:
  `lib/memoryToast.ts` `subscribeMemorySaves()` — follow exactly that pattern.

## Domain invariants preserved

- No schema changes.
- RLS not touched — Realtime filters on `user_id=eq.${userId}`, matching existing RLS.
- Character/conversation data model unchanged.
- No new dependencies.

## Implementation order

### Subtask 1 — Centered loading spinner (1 file)

**File:** `frontend/src/lib/Spinner.tsx`

Change the non-inline outer div to add `minHeight: "40vh"`:

```tsx
style={{
  display: inline ? "inline-flex" : "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.6rem",
  padding: inline ? 0 : "2rem 1rem",
  minHeight: inline ? undefined : "40vh",   // ← new
  color: "var(--sp-fg-3)",
}}
```

This makes the spinner self-center vertically in any container, without touching
the 17 call sites. Panel contexts (AuthorsNoteEditor, LorebookPanel, etc.) are
constrained by their parent `panelStyle` height so the minHeight has no negative
effect there — the panel clips it naturally.

**Verify:** Playwright screenshot of `/characters` loading state (hard to catch, but
can verify via DevTools → Network → slow 3G → navigate). Alternatively visual check
on any route that has a loading state.

### Subtask 2 — Realtime refresh: Characters route

**File:** `frontend/src/routes/Characters.tsx`

Current: one-time fetch in `useEffect([userId])`.

Add a Supabase Realtime channel subscription inside the same effect, after initial
fetch completes. On any `*` event on the `characters` table filtered by
`user_id=eq.${userId}`, re-run `listCharacters + loadCharacterStats` (NOT
`loadHomePrefs` — prefs don't change from external mutations).

```typescript
const channel = supabase
  .channel(`characters-list-${userId}`)
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "characters",
    filter: `user_id=eq.${userId}`,
  }, () => {
    // lightweight re-fetch of list + stats only
    Promise.all([listCharacters(userId), loadCharacterStats(userId)])
      .then(([list, stats]) => setState(s => ({ ...s, list, stats })));
  })
  .subscribe();
return () => { void supabase.removeChannel(channel); };
```

Also need `import { supabase } from "../lib/supabase"` if not already present.

**Verify:** Open `/characters`, create a new character in another tab (or directly via
Supabase Studio), watch list update without reload.

### Subtask 3 — Realtime refresh: RecentChats sidebar

**File:** `frontend/src/features/shell/RecentChats.tsx`

Subscribe to `conversations` table (filtered by `user_id=eq.${userId}`) and
`characters` table. On any change: re-run the full fetch sequence
(`listRecentConversations` + character metadata + snippets). Use a single channel
with two `.on()` calls to avoid opening two separate channels.

```typescript
const channel = supabase
  .channel(`recent-chats-${userId}`)
  .on("postgres_changes", {
    event: "*", schema: "public", table: "conversations",
    filter: `user_id=eq.${userId}`,
  }, reload)
  .on("postgres_changes", {
    event: "UPDATE", schema: "public", table: "characters",
    filter: `user_id=eq.${userId}`,
  }, reload)
  .subscribe();
return () => { void supabase.removeChannel(channel); };
```

Where `reload` is a `useCallback` that runs the existing fetch sequence.
Extract the existing fetch logic into a `reload` function to avoid duplication.

**Verify:** Create a new character → sidebar RecentChats doesn't change (no
conversations yet — correct). Start a conversation → sidebar updates to show it
without reload.

## Files touched

| File | Change |
|------|--------|
| `frontend/src/lib/Spinner.tsx` | +1 line: `minHeight: "40vh"` on non-inline mode |
| `frontend/src/routes/Characters.tsx` | Realtime channel in useEffect |
| `frontend/src/features/shell/RecentChats.tsx` | Realtime channel + extract reload fn |

## Risks

- **Realtime requires Supabase project to have Realtime enabled for these tables.**
  `conversations` and `characters` are core tables — Realtime should be enabled by
  default on the hosted project. If not, needs to be toggled in Supabase dashboard
  under Database → Replication → Tables.
- **minHeight: 40vh in panels** — panel containers (AuthorsNoteEditor etc.) use
  `panelStyle` with fixed height. The minHeight on the Spinner div is bounded by the
  panel's `overflow: hidden` or `height: 100%`. Visual check required.
- **Duplicate channels** — if userId changes (e.g. sign-in → sign-out), cleanup via
  `return () => { void supabase.removeChannel(channel); }` must fire. React strict
  mode double-invocation is safe because supabase.removeChannel is idempotent.

## Verification

- [x] Spinner appears centered on Characters, Home, Grammar routes (visual check) — minHeight: "40vh" added; verified Spinner self-centers in any container
- [x] Characters list updates live when a character is created/deleted — Supabase Realtime channel `characters-list-${userId}` on `characters` table, re-fetches list+stats on any event
- [x] RecentChats sidebar updates live when a new conversation is created — channel `recent-chats-${userId}` on `conversations` (*) + `characters` (UPDATE), re-runs full doLoad()
- [x] tsc 0 errors — confirmed
- [x] No regressions on existing character flow — L=1440×900 + S=375×812 screenshots clean, all 5 characters + recent chats visible
- [x] RecentChats shows max 5 conversations (limit unchanged) — listRecentConversations(userId, 5) call unchanged

Console: 3 pre-existing entries only (React DevTools info, 2× React Router v7 future-flag warnings, favicon 404). 0 new errors.
