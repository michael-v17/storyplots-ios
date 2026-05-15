# Open Questions — StoryPlots iOS

> Append-only. Pressure valve para ambigüedades del seed que no bloquean *empezar* pero sí bloquean *terminar* alguna fase específica.
> Cada entrada tiene: **Decisión pendiente**, **Origen**, **Default si no se decide**, **Cuándo se necesita resolver**.
> Cuando una pregunta se resuelve, se mueve a §99 "Resolved" con fecha + decisión final.

---

## 1. Cómo se usa este archivo

- **Origen**: si una decisión emerge mientras se trabaja en un archivo del seed, se anota acá con cita al archivo y sección.
- **Default**: cada pregunta lleva una respuesta tentativa. Si no se aprueba explícitamente, ese default toma efecto cuando llegue el momento de implementar. **Nunca** una pregunta queda sin default — el default puede ser "esperamos a decidir y bloqueamos esa fase".
- **Cuándo resolver**: explícito. Algunas preguntas pueden esperar al ciclo donde aplican; otras bloquean ciclos críticos. Ese campo evita re-litigar prioridades.
- **Resolved**: cuando el creator decide, la entrada se mueve a §99 con fecha y la decisión final reemplaza al "Default". Las nuevas preguntas siempre van arriba; las resueltas se acumulan al final.

---

## 2. Producto y alcance

### Q2.1 — Idioma de la UI

- **Decisión pendiente**: ¿UI en español, inglés, o ambos con localización?
- **Origen**: `creator-vision.md` §9.7. El web tiene strings mezcladas; el seed v1 está en inglés; partes del CLAUDE.md están en español.
- **Default**: empezar **inglés-only** para MVP. Localización en fase posterior si justifica.
- **Cuándo**: antes de empezar a escribir copy / strings catalog.

### Q2.2 — Light mode

- **Decisión pendiente**: ¿soportar light mode en MVP o solo dark?
- **Origen**: `creator-vision.md` §8.1, `design.md` §10, `ux.md` §14.
- **Default**: **dark-only en MVP**. App fuerza `.preferredColorScheme(.dark)`. Light mode entra en fase 2 con asset catalog variants.
- **Cuándo**: antes de implementar el Theme inicial. Cambio post-implementación es trabajoso.

### Q2.3 — Localización futura

- **Decisión pendiente**: si Q2.1 dice inglés-only inicial, ¿se planea localización a español en fase 2? ¿Otros idiomas?
- **Origen**: Q2.1.
- **Default**: localización a español como fase posterior. Otros idiomas según mercado.
- **Cuándo**: post MVP, no bloquea.

---

## 3. Stack técnico

### Q3.1 — iOS deployment target

- **Decisión pendiente**: ¿iOS 17 (recommended) o iOS 16?
- **Origen**: `tech-stack.md` §2, `creator-vision.md` §7.
- **Default**: **iOS 17**. Por `@Observable`, SwiftData estable, mejores spring animations.
- **Cuándo**: antes del primer build firmado. Cambio retroactivo es relativamente barato (iOS 17→16) pero costoso al revés.

### Q3.2 — Swift 5.10 vs Swift 6

- **Decisión pendiente**: ¿activar strict concurrency mode completo (Swift 6) o stay en Swift 5.10 con concurrency en `minimal`?
- **Origen**: `tech-stack.md` §2.
- **Default**: **arrancar con Swift 6 strict-concurrency en `complete`**. Si Supabase Swift SDK o alguna otra dependencia produce friction inviable, bajar a Swift 5.10 con strict-concurrency `targeted`.
- **Cuándo**: día 1 al crear el proyecto. Decisión revisable en cualquier ciclo.

### Q3.3 — Markdown rendering

- **Decisión pendiente**: ¿`AttributedString.init(markdown:)` (built-in) o MarkdownUI (gonzalezreal)?
- **Origen**: `tech-stack.md` §3, `creator-vision.md` §6.9.
- **Default**: **probar `AttributedString` primero**. Si bullets multi-level / code blocks visiblemente fallan, autorizar **MarkdownUI** como excepción a la regla "sin librerías de UI de terceros".
- **Cuándo**: durante el primer plan que toque rendering de mensajes ricos (Chat message bubble).

### Q3.4 — DI library

- **Decisión pendiente**: ¿`swift-dependencies` (Point-Free) o environment-keys propias?
- **Origen**: `tech-stack.md` §5.
- **Default**: **environment-keys propias**. Si los tests se vuelven dolor (muchos mocks por target), evaluar swift-dependencies.
- **Cuándo**: cuando se note el dolor real, no antes.

### Q3.5 — Keychain wrapper

- **Decisión pendiente**: ¿wrapper propio thin (~30 líneas) o `KeychainAccess` librería?
- **Origen**: `tech-stack.md` §7.
- **Default**: **wrapper propio**. Una dependencia menos.
- **Cuándo**: antes del primer plan que persista refresh tokens / secretos.

### Q3.6 — CI provider

- **Decisión pendiente**: ¿Xcode Cloud, GitHub Actions, o nada inicial?
- **Origen**: `tech-stack.md` §15.
- **Default**: **nada al inicio**. Local builds via Xcode + MCPs alcanzan hasta TestFlight. Cuando se necesite distribución regular, evaluar Xcode Cloud (default por simplicidad Apple-native).
- **Cuándo**: antes del primer TestFlight build distribuido.

### Q3.7 — Crash reporting

- **Decisión pendiente**: ¿Sentry-cocoa, Firebase Crashlytics, o ninguno?
- **Origen**: `tech-stack.md` §14, principio de creator-vision §6.10 (sin trackers opacos).
- **Default**: **ninguno en MVP**. Apple Crash Reports + symbolication via App Store Connect alcanza para iniciar. Sentry-cocoa solo si se necesita reporting más rico, declarado al usuario con opt-in.
- **Cuándo**: post-MVP si el operator necesita más visibilidad.

### Q3.8 — Bundle identifier definitivo

- **Decisión pendiente**: `com.storyplots.ios`, `com.storyplots.app`, `app.storyplots.ios`, o el que prefiera el creator.
- **Origen**: `tech-stack.md` §16.
- **Default**: **`com.storyplots.ios`** como placeholder. Confirmar antes de primer build firmado (no se puede cambiar después sin friction).
- **Cuándo**: antes del primer build TestFlight.

---

## 4. Auth y identidad

### Q4.1 — Sign-in-with-Apple: rol

- **Decisión pendiente**: ¿Apple Sign-In como opción adicional o como método principal de auth?
- **Origen**: `creator-vision.md` §4 y §9.4, `api-contract.md` §2, `tech-stack.md` §8.
- **Default**: **opción adicional**. Email/password de Supabase queda como primario; Apple Sign-In se añade en pantalla auth como botón secundario prominent (recommended pattern de iOS). App Store guidelines no lo exigen (no hay otros social providers), pero usuarios iOS power-user lo esperan.
- **Cuándo**: en el ciclo de Auth flow.

### Q4.2 — Magic link auth

- **Decisión pendiente**: ¿soportar magic link (passwordless via email) en MVP?
- **Origen**: `tech-stack.md` §8.
- **Default**: **no en MVP**. Email/password + Apple Sign-In es suficiente.
- **Cuándo**: si se evalúa, post-MVP.

---

## 5. UX y interacciones

### Q5.1 — Tab name: "People" vs "Characters"

- **Decisión pendiente**: ¿"People" (más natural) o "Characters" (consistency con web)?
- **Origen**: `ux.md` §2.
- **Default**: **"People"** por naturaleza mobile. El creator confirma si prefiere consistency con el web.
- **Cuándo**: antes del primer plan de tab bar.

### Q5.2 — People grid: tap behavior

- **Decisión pendiente**: tap en character card va a → Edit view (lectura) o directo a Chat (start new conversation)?
- **Origen**: `ux.md` §7.
- **Default**: **tap → Edit view en read-only mode**, con botón "Chat now" en toolbar. Doble-tap o long-press preview → opción directa a chat. Es el patrón menos sorpresivo y permite gestures rica en el grid.
- **Cuándo**: ciclo People tab.

### Q5.3 — CharacterEditView landing mode

- **Decisión pendiente**: ¿abre en read-only requiriendo botón "Edit" o entra directamente a edit mode?
- **Origen**: `ux.md` §17.
- **Default**: **read-only landing** con botón "Edit" en toolbar. Consistente con HIG y reduces accidental edits.
- **Cuándo**: ciclo de Character flow.

### Q5.4 — Side panels en Chat: sheet o settings

- **Decisión pendiente**: ¿Cuáles de los 7 paneles (Memory, Grammar, Lorebook, Author's Note, Generation Override, Chat Controls, Image Viewer) viven como sheet en menu ⋯ vs en Settings de la conversation?
- **Origen**: `ux.md` §5.5.
- **Default**: **MVP — todos como sheet desde menu ⋯**. Frecuencia de uso real dirá cuáles pasar a settings persistentes después.
- **Cuándo**: cuando se diseñe cada panel. Decisión por panel, no global.

### Q5.5 — Voice input en composer

- **Decisión pendiente**: ¿`Speech` framework integration en MVP o fase 2?
- **Origen**: `creator-vision.md` §9.3, `tech-stack.md` §12, `ux.md` §5.4.
- **Default**: **fase 2**. MVP arranca sin voice input. Es featurevaluable pero requiere permiso, manejo de errores, UX state complejo.
- **Cuándo**: cuando el plan de Composer lo considere.

### Q5.6 — Attach image en composer

- **Decisión pendiente**: ¿soportar attach de imagen al composer en MVP?
- **Origen**: `ux.md` §17.
- **Default**: **fase 2** salvo que sea esencial al flow de chat. **El creator confirma si el web ya lo soporta y es feature crítica** — si sí, sube a MVP.
- **Cuándo**: si el web ya tiene este flow, arranca como MVP. Si es exploratorio, fase 2.

### Q5.7 — Double-tap gesture

- **Decisión pendiente**: ¿qué hace double-tap? Posibles: zoom imagen 2x, like message, regenerate, nada.
- **Origen**: `ux.md` §9.
- **Default**: **double-tap reservado y sin asignación**. Mejor que un gesture rara o con expectativa rota.
- **Cuándo**: cuando aparezca un flow que justifique un gesto rápido.

### Q5.8 — Pull-to-refresh scope

- **Decisión pendiente**: ¿en qué surfaces aparece pull-to-refresh?
- **Origen**: `ux.md` §17.
- **Default**: **Home y People** (chats recientes, characters). **No** en Chat (poll automático ya keeps en sync). **No** en Settings.
- **Cuándo**: por surface, cuando se implementa.

---

## 6. Features avanzadas

### Q6.1 — Background tasks para generaciones largas

- **Decisión pendiente**: ¿`BGTaskScheduler` para esperar generaciones (imagen, character) en background?
- **Origen**: `creator-vision.md` §4 y §9.5, `tech-stack.md` §9.
- **Default**: **no en MVP**. Backend completa generación + manda push notification cuando hay device token registrado. Usuario abre app y ve resultado.
- **Cuándo**: si el flow de generación se vuelve doloroso por interrupciones de app lifecycle.

### Q6.2 — Offline mode

- **Decisión pendiente**: ¿alcance del modo offline? Solo read-cache, o también cola de envíos pendientes?
- **Origen**: `creator-vision.md` §4 y §9.6.
- **Default**: **read-only cache en MVP**. Conversations y characters cacheados son legibles offline. Envío de mensajes requiere red — composer disabled con banner. Cola de envíos pendientes es fase 2.
- **Cuándo**: ciclo de SwiftData cache.

### Q6.3 — IAP (in-app purchase)

- **Decisión pendiente**: ¿el app tendrá subscriptions o IAP en algún momento?
- **Origen**: `api-contract.md` §4.3.
- **Default**: **no en MVP**. Si llega, va a v2/ios/iap/verify y App Store guidelines de IAP.
- **Cuándo**: cuando se discuta business model.

### Q6.4 — Universal Links

- **Decisión pendiente**: ¿qué paths se soportan vía Universal Links?
- **Origen**: `tech-stack.md` §10.
- **Default**: **`/chat/<conversation_id>` y `/character/<character_id>`**. Requiere servir `apple-app-site-association` desde el dominio del web. Coordinar con whoever serves the web.
- **Cuándo**: ciclo de deep linking / push.

### Q6.5 — Apple Sign-In post-link a Supabase

- **Decisión pendiente**: ¿qué hace el app si el usuario tiene cuenta con email A en web y firma con Apple ID que retorna email B? ¿Link, error, crear cuenta nueva?
- **Origen**: emergente al implementar Q4.1.
- **Default**: **crear cuenta nueva** (Supabase trata identity providers separados). Si el creator quiere account linking, requiere flow custom. Default conservador: cuentas separadas.
- **Cuándo**: ciclo de Auth.

---

## 7. Visual

### Q7.1 — Custom typeface adicional

- **Decisión pendiente**: ¿se agrega alguna typeface custom (e.g. una display font para headings tipo Marketing/Splash)?
- **Origen**: `design.md` §14.
- **Default**: **no**. SF Pro cubre. Custom typeface es complicación gratuita en MVP.
- **Cuándo**: si aparece una razón concreta de marca.

### Q7.2 — OKLab vs simple opacity para char accent derivados

- **Decisión pendiente**: ¿usar simple `.opacity()` o implementar mezcla OKLab manual para los 4 derivados del char accent?
- **Origen**: `design.md` §3.7.
- **Default**: **simple opacity en MVP**. Si visualmente se nota diferencia, refinar.
- **Cuándo**: si en review de visual se nota off.

### Q7.3 — Iconos custom (wordmark, mark)

- **Decisión pendiente**: ¿dónde viven el wordmark y mark SVGs?
- **Origen**: `design.md` §14.
- **Default**: `storyplots/Assets.xcassets/Logo/` con variants wordmark + mark. Convertir de SVG a PDF template para que `Color` aplique correctamente. **El creator confirma si tiene los assets actualizados o si se reusan del web (`base/extras/` o equivalente)**.
- **Cuándo**: cuando se necesite mostrarlos (Splash, Auth screen, About).

---

## 8. Backend / API

### Q8.1 — Endpoint v2/ios specifics

- **Decisión pendiente**: ¿prefijo exacto para rutas iOS-specific? `/api/v2/ios/`, `/api/ios/v1/`, `/api/v2/`?
- **Origen**: `api-contract.md` §1.
- **Default**: **`/api/v2/ios/`**. Versionado explícito + namespace iOS-specific.
- **Cuándo**: al implementar la primera ruta v2/ios (probablemente push registration).

### Q8.2 — Push payloads: formato exacto

- **Decisión pendiente**: ¿qué campos custom irán en cada tipo de push payload?
- **Origen**: `api-contract.md` §4.1, `tech-stack.md` §9.
- **Default**: tres tipos iniciales:
  - `image_ready`: `{ kind: "image_ready", conversation_id, message_id, image_url }`
  - `generation_done`: `{ kind: "generation_done", character_id }`
  - `system`: `{ kind: "system", title, body }`
- **Cuándo**: ciclo de push notifications.

### Q8.3 — Endpoints v1 deprecados

- **Decisión pendiente**: ¿hay endpoints v1 que iOS debería evitar porque están deprecados?
- **Origen**: `api-contract.md` §5.
- **Default**: **ninguno conocido** al momento de este seed. Cuando iOS empiece a integrar, revisar `base/SESSION_HANDOFF.md` por flags de deprecation antes de cliente.
- **Cuándo**: al implementar el cliente API.

---

## 9. Verificación y testing

### Q9.1 — Snapshot testing tool

- **Decisión pendiente**: ¿usar Apple Xcode MCP `RenderPreview` exclusivamente, o también `swift-snapshot-testing` para image diffs en CI?
- **Origen**: `tech-stack.md` §13.
- **Default**: **`RenderPreview` exclusivamente en MVP**. Sin imagen-diff en CI. Cuando se quiera prevenir regresiones visuales más sistemáticamente, agregar swift-snapshot-testing como excepción autorizada.
- **Cuándo**: si aparecen regresiones visuales recurrentes.

### Q9.2 — XCUITest scope

- **Decisión pendiente**: ¿qué flows justifican XCUITest? Es lento, frágil; vale solo para lo crítico.
- **Origen**: `tech-stack.md` §13.
- **Default**: **tres flows iniciales**: (1) sign-in con email + sign-out; (2) send-message básico (open chat → type → send → receive token → done); (3) create character + chat. Más solo si justifica.
- **Cuándo**: ciclo de testing infrastructure.

---

## 99. Resolved

### Q2.1 — Idioma de la UI

- **Resuelto: 2026-05-15**
- **Decisión final**: **English-only en MVP**. Localización a español como fase posterior, otros idiomas según mercado.
- **Razón**: el creator confirmó priorizar simpleza sobre alcance inicial; reduce trabajo de strings catalog en MVP.

### Q3.1 — iOS deployment target

- **Resuelto: 2026-05-15**
- **Decisión final**: **iOS 26.0** mínimo. Toolchain Xcode 26.3+. Simulador del proyecto corre iOS 26.5.
- **Razón**: el creator priorizó **calidad sobre alcance** ("no hacerlo tan viejo si me quita calidad"). iOS 26 desbloquea Liquid Glass automático, Foundation Models on-device, Apple Intelligence APIs completas. Cortar ~25-30% del mercado actual es trade-off aceptado para un app premium en iPhones modernos.
- **Implicaciones para el seed**: `tech-stack.md` §2 y §3 actualizados; `design.md` mantiene los tokens hex pero con materials nativos (`.regularMaterial`, `.glassEffect`) en chrome de navigation/sheet/tab; Foundation Models como capability declarada disponible (uso a decidir en Q9.x).

### Q9.X — Foundation Models on-device como fallback **(nueva)**

- **Decisión pendiente**: ¿usar `FoundationModels` framework (iOS 26+) como fallback local para grammar check / memory extraction?
- **Origen**: Q3.1 resuelta a iOS 26 → desbloquea la posibilidad.
- **Default**: **no en MVP**. El backend ya hace grammar y memory bien. Foundation Models entra solo si aparece un caso real (e.g. usuario sin red repetidamente, latencia inaceptable).
- **Cuándo**: si en testing del MVP aparece dolor concreto sin red.
