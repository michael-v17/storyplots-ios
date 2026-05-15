# Screen — Home

## Observed in PersonaLLM

Source folder: [Home/](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/) — IMG_4095, IMG_4112, IMG_4113, IMG_4114.

### Purpose
Post-onboarding landing screen. Lists the user's own Characters ("Your AI Companions"), offers creation + discovery entry points, and exposes layout/sort controls.

### Header (constant across all Home states)
- **Left:** Hamburger icon (circular chip) → opens side [Menu](menu.md).
- **Center:** Wordmark **"PersonaLLM"** (purple→teal gradient).
- **Right:** Two icon buttons in a shared pill:
  - **Layout toggle** — cycles between three layouts (see below). Icon reflects current layout:
    - 2×2 grid icon → grid-card layout ([IMG_4095](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4095.PNG), [IMG_4112](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4112.PNG))
    - Grid of dots icon → compact circles layout ([IMG_4113](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4113.PNG))
    - Horizontal-lines icon → list layout ([IMG_4114](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4114.PNG))
  - **Sort** — up/down arrows icon (options unknown — `(open question)`).
- **Subtitle:** "Your AI Companions" (small, muted, centered below the header).
- **Search input:** full-width pill with magnifier prefix, placeholder "Search personas…". Scope is the user's own library (inferred from the "Your AI Companions" subtitle).

### State A — Empty library ([IMG_4095](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4095.PNG))
- Centered stylized jar/container illustration with sparkle.
- Heading: **"No Companions Yet"**
- Body: "Create your first AI persona or discover characters shared by the community."
- Primary CTA (gradient pill): **"Create Persona"** → character creation ([CharacterInfo](character-info.md) in new-character mode).
- Secondary CTA (dark pill): **"Browse Community"** → [Community](community.md).

### State B — Populated, grid layout ([IMG_4112](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4112.PNG))
- First slot is a dashed-border **"+ New Persona"** tile (always occupies the first card position).
- Remaining slots are 2-column character cards. Each card contains:
  - Circular avatar image (large, centered-top).
  - Character name (semibold).
  - One-line description preview (muted, ellipsized).
  - Chat-bubble icon + **comment count** (e.g., `1`) bottom-left `(inferred: number of existing conversations with this character)`.
  - **"Example"** tag in the top-right corner — marks pre-seeded demo characters (observed on all visible characters in this state).
- Characters visible: Seraphael Ignis Vaelthorne, Lucien Vale, Cataraz, Asharael The Smoke Crown, Socrates of Athens.

### State C — Compact circles layout ([IMG_4113](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4113.PNG))
- 4-column grid of circular avatars only, with the character name as a single line beneath each.
- First cell is a dashed-border **"+ New"** circle.
- No description, no tag chips, no comment counts in this layout — density-first view.

### State D — List layout ([IMG_4114](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4114.PNG))
- Top row: dashed-border row "**+ Create New Persona**" (full width).
- Each character row:
  - Leading circular avatar.
  - Name (bold, ellipsized if long).
  - Inline chips beside the name: purple **"Roleplay"** tag (with bookmark icon), gray **"Example"** tag.
  - Second line: description preview (ellipsized).
  - Trailing: chat-bubble icon + comment count, chevron `>`.
- All list rows have a subtle glow/border (green/purple tint alternation is just background gradient).

### Affordances / Navigation
- Tap card/row → [CharacterInfo](character-info.md) (or directly into [Chat](chat.md) — `(open question)` which one).
- Tap "+ New Persona" tile/row → character creation.
- Tap hamburger → [Menu](menu.md).
- Tap layout icon → cycle layouts.
- Tap sort icon → sort menu (contents unknown).
- Long-press card → context menu `(inferred — not captured)`.

### Tags observed on characters
- **"Example"** — pre-seeded demo character shipped with the app.
- **"Roleplay"** (with bookmark icon, purple) — category/mode tag. `(inferred)` that other categories exist (e.g., "Assistant" — seen in Community filters).
- **"RP"** badge (small purple pill) — appears on Community cards; not observed on Home cards yet.

## User Extensions / Scope Decisions

- Pre-seeded **"Example"** characters are useful for onboarding and will be kept in v1.
- "Browse Community" CTA will be **removed** (Community is out of scope). Replace with a single **"Create Persona"** primary CTA and optionally **"Import Character"** secondary CTA (since Community was the other seed path).
- All three layouts (grid / circles / list) are worth keeping on web — they map to CSS grid templates and benefit desktop breakpoints.

## Open Questions

- Tap on a character card: goes to [CharacterInfo](character-info.md) or straight into [Chat](chat.md)?
- Sort-icon menu options (alphabetical / recent / favorite / custom)?
- Long-press / swipe actions on a character (delete, duplicate, pin, export)?
- Is the search scoped to name only, or also description / tags?
- Can the user remove / hide "Example" characters?
