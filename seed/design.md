# Design — StoryPlots iOS

> Contrato visual: mapping de los tokens del web a `Theme` de Swift.
> Autoridad concreta: `base/frontend/src/styles/tokens.css` (líneas 65–274).
> Este archivo es thin a propósito — define principios visuales + mapping. Los detalles de comportamiento UX viven en `ux.md`; los detalles de stack en `tech-stack.md`.

---

## 1. Autoridad y precedencia

1. **`base/frontend/src/styles/tokens.css`** — fuente de verdad para colores, tipografía, escala, radii, spacing, shadows, motion.
2. Este `design.md` — formaliza el mapping `tokens.css` → Swift `Theme`.
3. Si `tokens.css` y este archivo divergen, **gana tokens.css**. Este archivo se actualiza para igualar.

**Excepción**: si una decisión iOS requiere desviarse de tokens.css por motivos de native feel (e.g. radius distinto para sheets nativos iOS), se documenta acá con justificación y se mantiene como divergencia explícita. Nunca silenciosa.

---

## 2. Estructura del `Theme` en Swift

Un único enum namespace, sin instancias:

```swift
enum Theme {
    enum Color   { /* color tokens */ }
    enum Spacing { /* spacing scale */ }
    enum Radius  { /* radii */ }
    enum FontStyle { /* type ramp + semantic styles */ }
    enum Motion  { /* animation presets + durations */ }
    enum Shadow  { /* elevation */ }
}
```

Vivido en `storyplots/DesignSystem/Theme.swift` (o equivalente). Asset catalog complementa con colores que necesitan light/dark variants cuando se introduzca light mode (ver `ux.md` §14).

---

## 3. Colores — mapping completo

### 3.1 Surfaces

| Token CSS | Hex | Swift | Uso |
|---|---|---|---|
| `--sp-bg` | `#0F0F10` | `Theme.Color.bg` | Background app, fondo de pantalla. |
| `--sp-bg-1` | `#161617` | `Theme.Color.bg1` | Headers stickies, lift muy sutil. |
| `--sp-bg-2` | `#1C1C1E` | `Theme.Color.bg2` | Cards elevadas, modal sheets, character bubble. |
| `--sp-bg-3` | `#252527` | `Theme.Color.bg3` | Inputs, second-level cards, hover. |
| `--sp-bg-inset` | `#0A0A0B` | `Theme.Color.bgInset` | Inset interior de textarea / search. |
| `--sp-overlay` | `rgba(15,15,16,0.72)` | `Theme.Color.overlay` | Scrim detrás de modales (no sheets nativos). |

### 3.2 Borders / hairlines

| Token CSS | Hex | Swift | Uso |
|---|---|---|---|
| `--sp-border` | `#57534E` | `Theme.Color.border` | Hairlines normales. |
| `--sp-border-soft` | `#44403C` | `Theme.Color.borderSoft` | Group dividers, separators. |
| `--sp-border-strong` | `#78716C` | `Theme.Color.borderStrong` | Focused, hovered. |

### 3.3 Foreground (texto)

| Token CSS | Hex | Swift | Uso |
|---|---|---|---|
| `--sp-fg` | `#F2F1ED` | `Theme.Color.fg` | Primary, headings, dialogue. |
| `--sp-fg-1` | `#D8D5CC` | `Theme.Color.fg1` | Body copy. |
| `--sp-fg-2` | `#B0AAA0` | `Theme.Color.fg2` | Secondary, narration italic. |
| `--sp-fg-3` | `#928D82` | `Theme.Color.fg3` | Muted, section labels, hints. |
| `--sp-fg-4` | `#6E695F` | `Theme.Color.fg4` | Placeholders, disabled, timestamps. |

### 3.4 Brand

| Token CSS | Hex | Swift | Uso |
|---|---|---|---|
| `--sp-brand-1` | `#F5B547` | `Theme.Color.brand1` | Warm amber (signature). |
| `--sp-brand-2` | `#FF7B3D` | `Theme.Color.brand2` | Sunset orange (gradient end). |
| `--sp-brand-grad` | `linear 135° brand1→brand2` | `Theme.Color.brandGradient: LinearGradient` | CTAs primarios, wordmark, accents importantes. |
| `--sp-fg-on-brand` | `#000000` | `Theme.Color.fgOnBrand` | Texto sobre fondo brand (CTAs amber). |

### 3.5 Semantic

| Token CSS | Hex | Swift | Uso |
|---|---|---|---|
| `--sp-destructive` | `#E04747` | `Theme.Color.destructive` | Delete, erase, error icons. |
| `--sp-destructive-soft` | `rgba(224,71,71,0.15)` | `Theme.Color.destructiveSoft` | Backgrounds destructive (subtle). |
| `--sp-success` | `#2ECC71` | `Theme.Color.success` | Confirmations, success states. |
| `--sp-success-soft` | `rgba(46,204,113,0.15)` | `Theme.Color.successSoft` | Pill backgrounds, badges. |
| `--sp-warning` | `#F59E0B` | `Theme.Color.warning` | Warnings, strikes en rewrite gate. |
| `--sp-warning-soft` | `rgba(245,158,11,0.15)` | `Theme.Color.warningSoft` | Backgrounds suaves. |

### 3.6 Character accent presets

16 colores predefinidos. Mapping directo a hex (sin transformación). El usuario puede elegir entre estos o un custom (`ColorPicker` nativo).

| Token CSS | Hex | Swift |
|---|---|---|
| `--sp-accent-violet` | `#8B5CF6` | `Theme.Color.AccentPreset.violet` |
| `--sp-accent-indigo` | `#6366F1` | `Theme.Color.AccentPreset.indigo` |
| `--sp-accent-blue` | `#3B82F6` | `Theme.Color.AccentPreset.blue` |
| `--sp-accent-sky` | `#0EA5E9` | `Theme.Color.AccentPreset.sky` |
| `--sp-accent-teal` | `#14B8A6` | `Theme.Color.AccentPreset.teal` |
| `--sp-accent-green` | `#2ECC71` | `Theme.Color.AccentPreset.green` |
| `--sp-accent-lime` | `#84CC16` | `Theme.Color.AccentPreset.lime` |
| `--sp-accent-amber` | `#F59E0B` | `Theme.Color.AccentPreset.amber` |
| `--sp-accent-bronze` | `#C9A34C` | `Theme.Color.AccentPreset.bronze` |
| `--sp-accent-orange` | `#F97316` | `Theme.Color.AccentPreset.orange` |
| `--sp-accent-red` | `#E04747` | `Theme.Color.AccentPreset.red` |
| `--sp-accent-pink` | `#EC4899` | `Theme.Color.AccentPreset.pink` |
| `--sp-accent-rose` | `#F43F5E` | `Theme.Color.AccentPreset.rose` |
| `--sp-accent-fuchsia` | `#D946EF` | `Theme.Color.AccentPreset.fuchsia` |
| `--sp-accent-slate` | `#94A3B8` | `Theme.Color.AccentPreset.slate` |
| `--sp-accent-stone` | `#A8A29E` | `Theme.Color.AccentPreset.stone` |

### 3.7 Char accent (runtime, per-character)

Cada character lleva un color de acento (`charAccent` resuelto desde un preset o custom hex). Cuatro derivados se computan al vuelo:

```swift
struct CharAccent {
    let base: Color
    var soft: Color   { base.opacity(0.18) }
    var softer: Color { base.opacity(0.10) }
    var border: Color { base.opacity(0.55) }
    var glow: Color   { base.opacity(0.40) }
}
```

(El web usa `color-mix(in oklab, ...)`, que mezcla con transparente — opacity simple es equivalente práctico para colores planos sobre fondo sólido. Si en algún momento se nota diferencia visible, refinamos con OKLab mix manual.)

### 3.8 Default char accent

Cuando no hay character activo (e.g. Home tab, Settings), `charAccent.base = Theme.Color.brand1`. **No** dejar violet (legacy) como default — eso fue una migración explícita del web.

---

## 4. Tipografía

### 4.1 Familias

| Token CSS | Uso | Swift |
|---|---|---|
| `--sp-font` (SF Pro Text) | Body, UI, chat | `Theme.FontStyle.body`, `.callout`, etc. usan `.system` que en iOS resuelve a SF Pro Text. |
| `--sp-font-display` (SF Pro Display) | Headings ≥ 22pt | Apple usa SF Pro Display automáticamente para `.title`, `.title2`, `.largeTitle` cuando el tamaño cruza el threshold. **No** se elige manualmente. |
| `--sp-font-rounded` (SF Pro Rounded) | Reserved (no usado por defecto) | `.system(.body, design: .rounded)` si se necesita. |
| `--sp-font-mono` | Code, IDs | `.system(.body, design: .monospaced)`. |

iOS nativamente usa SF Pro. **No** se necesita registrar custom fonts. Tampoco hay que enviar OTFs en el bundle.

### 4.2 Escala — mapping a Dynamic Type

El web tiene 8 tamaños fijos. iOS usa text styles que escalan con Dynamic Type. Mapping pragmático:

| Token CSS | px | iOS text style | Cuándo |
|---|---|---|---|
| `--sp-text-xs` | 12 | `.caption2` (11pt @ default) | Timestamps. |
| `--sp-text-sm` | 13 | `.caption` (12pt @ default) | Chips, meta. |
| `--sp-text-base` | 16 | `.body` (17pt @ default) | Body, chat. |
| `--sp-text-md` | 16 | `.body` | Inputs, list titles. |
| `--sp-text-lg` | 18 | `.headline` (17pt semibold) o `.title3` (20pt) | Subhead. Usar `.headline` para inline emphasis, `.title3` para separación. |
| `--sp-text-xl` | 22 | `.title2` (22pt) | Section title. |
| `--sp-text-2xl` | 28 | `.title` (28pt) | Screen title. |
| `--sp-text-3xl` | 34 | `.largeTitle` (34pt) | Marketing only. |

**Por qué Dynamic Type en vez de fixed pt:**
- Accessibility de fábrica.
- Apple HIG lo exige para conformance.
- Los valores @ default size son MUY cerca de los del web (16→17, 22→22, 28→28, 34→34) — visualmente equivalente para usuario típico.
- Cuando un user activa Larger Text en Settings iOS, la app responde automáticamente.

**Excepción**: chat bubble text se queda en `.body` siempre. Si el user pidió Larger Text accessibility size, los bubbles crecen — es deseado.

### 4.3 Weights

| Token CSS | Valor | Swift |
|---|---|---|
| `--sp-weight-regular` | 400 | `.regular` |
| `--sp-weight-medium` | 500 | `.medium` |
| `--sp-weight-semibold` | 600 | `.semibold` |
| `--sp-weight-bold` | 700 | `.bold` |

### 4.4 Line heights

Apple maneja line-height automático según text style. **No** se override salvo en cuerpos largos donde se nota:

| Token CSS | Valor | iOS approach |
|---|---|---|
| `--sp-lh-tight` | 1.2 | `lineSpacing(-2)` aprox., o no override (system default ya tight para headings). |
| `--sp-lh-body` | 1.5 | default para body. |
| `--sp-lh-loose` | 1.7 | `lineSpacing(4)` para bloques narrativos largos. |

### 4.5 Tracking (letter-spacing)

| Token CSS | Uso | iOS |
|---|---|---|
| `--sp-tracking-caps` 0.08em | Section labels uppercase | `.tracking(1)` aprox (depende de size). |
| `--sp-tracking-tight` -0.01em | Large headings | `.tracking(-0.2)` aprox. |

### 4.6 Estilos semánticos (paralelo a las clases `.sp-h1`..`.sp-narration` del web)

```swift
extension Theme.FontStyle {
    static let h1          = Font.largeTitle.weight(.bold)
    static let h2          = Font.title.weight(.bold)
    static let h3          = Font.title2.weight(.semibold)
    static let subhead     = Font.title3.weight(.semibold)
    static let body        = Font.body
    static let meta        = Font.subheadline
    static let timestamp   = Font.caption2
    static let sectionLabel = Font.caption.weight(.semibold)       // + tracking + uppercase via .textCase
    static let narration   = Font.body.italic()
    static let dialogue    = Font.body
    static let mono        = Font.body.monospaced()
}
```

Estilos derivados (color + tracking + case) se aplican como ViewModifier:

```swift
extension Text {
    func sectionLabel() -> some View {
        self.font(Theme.FontStyle.sectionLabel)
            .tracking(1)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Color.fg3)
    }
}
```

---

## 5. Radii

| Token CSS | px | Swift | Uso |
|---|---|---|---|
| `--sp-radius` | 14 | `Theme.Radius.card = 14` | THE radius — buttons, inputs, cards, bubbles, modals. |
| `--sp-radius-sheet` | 20 | `Theme.Radius.sheet = 20` | Solo si se renderiza una sheet custom. **Sheets nativos iOS ya tienen su propio radio**, no se override. |
| `--sp-radius-pill` | 999 | `Theme.Radius.pill = .infinity` (via `Capsule()`) | Toggles, progress, scrollbar — usar `Capsule()` directamente. |

**One-radius system**: 14pt para casi todo (la "signature" del web). Avatars son círculos completos (`Circle()`). Action chips redondos.

Anti-pattern: agregar otros valores intermedios (8, 10, 12). El sistema es 14 o nada (excepto sheet/pill).

---

## 6. Spacing

8-pt scale con un nudge de 4:

| Token CSS | px | Swift |
|---|---|---|
| `--sp-space-0` | 0 | `Theme.Spacing.s0 = 0` |
| `--sp-space-1` | 4 | `Theme.Spacing.s1 = 4` |
| `--sp-space-2` | 8 | `Theme.Spacing.s2 = 8` |
| `--sp-space-3` | 12 | `Theme.Spacing.s3 = 12` |
| `--sp-space-4` | 16 | `Theme.Spacing.s4 = 16` (screen edge padding) |
| `--sp-space-5` | 20 | `Theme.Spacing.s5 = 20` |
| `--sp-space-6` | 24 | `Theme.Spacing.s6 = 24` (section spacing) |
| `--sp-space-8` | 32 | `Theme.Spacing.s8 = 32` |
| `--sp-space-10` | 40 | `Theme.Spacing.s10 = 40` |
| `--sp-space-12` | 48 | `Theme.Spacing.s12 = 48` |

**Anti-pattern**: `.padding(.horizontal, 17)`. Si una vista necesita un valor que no está en la escala, primero preguntá si el diseño está bien — usualmente la respuesta es "redondear a 16 o 20".

**Edge padding default**: `Theme.Spacing.s4` (16pt) — coincide con el web y con HIG iPhone.

---

## 6.5. Materials & Liquid Glass (iOS 26)

iOS 26 introduce **Liquid Glass** como design language nativo del sistema. Es la palanca principal de polish nativo de este app — bien usada, eleva la sensación "modern app, well-polished" sin esfuerzo de animaciones custom.

**Principio**: usar materials nativos en **chrome del sistema** (nav bars, tab bars, sheets, action chips, image viewer overlays) y dejar **tokens sólidos** para áreas de **legibilidad sostenida** (message bubbles, composer text, form fields).

### 6.5.1 Materials disponibles en SwiftUI iOS 26

| Material | Cuándo |
|---|---|
| `.ultraThinMaterial` | Más translúcido. Tab bar, status overlays. |
| `.thinMaterial` | Action chips elevados sobre contenido (regenerate, fork buttons). |
| `.regularMaterial` | Nav bars, sheet headers, default chrome. |
| `.thickMaterial` | Cards elevadas con contenido importante detrás. |
| `.ultraThickMaterial` | Image viewer fullscreen overlay durante zoom. |
| `.bar` | Bar-specific (specialized para toolbar/tab bar; iOS resuelve correcto). |

### 6.5.2 Donde usar materials (PRO)

| Surface | Pattern | Por qué |
|---|---|---|
| **Navigation bars** | `.toolbarBackground(.regularMaterial)` + `.toolbarBackgroundVisibility(.visible)` | Title flota sobre contenido sin línea dura; profundidad real. |
| **Tab bar** | Nativo iOS 26 lo da con `.glassEffect()` automático (cuando aplica) | Translucent sobre chat content; scroll-aware blur. |
| **Sheets — grabber + header** | Por defecto en iOS 26 los detents nativos usan materials. **No override.** | Sheets web-style pesadas se ven forastero; los nativos respiran. |
| **Action chips flotantes** | `.background(.thinMaterial, in: Capsule())` | Botones encima de bubbles (regenerate, fork) sin pelear con el char-accent. |
| **Image viewer fullscreen scrim** | `.background(.ultraThickMaterial)` durante zoom | Zoom transition se siente "del sistema". |
| **Splash / sign-in card** | Card con `.thinMaterial` sobre fondo gradient amber | Primera impresión "modern app" inmediata. |
| **Settings rows agrupadas** | `Form { Section { } }` nativo iOS 26 ya usa materials internamente. **No customizar.** | Forma idiomática gratis. |
| **Long-press context menu preview** | Sistema lo da con materials; **no override.** | Apple lo resuelve mejor que cualquier custom. |
| **Pull-to-refresh indicator** | `.refreshable` nativo, sin custom | Material respeto + haptic. |

### 6.5.3 Donde NO usar materials (CRÍTICO)

| Surface | Por qué |
|---|---|
| **Message bubbles** (user + character) | Texto necesita contraste alto sostenido. Material reduce legibilidad sobre scroll de contenido variado. Usar `Theme.Color.bg2`/`bg3` sólido. |
| **Composer text field** | Tipear sobre material translúcido jittea. Usar `Theme.Color.bg3` sólido. |
| **Form fields editables** (sliders, pickers internos) | Mismo razonamiento. Sólido. |
| **Tokens semánticos como background completo** (destructive/success/warning rows) | El color debe ser el mensaje. Material lo diluye. Sólido con color semántico. |
| **Iconos sobre fondo coloreado** (e.g. avatar generated image fullscreen) | Diluye contraste. Mantener iconos sobre sólido. |

### 6.5.4 `.glassEffect()` específico

iOS 26 introduce `.glassEffect()` modifier para elementos chrome:

```swift
// Elemento que adopta el efecto Liquid Glass completo del sistema
.glassEffect()

// Variante con tinting
.glassEffect(.regular.tint(Theme.Color.brand1.opacity(0.1)))
```

Cuándo usarlo (verificable en docs Apple via context7 antes de implementar):
- Tab bar floating items.
- Capsule chips en chrome (filter pills, time-range selectors).
- Custom toolbar accessories.

**Anti-pattern**: aplicar `.glassEffect()` a contenido del cuerpo de pantalla. Es para chrome.

### 6.5.5 Ejemplos código (referencia)

**Navigation bar con material:**
```swift
NavigationStack {
    ChatView()
        .toolbar {
            ToolbarItem(placement: .principal) { CharacterHeaderTitle() }
        }
        .toolbarBackground(.regularMaterial, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
}
```

**Action chip flotante sobre chat:**
```swift
Button { regenerate() } label: {
    Label("Regenerate", systemImage: "arrow.clockwise")
}
.padding(.horizontal, Theme.Spacing.s3)
.padding(.vertical, Theme.Spacing.s2)
.background(.thinMaterial, in: Capsule())
.foregroundStyle(Theme.Color.fg1)
```

**Sign-in card con glass sobre gradient:**
```swift
ZStack {
    LinearGradient(
        colors: [Theme.Color.brand1.opacity(0.25), Theme.Color.bg],
        startPoint: .top, endPoint: .bottom
    )
    .ignoresSafeArea()
    
    VStack(spacing: Theme.Spacing.s5) {
        // ... fields ...
    }
    .padding(Theme.Spacing.s6)
    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
    .padding(Theme.Spacing.s4)
}
```

### 6.5.6 Reduce Transparency accessibility

iOS permite al usuario activar "Reduce Transparency" — el sistema **automáticamente** sustituye los materials por sólidos. **No** necesitamos branchear el código; usar materials siempre, dejar que el sistema resuelva. Verificable visualmente con Accessibility Inspector en Xcode.

### 6.5.7 Verificación visual

Cada plan que toca una surface con material debe incluir como subtask:
- `RenderPreview` en modo default → snapshot con material.
- `RenderPreview` con `Reduce Transparency` activado → snapshot con sólido equivalente.
- Confirmar que legibilidad y jerarquía se mantienen en ambos.

---

## 7. Shadows / elevación

iOS dark mode tradicionalmente prefiere **elevación por background**, no por sombra. Las sombras existen pero suaves.

| Token CSS | Swift |
|---|---|
| `--sp-shadow-sm` | `Theme.Shadow.sm = (color: .black.opacity(0.4), radius: 1, y: 1)` |
| `--sp-shadow-md` | `Theme.Shadow.md = (color: .black.opacity(0.4), radius: 12, y: 4)` |
| `--sp-shadow-lg` | `Theme.Shadow.lg = (color: .black.opacity(0.55), radius: 40, y: 16)` |
| `--sp-shadow-glow` | "Glow" character — anillo con `--char-accent-glow`. En iOS: `.shadow(color: charAccent.glow, radius: 12)` en avatar de chat header. |
| `--sp-shadow-ring` | Halo más grande, usado en streaming/active states. `.shadow(color: charAccent.glow, radius: 24, y: 0)`. |

Helper:
```swift
extension View {
    func elevation(_ level: Theme.Shadow.Level) -> some View {
        let s = Theme.Shadow.preset(level)
        return self.shadow(color: s.color, radius: s.radius, x: 0, y: s.y)
    }
}
```

---

## 8. Motion

### 8.1 Curvas

| Token CSS | Swift |
|---|---|
| `--sp-ease` `cubic-bezier(0.2, 0.8, 0.2, 1)` | `.snappy` (system iOS spring, prácticamente equivalente). |
| `--sp-ease-in` `cubic-bezier(0.4, 0, 1, 1)` | `.easeIn`. |
| `--sp-ease-out` `cubic-bezier(0, 0, 0.2, 1)` | `.easeOut`. |

### 8.2 Durations

| Token CSS | ms | Swift |
|---|---|---|
| `--sp-duration-fast` | 120 | `Theme.Motion.fast = 0.12` |
| `--sp-duration-base` | 200 | `Theme.Motion.base = 0.20` |
| `--sp-duration-slow` | 320 | `Theme.Motion.slow = 0.32` |

### 8.3 Animation presets en `Theme.Motion`

```swift
extension Theme.Motion {
    static let snappy   = Animation.snappy(duration: 0.4)              // default UI
    static let bouncy   = Animation.bouncy(duration: 0.5, extraBounce: 0.15)
    static let smooth   = Animation.smooth(duration: 0.45)
    static let pop      = Animation.spring(response: 0.35, dampingFraction: 0.7)
    static let gentle   = Animation.spring(response: 0.5, dampingFraction: 0.9)
    static let fastEase = Animation.easeOut(duration: fast)
    static let baseEase = Animation.easeOut(duration: base)
}
```

(Reaparece la misma tabla que ux.md §10. Acá vive la implementación; ux.md vive el uso.)

### 8.4 Cuándo usar cada uno

| Caso | Preset |
|---|---|
| Sheet system | system default (no override) |
| Token aparece en streaming | `.fastEase` aplicado al height |
| Bubble entra | `.snappy` |
| Send button aparece | `.pop` |
| Toast aparece y se va | `.snappy` |
| Matched geometry character → chat | `.smooth` |
| Streaming bubble cierra | `.gentle` |
| Rewrite gate shake | sequence custom |

---

## 9. SF Symbols

iOS provee miles de iconos coherentes con el sistema. Reglas:

1. **Default**: usar SF Symbols. Variant `.fill` para activos, plain para inactivos.
2. **Apple Symbols 5+** (con iOS 17+) trae weight + design + scale modificadores. Se aplica `.font(.system(size: ..., weight: .semibold))` o `.symbolRenderingMode(.hierarchical)`.
3. **Iconos custom** solo si:
   - No hay SF Symbol que sirva (raro).
   - Es un brand mark (wordmark StoryPlots, mark).
   - El icon es decorativo de marketing, no de UI.
4. **Custom icons** en Assets como SVG o template PDF. Color via `.foregroundStyle()`.

### Mapping inicial (iconos clave del web → SF Symbol)

| Web (lucide-react) | SF Symbol |
|---|---|
| `Send` | `arrow.up.circle.fill` |
| `MessageSquare` / `MessageCircle` | `bubble.left.fill` |
| `User` / `Users` | `person.fill` / `person.2.fill` |
| `Settings` / `Cog` | `gearshape.fill` |
| `Plus` | `plus` |
| `Trash` | `trash` |
| `Edit` / `Pencil` | `pencil` |
| `Copy` | `doc.on.doc` |
| `Volume2` | `speaker.wave.2.fill` |
| `Image` | `photo` |
| `Mic` | `mic.fill` |
| `Search` | `magnifyingglass` |
| `MoreHorizontal` | `ellipsis` |
| `Check` | `checkmark` |
| `X` (close) | `xmark` |
| `ChevronRight` | `chevron.right` |
| `Refresh` | `arrow.clockwise` |
| `Share` | `square.and.arrow.up` |
| `Bookmark` | `bookmark.fill` |
| `Heart` | `heart.fill` |
| `Star` | `star.fill` |

(Esto es un punto de partida; cuando un plan necesite un icon nuevo, se agrega a esta tabla.)

---

## 10. Dark mode default + Light mode futuro

- **Dark default**: tokens están hechos para dark. Asset catalog inicialmente sin variants — cada color resuelve directo al hex dark.
- **Cuando entre light mode** (fase 2, según creator-vision §8.1):
  - Migrar colores semánticos a asset catalog con variants Any/Dark/Light.
  - Mantener los hex CURRENT como variant Dark.
  - Decidir Light palette: probablemente fg/bg swap + ajustes en bg-1/2/3 hacia near-whites neutros.
  - Brand 1/2 se mantienen idénticos (amber se ve bien en ambos modos).
  - Char accent presets se mantienen idénticos.

Mientras no entre light mode, el app declara `.preferredColorScheme(.dark)` en root para forzar dark independientemente del system setting.

---

## 11. Anti-patterns visuales

1. **Hardcodear hex en código de view**. Siempre `Theme.Color.xxx`. Si necesitás un color que no existe en el theme, primero pensá si tu diseño está bien.
2. **Mixing system fonts con custom**. SF Pro nativo cubre todo. Si una pantalla usa Avenir o cualquier otra, error.
3. **Sombras pesadas en dark mode**. Las del token son sutiles a propósito.
4. **Bordes para todo**. iOS usa elevation > borders. Border-soft solo en list separators idiomáticos.
5. **Iconos custom donde hay SF Symbol equivalente**.
6. **Radii distintos al sistema 14/sheet/pill**. Si necesitás otro radius, hay algo mal.
7. **Espacios fuera de la escala**. 16 vs 17 no es decisión libre.
8. **Char accent que se "pierde"** porque la app está en una pantalla sin character activo y el usuario ve amber genérico. Eso es **correcto** — char accent solo en chat/character scope.

---

## 12. Implementación inicial

Cuando se cree `Theme.swift`, este archivo es la fuente. Cada constante tiene comment apuntando al token CSS original:

```swift
extension Theme.Color {
    /// `--sp-bg` — primary app background, neutral near-black.
    static let bg = Color(hex: 0x0F0F10)
    
    /// `--sp-bg-2` — elevated cards, modal sheets, character bubble.
    static let bg2 = Color(hex: 0x1C1C1E)
    
    // ...
}
```

Una sola fuente de verdad significa: cuando `tokens.css` cambia, este archivo y `Theme.Color` se actualizan en el mismo commit. **No** se actualiza uno sin el otro.

---

## 13. Verificación

Visual diff entre web y iOS se verifica:
1. **Snapshot tests** de pantallas clave (Home, Chat, Settings, CharacterEdit) via Xcode MCP `RenderPreview`.
2. **Side-by-side** en revisiones: levantar el web (`cd base/frontend && pnpm dev`) en un browser + correr el preview iOS, comparar visualmente.
3. **Playwright** del web vivo para casos puntuales (animación específica, color en hover).

No se exige paridad pixel-perfecta. Se exige **mismos tokens, mismos principios, sensación coherente**. iOS gana cuando el native feel pide divergir.

---

## 14. Decisiones marcadas `[REVIEW]`

1. Light mode timing — confirmar fase 2 vs day-1.
2. Custom typeface (probablemente no — SF Pro cubre).
3. OKLab mixing vs simple opacity para char accent derivados — actualizar si visible.
4. Bundle de iconos custom (wordmark, mark) en Assets — confirmar paths.
5. Asset catalog colors vs Swift constants — decisión técnica al implementar `Theme.Color`.

Ninguno bloquea el comienzo de implementación si arrancamos con `Theme.Color` como Swift constants + dark only.
