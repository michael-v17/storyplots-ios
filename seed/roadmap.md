# Roadmap — StoryPlots iOS (hasta TestFlight beta)

> Layer 3 del seed. Plan de ejecución por fases, hasta tener una beta interna distribuida vía TestFlight.
> Inputs: `creator-vision.md`, `tech-stack.md`, `ux.md`, `design.md`, `api-contract.md`.
> Cada fase tiene: **goal**, **inputs**, **subtasks (3-5) con exit criteria ejecutables**, **verificación por MCP**, **riesgos**, **deuda producida**.
> Una fase termina cuando todos sus exit criteria son verdes. **No** se empieza la siguiente con la anterior incompleta.

---

## 0. Cómo usar este roadmap

### Principios

1. **Una fase a la vez.** Sin paralelización entre fases (el ahorro de tiempo no compensa el costo de coordinación + drift). Subtasks dentro de fase pueden ir en paralelo si son independientes.
2. **Exit criteria son comandos, no narrativas.** "BuildProject pasa" / "RunAllTests retorna green" / "RenderPreview matches reference" — verificables sin juicio subjetivo.
3. **Plan por fase antes de codear** (un `plans/NNNN-fase-slug.md` por ciclo). El roadmap es la planificación macro; los plans son las planificaciones micro de cada fase ejecutada.
4. **Verificación entre subtasks**, no solo al final de la fase. Si una subtask falla, parar y arreglar antes de la siguiente.
5. **El roadmap se actualiza al ejecutar.** Si una fase entrega menos / más de lo previsto, se anota acá en su sección + se reordena lo que sigue. Las fases ejecutadas se marcan completed con fecha y referencia al plan.

### Dependencias entre fases

```
0 (Bootstrap) ──> 1 (Auth) ──> 2 (Home) ──┐
                                          ├──> 4 (Chat skeleton) ──> 5 (SSE)
                              3 (People) ─┘
                                                                       │
                                                       ┌───────────────┘
                                                       ▼
                                          6 (Character CRUD) ──> 7 (Composer features)
                                                                       │
                                                                       ▼
                                                        8 (Panels + Image + Audio)
                                                                       │
                                                                       ▼
                                                              9 (Settings + Engines)
                                                                       │
                                                                       ▼
                                                                10 (Pre-TestFlight)
```

Fase 2 y 3 pueden hacerse en cualquier orden tras Fase 1. Fase 5 es la barrera real — todo lo siguiente depende de chat funcionando.

### Convenciones de comandos

Los exit criteria asumen los 3 MCPs iOS (ver `tech-stack.md` §13). Comandos canónicos:

| Comando lógico | MCP | Forma concreta |
|---|---|---|
| Compilar | Apple Xcode MCP | `BuildProject` o `xcodebuild build -scheme storyplots` |
| Correr tests | Apple Xcode MCP | `RunAllTests` o `xcodebuild test -scheme storyplots -destination "platform=iOS Simulator,name=iPhone 16 Pro,OS=26.5"` |
| Verificar SwiftUI visual | Apple Xcode MCP | `RenderPreview StorePlotsApp/Views/<View>` |
| Buscar docs Apple | Apple Xcode MCP | `DocumentationSearch <query>` |
| Build headless | XcodeBuildMCP | `xcodebuild build-for-testing ...` |
| Deploy a device | XcodeBuildMCP | `install-app-device` |
| Interactivo en sim | ios-simulator-mcp | `ui_tap`, `ui_swipe`, `accessibility-tree` |

### Métricas que se trackean en cada fase

- **Build time**: `xcodebuild` cold + incremental.
- **Test suite duration**: `RunAllTests`.
- **Coverage**: % líneas + % branches en código nuevo de la fase.
- **Time to first frame** (Phase 5+): launch → first interactive frame, medido con `os_signpost`.
- **Memory @ idle**: medido con `xcrun simctl spawn booted memory` o Xcode Instruments.

### Liquid Glass acceptance gates (cross-cutting)

Cada fase que toca surfaces visuales debe verificar **materials nativos iOS 26** según el mapping en `design.md` §6.5 y `ux.md` §3.5:

| Fase | Gate de Liquid Glass específico |
|---|---|
| 0 (Bootstrap) | `Theme` incluye `Theme.Material` enum con presets correctos (mismo namespace que Color/Spacing). `RenderPreview` de `ThemePreview` muestra ejemplo de cada material. |
| 1 (Auth) | Sign-in card usa `.thinMaterial` sobre gradient amber. `RenderPreview` incluye snapshot con Reduce Transparency ON (fallback a sólido). |
| 2 (Home) | Nav bar usa `.toolbarBackground(.regularMaterial)`. Cards de chats permanecen sólidas. Snapshot diff con/sin Reduce Transparency. |
| 3 (People) | Search bar + nav bar con material. Grid cards sólidas. |
| 4 (Chat skeleton) | Nav bar material + char accent dot. Message bubbles **sólidas** (verificar no se filtre material a bubbles). |
| 5 (SSE streaming) | Action chips flotantes (cancel/regenerate visible durante stream) usan `.thinMaterial` en Capsule. Streaming dots/loader sobre bubble sólido. |
| 6 (Character CRUD) | Sheets nativos para Create/Edit (detents `.medium`/`.large`); no override de grabber. AccentPicker preview funciona sobre material del sheet header. |
| 7 (Composer features) | Long-press context menu usa preview nativa del sistema (no override). Fork dialog y EditTrim usan sheet con material header nativo. |
| 8 (Panels + Image + Audio) | Image viewer fullscreen usa `.ultraThickMaterial` durante pinch zoom + fade. Side panels como sheets nativas. |
| 9 (Settings) | `Form { Section { } }` nativo iOS 26 (no override). Header card de Settings con material en nav bar. |
| 10 (Pre-TestFlight) | Smoke test final: navegar las 10 surfaces principales con Reduce Transparency ON y OFF; verificar legibilidad + jerarquía sin regresiones. |

**Verificación común**: en cada fase con un material nuevo, el plan incluye snapshot tests pareados (default + Reduce Transparency) y un check visual de que la jerarquía se mantiene en ambos modos.

---

## Fase 0 — Bootstrap Xcode

### Goal

Tener un Xcode project que compila + corre tests + renderiza un SwiftUI preview con `Theme` correcto + scaffolding del cliente API. Sin features de producto todavía — solo la base operacional.

### Inputs requeridos

- `tech-stack.md` §2-§7 (Swift, SwiftUI, target iOS 26, networking, persistencia).
- `design.md` §3-§8 (Theme tokens).
- MCPs iOS configurados (al menos el #1 Apple Xcode MCP activo).
- Q3.8 resuelta: bundle ID definitivo.

### Subtasks

1. **Reset del Xcode project actual**. El scaffolding existente (`storyplots.xcodeproj`, `ContentView.swift`) es boilerplate de Apple del 14-mayo. Decisión: dejarlo o regenerar.
   - **Default**: regenerar limpio con bundle ID definitivo, target iOS 26.0, language Swift, interface SwiftUI, include Tests checkbox marcada.
   - **Exit**: `xcodebuild -list -project storyplots.xcodeproj` muestra schemes esperados (`storyplots`, `storyplotsTests`, `storyplotsUITests`).

2. **Folder layout**. Establecer la estructura raíz dentro de `storyplots/`. Propuesta:
   ```
   storyplots/
   ├── App/                       storyplotsApp.swift, AppDelegate (si hace falta), RootView
   ├── Core/
   │   ├── DesignSystem/          Theme.swift, ThemeModifiers.swift
   │   ├── Networking/            APIClient.swift, SSEClient.swift, Endpoint.swift, AuthStore.swift
   │   ├── Persistence/           SwiftData models + Cache stubs
   │   └── Supabase/              SupabaseClient wrapper
   ├── Features/
   │   ├── Auth/
   │   ├── Home/
   │   ├── People/
   │   ├── Chat/
   │   └── Settings/
   ├── Resources/
   │   ├── Assets.xcassets        (incluyendo AccentColors/, AppIcon, Logo)
   │   └── Localizable.xcstrings  (incluso siendo English-only, infra desde día 1)
   └── Tests/                     (target XCTest)
   ```
   - **Exit**: `BuildProject` pasa con folder layout aplicado.

3. **Implementar `Theme.swift`** desde tokens de `design.md`. Colors, Spacing, Radius, FontStyle, Motion, Shadow, **Material (iOS 26)**.
   - Patrón: enum namespace, sin instancias.
   - `Theme.Material` enum con presets nombrados que apuntan a los modifiers nativos (`Theme.Material.navBar = .regularMaterial`, `Theme.Material.chip = .thinMaterial`, `Theme.Material.viewerOverlay = .ultraThickMaterial`).
   - Verificable: `RenderPreview` de `ThemePreview` muestra paleta + scale + tira con cada material visible sobre fondo gradient (para demostrar el efecto).
   - **Exit**: `RunAllTests` para `ThemeTests` (1 test trivial verificando `Theme.Color.bg == Color(hex: 0x0F0F10)`) pasa + snapshot de `ThemePreview` con materials visibles.

4. **Implementar `APIClient` skeleton + `SSEClient` skeleton + `AuthStore` actor**. Stubs vacíos pero compilables, con tipos `Endpoint<R>`, `SSEEvent`, `URLRequest` factory.
   - Sin lógica real todavía — solo la arquitectura.
   - Test: mock que retorna fixture, asserta encoding correcto.
   - **Exit**: `xcodebuild test -only-testing:storyplotsTests/NetworkingTests` pasa.

5. **Configurar `supabase-swift`** vía Swift Package Manager. Resolver paquete, agregar a target, instanciar `SupabaseClient` en `Core/Supabase/SupabaseManager.swift`.
   - URLs Supabase + anon key vivirán en xcconfig dev/staging/prod (Q3.6 fallback acepta nada inicial — solo `Debug.xcconfig` y `Release.xcconfig`).
   - **Exit**: `BuildProject` pasa; instanciar el client en un test no tira error.

### Verificación de la fase

- `BuildProject` debug + release — green.
- `RunAllTests` — 2-3 tests triviales pasan.
- `RenderPreview` de `ThemePreview` retorna PNG con paleta visible.
- Manual: abrir el project en Xcode, navegar el folder layout, confirmar que se ve sano.

### Riesgos

- **Swift 6 strict-concurrency** introduce warnings con `supabase-swift` viejo. **Mitigación**: bajar a `targeted` si bloquea, anotar la deuda en `open-questions.md`.
- **Xcode 26.3+ no disponible**: si el creator está en una versión menor, ajustar `tech-stack.md`. Como ya se confirmó simulator 26.5, asumimos Xcode 26.3+.

### Deuda producida

- Sin pantallas reales todavía — pure infra.
- Sin push capability ni Sign-in-with-Apple capability registradas — eso entra en Fase 1 y Fase 10.
- CI no configurado — Q3.6 default es nada inicial.

### Estado

- [ ] Pendiente de ejecutar.

---

## Fase 1 — Auth shell

### Goal

Usuario puede sign-in con email/password **y** con Apple Sign-In. Sesión persiste entre relanzamientos. Splash → sign-in → root con TabBar shell visible (las 3 tabs vacías). Sign-out funcional.

### Inputs requeridos

- Fase 0 completed.
- `tech-stack.md` §8 (Auth).
- `api-contract.md` §2 (Apple Sign-In camino confirmado).
- `ux.md` §4 (Auth flow + tab bar structure).
- Q4.1 resuelta (Apple Sign-In rol). Default: opción adicional, no primario.
- **Capabilities Xcode**: agregar "Sign in with Apple" al target.

### Subtasks

1. **`AuthStore` actor real** con métodos `signInEmail`, `signInWithApple`, `signOut`, `currentSession`. Persistencia de session vía supabase-swift built-in (Keychain). `@Observable AuthState` expone `isSignedIn`, `user`, `error`.
   - Exit: tests unit con mock Supabase verifican: sign-in success → state.isSignedIn=true; sign-out → false.

2. **`SignInView` SwiftUI** con: header brand (wordmark amber), TextField email, SecureField password, "Sign in" button (brand gradient), separator "or", "Sign in with Apple" button (`SignInWithAppleButton` nativo).
   - Manejo de errors → banner top con `Theme.Color.destructive`.
   - Loading state durante request.
   - Sign-up button → push a `SignUpView`.
   - Forgot password button → push a `ResetPasswordView`.
   - Exit: `RenderPreview SignInView` matches reference snapshot.

3. **`SignUpView` + `ResetPasswordView`** mínimas (form + submit + confirm).
   - Exit: snapshots.

4. **`RootView`** que switchea entre `AuthFlow` (cover full-screen) y `MainTabView` según `authState.isSignedIn`. Transición smooth con `.snappy` cuando cambia.
   - `MainTabView`: 3 tabs vacías (Home, People, Settings) con SF Symbols apropiados y placeholder "Hello {tab}" en cada.
   - Exit: `BuildProject` pasa; manual launch en simulator muestra el switch correcto.

5. **Apple Sign-In integration end-to-end**.
   - `ASAuthorizationAppleIDProvider` request con `[.fullName, .email]` scopes.
   - Recibir `identityToken` → `supabase.auth.signInWithIdToken(provider: .apple, idToken: ...)`.
   - Manejar el caso `nonce` (Supabase lo pide).
   - Exit: ios-simulator-mcp ejecuta el flow real (el simulador iOS 26.5 soporta Apple Sign-In simulado), termina en `MainTabView`.

### Verificación de la fase

- `BuildProject` + `RunAllTests` green.
- `RenderPreview` de `SignInView`, `SignUpView`, `ResetPasswordView`, `MainTabView` placeholder.
- ios-simulator-mcp flow:
  ```
  Launch → SignInView visible
  Tap "Sign in with Apple" → Apple consent → MainTabView visible
  Force-quit → relaunch → MainTabView directo (session persisted)
  Tap Settings tab → tap "Sign out" → SignInView visible
  ```
- Coverage de `Features/Auth/`: ≥ 70%.

### Riesgos

- **Apple Sign-In en simulador iOS 26.5** puede tener quirks (developer team certificate, nonce handling). Mitigación: si el sim no coopera, validar en device físico via XcodeBuildMCP.
- **Token refresh edge cases**: si el JWT expira mientras la app está cerrada, la primera request fallará. Mitigación: `AuthStore.refreshOnLaunch()` antes de cualquier request.

### Deuda producida

- Magic link auth — diferido (Q3.x).
- Forgot password flow real (envío email) — depende de configuración Supabase server-side, no app.
- Account linking si Apple Sign-In retorna email distinto al de email/password existente — diferido (Q6.5 default: cuentas separadas).

### Estado

- [ ] Pendiente.

---

## Fase 2 — Home tab

### Goal

Lista de recent chats funcional. Pull-to-refresh. Empty state. Your Persona pill. Tap a card navega a un `ChatView` placeholder (sin streaming aún — eso es Fase 4-5).

### Inputs requeridos

- Fase 1 completed.
- `ux.md` §6 (Home layout).
- `api-contract.md` §4.1 (lectura directa de `conversations`, `user_personas`).
- Acceso a Supabase staging con datos de prueba (al menos 3 conversations existentes).

### Subtasks

1. **`HomeViewModel`** con estado `chats: [ConversationSummary]`, `persona: UserPersona?`, `loadingState`. Método `.load()` lee con `supabase.from("conversations").select("id,title,character_id,updated_at,character_snapshot").order("updated_at", ascending: false).limit(50)`.
   - Modelo `ConversationSummary { id, title, characterName, accentColor, avatarRef, updatedAt }` derivado del snapshot.
   - Exit: unit test mock retorna 3 rows, view model las parsea correctamente.

2. **`HomeView` SwiftUI**: header (greeting + avatar tap → push Profile placeholder), `YourPersonaPill`, lista de `ConversationCard` con avatar + char name + last assistant text snippet + relative time. Empty state `EmptyHomeView` con CTA "Pick a character to start".
   - Pull-to-refresh con `.refreshable` + haptic.
   - Swipe-to-delete con `.swipeActions` (delete via `supabase.from("conversations").delete().eq("id", id)`).
   - Exit: `RenderPreview HomeView` con state populated + empty.

3. **`ConversationCard`** view: layout horizontal con avatar 56×56 + accent ring, columna name (headline) + snippet (callout, 2 lines max), timestamp (caption2, fg-4 alineado top-right).
   - Tap → push placeholder `ChatPlaceholderView { conversationID }`.
   - Exit: snapshot test.

4. **`YourPersonaPill`** compacto: avatar persona (40×40) + name + chevron. Tap → sheet medium con `PersonaEditView` placeholder.
   - Lee `user_personas` (1 row por user, by RLS).
   - Exit: snapshot.

5. **Cache layer SwiftData** mínimo. `CachedConversation` model. Al `.load()`: leer SwiftData primero, mostrar UI con cache, luego fetch backend, reconciliar (upsert).
   - Exit: tests que verifican el patrón: launch sin red → cached visible.

### Verificación de la fase

- `BuildProject` + `RunAllTests` green.
- `RenderPreview` de `HomeView` (populated + empty + loading state).
- ios-simulator-mcp:
  ```
  Sign in → Home tab visible
  Lista de chats reales del staging
  Pull-to-refresh → spinner + haptic
  Swipe left en una card → delete → la card desaparece
  Tap un card → push a placeholder Chat
  ```
- Coverage `Features/Home/`: ≥ 70%.

### Riesgos

- **Supabase RLS** puede bloquear lecturas si los policies no cubren al usuario auth-ed correctamente. Mitigación: confirmar policies en `base/supabase/migrations/` antes (no debería ser problema — el web funciona).
- **Decode de `character_snapshot`** JSONB puede fallar si hay variaciones de shape. Mitigación: usar `[String: Any]` o `JSONValue` permisivo + extraer campos opcionales.

### Deuda producida

- No streaming aún → Chat es placeholder.
- Profile screen real (tap header avatar) es placeholder.
- Matched geometry para conversation card → chat header avatar — entra en Fase 4.

### Estado

- [ ] Pendiente.

---

## Fase 3 — People tab

### Goal

Grid 2-col de characters con search + create entry points. CharacterDetailView read-only landing. Accent visualization en cada card.

### Inputs requeridos

- Fase 1 completed (auth funcional).
- `ux.md` §7 (People grid + CharacterEditView landing read-only).
- `api-contract.md` §4.1 (lectura directa de `characters`).
- Q5.1 resuelta (tab name "People" vs "Characters"). Default: "People".
- Q5.2 resuelta (tap behavior). Default: tap → CharacterDetailView read-only.
- Q5.3 resuelta (landing mode). Default: read-only con "Edit" button.

### Subtasks

1. **`PeopleViewModel`** con `characters: [CharacterCard]`, search text. Method `.load()` lee `supabase.from("characters").select("id,name,avatar_ref,accent_color,age,gender,scenario,updated_at").order("updated_at", ascending: false)`.
   - Search local (filter `name` containing).
   - Exit: tests unit.

2. **`PeopleView` SwiftUI**: search bar top, grid `LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16)`, `CharacterCard`. Plus button top-right → menu (New blank / Import / Generate from prompt).
   - Pull-to-refresh.
   - Empty state ilustración + CTA.
   - Exit: `RenderPreview` con state.

3. **`CharacterCard`** view: aspect 1:1.2, avatar grande (fullwidth, top), name (headline) + tag/scenario brief (caption, fg-3). Border 2pt con `accent.border` (55% opacity char accent). Tap → push.
   - Long-press → contextMenu (Edit, Chat, Duplicate, Export, Delete).
   - Exit: snapshot test.

4. **`CharacterDetailView`** read-only mode: scrollable con secciones (Identity, Persona, Voice). Toolbar item "Edit" → entra a `CharacterEditView` (Fase 6).
   - Exit: `RenderPreview` con datos populated.

5. **Pre-cargar imagen del avatar**. `AsyncImage` con placeholder + cache.
   - Helper `SupabaseStorage.signedURL(bucket: "avatars", path:)`. Cache de signed URLs (TTL 50min < signed URL TTL 60min).
   - Exit: tests verifican que la signed URL se cachea correctamente.

### Verificación de la fase

- `BuildProject` + `RunAllTests` green.
- `RenderPreview` de `PeopleView` (populated + empty + loading).
- ios-simulator-mcp:
  ```
  People tab → grid visible con avatars
  Type en search → filter live
  Tap un card → CharacterDetailView read-only
  Tap "Edit" → placeholder o salta a Fase 6 si ya está
  Long-press card → contextMenu visible
  ```
- Coverage `Features/People/`: ≥ 70%.

### Riesgos

- **Imágenes pesadas** si `avatars` bucket tiene archivos sin compress. Mitigación: el backend ya comprime a WebP (`compress_for_storage`) — no debería ser problema.
- **Performance del grid** con 100+ characters: usar `LazyVGrid` + image cache. Si laggea, considerar paginar por 50.

### Deuda producida

- Crear character flow (Fase 6).
- Importar character desde PNG (Fase 6 o 8).
- Generar character desde idea (Fase 6).
- Avatar generation flow (Fase 8).

### Estado

- [ ] Pendiente.

---

## Fase 4 — Chat skeleton (sin streaming)

### Goal

Navegar de Home → ChatView. Ver history de mensajes (lectura). Bubbles renderizadas con accents. Scroll position correcto. Tab bar oculto. Composer visible pero no funcional aún.

### Inputs requeridos

- Fase 2 completed.
- `ux.md` §5 (Chat surface deep-dive).
- `api-contract.md` §4.1 (lectura `messages`, `message_variants`).

### Subtasks

1. **`ChatViewModel`** con `conversation`, `messages: [MessageItem]`, `loadingState`. Method `.load(conversationID)`:
   - Read `conversations` row.
   - Read `messages` ordered by `created_at`.
   - Read active `message_variants` para los assistant messages.
   - Componer `MessageItem` con role + text/active_variant_content + char_accent.
   - Exit: tests unit con mock que retorna 6 messages mixed roles.

2. **`ChatView` SwiftUI**:
   - Navigation bar: back, character name + accent dot, toolbar buttons (⋯, 📷, ⓘ).
   - `.toolbar(.hidden, for: .tabBar)`.
   - `ScrollView { LazyVStack { ForEach(messages) { MessageBubble($0) } } }`.
   - `Composer` placeholder al bottom (Fase 5 lo activa).
   - Background `Theme.Color.bg`.
   - Exit: `RenderPreview ChatView` con 6 messages.

3. **`MessageBubble`** view:
   - User: alineada derecha, background `bg3` o `brand2.opacity(0.15)`, max width 80%.
   - Character: alineada izquierda, avatar pequeño (28×28) left, background `bg2`, border 1pt `accent.border`.
   - Markdown rendering: probar `AttributedString(markdown:)` primero (Q3.3).
   - Timestamp on long-press: aparece inline.
   - Exit: snapshot tests para ambos.

4. **Scroll position pinning**: cuando llega un nuevo message (mock para esta fase), auto-scroll al bottom **si** el user no scrolleó manualmente arriba.
   - Implementar con `.scrollPosition(initialAnchor: .bottom)` + tracker de drag.
   - Exit: ios-simulator-mcp flow: scroll arriba → no auto-scroll; scroll bottom → auto-scroll en el siguiente add.

5. **Matched geometry** para avatar character: en Home/People, tap card → push ChatView con `matchedGeometryEffect(id: "char-\(id)")`. El avatar "vuela" durante la transición.
   - Exit: ios-simulator-mcp verifica visualmente que la transition tiene continuidad.

### Verificación de la fase

- `BuildProject` + `RunAllTests` green.
- `RenderPreview` de `ChatView` populated.
- ios-simulator-mcp:
  ```
  Home → tap a conversation → ChatView abre con messages visibles
  Scroll up → posición se queda; scroll bottom → snap to last
  Back swipe → vuelve a Home
  ```
- Coverage `Features/Chat/`: ≥ 60% (sube en Fase 5).

### Riesgos

- **Bubble rendering con char accent dinámico**: la sintaxis SwiftUI para border + accent color por character requiere `Environment` injection o prop drilling. Mitigación: `@Environment(\.charAccent)` en ChatView, propagada a bubbles.
- **`AttributedString(markdown:)`** puede fallar con markdown sutil (e.g. asteriscos sin matching). Mitigación: try/catch → fallback a `Text(plain)`. Reportar gaps a Q3.3.

### Deuda producida

- Composer no funciona (Fase 5).
- Toolbar buttons (⋯, 📷, ⓘ) no operativos (Fase 7, 8).
- Variant pagination dots (Fase 7).

### Estado

- [ ] Pendiente.

---

## Fase 5 — SSE streaming (the big one)

### Goal

Send message + recibir streaming del Conversation Agent funcional end-to-end. Manejo de los 5 modos de flujo (Normal / Grammar paralelo / Grammar serial / Regenerate / Reinforcement re-POST) + 7 tipos de eventos (start/token/correction/rewrite_required/grammar_error/error/done). Cancel mid-stream. Reintento. Backpressure controlado.

Esta es **la fase de mayor riesgo** y la que más distingue iOS de la implementación web — vale invertir.

### Inputs requeridos

- Fase 4 completed (ChatView render + read funcional).
- `tech-stack.md` §6 (Cliente HTTP + SSE).
- `api-contract.md` §3.2 (protocolo `/chat` documentado en detalle).
- Q3.3 resuelta sobre markdown (afecta cómo se rendean tokens entrantes).
- **iPhone físico disponible para test real** (no solo simulator).

### Subtasks

1. **`SSEClient` real**:
   ```swift
   func eventStream(for request: URLRequest) -> AsyncThrowingStream<SSEEvent, Error>
   ```
   - Usa `URLSession.bytes(for:)`, parsea por `\n\n`, decodifica `event:` y `data:` lines, retorna eventos tipados.
   - Cancelación via task termination handler.
   - Tests: feedea bytes raw simulando los 7 event types, asserta el yield correcto.
   - Exit: `xcodebuild test -only-testing:storyplotsTests/SSEClientTests` pasa.

2. **`ChatStreamEvent` enum + decoding**:
   ```swift
   enum ChatStreamEvent: Decodable {
       case start(messageID: String, variantID: String)
       case token(text: String)
       case correction(CorrectionPayload)
       case rewriteRequired(CorrectionPayload)
       case grammarError(message: String)
       case error(message: String)
       case done(messageID: String, variantID: String)
   }
   ```
   - Init from `SSEEvent` (string event name + JSON data).
   - Tests: cada event type decodifica correctamente.
   - Exit: tests pasan.

3. **`Composer` funcional**:
   - TextField multi-line auto-grow (36pt → 120pt).
   - Send button con estados: hidden (no text) / enabled (text > 0) / loading (streaming) / cancel (durante stream → stop icon).
   - Keyboard-aware layout: `safeAreaInset(.bottom)` con el composer.
   - On send: hand-off al ChatViewModel que dispara stream.
   - Exit: `RenderPreview` muestra estados; ios-simulator-mcp interactivo: type + send.

4. **`ChatViewModel.streamChat()`** + handling de los 5 modos:
   - State machine: `idle → optimisticUserAdded → streaming → done` (o `error`).
   - Optimistic user message: insert en local state ANTES de send (UX feel).
   - Insertar user message via `supabase.from("messages").insert(...)` antes del POST (mismo patrón que web).
   - POST a `/chat` con body apropiado.
   - Consume `eventStream`:
     - `start` → crear assistant bubble vacía.
     - `token` → buffer; flush al UI cada 30 ms via `Task.sleep(for: .milliseconds(30))` loop.
     - `correction` → insertar inline row debajo del user msg correspondiente con animation slide.
     - `rewrite_required` → bloquear composer + mostrar rewrite gate UI.
     - `grammar_error` → silent log + toast suave.
     - `error` → mostrar banner + descartar bubble parcial.
     - `done` → cerrar bubble; refresh state.
   - Tests con mock SSE: verifica cada modo de flujo termina con state correcto.
   - Exit: tests por modo de flujo pasan.

5. **Cancel + retry + edge cases**:
   - Tap stop button durante stream → cancel `Task` → cierra `URLSessionTask` → backend cierra recursos.
   - Network drop mid-stream → error con banner "Connection lost, retry?" + button.
   - Re-POST tras agotar reinforcement → state lo refleja.
   - Backgrounding la app durante stream → stream sigue corriendo si la app vuelve al foreground en < ~30s; si la kill OS, retry al next launch.
   - Exit: ios-simulator-mcp + device físico verifica casos manualmente, anotar resultados.

### Verificación de la fase

- `BuildProject` + `RunAllTests` green.
- Coverage `Features/Chat/Streaming/`: ≥ 80% (lógica crítica).
- ios-simulator-mcp:
  ```
  Open chat → type "hello" → tap send → bubble user aparece → typing indicator → tokens fluyen → done
  Type another → tap send → tap stop mid-stream → bubble parcial marca "stopped" → retry
  Long-press un msg → "Regenerate" → nueva variant entra streaming
  Configure grammar ON con reinforcement → type un mensaje con error → ver rewrite gate
  ```
- **Device físico via XcodeBuildMCP**: el iPhone del creator (14 Pro Max) corre la build, performa el flow completo (incluye verificar latencia real, no del simulador).
- Snapshot tests de ChatView en estados: idle, streaming, error, rewrite-gate.
- Metric: time-to-first-token < 300ms en condiciones buenas (red rápida, modelo rápido).

### Riesgos

- **`AsyncThrowingStream` + Swift 6 strict-concurrency** puede generar warnings de `Sendable` conformance. Mitigación: marca explícita o regions donde corresponde.
- **Backpressure mal calibrado** → si tokens llegan muy rápido, 30ms puede ser muy lento (texto se ve trozado) o muy rápido (jitter). Tunear con feedback real.
- **Backend timing edge cases**: `correction` puede llegar antes del primer `token`, después de `done`, o cualquier punto entre. iOS debe manejar.
- **App backgrounding interrumpe la conexión** en iOS de forma silenciosa después de un par de minutos. Tener fallback a "Connection dropped" UI.
- **Memory leak de Task** si el ViewModel se desaloja sin cancelar el stream. Mitigación: `.task { ... }` con `Task.checkCancellation()` en el loop.

### Deuda producida

- Variant pagination UI (entra en Fase 7).
- Fork dialog (Fase 7).
- Edit-as-trim (Fase 7).
- Image generation desde un message (Fase 8).
- Audio TTS (Fase 8).

### Estado

- [ ] Pendiente. **Fase clave** — todo lo que sigue depende.

---

## Fase 6 — Character CRUD

### Goal

Crear character desde scratch (form), editar, accent picker, avatar picker (con avatar fallback de iniciales), delete. Sin generación LLM ni avatar generation aún (eso es Fase 8).

### Inputs requeridos

- Fase 3 completed.
- `api-contract.md` §4.1 (insert/update directo a `characters`).
- `ux.md` §7 (CharacterEditView).

### Subtasks

1. **`CharacterEditViewModel`** con drafts state, dirty flag, save method que hace `upsert` directo a Supabase.
   - Field validation: name required, others opcionales.
   - Exit: tests unit.

2. **`CharacterCreateSheet`** wizard 3-step:
   - Step 1: Identity (name, age, gender hint, avatar).
   - Step 2: Persona (system_prompt textarea, scenario, personality dict).
   - Step 3: Style (accent picker, voice TBD).
   - Bottom: "Back" / "Next" / "Save" (último step).
   - Exit: snapshot tests por step.

3. **`CharacterEditView`** edit mode: lista grouped iOS-style con secciones. Each row: tap → push a editor de ese field.
   - Save automático on field commit (no batch). Optimistic + rollback on error.
   - Delete button (destructive) → confirmation dialog → delete via Supabase.
   - Exit: `RenderPreview` de cada section + flow.

4. **`AccentPicker`**:
   - Grid 4×4 de los 16 preset colors + 1 "Custom" tile que abre `ColorPicker` nativo.
   - Live preview: avatar ring + bubble border preview en top.
   - Exit: snapshot + ios-simulator-mcp tap behavior.

5. **Avatar fallback de iniciales**: si no hay `avatar_ref`, mostrar circle con char accent + iniciales del name.
   - Helper `AvatarView(character: Character)` que decide entre image y iniciales.
   - Exit: snapshot tests para ambos casos.

### Verificación de la fase

- `BuildProject` + `RunAllTests` green.
- ios-simulator-mcp:
  ```
  People → + → New blank → wizard 3-step → Save → character aparece en grid
  Tap character → Detail → Edit → cambiar name → tap field → back → name updated
  Long-press → Delete → confirm → desaparece
  Tap AccentPicker → pick color → ring del avatar refleja cambio live
  ```

### Riesgos

- **Sync con backend**: si el user crea offline → reconciliar al volver online. Default Fase 6: solo online; offline write queue es Fase post-MVP.

### Deuda producida

- Avatar generation flow (Fase 8).
- Character generation desde idea (Fase 6 puede hacerlo, pero default → Fase 8 con el resto de LLM flows).
- Character import desde PNG (Fase 8).

### Estado

- [ ] Pendiente.

---

## Fase 7 — Composer features (long-press, fork, edit-trim, regenerate, variants)

### Goal

Las interacciones avanzadas del chat: long-press menu, fork dialog, edit-as-trim, regenerate, variant swipe entre variantes de un message.

### Inputs requeridos

- Fase 5 completed (streaming funcional).
- `ux.md` §5.2 (Message bubble interactions), §5.6 (Fork), §5.7 (Edit-trim).
- `api-contract.md` §3.4 (Fork endpoint), §3.2 (Regenerate via /chat con `regenerate_message_id`).

### Subtasks

1. **`MessageContextMenu`** nativo SwiftUI `.contextMenu` con preview agrandado:
   - Items: Copy, Edit, Regenerate, Fork from here, Speak (placeholder), Delete.
   - Hooks a ViewModel methods.
   - Exit: snapshot + ios-simulator-mcp long-press flow.

2. **Variant pagination**:
   - Dots indicator (3 dots, active filled) bajo bubble cuando hay > 1 variant.
   - Swipe horizontal → cambia `active_variant_id` (update via Supabase).
   - Animation: cross-fade entre variants con `.smooth`.
   - Exit: tests + visual snapshot.

3. **Fork dialog sheet `.medium`**:
   - Mode picker: "Keep messages" / "Summarize fresh" (Segmented Picker).
   - Optional title input.
   - Confirm → POST `/conversations/{id}/fork` → push a nueva conversation.
   - Loading state (especially summarize_fresh es lento — segundos).
   - Exit: snapshot + interactivo.

4. **Edit-as-trim sheet `.medium`**:
   - TextEditor con el texto del message.
   - Warning destacado: "Editing this message will trim every message after it."
   - Confirm → update message + delete subsequent messages (operations directas a Supabase con un `delete().eq("conversation_id", X).gte("created_at", Y)`).
   - Exit: tests + snapshot.

5. **Regenerate**:
   - From context menu on assistant message.
   - Triggers `/chat` con `regenerate_message_id`.
   - Nueva variant aparece + dots indicator se actualiza.
   - Exit: ios-simulator-mcp flow end-to-end.

### Verificación de la fase

- `BuildProject` + `RunAllTests` green.
- ios-simulator-mcp + device físico:
  ```
  Long-press message → menu visible con preview
  Tap Regenerate → variant nueva entra streaming → done → dots indicator actualizado
  Swipe horizontal → variant cambia
  Tap "Fork from here" → sheet → choose "Summarize fresh" → Confirm → loading → nueva conversation
  Tap "Edit" → trim warning → cambio texto → Save → messages posteriores desaparecen
  ```
- Coverage `Features/Chat/`: ≥ 80%.

### Riesgos

- **Trim atomicidad**: edit-trim hace múltiples deletes; si el primer delete pasa y el segundo falla, queda inconsistente. Mitigación: usar una RPC `trim_after_message` si existe en Supabase (verificar migrations); fallback a delete secuencial con buena confirmación de error.

### Deuda producida

- Audio playback ("Speak" item del menu) — Fase 8.
- Search messages within conversation — fase post-MVP.

### Estado

- [ ] Pendiente.

---

## Fase 8 — Panels + Image generation + Audio + Character LLM flows

### Goal

Side panels (Memory, Grammar, Lorebook, Author's Note, Generation Override, Chat Controls) accesibles desde menu ⋯. Image generation desde un message. TTS playback. Generate/Refine character desde LLM. Avatar generation.

Esta fase agrupa varios features menos críticos pero importantes para paridad funcional con el web.

### Inputs requeridos

- Fase 7 completed.
- `ux.md` §5.5 (side panels), `api-contract.md` §3.5-§3.8.
- Q5.4 resuelta (paneles como sheet vs settings). Default: todos sheet desde ⋯.

### Subtasks

1. **Menu ⋯ + sheet routing** desde Chat toolbar:
   - Menu items con iconos: Memory, Grammar, Lorebook, Author's Note, Generation Override, Chat Controls.
   - Cada uno abre un sheet medium con su content.
   - Exit: ios-simulator-mcp navega cada panel.

2. **Panels individuales** (CRUD directo a Supabase para los que aplican):
   - `MemoryPanel`: lista de `memory_document_chunks` con delete swipe.
   - `LorebookPanel`: CRUD de `lorebook_entries`.
   - `AuthorsNotePanel`: edit `authors_notes` row.
   - `ChatControlsPanel`: upsert `chat_controls_state` (image provider, resolution preset).
   - `GenerationOverridePanel`: ephemeral state passed to next `/chat` POST.
   - `GrammarPanel`: read-only display de corrections del conversation.
   - Exit: snapshots + flows.

3. **Image generation flow** desde un message:
   - `📷` button en MessageBubble (assistant only) → POST `/messages/{id}/images` con optional overrides.
   - Loading state (5-15s típico).
   - Resultado: imagen aparece como `MessageImage` view dentro o cerca del bubble.
   - `ImageViewer` full-screen con pinch-zoom + matched geometry desde thumb.
   - Regenerate con `GenerationOverrides`.
   - Exit: ios-simulator-mcp flow + device físico para latencia real.

4. **Audio TTS flow**:
   - `🔊` button en MessageBubble → POST `/messages/{id}/audio` → `AVAudioPlayer`.
   - Estados: idle → loading → playing → paused.
   - Background audio support (`AVAudioSession.Category.playback`).
   - Exit: ios-simulator-mcp + device físico audio test.

5. **Character LLM flows**:
   - "Generate from prompt" entry → sheet con form (idea + knobs) → POST `/character-generate` → preview prefilled → save.
   - "Import from PNG" entry → document picker → parse card → POST `/character-refine` → preview → save.
   - "Generate avatar" en CharacterEditView → POST `/characters/{id}/generate-avatar` → progress → avatar updates.
   - Exit: ios-simulator-mcp + device físico para los flujos largos.

### Verificación de la fase

- `BuildProject` + `RunAllTests` green.
- Snapshots de todas las sheets.
- ios-simulator-mcp + device físico:
  - Send message → tap 📷 → wait → imagen aparece → tap → full-screen viewer
  - Tap 🔊 → audio play → pause → play (verify resume)
  - People → + → Generate → idea + knobs → loading → preview → save
- Coverage de Image/Audio/LLM flows: ≥ 70%.

### Riesgos

- **Latencia de generaciones**: 10-30s típico. Sin push notification yet, el usuario tiene que esperar con app abierta. Mitigación: copy claro + cancelable.
- **Image bytes grandes**: WebP comprimido del backend está OK, pero si llegan PNGs raw por algún edge case, decode + display lentos. Tests confirman.

### Deuda producida

- Push notifications (Fase 10).
- Background tasks para generaciones largas (post-MVP, ver Q6.1).

### Estado

- [ ] Pendiente.

---

## Fase 9 — Settings + Engines

### Goal

Settings tab completa: header con avatar+name (tap→Profile), grouped list de secciones (Engines, Writing, Data, App), engine config screens (Text/Image/Memory/Voice), Profile, Privacy & Data, Sign out.

### Inputs requeridos

- Fase 8 completed.
- `ux.md` §8 (Settings layout).
- `api-contract.md` §4.1 (lectura/escritura de `provider_configs`, `users.preferences`).

### Subtasks

1. **`SettingsView`** root con grouped list iOS-native (`Form { Section { ... } }`).
   - Header card: avatar + name + email, tap → push Profile.
   - Secciones según `ux.md` §8.
   - "Sign out" destructive al final.
   - Exit: `RenderPreview` con secciones + populated user.

2. **Engine screens** (4 pantallas similares):
   - `TextEngineSettingsView`: list de providers, active toggle, edit/add/delete, test button.
   - `ImageEngineSettingsView`: idem para image, con workflow_config preview.
   - `MemoryEngineSettingsView`: enabled toggle + retrieval params + extraction prompt editable.
   - `VoiceSettingsView`: list de TTS providers + voice picker (ElevenLabs voices via GET endpoint).
   - Todos leen/escriben `provider_configs` directo a Supabase + `users.preferences.{family}` JSONB.
   - Exit: snapshots + flows.

3. **`ProfileView`**: avatar (persona), name, email, edit persona button → opens `PersonaEditSheet`. Read/write `user_personas` directo.
   - Exit: snapshot.

4. **`PrivacyAndDataView`**:
   - Toggle SFW mode (`users.sfw_disabled`).
   - Export data button (vía `lib/dataExport.ts` patterns — TBD si entra al MVP).
   - Delete account button (destructive, irreversible).
   - Exit: snapshot.

5. **Writing config screens** (Roleplay, Visual Roleplay, Writing Styles, Grammar):
   - Read/write `users.preferences.{rp|visual_roleplay|grammar}` JSONB.
   - Forms con toggles + pickers.
   - Exit: snapshots de cada uno.

### Verificación de la fase

- `BuildProject` + `RunAllTests` green.
- ios-simulator-mcp:
  ```
  Settings tab → root visible con header
  Tap Text Engine → ver providers list → tap "Test" → ok response
  Tap Memory → toggle "Enabled" → save → relaunch → setting persiste
  Tap Profile → edit persona → save → header avatar updates
  Tap Sign out → confirm → vuelve a SignInView
  ```
- Snapshots de los 10+ screens nuevos.
- Coverage `Features/Settings/`: ≥ 70%.

### Riesgos

- **Cantidad de pantallas** — 10+ pantallas pueden hacer la fase larga. Mitigación: priorizar las que afectan funcionalidad core (Text Engine, Memory, Voice) y diferir Writing Styles si presiona tiempo.
- **JSONB shape drift**: el frontend espera shapes específicos en `users.preferences.{family}`. iOS debe respetar para no romper compatibilidad cross-platform.

### Deuda producida

- Prompt Editor screen (Q3.X advanced) — diferir a post-MVP.
- Data export/import — diferir si no es crítico al beta.

### Estado

- [ ] Pendiente.

---

## Fase 10 — Pre-TestFlight

### Goal

Push notifications operativos. Universal Links. Capabilities Xcode completas. App Store Connect setup. Archive + upload TestFlight + invite internal testers.

### Inputs requeridos

- Fase 9 completed.
- `api-contract.md` §5 (endpoints v2/ios necesarios).
- Q3.8 resuelta (bundle ID).
- Q6.4 resuelta (Universal Links paths).
- **Apple Developer account** del creator activo, con bundle ID registrado.

### Subtasks

1. **Backend: ruta `/api/v2/ios/push/register`** nueva:
   - Crear `base/backend/app/routes/v2/__init__.py` + `v2/ios/__init__.py` + `v2/ios/push.py`.
   - Implementar el endpoint (ver `api-contract.md` §5.1).
   - Migration Supabase para tabla `push_tokens`.
   - `main.py` incluye el router v2 con prefix `/api/v2/ios/`.
   - Test backend con curl.
   - Exit: el backend acepta `POST /api/v2/ios/push/register` con device_token mock.

2. **iOS push registration**:
   - Permission request en momento contextual (e.g. tras send-message exitoso o desde Settings → Notifications).
   - `UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])`.
   - `UIApplication.shared.registerForRemoteNotifications()`.
   - `didRegisterForRemoteNotificationsWithDeviceToken` → hex → POST a v2/ios.
   - Logout → DELETE v2/ios/push/register.
   - Exit: device físico via XcodeBuildMCP — token registrado en backend, verificable en DB.

3. **Notification handlers**:
   - `UNUserNotificationCenterDelegate` para presentation in foreground.
   - `didReceiveResponse` → router que abre la conversation_id si está en payload.
   - Test con un push manual via APNs CLI (`xcrun simctl push` para simulador).
   - Exit: simulator recibe push → tap → app abre en chat correcto.

4. **Universal Links**:
   - `apple-app-site-association` JSON servido desde el dominio del web (coordinar con creator).
   - Capability "Associated Domains" en Xcode target con `applinks:storyplots.app` (o el dominio real).
   - `onOpenURL(_:)` handler routea: `/chat/<id>` → push ChatView; `/character/<id>` → push CharacterDetail.
   - Exit: device físico recibe link tap, app abre en ruta correcta.

5. **App Store Connect setup + TestFlight upload**:
   - Crear app record en App Store Connect con bundle ID definitivo.
   - Provisioning profiles + automatic signing.
   - Capabilities completas: Push, Background Modes (Remote notifications), Sign in with Apple, Associated Domains.
   - `xcodebuild archive` + `xcodebuild -exportArchive` → ipa.
   - Upload a App Store Connect via `xcrun altool` o Xcode Organizer.
   - Internal Testing group con el creator + ~3 testers iniciales.
   - Privacy nutrition label completado (declarar: Data linked to user — Account; Identifiers — User ID; etc.).
   - Exit: TestFlight email recibido por el creator + 1-2 testers internos.

### Verificación de la fase

- `BuildProject` archive success.
- TestFlight build distribuido + instalable en device del creator.
- ios-simulator-mcp + device físico:
  ```
  Generate image → cerrar app → segundos después → push notification "Image ready"
  Tap notification → app abre en chat correcto, con la imagen visible
  Open Safari → tap link storyplots.app/chat/abc → iOS prompt "Open in StoryPlots" → app abre con esa conversation
  ```
- Métrica: cold launch time < 2.5s en iPhone 14 Pro Max físico.
- Crash-free rate del beta primer fin de semana: 0 crashes (target inicial; difícil de garantizar sin uso real, pero monitoreable).

### Riesgos

- **App Store Review provisional check** (no es submission aún, pero TestFlight tiene su propio review para external testing — internal testing no requiere).
- **Push delivery** puede tardar segundos a minutos según APNs load. No tunear hasta tener datos reales.
- **`apple-app-site-association` requiere HTTPS válido en el dominio**. Si el dominio del web no lo tiene listo, Universal Links no funcionan. Mitigación: empezar TestFlight sin Universal Links si presiona; flag como deuda.
- **Apple rejection por Sign-in-with-Apple incompleto** (e.g. missing nonce, missing scopes) — mitigación: testing temprano antes del submission final.

### Deuda producida (post-TestFlight, no en beta inicial)

- Crash reporting (Q3.7) — agregar si crashes aparecen.
- Background tasks para generaciones (Q6.1).
- Foundation Models integration (Q9.X).
- Live Activities / Dynamic Island.
- Light mode (Q2.2).
- Localización a español (Q2.3).
- Voice input (Q5.5).
- Attach image al composer (Q5.6).
- Markdown advanced (MarkdownUI si AttributedString no alcanzó — Q3.3).

### Estado

- [ ] Pendiente. **Hito final del MVP**.

---

## Fase 11 — IA Realignment + Missing Surfaces

### Goal

Reemplazar la IA TabView (Home/People/Settings) — que escondió Gallery, Grammar
dashboard, Character Import, Visual Roleplay, Prompt Editor y Memory user-
settings bajo Settings sin terminar de construirlos — por
`NavigationSplitView` con sidebar/drawer que espeja la web. Construir todas
las surfaces faltantes. Honra el non-negotiable §6.11 de creator-vision
("paridad estructural con web") y la nueva IA en ux.md §2.

### Inputs requeridos

- `seed/ux.md` §2 (post-ARCH-001) — sidebar + drawer + 3 destinations + grouped recent chats + footer
- `seed/creator-vision.md` §6.11 — paridad estructural no negociable
- `base/frontend/src/routes/Gallery.tsx`, `Grammar.tsx`, `CharacterImport.tsx`, `VisualRoleplaySettings.tsx`, `PromptEditor.tsx`, `MemorySettings.tsx` — referencias web a portar
- `base/frontend/src/features/shell/Sidebar.tsx`, `RecentChats.tsx`, `YourPersonaCard.tsx` — patrón sidebar

### Subtasks

1. **AppShell con NavigationSplitView**
   - Crear `AppShellView` (reemplaza `MainTabView`). `NavigationSplitView(sidebar:detail:)` con preferred column visibility automatic.
   - En iPhone se colapsa a single-column con botón hamburguesa (sistema lo da gratis).
   - `MainTabView` deja de ser referenciado; eliminar después de smoke test.
   - **Verify**: build green, app abre con sidebar visible (iPad) o drawer accessible (iPhone).

2. **SidebarView con wordmark + 3 destinations**
   - `SidebarView` con header wordmark grande (`Image("Wordmark")` 48pt tall).
   - 3 NavigationLinks: Home / Characters / Gallery. SF Symbols: `house.fill` / `person.crop.rectangle.stack.fill` / `photo.stack.fill`.
   - `@SceneStorage` para preservar destination seleccionado.
   - **Verify**: tap cada destination, contenido cambia en detail column.

3. **Recent Chats agrupados por character**
   - `SidebarRecentChats` carga conversations, agrupa por `character_id`, ordena por `max(last_message_at)` por grupo descending.
   - Cada row colapsado: avatar character + nombre + count chats. Tap → push a `CharacterChatsView`.
   - `CharacterChatsView` lista chats del character; tap → push a `ChatView` real.
   - **Verify**: con seed data (24 conversations), agrupado en 8 characters, sin repetición.

4. **Sidebar footer: Persona + Settings + Sign out**
   - `YourPersonaCard` (avatar + nombre persona) tap → `ProfileView` push.
   - `Settings` NavigationLink → `SettingsView` hub.
   - `Sign out` con confirmation dialog → `auth.signOut()`.

5. **Home rebuild**
   - Reemplazar lista de chats por: `RecentCharactersStrip` (5 cards horizontal scroll) + `GrammarWidget` + `HomeNudge` cuando empty.
   - Mantener wordmark+header brand wash (de Fase 11 polish).
   - **Verify**: visible que Home muestra characters, no chats; widget Grammar tap navega a dashboard.

6. **Gallery — surface nueva**
   - `GalleryView`: LazyVGrid 2-col de `generated_images` ordered by created_at desc. Signed URLs via `SupabaseStorageHelper`.
   - Tap → `ImageViewer` fullscreen con matched geometry.
   - Long-press → confirm delete via `DELETE /images/{id}`.
   - Empty state editorial.

7. **Grammar dashboard — surface nueva**
   - `GrammarDashboardView`: accuracy gauge (`grammar_aggregates`), recent corrections list (`grammar_corrections` últimas 20), top error categories. "Run insights now" button → `POST /insights/run`.
   - Distinto de `GrammarSettingsView` (config). Distinto del panel de chat (scoped a conversation).

8. **Character Import — surface nueva**
   - `CharacterImportSheet`: `PhotosPicker` → PNG seleccionado → leer tEXt chunk con `CGImageSource` properties → parse Character Card v1/v2/v3 (objeto `raw_card`).
   - `POST /character-refine` con `raw_card` + format detectado → `CharacterRefineResult`.
   - Review sheet (mismo flow que CharacterGenerate) → save via `CharacterEditViewModel`.
   - Wire en `+` Menu de Characters como tercera opción.

9. **Settings sub-screens missing**
   - `VisualRoleplaySettingsView`: toggle enabled, auto-mode, POV picker, custom_instructions. Persist a `users.preferences.visual_roleplay`.
   - `PromptEditorView`: TextEditor grande con system prompt template + variable hints `{{char}}`, `{{user}}`, `{{persona}}`. Persist a `users.system_prompt_template` o `preferences.prompt_template`.
   - `MemorySettingsView`: user-facing toggles separado de `MemoryEngineSettingsView` (que retiene config provider/model). Split: enabled, retention, extraction_frequency van a MemorySettings; provider_config_id + embedding_model van a MemoryEngine.

10. **Update SettingsView con nuevos rows**
    - Engines: Text / Image / Memory Engine / Voice (unchanged).
    - Writing: Roleplay / Visual Roleplay / Writing Styles / Grammar (settings) / Prompt Editor / Memory (settings).
    - App: Profile / Privacy & Data / About (Gallery deja de ser alias aquí — vive como destination top-level).

11. **Eliminar TabView code path**
    - Remover `MainTabView` después de smoke test.
    - Update `storyplotsApp` para entrypoint en `AppShellView`.
    - Tests + RenderPreview snapshots actualizados.

### Verificación de la fase

- BuildProject: green sin warnings.
- RunAllTests: ≥ tests pre-Fase-11 (no regression).
- ios-simulator-mcp smoke test:
  - Sidebar abre con swipe-from-edge o hamburger button.
  - Wordmark visible en sidebar header.
  - 3 destinations + chats agrupados render.
  - Tap chat row → Character chats list → individual chat.
  - Gallery muestra imágenes generadas.
  - Grammar widget en Home tap → dashboard.
  - Character Import flow corre end-to-end con una PNG card de prueba.
  - Settings → cada nueva sub-screen abre.
- RenderPreview snapshots para `AppShellView`, `SidebarView`, `GalleryView`, `GrammarDashboardView`, `CharacterImportSheet`, los 3 new settings views — default + Reduce Transparency ON.

### Riesgos

- NavigationSplitView en iPhone con drawer auto-collapse es estable en iOS 26 pero el comportamiento puede sentirse distinto al de Apple Mail. Plan B: si la UX se siente off, custom drawer con `.gesture(DragGesture)`.
- PNG tEXt chunk parsing es non-trivial; algunos Character Card v2/v3 vienen base64-encoded en distintos keys. Plan B: si no parsea, mostrar error claro "Card format unsupported" y dejar al user usar Generate o Manual.
- Recent Chats agrupado por character puede sentirse "too few rows" si el user tiene 1 chat por character. Métrica: ≥5 grupos = OK; <5 = mostrar también flat list debajo.

### Deuda producida

- Snapshot test harness (`swift-snapshot-testing` SPM dep) sigue pending — se hace formalmente al cierre de Fase 11.
- LaunchScreen storyboard con wordmark — pending de Fase 11 polish round, sigue pending.

### Estado

- **Pending** (a generar el plan con `/prp-plan` al cerrar la edición del seed).

---

## Fases post-TestFlight (referencia, no parte de este roadmap)

Cuando llegue el momento, estas son las próximas fases lógicas:

| Fase | Nombre | Outcome |
|---|---|---|
| 11 | App Store submission | Build pasa review pública, app live en Store. |
| 12 | Crash reporting + telemetry | Sentry-cocoa con opt-in declarado. |
| 13 | Light mode + system | Asset catalog migration, theme switching. |
| 14 | Localización ES | String catalog + traducciones. |
| 15 | Voice input / attach image | Composer enriquecido. |
| 16 | Foundation Models | Grammar/memory local fallback. |
| 17 | iPad layout | Adaptive layout, sidebar reborn. |
| 18 | Live Activities / Widgets | Generación en curso visible en lock screen. |

---

## Cross-cutting concerns

### Testing strategy por fase

Cada fase entrega tests específicos. Targets agregados al ir avanzando:

- **Fase 0**: 3-5 unit tests sample.
- **Fase 1-2**: tests por feature (auth, home) ≥ 70% coverage local.
- **Fase 5**: tests de SSE parser, decoding, ChatViewModel state machine ≥ 80%.
- **Fase 10**: total project coverage ≥ 65%, critical paths (chat/auth/persistence) ≥ 80%.

XCUITest entra al final con los 3 flows críticos (sign-in, send-message, create-character).

### Performance budget

| Métrica | Target inicial | Cómo se mide |
|---|---|---|
| Cold launch | < 2.5s | `os_signpost` desde `didFinishLaunching` hasta `RootView appeared` |
| Time-to-first-token (TTFT) en chat | < 300ms desde send | `os_signpost` send tap → first token render |
| Scroll FPS en chat con 200 messages | ≥ 58 fps | Instruments Time Profiler |
| Memory @ idle en chat con history | < 150 MB | `xcrun simctl spawn` |
| Memory @ streaming en chat | < 200 MB | idem |

Si alguna métrica falla, **abrir un plan dedicado** antes de avanzar a la siguiente fase.

### Logging / observability

`OSLog` con subsystem `com.storyplots.ios` y categorías por feature:
- `auth`, `network`, `chat-stream`, `image-gen`, `audio`, `db`, `app-lifecycle`.

Levels: `debug` (off en release), `info`, `error`, `fault`.

En release: solo `info` + `error` + `fault`. Visible via Console.app + sysdiagnose.

### Verificación final pre-TestFlight

Pre-submission a TestFlight, run-through:
- [ ] Todos los tests pasan (`RunAllTests`).
- [ ] No memory leaks detectables en Instruments Leaks 5 min de uso normal.
- [ ] App responde al cambio de Dynamic Type (`AccessibilityXXXLarge`).
- [ ] VoiceOver navega chat y settings sin trampas.
- [ ] No hay `print()` ni `dump()` en código de release.
- [ ] No hay tokens / API keys / URLs hardcoded en código.
- [ ] App Store Connect Privacy nutrition label completado.
- [ ] Build firmado con team + bundle ID correctos.

---

## Cómo este archivo se mantiene

Al terminar una fase:
1. Marcar `Estado: ✅ Completed YYYY-MM-DD` con link al plan ejecutado (`plans/NNNN-fase-X-slug.md`).
2. Anotar deuda real producida vs prevista en la sección "Deuda producida" de la fase.
3. Si el roadmap cambió (e.g. una subtask se fragmenta, una fase se reordena), actualizar las dependencies en §0.

Al descubrir gaps durante ejecución:
- Si es algo que afecta solo a la fase actual → resolver en el plan de esa fase.
- Si afecta una fase futura → editar la fase futura aquí + nota explicando por qué.
- Si afecta el seed (e.g. una decisión arquitectónica que cambia tech-stack o api-contract) → escalar al creator + actualizar el seed primero, luego este roadmap.

Nunca se sobrescribe en silencio. Cada cambio sustancial lleva fecha + razón.
