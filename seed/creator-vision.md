# Creator Vision — StoryPlots iOS

> Layer 1 del seed. Documento de intención del creator para la migración iOS.
> Redactado por el AI en base a contexto de conversación + estado del web. El creator lo revisa y
> ajusta los puntos marcados `[REVIEW]` antes de avanzar a tech-stack.

---

## 1. Por qué iOS, por qué ahora

StoryPlots web está vivo y funcionando (89+ ciclos, v0.1 beta). El web cubre desktop y mobile responsive — pero responsive web en un teléfono nunca es lo mismo que un app nativo. Animaciones que en web son aceptables se sienten lentas; gestos que en web son convenciones discretas (long-press, swipe-back) en mobile son expectativas básicas; el chrome de Safari Mobile come pantalla y rompe inmersión.

La meta de esta migración no es replicar el web en iOS. Es **construir lo que el web no puede ser**: una experiencia nativa, fluida y pulida, donde cada animación tenga peso físico, cada transición sea de spring real, y cada gesto se sienta como del sistema operativo. Las decisiones técnicas se subordinan a esa sensación.

El backend no toca esta migración. Las rutas, prompt assembly, providers, y schema siguen siendo verdad. iOS se conecta al mismo backend, con autenticación equivalente, y con cualquier endpoint nuevo que necesite agregándose bajo un prefijo aislado (e.g. `/api/v2/ios/...`) sin tocar las rutas vigentes.

---

## 2. Lo que se mantiene del web

Estas son las decisiones del proyecto que no se renegocian en la migración:

- **Dominio completo**: personas/character, conversations, messages, forks, branches, memorias, lorebook, grammar corrections, insights, images, audio (TTS). Las entidades y sus relaciones son las mismas; las migraciones de Supabase son la verdad.
- **Modelo de chat**: streaming SSE de tokens, prompt assembly orquestada en backend, soporte de re-generación, branching/fork, edit-as-trim, reinforcement passes. iOS consume todo eso vía API; no reimplementa lógica de chat.
- **Providers**: OpenAI, ElevenLabs, fal.ai, ComfyUI, OpenRouter — todo lo que el backend ya orquesta sigue intacto.
- **Auth**: Supabase como provider de identidad. JWT bearer hacia el backend.
- **Paleta y tokens visuales**: el sistema de color, tipografía, jerarquía de surfaces, y la firma amber/sunset orange viven en `base/frontend/src/styles/tokens.css` y son la fuente visual canónica. Los mismos valores van a iOS — el polish nativo no es "otra paleta", es "los mismos tokens con animaciones nativas y componentes nativos".
- **Per-character accent**: cada character tiene su propio color de acento (`--char-accent` en web). Esa idea sigue — solo cambia la implementación (SwiftUI tint + ambient color application).
- **SF Pro**: ya es la tipografía del web. En iOS es la del sistema. No hay debate.

---

## 3. Lo que se cambia / mejora

Estas son las áreas donde la migración no es transcripción — es repensar en términos iOS:

### Navegación
El web tiene un sidebar (desktop) + columna única (mobile). iOS abandona ambos patrones por completo:
- **`NavigationStack` push-based** para profundizar en jerarquías (Home → Chat → MessageDetail, Characters → CharacterEdit).
- **Sheets** para acciones modales (composer settings, fork dialog, generation override). Tamaños presentados nativos (`.medium`, `.large`, `.fraction(0.45)`).
- **Tabs** si el split lo amerita — por confirmar en `ux.md`.
- **Swipe-back nativo** funciona automático en `NavigationStack`. Cualquier custom navigation que rompa esto es anti-pattern.

### Animaciones
SwiftUI permite animaciones de spring físicamente realistas con una línea de código. El web usa transitions CSS — el iOS no debe verse así. Patrones esperados:
- Spring por defecto en transiciones de view (`.response: 0.4, dampingFraction: 0.8`).
- Matched geometry effects para transiciones character-card → character-detail.
- Streaming de chat: los tokens aparecen con animación sutil (fade + slight translate), no "pop" abrupto.
- Loading states: pulse o shimmer nativo, no spinners genéricos donde se puede evitar.
- Botón de send: subtle bounce on tap, color shift mientras está streaming.
- Pull-to-refresh con haptics.

### Gestos
- **Long-press** sobre un mensaje abre el `MessageContextMenu` (igual que web, pero como `.contextMenu` nativo de iOS con preview).
- **Swipe horizontal** sobre mensaje: reservado (probablemente para fork o regenerate — definir en `ux.md`).
- **Pinch-to-zoom** sobre imágenes en `ImageViewer`.
- **Haptics** en acciones destructivas y confirmaciones — `.impact(.medium)` al enviar mensaje, `.notification(.success)` al completar generación, `.warning` antes de delete.

### Modales
Se eliminan los modales web (`Modal.tsx`, etc.) y se reemplazan por:
- `.sheet()` para flows transactional (crear character, configurar prefs).
- `.confirmationDialog()` para destructive actions.
- `.alert()` solo para errores duros.

### Composer
Web tiene un textarea expandible al fondo. iOS:
- `TextField` multi-línea con keyboard-aware layout.
- Send button con color brand cuando hay texto, gris cuando vacío, animación de loading mientras stream.
- Soporte de attachments (imágenes) — definir alcance en `ux.md`.
- Voice input opcional usando `Speech` framework. **[REVIEW]** — confirmar si entra en MVP o queda para después.

### Tipografía dinámica
iOS Dynamic Type debe funcionar de fábrica. SF Pro escalado por Apple respeta accessibility. No se hardcodean `font-size: 14px`-equivalentes en `.font(.system(size: 14))`; se usa `.font(.body)`, `.font(.headline)`, etc., y se mapean los estilos del web a los text styles del sistema.

---

## 4. Lo que se agrega (no existe en web)

- **Sign-in-with-Apple** además de email/password. App Store lo exige si hay otros social providers. **[REVIEW]** — confirmar si Apple Sign-In es solo "una opción más" o reemplaza al flow de email.
- **Push notifications** vía APNs para:
  - Mensajes asíncronos completados (e.g. generación de imagen, character generation que toma segundos).
  - Reminders / actividad (a definir).
  - Registro del device token requiere un endpoint nuevo en backend → `/api/v2/ios/push/register`.
- **Universal Links** para abrir conversaciones específicas desde notificaciones o shared links.
- **Background tasks**: si una generación de imagen está en curso y el usuario cierra la app, debería completarse en background (BGTaskScheduler) y notificar al volver. **[REVIEW]**.
- **Haptics** sistemáticos (ver §3).
- **Modo offline básico**: leer caché de conversaciones y characters cuando no hay red. Envío de mensajes sin red queda en cola y se sincroniza al recuperarla. **[REVIEW]** — define ambición del offline support.
- **Galería nativa** para `Gallery` route: integración con `Photos` framework para guardar imágenes generadas.

---

## 5. Lo que NO va al MVP iOS

Este es el alcance que se difiere conscientemente — no es que no sea valioso, es que no entra al primer ciclo iOS:

- **iPad layout**. El target inicial es iPhone únicamente. Si se decide soportar iPad después, será otra fase.
- **Mac Catalyst / iPad apps**.
- **watchOS** companion app.
- **App Clip** para deep linking a conversaciones públicas.
- **Widgets** (home screen, lock screen).
- **iCloud sync** específico de iOS — la sincronización va por Supabase, no por CloudKit.
- **Live Activities / Dynamic Island** para mostrar generación en curso. Atractivo pero no esencial al MVP.
- **iMessage extension** para compartir characters/conversations.
- **Siri shortcuts**.

Cualquiera de estos puede entrar en una fase posterior si el roadmap lo amerita.

---

## 6. Principios no-negociables (iOS-specific)

Reglas que ningún ciclo puede violar. Si una de estas se rompe, se revierte el cambio.

1. **No web views.** Cero `WKWebView` para chat, characters, settings. Si una pantalla resulta tentadora de hacer con HTML embebido por ahorrar tiempo, se hace en SwiftUI. Excepción legítima: render de Markdown rico con LaTeX o sintaxis exótica si es necesario — pero por defecto, parser nativo.
2. **No tokens hardcodeados.** Todo color, radio, espacio, tipografía sale de un sistema central (`Theme.Color.brand1`, `Theme.Radius.card`, etc.). Mapeado desde `tokens.css`. Buscar literales hex en una review es señal de problema.
3. **SwiftUI primero, UIKit donde haya que.** No se mezclan por gusto. UIKit interop solo cuando SwiftUI realmente no tiene equivalente (e.g. `UITextView` con attributed text muy complejo, custom transitions específicas).
4. **Concurrencia moderna.** Swift Concurrency (`async`/`await`, `Task`, actors) por defecto. No Combine, no callbacks, no GCD manual salvo casos puntuales.
5. **El backend no se daña.** Cualquier endpoint nuevo va aislado bajo `/api/v2/ios/...` (o equivalente). Las rutas existentes siguen sirviendo al web sin tocarse.
6. **Native feel sobre paridad literal.** Si una elección "fiel al web" se siente mal en iOS, gana la versión iOS. Documentar la divergencia en `ux.md` con justificación.
7. **Accessibility por defecto.** Dynamic Type, VoiceOver labels, contrast ratios respetados. Nunca un control que solo funcione por ojo.
8. **Testing como gate por feature, no como afterthought.** Cada feature ships con tests (XCTest unit + snapshot via Xcode MCP `RenderPreview`). Sin tests no se considera done.
9. **Sin librerías de UI de terceros.** SwiftUI puro + UIKit interop solo lo nativo. No SnapKit, no Lottie por gusto, no UI kits comerciales. **[REVIEW]** — confirmar si la regla admite excepción para casos específicos (e.g. Markdown rendering).
10. **Sin trackers ni analytics opacos al usuario.** Si se agrega analytics, va declarado, opt-in donde la regulación lo exija.

---

## 7. Preferencias de stack (formalizadas en `tech-stack.md`)

Las preferencias declaradas acá son inputs para `tech-stack.md`. La decisión final con tradeoffs vive ahí:

- **Lenguaje**: Swift, última versión estable.
- **UI**: SwiftUI primario.
- **Target iOS mínimo**: **iOS 26.0** (Liquid Glass nativo, Foundation Models, Apple Intelligence APIs completas). Fallback razonable iOS 18 si se prioriza alcance — pero el creator confirmó priorizar calidad sobre alcance, así que iOS 26 queda.
- **Persistencia local**: SwiftData salvo veto explícito.
- **Networking**: URLSession + cliente custom; no Alamofire por defecto.
- **Auth**: Supabase Swift SDK + Sign-in-with-Apple.
- **Streaming**: URLSession `bytes(for:)` para SSE.
- **Audio**: AVFoundation.
- **Imágenes**: AsyncImage + capa de caché propia.
- **Push**: UNUserNotificationCenter + APNs.

---

## 8. Look & feel — la sensación

No es una checklist, es la pauta que cualquier review usa para decidir si algo se siente bien o se siente "como port de web":

- **Negro suave**: los fondos de tokens (`--sp-bg` = `#0F0F10`, `--sp-bg-1`/`-2`/`-3`) son near-black neutros, no violet. La app es oscura por defecto — modo dark es el mood, no una opción. **[REVIEW]** — confirmar si soportamos modo light o solo dark (mi default: solo dark inicial, light en fase posterior).
- **Amber signature**: el gradiente `--sp-brand-1 → --sp-brand-2` (amber → sunset orange) es la firma. Aparece en CTAs primarios, wordmark, accents importantes. No se diluye con otros colores brand.
- **Per-character accent**: cada conversation/character pinta sus propios elementos clave (bubble border, glow, button accent) con el `--char-accent` del character. Esto crea identidad por conversation sin un sistema de color global pesado.
- **Tipografía editorial**: el feel debe acercarse a Notion / Linear / Things 3 más que a chat apps tipo Telegram. Espacio generoso, jerarquía clara, hyphenation natural, line-height respirable.
- **Animaciones con peso**: spring real (no linear), velocidades coherentes (response típica 0.35–0.5s), entrada y salida simétricas. Nada cae sin transición.
- **Haptics frugales pero presentes**: no en cada tap, sí en acciones que cierran (send), confirman (success), o advierten (warning).
- **Silencio visual**: no abusar de bordes, divisores, sombras. El web ya tiende a esto con los tokens de border-soft; iOS lo lleva un paso más, usando elevation natural (`.background`, `.shadow`) con criterio.

---

## 9. Decisiones marcadas `[REVIEW]`

Antes de avanzar a `tech-stack.md`, el creator confirma o modifica:

1. **Modo light en iOS** — ¿solo dark inicial, o ambos desde el día 1?
2. ~~**iOS mínimo**~~ — **Resuelto: iOS 26.0** (calidad sobre alcance; Liquid Glass nativo).
3. **Voice input en composer** — ¿MVP o fase 2?
4. **Sign-in-with-Apple** — ¿una opción adicional o el método principal de auth?
5. **Background tasks** para generaciones largas — ¿MVP o fase 2?
6. **Offline mode** — ¿read-only cache MVP, o también queue de envíos?
7. ~~**Idioma de UI**~~ — **Resuelto: English-only en MVP**, localización a español como fase posterior.
8. **Excepción a "sin librerías de UI"** — ¿Markdown rendering (e.g. MarkdownUI) entra como excepción autorizada?
9. **Foundation Models on-device** (iOS 26+) — ¿usar como fallback offline para grammar/memory, o ignorar en MVP?

Cada uno de estos se resuelve antes de bloquear `tech-stack.md` o `ux.md`. Si alguno queda abierto, se mueve a `open-questions.md`.

---

## 10. Cómo este archivo se mantiene

Esta visión puede evolucionar mientras se construye iOS — no es inmutable. Cualquier cambio se discute con el creator y se actualiza acá *con cita explícita* del ciclo o decisión que lo motivó (en cuyo caso este archivo gana un `Changelog` al final).

Lo que **no** cambia sin escalación: los principios de §6. Si uno de esos diez se ve violado en un plan, el plan se reescribe; no se reescribe este archivo.
