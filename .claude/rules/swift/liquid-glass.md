---
paths:
  - "**/*.swift"
---

# Liquid Glass & Materials — StoryPlots iOS

> Loads when editing any Swift file. Defines materials usage per `seed/design.md` §6.5 and `seed/ux.md` §3.5.
> iOS 26 target — use native materials wherever the system provides chrome.

## Where to use materials (PRO)

| Surface | Material | SwiftUI |
|---|---|---|
| Navigation bar | `.regularMaterial` | `.toolbarBackground(.regularMaterial, for: .navigationBar)` |
| Tab bar | Nativo iOS 26 — `.glassEffect()` automático | No override |
| Sheet grabber + header | Sistema nativo | No override de detents (`.medium`/`.large`/`.fraction(_)`) |
| Action chips flotantes | `.thinMaterial` | `.background(.thinMaterial, in: Capsule())` |
| Image viewer fullscreen scrim | `.ultraThickMaterial` | Durante pinch zoom |
| Sign-in card | `.thinMaterial` | Sobre gradient amber |
| Settings rows | `Form { Section { } }` nativo | No override |
| Long-press context menu | Sistema con materials | No override |
| Pull-to-refresh | `.refreshable` nativo | No override |

## Where NOT to use materials (CRÍTICO)

| Surface | Por qué |
|---|---|
| Message bubbles (user + character) | Texto necesita contraste alto sostenido. Usar `Theme.Color.bg2`/`bg3` sólido. |
| Composer text field | Typing sobre material translúcido jittea. Usar sólido. |
| Form fields editables | Sólido. |
| Tokens semánticos como bg | El color es el mensaje. Sólido. |

## Patterns idiomáticos

### Nav bar con material
```swift
NavigationStack { ChatView() }
    .toolbarBackground(.regularMaterial, for: .navigationBar)
    .toolbarBackgroundVisibility(.visible, for: .navigationBar)
```

### Action chip flotante
```swift
Button { regenerate() } label: { Label("Regenerate", systemImage: "arrow.clockwise") }
    .padding(.horizontal, Theme.Spacing.s3)
    .padding(.vertical, Theme.Spacing.s2)
    .background(.thinMaterial, in: Capsule())
```

### `Theme.Material` namespace (definido en Theme.swift)
```swift
extension Theme {
    enum Material {
        static let navBar: SwiftUI.Material = .regularMaterial
        static let chip: SwiftUI.Material = .thinMaterial
        static let viewerOverlay: SwiftUI.Material = .ultraThickMaterial
        static let sheetCard: SwiftUI.Material = .thinMaterial
    }
}
```

## Reduce Transparency

El sistema sustituye materials por sólidos cuando el user activa Reduce Transparency en Accessibility. **No** branchear en código. Verificar visualmente en `RenderPreview` con la setting toggleada.

## Anti-patterns

- ❌ Custom blur con `BlurView` envolviendo SwiftUI cuando hay `.thinMaterial` que cubre el caso.
- ❌ Material aplicado a contenido del cuerpo de pantalla (es para chrome).
- ❌ Hardcoded `Color.black.opacity(0.5)` como overlay cuando existe el material apropiado.
- ❌ Override de `.sheet()` detents para "mejorar" el grabber. El sistema lo hace mejor.

## Verificación

Cada plan que toca una surface con material debe incluir:
- `RenderPreview` con material default.
- `RenderPreview` con Reduce Transparency ON.
- Snapshot diff documentado en el plan.
