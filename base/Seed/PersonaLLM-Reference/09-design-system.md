# 09 — Design System

> Visual language + component inventory synthesized from all passes. Colors are labeled `(approx)` where derived by eye from screenshots — calibrate against actual brand assets before implementation.

## Observed in PersonaLLM

### Theme model (confirmed)

PersonaLLM uses **three concurrent theming layers** that stack on every chat screen:

1. **App base theme** — dark, near-black background with subtle blue-purple tint. Consistent across the app.
2. **Bubble Color theme** (global, user-selected) — from [settings/bubble-colors.md](04-screens/settings/bubble-colors.md): Essentials (Default / Monochrome / High Contrast / Custom), SillyTavern pack (Tavern / Azure / Cappuccino / Macaron / Moonlit), Moods pack (Classic RP / Ocean / Sunset / Neon / Forest / Lavender). Drives bubble fill + border hues.
3. **Character accent color** (per-character, from [character-info.md §Avatar tab](04-screens/character-info.md#3a-avatar-tab)) — a single hue that themes **scenario card borders, user-message pill fill, rail chip tint, mode pill, avatar glow, Chat Controls header, CTAs in image-viewer / branch modals**. 16 presets + Custom picker.

**Observed accent colors across characters (for calibration):**
- Clara Moretti → green (~`#2ECC71` approx)
- Socrates of Athens → bronze / amber (~`#C9A34C` approx)
- AXIOM-7 → red (~`#E04747` approx)

Web implementation: expose `--char-accent` as a CSS custom property scoped to `.chat-root[data-character-id]`; all tinted components read from it.

### Color palette (approximations from screenshots)

| Role | Approx value | Notes |
|---|---|---|
| Background (primary) | `#0D0A15` `(approx)` | near-black with violet tint |
| Background (elevated card) | `#1A1424` `(approx)` | subtle lift |
| Border / divider | `#2A2338` `(approx)` | very low contrast |
| Text (primary) | `#F2F2F5` `(approx)` | near-white |
| Text (muted) | `#8E89A0` `(approx)` | section labels, hints |
| Brand gradient start | purple `~#8B5CF6` → | Wordmark, primary CTA |
| Brand gradient end | teal / green `~#34D399` | Wordmark, primary CTA |
| Destructive | red `#E04747` `(approx)` | Delete / Erase / Fork CTA |
| Success | green `#2ECC71` `(approx)` | "Connected" state |
| Warning | amber `#F59E0B` `(approx)` | "Content may be removed" card |

### Typography

- **Family:** SF Pro (iOS system) `(inferred)`. Web fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif`.
- **Weights observed:** 400 body · 500/600 semibold labels + CTAs · 700 headings.
- **Section headers:** small-caps, tracking-wide, muted color (`SECTION LABEL`).
- **In-chat convention** (critical):
  - `*asterisk span*` → rendered **italic** (narration / action)
  - `"quoted span"` → rendered plain (dialogue)
  - Mixed freely within one assistant message.
- **System Prompt counter** style: `1,243/2,000` top-right of textarea.
- **Timestamp** style: small, muted, HH:MM below user/assistant messages.

### Iconography

- Rounded, line-based icons; moderate stroke width.
- Two-tone highlights (icon + accent color).
- Observed icon style looks like **SF Symbols** augmented with a few custom glyphs (theater masks, scenario card, fork branch).

### Component inventory

| Component | Observed usage |
|---|---|
| **Pill button (primary gradient)** | Wordmark-style gradient (purple→teal). Used on: Continue, Start Exploring, Create Persona, Verify with Apple, I Understand & Agree, Save (Character editor), Create Branch is RED not gradient |
| **Pill button (secondary dark)** | Browse Community, Skip for Now, Cancel |
| **Pill button (destructive red)** | Create Branch, Summarize & Branch, Delete, Erase Everything, Save Notes (Author's Notes) |
| **Pill button (accent-tinted)** | Regenerate (inside Edit Prompt), Test Voice, Test Connection, Add to Library, etc. — matches character accent color when in chat |
| **Segmented tab control** | Avatar / Info / Settings (Character editor), Cloud / Custom (Text/Image/Video Engine), System / Kokoro (TTS), Roleplay / Assistant (System Prompt Reference), Characters / Gallery (Community) |
| **Toggle switch** | Purple fill when ON; gray track when OFF. Used everywhere (Character Memory, Cloud Consent, Auto Images, Thinking Mode, …) |
| **Radio card** | 3-option Writing Style selector; scenario-mode picker; Default Writing Style on Character Settings tab |
| **Checkbox row** | Enabled Resolutions list |
| **Slider (horizontal)** | Temperature, Max Tokens, Context Length, Knowledge Budget, Typing Speed, TTS Speed/Pitch/Volume. Numeric value displayed at right end in purple |
| **Stepper (`−` / `+`)** | Extract Every N turns, Injection Depth, Context Messages |
| **Text input (rounded pill)** | Search boxes, single-line text fields |
| **Textarea (rounded card)** | System Prompt, Character Description, Author's Notes, Extraction Prompt |
| **Dropdown (chevron-down)** | Optional Deep Dives selector, Model picker, Provider picker |
| **Dropzone (dashed border)** | Character Import, Avatar empty state |
| **Color swatch grid** | Accent Color (16 + Custom), Bubble Colors |
| **Resolution grid tile** | 3×3 grid with thumbnail icon + label + dimensions; selected tile tinted in accent |
| **Floating action rail** | Circular chips stacked vertically, attached to selected message in chat |
| **List row (3-part)** | Avatar + title + subtitle + trailing meta/chevron (Recent Chats, Settings rows, Provider rows) |
| **Card (tinted border)** | Scenario cards, Character cards, Community Trending cards |
| **Section header** | Uppercase small-caps with tracking, muted color |
| **Modal sheet (bottom)** | Chat Controls, Author's Notes, Fork Conversation, Edit Prompt, user-message actions, image long-press |
| **Confirmation modal (centered)** | Delete Message? |
| **Destructive confirm page** | Erase Everything & Reset (full-screen red) |
| **Side drawer (left)** | Menu |
| **Progress dots (page indicator)** | Onboarding (5 dots), image viewer (pagination dots) |
| **Streaming preview card** | "Creating Character" modal with elapsed timer + Cancel / Continue in Background |
| **Empty state illustration** | "No Companions Yet" + stylized jar; "No uploads yet" with stacked-layers icon |
| **Filter chip row** | Community filters (Male / Female / Roleplay / SFW / NSFW), Example chips on AI Generate |
| **Leaderboard rank badge** | #1 gold / #2 silver / #3 bronze + plain numbered |
| **Avatar glow ring** | Circular avatar with accent-colored ring |
| **Gradient pill (wordmark)** | "PersonaLLM" title |
| **Credits badge** | Circular `⚡ 310` in character accent (SCOPE-CUT in clone) |

### Layout rhythm

- Primary content padding: ~16 px from screen edge.
- List-row padding: ~12–16 px vertical, 16 px horizontal.
- Section spacing: ~24 px between cards.
- Card corner radius: ~14 px (large cards), ~10 px (small tiles).
- Floating rail chips: ~36 px circle, ~12 px gap.

### Motion & feedback

- **Typing Speed slider** (0..1) controls reveal animation of streamed tokens — visual-only.
- **Generating image** card uses a centered sparkle animation.
- **Drawer slide** from left with dim overlay.
- **Modal sheets** slide up from bottom with spring.
- **Toggle flip** animation when switching ON/OFF.
- No observed parallax or scroll-linked effects.

### Iconography cheat-sheet (canonical by use)

| Glyph | Meaning |
|---|---|
| ☰ | Menu hamburger |
| ▦ / ⋮⋮ / ☰ | Home layout-toggle (cycles three layouts) |
| ⇅ | Sort |
| 🔍 | Search |
| ✨ | AI Generate |
| ✏ | Manual / Edit |
| ⬇ | Import / Download |
| 📖 | Book / Writing Style |
| 🎭 | Roleplay mode |
| ⚡ | Credits / Standard tier |
| ⭐ | Premium tier (SCOPE-CUT) |
| 🛡 | Age Verification |
| ☁ | Cloud provider / Consent |
| 💾 | Storage |
| 🗑 | Delete (red) |
| ↻ | Regenerate / Reset |
| ⑂ | Branch / Fork |
| 🖼 | Generate image |
| 🎥 | Generate video |
| 🎤 | Voice dictation |
| 🔊 | TTS |
| ♥ | Favorite |
| 🚩 | Report (SCOPE-CUT) |
| ⋯ | Chat Controls |

## User Extensions / Scope Decisions

- **Port the three-layer theming model as-is** — it is one of PersonaLLM's best design choices.
- Ship all 16 accent-color presets; expose CSS vars for each on web.
- Ship the 15 Bubble Color themes; map each to a bundle of CSS custom properties that compose with `--char-accent`.
- Web at ≥1024 px: convert left drawer into a **persistent sidebar**; bottom modal sheets become **right-side panels** (Chat Controls, Fork, Edit Prompt).
- Keep Markdown-style `*asterisk*` narration convention; use `<em>` for italics on web.
- Keep the floating-rail chip pattern on desktop as an inline row at the right edge of a message on hover; on mobile web keep the floating rail.

## Open Questions

- Does PersonaLLM have a **light mode**? No evidence so far — might be iOS dark-mode-only. Confirm or decide clone's stance (default to dark + opt-in light).
- Exact brand gradient values and icon set (SF Symbols vs custom PNG/SVG).
- Bubble-color-theme per-property breakdown (which CSS variables each theme sets).
- Motion-reduced / prefers-reduced-motion variants — not visible on iOS; web should respect the MQ.
