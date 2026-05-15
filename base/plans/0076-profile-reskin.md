---
id: 0076
slug: profile-reskin
status: shipped
created: 2026-04-21
---

# Cycle 0076 — Profile re-skin (Design Overhaul cycle 11)

## Context

`routes/Profile.tsx` (`/profile` — UserPersona editor) is the user's in-chat identity editor. It already consumes global tokens via the 0070 `data-form="stack"` reset (all inputs/textareas/selects tokenized gratis) and the 0072 fieldset+legend reset (Appearance fieldset styled). The remaining hex literals live in the avatar block: upload label `border: 1px solid #ccc`, Cancel button `border: 1px solid #ccc`, no_engine banner `#ddc77a`/`#fdf6e3`/`#6a5209` warm-white (regressed look on dark body), error `crimson`, Save/Clear buttons are unstyled browser defaults. The avatar itself is a plain 96×96 `<img>` with no click-to-zoom — users cannot inspect detail (mirror bug to 0049 char avatar).

Carry-over from 0075 post-ship: `AvatarLightbox` in `CharacterForm.tsx:905` still has `background: rgba(0,0,0,0.92)` literal — the same bleed-through bug the ImageViewer fixed (underlying chrome shows at ~8%). Fix applied here from day 1 on any new lightbox AND on the existing CharacterForm one.

## Shape

- Avatar block mirrors kit `NewPersonaScreen.jsx` circular + `CharacterForm` 0072 pattern (120px centered, double-shadow ring: inner `--sp-bg` 3px, outer `--sp-brand-1` 5px — persona has no `--char-accent` so brand-1 is the canonical fallback; fg-3 bg when empty).
- Upload → label pill (file input hidden behind label). Generate → primary pill with `--sp-brand-grad`. Cancel (during gen) → ghost pill.
- `no_engine` + `error` states → `StatusBanner` helper (tones warning/error) — same component as CharacterForm 0072 but kept local per Profile scope; extraction deferred unless code-simplifier flags a 3rd duplication site.
- Save → primary pill (`primaryPillStyle(!canSave)`), Clear persona → destructive pill, Cancel `<Link>` → muted default `<a>` (global 0070 default applies).
- **NEW:** `<img>` becomes `<button type="button" onClick={openLightbox}>` when `photoUrl` is truthy → same AvatarLightbox pattern as CharacterForm 0049/0072 with `var(--sp-bg)` opaque from start. Cursor `zoom-in`.
- **Carry-over:** fix CharacterForm.tsx:905 `rgba(0,0,0,0.92)` → `var(--sp-bg)` (aplicar primero, gate shared).

Inputs/textareas/selects already covered by `data-form="stack"` reset (0070) — no per-field styling touched. Fieldset already covered by 0072 global reset — same rule.

## Seed sections satisfied

- `Seed/ux.md` §4.7 `/profile` (UserPersona editor) — photo / name / gender / appearance / background; primary actions Save / Upload / Generate; secondary Clear / Cancel; states empty / editing / saving / error.
- `Seed/ux.md` §10 non-omission — Persona editor must exist.
- `Seed/PersonaLLM-Reference/04-screens/user-profile.md` — avatar block with Upload + Generate pill buttons, persona name preview, fields organized by section. StoryPlots keeps the flatter form (no STATUS section — we have single persona per user), but the visual pattern (pill buttons, avatar block) is replicated.
- `DesignSystem/ui_kits/app/NewPersonaScreen.jsx` — circle accent swatches, textarea shape, pill buttons on footer, focus ring pattern (NOT ingesting the 4-step wizard — that's a 4-persona flow, out of scope for v0 single persona).
- `DesignSystem/ui_kits/app/components.jsx` — PillButton variants primary/ghost/destructive; Avatar shadow ring; StatusBanner equivalent patterns.

## Non-negotiables preserved

- User Persona is NOT sent to Grammar Agent (code-level, `Seed/domain.md` §6.7). Re-skin is visual-only; no wire changes.
- BYOK — Generate Avatar endpoint unchanged. `NoImageEngineError` → `no_engine` banner preserved.
- Single persona per user — no multi-persona switcher.

## Implementation order (subtareas atómicas con Playwright gate)

1. **Fix CharacterForm AvatarLightbox opacity** (carry-over 0075). Change `background: rgba(0,0,0,0.92)` → `background: "var(--sp-bg)"` at `CharacterForm.tsx:905`. Gate S1: navigate `/character/:id/edit` → click avatar → viewport bg should report computed `rgb(13, 10, 21)` (not partial black), no underlying chrome visible.

2. **Profile pill helpers + StatusBanner (local copies)**. Copy `primaryPillStyle(disabled)` + `basePillStyle` + `ghostPillStyle` + `destructivePillStyle` + `StatusBanner` (tones success/warning/error) as local consts/fn at bottom of Profile.tsx. Import them only here (duplication deliberate — extraction threshold is 3rd consumer). Gate S2: `npx tsc --noEmit` clean.

3. **Profile avatar block re-skin**. Avatar `<img>` → `<button type="button">` clickable when `photoUrl`, 120×120 centered, double-shadow ring (inner `--sp-bg` 3px, outer `--sp-brand-1` 5px), bg `--sp-bg-3` when empty, `cursor: zoom-in`. Upload label → ghost pill shape (file input `display:none` preserved). Generate → `primaryPillStyle(saving || generating)`. Cancel (during gen) → ghost pill. Gate S3: Playwright L + S — `/profile` renders avatar centered, Upload label computed bg transparent + border `--sp-border`, Generate computed bg gradient.

4. **Profile status banners + form actions**. `no_engine` warm-white → `StatusBanner tone="warning"` with Link inline. `error` `crimson` → `StatusBanner tone="error" role="alert"`. General form error `p crimson` → `StatusBanner tone="error" role="alert"`. Save/Clear buttons → primary/destructive pills. Cancel `<Link>` → fontSize 0.9em muted default (inherit global `<a>` from 0070). Gate S4: Playwright — form action row renders 3 buttons (Save primary / Clear destructive / Cancel muted link), tabbing through inputs keeps focus ring `--sp-brand-1` (global `data-form="stack"` rule 0070).

5. **AvatarLightbox for Profile** — reuse same pattern as CharacterForm (local function component, but no local duplication of the global CharacterForm one — copy inline because Profile is self-contained). Background `var(--sp-bg)` from day 1. Escape key + backdrop click + `onClick={e.stopPropagation}` on img + close button (tokenized, same pattern). Gate S5: Playwright — click avatar → lightbox opens, press Escape → closes; click backdrop → closes.

## Verification gates

### Desktop (L=1440×900)
- GL-a: `/profile` h1 renders "Your persona" or "Set up your persona" based on empty state, tokenized (`.sp-page-h1` class already present, just verify not white flash).
- GL-b: Avatar 120×120 centered; double-shadow ring with inner `--sp-bg` + outer `--sp-brand-1` (or placeholder bg `--sp-bg-3` when empty).
- GL-c: Upload label ghost pill + Generate primary pill + Cancel ghost pill (when generating) render correctly with tokens.
- GL-d: All form inputs (Name, Gender, Skin, Eyes, Hair, Extras, Background story) inherit `data-form="stack"` tokens — bg `--sp-bg-inset`, border `--sp-border`, color `--sp-fg`, focus ring `--sp-brand-1`.
- GL-e: Click avatar → `AvatarLightbox` opens with opaque `--sp-bg` overlay (no bleed).
- GL-f: Escape closes lightbox.
- GL-g: Save button primary pill gradient; Clear button destructive pill; Cancel Link muted (`--sp-fg-2`).
- GL-h: no_engine StatusBanner warning tone (yellow/amber `--sp-warning-soft` bg + `--sp-warning` border).
- GL-i: Fieldset "Appearance" tokenized via global reset (legend `--sp-fg-2`, border `--sp-border-soft`, radius-md).
- GL-j: 0 console errors nuevos (backend 404 pre-existing OK).

### Mobile (S=375×812)
- GS-a: `/profile` layout single-column, maxWidth 560 preserved.
- GS-b: Avatar block centered, pills wrap with `flexWrap: wrap`.
- GS-c: Lightbox covers viewport fully (opaque `--sp-bg`).

### Regression
- GR-a: `/character/:id/edit` → click avatar → lightbox overlay opaque (no Gallery-style bleed visible) — AvatarLightbox carry-over fix verified.
- GR-b: CharacterForm unchanged otherwise (tabs Avatar/Info/Settings segmented pills 0072 intact).
- GR-c: `data-form="stack"` 0070 rules still apply to Profile inputs.
- GR-d: tsc 0 errors.
- GR-e: Reload×3 estable.

## Critical files

- `frontend/src/routes/Profile.tsx` — main target (~275 → ~360 lines, +85 for pill helpers + lightbox + StatusBanner local).
- `frontend/src/features/characters/CharacterForm.tsx:905` — carry-over opacity fix (1-line change).

## Out of scope

- `NewPersonaScreen.jsx` wizard (kit 4-step flow not applicable — v0 has single persona, flat form).
- Multi-persona switcher.
- Gender pill segmented control (kit) — keeping `<select>` because our gender list has 4 options + "—" empty, extensible per seed §User Extensions (free-text future).
- Emoji icon migration (🎨 → Lucide `Sparkles`) — deferred to Iconography sweep 0081–0082 per roadmap.

## Riesgos

- **StatusBanner local copy duplication**: CharacterForm 0072 defines StatusBanner inline; copying into Profile creates 2nd site. If Data & Security 0077 adds a 3rd, code-simplifier should flag extraction to `lib/StatusBanner.tsx`. **Decision:** duplicate for now, revisit after 0077 ships.
- **120px avatar bump**: from current 96px is a visual jump. Kit spec `NewPersonaScreen` uses ~100–120 per mockup; 120 matches CharacterForm 0072 exactly. Consistency wins.
- **Avatar ring color**: persona has NO `--char-accent` (scoped to characters). Using `--sp-brand-1` (violet) is the canonical kit fallback (wordmark + primary). Alternatively could use `--sp-border-strong`. Chose brand-1 because ring is a visual feature (not muted chrome) and signals "generated/uploaded persona" per SF consistency.

## Verification

### Gates L=1440×900
- ✅ GL-a: h1 "Your persona" renders with class `sp-h2 sp-wordmark sp-page-h1` (gradient violet→teal).
- ✅ GL-b: Avatar `[data-testid="profile-avatar-open"]` reports computed `{ width: 120px, height: 120px, boxShadow: "rgb(13, 10, 21) 0px 0px 0px 3px, rgb(139, 92, 246) 0px 0px 0px 5px", cursor: "zoom-in" }`.
- ✅ GL-c: Upload label `{ border: 1px solid rgb(42, 35, 56) = --sp-border, borderRadius: 999, color: rgb(169, 164, 186) = --sp-fg-2, bg: rgba(0,0,0,0) }`. Generate button `{ background: linear-gradient(90deg, rgb(139, 92, 246) 0%, rgb(52, 211, 153) 100%) = --sp-brand-grad, borderRadius: 999, color: rgb(13, 10, 21) = --sp-bg (post code-review F2) }`.
- ✅ GL-d: Name input `{ background: rgb(11, 8, 19) = --sp-bg-inset, border: 1px solid rgb(42, 35, 56) = --sp-border, color: rgb(242, 242, 245) = --sp-fg }` via global `data-form="stack"` reset 0070.
- ✅ GL-e: Click avatar → lightbox opens. `[data-testid="profile-avatar-lightbox"]` computed `{ backgroundColor: rgb(13, 10, 21) = --sp-bg, position: fixed, zIndex: 200, role: dialog, aria-modal: true }` (no bleed-through from day 1).
- ✅ GL-f: Escape closes lightbox — `querySelector('[data-testid="profile-avatar-lightbox"]')` returns null after Escape.
- ✅ GL-g: Save pill `{ background: brand-grad, color: rgb(13, 10, 21), fontWeight: 600, borderRadius: 999 }`. Clear pill `{ border: 1px solid rgba(224, 71, 71, 0.15) = --sp-destructive-soft, color: rgb(224, 71, 71) = --sp-destructive }`. Cancel Link `{ color: rgb(169, 164, 186) = --sp-fg-2, fontSize: 13.5px, textDecoration: none }`.
- ✅ GL-h: no_engine StatusBanner — code path verified; tone warning renders `--sp-warning-soft` bg + `--sp-warning` border when no ComfyUI configured (not triggered live because Image Engine IS configured at ComfyUI 192.168.0.7).
- ✅ GL-i: Appearance fieldset inherits global 0072 reset (legend `--sp-fg-2`, border `--sp-border-soft`, radius-md).
- ✅ GL-j: 0 console errors (only 2 pre-existing React Router v7 future-flag warnings).

### Gates S=375×812
- ✅ GS-a: `/profile` layout single-column, maxWidth 560 + mx auto fits 375.
- ✅ GS-b: Avatar centered + pills wrap (Upload + Generate on same row at 375).
- ✅ GS-c: Lightbox opaque full-viewport (cycle-0076-S-profile-lightbox.png), image aspect-ratio locked.

### Regression
- ✅ GR-a: `/character/:id/edit` → Avatar tab → click avatar preview → lightbox opens; computed `{ backgroundColor: rgb(13, 10, 21) = --sp-bg }` (carry-over 0075 post-ship fix applied). Close button `{ color: rgb(242, 242, 245) = --sp-fg, border: 1px solid rgb(42, 35, 56) = --sp-border }` (post code-review F1).
- ✅ GR-b: CharacterForm otherwise unchanged (tabs segmented pills + Enrich + Delete + Save 0072 intact, verified via snapshot structure).
- ✅ GR-c: `data-form="stack"` 0070 rules still apply (name/gender/skin/eyes/hair/extras/background inputs tokenized).
- ✅ GR-d: `npx tsc --noEmit` exit 0.
- ✅ GR-e: Reload×3 estable — 3× navigate `/profile` returned 0 errors each time.

### Code-review findings
- **F1 (conf 95) APPLIED** — CharacterForm.tsx:917-918 close button `color: "white"` → `var(--sp-fg)`; border `rgba(255,255,255,0.35)` → `var(--sp-border)`. Verified live computed.
- **F2 (conf 85) APPLIED** — Profile.tsx:451 `primaryPillStyle` active text `#0D0A15` → `var(--sp-bg)`. Visually identical (same hue), lint-correct. Verified live computed.
- **F3 (conf 85) APPLIED** — Profile.tsx:337 empty-avatar "＋" `color: --sp-fg-4` → `--sp-fg-3`. Per legibility memory: `--sp-fg-4` reserved for placeholder/disabled/decorative; the "＋" is a CTA affordance for empty state, not a placeholder.

### Code-simplifier
- **1 applied** — `AvatarPreview` ringStyle: 4 parallel ternaries (`background/backgroundImage/backgroundSize/backgroundPosition`) collapsed to single `...(photoUrl ? {imageProps} : {bg + cursor})` spread. Visually grouping the two states. tsc clean.
- **9 rejected** (per agent report): `appearance` aliasing used across 4 reads; `flex-row containers` with different gaps/margins (2 occurrences below threshold); appearance field labels declarative (each with protected testid); AvatarPreview button/div split (different semantic elements); StatusBanner minimal; onUpload/onSave/onClear share try/catch shape but each has different success path; gender null coercion 2-site; protected pill helpers; photoUrl-gated lightbox open 1-liner.

### Non-omission check
- ✅ Persona editor exists (`Seed/ux.md` §10 non-omission).
- ✅ Sections preserved: photo / name / gender / appearance (skin, eyes, hair, extras) / background story.
- ✅ Primary actions: Save + Upload + Generate. Secondary: Clear + Cancel.
- ✅ States: empty / editing / saving / error (loading via separate `profile-loading` testid).

### Non-negotiables
- ✅ User Persona NOT sent to Grammar Agent — wire path unchanged (only chrome).
- ✅ BYOK Generate Avatar endpoint unchanged (`NoImageEngineError` → `no_engine` banner).
- ✅ Single persona per user — no multi-persona switcher introduced.
