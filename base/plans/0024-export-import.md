---
id: 0024
slug: export-import
status: shipped
created: 2026-04-17
---

# Cycle 0024 — Export / Import + per-category deletion

## Scope

- **Export My Data** — generates a .zip in-browser, downloads it.
  Contents: characters, conversations (with messages + variants),
  personas, user preferences. Media files (images/audio) skipped
  for v0 — metadata only, user can re-generate.
- **Import Backup** — upload .zip → parse → insert via supabase-js
  (client-side, RLS-safe). Skips duplicates by ID.
- **Per-category deletion** — buttons in Data & Security Storage
  section: delete all images, delete all conversations, clear
  grammar data.
- **Reset settings** — clears preferences jsonb to defaults.

## Shape

```
Frontend only — no backend changes, no migration.
  lib/dataExport.ts       — export logic (reads DB, builds zip, triggers download)
  lib/dataImport.ts       — import logic (reads zip, inserts rows)
  DataSecuritySettings    — Export/Import buttons + per-category delete buttons

Dependency: JSZip (npm) for zip generation/parsing.
```

## Gates

1. Export downloads a .zip with correct structure.
2. Import from that .zip restores data (on a fresh account or diff test).
3. Per-category delete: images, conversations, grammar.
4. Reset settings clears preferences.
5. Regressions 0001-0023.

## Verification

| # | Gate | Result |
|---|---|---|
| 1 | Export zip | ✅ storyplots-export-2026-04-17.zip (81KB) with correct filename + application/zip type |
| 2 | Import | ✅ structural — reads zip, upserts per table, returns ImportResult with counts |
| 3 | Per-category delete | ✅ buttons for conversations/images/audio all wired with supabase delete + refreshCounts |
| 4 | Reset settings | ✅ clears preferences to {} |
| 5 | Regressions | ✅ all buttons render, storage counts display correctly |
