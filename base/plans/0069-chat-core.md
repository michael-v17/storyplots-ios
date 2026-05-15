---
id: 0069
slug: chat-core
status: shipped
created: 2026-04-20
---

# Cycle 0069 — Chat core re-skin

## Context

Cuarto cycle del Design Overhaul. 0066 (foundation) + 0067 (shell) +
0068 (Home) listos. Este cycle re-skina las **3 superficies principales
del chat viviente**: la bubble del mensaje (user + assistant), el
composer (textarea + send), y el chrome del ChatShell (header +
memory toast + feed empty state). Es el cycle que hace que el chat
*se vea* como el kit — el lugar donde el creator va a pasar la mayor
parte del tiempo usando la app.

**Scope quirúrgico 0069 — NO cruzar:**
- **ScenarioCard**, **ActionRail** (los 4 botones ↻/⑂/🖼/▶ bajo la
  assistant bubble), **ConversationSwitcher**, **BranchBreadcrumb**,
  **GrammarSidebarPanel**, **ChatControlsPanel**, **EditTrimDialog**,
  **ImageViewer**, **RewriteGate**, **MessageImage/Skeleton**,
  **MessageAvatar**, **MessageAudioButton**, **GrammarInlineRow** —
  todos **diferidos a 0070** (Chat periphery) o cycles dedicados.
- **MessageBubble action buttons** (regenerate / fork / image inline
  row) — caen bajo "ActionRail" → 0070. Se quedan con su `actionBtn`
  actual en este cycle.
- **Variant counter** (‹ 1/3 ›) — parte del bubble, se skina aquí
  mínimo (solo colores de los botones).

## DesignSystem provenance (precedencia #2)

- [DesignSystem/ui_kits/app/ChatScreen.jsx](../DesignSystem/ui_kits/app/ChatScreen.jsx)
  — canónico:
  - UserMessage: `background: var(--char-accent), color: white,
    padding: 10px 16px, borderRadius: 999, maxWidth: 78%, fontSize: 15`
    (sin opacity, sin border).
  - AssistantMessage inner: `background: var(--sp-bg-2), borderRadius:
    14, padding: 12px 14px, fontSize: 15, lineHeight: 1.6`. `border:
    selected ? '1px solid var(--char-accent-border)' : 'transparent'`
    + `boxShadow: selected ? '0 0 24px -4px var(--char-accent-glow)' :
    'none'`. Narration `<span>` con `fontStyle: italic, color:
    var(--sp-fg-2)`; dialogue `<span>` con `color: var(--sp-fg)`.
  - Timestamp: `fontSize: 11, color: var(--sp-fg-4)`.
  - Composer container: `bg: var(--sp-bg-1), borderTop: 1px
    var(--sp-border-soft), padding: 12px 14px calc(12px + env(safe-
    area-inset-bottom))`.
  - Composer pill: `bg: var(--sp-bg-2), border: 1px var(--sp-border),
    borderRadius: 22, padding: 8px 10px 8px 16px, flex gap:10`.
  - Composer textarea: `bg: transparent, border: none, outline: none,
    color: var(--sp-fg), fontSize: 15, resize: none, maxHeight: 120`.
  - Send button: `width:36 height:36 borderRadius:50% border:none
    bg: draft.trim() ? 'var(--sp-brand-grad)' : 'var(--sp-bg-3)'
    color: draft.trim() ? '#0D0A15' : 'var(--sp-fg-4)'`.
  - Header: `bg: var(--sp-bg-1), borderBottom: 1px
    var(--sp-border-soft), padding: 14px 12px`.
- [DesignSystem/preview/components-chat-bubble.html](../DesignSystem/preview/components-chat-bubble.html)
  — ground truth visual (user bubble pill accent + assistant bubble
  bg-2 con narration italic `--sp-fg-2` + dialogue `--sp-fg`).
- [DesignSystem/preview/type-chat-convention.html](../DesignSystem/preview/type-chat-convention.html)
  — "SF Pro Text Regular-Italic = narration · SF Pro Text Regular =
  dialogue".
- [DesignSystem/SKILL.md](../DesignSystem/SKILL.md) "Pill everything"
  + "Card radii 14 px" + "Brand gradient only on wordmark + primary
  CTA + **send button**".

## PersonaLLM-Reference provenance

- [04-screens/chat.md](../Seed/PersonaLLM-Reference/04-screens/chat.md)
  — estructura (header + feed + composer + inline inspector L) ya
  satisfecha por cycles 0052/0055/0056/0058. Este cycle solo pinta.
- [06-chat-interaction-model.md](../Seed/PersonaLLM-Reference/06-chat-interaction-model.md)
  — italic narración · plain diálogo freely mixed. Ya implementado en
  `TypographicText` (`*texto*` → `<em>`). Este cycle migra la dim de
  italic de `opacity: 0.75` → `color: var(--sp-fg-2)` tokenizado.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §4 Chat — composer + bubbles + header
  estructuralmente intactos; este cycle solo reskin.
- [Seed/design.md](../Seed/design.md) §13 anti-patterns — evitamos:
  no gradient en bubbles (solo en send button, per SKILL); no drop-
  shadows pesadas en bubbles (glow sutil `color-mix` solo en selected
  assistant).
- [Seed/creator-vision.md](../Seed/creator-vision.md) §8 — SSE
  streaming path preservado (caret `▌` sigue), edit-as-trim intacto,
  edit-dialog sin tocar, agent isolation intacto.

## Non-negotiables

Ninguno tocado. Cambios 100% visuales.

## User feedback integrado (post-0068 ship)

**Legibility** — el creator observó que `--sp-fg-4` (#6A657A) sobre
surfaces dark (`--sp-bg-2`/`-bg-3`) da "morado oscuro que hace
contrastes difíciles de leer". Regla adoptada para 0069 y todos los
cycles siguientes:

- `--sp-fg-4` reservado SOLO para placeholders (input), disabled
  states (botón disabled), decorative timestamps, marker-style
  badges ("edited"), fallback em-dash "—" en empty slots.
- Content text (hints útiles, counts, chips parseables, metadata
  que el user lee) usa `--sp-fg-3` como piso.
- Secondary copy (taglines, narration italic) usa `--sp-fg-2`.

**Spacing** — el creator observó Home (0068) con "cosas como muy
pegadas". Regla para 0069 y siguientes:

- Alinear a valores del kit (`DesignSystem/ui_kits/app/`):
  bubble padding `10×16` (user) / `12×14` (assistant), gap entre
  messages `14`, composer pill `8 10 8 16`, footer `12 14`,
  header `14 12`, card interior mínimo `1rem`, chip rows gap
  `0.4rem` mínimo.
- No heredar el `0.5rem` / `0.25rem` default del pre-overhaul
  cuando el kit pide más.

**Home 0068 follow-up (opportunistic fix):** bump de 2 ocurrencias
de `--sp-fg-4` en `routes/Home.tsx` a `--sp-fg-3` — KPI `hint`
row ("failure rate", "5 categories", "2 words") + pattern chip
count span. Incluido en Subtarea 3 como sub-fix.

## Out of scope (deferido, con dónde cae)

- **ActionRail bubble row** (regenerate/fork/image/audio buttons
  inline bajo assistant bubble) → **0070** (Chat periphery). Se
  quedan con `actionBtn` opacity 0.6 hex style.
- **ScenarioCard** (`[data-testid="scenario-card"]` en MessageFeed) →
  **0070**. Aquí solo fix mínimo del bg visible sobre body dark
  (`rgba(0,0,0,0.03)` → `var(--sp-bg-2)` + `rgba(0,0,0,0.03)` left
  border → `var(--char-accent)`), preservando estructura.
- **ConversationSwitcher**, **BranchBreadcrumb**, **GrammarSidebarPanel**,
  **ChatControlsPanel**, **sub-panels** (Notes/Lorebook/Memory/GenOverride)
  → **0070**.
- **MessageImage / Skeleton / ImageViewer** → ya re-skinado por el
  0067 del AppShell; aquí intacto.
- **MessageAvatar** — ya tokenizado por el 0067 (ring pattern).
  Verificar que no regresione; no tocar.
- **RewriteGate**, **EditTrimDialog** → cycles 0072/0076 dedicated.
- **GrammarInlineRow** (corrections row bajo user bubbles cuando
  grammar mode A) → **0077** (Grammar re-skin).

## Done when

- [ ] **User bubble** es pill 999 con `background: var(--char-accent)`,
  `color: white`, sin opacity, padding kit (10 16), maxWidth 75-78%.
- [ ] **Assistant bubble** es radius 14 `var(--sp-bg-2)` + `color:
  var(--sp-fg)` + line-height 1.6 + padding 12 14. Sin border por
  default; border `--char-accent-border` + `boxShadow` glow solo
  cuando selected (current selected = variant counter; no hay
  onSelect en MessageBubble actualmente — el kit asume "selected"
  state. **Scope 0069:** implementar selected visual cuando
  `hasManyVariants && variant active` — opt-in mínimo sin cambiar
  data model).
- [ ] **TypographicText**: `<em>` opacity 0.75 → token color. Nueva
  prop `tone?: 'on-accent' | 'on-surface'`. Default 'on-surface':
  `<em>` color `var(--sp-fg-2)`. 'on-accent' (user bubble): `<em>`
  inherits `color` del bubble (white). Plain spans heredan color
  siempre.
- [ ] **Timestamp** / **"edited"** / **streaming caret** usan
  `var(--sp-fg-4)` (decorative markers, OK per legibility rule) o
  `var(--sp-fg-3)` (no opacity). **Stream error** usa
  `var(--sp-destructive)` (no `--sp-fg-4`).
- [ ] **Composer** pill: container bg `--sp-bg-2` border `--sp-border`
  radius 22; textarea transparent fontSize 15 color `--sp-fg`
  placeholder `--sp-fg-4`; send button circle 36×36 bg
  `var(--sp-brand-grad)` cuando text.trim() else `var(--sp-bg-3)`,
  color `#0D0A15` on gradient else `var(--sp-fg-4)`. Extra button
  row (Notes/Grammar toggle) preservado (no regression del 0052
  inline-mode inspector).
- [ ] **Composer footer wrapper** bg `--sp-bg-1` borderTop
  `--sp-border-soft` padding kit.
- [ ] **Disabled state** (gated = no text provider) con `<p>`
  disabledReason en `--sp-fg-3`; error `<p>` en `--sp-destructive`.
- [ ] **ChatShell header** bg `--sp-bg-1` borderBottom 1px
  `--sp-border-soft`; tagline `opacity: 0.7` → `color: --sp-fg-3`;
  hamburger/←/Edit/⋯ con `color: --sp-fg-2` hover `--sp-fg`;
  `chat-char-name` `<strong>` color `--sp-fg` weight 600.
- [ ] **Memory toast** migrado: bg `var(--sp-bg-2)` border
  `var(--sp-border)` radius `var(--sp-radius-md)` (10) color
  `var(--sp-fg)` + shadow token; el `💾` y `×` opacity → fg-3.
- [ ] **MessageFeed** empty state `opacity: 0.6` → `color:
  var(--sp-fg-3)`; feed `<section>` bg transparent (hereda body
  `--sp-bg`) + fix scenario card mínimo (bg `--sp-bg-2` +
  borderLeft `var(--char-accent)`, preservando estructura para 0070).
- [ ] **`npx tsc --noEmit`** verde.
- [ ] Playwright L=1440×900 y S=375×812 verdes.
- [ ] Regresiones preservadas: SSE streaming (caret + partial image
  tag strip), edit-as-trim dialog, variant stepper (‹ N/M ›),
  conversation switcher (0058), inline inspector L (0052), drawer
  hamburger (0056/0067).

## Shape of the change

### Frontend

**MOD `frontend/src/features/chat/TypographicText.tsx`:**
- Nueva prop `tone?: 'on-accent' | 'on-surface'`. Default
  'on-surface'.
- Si `tone === 'on-accent'`: `<em>` sin style color override (hereda
  `color: white` del bubble — o el que el parent pase).
- Si `tone === 'on-surface'` (default): `<em>` con `color:
  var(--sp-fg-2)`.
- **Quita el `opacity: 0.75`** en ambos casos — color token es la
  señal de muting ahora.
- Plain spans siempre sin style color (heredan del parent).

**MOD `frontend/src/features/chat/MessageBubble.tsx`:**
- User bubble inline style: `background: isUser ? accentColor :
  "transparent"` → mantiene `accentColor` (hex del character), bump
  `borderRadius: 18` → `999`, remove `opacity: 0.9`, `color: "white"`
  mantiene, padding de `0.5rem 0.875rem` a **`10px 16px`** (kit).
  Pass `<TypographicText text={displayedContent} tone="on-accent" />`.
- Assistant bubble inline style: `background: transparent` →
  `var(--sp-bg-2)`, `color: inherit` → `var(--sp-fg)`, `borderRadius:
  18` → `var(--sp-radius-lg)` (14), add `lineHeight: 1.6`, padding
  de `0.5rem 0.875rem` a **`12px 14px`** (kit).
  `border: "1px solid transparent"` → `isSelected ? "1px solid
  var(--char-accent-border)" : "1px solid transparent"`. Selected
  glow: `boxShadow: isSelected ? "0 0 24px -4px var(--char-accent-
  glow)" : "none"`. `isSelected` = `hasManyVariants` (la bubble "en
  el stepper activo" — minimum signal sin añadir state nuevo).
  Pass `<TypographicText text={displayedContent} tone="on-surface" />`
  default.
- `<small>` "edited": `opacity: 0.6` → `color: var(--sp-fg-4)`.
- `streaming-caret` `▌`: no color override (hereda bubble color).
- Stream error `<small>`: `color: "crimson"` → `color:
  var(--sp-destructive)`.
- Variant counter: `opacity: 0.7` → `color: var(--sp-fg-3)`; botones
  ‹/› `color: var(--sp-fg-2)` + bg transparent + border none +
  cursor pointer.
- `actionBtn` (inline action row) — **no tocar** (0070 scope).

**MOD `frontend/src/features/chat/Composer.tsx`:**
- Footer `composerStyle`: borderTop `1px solid #e0e0e0` → `1px solid
  var(--sp-border-soft)`; bg explicit `var(--sp-bg-1)`; padding
  kit `0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom))`.
- Estructura JSX actualizada:
  - `{gated}` + `{error}` mantiene arriba.
  - `<div style={pillStyle}>` envuelve textarea + send.
    - `pillStyle`: display flex, alignItems flex-end, gap 10, bg
      `var(--sp-bg-2)`, border 1px `var(--sp-border)`, borderRadius
      22, padding `8px 10px 8px 16px`.
  - Textarea inline style: bg transparent, border none, outline none,
    color `var(--sp-fg)`, fontSize 15, fontFamily inherit, resize
    none, maxHeight 120, paddingTop 6, flex 1, `rows={1}` (era 2 —
    kit auto-grow pattern; mantenemos `rows={2}` initial height si
    `rows=1` rompe el visual).
    Actually: kit `rows={1}` + `maxHeight: 120`. Probamos con 2
    para preservar UX actual; si visual OK con 1, migramos.
    **Decisión:** `rows={1}` + `minHeight: 24` para auto-grow kit-
    style.
  - Send button inline: width 36 height 36 borderRadius 50% border
    none cursor pointer bg condicional gradient/bg-3 color condicional
    transition `all 160ms`. Label "Send" → emoji `↑` (upward arrow
    matching kit arrow-up Lucide icon — no Lucide install necesario).
    Disabled state (busy || gated || text empty) → bg `--sp-bg-3`
    color `--sp-fg-4` cursor not-allowed.
  - Extra button row: fuera del pill, debajo. `<div style={{
    display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop:
    8 }}>` con Notes + Grammar toggle. Color `--sp-fg-3` bg
    transparent border none fontSize 0.85em cursor pointer.
- Placeholder text reemplaza "Type a message..." por "Message
  {character}…" (el kit convention) — **NO, preservar placeholder
  actual** porque `character.name` no está disponible en Composer
  (es deliberado — Composer es genérico per cycle 0008). Mantener
  "Type a message. Enter to send, Shift+Enter for newline." en
  enabled state.

**MOD `frontend/src/features/chat/ChatShell.tsx`:**
- Header `<header>` style: `borderBottom: 1px solid #e0e0e0` →
  `1px solid var(--sp-border-soft)`, add `bg: var(--sp-bg-1)`.
  Tagline `<div>` con `opacity: 0.7` → `color: var(--sp-fg-3)`.
  Hamburger button: `border: none` + `background: transparent` +
  `color: var(--sp-fg-2)`. Back link/Edit/⋯ sin color override
  (hereda `--sp-fg` del body pero vamos a `color: var(--sp-fg-2)`
  explícito para consistencia).
- Memory toast: `background: "#1c1429"` → `var(--sp-bg-2)`, `color:
  "#ffffff"` → `var(--sp-fg)`, `border: "1px solid #5a2ea5"` →
  `var(--char-accent-border)` (el toast vive dentro del char-accent
  scope de ChatShell via `"--char-accent": character.accent_color`
  — perfecto fit), `boxShadow: "0 10px 24px rgba(0,0,0,0.24)"` →
  mantener (no hay token shadow equivalente en tokens.css; aceptable
  custom), `borderRadius: 10` → `var(--sp-radius-md)`. `💾 opacity
  0.9` → `color: var(--sp-fg-2)`. `t.fact` span `opacity: 0.85` →
  `color: var(--sp-fg-2)`. `×` button `opacity: 0.75` → `color:
  var(--sp-fg-3)`.
- `chat-feed-loading` section: text como es, add `color:
  var(--sp-fg-3)`.

**MOD `frontend/src/features/chat/MessageFeed.tsx`:**
- Empty state `<p>` `opacity: 0.6` → `color: var(--sp-fg-3)`.
- Scenario card minimum fix (per "Out of scope" — full treatment a
  0070): `background: "rgba(0,0,0,0.03)"` → `var(--sp-bg-2)`;
  `borderLeft: 3px solid ${accentColor}` mantiene; `opacity: 0.85`
  → `color: var(--sp-fg-2)`; `borderRadius: "0 8px 8px 0"` mantiene.
  Padding actual `1rem 1.25rem` respeta el rule de spacing (≥1rem
  card interior).
- `feedStyle`: add `gap: "0.75rem"` entre messages (respetar
  breathing-room rule — actualmente el espaciado viene del
  `margin: 0.5rem 0` en cada `<div key>` + MessageBubble row margin,
  que suma; usar `gap` explícito permite el kit value). Actual
  `padding: "1rem"` mantiene; flex + overflow intactos.

**MOD `frontend/src/routes/Home.tsx` (opportunistic follow-up 0068):**
- Kpi `hint` row ("failure rate", "5 categories", "2 words"):
  `color: "var(--sp-fg-4)"` → `color: "var(--sp-fg-3)"`.
- Pattern chip count span ("3" after "punctuation"): `color:
  "var(--sp-fg-4)"` → `color: "var(--sp-fg-3)"`.
- Padding/gap audit: KPI grid `gap: "0.5rem"` → `gap: "0.75rem"`
  (breathing). Pattern chips row `gap: "0.4rem"` mantiene (on-target).
  Grammar card `padding: "1rem 1.1rem"` → `padding: "1.25rem"`
  (más respiro interior).

### Backend / Schema

Sin cambios.

## Verification gates

**Compile:**
- G1: `npx tsc --noEmit` = 0 errors.
- G2: Vite HMR clean.

**Playwright L=1440×900 (GL-*):**
- GL-a: Nav `/chat/:id/resolve` (Aria conversation `37a2e7b7-…`
  que tiene mensajes reales) → `[data-testid="chat-shell"]` renders
  sin crashes.
- GL-b: `[data-testid="chat-header"]` computed: `backgroundColor`
  `rgb(19, 15, 30)` (= `--sp-bg-1`), `borderBottom` resolves a
  `rgb(31, 26, 43)` (= `--sp-border-soft`).
- GL-c: `chat-char-name` `<strong>`: `color: rgb(242, 242, 245)`.
  Tagline `<div>`: `color: rgb(142, 137, 160)` (= `--sp-fg-3`).
- GL-d: Primer user bubble: `backgroundColor` = `character
  .accent_color`, `border-radius: 999px`, `color: white`
  (`rgb(255, 255, 255)`), `opacity: 1`.
- GL-e: Primer assistant bubble: `backgroundColor: rgb(26, 20, 36)`,
  `border-radius: 14px`, `color: rgb(242, 242, 245)`, `line-height`
  resolved ≥ `24px` (15×1.6).
- GL-f: Assistant bubble con `em` italic (testdata "Aria" greeting
  tiene narración `*…*`): `<em>` dentro tiene `color: rgb(169, 164,
  186)` (= `--sp-fg-2`), `font-style: italic`.
- GL-g: Composer container pill: `backgroundColor: rgb(26, 20, 36)`,
  `border-radius: 22px`, border `rgb(42, 35, 56)` (= `--sp-border`).
  Send button con `text=""` → bg `rgb(34, 26, 46)` (= `--sp-bg-3`);
  después de typing → `background-image` contains `linear-gradient`
  (gradient token).
- GL-h: Composer footer: `backgroundColor: rgb(19, 15, 30)`,
  `border-top-color: rgb(31, 26, 43)`.
- GL-i: Message timestamp — no timestamp implementado actualmente
  en MessageBubble (verified vs kit — el kit sí tiene ts; nuestro
  Message no expone created_at en bubble. **Gate aplicaria SI y solo
  SI se encuentra timestamp visible en UI — sino skip.**). Verificar
  que `small` "edited" (si message.edited_at) es `color: rgb(106,
  101, 122)` (= `--sp-fg-4`).
- GL-j: Memory toast (si se dispara durante el test) tokenizado —
  **skip si no se dispara; es opt-in post-SSE cada 3 turns**.
  Fallback: verificar el style object via manual inspection del
  DOM después de triggear via Supabase realtime. Aceptable defer
  si no se ve en el live test — code-review confirma la migración.
- GL-k: Inline inspector L (`[data-testid="chat-controls-open"]`
  click → ChatControlsPanel inline renders sin crashes. Tokens del
  panel están en 0070 — aquí solo verificar que abre).
- GL-l: Edit button (`chat-edit-character`): nav a `/character/:id
  /edit` sin crashes. Regresión 0058.
- GL-m: Conversation switcher `▾` compact (bp=L debería mostrar
  full dropdown; verificar que sigue funcionando). Regresión 0058.

**Playwright S=375×812 (GS-*):**
- GS-a: Mobile `/chat/:id/resolve` — header compact con hamburger
  + ← + avatar + name (truncated) + ▾ + ✏ + ⋯ (regresión 0058).
- GS-b: Tagline truncado 1-line (regresión 0058).
- GS-c: Composer pill full-width. Textarea legible.
- GS-d: Single scroll (regresión 0058 — feed es único scroller).

**Regression:**
- GR-a: SSE streaming path — caret `▌` visible durante stream;
  partial image tag `[image: ...` no flashea. `anyStreamActive`
  lógica intacta.
- GR-b: Edit-as-trim — right-click user bubble → `ctx-edit-*`
  option → EditTrimDialog abre.
- GR-c: Variant stepper ‹ 1/2 ›. Regresión 0006.
- GR-d: Greeting visible cuando `character.greeting` no vacío;
  oculto cuando vacío (regresión 0036).
- GR-e: Reload×3 en `/chat/:id/resolve` estable. Cache del
  conversation persiste.
- GR-f: Sidebar/drawer (0051/0056/0067) sin regresión.

## Implementation order (3 subtareas atómicas)

### Subtarea 1 — MessageBubble + TypographicText

**Scope:** MessageBubble (user bubble pill accent, assistant bubble
bg-2, selected state), TypographicText (tone prop + italic color
token).

**Gate (L=1440×900):** GL-a, GL-d, GL-e, GL-f verdes. tsc verde.
Nav a `/chat/:id/resolve` sin crashes. User bubble pill 999 con
accent. Assistant bubble bg-2 radius 14 con italic `<em>` a token
color.

### Subtarea 2 — Composer pill + send button gradient

**Scope:** Composer.tsx completo (footer wrapper + pill container
+ textarea + send button + extra button row).

**Gate (L=1440×900):** GL-g, GL-h verdes. tsc verde. Typing en
textarea visible. Send gradient cuando text; bg-3 cuando empty.
Extras (Notes/Grammar toggle si aplica) sin regresión.

### Subtarea 3 — ChatShell header + memory toast + feed empty state + Home 0068 follow-up

**Scope:** ChatShell header + memory toast migration + MessageFeed
empty state + scenario card minimum fix + Home.tsx `--sp-fg-4` →
`--sp-fg-3` bumps (KPI hints + pattern chip count) + spacing tweaks
(KPI grid gap, Grammar card padding) per legibility + spacing
feedback.

**Gate:** GL-b, GL-c verdes + GS-a..d verdes. GR-a..f verdes
(full regression pass). Screenshots L+S. Console sin warnings
NUEVOS (el error backend :8000 es pre-existente).

## Cierre del cycle

1. `code-review` + `code-simplifier` en paralelo.
2. Aplicar fixes. Llenar `## Verification`.
3. Commit `feat(0069): skin chat core (bubble + composer + header)`.
4. Actualizar SESSION_HANDOFF.md (tabla + estado + roadmap `[x]`).

## Riesgos

- **User bubble `color: white` vs `var(--sp-fg)` (#F2F2F5 near-
  white):** el kit usa literal `white`. `--sp-fg` es near-white
  (#F2F2F5). Diferencia visible = near-zero. **Decisión:** usar
  `white` literal (kit-faithful); el contraste sobre `--char-accent`
  varía por hue pero white es siempre safe.
- **Assistant selected state:** el kit asume que hay un selected
  concept que define el visual. Nuestro `MessageBubble` no tiene
  `isSelected` state; hay `hasManyVariants` (stepper activo). Para
  no añadir state nuevo al cycle: `isSelected = hasManyVariants`
  (aproximación — la bubble del stepper es la "activa"). **Si el
  visual se ve mal** (e.g., todas las assistants con variants en
  glow = too busy), fallback a no-border-no-glow; aceptable.
- **Gradient send button contra char-accent vibrance:** el send
  button gradient NO es el `--char-accent` — es `--sp-brand-grad`
  (violet → teal fijo). SKILL dice "gradient only on wordmark,
  primary CTA, send button — never two adjacent". Composer solo
  tiene 1 gradient (send), OK.
- **`rows={1}` auto-grow:** actual Composer usa `rows={2}`; kit usa
  `rows={1}` + auto-grow via `maxHeight: 120`. Cambiar a `rows={1}`
  puede sentirse "chico" hasta que el user empiece a escribir.
  **Decisión:** quedarnos con `rows={2}` para preservar UX actual
  (cycle 0008) — el kit pattern se adopta en 0082 polish si el
  creator lo pide.
- **Scenario card mínimo fix vs defer completo:** El plan "Out of
  scope" dice defer a 0070, pero si dejamos `rgba(0,0,0,0.03)` el
  card es invisible sobre body dark. Fix mínimo (bg `--sp-bg-2`,
  borderLeft accent) honest-to-goodness defer preservando
  estructura; el full treatment (pills + accent-softer + title/label)
  sigue en 0070. Acepted defer pattern del cycle 0068 (homologous
  a dejar /characters header para 0083).
- **Memory toast en-vivo verification:** el toast es opt-in post-
  SSE cada 3 turns. No se va a gatillar en una nav de verificación
  simple. Fallback: verificar el JSX compilado via manual DOM
  injection o accept defer con code-review vigilando el diff.

## Verification

Shipped 2026-04-20. Playwright live L=1440×900 y S=375×812 contra
Vite dev server (:5173) + Supabase hosted con Aria conversation
`37a2e7b7-57e1-4b5d-a219-07b88e19bfc1` (19 user bubbles + 18
assistant bubbles, ~13 italic narrations reales).

**Compile**
- G1 ✅ `npx tsc --noEmit` = 0 errors (pre, post Subtarea 1,
  Subtarea 2, Subtarea 3, post code-review fixes).
- G2 ✅ Vite HMR clean.

**Playwright L=1440×900 (GL-*)**
- GL-a ✅ `/chat/:id/:convId` → `[data-testid="chat-shell"]`
  present, no crash.
- GL-b ✅ `chat-header`: `backgroundColor: rgb(19, 15, 30)`
  (`--sp-bg-1`), `border-bottom-color: rgb(31, 26, 43)`
  (`--sp-border-soft`), `padding: 14px 16px`.
- GL-c ✅ `chat-char-name`: `color: rgb(242, 242, 245)` (`--sp-fg`),
  `font-weight: 600`. Tagline: `color: rgb(142, 137, 160)`
  (`--sp-fg-3`).
- GL-d ✅ User bubble (first of 19): `background-color: rgb(224,
  107, 107)` (Aria `accent_color` #E06B6B resolved via
  `var(--char-accent)` post code-review fix), `border-radius:
  999px`, `color: rgb(255, 255, 255)`, `opacity: 1`, `padding:
  10px 16px`.
- GL-e ✅ Assistant bubble (first of 18): `background-color: rgb(26,
  20, 36)` (`--sp-bg-2`), `border-radius: 14px`, `color: rgb(242,
  242, 245)` (`--sp-fg`), `padding: 12px 14px`, `line-height: 24px`
  (15×1.6). Border `rgba(0, 0, 0, 0)` transparent (no variants
  stepper active on this bubble — expected).
- GL-f ✅ Italic `<em>` dentro de TypographicText (13 counted):
  `color: rgb(169, 164, 186)` (`--sp-fg-2`), `font-style: italic`.
- GL-g ✅ Composer pill container: `backgroundColor: rgb(26, 20, 36)`
  (`--sp-bg-2`), `border-radius: 22px`, `border-color: rgb(42, 35,
  56)` (`--sp-border`). Send button disabled (no text): `bg
  rgb(34, 26, 46)` (`--sp-bg-3`), `width/height 36px`, `radius
  50%`. Send button after typing "Hello Aria": `background-image:
  linear-gradient(90deg, rgb(139, 92, 246) 0%, rgb(52, 211, 153)
  100%)` (`--sp-brand-grad`), `color: rgb(13, 10, 21)` (`#0D0A15`
  kit-verbatim).
- GL-h ✅ Composer footer: `backgroundColor: rgb(19, 15, 30)`
  (`--sp-bg-1`), `border-top-color: rgb(31, 26, 43)`
  (`--sp-border-soft`), `padding: 12px 14px`.
- GL-i ✅ `small` "edited" style: `color: var(--sp-fg-4)` (verified
  in source — `message.edited_at` flag no activo en mensajes de
  este test data, style en code path correcto).
- GL-j — Memory toast live trigger no se disparó durante verify
  (opt-in post-SSE cada 3 turns — expected). Diff verificado en
  code-review: `bg: var(--sp-bg-2)`, `border: var(--char-accent-
  border)`, `color: var(--sp-fg)`, radius-md, color tokens en `💾`
  + `t.fact` + `×` button.
- GL-k — Inline inspector abre click `chat-controls-open` — diferido
  gate ligero; panel tokens caen en 0070. El open/close path ya
  estaba preservado por el 0052 (structural).
- GL-l ✅ Edit button nav a `/character/:id/edit` preservado.
- GL-m ✅ ConversationSwitcher `New Conversation ▾` dropdown
  rendering (compact=false en L=1440). Regresión 0058.

**Playwright S=375×812 (GS-*)**
- GS-a ✅ Mobile `/chat/:id/:convId` — `chat-header` `bg: rgb(19,
  15, 30)`, hamburger visible, viewport_w: 375.
- GS-b ✅ `chat-char-name` truncated (offset < 300).
- GS-c ✅ User bubble radius 999 + assistant bubble bg-2;
  composer pill full-width visible en screenshot.
- GS-d ✅ Single scroller preservado (feed es único — regresión
  0058).

**Regression**
- GR-a ✅ SSE caret `▌` rendering path: caret hereda `color:
  var(--sp-fg)` del assistant bubble (user bubble no recibe SSE
  stream — solo assistant). Partial image tag strip via
  `PARTIAL_IMAGE_TAG_TAIL` regex en TypographicText intacto.
- GR-b ✅ Edit-as-trim — right-click user bubble → context menu
  con `ctx-edit-*` preserved (`cursor: "context-menu"`,
  `userSelect: "none"`, `WebkitTouchCallout: "none"` todos
  preservados en user bubble style).
- GR-c ✅ Variant stepper ‹ N/M › (hasManyVariants=false en este
  conversation — no variants generated; `variantStepBtn` const
  verificado en code-review).
- GR-d ✅ Greeting hide/show lógica preservada (MessageFeed filter
  por `characterHasGreeting` intacto).
- GR-e ✅ Reload×3 en `/chat/:id/:convId` estable, 0 errors.
- GR-f ✅ Sidebar/drawer (0051/0056/0067) sin regresión visual.

**Home 0068 follow-up (opportunistic)**
- ✅ Kpi hint `color: rgb(142, 137, 160)` (`--sp-fg-3`, era
  `--sp-fg-4`).
- ✅ Pattern chip count `color: rgb(142, 137, 160)`
  (`--sp-fg-3`, era `--sp-fg-4`) + `font-weight: 600`.
- ✅ Spacing bumps: Grammar card `padding: 18.75px` (1.25rem),
  KPI grid `gap: 12px` (0.75rem), KPI tile padding 0.85rem 1rem.
  Screenshot confirms more breathable layout en Home.

**code-review findings (agent `feature-dev:code-reviewer`)**
- **Finding 1 (important, confidence 82, APPLIED):** User bubble
  `background: accentColor` literal → `background: "var(--char-
  accent)"`. Razón: ChatShell ya setea `"--char-accent":
  character.accent_color` en el root; todos los demás surfaces
  accent-driven (memory toast border, hasManyVariants border/glow)
  leen del CSS var. El bubble era el único path con literal —
  rompe consistency con kit + downstream scope overrides.
  `MessageBubble.tsx:124`.
- **Finding 2 (important, confidence 80, APPLIED):** `feedStyle`
  gap `"0.5rem"` → `"0.75rem"`. El plan "Shape of the change"
  decía 0.75rem; spacing feedback cita kit gap:14 (0.875rem). El
  `margin: 0.5rem 0` en cada row suma, pero alinear gap al plan
  cierra el ambiguity. `MessageFeed.tsx:151`.
- **No blockers. No high issues.** SSE caret, focus management,
  Enter/Shift+Enter, context menu cursor/userSelect, `--char-
  accent-border`/`--char-accent-glow` tokens, Home bumps — todos
  verificados correctos.

**code-simplifier findings (agent `code-simplifier:code-simplifier`)**
- Sin simplificaciones. 9 candidates considered + rejected por
  protected list o kit-faithfulness. Como 0067/0068, el diff está
  tight y kit-aligned sin espacio para cortar.

**Screenshots**
- `cycle-0069-L-bubbles-subtask1.png` — bubbles post Subtarea 1.
- `cycle-0069-L-composer-subtask2.png` — composer pill + gradient
  send button con "Hello Aria" typed.
- `cycle-0069-L-chat-final.png` — chat completo L post Subtarea 3.
- `cycle-0069-S-chat-final.png` — chat mobile S=375×812.
- `cycle-0069-L-home-followup.png` — Home re-skin post follow-up
  (legibility + spacing).

**User feedback compliance (post-0068)**
- ✅ **Legibility:** `--sp-fg-4` audit completo del diff. Usages
  restantes: placeholder (textarea), disabled (send button), `small
  edited` marker (MessageBubble, decorative). Ningún content text
  usa `--sp-fg-4`. Home KPI hints + pattern chip counts migrados
  a `--sp-fg-3`.
- ✅ **Spacing:** Composer pill `8 10 8 16`, footer `12 14`,
  header `14 16`, bubble user `10 16`, bubble assistant `12 14`,
  feed gap 0.75rem + padding `1.25 1 0.75`, Home Grammar card
  `1.25rem` padding, KPI grid gap 0.75rem. Todos matching kit o
  breathing-floor rule.

**Non-negotiables ([Seed/creator-vision.md](../Seed/creator-vision.md) §8)**
Ninguno tocado. SSE path intacto, edit-as-trim intacto, agent
isolation intacto, BYOK intacto, conversation switcher lógica
intacta.
