---
paths:
  - "**/*.swift"
  - "**/Package.swift"
---

# StoryPlots iOS — Stack Constraints

> Loads when editing any Swift file. Codifies the decisions from `seed/tech-stack.md`.

## Target & toolchain

- **iOS 26.0** minimum deployment target.
- **Xcode 26.3+** toolchain.
- **Swift 6** with strict concurrency `complete` (fallback to `targeted` only if dependency forces it).

## Frameworks

- **SwiftUI** primario. No reinventar componentes nativos.
- **UIKit interop** solo donde SwiftUI no cubre concretamente (rare). Justificar en el plan.
- **No web views** (`WKWebView`) para surfaces de producto.

## Concurrency

- Swift Concurrency (`async`/`await`, `Task`, `actor`, `TaskGroup`).
- `@MainActor` en view models y código que toca UI.
- Actores para shared mutable state cross-Task.
- **No Combine** salvo donde Apple lo expone (algunos `Notification` publishers).
- **No GCD manual** salvo emergencias / interop con APIs viejas.

## State management

- `@Observable` (iOS 17+ macro) para view models.
- `@State` para ephemeral UI.
- `@Environment` para dependency injection con custom `EnvironmentKey`s.
- **No** TCA, **no** swift-dependencies (a menos que tests dolieran — entonces evaluar).

## Networking

Dos zonas (ver `seed/api-contract.md` §1):

### Zone A — Backend FastAPI (lógica con LLM)
- URLSession + cliente custom thin. **No** Alamofire.
- `APIClient` protocol con `send<R>()` y `stream<E>()`.
- Auth: interceptor que agrega `Authorization: Bearer <jwt>` + `apikey` cuando aplica.
- SSE: `URLSession.bytes(for:)` + parser `\n\n` framed.

### Zone B — Supabase PostgREST directo
- `supabase-swift` SDK.
- CRUD directo sobre tablas propias del user (RLS scopes).
- Tablas: characters, conversations, messages, message_variants, lorebook_entries, authors_notes, writing_styles, grammar_corrections, memory_document_chunks, user_personas, users.preferences, provider_configs, chat_controls_state, generated_images, inline_media.

**Regla**: si requiere LLM o orquestación multi-paso → Zone A. Si es CRUD simple del user → Zone B.

## Persistencia local

- **SwiftData** (iOS 17+) para cache local. **No** Core Data, **no** Realm.
- `UserDefaults` para prefs simples.
- Keychain para tokens (via supabase-swift built-in o wrapper propio thin).
- **No** library de Keychain de terceros salvo razón.

## Auth

- Email/password via Supabase.
- Apple Sign-In via `signInWithIdToken(provider: .apple, idToken:)`.
- Token refresh automático por el SDK.

## Imágenes

- `AsyncImage` para casos simples.
- Cache custom (`NSCache<NSURL, UIImage>`) para avatars (alta frecuencia).
- WebP encoding del backend (no PNG raw).

## Testing

- **Swift Testing** (`import Testing` + `@Test` + `#expect`) para tests nuevos.
- XCTest queda para casos donde Swift Testing no llegue.
- XCUITest solo para flows críticos (sign-in, send-message, create-character).
- Coverage target: ≥ 60% global, ≥ 80% en chat streaming / auth / persistence.

## Dependencias externas (lista cerrada)

Solo estas son aceptables sin review especial:
- `supabase-swift` (auth + PostgREST + Storage)
- `swift-collections` (opcional, Apple-mantained)

Cualquier otra dependencia requiere justificación en el plan + aprobación.

## Anti-patterns

- ❌ Hardcoded hex colors / sizes / fonts en código de view (siempre `Theme.X`).
- ❌ `print()` en código de release (usar `OSLog`).
- ❌ Force unwraps `!` en código no-test (usar guard / if-let).
- ❌ Closures retain cycles sin `[weak self]` donde aplica.
- ❌ Custom Done buttons en sheets (usar `ToolbarItem(.confirmationAction)`).
- ❌ Bypass de SwiftUI con UIKit cuando SwiftUI cubre.

## Logging

`OSLog` con subsystem `com.storyplots.ios` y categorías:
- `auth`, `network`, `chat-stream`, `image-gen`, `audio`, `db`, `app-lifecycle`.

Levels en release: `info`, `error`, `fault` solo.

## File layout (de `seed/roadmap.md` Fase 0)

```
storyplots/
├── App/             RootView, storyplotsApp
├── Core/
│   ├── DesignSystem/   Theme.swift
│   ├── Networking/     APIClient, SSEClient, AuthStore
│   ├── Persistence/    SwiftData models
│   └── Supabase/       SupabaseManager
├── Features/
│   ├── Auth/, Home/, People/, Chat/, Settings/
└── Resources/       Assets.xcassets, Localizable.xcstrings
```
