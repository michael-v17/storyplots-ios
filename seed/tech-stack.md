# Tech Stack — StoryPlots iOS

> Decisiones técnicas formalizadas para el frontend iOS nativo.
> Cada sección tiene la decisión, los tradeoffs visibles, y las alternativas que se rechazaron y por qué.
> Inputs: `creator-vision.md`, `api-contract.md`, código real de `base/`.

---

## 1. Alcance del stack

Aplica al app iOS nativo en `storyplots/` y, eventualmente, a un paquete Swift compartido si tiene sentido. **No** aplica al backend (Python/FastAPI) ni al web (React/Vite). El backend es referencia + dependencia; el web es referencia visual y de comportamiento.

iPhone únicamente. Sin iPad, sin Mac, sin watchOS, sin App Clip — al menos no en esta fase.

---

## 2. Lenguaje y target

- **Swift 6** con strict-concurrency en `complete`. Si una dependencia produce friction inviable, bajar a `targeted`. **No** bajar a Swift 5.10 salvo bloqueo duro.
- **Toolchain**: **Xcode 26.3+** (la versión Apple-era 2025/2026 con year-based naming). El simulador del proyecto corre **iOS 26.5**.
- **iOS Deployment Target**: **iOS 26.0**. Justificación:
  - **Liquid Glass** — el design language iOS 26 (translucent materials, blur backgrounds, depth) es nativo. Targetear más bajo significa renunciar a esto o emularlo (mal).
  - **Foundation Models framework** — LLM on-device de Apple (~3B parámetros) disponible. Posibles usos en StoryPlots: grammar fallback offline, memory extraction local, replies cacheados sin red. Es opcional integrarlo, pero solo disponible iOS 26+.
  - **Apple Intelligence APIs** (Translation, Writing Tools, Image Playground) totalmente disponibles.
  - **SwiftUI maduro**: `@Observable`, SwiftData estable, `.snappy`/`.bouncy`/`.smooth`, `NavigationStack` con `path` enum, `ScrollView` con `scrollPosition`, `safeAreaInset`, mejoras de `Layout`.
  - **Trade-off de mercado**: cortar usuarios en iOS 18 o anterior. Acceptable para un app de producto premium / engaged power-users en iPhones modernos. Si el creator decide priorizar alcance, bajar a iOS 18.0 mínimo es la fallback razonable (perdés Liquid Glass automático + Foundation Models pero conservás Apple Intelligence APIs).
- **Architecture**: arm64 + arm64 simulator. No x86_64.

---

## 3. UI framework

- **SwiftUI primario**. Toda la UI nueva se escribe en SwiftUI.
- **UIKit interop** solo donde SwiftUI falla concretamente:
  - `UIViewControllerRepresentable` para controllers de sistema (Document Picker, Photo Picker — `PhotosPickerItem` ya cubre el caso normal, así que rara vez).
  - `UITextView` con attributed text rico (Markdown inline) cuando `Text` no alcanza — aunque preferimos `AttributedString` + `Text` antes que recurrir a esto.
  - Custom transitions interactivas (rare).
- **Sin librerías de UI de terceros.** Cero SnapKit, cero PureLayout, cero "iOS UI Kit". El polish nativo viene de usar SwiftUI bien, no de librerías que prometen "Material-on-iOS".
- **Excepciones autorizadas (por confirmar)** **[REVIEW]**:
  - **Markdown rendering**: el chat necesita renderizar Markdown con énfasis, bullets, code blocks, y posiblemente imágenes inline. `Text` + `AttributedString` cubre 80% pero falla con bullets multi-nivel y code blocks coloreados. Candidatos: [MarkdownUI (gonzalezreal)](https://github.com/gonzalezreal/swift-markdown-ui) o parser propio. Decisión: probar `AttributedString` con `init(markdown:)` primero. Si visible-feels-off (bullets feos, code blocks sin background), entonces autorizar MarkdownUI con review explícita.
  - **SF Symbols extras**: Apple Symbols 5+ ya cubre casi todo. Si en algún momento se necesita un icon custom, va a Assets como SVG — no librería.

### Liquid Glass y materials (iOS 26)

El design language nativo iOS 26 usa **materials translúcidos** (`.regularMaterial`, `.thinMaterial`, `.ultraThickMaterial`, `.bar`) sobre `.background()` para sheet headers, navigation bars, tab bars, chips elevados. Reglas:
- **No emular** Liquid Glass con blur custom + opacidad. Usar los modificadores nativos.
- `.glassEffect()` (donde aplique) para elementos chrome que deben adoptar el efecto del sistema.
- Liquid Glass **acentúa** la jerarquía visual sin pelear con los tokens — los colores de `Theme.Color` siguen siendo la base; los materials se aplican por encima en navigation chrome, sheet handles, etc.
- En diseños donde Liquid Glass entra en tensión con `Theme.Color.bg`/`bg2` (e.g. fondos sólidos que no respiran), se evalúa por superficie. Default: chrome del sistema usa materials; el cuerpo de pantalla usa los tokens sólidos.

### Foundation Models (iOS 26+)

Opcional pero disponible. Casos donde podría ayudar:
- **Grammar fallback offline**: si el backend no responde, correr grammar local sin red.
- **Memory extraction local** para significance baja (significance ≥ 4 sigue siendo backend).
- **Quick suggestions** en composer ("complete this sentence", "tone shift").

Si entra al MVP o no — decisión en `open-questions.md`. Default actual: **no en MVP**, evaluar post primer release.

### Patrones SwiftUI fijos

- **NavigationStack** + `navigationDestination(for:)` con path enum. **No** `NavigationView` (deprecated).
- **TabView** solo si la información architecture lo amerita (se decide en `ux.md`).
- **Sheets**: `.sheet(item:)` con bindings claros. Detents nativos (`.medium`, `.large`, `.fraction(_)`, `.height(_)`).
- **ScrollView con LazyVStack** para listas largas (lista de mensajes, characters). **No** `List` para chat — `List` impone separadores y comportamientos que pelean con bubbles custom. Para Settings y Characters list sí `List` es razonable.
- **Animations**: `withAnimation(.snappy)` o `.spring(response:dampingFraction:)`. Evitar `.linear` salvo para indicador de progreso.

---

## 4. Concurrencia

- **Swift Concurrency** (`async`/`await`, `Task`, `actor`, `TaskGroup`) por defecto.
- **`@MainActor`** en view models y todo lo que toca UI.
- **Actores** para cualquier shared mutable state cross-Task (cache de imágenes, estado de la conexión SSE, etc.).
- **`Task.detached`** solo cuando sea explícitamente necesario que la prioridad o el contexto sean otros — evitar por default.
- **No Combine** salvo donde una API de Apple ya lo expone (algunos `Notification` publishers). No diseñar capas custom con Combine.
- **No GCD manual** salvo casos puntuales (`DispatchQueue.main.async` sigue OK para emergencias o interop con APIs viejas).

### Cancelación

Cada Task que dura más de unos ms debe respetar `try Task.checkCancellation()`. El SSE de chat **es** cancelable; cuando el usuario navega fuera, el `URLSessionDataTask` se cancela, lo cual cierra el TCP del lado iOS y el backend lo nota en su lado.

---

## 5. State management y dependency injection

- **`@Observable`** (iOS 17 macro) para view models. Reemplazo directo de `@ObservableObject` + `@Published`.
- **`@State`** local en views para ephemeral UI state (animaciones, focus, sheets abiertos).
- **`@Environment`** para inyección de dependencias (auth state, theme, services). Custom `EnvironmentKey` para servicios propios:
  ```swift
  private struct ChatServiceKey: EnvironmentKey {
      static let defaultValue: ChatService = LiveChatService()
  }
  extension EnvironmentValues {
      var chatService: ChatService { get { self[ChatServiceKey.self] } set { self[ChatServiceKey.self] = newValue } }
  }
  ```
- **DI library**: **ninguna** por defecto. SwiftUI's `@Environment` + protocols cubren el 95%. Si en algún momento se vuelve dolor (multi-target tests con muchos mocks), evaluar [`swift-dependencies` (Point-Free)](https://github.com/pointfreeco/swift-dependencies). **[REVIEW]** — decisión a tomar si llega ese punto, no antes.
- **No** TCA (The Composable Architecture) por defecto. Es brillante pero impone arquitectura completa; queremos SwiftUI idiomático primero.

---

## 6. Networking + SSE

### Dos zonas de acceso a datos

Verificado leyendo el frontend (`api-contract.md` §1): el sistema usa **dos** capas para acceder a datos. iOS replica ambas:

- **Zona A — Backend FastAPI**: para lógica con LLM o server-side multi-paso (chat streaming, char gen, image gen, TTS, fork con summary, insights). 18 endpoints. Cliente HTTP custom + SSE.
- **Zona B — Supabase PostgREST directo**: para CRUD simple sobre tablas del user (characters, conversations, messages, preferences, lorebook, etc.) — RLS scopes al user. Usa `supabase-swift`.

### Cliente HTTP custom (Zona A)

- **URLSession** + cliente custom thin. No Alamofire, no Moya.
- **Estructura**:
  ```swift
  protocol APIClient {
      func send<R: Decodable>(_ endpoint: Endpoint<R>) async throws -> R
      func stream<E: Decodable>(_ endpoint: SSEEndpoint<E>) -> AsyncThrowingStream<E, Error>
  }
  ```
- **Endpoints** como structs con `path`, `method`, `body`, `responseType`. Componible vía generics.
- **Auth**: interceptor que agrega `Authorization: Bearer <jwt>` (y `apikey: <anon>` cuando aplique) automáticamente, leyendo de un `AuthStore` actor que comparte sesión con `supabase-swift`.

### Cliente Supabase (Zona B)

- **`supabase-swift`** maneja: auth (`signInWithIdToken`, `signOut`, refresh), PostgREST (`from("table").select/insert/update/delete`), Storage (signed URLs, uploads).
- **Patrón de uso**: cada feature que es CRUD del user llama directo. Ejemplos del web (a portar):
  - Listar tus characters: `supabase.from("characters").select("*").order("updated_at", { ascending: false })` → en Swift: `try await supabase.from("characters").select().order("updated_at", ascending: false).execute()`.
  - Borrar conversation: `supabase.from("conversations").delete().eq("id", id)`.
  - Update preferences: read `users.preferences` → modify JSONB → update.
- **NO se llaman RPCs directamente desde iOS** (verificado: ningún `supabase.rpc(...)` en frontend). Las RPCs son orquestación interna del backend.

### SSE específicamente

El `/chat` endpoint requiere parser SSE custom. Approach:

```swift
extension URLSession {
    func eventStream(for request: URLRequest) -> AsyncThrowingStream<SSEEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let (bytes, response) = try await self.bytes(for: request)
                    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                        throw SSEError.badStatus
                    }
                    var buffer = ""
                    for try await line in bytes.lines {
                        buffer += line + "\n"
                        while let range = buffer.range(of: "\n\n") {
                            let frame = String(buffer[..<range.lowerBound])
                            buffer.removeSubrange(..<range.upperBound)
                            if let event = SSEEvent.parse(frame) {
                                continuation.yield(event)
                            }
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}
```

Eventos del backend (ver `api-contract.md` §3.2) se modelan como enum Swift:

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

Backpressure: los `token` events se acumulan en un buffer `@MainActor` y se flushean cada 30 ms (`DispatchSourceTimer` o `Task.sleep`). Sin esto, SwiftUI re-renderiza por cada token y es jittery en streams rápidos.

---

## 7. Persistencia local

- **SwiftData** (iOS 17+) como persistencia primaria local.
  - Cache de conversaciones, mensajes, characters para lectura offline.
  - **No** es source-of-truth — el backend lo es. SwiftData es cache.
  - Sincronización lazy: al abrir una conversación, leer cache + hacer fetch al backend, reconciliar.
- **`UserDefaults`** para prefs simples (theme, haptics on/off, last seen character).
- **Keychain** para tokens sensibles (Supabase refresh token, Apple Sign-In identity, etc.). Wrapper: `KeychainAccess` o capa propia thin sobre `Security.framework`. **[REVIEW]** — decidir si depender de `KeychainAccess` (popular, mantenido) o escribir 30 líneas wrapper propias. Default: wrapper propio.
- **No Core Data** salvo razón fuerte. SwiftData es la apuesta moderna y suficiente para este perfil de datos.
- **No Realm** ni stores de terceros.

### Modelo de cache

Esquema conceptual (no atado a SwiftData exactamente):
```
CachedCharacter (id, name, avatar_url, accent_color, updated_at)
CachedConversation (id, character_id, title, last_message_at, message_count)
CachedMessage (id, conversation_id, role, text/active_variant_content, created_at)
```

Estas tres tablas reflejan **subset** de las tablas backend; ni RLS ni triggers se replican.

---

## 8. Auth

- **Provider de identidad**: Supabase via [`supabase-swift`](https://github.com/supabase-community/supabase-swift) (oficial / community-supported).
- **Flujos soportados**:
  1. Email/password (paridad con web).
  2. **Sign in with Apple** via `AuthenticationServices.framework` → `ASAuthorizationAppleIDProvider` → identity token → `supabase.auth.signInWithIdToken(provider: .apple, idToken:)`. La sesión Supabase resultante alimenta el flujo normal de JWT al backend.
  3. Magic link / passwordless: **[REVIEW]** si entra al MVP.
- **Token storage**: Supabase Swift SDK guarda en Keychain por defecto. Confirmar al integrar.
- **Refresh**: automático via SDK. Si el JWT expira mid-stream, el SDK refresca y el cliente re-emite. El backend devuelve `401` si el JWT recibido es expired, lo cual debería gatillar refresh + retry.
- **Logout**: `supabase.auth.signOut()` + limpiar caché local de SwiftData + de-registrar device token.

Sign-in-with-Apple es **requerido** por App Store Review Guidelines §4.8 si la app tiene cualquier social login. Como tenemos email/password (Supabase), oficialmente no es obligatorio. Lo agregamos igual por UX (es el flow que más usan los usuarios iOS power-user).

---

## 9. Push notifications + background

### Push (APNs)

- **`UNUserNotificationCenter`** para registro y delegate.
- **Capabilities**: Push Notifications + (eventualmente) Background Modes → Remote notifications, Background fetch, Background processing.
- **Registro**:
  1. App pide permiso en momento contextual (no en cold start).
  2. Recibe device token → manda a `POST /api/v2/ios/push/register` (ver `api-contract.md` §4.1).
  3. Maneja `didFailToRegisterForRemoteNotificationsWithError` gracefully.
- **Payload esperado del backend**: estándar APNs con `aps.alert`, `aps.sound`, y un `payload` custom con `conversation_id`, `kind` (`image_ready` | `generation_done` | etc.).
- **Tap routing**: deep link → abre la conversación.

### Background tasks **[REVIEW]**

Si una generación se inicia y la app se va al background, dos opciones:

1. **No hacer nada**: el server-side termina, eventualmente manda push notification, el usuario abre la app y ve el resultado en el chat.
2. **`BGTaskScheduler`** con tarea `.processing` que sondea `/chat/poll` (endpoint que no existe aún) o que abra una conexión SSE liviana para esperar el `done`.

Default: opción (1). Más simple, más respetuoso del battery del usuario, no requiere endpoints nuevos.

---

## 10. Deep links + Universal Links

- **Universal Links** vía `apple-app-site-association` servido desde el dominio web. Backend (o un static host del web) sirve `.well-known/apple-app-site-association` con paths:
  ```
  /chat/<conversation_id>
  /character/<character_id>
  ```
- **iOS handler**: `onOpenURL(_:)` + `NavigationStack.path` para empujar el destino correcto.
- **URL scheme custom** (`storyplots://`) **[REVIEW]** — solo si hay un caso real (e.g. share-extension). Por defecto, no.

---

## 11. Imágenes y media

- **`AsyncImage`** para imágenes remotas simples.
- **Capa de caché propia** sobre `URLCache` + `NSCache<NSURL, UIImage>` para imágenes que aparecen muchas veces (avatars). El web tiene `urlCache.ts` — patrón equivalente en iOS.
- **Photos integration**:
  - `PhotosPicker` (SwiftUI iOS 16+) para que el user adjunte una imagen al composer (si se decide soportar).
  - Para guardar imagen generada → `PHPhotoLibrary.requestAuthorization` + `PHAssetCreationRequest`.
- **Image viewer** (`features/chat/ImageViewer.tsx` en web): SwiftUI con `Image` + `.scaleEffect` + `MagnificationGesture` + `DragGesture` para pan/zoom.

---

## 12. Audio

- **AVFoundation** primario.
- **`AVAudioPlayer`** para mp3/opus recibidos del endpoint TTS.
- **`AVAudioSession`** category `.playback` con `.mixWithOthers` opcional (para no cortar música del usuario).
- **Estados** del botón de audio en `MessageBubble`: idle → loading → playing → paused → idle. Animación de la barra de progreso si el audio dura más de unos segundos.
- **Voice input al composer** **[REVIEW]** — Speech framework + `SFSpeechRecognizer` es opcional. Si entra al MVP, requiere permiso `Privacy - Speech Recognition Usage Description` en Info.plist + tratamiento de errores cuando el OS denega.

---

## 13. Testing

### Estrategia

- **XCTest** para lógica pura (parsers, mappings, view models sin SwiftUI).
- **Swift Testing** (la nueva framework de Apple) si el proyecto adopta Swift 6 + Xcode 16. Migrar gradualmente, no Big Bang.
- **Snapshot testing de SwiftUI**: via Xcode MCP `RenderPreview` (sin simulador necesario) — la primera red de seguridad visual.
- **XCUITest** para flows críticos end-to-end (login, send-message, fork). Pocos, lentos, mantenidos.
- **Test data**: factory functions, no fixtures de archivos. Pure Swift.

### Gates

- Cada feature: tests unit + un snapshot test de la pantalla principal afectada. Sin tests, no se considera done (ver creator-vision §6.8).
- **Code coverage** no es metric obsesivo, pero se trackea en CI. Threshold inicial: 60% líneas, sube a 70% post MVP.

### MCPs iOS (los 3 declarados por el creator)

Prioridad estricta. Si uno falla, saltar al siguiente:

1. **Apple Xcode MCP** (`xcrun mcpbridge`) — siempre. Es la base. Requiere:
   - Xcode 26.3+ (16.3+ rebrandeado, **confirmar versión exacta del entorno actual**).
   - Settings → Intelligence → Model Context Protocol → ON.
   - Comando:
     ```bash
     claude mcp add --transport stdio xcode -- xcrun mcpbridge
     ```
   - Provee: `BuildProject`, `RunAllTests`, `RenderPreview` (visual de SwiftUI sin simulador), `DocumentationSearch` (docs Apple + WWDC), `ExecuteSnippet` (Swift REPL), file ops.
   - Requiere Xcode abierto.

2. **XcodeBuildMCP** — añadir cuando empiece iteración real:
   ```bash
   claude mcp add XcodeBuildMCP -- npx -y xcodebuildmcp@latest mcp
   ```
   - Provee: builds headless (sin Xcode abierto), deploy a iPhone físico vía cable, LLDB attach, breakpoints, gestión completa de simuladores.
   - Cuando: al iniciar la fase de pruebas reales en device.

3. **ios-simulator-mcp** — añadir solo si el `RenderPreview` no alcanza:
   ```bash
   claude mcp add ios-simulator -- npx -y ios-simulator-mcp
   ```
   - Provee: ui_tap, ui_swipe, accessibility tree completo de la pantalla.
   - Requiere IDB instalado: `brew install idb-companion && pipx install fb-idb --python python3.11`.
   - Cuando: para verificar flows multi-step que el preview estático no cubre (e.g. composer keyboard handling, sheet dismiss gestures).

### Patrón de uso en sesiones

Cada session que toca código iOS arranca con:
```
1. Verificar que Apple Xcode MCP está activo (`claude mcp list`).
2. Si entra deploy o headless build → activar XcodeBuildMCP.
3. Si entra verificación interactiva → activar ios-simulator-mcp.
```

Más detalle en `dev-runbook.md` (generado por kickoff ECC).

---

## 14. Dependencias externas (lista cerrada inicial)

Solo las que son justificables. Cualquier adición requiere review explícita.

| Paquete | Para qué | Justificación |
|---|---|---|
| `supabase-swift` | Auth + Postgrest reads | Oficial Supabase. Cubre auth con Apple Sign-In via `signInWithIdToken`. |
| `swift-collections` (opcional) | `OrderedDictionary`, `Deque` si hace falta | Apple, estable, micro-overhead. Solo si el código lo pide naturalmente. |

**Probable que NO entren**:
- Alamofire — URLSession alcanza.
- Combine third-party — Swift Concurrency cubre.
- SwiftyJSON — `Codable` cubre.
- Lottie — animaciones SwiftUI nativas.
- Sentry/Crashlytics — **[REVIEW]** se evalúa post-MVP. Sentry-cocoa es una posibilidad si llegamos al punto de querer crash reporting; lo evaluamos como decisión separada.

---

## 15. Build & CI

- **Local builds**: Xcode normal, via Apple Xcode MCP en sesiones AI.
- **Headless builds**: via XcodeBuildMCP cuando hace falta (CI, sesiones AI sin Xcode abierto).
- **CI provider**: **[REVIEW]** — opciones:
  - Xcode Cloud (Apple-native, integrado, ~ $50/mes incluido en developer membership). Simple.
  - GitHub Actions con runner macOS. Más customizable, más lento por boot de runner.
  - Default: empezar sin CI hasta tener algo deployable. Decidir cuando aparece la necesidad real.
- **Signing**: Automatic signing con el equipo del creator. App Store provisioning cuando llegue el momento. **[REVIEW]** bundle identifier final (`com.storyplots.ios` o equivalente — confirmar con el creator).
- **Distribución**: TestFlight para internal/external testing antes de App Store.
- **Releases**: tagged releases en GitHub + builds firmados subidos a App Store Connect via Xcode (manual al inicio; automatizar con `fastlane` o Xcode Cloud después si justifica).

---

## 16. Bundle identifier, App Store metadata **[REVIEW]**

Decisiones pendientes para el primer build firmado (no bloquean codigo, sí bloquean TestFlight):
- Bundle ID definitivo (`com.storyplots.app`, `com.storyplots.ios`, `app.storyplots.ios` — preferencia del creator).
- App name visible (`StoryPlots`).
- Icon (puede empezar genérico, se reemplaza por uno bueno antes de TestFlight).
- Capabilities mínimas: Push, eventually Background Modes, eventually Sign in with Apple, eventually Universal Links (associated domains).

---

## 17. Alternativas rechazadas (con tradeoffs)

| Alternativa | Por qué se descartó |
|---|---|
| UIKit primario en lugar de SwiftUI | iOS 17+ permite SwiftUI puro sin compromisos serios. Menos boilerplate, mejores animaciones de primera. UIKit interop disponible para casos puntuales. |
| React Native | El objetivo es "native feel", reusar la base React no es la meta — re-implementar lo es. RN sería un compromiso a media. |
| Flutter | Mismo razonamiento. Además se aleja del idiomático iOS. |
| Combine como capa de eventos | Swift Concurrency cubre el caso. Combine queda solo donde Apple lo expone. |
| Core Data | SwiftData es el reemplazo moderno y suficiente. Core Data se queda en proyectos legacy. |
| TCA (Composable Architecture) | Impone arquitectura completa. Empezamos SwiftUI idiomático; si la complejidad explota, evaluamos. |
| Alamofire | URLSession + 100 líneas wrapper resuelven. Una dependencia menos. |
| Realm | SwiftData ya cubre. Realm agrega dependencia + magic. |
| Lottie para animaciones | SwiftUI nativo + spring presets dan el mismo polish con cero dependencias. |

---

## 18. Decisiones aún `[REVIEW]`

Centralizadas en este archivo, también listadas en `open-questions.md`:

1. ~~iOS deployment target~~ — **Resuelto**: iOS 26.0 mínimo, fallback iOS 18 si se prioriza alcance.
2. Foundation Models on-device — entra MVP o evaluación post-release.
3. Markdown rendering — `AttributedString` first, MarkdownUI si no alcanza.
4. swift-dependencies (DI) — solo si tests se vuelven dolor.
5. Magic link auth — entra MVP o no.
6. Voice input via Speech framework — MVP o fase 2.
7. Background tasks (BGTaskScheduler) para generación — default no, evaluar más adelante.
8. Keychain wrapper — propio thin vs `KeychainAccess` librería.
9. CI provider — Xcode Cloud, GH Actions, o nada al inicio.
10. Crash reporting — Sentry-cocoa o nada al MVP.
11. Bundle ID definitivo + capabilities iniciales.

Cada `[REVIEW]` se resuelve antes del plan que lo necesite — no antes.

---

## 19. Cambios a este archivo

Cualquier cambio sustancial al stack (e.g. agregar dependencia, cambiar persistence, mover el min iOS target) requiere:
1. Justificación escrita en el plan correspondiente.
2. Update a este archivo con fecha + razón.
3. Approval del creator si toca §6 (networking), §8 (auth) o §10 (deep links).

Cambios menores (agregar un `@Observable` aquí, ajustar nombre de protocolo allá) no requieren update — viven en el código.
