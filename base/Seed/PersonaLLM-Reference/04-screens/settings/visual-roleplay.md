# Settings → Visual Roleplay

## Observed in PersonaLLM

Source: [Settigns/IMG_4162.PNG](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4162.PNG).

Header: `< · Visual Roleplay`. Section: **VISUAL ROLEPLAY**.

| Field | Control | Default | Copy |
|---|---|---|---|
| **Visual Roleplay Mode** | Toggle | ON | "Enable scene descriptions in AI responses" |
| **Auto-Generate Images** | Toggle | OFF | "Automatically generate after AI responses" |

### Default Resolution (3×3 grid, one selected)

| Tile | Dimensions |
|---|---|
| **Random** | "Surprise me" (selected in screenshot) |
| **Square** | 1408 × 1408 |
| **Portrait** | 1280 × 1664 |
| **Landscape** | 1664 × 1280 |
| **Tall Portrait** | 1088 × 1920 |
| **Wide Landscape** | 1920 × 1088 |
| **Ultra Tall** | 1024 × 2048 |
| **Ultra Wide** | 2048 × 1024 |
| **Custom** | User-defined |

### Enabled Resolutions (checkbox list, "7 of 8" shown)
Observed enabled: Square, Portrait, Landscape, Tall Portrait, Wide Landscape, Ultra Tall, Ultra Wide (Random omitted from list).

### Behavior inferred

- **Visual Roleplay Mode** ON → AI responses are steered (via the Visual Roleplay Instructions prompt, see [prompt-editor.md](prompt-editor.md)) to end with a bracketed `[image: ...]` tag the app parses to trigger generation.
- **Auto-Generate Images** ON → every detected `[image: ...]` tag auto-generates without the user tapping 🖼.
- **Default Resolution** → the pre-selected resolution when generation is triggered without user override; "Random" picks from the Enabled Resolutions list.
- **Enabled Resolutions** → set that populates the in-chat resolution modal ([Chat/IMG_4131](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4131.PNG)).

## User Extensions / Scope Decisions

- Keep both toggles verbatim.
- Keep the full 8-resolution set + Custom. These are good defaults matching modern SD/Flux workflows.
- Auto-Generate Images must hard-gate on the user having a working image provider (ComfyUI URL reachable or cloud key saved).

## Open Questions

- What happens when Visual Roleplay Mode is OFF but the user manually taps 🖼 — does the app still use the `[image: ...]` format or synthesize a prompt from the message content directly?
- Is the `[image: ...]` tag visible in the UI or stripped before render?
- Per-character overrides for Visual Roleplay Mode / Resolution?
