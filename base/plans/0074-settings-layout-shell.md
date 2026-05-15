---
cycle: 0074
slug: settings-layout-shell
status: manual-fallback
date: 2026-04-20
---

# Cycle 0074 — Settings layout shell (re-skin)

## Goal

Re-skin `/settings` root + `SettingsLayout` two-pane/drill-through con
tokens del cycle 0066 siguiendo el patrón del kit
(`DesignSystem/ui_kits/app/SettingsScreen.jsx`): **grupos unificados en
una sola tarjeta**, **icon tiles** por row, **active indicator** estilo
kit. Shipped base primitives (.sp-toggle, .sp-range) quedan
disponibles globalmente para los sub-routes de cycles 0075–0082.

**Sin cambios estructurales**: los 10 sub-routes y sus testids se
conservan. `SettingsLayout` ya existe desde 0054, solo re-skin.

## Seed + reference provenance

- [Seed/ux.md §3 Layouts](../Seed/ux.md) — two-pane Settings en L, drill-through en S.
- [Seed/ux.md §4 Screen inventory](../Seed/ux.md) — Settings hub + sub-routes list.
- [Seed/design.md §13 anti-patterns](../Seed/design.md) — no inventar chrome.
- [PersonaLLM-Reference/04-screens/settings.md](../Seed/PersonaLLM-Reference/04-screens/settings.md) — section grouping observado.
- [PersonaLLM-Reference/11-web-adaptation-notes.md §Settings](../Seed/PersonaLLM-Reference/11-web-adaptation-notes.md) — two-pane adaptation.
- **Kit:** `DesignSystem/ui_kits/app/SettingsScreen.jsx` — SettingsGroup / SettingsRow / SettingsToggleRow / SliderRow pattern; `components.jsx` (Toggle, SectionLabel).
- **Kit previews:** `components-toggles.html`, `components-inputs.html`, `components-slider-stepper.html`.

## Non-negotiables preserved

Ninguno se toca (scope es chrome visual). SFW toggle / BYOK / snapshot /
grammar off-default etc. intactos porque no se tocan sub-routes.

## Scope (files)

1. `frontend/package.json` — add `lucide-react` dependency.
2. `frontend/src/lib/Icon.tsx` (new) — thin wrapper fixing strokeWidth 1.75 + currentColor inheritance.
3. `frontend/src/features/settings/SettingsLayout.tsx` — tokens swap.
4. `frontend/src/routes/Settings.tsx` — adopción del kit SettingsGroup/SettingsRow pattern + Lucide icons.
5. `frontend/index.html` — agregar **primitives opt-in** `.sp-toggle` + `.sp-range` al global stylesheet, sin tocar sub-routes.
6. `frontend/src/features/shell/Sidebar.tsx` + `AppShell.tsx` — migrate emoji to Lucide (Home/Users/ImageIcon/SquarePen/Settings/MessageCircle + ChevronLeft/Right + X + Menu).

## Implementation order (5 atomic subtasks)

### Subtask 1 — SettingsLayout re-skin (tokens swap)

- `aside` `borderRight: #e0e0e0` → `var(--sp-border)`; bg `var(--sp-bg-1)`.
- Detail pane bg default (hereda body `--sp-bg`).
- Empty-pane: `opacity: 0.6` → `color: var(--sp-fg-3)`, padding `2rem` OK, message unchanged.

**Assert L=1440:** `aside` border computed = token value; empty pane "Select a section…" `color(--sp-fg-3)`.

### Subtask 2 — Settings.tsx: SettingsGroup kit pattern

- h1 "Settings" → `className="sp-h2"` + margin-bottom `1.25rem`.
- Section label (Chat Experience / AI & Voice / Account):
  - Tokens: `fontSize: var(--sp-text-xs)`, `fontWeight: 600`,
    `letterSpacing: var(--sp-tracking-caps)`, `textTransform: uppercase`,
    `color: var(--sp-fg-3)` (drop opacity 0.55), `margin: 1.5rem 0 0.5rem`,
    `paddingLeft: 4px` (kit spec).
- Cada section wrapping div → `SettingsGroup` card: `background: var(--sp-bg-2)`, `border: 1px solid var(--sp-border)`, `borderRadius: 14`, `overflow: hidden`. Reemplaza el `gap: 0.25rem` + rows-with-own-borders pattern.
- Cada row (`Link`) → `SettingsRow`:
  - Layout: `display: flex; align-items: center; gap: 12px; padding: 13px 14px; border-bottom: 1px solid var(--sp-border-soft)` (última row sin borderBottom vía `:not(:last-child)` — uso selector `:last-child { border-bottom: none }` inline impossible; fix: condicional inline basado en index, o CSS global en index.html con `.sp-settings-row:last-child { border-bottom: none }`).
  - Icon tile: 30×30, radius 8, bg `var(--sp-bg-3)`, color `var(--sp-fg-2)`, emoji glyph flexible (ver tabla abajo).
  - Title: `fontSize: 14; fontWeight: 500; color: var(--sp-fg)` (dropeo el `<strong>` weight 700 del original — kit usa 500).
  - Subtitle: `fontSize: 12; color: var(--sp-fg-3)` (dropeo opacity 0.7).
  - Chevron `›`: `color: var(--sp-fg-4)` (decorative, ok per legibility rule), `fontSize: 16`.
- Icons propuestos (emoji consistency con Sidebar 🏠 👥 🖼 ✏️ ⚙️):
  - Prompt Editor: ✏️
  - Writing Styles: 🎨
  - Grammar: 📖
  - Memory: 🧠
  - Visual Roleplay: 🎭
  - Text Engine: 🤖
  - Memory Engine: 🗃
  - Image Engine: 🖼
  - Text-to-Speech: 🔊
  - Data & Security: 🔒
- Preservar testids: `settings-prompt-editor`, `settings-writing-styles`, `settings-grammar`, `settings-memory`, `settings-visual-roleplay`, `settings-text-engine`, `settings-memory-engine`, `settings-image-engine`, `settings-tts`, `settings-data-security`.

**Assert L + S:**
- GL-a: sections rendered como 3 unified cards bg-2 + radius 14.
- GL-b: rows con icon tile 30×30 bg-3 (computed).
- GL-c: section labels uppercase text-xs color fg-3.
- GL-d: chevrons visibles color fg-4.
- GS-a: mismo layout en S (no drill-through aquí — Settings root es el Layout index en L, en S es full-width porque `SettingsLayout` devuelve `<Outlet />` directo y `/settings` renderiza `Settings`; doble-check ruteo).

### Subtask 3 — Active indicator (kit pattern en L two-pane)

En L (two-pane) cuando el pathname matchea `/settings/<sub>`, la row
correspondiente se destaca per kit `SettingsScreen.jsx` líneas 41–46:
`background: var(--sp-bg-3)` + `border: 1px solid var(--sp-brand-1)` en
vez del default.

- Migrar `Link` → `NavLink` para capturar `isActive` de React Router.
- `style={({ isActive }) => ...}` condicional.
- Cuidar que el `borderBottom: --sp-border-soft` siga visible en rows no-activas; en row activa el border 1px brand-1 pisa el borderBottom visualmente (OK).
- En S (single pane) el active indicator es menos útil (no estás viendo 2 panes), pero dejarlo consistente por simplicidad — no agrega ruido.

**Assert L=1440 GL-e:** navegar `/settings/prompt-editor` → row Prompt Editor con `border: 1px solid var(--sp-brand-1)` + `bg var(--sp-bg-3)`, otras rows default.

### Subtask 4 — Global `.sp-toggle` primitive (opt-in)

En `frontend/index.html` dentro del existing `<style>` block, añadir:

```css
/* Pill toggle primitive (opt-in via .sp-toggle class).
   Applied to <input type="checkbox" class="sp-toggle">.
   Sub-routes adopt via className; no side-effect on existing checkboxes. */
.sp-toggle {
  appearance: none;
  -webkit-appearance: none;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: var(--sp-bg-3);
  border: 1px solid var(--sp-border);
  position: relative;
  cursor: pointer;
  transition: background 160ms var(--sp-ease);
  flex-shrink: 0;
  margin: 0;
}
.sp-toggle::before {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--sp-fg);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  transition: transform 160ms var(--sp-ease);
}
.sp-toggle:checked {
  background: var(--sp-brand-1);
  border-color: var(--sp-brand-1);
}
.sp-toggle:checked::before {
  transform: translateX(18px);
}
.sp-toggle:focus-visible {
  outline: 2px solid var(--sp-brand-1);
  outline-offset: 2px;
}
.sp-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Assert:** no aplicar a sub-routes en este cycle (scope "base primitives disponibles"); TSC verde. Validación real ocurre cuando 0077+ adopten `.sp-toggle` en sub-routes. Test manual: injectar un `<input type="checkbox" class="sp-toggle" />` en una page y verificar en DevTools.

### Subtask 5 — Global `.sp-range` primitive (opt-in)

CSS en `index.html`:

```css
/* Range slider primitive (opt-in via .sp-range).
   Track bg-3, filled portion brand-1 via accent-color, thumb fg.
   Modern browsers render filled-progress native; Firefox uses
   `::-moz-range-progress`. */
.sp-range {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--sp-bg-3);
  accent-color: var(--sp-brand-1);
  outline: none;
  cursor: pointer;
}
.sp-range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--sp-fg);
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  margin-top: -6px; /* center vs track */
}
.sp-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--sp-fg);
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  cursor: pointer;
}
.sp-range::-moz-range-progress {
  background: var(--sp-brand-1);
  height: 6px;
  border-radius: 999px;
}
.sp-range:focus-visible {
  outline: 2px solid var(--sp-brand-1);
  outline-offset: 4px;
}
```

**Assert:** TSC verde. Opt-in via className — no impact en existing native sliders (`MemorySettings` top-K slider etc.) hasta que su cycle de re-skin los adopte.

### Subtask 6 — Sidebar + AppShell Lucide migration

Consistency: Sidebar + Settings aside son adyacentes en L, inconsistencia visible.

- `Sidebar.tsx` ITEMS: 🏠→`Home`, 👥→`Users`, 🖼→`ImageIcon`, ✏️→`SquarePen`.
- Settings footer row: ⚙️→`Settings` icon.
- Chat indicator (cuando `/chat/:id`): 💬→`MessageCircle`.
- Collapse button: `«`/`»`→`ChevronLeft`/`ChevronRight`.
- Drawer close: `×`→`X`.
- `AppShell.tsx` hamburger: `☰`→`Menu`.
- Icon size = 18 (o 20 en footer) per kit — strokeWidth heredado del wrapper.

**Assert L+S:**
- GL-h: Sidebar muestra 5 SVG `<svg>` elements en vez de emoji spans.
- GL-i: collapse button muestra chevron SVG.
- GR-f: testids `nav-home`/`nav-characters`/`nav-gallery`/`nav-grammar`/`nav-settings`/`sidebar-collapse`/`sidebar-close`/`sidebar-hamburger` preservados.

## Risks

- **`:last-child` sin border-bottom:** inline style no soporta pseudo-selectors. Opciones: (a) CSS global en index.html targeting `.sp-settings-row:last-child`, (b) condicional en array `.map((row, i) => ... borderBottom: i === last ? "none" : ...)`. **Decisión:** (a), más limpio; añadir regla CSS `[data-settings-row]:last-child { border-bottom: none }` en index.html stylesheet.
- **Icon emoji vs SVG:** El kit usa `<Icon>` component con SVG names. Nuestro repo no tiene ese component; emoji-consistency con Sidebar es la ruta pragmática. Al cycle 0082 polish se puede evaluar migrar a SVG pack.
- **Two-pane: Settings renderizado dentro del aside (320px):** los rows pueden verse cramped. El kit mobile usa width viewport ~380px (más espacio). Mitigación: `padding: 0 1rem` en el contenedor de groups para respirar.
- **Global primitives unused este cycle:** el roadmap dice "base con previews"; explicito en el plan que los sub-routes no los adoptan aquí — solo disponibles.

## Verification gates (Playwright)

### L=1440×900

- GL-a: two-pane rendered (`settings-section-list` aside + detail pane visible).
- GL-b: h1 "Settings" con `.sp-h2` (computed fontFamily incluye SF Pro Display).
- GL-c: 3 section cards con `bg-2` + border + radius 14.
- GL-d: rows con icon tile 30×30 `bg-3`; title fg 14; subtitle fg-3 12.
- GL-e: click `/settings/prompt-editor` → row Prompt Editor con `border: 1px solid var(--sp-brand-1)` + `bg bg-3`.
- GL-f: empty pane en `/settings` muestra "Select a section…" color `fg-3`.
- GL-g: chevron color `fg-4` visible en cada row.

### S=375×812

- GS-a: Settings full-width (no aside); 3 cards stack.
- GS-b: click en row → navega a sub-route full-width (drill-through preservado).
- GS-c: back a `/settings` → root nav visible.

### Regression

- GR-a: los 10 testids `settings-*` preservados (`grep -r "data-testid=\"settings-"`).
- GR-b: navegar a cada sub-route sin console errors nuevos.
- GR-c: `tsc --noEmit` = 0.
- GR-d: reload×3 estable en `/settings` + `/settings/prompt-editor`.
- GR-e: HomeNudge + Home + Chat no regresionados.

## Deferred / out of scope

- Sub-routes re-skin (WritingStylesSettings, GrammarSettings, MemorySettings, etc.) → cycles 0078–0081 del roadmap.
- Adopción de `.sp-toggle` / `.sp-range` dentro de sub-routes existentes → sus cycles respectivos.
- Breadcrumbs en two-pane → deferred (cycle 0054 doc).
- Icon system SVG-based → cycle 0082 polish.

## Verification

### Gates L=1440×900

- **GL-a** two-pane rendered: aside 320px con `border-right: 1px solid --sp-border` + bg `--sp-bg-1`; detail pane a la derecha con Outlet. ✅
- **GL-b** h1 "Settings" con `.sp-h2` (SF Pro Display weight 700). ✅
- **GL-c** 3 section cards unificadas con bg-2 + border-radius 14 + border 1px `--sp-border`; rows internos separados por `border-bottom: 1px solid --sp-border-soft`. ✅
- **GL-d** rows con icon tile 30×30 radius 8 bg-3 con Lucide SVG + title 14/500 fg + subtitle 12 fg-3. ✅
- **GL-e** active row (`/settings/prompt-editor`): computed `boxShadow: rgb(139,92,246) 3px 0 0 inset` (brand-1) + `backgroundColor: rgb(34,26,46)` (bg-3). ✅ Kit-faithful.
- **GL-f** empty pane en `/settings` muestra "Select a section to view its settings." color fg-3. ✅
- **GL-g** ChevronRight Lucide color `--sp-fg-3` (post code-review fix F3). ✅
- **GL-h** Sidebar Lucide icons (Home / Users / Image / BookOpen) + Chat indicator MessageCircle en /chat. ✅
- **GL-i** collapse button ChevronLeft (expanded) / ChevronRight (collapsed). ✅
- **GL-j** logo image `/logo.png` height 24 visible en sidebar top. ✅ (polish pre-cycle)

### Gates S=375×812

- **GS-a** Settings full-width (no aside), 3 cards stack verticalmente. ✅
- **GS-b** drawer se abre con hamburger Menu icon Lucide; logo image height 22; X close icon; nav items con Lucide icons + Recent chats breathing (0.6rem padding). ✅
- **GS-c** click row → full-width drill-through. ✅

### Regression

- **GR-a** los 10 testids `settings-*` preservados: `prompt-editor`, `writing-styles`, `grammar`, `memory`, `visual-roleplay`, `text-engine`, `memory-engine`, `image-engine`, `tts`, `data-security`. ✅ (verificado via DOM query)
- **GR-b** `/settings/prompt-editor` 0 console errors nuevos (2 warnings pre-existentes react-router). ✅
- **GR-c** `npx tsc --noEmit` = 0 errors. ✅
- **GR-d** sidebar testids preservados: `nav-home`, `nav-characters`, `nav-gallery`, `nav-grammar`, `nav-settings`, `sidebar-collapse`, `sidebar-close`, `sidebar-hamburger`, `nav-chat-active`. ✅
- **GR-e** Home (0068+0073 + pre-0074 polish) no regresionado — Add Character card dashed + Recent Characters con marginBottom 1.25rem + Lucide sidebar icons + email centered. ✅

### Code-review findings

4 findings (HIGH/MEDIUM IMPORTANT). 2 APPLIED, 2 REJECTED con rationale:

- **F1 lucide-react `^1.8.0` inventado** — REJECTED. pnpm resolvió y descargó `+ lucide-react 1.8.0` exitosamente; el package existe. Reviewer's assumption (latest is 0.475.x) outdated — lucide-react subió major en late-2025.
- **F2 `aria-hidden` hardcoded en Icon wrapper + NavLink colapsada sin accessible label** — APPLIED. Añadido `aria-label={collapsed ? item.label : undefined}` a las 4 NavLinks de ITEMS + Settings footer NavLink. Screen readers ahora leen label cuando el sidebar está colapsado.
- **F3 chevron `--sp-fg-4` vs `--sp-fg-3`** — APPLIED. Chevron es disclosure cue funcional, no decoración pura → fg-3 per legibility rule (memoria durable post-0068). Diff de 1 línea en `routes/Settings.tsx:85`.
- **F4 `--char-accent-soft` en `settingsBtnStyle` (Sidebar footer)** — REJECTED. Código pre-existente del cycle 0067, out of scope; renderizado verificado (purple fill visible en screenshot L final). `:root --char-accent: --sp-accent-violet` default cascade is working as designed.

### Code-simplifier deltas

0 applied. 7 candidates evaluados y rechazados con rationale (Add Character card duplicación inline por state-branching, UserSection content() IIFE preserva wrapper compartido, Settings/Sidebar icon tiles divergence kit-faithful, `fetchSnippet` closure clean, `itemStyle`/`settingsBtnStyle` shapes distintos, GROUPS type aliases documentan intent, Icon wrapper enforces stroke-1.75 rule).

### Deferred (out of scope del cycle)

- Sub-routes re-skin (WritingStylesSettings, GrammarSettings, MemorySettings, etc.) → cycles 0078–0081 del roadmap.
- Adopción de `.sp-toggle` / `.sp-range` dentro de sub-routes existentes → sus cycles respectivos (opt-in primitives quedan disponibles globalmente).
- Sweep de emoji→Lucide en superficies ya shipped (Chat ActionRail, Composer ↑, Home ＋ Add Character, CharacterForm, etc.) → nuevo cycle "Iconography sweep" a añadir al roadmap (sugerido pre-0082 polish).

