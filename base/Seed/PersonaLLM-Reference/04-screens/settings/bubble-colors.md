# Settings → Bubble Colors

## Observed in PersonaLLM

Source: [Settigns/IMG_4163.PNG](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4163.PNG).

Header: `< · Bubble Colors`.

### Live Preview
At top: a single chat-bubble preview showing the current theme, using a fixed example message:
> "*She walked into the room slowly*
> 'Hello there, it's nice to meet you.'
> The air was thick with anticipation."

### THEME
A grid of labeled theme tiles grouped into three bands. Each tile shows the theme name, an icon, and three color dots (likely: background / bubble fill / accent).

**Essentials**
- **Default** (selected — purple border) — sparkle icon
- **Monochrome** — half-moon icon
- **High Contrast** — eye icon
- **Custom** — equalizer-lines icon

**SillyTavern**
- **Tavern** — droplet icon
- **Azure** — cloud icon
- **Cappuccino** — tea-cup icon
- **Macaron** — sparkle icon
- **Moonlit** — moon icon

**Moods**
- **Classic RP** — book icon
- **Ocean** — waves icon
- **Sunset** — sun icon
- **Neon** — lightning icon
- **Forest** — tree icon
- **Lavender** — flower icon

### Scope
This is a **global chat-bubble theme**, applied across all Characters' chats (in addition to each Character's accent color on other surfaces). The theme affects bubble fill, bubble border, user vs assistant differentiation.

## User Extensions / Scope Decisions

- Keep the three-band taxonomy (Essentials / SillyTavern / Moods) — the **SillyTavern** band is a clear signal the app is catering to the reference-ecosystem crowd.
- The clone can launch with a smaller initial set (Default, Monochrome, High Contrast, Custom) and add theme packs later.
- Keep the **Custom** theme with a per-property color picker.
- On web, ship themes as CSS custom-property bundles; character accent color is an additional layer on top.

## Open Questions

- Does the theme affect the Character card / Menu / Home background, or only the Chat screen?
- Does Custom expose all the underlying CSS variables (bubble fill, user bubble fill, border, accent) or only a subset?
