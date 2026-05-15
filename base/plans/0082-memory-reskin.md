---
status: manual-fallback
cycle: 0082
slug: memory-reskin
---

# Cycle 0082 — Memory viewer + Memory Engine + MemorySettings re-skin

## Seed provenance
- Seed/ux.md §4 (Settings screens inventory)
- Seed/design.md §3 (token-first), §13 anti-patterns (no hardcoded hex)
- DesignSystem/README.md (dark surfaces, pill everything, .sp-toggle, .sp-range)
- PersonaLLM-Reference/09-design-system.md

## Scope
Chrome-only re-skin. No logic/wire-protocol changes. 3 surfaces:
1. `features/chat/MemoryPanel.tsx` — minimal (deleteBtnStyle fg-4 → fg-3)
2. `routes/MemorySettings.tsx` — full re-skin
3. `routes/MemoryEngineSettings.tsx` — full re-skin

## Non-negotiables touched
- Memory off by default (JS logic unchanged)
- Per-conversation scope (logic unchanged)
- BYOK embedding (wire unchanged)

## Implementation order

### Subtask A — MemoryPanel.tsx
- `deleteBtnStyle.color: --sp-fg-4 → --sp-fg-3` (× delete button is functional, not purely decorative — per legibility rule F4 cycle 0071)
- Gate: `memory-panel` visible, × button color = --sp-fg-3

### Subtask B — MemorySettings.tsx
- h1 → `sp-h2 sp-wordmark sp-page-h1`
- Intro `<p>` `opacity: 0.75` → `color: --sp-fg-3`
- `warnBanner` hex warm → `<StatusBanner tone="warning" testid="memory-no-engine">`
- `errBanner` hex crimson → `<StatusBanner tone="error" testid="mem-prefs-error" role="alert">`
- `<input type="checkbox">` × 2 → `className="sp-toggle"` + explicit disabled props
- `<input type="range">` × 4 → `className="sp-range"`
- Row styles → unified group cards (bg-2 + border + radius 14 + border-bottom-soft rows)
- subStyle `opacity: 0.65` → `color: --sp-fg-3`
- Save → `--sp-brand-1` solid pill + white (matching GrammarSettings post-polish)
- Reset → ghost pill
- factCount `opacity: 0.7` → `color: --sp-fg-3`
- Footer `<p>` `opacity: 0.7` → `color: --sp-fg-3`
- Gate: toggles/sliders rendered, Save is pill

### Subtask C — MemoryEngineSettings.tsx
- h1 → `sp-h2 sp-wordmark sp-page-h1`
- Intro `<p>` opacity → `color: --sp-fg-3`
- `<form>` → `data-form="stack"` (auto-tokens Provider/BaseURL/Key/Model inputs via global reset)
- Show/Hide button → ghost pill
- Test connection → ghost pill
- Save/Update → `--sp-brand-1` solid pill + white
- `testResult` div hex → `<StatusBanner tone={ok ? "success" : "error"} testid="mem-test-result">`
- `errBanner` hex → `<StatusBanner tone="error" testid="mem-engine-error" role="alert">`
- Footer `<p>` `opacity: 0.7` → `color: --sp-fg-3`
- Gate: form inputs tokenized, Save is pill, testResult uses StatusBanner

## Verification

### Code review findings
- **F1 conf 85 APPLIED** — `<div style={subStyle}>` inside `<label>` is invalid HTML (label is phrasing content, div is flow content). Fixed all 6 occurrences in MemorySettings.tsx: changed to `<span style={{...subStyle, display:"block"}}>`. Conformant HTML, no visual change, AT association correct.

### Code simplifier findings
- **C1 APPLIED** (MemoryEngineSettings) — nested ternary `saving ? "Saving…" : existing ? "Update" : "Save"` extracted to `saveLabel()` helper with explicit if-returns.
- 0 other simplifications — all other patterns intentionally diverge per project conventions.

### Playwright gates
- **GL-a** Memory Settings L=1440×900: group cards (BEHAVIOR + RETRIEVAL + ADVANCED), sp-toggle pills violet active ✅
- **GL-b** Memory Engine L=1440×900: data-form="stack" inputs tokenized, ghost Test pill, solid Update pill ✅
- **GS-a** Memory Settings S=375×812: toggle rows responsive, sliders in grid layout ✅
- **GS-b** Memory Engine S=375×812: form full-width, pills rendered correctly ✅
- tsc 0 errors ✅
- 0 console errors (2 pre-existing React Router warnings only) ✅
- Testids preserved: mem-prefs-enabled, mem-prefs-notifications, mem-prefs-cadence, mem-prefs-top-k, mem-prefs-threshold, mem-prefs-recency, mem-prefs-reset-prompt, mem-prefs-extraction-prompt, mem-prefs-save, mem-prefs-error, memory-no-engine, memory-settings-loading, memory-engine-settings, mem-provider-family, mem-base-url, mem-api-key, mem-model-id, mem-test, mem-save, mem-test-result, mem-engine-error, memory-engine-loading, memory-panel, memory-panel-back, memory-clear-all, memory-panel-error ✅
