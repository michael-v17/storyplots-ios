# Design — StoryPlots v0

> **Authority:** ninth in precedence. This file keeps visual direction coherent and prevents drift into generic defaults. It is NOT a full design system. Conflicts with higher files are resolved in their favor and recorded in [open-questions.md](open-questions.md).
>
> **Primary source:** [PersonaLLM-Reference/09-design-system.md](PersonaLLM-Reference/09-design-system.md) and [PersonaLLM-Reference/11-web-adaptation-notes.md](PersonaLLM-Reference/11-web-adaptation-notes.md). v0 preserves PersonaLLM's visual language; this file captures the preserve-vs-change rules and v0-specific additions (grammar surfaces, SFW notices).

---

## 1. Visual north star

- **Dark, confident, power-user friendly.** The app looks like a serious tool for people who know what they're doing, not a playful chatbot.
- **Reveal, not hide, complexity.** PersonaLLM's strongest design choice is that advanced controls (11-position prompt, generation parameters, retrieval knobs) are visible and inline-hinted rather than buried under dev-menus. v0 keeps that spirit everywhere, including the new Grammar Module surface.
- **No marketing copy in-app.** Marketing lives on a separate landing (not built in v0). In-product copy is terse, functional, and direct — see [PersonaLLM-Reference/10-non-functional.md](PersonaLLM-Reference/10-non-functional.md) "Tone of voice".
- **Chat-first; grammar opt-in.** Home's visual hierarchy emphasizes Characters; the grammar snapshot is secondary. Settings → Grammar is discoverable but never a first-run imposition.

---

## 2. Design principles

1. **Dialogue/narration typography is load-bearing, not cosmetic.** Asterisk spans render italic (narration); quoted spans render plain (dialogue). This readability convention also drives dual-voice TTS. Regressing it breaks two user-visible behaviors.
2. **Three-layer theming.** Preserved from PersonaLLM exactly:
   - **App base theme** — dark, near-black with subtle blue-purple tint.
   - **Bubble Color theme** — global user selection from a palette of packs.
   - **Character accent color** — per-Character hue themes bubble fill, rail chips, CTAs, avatar glow, Chat Controls header.
3. **Inline hint under every advanced control.** Every slider / toggle / input has a one-line hint explaining impact (e.g., "Higher means better recall but slower retrieval.").
4. **Skip-able with reassurance.** Optional / onboarding-adjacent flows use "Skip for Now" + "Change anytime in Settings" phrasing.
5. **Informational + actionable errors.** Every error tells the user what's wrong AND links to the fix.
6. **Dark by default in v0.** Light mode is an open question; do not ship a weak light mode that undermines the dark-first visual coherence.
7. **WCAG 2.1 AA baseline.** Not a stretch goal; a baseline that must be audited during implementation.
8. **Respect `prefers-reduced-motion`.** Typing Speed reveal animation and image-generation sparkle get disabled under the MQ.

---

## 3. Aesthetic constraints (fixed vs flexible)

**Fixed (do not drift):**

- Dark theme as default.
- Italic-for-narration + plain-for-dialogue typography.
- Three-layer theming model.
- Left sidebar + top nav shell; no bottom bar.
- Bubble-oriented message layout with avatar + timestamp.
- Floating action rail / inline-row-on-hover for per-message actions.
- Destructive actions use red CTAs + explicit "cannot be undone" copy.
- Primary CTAs use the purple→teal brand gradient pill on marketing-adjacent moments; secondary actions use dark pills.

**Flexible (acceptable variation):**

- Exact hex values — the PersonaLLM palette is approximated from screenshots and can be refined with brand calibration.
- Icon set — Lucide / Heroicons / Tabler is fine; custom SVG for the fork glyph and scenario card is acceptable.
- Light mode — not committed in v0; may be added post-v0 if demand justifies it.
- Exact sidebar width at L (suggested ~280 px, collapsible to ~64 px).

---

## 4. Base palette (approximate)

All values are derived by eye from PersonaLLM screenshots ([PersonaLLM-Reference/09-design-system.md](PersonaLLM-Reference/09-design-system.md)) and labeled `(approx)`. Calibrate against actual brand assets before implementation.

| Role | Approx value | Notes |
|---|---|---|
| Background (primary) | `#0D0A15` `(approx)` | Near-black with violet tint |
| Background (elevated card) | `#1A1424` `(approx)` | Subtle lift |
| Border / divider | `#2A2338` `(approx)` | Very low contrast |
| Text (primary) | `#F2F2F5` `(approx)` | Near-white |
| Text (muted) | `#8E89A0` `(approx)` | Section labels, hints — **audit contrast at ≥ 4.5:1 for WCAG AA** |
| Brand gradient start | `~#8B5CF6` `(approx)` | Purple — wordmark, primary CTA |
| Brand gradient end | `~#34D399` `(approx)` | Teal — wordmark, primary CTA |
| Destructive | `#E04747` `(approx)` | Delete / Erase / destructive CTA |
| Success | `#2ECC71` `(approx)` | "Connected" state |
| Warning | `#F59E0B` `(approx)` | "Content may be removed" cards, SFW-blocked notice |

### 4.1 Character accent colors

16 presets + custom HEX picker ([PersonaLLM-Reference/04-screens/character-info.md](PersonaLLM-Reference/04-screens/character-info.md)). Each Character picks one accent. Expose as a CSS custom property `--char-accent` scoped to `.chat-root[data-character-id]`; every tinted component reads from it (bubble fill, rail chip tint, CTAs in image-viewer / branch, avatar glow, Chat Controls header).

### 4.2 Bubble Color themes

Three packs, 15 themes total — preserve all of them:

- **Essentials:** Default, Monochrome, High Contrast, Custom.
- **SillyTavern pack:** Tavern, Azure, Cappuccino, Macaron, Moonlit.
- **Moods pack:** Classic RP, Ocean, Sunset, Neon, Forest, Lavender.

Each theme maps to a bundle of CSS custom properties that compose with `--char-accent`.

---

## 5. Typography baseline

- **Font family (web fallback stack):** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif`. PersonaLLM's iOS source uses SF Pro; the fallback stack keeps the apparent weight and rhythm close enough.
- **Weight scale:** 400 body · 500/600 semibold labels + CTAs · 700 headings.
- **Section headers:** small-caps, tracking-wide, muted color (e.g., `SECTION LABEL`).
- **Dialogue/narration convention (load-bearing):**
  - `*asterisk span*` → **italic** (narration / action). Visually de-emphasized: lighter tone on dark background.
  - `"quoted span"` → **plain weight, full-contrast**. Dialogue.
  - Mixed freely within one assistant message.
  - The same segmentation drives dual-voice TTS routing (narration → narrator voice; dialogue → character voice).
- **System Prompt counter style:** `1,243/2,000` at the top-right of the relevant textarea. Soft warning at 2,000 (not a hard limit on web).
- **Timestamps:** small, muted, HH:MM below user/assistant messages.
- **Grammar inline correction row:** visually distinct from the user bubble — muted caption style. No diff highlighting. Mode B's explanation is a second short line in the same row.

---

## 6. Spacing, radius, density

From [PersonaLLM-Reference/09-design-system.md](PersonaLLM-Reference/09-design-system.md):

- Primary content padding: ~16 px from screen edge.
- List-row padding: ~12–16 px vertical, 16 px horizontal.
- Section spacing: ~24 px between cards.
- Card corner radius: ~14 px (large cards), ~10 px (small tiles).
- Floating rail chips: ~36 px circle, ~12 px gap (target 44×44 touch area on mobile per HIG).
- Sidebar: ~280 px open; collapse to ~64 px icon rail on L.

---

## 7. Component feel catalog

| Component | Appearance | Usage |
|---|---|---|
| **Pill button — primary gradient** | Purple→teal wordmark-style | Continue / Start / Save (Character editor) / Create Persona / I Understand & Agree |
| **Pill button — secondary dark** | Dark fill, subtle border | Cancel / Skip for Now / "See all" |
| **Pill button — destructive red** | Red fill, red border | Delete / Erase / Confirm-Delete / Delete Account |
| **Pill button — accent-tinted** | Matches `--char-accent` | Regenerate / Test Voice / Test Connection / Branch (primary, NOT destructive) |
| **Segmented tab control** | Rounded, text-only | Avatar / Info / Settings (Character editor); Cloud / Custom (Engines); Roleplay / Assistant |
| **Toggle switch** | Purple-on / gray-off | Character Memory / Auto Images / Grammar Master / SFW disable / Reinforcement Mode |
| **Radio card** | Card-sized option blocks | Writing Style / Scenario Mode / Inline Grammar Mode (A vs B) |
| **Slider + number input** | Range with trailing numeric | Temperature / Max Tokens / Context / Typing Speed / TTS speed/pitch/volume |
| **Stepper (`−` / `+`)** | Compact numeric | Auto-Lore cadence / Injection Depth / Context Messages |
| **Text input (rounded pill)** | Single-line, rounded | Search / email / short-text |
| **Textarea (rounded card)** | Multi-line, soft-bordered | System Prompt / Description / Author's Notes / Extraction Prompt |
| **Dropdown (chevron-down)** | Single-select | Model picker / Provider picker / English Style / Grammar Tier |
| **Dropzone (dashed border)** | Drag-and-drop | Character Import / Avatar upload |
| **Color swatch grid** | 4×4 grid + custom picker | Accent Color / Bubble Colors |
| **Resolution grid tile** | 3×3 grid with dimensions | Visual Roleplay resolution picker |
| **Floating action rail** | Vertical circular chips | Per-message actions (Regenerate / Branch / Generate Image) |
| **List row (3-part)** | Avatar + title + subtitle + trailing meta | Recent Chats / Settings rows / Provider rows |
| **Card (tinted border)** | Subtle accent-tinted border | Character cards, scenario cards |
| **Section header** | Uppercase small-caps, muted | Settings section labels |
| **Modal sheet (bottom)** | Slide-up with spring | Chat Controls / Author's Notes / Fork / Image long-press on S/M |
| **Right-pane inspector (L)** | Slide-in panel | Chat Controls / Fork / Edit Prompt on desktop |
| **Confirmation modal (centered)** | Small centered dialog | Delete Message / Destructive Trim Edit |
| **Destructive confirmation page** | Full-screen red | Erase Everything / Delete Account |
| **Side drawer (left)** | Persistent on L, slide on S/M | Primary navigation |
| **Streaming preview card** | Elapsed timer + Cancel / Continue in Background | "Creating Character" AI Generate modal |
| **Empty state illustration** | Illustration + heading + body + 1–2 CTAs | Home empty ("No Companions Yet"), Gallery empty |
| **Filter chip row** | Pill chips with active state | Gallery filters (Character / kind) |
| **Inline info card** | Colored left-border card | Provider-missing hint, limit warnings, SFW-blocked notice |

### 7.1 v0-specific components

- **Grammar inline correction row** — below a user bubble when Master + Inline are ON. Mode A: corrected text, muted caption style, no label. Mode B: corrected text + short explanation on a second line.
- **Grammar Sidebar toggle** — small icon button on the composer, right of the send button; visible only when Master + Sidebar Grammar are ON.
- **Grammar Panel (right inspector on L; bottom sheet on S/M)** — list of `original → corrected` pairs (two lines per pair, no diff highlighting), mini-summary block, "Clear grammar for this Conversation" action.
- **Rewrite gate** — replaces the composer when Reinforcement Mode is ON and a correction exists; shows the corrected text, an input for the rewrite, a subtle "Attempt 1 / 2 / 3" counter, and a "Continuing anyway" microcopy after the 3rd failed attempt.
- **Grammar Dashboard blocks** — each of the 9 content blocks (level, errors, fillers, overused, connectors, narrative, suggestions, reinforcement performance, correction list) is its own card with the standard card corner radius + section header.
- **English Style dropdown** — single-select in the Character editor; three options with one-line descriptions. Matches the existing dropdown component.
- **SFW-blocked image notice** — inline info card with warning color; includes a "What is this?" link to Settings → Data & Security (does not auto-open).
- **Account upgrade dialog** — lightweight modal with provider buttons; copy "Your Characters, Conversations, and keys stay with you" is visible.

---

## 8. Iconography

- Rounded, line-based icons; moderate stroke width.
- Two-tone highlights (icon + accent color).
- Preferred library: **Lucide / Heroicons / Tabler**. Custom SVG for the **fork** glyph and the **scenario card** glyph if needed.

### 8.1 Icon cheat-sheet (canonical by use)

| Glyph | Meaning |
|---|---|
| ☰ | Menu hamburger (S/M) |
| ▦ / ⋮⋮ / ☰ | Layout-toggle on `/characters` (optional in v0) |
| ⇅ | Sort |
| 🔍 | Search (post-v0) |
| ✨ | AI Generate |
| ✏ | Edit |
| ⬇ | Import |
| 📖 | Writing Style / Lorebook |
| 🎭 | Roleplay mode |
| 🛡 | Age / SFW |
| ☁ | Cloud consent |
| 💾 | Storage |
| 🗑 | Delete (destructive color) |
| ↻ | Regenerate |
| ⑂ | Branch / Fork |
| 🖼 | Generate image |
| 🎥 | Generate video |
| 🎤 | Voice dictation |
| 🔊 | TTS |
| ⋯ | Chat Controls |
| ✅ | "Connected" |
| ⚠ | Inline warning |

Removed vs PersonaLLM: ⚡ (Credits), ⭐ (Premium), ♥ (Community favorite), 🚩 (Community report).

---

## 9. Grammar-surface visual rules

- **Inline correction row** visually distinct from the user bubble: slightly muted color, smaller text, left-aligned under the user bubble. No icon prefix (the position alone is enough).
- **Grammar Panel** list items: first line = original (muted), second line = corrected (emphasised). No diff highlighting. Newest first.
- **Grammar Panel mini-summary** uses the section-header style followed by a bullet or chip row (e.g., "top 3 error types" chips).
- **Rewrite gate** styling: the composer's visual frame is preserved; inside the frame, the original input area is replaced by the rewrite prompt and a subtle attempt counter. No intrusive modal.
- **Home grammar snapshot widget** is a card with the same card styling as Recent Characters, but visually secondary to Recent Characters on the Home grid.
- **Dashboard** uses a two-column layout on L (narrative blocks left, correction list right) and a stacked layout on S/M.

---

## 10. SFW-related visuals

- **SFW-blocked image**: inline warning-color info card in the chat feed; no dramatic red shout. Copy: "This image was blocked by SFW mode. Rewrite the prompt or, if you're 18+ and authenticated, you can disable SFW in Settings → Data & Security."
- **18+ confirmation modal**: centered, destructive-tone but not blood-red; explicit "By continuing you confirm you are 18 or older" checkbox; single primary CTA "Continue"; secondary "Cancel".
- **Disabled-SFW state** has **no global indicator** in v0 — the change is silent; Settings reflects the toggle state.

---

## 11. Motion

- **Typing Speed** slider (0..1) drives a CSS-animated reveal on streamed tokens. Value 0 = no reveal / raw streaming; 1 = instant.
- **Image generation** uses a centered sparkle animation in the generating card.
- **Drawer slide** from left with a dim overlay on S/M.
- **Modal sheets** slide up from bottom on S/M with a spring ease.
- **Toggle flip** animation when switching ON/OFF.
- **Reduced-motion** disables the typing reveal and the generation sparkle; toggles become instant.
- **No parallax, no scroll-linked effects.**

---

## 12. Accessibility baseline

Target: **WCAG 2.1 AA** everywhere. Concrete requirements:

- **Contrast** — all muted copy must clear 4.5:1 (audit PersonaLLM's `#8E89A0` on `#0D0A15` in the build).
- **Focus rings** visible on dark background for every interactive element.
- **Keyboard-first chat** — every chat action reachable without mouse: `J/K` message nav, `R` regenerate, `B` branch, `I` generate image, `←/→` variant navigation, `Esc` close overlay.
- **Real form controls** — all toggles are `<input type="checkbox" role="switch">`; all sliders are `<input type="range">` paired with `<input type="number">`.
- **Streaming token reveal** announced to an ARIA live region at `aria-live="polite"`, batched to avoid screen-reader flooding.
- **`prefers-reduced-motion`** respected per §11.
- **`prefers-color-scheme: light`** — in v0, the app stays dark regardless. Revisit if light mode ships.
- **Font size** respects user browser zoom and root-size changes.

---

## 13. Anti-patterns (do not ship)

1. **Marketing copy in-app.** No "Welcome to the future of" / "Level up your X" phrasing.
2. **Hidden advanced controls.** Do not put the Prompt Editor or Grammar Tier behind a dev-menu.
3. **Moralizing content warnings.** SFW notices are informational, not preachy.
4. **Exposed SFW pre-filter block** anywhere — not in Prompt Editor, not in Settings, not in a "show raw system prompt" view.
5. **Grammar nags.** No "Turn on Grammar!" push when Master is OFF. The empty-state copy on `/grammar` is invitational, not pushy.
6. **Auto-enabled notifications / emails / cross-user visibility.** None of those exist in v0.
7. **Loading spinners instead of skeletons** on Home / Chat. Skeletons keep layout stable.
8. **Full-page reloads.** SPA routing is expected throughout.
9. **Bottom tab bar.** Left sidebar + top nav is the shell. No iOS-style bottom bar.
10. **Intrusive modals for Reinforcement failures.** The 3-strike fallthrough is an inline microcopy change, not a modal.
11. **Generic light-mode defaults.** If the implementer ships a light mode, it must be designed; do not let the dark scheme merely invert.

---

## 14. Brand considerations

- **Wordmark**: "StoryPlots" in the purple→teal gradient pill style (adapted from PersonaLLM's wordmark pattern).
- **App icon / favicon** — not committed; a dark square with the wordmark's gradient mark is the obvious default.
- **Landing page** — not in v0. If needed, a separate Cloudflare Pages project.

---

## 15. Open design questions

Rolling up from this file into [open-questions.md](open-questions.md):

- Exact brand hex palette and icon set.
- Light mode existence.
- Bubble-color-theme per-property breakdown (which CSS variables each theme sets).
- Exact sidebar width and collapse behavior at L.
- Whether the rewrite gate should include a "Skip this turn (no grammar)" escape hatch (not committed; probably not in v0, matches principle "user is never trapped" only via the 3-strike cap).

---

## Cross-references

- [creator-vision.md](creator-vision.md) §5.2 (chat typography), §5.6 (Dashboard), §8 (principles informing anti-patterns).
- [ux.md](ux.md) — screen-level contracts this visual language dresses.
- [PersonaLLM-Reference/09-design-system.md](PersonaLLM-Reference/09-design-system.md) — observed visual language.
- [PersonaLLM-Reference/10-non-functional.md](PersonaLLM-Reference/10-non-functional.md) — tone of voice, copy patterns, a11y observations.
- [PersonaLLM-Reference/11-web-adaptation-notes.md](PersonaLLM-Reference/11-web-adaptation-notes.md) — iOS→web visual adaptation.
