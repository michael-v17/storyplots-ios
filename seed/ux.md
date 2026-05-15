# UX — StoryPlots iOS

> Patrones UX, navegación, gestos, animaciones y mapping de surfaces del web a iOS nativo.
> Inputs: `creator-vision.md`, `tech-stack.md`, código real de `base/frontend/`, observación opcional via Playwright.
> Alcance: **iPhone únicamente**. Sin iPad ni Mac. Sin responsive multi-tamaño — solo size classes regular/compact estándar iPhone.

---

## 1. Principios

1. **Native first, paridad después.** Si una pantalla del web "tal cual" se siente forastera en iOS, gana la versión iOS. Documentar la divergencia acá.
2. **Gesto antes de botón.** Donde el sistema operativo espera un gesto (swipe-back, long-press, pinch), usarlo. Botones solo cuando el gesto sería ambiguo.
3. **El sistema operativo provee mucho gratis** — Dynamic Type, dark mode, haptics, VoiceOver. No reinventar nada que el sistema haga, salvo razón muy fuerte.
4. **Una cosa a la vez.** En cada pantalla queda claro cuál es la acción primaria. Acciones secundarias retroceden visualmente.
5. **Loading nunca es spinner solitario.** Skeleton, shimmer, o estado vacío con copy. El spinner solo aparece cuando la operación es breve y atómica (segundos, no minutos).
6. **Animación con significado.** Cada transición comunica una relación (este detail vino de esta card; este sheet apareció desde la nada y se va a la nada). Sin animaciones decorativas que no informen.

---

## 2. Information architecture

> **Updated 2026-05-15 per ARCH-001 in open-questions.md §1.x.** The previous
> 3-tab decision was reverted by the creator after the live audit revealed
> section-parity gaps with the web. The new design uses `NavigationSplitView`
> so the wordmark is permanently visible and the sidebar mirrors the web's
> shell while staying iOS-native.

`NavigationSplitView` con **sidebar** (iPad) / **drawer** (iPhone). En iPhone
se abre via swipe-from-edge o el botón hamburguesa en el `topBarLeading`.
Mismo patrón nativo que Apple Mail, Files, Reminders, Photos en iPad.

```
┌─────────────┬────────────────────┐
│  StoryPlots │                    │
│  ─────────  │                    │
│  🏠 Home    │                    │
│  👥 Charact.│     (detail)       │
│  🖼  Gallery│                    │
│  ─────────  │                    │
│  RECENT     │                    │
│  [M] Maya·3 │                    │
│  [T] Tomás·2│                    │
│  [H] Hisak·4│                    │
│  …          │                    │
│  ─────────  │                    │
│  ◯ Persona  │                    │
│  ⚙ Settings │                    │
│  ↩ Sign out │                    │
└─────────────┴────────────────────┘
```

### 2.1 Sidebar destinations (3 + footer)

| Destination | Icon (SF Symbol) | Contenido |
|---|---|---|
| **Home** | `house.fill` | Recent **Characters** preview (5 horizontal scroll) + Grammar widget (master toggle + accuracy snapshot, tap → `GrammarDashboardView`) + HomeNudge cuando `characters.isEmpty`. **NO** chats — los chats viven en la sidebar Recent. |
| **Characters** | `person.crop.rectangle.stack.fill` | Grid completo de characters. Crear (Manual / Generate-with-AI / Import-from-PNG-card), editar, eliminar. |
| **Gallery** | `photo.stack.fill` | Grid de todas las `generated_images` del user. Tap → ImageViewer (matched geometry). Long-press → delete via backend `/images/{id}`. |

### 2.2 Sidebar Recent Chats — agrupados por character

Entre las destinations y el footer aparece **Recent**: lista de chats agrupada
por `character_id`, ordenada por el `last_message_at` más reciente de cada
grupo. Cada row colapsada muestra el avatar del character + nombre + count
de chats (`Maya Okonkwo · 3 chats`). Tap row → push a `CharacterChatsView`
listando los chats de ese character; tap chat → push a `ChatView` real.

Repetir 4 veces "Dra. Hisako Nakamura — New Conversation" (estado de Fase 2)
es anti-patrón. La sidebar agrupa.

### 2.3 Sidebar footer — persona + settings + sign out

| Item | Notas |
|---|---|
| **YourPersonaCard** | Avatar + nombre persona. Tap → `ProfileView`. Match al footer de la sidebar web. |
| **Settings** | NavigationLink al hub. Contiene todas las sub-screens (engines, writing, app). |
| **Sign out** | Destructive button. Confirmation dialog antes del signOut. |

### 2.4 Wordmark permanente

En el header de la sidebar / drawer va el wordmark grande (PNG asset
`Wordmark`). Se ve desde cualquier pantalla cuando el drawer está abierto.
Resuelve el feedback de Fase 11 "no veo el logo por ningún lado".

### 2.5 Sub-routes (push dentro de la stack del destination activo)

| Donde push | Surface | Origin |
|---|---|---|
| Home → tap character preview | `CharacterDetailView` | Recent Characters card |
| Home → tap Grammar widget | `GrammarDashboardView` (read-only stats) | Widget tap |
| Characters → tap card | `CharacterDetailView` → `CharacterEditView` | Grid |
| Characters → + Menu → Import | `CharacterImportSheet` (PHPicker + PNG tEXt parser + `/character-refine`) | Plus menu |
| Sidebar → tap RecentChats row | `CharacterChatsView` (lista de chats de ese char) → `ChatView` | Sidebar group |
| Gallery → tap image | `ImageViewer` fullscreen | Grid |
| Settings → engine row | `TextEngine / ImageEngine / MemoryEngine / Voice` | Form |
| Settings → writing row | `Roleplay / VisualRoleplay / WritingStyles / Grammar(settings) / PromptEditor / MemorySettings` | Form |
| Settings → app row | `Profile / PrivacyAndData / About` | Form |

### 2.6 Anti-patterns de IA

- ❌ **Bottom tab bar** con `TabView`. El primer intento (Fase 0–10) lo usó; revertido en Fase 11 porque escondió Gallery/Insights/Grammar dashboard bajo Settings y nunca terminaron de construirse.
- ❌ **Home como lista de chats**. Los chats van en la sidebar (recent grouped). Home es preview de characters + glanceable widgets.
- ❌ **Repetir mismo character en lista flat**. Agrupar por character.

---

## 3. Patterns de navegación

### `NavigationStack` por tab

Cada tab tiene su `NavigationStack` independiente. Pushes profundizan dentro del tab; cambiar de tab no resetea la stack del tab anterior (estado preservado).

```swift
TabView {
    NavigationStack(path: $homePath) { HomeView() }
        .tabItem { Label("Home", systemImage: "bubble.left.and.bubble.right.fill") }
    NavigationStack(path: $peoplePath) { PeopleView() }
        .tabItem { Label("People", systemImage: "person.2.fill") }
    NavigationStack(path: $settingsPath) { SettingsView() }
        .tabItem { Label("Settings", systemImage: "gearshape.fill") }
}
```

### Cuándo push vs sheet vs cover

| Patrón | Cuándo |
|---|---|
| **Push** (`NavigationLink`) | Profundizar en una jerarquía. Trae swipe-back gratis. Ej: Home → Chat → MessageDetail; Characters → CharacterEdit. |
| **Sheet** `.medium` | Flow transactional rápido (segundos, no minutos). Ej: ForkDialog, AccentPicker, ImageViewer en preview. |
| **Sheet** `.large` | Flow más profundo, multi-step. Ej: CharacterCreate (wizard), Import Character, Composer Settings. |
| **Sheet** `.fraction(0.45)` | Picker simple, options secundarias. Ej: provider switcher inline. |
| **Full-screen cover** | Flow modal que cubre por completo (sign-in al cold start, image generation result viewer). |
| **Confirmation dialog** (`.confirmationDialog`) | Destructive con preview ("Delete this character? — destructive — Cancel"). |
| **Alert** (`.alert`) | Errores duros que requieren ack del usuario. Lo más raro. |
| **Toast / banner** | Confirmaciones suaves ("Saved", "Memory extracted"). NO usar alert para esto. Custom view en `.overlay` con auto-dismiss. |

### Anti-patterns navegación

- ❌ **Custom transitions que rompen swipe-back.** Si `NavigationStack` lo hace, no escribir uno propio.
- ❌ **Tab bar que se oculta al scroll.** Confunde. Tab bar siempre visible salvo dentro de chat (donde se oculta para dar pantalla completa).
- ❌ **Modales encadenados.** Sheet → presenta otro sheet → presenta otro. Máximo 1 nivel. Si necesitás más, hacer wizard dentro del mismo sheet.
- ❌ **Back button custom.** El back button del sistema es sagrado.

---

## 3.5 Materials & Liquid Glass — aplicación por surface

Resumen de cómo aplica el contrato visual de `design.md` §6.5 en cada superficie de este app. **Detalle de materials disponibles vive en design.md**; acá vive el mapping a UX concreto.

| Surface | Material aplicado | Notas |
|---|---|---|
| **Splash / launch** | Background gradient amber + (opcional) card glass para mensaje de loading | Solo durante el handoff a auth o root. |
| **Sign-in card** | `.thinMaterial` sobre gradient amber/dark | "Wow" del primer launch. |
| **Tab bar** | Nativo iOS 26 — `.glassEffect()` automático | NO override. Scroll-aware blur. |
| **Navigation bar (todas las screens)** | `.toolbarBackground(.regularMaterial)` + `.toolbarBackgroundVisibility(.visible)` | Sin línea separadora dura del contenido. |
| **Home: header con avatar + greeting** | Material en nav bar; contenido sólido (cards) | Cards `Theme.Color.bg2` sólido para legibilidad. |
| **Home: Your Persona pill** | Sólido (`Theme.Color.bg2`) | Lectura sostenida del nombre. |
| **People: search bar** | Material en su row (top), grid sólido | Search visible sobre cualquier scroll. |
| **People: character cards** | Sólido (bordes con `--char-accent`) | Avatar fullbleed sobre material confunde el accent. |
| **Chat: nav bar** | Material + accent dot color del char | Header flota sobre los bubbles. |
| **Chat: message bubbles** | **SÓLIDO siempre** (`bg2`/`bg3`) | Legibilidad de texto sostenida. |
| **Chat: action chips flotantes** (regenerate, fork buttons during streaming) | `.thinMaterial` en Capsule | Encima de bubbles sin pelear con char-accent. |
| **Chat: composer text field** | **SÓLIDO** (`bg3`) | Typing sobre material jittea. |
| **Chat: composer container** | Material si esta sobre `safeAreaInset` con keyboard | El composer entero puede ser material; solo el text field interno es sólido. |
| **Sheets — todos los detents** | Materials nativos del sistema (`.medium`, `.large`, `.fraction(_)`) | NO override. Sheet grabber + header son material por default. |
| **Sheet content body** | Sólido | El contenido dentro de la sheet sigue el patrón legibilidad. |
| **Long-press context menu** | Nativo iOS — sistema lo da con materials | NO override. Preview agrandada respeta el blur. |
| **Image viewer fullscreen** | `.ultraThickMaterial` overlay scrim durante zoom | Pinch zoom "del sistema". Fade in/out del overlay. |
| **Settings root (grouped list)** | `Form` nativo iOS 26 — usa materials internamente | NO override. Sólo aplicar tokens al contenido. |
| **Settings rows** | Sólido por default Apple | No tocar. |
| **Profile / persona header** | Material en nav bar | Contenido editable sólido. |
| **Confirmation dialogs** | Nativo — sistema lo da con material scrim | NO override. |
| **Alerts** | Nativo — sistema lo da | NO override. |
| **Toasts custom** | `.thinMaterial` con Capsule background + auto-dismiss | Ligeros, no obtrusivos. |
| **Pull-to-refresh indicator** | `.refreshable` nativo | Material + haptic gratis. |
| **Streaming bubble (typing dots)** | Sólido en su layout | Los dots tienen el color `--char-accent`. |
| **Rewrite gate UI** | Sólido con border `Theme.Color.warning` | Atención obligatoria; legibilidad alta. |
| **Side panels (Memory, Lorebook, etc.) como sheets** | Material en grabber/header; cuerpo sólido | Patrón de sheets normal. |
| **Fork dialog** | Sheet `.medium` con material header; cuerpo sólido | Preview del punto + confirm. |

### Accessibility: Reduce Transparency

El sistema iOS permite al user activar "Reduce Transparency" en Settings → Accessibility. Cuando está activo:
- Materials → sólidos automáticos.
- No necesitamos branchear código.
- Verificación visual en cada plan: `RenderPreview` con y sin Reduce Transparency. Anotar deltas en el plan.

### Verificación per-surface

Cada plan que toca una surface con material debe incluir snapshot tests con:
1. Default mode (material visible).
2. Reduce Transparency mode (sólido).
3. (Opcional) Verificar visualmente que el char-accent se mantiene legible cuando aplica.

---

## 4. Mapping web → iOS surfaces

Tabla de las 28 rutas web mapeadas a su contraparte iOS. Algunas se consolidan, otras desaparecen, otras se reagrupan.

| Web route | iOS surface | Notas |
|---|---|---|
| `/` (Home) | **Home tab** — `HomeView` | Lista recent chats + Your Persona pill + create-new affordance. |
| `/chat/:id` | Push desde Home: `ChatView` | Full screen, tab bar oculto. |
| `/characters` | **People tab** — `PeopleView` (grid) | Search/filter en top. |
| `/character/:id/edit` | Push desde People: `CharacterEditView` | |
| `/character/new` | Sheet `.large` desde People: `CharacterCreateSheet` | Wizard 3-step. |
| `/character/create` | Mismo sheet, otra route web — consolidamos en iOS. | |
| `/character/import` | Sheet desde People: `CharacterImportSheet` | Document picker + preview before commit. |
| `/character/generate` | Sub-sheet dentro de Create wizard (step "Generate from prompt"). | El web tiene esto como page separada; en iOS es paso del wizard. |
| `/gallery` | Settings > Gallery (push) | No es tab — vive en Settings. |
| `/grammar` (dashboard) | Settings > Insights > Grammar | Sub-screen de Insights. |
| `/prompt-editor` | Settings > Advanced > Prompt Editor (push) | Power-user. |
| `/profile` | Settings > Profile (push) | Header de Settings tab muestra avatar + nombre, tap → push a Profile. |
| `/settings` | **Settings tab** — `SettingsView` | Root es lista grouped iOS-style. |
| `/settings/grammar` | Settings > Grammar (push) | |
| `/settings/text-engine` | Settings > Text Engine (push) | Provider + model picker. |
| `/settings/image-engine` | Settings > Image Engine (push) | |
| `/settings/memory-engine` | Settings > Memory (push) | |
| `/settings/memory` (general) | Combinar con Memory Engine en iOS — una sola pantalla con secciones. | |
| `/settings/roleplay` | Settings > Roleplay (push) | RP scaffolding (author framing, pacing, style anchor). |
| `/settings/visual-roleplay` | Settings > Visual Roleplay (push) | |
| `/settings/writing-styles` | Settings > Writing Styles (push) | |
| `/settings/text-to-speech` | Settings > Voice (push) | "Voice" lee mejor que "TTS" en mobile. |
| `/settings/data-security` | Settings > Privacy & Data (push) | |
| `/sign-in`, `/sign-up`, `/verify-email`, `/reset-password` | Cover full-screen `AuthFlow` | Cuando no hay sesión, este cover aparece sobre el TabView. |
| `/not-found` | No aplica — iOS no tiene URLs en ese sentido. Universal Links inválidos → fallback a Home. | |

---

## 5. Surface deep-dive: **Chat** (la más compleja)

Es la pantalla principal del producto. Tiene siete tipos de interacciones: composer, message bubbles, streaming, context menu, fork, edit-trim, panels (memory/grammar/lorebook/etc.).

### 5.1 Layout

```
┌────────────────────────────────────┐
│  ← Character Name      ⋯  📷  ⓘ   │  Toolbar (navigation bar)
├────────────────────────────────────┤
│                                    │
│  [character bubble]                │
│                                    │  ScrollView with LazyVStack
│              [user bubble]         │  scrollPosition pinned to last
│                                    │  during streaming
│  [character bubble streaming...]   │
│                                    │
├────────────────────────────────────┤
│  [composer: text field + 🎤 ➤]    │  Keyboard-aware
└────────────────────────────────────┘
```

- **Tab bar oculto** dentro de Chat. `.toolbar(.hidden, for: .tabBar)`.
- **Navigation bar** con: back, character name (centered), action buttons (more, image, info).
- **Background**: `Theme.Color.bg` (#0F0F10). Mensajes flotan sin separadores.
- **Mensajes con LazyVStack**, no `List`. Permite custom bubbles sin pelear con separators del system list.

### 5.2 Message bubble

- **User bubble**: alineada a la derecha. Background `Theme.Color.brand2` (sunset orange) tenue (15% opacity) o `Theme.Color.bg3`. Texto `Theme.Color.fg`. Max width 80% del screen.
- **Character bubble**: alineada izquierda con avatar pequeño a la izquierda. Background `Theme.Color.bg2`. Texto fg. Borde sutil con `--char-accent` del character (1pt, 25% opacity) — esa es la firma visual per-character.
- **Timestamp**: tap-and-hold revela timestamp inline. No mostrar siempre — clutter.
- **Avatar** del character: pequeño (28×28), redondo, con ring de `--char-accent` (2pt, full opacity).
- **Variant pagination**: si un message tiene múltiples variants (regenerate produjo 3 versiones), mostrar dots indicator debajo de la bubble (3 dots, active = filled). Swipe horizontal sobre la bubble cambia variant.
- **Long-press**: abre `contextMenu` nativo de iOS con: Copy, Edit (as trim), Regenerate, Fork from here, Speak (TTS), Delete. Preview en el menu nativo muestra la bubble agrandada.

### 5.3 Streaming UX

Cuando llega `event: start`:
- Bubble vacía aparece con un subtle pulse animation (opacity 0.5 → 1.0, scale 0.96 → 1.0, spring `.snappy`).
- Avatar muestra "typing" indicator: 3 dots animados.

Cuando llegan `event: token`:
- Tokens se acumulan en buffer `@MainActor`.
- Flush al UI cada 30ms — el texto crece con `.animation(.easeOut(duration: 0.1))` aplicado al height de la bubble.
- Scroll auto al final si el usuario no ha scrolleado manualmente. Si el usuario scrollea arriba, **no** auto-scroll (`scrollPosition` pinning desactivado hasta que vuelva al bottom).

Cuando llega `event: done`:
- Typing indicator desaparece.
- Subtle bounce final (opacity 0.95 → 1, scale 0.99 → 1, 200ms).

Cuando llega `event: correction` (paralelo):
- Se inserta inline row debajo del user message correspondiente. Sliding-in animation `.slide.combined(with: .opacity)` desde top.
- Si `already_correct: true`, no row — silent.

Cuando llega `event: rewrite_required`:
- "Rewrite gate" UI bloquea el composer: composer shows the correction + "Use this" button + strike counter.
- Animación de strike: shake horizontal sutil (`offset(x: ...)` con timing curve back-and-forth).

Cuando llega `event: error`:
- Si fue antes del primer `token`, la bubble vacía se descarta + se muestra banner de error temporal en top.
- Si fue mid-stream, la bubble parcial se marca con `error` chip al final + botón "Retry".

### 5.4 Composer

```
┌────────────────────────────────────────┐
│ ⊕   Mensaje a [character]...       🎤 │
│                                      ➤ │
└────────────────────────────────────────┘
```

- **Text field**: multi-line, max height ~120pt (después scroll interno). Auto-grow desde 36pt hasta 120pt.
- **Send button** (➤): solo aparece cuando hay texto. Animation in/out: `.scale.combined(with: .opacity)`.
- **Loading state**: durante stream, el send button se reemplaza por un stop button (■) que cancela el SSE en curso.
- **Mic button** (🎤) — opcional MVP **[REVIEW]**: si entra, abre voice input via Speech framework.
- **Attach button** (⊕) — para adjuntar imagen al composer (si el flow lo soporta). **[REVIEW]** alcance.
- **Keyboard handling**: `.keyboardType(.default)`, `submitLabel: .send`. Composer se eleva sobre el keyboard automáticamente con `safeAreaInset(edge: .bottom)`. NO usar `KeyboardObserver` custom — el system handling cubre.
- **Paste de imagen**: si el clipboard tiene image, mostrar chip "Paste image?" sobre el composer.

### 5.5 Side panels (Memory, Grammar, Lorebook, Author's Notes, Generation Override, Chat Controls)

El web tiene estos como sidebars desplegables. iOS los presenta como **sheets `.medium`** desde un menu top-right (⋯). El menu muestra un grid de iconos:

```
┌────────────────────────┐
│  Memory   Grammar      │
│  Lore     Author's Note│
│  Generation  Controls  │
└────────────────────────┘
```

Cada sheet tiene su propio content + dismiss handle. **[REVIEW]** — algunos paneles pueden vivir en Settings de la conversación en lugar de aparecer durante el chat, dependiendo de la frecuencia de uso. A decidir por panel.

### 5.6 Fork dialog

Long-press sobre un message → context menu → "Fork from here". Sheet `.medium` aparece con preview del punto + opcional "branch title" + confirm. Spring de entrada notable porque es acción importante.

### 5.7 Edit-as-trim

Long-press → "Edit". Sheet `.medium` con: el texto del message editable + warning visible "Editing this message will trim every message after it." + buttons "Cancel" / "Save & Trim". El warning tiene icon y color destructive.

---

## 6. Surface deep-dive: **Home**

```
┌────────────────────────────────────┐
│ Hi, Michael                      ⓜ │   header + avatar (tap → profile)
├────────────────────────────────────┤
│ Your persona:  [persona pill]      │   compact, tap → edit persona sheet
├────────────────────────────────────┤
│ Recent                             │
│ ┌──────────────────────────────┐   │
│ │ avatar  Character             │  │   chat card
│ │         "Last assistant line"│   │
│ │                          2h  │   │
│ └──────────────────────────────┘   │
│ ┌──────────────────────────────┐   │
│ │ ...                          │   │
│ └──────────────────────────────┘   │
├────────────────────────────────────┤
│ [Start a chat with a character →]  │   CTA al People tab si no hay chats
└────────────────────────────────────┘
```

- **Pull-to-refresh** con `.refreshable` — refresca lista de recent chats con haptic.
- **Swipe-to-delete** en cada chat card (`.swipeActions`).
- **Tap a card** → push a Chat.
- **Tap "Your persona" pill** → sheet `.medium` para editar persona.
- **Empty state**: ilustración simple + CTA "Pick a character to start" → navega al People tab.

---

## 7. Surface deep-dive: **People** (Characters)

```
┌────────────────────────────────────┐
│ Search characters             [+]  │   search bar + plus to create
├────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐         │
│ │      │ │      │ │      │         │   grid 2 columns iPhone
│ │  Av  │ │  Av  │ │  Av  │         │
│ │      │ │      │ │      │         │
│ │ Name │ │ Name │ │ Name │         │
│ │ #tag │ │ #tag │ │ #tag │         │
│ └──────┘ └──────┘ └──────┘         │
│   ...                              │
└────────────────────────────────────┘
```

- **Grid 2 columns** en iPhone (size class compact). Card aspect 1:1.2 (avatar takes more vertical room).
- **Search**: live filter, debounce 200ms.
- **Pull-to-refresh** para resync con backend.
- **Tap card** → push a `CharacterEditView` (read-only mode al landing + "Edit" en toolbar para entrar a edit mode). Alternativa: doble tap → straight to chat. **[REVIEW]**.
- **Long-press card** → contextMenu: Edit, Chat, Duplicate, Export, Delete.
- **+ button** abre menu: New blank, Import, Generate from prompt.
- **Empty state**: ilustración + CTA "Create your first character" + "Import from PNG".

### CharacterEditView

Lista grouped con secciones: Identity (name, avatar, accent), Persona (system prompt, description, scenario), Voice (TTS provider, voice id), Advanced (RP overrides, character memory toggle). Cada sección expandible. Edits commit al save (no realtime). Header tiene el avatar + accent picker inline.

### Avatar picker
- Tap avatar → sheet `.medium` con: From Photos / Generate / Pick color (fallback) / Use initial.
- Generate dispara el flow de `/avatar/generate` con progress indicator + cancelable.

### Accent picker (`AccentPicker`)
- Grid de 12–16 colores predefinidos + opción "Custom" que abre un `ColorPicker` nativo iOS.
- Tap aplica live al avatar ring + previews del border de bubble.

---

## 8. Surface deep-dive: **Settings**

```
┌────────────────────────────────────┐
│ ┌────────────────────────────┐     │
│ │ avatar  Michael              │   │   header card — tap to Profile
│ │         email@.com           │   │
│ └────────────────────────────┘     │
├────────────────────────────────────┤
│ Engines                            │   grouped section header
│  Text Engine            >          │
│  Image Engine           >          │
│  Memory                 >          │
│  Voice                  >          │
├────────────────────────────────────┤
│ Writing                            │
│  Roleplay               >          │
│  Visual Roleplay        >          │
│  Writing Styles         >          │
│  Grammar                >          │
├────────────────────────────────────┤
│ Data                               │
│  Gallery                >          │
│  Insights               >          │
│  Privacy & Data         >          │
│  Export / Import        >          │
├────────────────────────────────────┤
│ App                                │
│  Appearance             >          │
│  Notifications          >          │
│  Advanced               >          │
│   (incluye Prompt Editor inside)   │
│  About                  >          │
│  Sign out                          │
└────────────────────────────────────┘
```

- iOS-native grouped list `Form { Section { ... } }`.
- Cada subscreen es un push.
- "Sign out" en destructive color, confirmation dialog antes de ejecutar.
- "Appearance" controla theme (Dark only / System / Light) **[REVIEW]** según decisión de creator-vision §8.

---

## 9. Gestos

| Gesto | Acción |
|---|---|
| **Tap** | Action primaria de la superficie. |
| **Long-press** | Context menu (mensaje, character card, conversation card). Trae preview nativo iOS. |
| **Swipe horizontal** sobre message | Cambiar variant si hay múltiples. |
| **Swipe-back** | Estándar `NavigationStack`. Nunca interceptar. |
| **Pull-to-refresh** | Recargar lista (Home, People). |
| **Pinch** | Zoom en imagen viewer. |
| **Drag** | Pan en imagen viewer (con zoom > 1.0). |
| **Double-tap** | Reservado. **[REVIEW]** — posibles: zoom image al 2x, like message. |
| **Swipe izquierda en lista** | Actions destructivas / archive (chat list, character list). |

---

## 10. Animaciones — specs concretas

### Spring presets

```swift
extension Animation {
    static let snappy   = Animation.snappy(duration: 0.4)
    static let bouncy   = Animation.bouncy(duration: 0.5, extraBounce: 0.15)
    static let smooth   = Animation.smooth(duration: 0.45)
    static let pop      = Animation.spring(response: 0.35, dampingFraction: 0.7)
    static let gentle   = Animation.spring(response: 0.5, dampingFraction: 0.9)
}
```

### Transiciones por surface

| Transición | Curva | Duración |
|---|---|---|
| Push de NavigationStack | system default | system default |
| Sheet aparece | system default (smooth slide-up) | system default |
| Tab change | sin transición específica | instant |
| Send button aparece/desaparece | `.pop` con `.scale.combined(with: .opacity)` | 350ms |
| Token aparece en streaming | `.easeOut` 100ms aplicado al height del bubble | — |
| Streaming bubble entra | `.snappy` (opacity + scale 0.96→1) | 400ms |
| Streaming bubble cierra (done) | `.gentle` (bounce muy sutil) | 200ms |
| Correction row aparece | `.snappy` + slide from top | 400ms |
| Rewrite gate shake | back-and-forth offset 6pt | 250ms |
| Sheet con detents drag | system default | — |
| Matched geometry (character card → chat header avatar) | `.smooth` 450ms | — |

### Matched geometry

Donde aplica:
- **Character card avatar (People)** → **Chat header avatar**. El avatar "vuela" durante la navegación push. Requiere `matchedGeometryEffect` + ID compartido.
- **Image en chat (small thumb)** → **ImageViewer full-screen**. Pinch o tap hace que la imagen crezca a full-screen con matched geometry.

---

## 11. Haptics

| Acción | Haptic |
|---|---|
| Send message | `.impact(.light)` al tap, `.impact(.medium)` al confirmar envío. |
| Stream done | `.notificationOccurred(.success)` tenue. Solo en streams cortos (< 5s). Si más largo, no haptic para no molestar. |
| Stream error | `.notificationOccurred(.error)`. |
| Generation done (image, character) | `.notificationOccurred(.success)`. |
| Pull-to-refresh trigger | `.impact(.light)` al cruzar el threshold. (iOS lo da gratis con `.refreshable`.) |
| Long-press release con action | `.impact(.medium)`. (Sistema lo da en el contextMenu nativo.) |
| Destructive confirm (Delete) | `.notificationOccurred(.warning)` al abrir el dialog. |
| Swipe-to-delete pasa threshold | `.impact(.light)`. |
| Tab change | sin haptic (sistema no lo da; respetar). |
| Toggle on/off | `.impact(.light)`. |
| Strike en rewrite gate | `.notificationOccurred(.warning)`. |

Default: **haptics OFF si Settings > Haptics es OFF**. El user puede silenciarlos.

---

## 12. Accessibility

- **Dynamic Type**: todo texto sale de `.font(.body)`, `.font(.headline)`, etc. — nunca `.font(.system(size: 14))`. Layouts diseñados para soportar XXL accessibility size (test en `RenderPreview`).
- **VoiceOver labels**: cada control no-trivial tiene `.accessibilityLabel`. Iconos puros tienen labels (e.g. `accessibilityLabel("Send message")`).
- **Accessibility traits**: usar `.accessibilityAddTraits(.isButton)` donde el control no es nativamente un Button.
- **Reduce Motion**: respetar — si `accessibilityReduceMotion`, simplificar animaciones (sin spring exagerado, sin matched geometry intensivo).
- **Contrast**: los tokens del web ya cumplen WCAG AA. Verificar al portar (especialmente fg-3 vs bg-2 — los contrastes están en el comment de tokens.css).
- **VoiceOver focus order** en chat: leer mensajes desde el más antiguo al más nuevo, evitar leer scrolled-out-of-view tokens en stream.

---

## 13. Estados que siempre se manejan

Lo que `creator-vision.md` §6.5 implica: ninguna pantalla se entrega sin manejar estos cinco estados. Si falta uno, la pantalla no está done.

1. **Loading inicial** — skeleton o shimmer adecuado al layout. Spinner solo para operaciones < 2s.
2. **Empty** — ilustración + copy claro + CTA si aplica.
3. **Error** — mensaje claro, retry button. Nunca silent failure.
4. **Offline** — banner top "Sin conexión" + UI funcional con cache hasta donde alcance. Composer disabled con explanation si no se puede mandar.
5. **Streaming / generating** — visible indicator, cancelable cuando aplica.

---

## 14. Theming: dark default

- **Dark mode** es el default. Tokens están construidos para dark (`--sp-bg = #0F0F10`).
- **Light mode**: **[REVIEW]** según creator-vision §8.1. Default sugerido: dark-only en MVP, light en fase 2. Si entra, requiere bumpear tokens.css con paleta light + asset catalog "Any/Dark/Light" para cada color semántico.
- **System mode** (sigue al iPhone) sería el ideal eventual.

---

## 15. Modos iOS no soportados (de la fase 1)

- **iPad layout** — no se considera. Si la app se ejecuta en iPad por compatibilidad accidental, layout iPhone scaled está OK por ahora.
- **Stage Manager / Multitasking** — fuera de scope iPhone.
- **External keyboard shortcuts** — fuera de scope MVP. Eventualmente: ⌘+Enter para send, ⌘+N para nuevo chat, etc.
- **Drag and drop** entre apps — fuera de MVP.
- **Apple Pencil** — no aplica iPhone.

---

## 16. Anti-patterns iOS específicos

Lista de "no hacer" recurrente. Cada violación en code review debe revertirse:

- ❌ Spinners genéricos donde un skeleton tiene sentido.
- ❌ Bordes y dividers excesivos. iOS usa elevation (background sutil) sobre líneas.
- ❌ Botones de "Back" custom en top-left que rompen swipe-back.
- ❌ Modales mostrando otro modal mostrando otro modal.
- ❌ Hardcoded colors / sizes en código de view.
- ❌ Imágenes sin `accessibilityLabel`.
- ❌ Animations `.linear` (excepto progress indicators).
- ❌ Haptics en cada tap.
- ❌ Custom Done button en sheets (`.toolbar { ToolbarItem(.confirmationAction) { Button("Done") {} } }` es lo idiomático).
- ❌ Llamar APIs en `body` de view (en lugar de `.task { ... }` o `.onAppear`).
- ❌ `Color(hex:)` en código de view. Siempre vía `Theme.Color.xxx`.
- ❌ Stack views con muchos `.padding()` repetidos. Centralizar spacing en `Theme.Spacing`.

---

## 17. Decisiones marcadas `[REVIEW]` en este archivo

1. Tab "People" vs "Characters" — naming.
2. Light mode en MVP o fase 2.
3. Composer: voice input MVP o fase 2 (también en creator-vision).
4. Composer: attach image MVP o fase 2.
5. Double-tap reserved gesture: ¿qué acción?
6. People grid: tap card va a Edit o directo a Chat.
7. Side panels en Chat: cuáles aparecen como sheet vs en settings.
8. Pull-to-refresh disponible en cuales superficies (Home, People — confirmado; Settings — no).
9. CharacterEditView landing en read-only o en edit mode directo.

---

## 18. Cómo este archivo crece

Cuando se diseña una nueva surface no listada acá, se agrega como sección §X "Surface deep-dive: NombreNuevo" siguiendo la estructura de las existentes. Para cambios mayores a una surface ya descrita, se edita la sección con cita al plan que motivó el cambio.

Si una decisión en este archivo se viola en un plan, el plan se reescribe — no este documento.
