# Plan 0096 — Chat image lazy-load (IntersectionObserver gate)

status: shipped
date: 2026-05-05

## Motivation

Today `MessageImage` calls `imageUrl(storage_ref)` on every mount, regardless of whether the bubble is in viewport. The browser-native `loading="lazy"` on the `<img>` defers the actual byte fetch — but the signed-URL call still happens for every off-screen bubble in a long chat. With the dual-store strategy of Cycle 0094 (where `display_url` will be either fal CDN or signed Storage URL), having an explicit viewport gate is the natural place to layer that decision.

Cycle 0096 adds the IntersectionObserver gate now so 0094 can plug in cleanly later, and to belt-and-suspenders the egress mitigation.

Goals:
- Don't resolve signed URLs until the bubble enters (or is within 200 px of) the viewport.
- No CLS — the existing 320×320 fixed-size box stays.
- Stepper navigation within the same bubble refetches the new image without re-observing.
- Error fallback when the URL fails to load (`<img onerror>`).
- Browsers without `IntersectionObserver` (and SSR) fall through to eager load.

Non-goals:
- The dual-store `display_url` boundary (24h fal CDN vs Storage) — that's Cycle 0094.
- Cancelling in-flight fetches when the bubble scrolls out — once we've started, we keep the URL.

## Implementation order

### Subtask 1 — IntersectionObserver gate ✅
`frontend/src/features/chat/MessageImage.tsx`:
- `wrapperRef` on the 320×320 div.
- First `useEffect`: observe wrapper with `rootMargin: "200px"`. On first intersection, `setInView(true)` and disconnect.
- Second `useEffect` gated on `inView`: only then call `imageUrl(...)`.
- Image-stepper changes (`activeIndex`) re-fire the second effect with the new image; `inView` stays true.

### Subtask 2 — Error UI ✅
- `onError` handler on `<img>` sets `errored=true`.
- Renders a "Image failed to load — regenerate from the panel below." placeholder inside the 320×320 box.
- `data-testid="msg-image-error-{id}"` for Playwright coverage.

### Subtask 3 — Plan + commit
- Plan + commit `feat(0096): IntersectionObserver gate for chat image signed URLs`.
- Update SESSION_HANDOFF.

## Critical files

| Layer | Path |
|---|---|
| Component | `frontend/src/features/chat/MessageImage.tsx` |

## Verification

- Tsc 0 errors after the refactor.
- Behavior: open a chat with N images → only the visible-or-near bubbles fetch signed URLs. Scrolling up reveals older images and triggers their fetch on observation.
- Browser `loading="lazy"` retained as belt-and-suspenders for the actual byte fetch.

(Live verification deferred — chat with 30+ image messages doesn't exist on xvm yet; will validate alongside Cycle 0094 once fal scenes start filling the chat.)
