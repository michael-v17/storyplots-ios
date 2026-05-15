# Screen — Gallery

## Observed in PersonaLLM

Source: [Gallery/IMG_4148.PNG](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Gallery/IMG_4148.PNG) (single screenshot).

### Purpose
Media library — every image/video generated in chats, aggregated across the user's characters. Entry point: Menu drawer → "Gallery".

### Header
- Left: back chevron (`<`) → returns to previous screen.
- Next to back: circular user-icon chip `(inferred)` — possibly filter "by me" or profile shortcut.
- Center: **"Gallery"** title (purple gradient).
- Right: two icon chips — a **check** icon (multi-select mode `(inferred)`) and **sort** (up/down arrows).

### Subtitle / count
- "**13 images, 5 videos**" — dynamic count of media in this gallery.

### Filter / search row
- Left: **search input** "Search prompts…" — implies each media item stores its generation prompt, and search hits prompt text.
- Right trailing icons:
  - Image/media filter icon (stacked squares) — likely toggles **Images / Videos / All** or similar.
  - Heart icon — likely filters to **favorites**.

### Media grid (masonry / mixed layout)
- Mixed 2- and 3-column masonry with varying tile heights.
- Each tile:
  - Media thumbnail (fills tile).
  - **Video badge** overlay: camera icon + duration ("5s") in a bottom-left pill when the item is a video.
  - Subtle rounded corners; no name/author overlay (gallery is single-user).
- Observed content mixes: portrait character renders, scene renders, videos.

### Affordances `(mostly inferred — only one screenshot)`
- Tap tile → fullscreen viewer with prompt, re-use, share / export.
- Long-press or multi-select check → bulk delete / export.
- Tap search → type, filter by prompt text.
- Tap sort → order by newest / oldest / character / media type.

## User Extensions / Scope Decisions

- Keep Gallery concept for the clone — it is a natural byproduct of in-chat image/video generation.
- Scope Gallery **per user account** (no cross-user sharing since Community is cut).
- On web, prefer CSS grid with `auto-rows: masonry` fallback or a JS masonry library.
- Fullscreen viewer should show the **prompt, model, seed, character, and conversation link** for each item to make it useful as a re-use source.

## Open Questions

- Is Gallery global-per-user or also available per-character (filter by character)?
- Can an image be re-attached to a chat as a message?
- Storage / quota model? (Relevant for web: where does media live — user storage, object storage, device?)
- Does Gallery include images from cloud providers only, or also local ComfyUI runs?
