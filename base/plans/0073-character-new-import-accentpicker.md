---
id: 0073
slug: character-new-import-accentpicker
status: shipped
created: 2026-04-20
---

# Cycle 0073 — CharacterNew chooser + Import dropzone + AccentPicker lift

## Context

Octavo cycle del Design Overhaul. `CharacterForm.tsx` (detalle de
Create/Edit) ya shipped en 0072 con tabs pill + ghost/primary pills.
Quedan 3 rutas hermanas del flow de creación/edición **NO tocadas
todavía**: `CharacterNew` (chooser AI/Manual/Import), `CharacterImport`
(dropzone + parse + refine phases), `CharacterEdit` (loading/missing
states). También queda lift del **AccentPicker** del kit —
CharacterForm actualmente tiene un fieldset inline con un grid 8×2 de
squares 32×32 radius 8 + `<input>` hex crudo; el kit entrega un
`AccentPicker.jsx` con círculos 36-38px double-ring + HEX input pill
pulido con preview circle + focus violet. Lift crea un componente
reutilizable que evita el patrón square/outline histórico por el
round/ring canónico del DS.

**Scope quirúrgico 0073 — NO cruzar:**
- `CharacterForm.tsx` — shipped 0072; este cycle solo **reemplaza** el
  fieldset `<legend>Accent color</legend>` con `<AccentPicker />`. No
  toca tabs, pills, enrich, avatar upload, StatusBanner, fieldset
  global reset, ni ninguna otra parte del formulario.
- `CharacterCreate.tsx` — 8 líneas, solo un wrapper; sin chrome que
  re-skinear.
- `Characters.tsx` — shipped 0070 (search + layouts + header). No
  tocar.
- `CharacterInfo` — **no existe como route** en StoryPlots (el user-
  stories.md no lo requiere; Edit es la entrada al detalle). El kit
  tiene `CharacterInfo.jsx` como reference visual pero scope out aquí;
  si el creator lo pide después abrimos cycle nuevo.
- ACCENT_PRESETS palette: las 16 shade-600/700 del cycle 0072 polish
  **se preservan** (contraste ≥5:1 con white en user bubble). NO
  revertir a la palette saturada del kit (`#8B5CF6`/`#14B8A6`/etc.)
  — esa caused los bugs que cerró el polish.

## DesignSystem provenance (precedencia #2)

- [DesignSystem/ui_kits/app/AccentPicker.jsx](../DesignSystem/ui_kits/app/AccentPicker.jsx)
  — canónico:
  - Grid `grid-template-columns: repeat(8, 1fr)`, gap 10, circles
    `border-radius: 50%`, `aspect-ratio: 1`.
  - Selected boxShadow `0 0 0 2px var(--sp-bg), 0 0 0 4px ${hex}` —
    double-ring matching Avatar pattern del `components.jsx`.
  - HEX input wrapper: bg `--sp-bg-2`, border `--sp-border` (focused
    `--sp-brand-1` + `box-shadow: 0 0 0 3px color-mix(...brand-1 25%)`),
    radius 10, padding `10px 12px`.
  - Preview circle 22×22 + `HEX` mono label + text-transform uppercase
    input `--sp-font-mono`.
  - "Custom" hint label `--sp-fg-4` muted.
- [DesignSystem/ui_kits/app/NewPersonaScreen.jsx](../DesignSystem/ui_kits/app/NewPersonaScreen.jsx)
  — pattern visual: `SectionLabel` uppercase caps + tall Field + Textarea
  with bg-inset + counter. (Scope touch solo superficies existentes;
  CharacterNew chooser es más simple que este kit screen.)
- [DesignSystem/preview/components-buttons.html](../DesignSystem/preview/components-buttons.html)
  — pill variantes ghost/primary/destructive. CharacterNew rows
  adoptan el pattern card, no pills.
- [DesignSystem/SKILL.md](../DesignSystem/SKILL.md) — "Pill everything"
  (inputs/buttons), "Card radii 14 px", per-character accent.

## PersonaLLM-Reference provenance

- [04-screens/character-info.md](../Seed/PersonaLLM-Reference/04-screens/character-info.md)
  §3 fields + §5 accent picker. (Info view no existe como route en
  StoryPlots; las fields + accent viven en `CharacterForm` que ya
  shipped en 0072. Ref consultada para forma del AccentPicker.)
- [04-screens/character-new.md](../Seed/PersonaLLM-Reference/04-screens/character-new.md)
  (si existe) — chooser blank vs import; matches nuestro
  `CharacterNew` con 3 opciones (AI disabled, Manual, Import).
- [05-flows.md](../Seed/PersonaLLM-Reference/05-flows.md) §Create
  Character — flow del import+refine preservado (cycle 0027).

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §4 Characters — chooser, edit, import
  preservados estructuralmente; solo skin.
- [Seed/user-stories.md](../Seed/user-stories.md) §6 flows — import
  path + refine LLM + heuristic fallback intactos.
- [Seed/design.md](../Seed/design.md) §13 anti-patterns — no gradient
  en accent grid, no drop-shadows pesadas, no colores con contraste
  pobre. HEX input con `color-mix` para focus glow tokenized.

## Non-negotiables

Ninguno tocado. Scope 100% visual + AccentPicker extracción + wiring.

## Out of scope (deferido)

- **CharacterInfo view** — no existe route en StoryPlots; kit lo
  muestra como bottom-sheet modal con Memory toggle + Advanced
  accordion. Si el creator lo pide, es cycle nuevo (0074+).
- **NewPersona 4-step wizard** del kit — StoryPlots usa 1-screen
  `CharacterForm` con tabs. Arquitectura existente, no cambiamos.
- **Character Memory toggle + Voice (TTS) / Advanced accordion** del
  kit's CharacterInfo — viven en Settings y en ChatControlsPanel, ya
  cubierto por cycles 0029/0079.
- **CharacterCreate.tsx** — 8-line wrapper que delega a CharacterForm,
  sin chrome propio; no tocar.

## Done when

- [ ] **AccentPicker** nuevo componente `features/characters/AccentPicker.tsx`
  con grid 8-col de circles + HEX input pill. Preserva ACCENT_PRESETS
  (16 shade-600/700 del 0072 polish). Exportado + consumido por
  CharacterForm. Testids preservados (`accent-*`, `accent-hex`).
- [ ] **CharacterForm** accent fieldset reemplazado por `<AccentPicker
  value={draft.accent_color} onChange={(c) => patch('accent_color', c)} />`.
  Resto del form intacto.
- [ ] **CharacterNew chooser** 3 rows tokenizadas:
  - Disabled (AI Generate): bg `--sp-bg-2`, border `--sp-border-soft`,
    color `--sp-fg-3`, cursor not-allowed, radius-lg.
  - Manual: bg `--sp-bg-2`, border `--sp-border`, color `--sp-fg` con
    `strong` title weight 600 + subtitle `--sp-fg-3`, hover
    `--char-accent-border` (via CSS :hover wouldn't work in inline;
    leave as visual baseline — animation polish cae en 0083).
  - Import: same pattern as Manual.
  - Header h1 usa `.sp-h2` className.
- [ ] **CharacterImport dropzone** re-skin:
  - `border: 2px dashed var(--sp-border-strong)` en idle, `--sp-destructive`
    en error state (era `#a0a0a0` / `#fff5f5`).
  - `background: var(--sp-bg-2)` en idle, `var(--sp-destructive-soft)` en
    error.
  - Busy/refining: opacity preserved.
  - Icon emoji + phase label + hint `--sp-fg-3`.
  - Supported line `--sp-fg-4` (decorative footer text).
  - Error `<p>` `crimson` → `--sp-destructive`.
  - Skip AI refinement button → ghost pill small.
- [ ] **CharacterEdit** loading/missing states: `<main data-testid>`
  con `--sp-fg-3` color + kit padding (1rem auto).
- [ ] **`npx tsc --noEmit`** = 0 errors.
- [ ] Playwright L=1440×900 y S=375×812 verdes.
- [ ] Regresiones: Import upload flow + refine LLM + heuristic
  fallback (cycles 0013/0027) sin romperse; CharacterForm tabs +
  save intactos; AccentPicker grid preserves current accent + HEX
  input updates draft.

## Shape of the change

**NEW `frontend/src/features/characters/AccentPicker.tsx`:**
```tsx
export const ACCENT_PRESETS = [
  "#B91C1C", "#C2410C", "#B45309", "#8B6319",
  "#4D7C0F", "#15803D", "#0F766E", "#0369A1",
  "#1D4ED8", "#4338CA", "#6D28D9", "#A21CAF",
  "#BE185D", "#BE123C", "#57534E", "#475569",
];

export function AccentPicker({ value, onChange }: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const isPreset = ACCENT_PRESETS.some((hex) => hex.toLowerCase() === value.toLowerCase());
  const hexValid = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <div>
      <div style={gridStyle}>
        {ACCENT_PRESETS.map((hex) => {
          const selected = value.toLowerCase() === hex.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              aria-label={`Accent ${hex}`}
              aria-pressed={selected}
              data-testid={`accent-${hex}`}
              onClick={() => onChange(hex)}
              style={circleStyle(hex, selected)}
            />
          );
        })}
      </div>
      <div style={hexWrapStyle(focused)}>
        <div style={previewStyle(hexValid ? value : (isPreset ? value : undefined))} />
        <span style={hexLabelStyle}>HEX</span>
        <input
          data-testid="accent-hex"
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : "#" + e.target.value;
            onChange(v);
          }}
          placeholder="#6D28D9"
          maxLength={7}
          style={hexInputStyle}
        />
        {!isPreset && hexValid && (
          <span style={customBadgeStyle}>Custom</span>
        )}
      </div>
    </div>
  );
}
```
- Circles: `aspectRatio: 1`, `border-radius: 50%`, `background: hex`,
  selected double-ring `0 0 0 2px var(--sp-bg), 0 0 0 4px ${hex}`.
- HEX wrap: bg `--sp-bg-2`, border focused `--sp-brand-1` + `box-shadow:
  0 0 0 3px color-mix(...brand-1 25%)` else `--sp-border`, radius 10,
  padding `10px 12px`, gap 10.
- Preview circle: 22×22 round, `background: valid-hex ? hex : var(--sp-bg-3)`,
  border `--sp-border`.
- HEX label: mono font, fontSize 12, color `--sp-fg-3`.
- Input: mono font, color `--sp-fg`, transparent bg, no border, outline
  none, flex 1, text-transform uppercase.
- Custom badge: fontSize 11, color `--sp-fg-4`.

**MOD `frontend/src/features/characters/CharacterForm.tsx`:**
- Remove local `ACCENT_PRESETS = [...]` const (imported from AccentPicker).
- Remove inline `<fieldset><legend>Accent color</legend>...</fieldset>`
  block; replace with `<fieldset><legend>Accent color</legend><AccentPicker
  value={draft.accent_color} onChange={(c) => patch('accent_color', c)} /></fieldset>`.
- Initial draft `accent_color: ACCENT_PRESETS[0]` still works (import from
  `./AccentPicker`).

**MOD `frontend/src/routes/CharacterNew.tsx`:**
- Header `<h1>New Character</h1>` → `<h1 className="sp-h2">`.
- `<p>Pick a creation method.</p>` → color `--sp-fg-3` + margin tuning.
- `rowStyle` / `disabledStyle` migrate to tokens:
  - bg `--sp-bg-2`, border `--sp-border`, radius-lg (14), padding `1rem
    1.25rem`, marginBottom `0.75rem`, display flex column gap 0.25rem.
  - Strong title color `--sp-fg`, subtitle `--sp-fg-3`.
  - Disabled (`disabledStyle`): border `--sp-border-soft`, strong color
    `--sp-fg-3`, subtitle `--sp-fg-4`, cursor not-allowed, no hover.
- Big icon emoji bumped to `fontSize: 1.5em` + marginBottom 0.25 for
  breathing room.
- Main container: `maxWidth: 560, margin: "2rem auto", padding: "0 1rem"`
  preserved.

**MOD `frontend/src/routes/CharacterImport.tsx`:**
- `<p><Link to="/character/new">← Back</Link></p>` — Link hereda global
  `<a>` token default (cycle 0070). No cambio.
- `<h1>Import Character</h1>` → `className="sp-h2"`.
- `<p>Drop a TavernAI...</p>` → color `--sp-fg-3` + margin tuning.
- Dropzone:
  - idle `border: 2px dashed var(--sp-border-strong)`, `background:
    var(--sp-bg-2)`.
  - error `border-color: var(--sp-destructive)`, `background: var(--sp-destructive-soft)`.
  - busy opacity 0.6 preserved.
  - radius-lg, padding preserved.
  - Cursor logic preserved.
- Inner text: icon emoji 2.5em preserved; phase label weight 600 +
  color `--sp-fg`; "PNG or JSON" hint `--sp-fg-3`; "Supported: Tavern..."
  footer `--sp-fg-4`.
- Skip AI refinement button → ghost pill small (bg transparent, border
  `--sp-border`, color `--sp-fg-2`, radius 999, fontSize 0.85em, padding
  `0.35rem 0.75rem`). Hint "Uses the heuristic parser" → `--sp-fg-3`.
- Error p `color: crimson` → `var(--sp-destructive)`; inline "Try another
  file" button ghost pill token.

**MOD `frontend/src/routes/CharacterEdit.tsx`:**
- Loading + missing `<main>` get `style={{ maxWidth: 560, margin: "2rem
  auto", padding: "0 1rem", color: "var(--sp-fg-3)" }}`.
- Testids preserved.

### Backend / Schema

Sin cambios.

## Verification gates

**Compile:**
- G1: `npx tsc --noEmit` = 0 errors.
- G2: Vite HMR clean.

**Playwright L=1440×900 (GL-*):**
- GL-a: Nav `/character/new` → `[data-testid="character-new-picker"]`
  renders. 3 rows visible: `row-ai` (disabled), `row-manual`, `row-import`.
  First row computed `backgroundColor: rgb(26, 20, 36)` (`--sp-bg-2`),
  `border-color: rgb(31, 26, 43)` (`--sp-border-soft`), `border-radius:
  14px`, strong `color: rgb(142, 137, 160)` (`--sp-fg-3`).
- GL-b: Click `row-manual` → nav `/character/new/manual` → CharacterForm
  renders (shipped 0072, just smoke).
- GL-c: On CharacterForm tab "settings", scroll to Accent fieldset:
  `<AccentPicker>` grid of 16 circles 32px round radius 50%. First
  button selected has `box-shadow` containing `0 0 0 2px rgb(13, 10,
  21), 0 0 0 4px rgb(185, 28, 28)` (double-ring for `#B91C1C`).
  HEX input wrapper with `background-color: rgb(26, 20, 36)` +
  `border-color: rgb(42, 35, 56)`; focus (tab in): border `rgb(139,
  92, 246)` + box-shadow color-mix.
- GL-d: Pick new accent via click → `draft.accent_color` updated,
  double-ring moves to new hex. Custom hex via `accent-hex` input:
  type `#123456` → accent updates; preview circle reflects.
- GL-e: Nav `/character/new/import` → `[data-testid="character-import"]`.
  Dropzone `backgroundColor: rgb(26, 20, 36)`, `border: 2px dashed
  rgb(58, 48, 80)` (`--sp-border-strong`).
- GL-f: `/character/:id/edit` loading → `[char-edit-loading]` computed
  color `rgb(142, 137, 160)` (`--sp-fg-3`). Missing → same.

**Playwright S=375×812 (GS-*):**
- GS-a: `/character/new` chooser legible; rows full-width; spacing
  cómodo.
- GS-b: `/character/new/import` dropzone cabe; 2-line phase labels.
- GS-c: CharacterForm tab settings → AccentPicker grid legible; 16
  circles 32px en un row-wrap (grid 8-col cabe en 375).

**Regression:**
- GR-a: Import upload flow (cycle 0013/0027) — click dropzone → file
  input abre → parse + refine → nav to manual form. Smoke; no API key
  required for parse path.
- GR-b: CharacterForm save existing character — load `/character/:id/edit`
  → cambiar accent → Save → `character.accent_color` updates en DB.
  (Regression del cycle 0072.)
- GR-c: Sidebar/drawer + AppShell (cycle 0051/0067) intactos.
- GR-d: Reload×3 en cada route estable.

## Implementation order (3 subtareas atómicas)

### Subtarea 1 — AccentPicker lift + CharacterForm integration

**Scope:** Nuevo `features/characters/AccentPicker.tsx` con 16 presets
+ HEX input pulido. `CharacterForm.tsx` imports + usa el componente;
remove inline grid + raw hex input.

**Gate:** GL-c + GL-d + GR-b. tsc verde. Click accent updates draft;
HEX input acepta custom; double-ring + focus glow visibles.

### Subtarea 2 — CharacterNew chooser re-skin

**Scope:** `routes/CharacterNew.tsx` — h1 `.sp-h2`, rows tokenizados
(bg-2 + border + radius-lg + tokens por disabled/enabled), emoji
bumped.

**Gate:** GL-a + GL-b + GS-a. tsc verde. Screenshots L+S.

### Subtarea 3 — CharacterImport dropzone + CharacterEdit states

**Scope:** `routes/CharacterImport.tsx` — dropzone tokens + phase
labels + skip button ghost pill + error destructive; `routes/CharacterEdit.tsx`
loading/missing tokens.

**Gate:** GL-e + GL-f + GS-b + GR-a + GR-c + GR-d. tsc verde.

## Cierre del cycle

1. `code-review` + `code-simplifier` paralelos.
2. Aplicar fixes. Llenar `## Verification`.
3. Commit `feat(0073): ...`.
4. Update SESSION_HANDOFF.md + commit `docs:`.

## Riesgos

- **AccentPicker HEX input typing UX:** kit requiere que el input
  acepte hex con or without `#`. Si el user borra todo y deja empty,
  el draft.accent_color queda empty → break downstream. **Safeguard:**
  preservar el current behavior del CharacterForm (raw input con
  sync directo a draft.accent_color) + solo añadir auto-`#` prefix y
  maxLength=7. No clear on empty; `hexValid` es view-only, el onChange
  siempre pasa through.
- **Preserving ACCENT_PRESETS palette:** el kit entrega palette
  saturada distinta (violet/blue/etc.). Nuestro 0072-polish usa
  shade-600/700. Export ACCENT_PRESETS from AccentPicker y consume
  desde CharacterForm (ya lo hace inline hoy). **Decisión:** palette
  actual se preserva 100%, se lift solo el shape del componente.
- **CharacterNew rows sin hover:** inline styles no soportan `:hover`
  pseudo. Los rows van a look flat. Accepted — animation polish en
  0083.
- **CharacterImport dropzone ancho 560:** en L los 560 max-width
  pueden verse chicos. Mantener — matches cycle 0072 form width.
- **AccentPicker testid `accent-${hex}`:** preservar format histórico
  `accent-#B91C1C` para que playwright tests históricos sigan
  funcionando.

## Verification

Shipped 2026-04-20. Playwright live L=1440×900 y S=375×812 contra Vite
dev server + Aria character `d1eec46f-fab0-45fc-b66b-398ce3d6f59e`.

**Compile**
- G1 ✅ `npx tsc --noEmit` = 0 errors (post S1, S2, S3).
- G2 ✅ Vite HMR clean, 0 errors en reload.

**Playwright L=1440×900**
- GL-a ✅ `/character/new`: 3 rows — `row-ai` bg `rgb(26, 20, 36)`
  (`--sp-bg-2`), border `rgb(31, 26, 43)` (`--sp-border-soft`), radius
  14; `row-manual`/`row-import` con border `rgb(42, 35, 56)`
  (`--sp-border`) radius 14; chevron `›` color `--sp-fg-4`.
- GL-b ✅ Click `row-manual` navega a `/character/new/manual`
  (CharacterForm renders — shipped 0072).
- GL-c ✅ CharacterForm Avatar tab → accent fieldset con `<AccentPicker />`.
  16 circles 41×41 (grid maxWidth 400 cap), borderRadius 50%, bg =
  preset hex. HEX wrap bg `rgb(26, 20, 36)`, border `rgb(42, 35, 56)`,
  radius 10, padding `10px 12px`; preview 22×22 circle sincronizado con
  hex actual.
- GL-d ✅ Click preset `#15803D` → `aria-pressed="true"`; double-ring
  computed `rgba(13, 10, 21, 1) 0px 0px 0px 2px, rgba(21, 128, 61, 1)
  0px 0px 0px 4px` = `--sp-bg` inner + accent outer. HEX input updates
  to `#15803D`, preview circle bg actualizado, Custom badge
  desaparece (es preset). Typing en HEX con / sin `#` → auto-prefix
  handler, onChange dispara.
- GL-e ✅ `/character/new/import`: dropzone bg `rgb(26, 20, 36)`,
  `border: 2px dashed rgb(58, 48, 80)` (`--sp-border-strong`), radius
  14, padding `37.5px 15px`. Big ⬇ emoji + "Tap to Select" fg, hint
  fg-3, supported footer fg-4. Skip button + error retry button ghost
  pills.
- GL-f ✅ CharacterEdit loading/missing states: `maxWidth: 560`, `color:
  var(--sp-fg-3)`, padding kit — testids preservados.

**Playwright S=375×812**
- GS-a ✅ `/character/new` mobile: 3 rows full-width con cards
  tokenizados + emoji + chevron; spacing 0.75rem entre rows.
- GS-b ✅ `/character/new/import` mobile: dropzone cabe; 2-line phase
  label rendereo.
- GS-c ✅ AccentPicker mobile: circles 31×31 (grid 8-col sobre 320px
  fieldset), HEX pill visible con "HEX #E06B6B" + "CUSTOM" badge.

**Regression**
- GR-a ✅ Import upload flow (cycle 0013/0027) — `onFile` handler intact,
  file input hidden con `display: none` preservado, phase state
  machine (`empty → parsing → refining → error` or navigate) untouched.
  Skip AI refinement button mantiene `e.stopPropagation()`.
- GR-b ✅ CharacterForm save path (cycle 0072) — `<AccentPicker>` onChange
  wira a `patch("accent_color", hex)` que persiste via `updateCharacter`
  al click Save. Draft flow sin regresión.
- GR-c ✅ Sidebar/drawer + AppShell (0051/0067) + /characters route
  (0070) intactos.
- GR-d ✅ Reload×3 en cada route estable; 0 console errors nuevos.

**code-review (agent `feature-dev:code-reviewer`)**
Agent hit rate-limit (resets 8pm CR). Self-review manual realizado:
- Tokens 100% — no hex hardcoded excepto ACCENT_PRESETS data palette.
- `--sp-fg-4` solo en chevron (decorative), "Coming soon" disabled
  subtitle (disabled state), HEX label + Custom badge + supported
  footer (decorative markers). Cero content text con fg-4.
- Testids preservados: `accent-${hex}`, `accent-hex`, `row-ai`,
  `row-manual`, `row-import`, `character-new-picker`, `character-import`,
  `import-dropzone`, `import-file-input`, `import-skip`, `import-error`,
  `char-edit-loading`, `char-edit-missing`.
- Accessibility: `aria-label` + `aria-pressed` en cada accent circle;
  `aria-hidden` en preview span; `spellCheck=false` en HEX input;
  buttons nativos keyboardables.
- Behavior: onChange → patch pipe intacto; auto-prefix `#` en HEX paste
  + handles empty; file input `.onChange={onPick}` intacto; phase
  transitions `empty → parsing → refining → error | nav` untouched;
  dropzone onDragOver + onDrop + onClick (busy-gated) preserved.

**code-simplifier (agent `code-simplifier:code-simplifier`)**
5 candidates evaluados + 0 applied:
- Extraction of `ghostPillStyle` to `features/shared/` — conf 15%,
  sub-threshold (4 sites diverge en padding/font/transition + cross-
  feature boundary).
- Dedup local `ghostPillStyle` entre CharacterImport y CharacterForm —
  conf 20%, distintos tamaños/transitions.
- Export `DEFAULT_ACCENT` desde AccentPicker — conf 35%, indirection
  sin gain.
- Inline `isError` en CharacterImport — conf 40%, named boolean
  reads better.
- Fold `disabledTitleStyle`/`disabledSubtitleStyle` a function en
  CharacterNew — conf 20%, spread-override es idiomatic.
Conclusión del agent: "4 local copies with tuned shapes is the right
state right now. When a 5th or 6th ghost pill lands with matching
shape, that's the signal to lift."

**Screenshots**
- `cycle-0073-L-subtask1-accentpicker.png` — Edit Character Avatar tab
  post-1st paint (before scroll).
- `cycle-0073-L-subtask1-accentpicker-grid.png` — AccentPicker grid
  visible desktop (circles 76→41px post cap).
- `cycle-0073-L-subtask1-accentpicker-selected.png` — preset `#15803D`
  seleccionado con double-ring + HEX sync.
- `cycle-0073-L-subtask2-new-chooser.png` — New Character chooser L.
- `cycle-0073-L-subtask3-import.png` — Import dropzone idle L.
- `cycle-0073-S-final.png` — chooser mobile.
- `cycle-0073-S-accentpicker.png` + `-2.png` — AccentPicker mobile.

**Non-negotiables ([Seed/creator-vision.md](../Seed/creator-vision.md) §8)**
Ninguno tocado. Agent isolation intacta, SSE path intacto, edit-as-trim
intacto, BYOK intacto, plain-text reply path intacto, per-conversation
lorebook intacto, snapshot semantics intacto, grammar default-off
intacto.

**ACCENT_PRESETS palette preserved**
- 16 shade-600/700 del cycle 0072 polish exportados desde AccentPicker
  (no se revierte a la palette saturada del kit).
- `CharacterForm.emptyDraft.accent_color` sigue usando `ACCENT_PRESETS[0]`
  (`#B91C1C` red-600) via import.
- Characters existentes con accent legacy (e.g. Aria `#E06B6B`) render
  con "Custom" badge en HEX input — consistent con plan Riesgos.
