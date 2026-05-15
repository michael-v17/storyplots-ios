# 11 — Web Adaptation Notes

> Adaptation guidance for porting PersonaLLM's iOS UX into the clone's web app. **Not observation** — design choices grounded in the observed patterns. See the companion [09-design-system.md](09-design-system.md) for the visual-language contract.

## Global strategy

- **Preserve every information architecture, entity, and interaction model** captured in [02-information-architecture.md](02-information-architecture.md) and [06-chat-interaction-model.md](06-chat-interaction-model.md). Only the form factor changes.
- **Three breakpoints**:
  - **S** (≤ 640 px) — mirrors iOS: drawer, bottom modal sheets, full-width compositions.
  - **M** (641–1024 px) — hybrid: drawer becomes togglable sidebar, modals still bottom sheets.
  - **L** (≥ 1025 px) — desktop: persistent left sidebar; right-side inspector panel replaces many modal sheets; keyboard-first affordances.
- **Gesture-only iOS behaviors get explicit UI** on web: swipe → arrow buttons / keyboard shortcuts; long-press → right-click / ⋮ kebab.
- **Respect OS conventions** (browser share API, file picker, URL routing — each screen gets a stable URL).
- **Multi-user isolation** — every route is gated by authenticated session; all entity queries are scoped by `userId`.

## Per-screen adaptation

### Home ([04-screens/home.md](04-screens/home.md))
- **S**: iOS-like — header with hamburger + wordmark + layout/sort; search below; card grid/list/circles.
- **M / L**: wordmark+sort move into sidebar top; `Cmd/Ctrl+K` opens global search; grid gets 3–5 columns depending on breakpoint.
- Layout toggle stays (three layouts); use CSS Grid with `grid-template-columns: repeat(auto-fill, minmax(NNN px, 1fr))` variations.
- "+ New Persona" tile always occupies the first slot across all layouts.
- Clone cut: "Browse Community" CTA removed.

### Onboarding ([04-screens/onboarding.md](04-screens/onboarding.md))
- 5-slide linear flow → single full-screen page with horizontal step progress.
- Replace "Verify with Apple" with email/OAuth (Google / GitHub / Apple Sign-In for Web) — capture age confirmation + ToS/Privacy checkboxes.
- Rewrite Slide 3 to collect BYOK (OpenRouter key field + optional ComfyUI URL + test connection buttons). Skippable.
- Rewrite Slide 5 (remove tiers/credits). Replace with Auto Image Generation + summary of user's configured keys.
- Add optional UserPersona quick-setup slide before entering Home.

### Menu ([04-screens/menu.md](04-screens/menu.md))
- **S / M**: slide-in drawer like iOS.
- **L**: persistent left sidebar, ~280 px wide. Collapsible to icon-only rail at ~64 px.
- Recent Chats becomes a scrollable section in the sidebar.
- Remove Credits row.

### Home → Character landing → Chat
- **L**: three-pane layout
  - Left: Menu sidebar (Characters / Recent Chats / Gallery / Settings).
  - Center: Chat (or Character landing / Character editor when selected).
  - Right: inspector panel — shows whichever side-surface is active (Character Info, Chat Controls, Author's Notes, Lore Book, Fork preview).
- **M**: two-pane (Menu collapsible, main content).
- **S**: mobile-identical, single column + drawer + bottom sheets.

### Chat ([04-screens/chat.md](04-screens/chat.md), [06-chat-interaction-model.md](06-chat-interaction-model.md))
- **Floating action rail** (Regenerate / Branch / Image) stays on mobile; on desktop move to a horizontal row inside the message on hover (keyboard accessible via `J/K` between messages, `R` regenerate, `B` branch, `I` image).
- **Swipe variants** → `< N/M >` counter with clickable arrow buttons + left/right arrow keys.
- **Long-press user message** → right-click / ⋮ kebab with same 5 options (Edit / Copy / New Response / Fork / Delete).
- **Long-press inline image** → right-click menu; short-press/tap/click opens fullscreen viewer.
- **⋯ Chat Controls** button on composer → on desktop, opens the right-pane inspector (not a bottom sheet).
- **Suggested Replies pill** → same behavior; chips render under the composer.
- **Mic icon** → Web Speech API `SpeechRecognition`.
- **Streaming** → SSE / WebSocket; respect Typing Speed slider value (0 = no reveal / stream raw; 1 = instant; 0.x = CSS animation on each token).

### Chat Controls ([04-screens/chat-controls.md](04-screens/chat-controls.md))
- Bottom sheet on S/M; right-pane inspector on L.
- Remove Credits badge from header.
- Autopilot: add explicit Stop button in the composer while running.
- Per-conversation Image/Video override rows deep-link to Settings; on desktop they open as inline collapsibles rather than a full nav.

### Author's Notes ([04-screens/authors-notes.md](04-screens/authors-notes.md))
- Same shape on all breakpoints.
- Add a **"Active Notes"** badge on the composer when any AuthorsNote applies to the current Conversation.
- Injection Depth stepper stays — add a tooltip explaining "depth" with a mini timeline visualization.

### Branch / Fork Conversation ([04-screens/branch.md](04-screens/branch.md))
- Bottom sheet (S/M) / centered modal (L).
- Change destructive red CTA to **primary (not destructive)** — forking is not destructive.
- Show the **parent conversation breadcrumb** on the branched Conversation's Chat header (`< Parent: "[Title]" · Forked at msg #N`).

### Character editor ([04-screens/character-info.md](04-screens/character-info.md))
- 3 tabs (Avatar / Info / Settings) stay.
- Scenarios editor: on L, show scenarios as an inline 2-column grid with live-preview on the right.
- System Prompt counter (N/2000) becomes **soft-warning** at 2000 not a hard limit on web; underlying LLM context allows more on most models. Keep the counter for UX clarity.
- Keep accent color picker; surface Custom as a full HEX/HSL input with live preview.

### Character import ([04-screens/character-import.md](04-screens/character-import.md))
- Dropzone supports HTML5 drag-and-drop + paste (for pasted URL/JSON).
- Add **URL import** field (Chub.ai / Character Hub link) — clone extension, low cost.

### Image Viewer ([04-screens/image-viewer.md](04-screens/image-viewer.md))
- Fullscreen modal overlay on all breakpoints.
- Keyboard: `Esc` close, `Left/Right` between attachments, `E` Edit, `V` Video, `S` Share (copy link), `F` Favorite.
- Edit Prompt panel on L shows side-by-side: current image | edit form (no need for a separate sheet).

### Settings ([04-screens/settings-index.md](04-screens/settings-index.md))
- **L**: two-pane — list of sections on left, active section detail on right.
- **S / M**: stacked, tap-to-drill iOS-style.
- Preserve all 10 sub-sections exactly. Add breadcrumb on L.
- Every slider becomes `slider + number input` pair (HTML `<input type="range">` + `<input type="number">`).
- `Reset All Settings` stays as red link; `Erase Everything` goes to a confirmation page with typed confirmation (type "ERASE").

### Community ([04-screens/community.md](04-screens/community.md))
- **SCOPE-CUT** in clone. Do not port.

### Gallery ([04-screens/gallery.md](04-screens/gallery.md))
- Keep. CSS Grid masonry-ish layout; lightbox = [image-viewer.md](04-screens/image-viewer.md).
- Filter bar stays (Images / Videos / Favorites / Search).

### TTS ([04-screens/settings/text-to-speech.md](04-screens/settings/text-to-speech.md))
- Replace iOS System voices with browser `speechSynthesis` voices.
- Ship Kokoro (WASM build) for gender-matched voices (user-extension).
- Per-character voice pair picker in the Character editor → new section below Memory.

### STT ([04-screens/settings/speech-recognition.md](04-screens/settings/speech-recognition.md))
- Default: browser `SpeechRecognition` (webkitSpeechRecognition fallback).
- Optional: Whisper via user's OpenAI/Groq key OR browser-WASM Whisper (if size is reasonable).

### App Lock ([04-screens/settings/data-security.md](04-screens/settings/data-security.md))
- Replace Face ID with **session re-authentication** (idle timeout → re-enter password or passkey).

## Component-level adaptation

| iOS pattern | Web replacement |
|---|---|
| Bottom modal sheet | Bottom sheet on S/M (`vaul`-style drawer); right-pane inspector OR centered dialog on L |
| Long-press | Right-click / ⋮ kebab / touch-hold 500 ms |
| Swipe to reveal actions | Inline buttons with keyboard shortcut hints |
| iOS share sheet | Web Share API fallback to copy-link / download |
| Haptics | No equivalent; omit or replace with subtle CSS transitions |
| SF Symbols | Lucide / Heroicons / Tabler; custom SVGs for scenario card / fork glyph |
| Face ID gate | Passkey / OAuth re-auth |
| "Download on App Store" | Removed |
| App Store deep-link (onboarding status bar) | Removed |

## Performance targets (clone goals)

- **TTI ≤ 2s** on a warm navigation.
- **First assistant token ≤ 1.2s** after user sends (streaming; depends on provider).
- **Image generation non-blocking** with status polling; user can keep chatting.
- **Sidebar navigation = no full-page reload** (SPA routing).
- **Offline: app shell loads**; chat disabled with clear message; Settings still editable.

## Routing (clone)

Deep-linkable URL surface:
- `/` → Home
- `/onboarding` → first-run
- `/character/:characterId` → Character landing (pre-chat)
- `/character/:characterId/edit` → Character editor (Info/Avatar/Settings tabs via query param)
- `/character/:characterId/scenarios` → Scenarios editor
- `/character/:characterId/lore` → Lore Book editor
- `/chat/:conversationId` → Active chat
- `/chat/:conversationId/fork/:messageId` → Fork modal pre-filled
- `/chat/:conversationId/image/:mediaId` → Image viewer (deep-link)
- `/gallery` / `/gallery/:mediaId`
- `/settings` → Settings index
- `/settings/:section` — e.g. `/settings/text-engine`, `/settings/prompt-editor`
- `/persona/:personaId/edit` → UserPersona editor
- `/account` → account & security

## Accessibility targets

- WCAG 2.1 AA everywhere.
- Keyboard-first: every action in chat reachable without mouse.
- Focus rings visible on dark background.
- `prefers-reduced-motion` disables Typing Speed reveal + image-generation sparkle.
- `prefers-color-scheme` respects light mode if we ship it (clone decision pending).
- All toggles are real `<input type="checkbox" role="switch">`.
- All sliders are `<input type="range">` with associated `<input type="number">`.
- Announce streaming token reveals to ARIA live region at `aria-live="polite"` (batched).

## Open Questions

- Ship a light mode? Default: dark-only for v1 (matches PersonaLLM).
- On-device Kokoro WASM — feasible bundle size? If too large, fall back to server-hosted Kokoro with per-user key.
- PWA shell — cache which assets offline?
- Should branches be navigable from a tree view, or only via Conversations list rows? Default: list + breadcrumb.
