# API Contract — StoryPlots iOS

> Contrato de comunicación cliente iOS ↔ backend + Supabase. Verificado leyendo `base/backend/app/main.py`, los 10 archivos en `base/backend/app/routes/`, y los clientes en `base/frontend/src/lib/*.ts`.
> Este archivo describe el **contrato externo** — no la lógica interna del backend.

---

## 1. Premisa: dos zonas de acceso a datos

StoryPlots usa **dos** capas para acceder a datos:

### Zona A — Backend FastAPI (lógica pesada)

Todo lo que **requiere LLM** o **lógica multi-paso server-side**: chat streaming, generación/refinement de characters, generación de imágenes, TTS, fork con summary, insights. Llamadas autenticadas por JWT bearer. **18 endpoints** documentados en §3.

### Zona B — Supabase PostgREST directo (RLS)

Todo lo que es **CRUD simple sobre tablas del usuario** — el frontend web lo hace via `supabase.from("table").select/insert/update/delete`. Row-Level Security garantiza que solo se accede a las propias filas del usuario. iOS replica este patrón con `supabase-swift`.

**Regla práctica para decidir Zona A vs Zona B:**

| Operación | Zona |
|---|---|
| Listar tus characters / conversations / messages | **B** (Supabase directo, RLS scopes a user) |
| Leer/actualizar `users.preferences` (theme, sampler, memory prefs, etc.) | **B** |
| Borrar un character / conversation / message / lorebook entry / grammar correction | **B** |
| Crear un character desde scratch (form save) | **B** (insert directo a `characters`) |
| Insertar/actualizar `message_variants` (e.g. greeting al crear conversation) | **B** |
| Toggle `is_active` en `provider_configs` (e.g. cambiar TTS activo) | **B** |
| Enviar un mensaje y recibir streaming | **A** (`/chat`) |
| Generar character desde idea (LLM) | **A** (`/character-generate`) |
| Refinar card importada (LLM normalization) | **A** (`/character-refine`) |
| Generar avatar (ComfyUI/fal) | **A** (`/characters/{id}/generate-avatar`) |
| Generar imagen en chat (ComfyUI/fal + refiner LLM) | **A** (`/messages/{id}/images`) |
| TTS de un mensaje | **A** (`/messages/{id}/audio`) |
| Fork con summary | **A** (`/conversations/{id}/fork`) |
| Recalcular insights | **A** (`/insights/run`) |
| Test de provider (text/image/TTS) | **A** |

**Implicación clave para iOS**: necesitás `supabase-swift` (la SDK oficial-community) para Zona B, **además** del cliente HTTP custom para Zona A. La SDK maneja auth + PostgREST + Storage; tu cliente custom maneja JSON + SSE contra el backend.

---

## 2. Auth pattern

### Mecanismo

- **Provider de identidad**: Supabase. Cliente obtiene un JWT vía email/password, magic link, o `signInWithIdToken` (Apple).
- **Transporte hacia backend**: `Authorization: Bearer <jwt>` en cada request.
- **Transporte hacia PostgREST (Zona B)**: la SDK `supabase-swift` agrega el JWT + `apikey` automáticamente.
- **Validación backend**: `base/backend/app/deps/jwt.py` — `verify_supabase_jwt` valida firma + claims. Las rutas usan `Depends(verify_supabase_jwt)`.
- **CORS allowlist** (verificado en `main.py`): solo `GET/POST/DELETE/OPTIONS`. Headers permitidos: `Authorization`, `Content-Type`, `apikey`.

### Apple Sign-In: camino confirmado

**Apple Sign-In → Supabase identity link**: el iOS app autentica con Apple (`ASAuthorizationAppleIDProvider`), obtiene el `identityToken`, lo intercambia por sesión Supabase via `supabase.auth.signInWithIdToken(provider: .apple, idToken: ...)`. Supabase emite el JWT que el backend ya valida. **Cero cambios en backend** — esta es la opción limpia y la confirmada.

---

## 3. Inventario completo de endpoints v1 (18 endpoints, verificado)

Cada endpoint con: método, propósito, request shape, response shape, notas iOS.

### 3.1 Health & meta

| Endpoint | Método | Auth | Request | Response | Notas iOS |
|---|---|---|---|---|---|
| `/health` | GET | JWT | — | `{ok: true, user_id: string}` | Startup gate. |
| `/prompt-editor/visual-roleplay-default` | GET | JWT | — | `{instructions: string}` | Solo si iOS implementa Prompt Editor. |

### 3.2 Chat (SSE) — el endpoint más complejo

`POST /chat` — streaming SSE de la respuesta del Conversation Agent.

**Request body:**
```jsonc
{
  "conversation_id": "uuid",                  // required
  "regenerate_message_id": "uuid",            // optional — agrega variant a un msg existente
  "reinforcement_pass": false,                // optional
  "reinforcement_exhausted": false,           // optional
  "reinforcement_user_message_id": "uuid",    // optional
  "reinforcement_failures": 0                 // optional
}
```

**Response**: `text/event-stream`. Headers de respuesta: `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`. Frames separados por `\n\n`.

**Eventos** (verificados en `chat.py` líneas 59-60 y el switch del cliente JS):

| Event | Payload | Cuándo |
|---|---|---|
| `start` | `{message_id, variant_id}` | Una vez al iniciar el stream. iOS crea bubble vacía. |
| `token` | `{text}` | Por cada chunk de tokens. iOS append-on al texto. |
| `correction` | `{user_message_id, original_text, already_correct, corrected_text, explanation, error_categories[]}` | Grammar agent terminó (paralelo o serial al NPC). |
| `rewrite_required` | `{user_message_id, corrected_text, explanation, error_categories[]}` | Reinforcement ON y correction no es already_correct. iOS muestra rewrite gate. |
| `grammar_error` | `{message}` | Grammar agent falló. iOS swallow/toast. |
| `error` | `{message}` | Stream principal falló. iOS muestra error + retry. |
| `done` | `{message_id, variant_id}` | NPC stream completó OK. Cierra bubble y persiste. |

**Modos de flujo del endpoint** (verificados en `chat.py` líneas 1009-1170):

1. **Normal turn** (grammar OFF o no aplica): `start → token* → done` (o `start → token* → error → done` si el provider falló).
2. **Normal turn con grammar paralelo** (default cuando grammar master+inline ON y reinforcement OFF, plan 0123): `start → token* → correction (entre tokens o después de done) → token* → done`.
3. **Normal turn con grammar serial** (reinforcement ON): si `already_correct: true` emite `correction → start → token* → done`; si no, emite `correction → rewrite_required` (stream cierra sin NPC).
4. **Regenerate** (con `regenerate_message_id`): agrega variant al message existente. Mismos eventos.
5. **Reinforcement re-POST** (pass o exhausted): idempotente — reusa el variant anterior si encuentra anchor.

**Errores conocidos** que llegan como `event: error` con `message`:
- `"conversation not found"` (404 lookup falló).
- `"no active text provider — configure one in Settings → Text Engine"` (409).
- `"active provider has no stored key"` (409).
- `"not authenticated"`.
- Output degenerado del modelo (vacío, `"*"`, puntuación sola) — backend persiste vacío y emite error explicando.

**Constraints iOS para implementar SSE client**:
- Usar `URLSession.bytes(for:)` (iOS 15+, disponible en iOS 26 ✓), no `dataTask` con buffering.
- Parser de referencia: `base/frontend/src/lib/chat.ts` líneas 75-89 — portar idiomáticamente a Swift.
- **Backpressure**: acumular tokens en buffer `@MainActor` y flushear cada 30 ms. Sin esto el SwiftUI re-renderiza por token y es jittery.
- **Cancelación**: navegar fuera del chat → cancelar `URLSessionTask`, lo cual cierra el TCP. Backend tiene `finally` que limpia.
- **Reconnect**: no hay resume del backend. Reintento = re-POST completo.

### 3.3 Providers (test)

| Endpoint | Método | Auth | Request | Response |
|---|---|---|---|---|
| `/providers/test` | POST | JWT | — | `{ok, error?, model?, status?}` (text provider probe) |
| `/providers/image/test` | POST | JWT | — | `{ok: bool, status?: int, error?: string}` (TestImageResult) |
| `/providers/image/refiner-default` | GET | JWT | — | `{system_prompt: string}` |
| `/providers/tts/test` | POST | JWT | — | `{ok: bool, error?: string}` (TestTTSResult) |
| `/providers/tts/elevenlabs/voices` | GET | JWT | — | `list[dict]` (lista de voces ElevenLabs) |
| `/providers/embedding` | GET | JWT | — | `dict | null` (config del embedding provider activo) |

### 3.4 Fork

**`POST /conversations/{conversation_id}/fork`**

```jsonc
// Request
{
  "message_id": "uuid",                          // anchor message
  "mode": "keep_messages" | "summarize_fresh",
  "title": "string (max 200)"                    // optional
}
// Response
{
  "conversation_id": "uuid (new child)",
  "title": "string",
  "branch_mode": "keep_messages" | "summarize_fresh"
}
```

Errores: `404` (conversation not found / anchor not in conversation), `409` (mode=summarize_fresh sin provider configurado), `502` (provider error generando summary).

iOS: confirmar fork → push a la nueva conversation_id.

### 3.5 Characters (creation flows)

**`POST /character-generate`** — generar character desde idea + knobs (cycle 0122).

```jsonc
// Request
{
  "idea": "string (20-2000 chars)",
  "drama_level": "none" | "light" | "medium" | "heavy",      // default "medium"
  "nsfw_allowed": false,
  "gender_hint": "any" | "female" | "male" | "non_binary" | "unspecified",
  "age_range_hint": "any" | "young_adult" | "adult" | "mid_life" | "older",
  "tone_hint": "any" | "slice_of_life" | "contemporary" | "historical" | "fantasy" | "scifi" | "surreal"
}
// Response
CharacterRefineResult.to_dict()  // estructura igual al refine; usada como prefill del form
```

Errores: `400` (no_text_engine, validation), `500` (llm_error).

**Nota SFW**: backend coerce `nsfw_allowed=false` si `users.sfw_disabled=false` (no opted in). Sin error visible al user.

**`POST /character-refine`** — refinar card cruda importada (PNG con metadata).

```jsonc
// Request
{
  "raw_card": { /* object */ },
  "format": "v1" | "v2" | "v3",
  "group_size": 1 // 1-4
}
// Response
CharacterRefineResult.to_dict()
```

### 3.6 Avatars

**`POST /characters/{character_id}/generate-avatar`**

```jsonc
// Request — sin body
// Response (ComfyUI)
{ "avatar_ref": "string (storage path)", "seed": 123456 }
// Response (fal.ai)
{
  "avatar_ref": "string",
  "reference_ref": "string | null",
  "engine": "fal",
  "model": "fal-ai/.../text-to-image",
  "seed": 123456
}
```

Errores: `404` (character), `409` (no_image_engine, no workflow_config), `400` (workflow shape, checkpoint con `/`/`..`), `502` (fal preview gen failed).

**`POST /personas/me/generate-avatar`** — para la persona del user.

```jsonc
// Response (ComfyUI)
{ "photo_ref": "string", "seed": 123456 }
// Response (fal)
{
  "photo_ref": "string",
  "reference_ref": "string | null",
  "engine": "fal",
  "model": "...",
  "seed": 123456
}
```

Errores: `404` (persona not set), `409` (no_image_engine).

### 3.7 Images (in-chat scenes)

**`POST /messages/{message_id}/images`** — generar imagen para un mensaje assistant.

```jsonc
// Request (body OPCIONAL — GenerationOverrides)
{
  "pov": "first_person" | "third_person",      // optional
  "shot_framing": "close-up" | "portrait" | "medium_shot" | "cowboy_shot" | "full_body",
  "resolution_preset": "square_1024" | "portrait" | "...",  // ver §3.7.1
  "prompt_override": "string",                  // optional — bypass refiner LLM
  "style_override": "realistic" | "anime" | "custom"
}
// Response
generated_images_row  // toda la fila del DB, con campos:
{
  "id", "user_id", "character_id", "conversation_id", "message_id",
  "prompt", "refined_prompt", "provider_snapshot",
  "resolution_preset", "dimensions": {"w", "h"}, "seed",
  "storage_ref": "string | null",   // null para fal hasta que sweeper procese
  "external_url": "string | null",  // fal CDN URL si engine=fal
  "engine": "comfyui" | "fal",
  "style": "anime" | "realistic" | null,
  "display_url": "string"  // solo para fal — frontend deriva de external_url/storage_ref
}
```

Errores: `400` (message no es assistant, workflow shape, checkpoint inválido), `404` (message/conversation/character), `409` (no text provider, no image provider, no workflow_config), `502` (fal error).

**Path SFW-blocked**: si el refiner LLM detecta block, persiste row con `sfw_blocked: true` sin generar imagen.

**Path async fal**: backend responde **inmediato** con `external_url` (fal CDN), un sweeper out-of-band descarga + comprime + sube a Storage. Frontend resuelve `display_url` desde external_url (< 24h) o storage signed URL.

**`DELETE /images/{image_id}`** → `{ok: true}`. Cascada: `inline_media` → `generated_images` → storage object.

#### 3.7.1 Resolution presets disponibles

```
square_1024 (1024×1024)         square_1408 (1408×1408)
portrait (1280×1664)            landscape (1664×1280)
tall_portrait (1088×1920)       wide_landscape (1920×1088)
ultra_tall (1024×2048)          ultra_wide (2048×1024)
custom_<W>x<H>                  // e.g. custom_1536x1024, 256 ≤ each ≤ 4096
```

### 3.8 Audio (TTS)

**`POST /messages/{message_id}/audio`**

```jsonc
// Request — sin body (lee provider config + voice del user prefs)
// Response — bytes de audio (probablemente mp3/opus dependiendo del provider)
//           Content-Type: audio/mpeg o audio/opus o audio/ogg
```

iOS: reproducir con `AVAudioPlayer`. Botón en `MessageBubble` con estados idle/loading/playing/paused.

### 3.9 Insights

**`POST /insights/run`** — recalcula insights aggregations (grammar performance, etc.). Llamado desde la pantalla de Insights cuando el user pide refresh.

```jsonc
// Request — sin body
// Response — TBD verificar shape exacto al implementar; probablemente:
{ "ok": true, "computed_at": "ISO8601" }
```

iOS: pantalla de Insights con charts. Read aggregated data desde Supabase directo (`grammar_aggregates`, etc.), POST `/insights/run` para forzar recompute.

---

## 4. Patrón Zona B: acceso directo a Supabase (verificado en `lib/*.ts`)

Estas tablas se leen/escriben **directo** desde el cliente con `supabase-swift`, sin pasar por backend. RLS scopes todo al user actual.

### 4.1 Tablas que iOS debe leer/escribir directo

| Tabla | Operaciones del frontend (verificado) | Notas iOS |
|---|---|---|
| `users` | read `preferences`, `sfw_disabled`; update `preferences` | Toda config del user vive en `preferences` JSONB. Patrón: read-modify-write. |
| `provider_configs` | read filtered by `kind` (text/image/tts/embedding), update `is_active` | Listado de providers configurados. Cambiar el activo → update directo. |
| `characters` | read all owned, update fields, delete, upsert (data import) | CRUD form save → directo. Generar/refinar (LLM) → backend. |
| `user_personas` | read (the user's persona), delete | Una fila por user. |
| `conversations` | read (list + by id), insert (new chat), update (title, etc.), delete | Crear conversación nueva (`insert`) y luego ir a chat. |
| `messages` | read (history of conversation), delete | Insert lo hace el backend dentro de `/chat`. |
| `message_variants` | insert (greeting auto-add al crear conversation), update `active_variant_id` | El backend también inserta durante streaming. |
| `lorebook_entries` | CRUD completo | Per-conversation. |
| `authors_notes` | CRUD completo | Per-conversation. |
| `writing_styles` | CRUD completo | Globales del user. |
| `grammar_corrections` | read (display inline), delete (per conv o all) | El backend escribe; iOS lee/borra. |
| `grammar_aggregates` | delete (clear stats) | Backend o RPC escribe; iOS solo limpia. |
| `memory_document_chunks` | read (Memory panel), delete (clear) | Backend escribe extracción. |
| `generated_images` | read (Gallery, ImageViewer), delete vía backend `/images/{id}` | Lectura directa para gallery. |
| `inline_media` | read (vincular images a messages) | Lectura directa. |
| `chat_controls_state` | read/upsert (per-conv overrides — image provider, resolution preset) | Para Generation Override panel. |

### 4.2 Storage buckets (también vía supabase-swift)

| Bucket | Para qué |
|---|---|
| `avatars` | character + persona avatars (paths como `{user_id}/character-{id}-{ts}.webp`) |
| `generated-media` | imágenes de chat (paths como `{user_id}/{image_id}.webp`) |

iOS lee con signed URLs (1h TTL típico). El frontend usa `lib/images.ts` con helper `displayUrl` — patrón a portar a Swift.

### 4.3 RPC (Postgres functions) llamables via supabase-swift

| RPC | Para qué (verificado) |
|---|---|
| `get_active_text_key` | Devuelve la API key del provider de texto activo. **Solo backend lo usa** — no iOS. |
| `get_active_embedding_key` / `get_active_image_key` | Mismo patrón. **Solo backend.** |
| `fork_conversation_tx` | Atomic copy de conversation + messages + variants + lorebook + grammar. **Solo backend lo invoca**, vía `/fork`. |
| `memory_search` / `memory_search_entity` | Vector search. **Solo backend.** |
| `character_memory_search` / `character_memory_search_entity` | **Solo backend.** |
| `upsert_grammar_dirty` | **Solo backend.** |

iOS no llama RPCs directamente — todas son orchestration interna del backend.

---

## 5. Endpoints que iOS necesita **nuevos** (v2/ios)

Lista inicial. Cuando se cree el primero, vive en `base/backend/app/routes/v2/ios/` (estructura a crear), prefijo confirmado: **`/api/v2/ios/`**.

### 5.1 Push registration

**`POST /api/v2/ios/push/register`**

```jsonc
// Request
{
  "device_token": "string (APNs token hex)",
  "environment": "production" | "sandbox",
  "bundle_id": "com.storyplots.ios",
  "app_version": "1.0.0",
  "locale": "en-US"
}
// Response
{ "ok": true, "registered_at": "ISO8601" }
```

Backend persiste en tabla nueva `push_tokens` (nueva migration de Supabase, separada de v1). Stale tokens se purgan vía APNs feedback.

**`DELETE /api/v2/ios/push/register`** — al logout o disable notifs.

### 5.2 Push trigger (server-side, no iOS-callable)

Lógica del backend que decide cuándo enviar APNs. Triggers iniciales:
- `image_ready`: imagen generada lista (chat scene o avatar).
- `generation_done`: character generation completada.
- `system`: alerts genéricas.

Payload format (a confirmar al implementar):
```jsonc
{
  "aps": { "alert": {...}, "sound": "default" },
  "kind": "image_ready" | "generation_done" | "system",
  "conversation_id": "uuid?",
  "message_id": "uuid?",
  "character_id": "uuid?"
}
```

### 5.3 Apple receipt validation (si llega IAP) **[REVIEW]**

`POST /api/v2/ios/iap/verify` — fuera de MVP por defecto.

### 5.4 Cosas que NO necesitan endpoint nuevo

- **Local preferences iOS** (haptics on/off, theme override) → `UserDefaults` o SwiftData, no backend.
- **Universal Links** → no requieren endpoint; requieren servir `apple-app-site-association` desde el dominio del web.

---

## 6. Manejo de errores

Convención del backend (verificado en `main.py`):
- HTTP codes estándar (`400`, `401`, `404`, `409`, `500`, `502`).
- Body: `{ "detail": "...", "traceback"?: [...] }` (el traceback solo aparece en `500`).
- En CORS: `Authorization`, `Content-Type`, `apikey` permitidos. Sin credentials cookie-based.

iOS debe:
1. Reportar copy claro al usuario:
   - `401` → "Iniciá sesión nuevamente"
   - `404` → mensaje específico al recurso
   - `409` → "Configurá tu proveedor en Settings"
   - `500` → "Algo salió mal, intentá de nuevo"
   - `502` → "El proveedor externo falló, probá de nuevo"
2. **Nunca** mostrar `traceback` al usuario.
3. **Retry**: solo para `500` / `502` / network timeout, con backoff exponencial. **No** retry para `401` / `404` / `409` / `400`.
4. Para `/chat`, los errores mid-stream vienen como `event: error` dentro del SSE — manejarlos en el parser, no en el HTTP status.

---

## 7. Versionado de este documento

Cualquier endpoint nuevo que se agregue va con su entrada en este archivo **antes** de existir en código. Es la forma de asegurar que la migración iOS se mantiene en sync con el backend.

Cuando un endpoint v1 cambie semántica o se deprique, se anota acá con fecha + razón. Romper el contrato v1 no es un cambio normal — es escalación al creator.

---

## 8. Cambios respecto a la versión 1 de este documento (2026-05-15)

Lo que se corrigió tras leer el código completo:
- **Inventario completo (18 endpoints)** — antes tenía solo 10 listados, varios mal descritos.
- **Patrón Zona B** — antes afirmaba "iOS no debe llamar a PostgREST directamente". **Era incorrecto**. El frontend hace CRUD directo a Supabase para todo lo que no requiere LLM/lógica server-side. iOS replica este patrón.
- **Shapes de request/response** — antes especulación, ahora extraídas del código.
- **Eventos SSE de `/chat`** — confirmados al detalle, incluyendo 5 modos de flujo.
- **Resolution presets** — lista exacta de los 8 disponibles + formato `custom_WxH`.
- **Async fal pattern** — backend responde con fal CDN URL inmediato; sweeper procesa Storage out-of-band.
