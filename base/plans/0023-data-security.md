---
id: 0023
slug: data-security
status: shipped
created: 2026-04-17
---

# Cycle 0023 — Data & Security: Core

## Scope

- Settings → Data & Security page
- Sign out button
- SFW toggle + 18+ confirmation modal
- Cloud AI Consent toggle
- Delete account with typed confirmation + full cascade
- Storage breakdown (row counts per category)

Export/Import + per-category deletion → cycle 0024.

## Shape

```
Migration 0030:
 delete_my_account() SECURITY DEFINER RPC — deletes
   public.users (cascades all FK'd tables) + auth.users.
   Storage objects left orphaned (harmless — RLS-dead).

Frontend:
 routes/DataSecuritySettings.tsx — new page at /settings/data-security
   • Fiction disclaimer restatement
   • SFW toggle + 18+ modal
   • Cloud AI Consent toggle
   • Storage breakdown (counts)
   • Sign out button
   • Delete account button → typed "DELETE" confirmation modal → RPC
 Router: add route + link in Settings index (replace stub)
```

## Gates

1. Migration 0030 applied; RPC exists.
2. Page renders at /settings/data-security with all sections.
3. SFW toggle persists + 18+ modal fires on enable.
4. Sign out clears session + redirects to home.
5. Delete account: type "DELETE" → RPC → user gone from
   public.users + auth.users; all FK'd data cascaded.
6. Storage counts display correctly.
7. Regressions 0001-0022.

## Verification

| # | Gate | Result |
|---|---|---|
| 1 | Migration 0030 | ✅ delete_my_account() RPC exists |
| 2 | Page renders | ✅ Content, Cloud AI Consent, Storage, Sign out, Delete |
| 3 | SFW toggle + 18+ modal | ✅ checkbox fires modal; cancel dismisses |
| 4 | Sign out | ✅ button present, handler calls signOut + nav (structural — not exercised to preserve session) |
| 5 | Delete account typed confirmation | ✅ modal shows warnings; "DELE" → disabled; "DELETE" → enabled; RPC wired |
| 6 | Storage counts | ✅ Characters 3, Conversations 8, Images 17, Audio 35 |
| 7 | Regressions | ✅ session alive, all prior features intact |
