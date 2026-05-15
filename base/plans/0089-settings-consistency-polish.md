# Plan 0089 — Settings pages consistency polish

status: approved
date: 2026-04-24

## Motivation

Two visual inconsistencies identified across all settings sub-routes:

1. **Card backgrounds inconsistent.** Pages like TTS, ImageEngine, VisualRoleplay,
   MemorySettings use `groupCard` / `sectionCard` (background `--sp-bg-2` + border
   + radius 14) that create clear visual groupings. Pages like TextEngine,
   WritingStyles, PromptEditor, MemoryEngine, GrammarSettings, DataSecurity render
   form sections directly on the page background with no card separation. Creator
   prefers the version WITH distinct card backgrounds — standardize everything to use
   `sectionCard` / `groupCard` pattern.

2. **Heading too close to first content.** The `<h1>` or `<header>` wrapper that
   contains the page title (e.g. "Grammar Settings") has `marginBottom: "1rem"` or
   even `margin: 0` (GrammarSettings, Grammar dashboard). This leaves too little
   breathing room between the gradient title and the first section below it. Increase
   to `marginBottom: "1.75rem"` across all settings pages.

## Audit results (from exploration 2026-04-24)

### Pages that need card backgrounds added

| Page | Current | Fix needed |
|------|---------|------------|
| `TextEngineSettings` | `<form>` with grid gap 0.85rem directly | Wrap each logical section (model/key, advanced) in `sectionCard` |
| `WritingStylesSettings` | `<section>` with article rows, no bg | Wrap "Built-in" + "Custom" sections in `groupCard` (rows already have `borderBottom` — overflow:hidden on group card) |
| `PromptEditor` | Custom `<Section>` accordion-like component, no bg-2 on card | Add `background: var(--sp-bg-2)` + `border: 1px solid var(--sp-border)` + `borderRadius: 14` to the Section component's container |
| `MemoryEngineSettings` | `<form>` fields directly | Wrap provider form in `sectionCard` |
| `GrammarSettings` | `<form>` with `<fieldset>` (fieldset has border from global reset 0072 but no bg fill) | Wrap each fieldset group in a `sectionCard` div OR add `background: var(--sp-bg-2)` inline to the form container |
| `DataSecuritySettings` | `<fieldset>` groups (border from global reset, no bg fill) | Same approach — wrap each fieldset/section in a `sectionCard` |

### Pages already correct (no changes)

- `TextToSpeechSettings` ✅ groupCard on all sections
- `ImageEngineSettings` ✅ sectionCard on all sections
- `VisualRoleplaySettings` ✅ groupCard on all sections
- `MemorySettings` ✅ groupCard on all sections

### Pages that need heading spacing fixed

ALL settings sub-routes + Grammar dashboard:

- Most pages: `<header style={{ ..., marginBottom: "1rem" }}>` → change to `"1.75rem"`
- `GrammarSettings`: h1 has explicit `margin: 0` + no header wrapper → add `marginBottom: "1.75rem"` to h1 inline style
- `DataSecuritySettings`: h1 follows a `<p>` back-link, no header wrapper → add `marginBottom: "1.75rem"` to h1
- `Grammar` dashboard: `<header style={{ marginBottom: "1rem" }}>` → `"1.75rem"`
- `WritingStylesSettings`: h1 inline with no wrapper → add `marginBottom: "1.75rem"`
- `PromptEditor`: h1 inline → add `marginBottom: "1.75rem"`

## Shared style constants to reuse

Already defined in TTS/ImageEngine/VisualRoleplay — copy the same constants into
files that don't have them:

```tsx
const sectionCard: React.CSSProperties = {
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: 14,
  padding: "1rem",
  display: "grid",
  gap: "0.85rem",
};

const groupCard: React.CSSProperties = {
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: 14,
  overflow: "hidden",   // use when rows have borderBottom separators
};
```

Use `sectionCard` when sections have uniform padded fields (forms, inputs).
Use `groupCard` when sections have rows with `borderBottom` separators (toggles,
radio rows) — `overflow: hidden` clips the last row's border cleanly.

## Implementation order

### Subtask 1 — Heading spacing (all settings pages, ~1 line each)

Files (10): TextEngineSettings, TextToSpeechSettings, ImageEngineSettings,
VisualRoleplaySettings, WritingStylesSettings, PromptEditor, MemorySettings,
MemoryEngineSettings, GrammarSettings, DataSecuritySettings, Grammar.

Change: `marginBottom: "1rem"` → `"1.75rem"` in each `<header>` wrapper or h1.
GrammarSettings special: h1 `margin: 0` → `margin: "0 0 1.75rem"`.

**Verify:** Playwright screenshot of 3 representative pages (TextEngine, Grammar,
GrammarSettings) to confirm title has breathing room.

### Subtask 2 — Card backgrounds: TextEngineSettings

**File:** `frontend/src/routes/TextEngineSettings.tsx`

Add `sectionCard` constant. Identify logical sections:
1. Provider / API key section
2. Model + temperature section
3. Thinking mode section (if separate)
4. Cloud consent section (already has `consentCardStyle` — keep as warning card)

Wrap each in `<div style={sectionCard}>`. The `data-form="stack"` on the form
continues to cascade to inputs inside. The `sectionCard` just adds the visual
grouping layer.

### Subtask 3 — Card backgrounds: MemoryEngineSettings

**File:** `frontend/src/routes/MemoryEngineSettings.tsx`

Add `sectionCard` constant. Wrap the provider form in a single `sectionCard`.
Intro `<p>` stays outside (same pattern as other pages).

### Subtask 4 — Card backgrounds: GrammarSettings

**File:** `frontend/src/routes/GrammarSettings.tsx`

GrammarSettings has fieldsets (global reset from 0072 already gives them border-soft
+ radius-md). Two options:
- **Option A:** Add `background: "var(--sp-bg-2)"` inline to the `<form>` container
  as a sectionCard wrapper. Simplest — 1 div wrapping the whole form.
- **Option B:** Wrap each fieldset in a `sectionCard` div. More granular.

Use **Option A** — the whole grammar settings form is a single logical unit; one
card fits better than 3 micro-cards. The form already has `gap: 0.85rem` between
fieldsets.

### Subtask 5 — Card backgrounds: WritingStylesSettings

**File:** `frontend/src/routes/WritingStylesSettings.tsx`

Two sections: "Built-in" styles + "Custom" styles (with edit form). Each gets
wrapped in a `groupCard` div (overflow:hidden since rows have borderBottom). The
existing article rows with `borderBottom` become the rows inside the card —
same pattern as VisualRoleplay radio rows.

### Subtask 6 — Card backgrounds: PromptEditor

**File:** `frontend/src/routes/PromptEditor.tsx`

The `<Section>` subcomponent (accordion-like, probably has a header + collapsible
body) needs `background: var(--sp-bg-2)` + `border` + `borderRadius: 14` on its
outer container. Check the Section component definition in the file and add the card
style to its wrapper div.

### Subtask 7 — Card backgrounds: DataSecuritySettings

**File:** `frontend/src/routes/DataSecuritySettings.tsx`

This page has multiple `<fieldset>` groups. Wrap each logical group in a
`sectionCard` div. Fieldsets inside inherit the card bg visually. The modals
(SFW + delete) don't need changes.

## Files touched

| File | Changes |
|------|---------|
| `TextEngineSettings.tsx` | heading spacing + sectionCard on sections |
| `TextToSpeechSettings.tsx` | heading spacing only |
| `ImageEngineSettings.tsx` | heading spacing only |
| `VisualRoleplaySettings.tsx` | heading spacing only |
| `WritingStylesSettings.tsx` | heading spacing + groupCard on Built-in + Custom |
| `PromptEditor.tsx` | heading spacing + sectionCard on Section component |
| `MemorySettings.tsx` | heading spacing only |
| `MemoryEngineSettings.tsx` | heading spacing + sectionCard on form |
| `GrammarSettings.tsx` | heading spacing + bg-2 wrapper on form |
| `DataSecuritySettings.tsx` | heading spacing + sectionCard on fieldset groups |
| `Grammar.tsx` | heading spacing only (dashboard) |

Total: 11 files. Chrome-only changes — no logic, no wire protocol, no schema.

## Risks

- `WritingStylesSettings` edit form (inside the "Custom" card) uses `data-form="stack"`
  — this continues to work inside a groupCard.
- `DataSecuritySettings` modals are rendered via a `Modal` helper, not inside the
  fieldsets — not affected.
- `GrammarSettings` fieldset borders (from global 0072 reset: `border: 1px solid
  --sp-border-soft`) + the sectionCard wrapper border could visually stack (two
  borders). Mitigation: remove the fieldset's inline border when wrapping in sectionCard,
  OR use Option A (single bg-2 card around the whole form) so fieldset borders are
  inside the card, not competing with it.

## Verification

- [ ] All settings pages: h1 has visible breathing room below it (screenshot 5 pages)
- [ ] TextEngine, MemoryEngine, GrammarSettings, WritingStyles, PromptEditor, DataSecurity: sections have visible bg-2 card groupings
- [ ] Cards look consistent with TTS / ImageEngine / VisualRoleplay reference pages
- [ ] tsc 0 errors
- [ ] No regressions on save/load logic in any settings page
- [ ] `data-form="stack"` still cascades correctly inside card wrappers (verify inputs are full-width)
