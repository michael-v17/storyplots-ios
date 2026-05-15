---
id: 0078
slug: grammar-reskin
status: shipped
created: 2026-04-21
---

# Cycle 0078 — Grammar re-skin (Design Overhaul cycle 13)

## Context

Two surfaces:
- `routes/Grammar.tsx` — `/grammar` macro dashboard (Detected level + Reinforcement performance + 4 stat cards + AI Narrative + Suggestions + full corrections list + Clear all button). Structure was set in cycle 0060 (4-row hierarchy with hero/grid/narrative/list); this cycle is **chrome-only** — no JSX restructure.
- `routes/GrammarSettings.tsx` — `/settings/grammar` (Master toggle gating + Inline mode A/B radios + Reinforcement toggle + Sidebar frequency + custom Grammar model input + Save). Adopts `.sp-toggle` primitive (cycle 0074).

Current literal violations:
- `Grammar.tsx`: hex `#fafafa` heroCard bg, `#e0e0e0` borders (3 sites: heroCard/statCard/narrativeCard), `#ccc` empty-hint dashed border, `#f0f0f0` corrections borderBottom, `crimson` Clear button border+color, opacity-based muting (subtitle, refresh hint, label, countChip, Empty, line-through original).
- `GrammarSettings.tsx`: raw `<input type="checkbox">` toggles (Master + Inline + Reinforcement + Sidebar — 4 sites that should adopt `.sp-toggle`), `crimson` Configure-Text-Engine hint, `#ddd` Reinforcement fieldset borderColor (covered by 0072 global reset already), opacity-based muting on hints, plain `<button>` Save (no pill style), error `<p>` crimson.

## Shape

### Grammar.tsx
- h1 gains `sp-h2 sp-wordmark sp-page-h1` gradient.
- Header subtitle: `opacity: 0.7` → `color: --sp-fg-3`.
- "Refreshing insights" small: `opacity: 0.7` → `--sp-fg-3`.
- Empty-state hint card: `#ccc dashed` border → `--sp-border-strong dashed` + bg `--sp-bg-2` + radius-md (matches "Add Character" dashed pattern from polish post-0074).
- All 3 cards (heroCard / statCard / narrativeCard) → `bg --sp-bg-2` + `border --sp-border` + `radius --sp-radius-md` (10px). Hero stays at radius-md to match the kit Home grammar card 0068; doesn't need the larger radius-lg.
- heroValue 1.8em weight 600 unchanged (token-agnostic).
- labelStyle uppercase + opacity → `.sp-section-label` className (already in tokens.css from 0066) + ditch inline style.
- countChip: `opacity: 0.55` → tokenized chip pattern matching Home 0068 (bg `--sp-bg-3`, color `--sp-fg-2`, radius 999, padding 0.05rem 0.45rem, weight 600). Visible chip > muted text per 0069 feedback.
- Empty: `opacity: 0.5` → `--sp-fg-3` (legibility memory — placeholder text inside content).
- Corrections list:
  - borderBottom `#f0f0f0` → `--sp-border-soft`.
  - Original `opacity: 0.6` line-through → `color: --sp-fg-3` (user content, per 0071 GrammarSidebarPanel F4 fix; reuse the same decision).
  - Corrected text → `--sp-fg`.
- Clear-all button: crimson literal → destructive ghost pill (border `--sp-destructive-soft`, color `--sp-destructive`).

### GrammarSettings.tsx
- h1 gains `sp-h2 sp-wordmark sp-page-h1`.
- Form gets `data-form="stack"` attribute → frequency `<select>` + grammar-model `<input>` benefit via global reset.
- 4 raw checkboxes → `.sp-toggle` primitive: Grammar Master + Inline corrections + Reinforcement + Sidebar.
- 2 radios for inline_mode A/B → keep as radios (tokenize labels with --sp-fg, no segmented control because radios convey "exclusive choice" more clearly here).
- "Configure a Text Engine" hint: crimson → `--sp-warning` (warning, not destructive — this is an info-with-prerequisite, not a destructive action).
- Reinforcement fieldset borderColor `#ddd` already covered by 0072 global reset — drop the inline override.
- "Enable inline corrections first" hint `opacity: 0.7` → `--sp-fg-3`.
- Grammar-model fieldset hints `opacity: 0.7` → `--sp-fg-3`.
- Error `<p>` crimson → `StatusBanner tone="error"` (4th consumer of shared module — extraction was right call).
- Save `<button>` → primary pill (`--sp-brand-grad` when active, disabled state).

## Seed sections satisfied

- `Seed/ux.md` §4.9 Grammar Dashboard — hero + stats + narrative + corrections preserved (no JSX restructure).
- `Seed/ux.md` §4.10.11 Settings → Grammar (v0 Extension) — Master toggle + Inline mode + Reinforcement + Sidebar frequency + Grammar model.
- `Seed/creator-vision.md` §5.6 Grammar Module — gating (Master OFF default — already enforced in code, visual only here), reinforcement, inline modes A/B preserved.
- `Seed/PersonaLLM-Reference/04-screens/settings/` — toggles + radios pattern (toggles are the kit's chosen primitive for boolean settings).
- Cycle 0074 `.sp-toggle` primitive — opt-in via className.
- Cycle 0060 Grammar dashboard structure — preserved verbatim, only chrome migrated.

## Non-negotiables preserved

- Master Grammar OFF by default (code-level, unchanged).
- Inline mode A (correction only) vs B (correction + explanation) preserved.
- Per-Conversation grammar isolation (code, unchanged).
- Reinforcement gate (rewrite-pass) preserved.
- Custom grammar model (per `prefs.custom_model_id` — falls back to Text Engine model) preserved.

## Implementation order (subtareas atómicas con gate)

1. **Grammar.tsx — header + cards + chips + empty + corrections** — h1 className; subtitle/refresh hint to `--sp-fg-3`; all 3 card consts to bg-2 + border + radius; countChip to pill chip; Empty to fg-3; corrections borderBottom + line-through to tokens; Clear-all button to destructive ghost pill. Gate S1: `/grammar` — h1 gradient; cards bg `--sp-bg-2`; chip pills visible; corrections legible (line-through `--sp-fg-3` not invisible).

2. **GrammarSettings.tsx — header + form + 4 toggles + radios + hints + Save** — h1 className; form gets `data-form="stack"`; 4 checkboxes get `className="sp-toggle"`; hints to `--sp-fg-3`; "Configure Text Engine" → `--sp-warning`; error → StatusBanner; Save → primary pill. Gate S2: `/settings/grammar` — toggles render as pill 40×22 (4 sites); radios still raw + tokenized labels; Save primary pill gradient.

3. **Playwright L=1440×900 + S=375×812 + reload×3** + tsc check.

## Verification gates

### Desktop (L=1440×900)
- GL-a: `/grammar` h1 "Grammar" renders gradient.
- GL-b: heroCard bg `--sp-bg-2` (rgb(26, 20, 36)) + border `--sp-border` + radius 10px.
- GL-c: statCard same tokens; countChip pill 999 with bg `--sp-bg-3` + color `--sp-fg-2`.
- GL-d: narrativeCard same tokens.
- GL-e: corrections list — borderBottom `--sp-border-soft`; original `--sp-fg-3` line-through legible (≥4.5:1 contrast on bg).
- GL-f: Clear-all button destructive ghost pill (border `--sp-destructive-soft`, color `--sp-destructive`).
- GL-g: `/settings/grammar` 4 `.sp-toggle` pills (Master/Inline/Reinforcement/Sidebar).
- GL-h: Configure Text Engine hint → `--sp-warning` (when no provider).
- GL-i: Save → primary pill gradient (or disabled bg-3 when saving).
- GL-j: Frequency select inherits global `data-form="stack"` tokens.
- GL-k: 0 console errors.

### Mobile (S=375×812)
- GS-a: `/grammar` cards stack 1-col (`auto-fit minmax(220, 1fr)` collapses).
- GS-b: `/settings/grammar` toggles still 40×22; radios single line per pair.

### Regression
- GR-a: tsc 0 errors.
- GR-b: cycle 0060 structure preserved (hero / stats grid 2×2 / narrative row / corrections list — visible in snapshot).
- GR-c: All testids preserved (`grammar-dashboard`, `grammar-loading`, `grammar-empty-hint`, `block-level`, `block-reinforcement`, `block-errors`, `block-fillers`, `block-overused`, `block-connectors`, `block-feedback`, `block-suggestions`, `block-corrections`, `clear-all-grammar`, `grammar-settings`, `grammar-settings-loading`, `grammar-master`, `grammar-inline`, `grammar-mode-a`, `grammar-mode-b`, `grammar-reinforcement`, `grammar-sidebar`, `grammar-frequency`, `grammar-model`, `grammar-save`).
- GR-d: Reload×3 estable.

## Critical files

- MOD `frontend/src/routes/Grammar.tsx` (~239 lines, mostly style consts).
- MOD `frontend/src/routes/GrammarSettings.tsx` (~152 lines, mostly form chrome).

## Out of scope

- `features/chat/GrammarSidebarPanel.tsx` — already shipped in cycle 0071 (Chat periphery).
- `features/chat/GrammarInlineRow.tsx` — already tokenized in cycle 0071.
- Insights computation logic — backend, unchanged.
- Master/Inline/Reinforcement gating logic — preserved verbatim.
- Frequency select redesign (kit doesn't show this; keeps native `<select>`).

## Riesgos

- **`.sp-toggle` with `disabled` attribute** — primitive supports `:disabled { opacity: 0.5; cursor: not-allowed }`. Master toggle is `disabled={!hasProvider}`; inner toggles are nested in `<fieldset disabled={!prefs.master}>`. Need to verify the disabled state cascades correctly through fieldset to checkbox children. Mitigation: live test in Playwright by toggling Master OFF and confirming all child toggles render with opacity 0.5.
- **Inline mode A/B radios staying raw** — could feel inconsistent with the kit's pill toggle aesthetic. But per kit `SettingsScreen.jsx` segmented controls are reserved for binary modes (Roleplay/Assistant/Co-writer); radio + label is fine for two-option enums. Decision: keep raw, tokenize labels.
- **Corrections list line-through legibility** — per cycle 0071 F4 (GrammarSidebarPanel struck-through `--sp-fg-4 → --sp-fg-3`), I apply the same here for consistency. The struck-through original is user content, not a placeholder.

## Verification

### Gates L=1440×900
- ✅ GL-a: `/grammar` h1 "Grammar" gradient via `sp-h2 sp-wordmark sp-page-h1` className.
- ✅ GL-b: heroCard `--sp-bg-2` (rgb(26, 20, 36)) + `--sp-border` + radius 10px (`--sp-radius-md`).
- ✅ GL-c: statCard same tokens; countChip pill 999 with bg-3 + fg-2 + weight 600 (visible chip per kit Home 0068).
- ✅ GL-d: narrativeCard same tokens; body color `--sp-fg-2`.
- ✅ GL-e: Corrections list — borderBottom `--sp-border-soft`; original `--sp-fg-3` line-through legible (≥4.5:1 contrast on bg).
- ✅ GL-f: Clear-all button destructive ghost pill (border `--sp-destructive-soft`, color `--sp-destructive`).
- ✅ GL-g: `/settings/grammar` 4 `.sp-toggle` pills — Master/Inline/Reinforce/Sidebar all 40×22 with `--sp-bg-3` off / `--sp-brand-1` on.
- ✅ GL-h: Configure-Text-Engine hint `--sp-warning` (rendered when no provider — provider is configured here so not shown live; verified via code path).
- ✅ GL-i: Save button primary pill gradient (`linear-gradient(90deg, rgb(139,92,246) 0%, rgb(52,211,153) 100%)` + color rgb(13,10,21) = `--sp-bg`).
- ✅ GL-j: Frequency `<select>` inherits global `data-form="stack"` tokens.
- ✅ GL-k: 0 console errors (only 2 pre-existing React Router v7 warnings).

### Disabled cascade verification (post code-review F2)
- Click Master ON → OFF: Master `checked: false`; Inline+Reinforce+Sidebar all `disabled: true` + `opacity: 0.5` (verified via getComputedStyle):
  - inline_disabled: true, opacity: 0.5
  - reinforce_disabled: true, opacity: 0.5
  - sidebar_disabled: true, opacity: 0.5
- Defense-in-depth `disabled` props on inner toggles working (was relying solely on `<fieldset disabled>` cascade).

### sr-only label verification (post code-review F1)
- `[data-testid="grammar-model"]` parent label contains `<span style={srOnlyStyle}>Custom grammar model</span>` — text content "Custom grammar model" announced by AT.
- Computed `clipPath: inset(50%)` (canonical 2024 visually-hidden recipe with paired clip + clipPath + white-space:nowrap).

### Gates S=375×812
- ✅ GS-a: `/grammar` cards stack 1-col (auto-fit minmax(220, 1fr) collapses).
- ✅ GS-b: `/settings/grammar` toggles still 40×22; radios single line per pair; grammar-model input full-width 290px (was 139px UA-default before label wrap fix).

### Regression
- ✅ GR-a: tsc 0 errors.
- ✅ GR-b: cycle 0060 structure preserved (hero / stats grid 2×2 / narrative / corrections — visible in snapshot).
- ✅ GR-c: All 24 testids preserved (`grammar-dashboard`, `grammar-loading`, `grammar-empty-hint`, `block-level`, `block-reinforcement`, `block-errors`, `block-fillers`, `block-overused`, `block-connectors`, `block-feedback`, `block-suggestions`, `block-corrections`, `clear-all-grammar`, `grammar-settings`, `grammar-settings-loading`, `grammar-master`, `grammar-inline`, `grammar-mode-a`, `grammar-mode-b`, `grammar-reinforcement`, `grammar-sidebar`, `grammar-frequency`, `grammar-model`, `grammar-save`); +1 new `grammar-settings-error` for StatusBanner.
- ✅ GR-d: Reload×3 estable.

### Code-review findings
- **F1 conf 85 APPLIED** — sr-only span deprecated `clip: rect(0 0 0 0)` → canonical 2024 visually-hidden recipe (`srOnlyStyle` const at bottom): paired `clip` + `clipPath: inset(50%)` + `white-space: nowrap` + `border: 0` + negative margin. Verified live: clipPath: inset(50%) computed correctly.
- **F2 conf 83 APPLIED** — Defense-in-depth `disabled` props added to all 3 inner toggles: `disabled={!prefs.master}` on Inline + Sidebar, `disabled={!prefs.master || !prefs.inline_enabled}` on Reinforcement. Verified live: toggling Master OFF cascades opacity 0.5 + disabled true to all inner toggles.

### Code-simplifier
- **1 applied + 2 rejected** — `CountList<T>` generic helper extracts the 4 near-identical list renderers in StatCard children (28 → 12 lines JSX + 17-line helper); accessor fns (`getKey`, `getLabel`, `getCount`) absorb the divergent label transform on top_errors (`.replace(/_/g, " ")`). Rejected: `Hint` helper (4 sites have 3 different margins, props-explosion regression); `cardBase` extraction (3 cards diverge only in padding, indirection > savings).

### Non-omission check
- ✅ Cycle 0060 4-row dashboard structure preserved (hero / 2×2 stats / narrative / corrections).
- ✅ Grammar settings: Master toggle gating, Inline mode A/B, Reinforcement, Sidebar frequency, custom Grammar model, Save.

### Non-negotiables
- ✅ Master Grammar OFF default — code-level, unchanged.
- ✅ Inline mode A vs B — preserved as radios.
- ✅ Per-Conversation grammar isolation — backend, unchanged.
- ✅ Reinforcement gate — preserved.
- ✅ Custom grammar model fallback to Text Engine — preserved.
