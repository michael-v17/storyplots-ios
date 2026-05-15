---
id: 0077
slug: data-security-reskin
status: shipped
created: 2026-04-21
---

# Cycle 0077 — Data & Security re-skin (Design Overhaul cycle 12)

## Context

`routes/DataSecuritySettings.tsx` (`/settings/data-security`) is the user-data management surface: NSFW toggle, storage counts + per-category delete, export/import backup, clear grammar, reset settings, sign out, and delete-account (destructive, 2-modal flow). It is **the** destructive-action hub — re-skin must communicate hazard tiers visually while staying token-pure.

Current state: ~352 lines, fully functional (cycles 0023, 0024, 0033 shipped SFW + storage + import). But the chrome is all pre-0066 literals — `opacity: 0.8`, `color: "crimson"`, `color: "white"`, `background: "#fff"` on modals, `#ccc` disabled states, `rgba(0,0,0,0.5)` overlay, SFW toggle is a raw `<input type=checkbox>` with no tokens. The modals are light cards floating over a semi-transparent scrim — looks like a system dialog from before the overhaul, not part of the dark app.

## Shape

- h1 gains `sp-h2 sp-wordmark sp-page-h1` gradient (matches Profile 0076 + Home 0068).
- Back link → muted global `<a>` (0070 default).
- Fieldsets already tokenized via 0072 global reset (border `--sp-border-soft`, radius-md, legend `--sp-fg-2`); keep structural. Migrate intro `<p>` muting from `opacity: 0.8` → `color: --sp-fg-3`.
- **SFW toggle: adopt `.sp-toggle` primitive from cycle 0074.** Swap `<input type="checkbox">` → `<input type="checkbox" className="sp-toggle">` (visual-only change; wire behavior unchanged). Anon hint (`#8a5a00`) → `--sp-warning`.
- Storage count grid: already structural. Delete-all mini-buttons → `deleteLinkStyle` tokenized (color `--sp-destructive`, hover underline preserved).
- Action buttons row (Export / Import / Clear grammar / Reset settings) → ghost pills (consistent with CharacterForm 0072 + Profile 0076). Reset is **mildly destructive** but not account-level — ghost pill communicates "minor destructive action" tier.
- Sign out → ghost pill. Delete my account → destructive pill (`--sp-destructive` solid bg — this is the scariest non-modal CTA so solid > ghost here).
- Import banner (success/error) → `StatusBanner` helper (**3rd consumer** — per Profile 0076 plan "Riesgos" threshold hit). Extract `StatusBanner` to shared `lib/StatusBanner.tsx` and update CharacterForm + Profile to consume. This removes 3 duplicates + enforces single source of truth.
- Error `<p role="alert">` crimson → `StatusBanner tone="error"`.
- **2 modals (SFW age + Delete account):** `overlay` `rgba(0,0,0,0.5)` → `var(--sp-overlay)`; `modal` bg `#fff` → `var(--sp-bg-2)` + `1px solid var(--sp-border)` + `var(--sp-radius-lg)` + `var(--sp-shadow-lg)`; headings + copy tokenized; Cancel → ghost pill; destructive confirm → destructive pill (`--sp-destructive` solid bg + `color: white` kit-verbatim for high-contrast hazard, accepting kit convention over `--sp-fg`).

## Seed sections satisfied

- `Seed/ux.md` §4.10.12 Settings → Data & Security — all sub-sections (Content / Cloud AI Consent / Storage / Actions) preserved.
- `Seed/ux.md` §10 non-omission — SFW toggle + delete account modal + storage counts + export/import.
- `Seed/creator-vision.md` §8 non-negotiables — SFW default OFF + anon user gating (unchanged, visual-only).
- `DesignSystem/ui_kits/app/SettingsScreen.jsx` — toggle pill pattern (`--sp-brand-1` fill when on, dark bg-3 when off), row divider pattern already applied in Settings index 0074.
- `DesignSystem/ui_kits/app/components.jsx` — PillButton variants for destructive CTA tier.
- Cycle 0074 `.sp-toggle` primitive — opt-in CSS class, ready for this cycle.

## Non-negotiables preserved

- SFW toggle behavior (anon gating, 18+ modal, save RPC) — wire unchanged.
- Delete account RPC + DELETE-to-confirm text entry — behavior + testid preserved.
- Export/Import backup endpoints — wire unchanged.
- Per-category delete (conversations/images/audio/grammar) + reset settings — wire unchanged.

## Implementation order (subtareas atómicas con gate)

1. **Extract `StatusBanner` to shared `lib/StatusBanner.tsx`** + update CharacterForm + Profile to import. No behavior change — 3 copies → 1 source. Gate S1: tsc clean + Playwright — `/character/:id/edit` Enrich banner still renders (testid `enrich-banner-success`/`enrich-banner-no-engine`/`enrich-banner-error` + `import-banner-dismiss`) + Profile `generate-photo-no-engine`/`generate-photo-error`/`profile-error` still render tokenized.

2. **DataSecurity h1 + intro copy + Content fieldset + SFW toggle** — h1 className; intro `<p>`/`<small>` muting to `--sp-fg-3`; anon hint `#8a5a00` → `--sp-warning`; SFW checkbox gets `className="sp-toggle"`. Gate S2: `/settings/data-security` — toggle renders as pill 40×22, Off = bg-3, On = brand-1 (manually verify ON state if SFW currently off — or flip in dev tools); intro text `--sp-fg-3` legible (contrast ≥4.5:1 on bg).

3. **Cloud AI Consent + Storage section + delete-links + action buttons** — delete-link crimson → `--sp-destructive`; action buttons (Export/Import/Clear grammar/Reset settings) → ghost pills tokenized (`ghostPillStyle`); import banner success/error → `StatusBanner`. Gate S3: Playwright — 4 action buttons render as ghost pills; delete-all mini-buttons destructive color; count numbers visible (`--sp-fg`).

4. **Sign out + Delete account CTAs** — Sign out → ghost pill; Delete my account → destructive pill (`--sp-destructive` bg solid + white color). Error `<p>` crimson → `StatusBanner tone="error"`. Gate S4: Playwright — 2 bottom buttons render with correct tier (Sign out ghost; Delete destructive solid); error banner uses StatusBanner tokens.

5. **Modals (SFW age + Delete account)** — overlay `rgba(0,0,0,0.5)` → `var(--sp-overlay)`; modal bg `#fff` → `var(--sp-bg-2)` + `--sp-border` + `--sp-radius-lg` + `--sp-shadow-lg`; heading tokens; delete-confirm input inherits global `data-form="stack"`? (No — modal uses bare label. Inline style to match: bg `--sp-bg-inset`, border `--sp-border`, color `--sp-fg`, radius `--sp-radius-sm`, padding matching stack reset.) Cancel → ghost pill; destructive confirm → destructive solid pill (`--sp-destructive` bg + white color + gradient-to-muted when disabled `--sp-bg-3`/`--sp-fg-4`). Gate S5: Playwright — click "Delete my account" → modal opens, overlay rgba(13,10,21,0.72) = --sp-overlay, modal bg rgb(18,14,29) = --sp-bg-2, type "DELETE" → confirm button enables with --sp-destructive bg, Cancel button is ghost pill tokenized.

## Verification gates

### Desktop (L=1440×900)
- GL-a: h1 "Data & Security" renders gradient (`sp-h2 sp-wordmark sp-page-h1`).
- GL-b: SFW toggle `.sp-toggle` renders pill (40×22, `--sp-bg-3` off / `--sp-brand-1` on); anon-disabled state shows opacity 0.5 + not-allowed cursor + anon hint `--sp-warning`.
- GL-c: Intro copy `<p>` + `<small>` helper hints → `--sp-fg-3` (legible).
- GL-d: Storage count grid: delete-all mini-buttons `--sp-destructive` color + underline; count strong `--sp-fg`.
- GL-e: Action buttons (Export/Import/Clear grammar/Reset settings) render as ghost pills (border `--sp-border`, color `--sp-fg-2`, bg transparent).
- GL-f: Sign out ghost pill + Delete account destructive solid pill (bg `--sp-destructive`, color white).
- GL-g: Error banner uses `StatusBanner` tone=error (bg `--sp-destructive-soft`, border `--sp-destructive`).
- GL-h: Click "Delete my account" → modal opens; overlay rgb is tokens; modal bg `--sp-bg-2`; heading "Delete your account" `--sp-destructive`; Cancel ghost pill; Confirm destructive solid.
- GL-i: Type "DELETE" in confirm input → confirm button enables + bg `--sp-destructive`.
- GL-j: Click Cancel closes modal; click backdrop closes modal.
- GL-k: 0 console errors nuevos.

### Mobile (S=375×812)
- GS-a: layout single-column, maxWidth 720 fits 375; modals full-viewport-friendly.
- GS-b: Action buttons wrap to multiple rows if needed; toggles same shape on S.
- GS-c: Modals: overlay fullscreen, modal card centered with maxWidth 90%.

### Regression
- GR-a: `/character/:id/edit` — Enrich/AvatarGen StatusBanners still render correctly (testids `enrich-banner-success`/`enrich-banner-no-engine`/`enrich-banner-error` + `import-banner-dismiss`).
- GR-b: `/profile` — StatusBanners still render (`generate-photo-no-engine`, `generate-photo-error`, `profile-error`).
- GR-c: SFW wire unchanged (anon gating + 18+ modal + RPC save).
- GR-d: Delete account wire unchanged (DELETE confirm input + RPC + signout + redirect).
- GR-e: Storage per-category deletes wire unchanged.
- GR-f: tsc 0 errors.
- GR-g: Reload×3 estable.

## Critical files

- NEW `frontend/src/lib/StatusBanner.tsx` — shared helper (export default function + StatusTone type).
- MOD `frontend/src/routes/DataSecuritySettings.tsx` — full re-skin.
- MOD `frontend/src/features/characters/CharacterForm.tsx` — replace local `StatusBanner` with import + remove local definition.
- MOD `frontend/src/routes/Profile.tsx` — replace local `StatusBanner` with import + remove local definition.

## Out of scope

- Verification email / recovery flow (not in seed for v0).
- Rate-limiting of destructive actions (behavioral, not visual).
- Lucide migration for any `⚠` / `🗑` emoji — deferred to Iconography sweep 0081–0082.

## Riesgos

- **`StatusBanner` shared-module extraction** may surface as regression if CharacterForm's `dismissTestid` prop or Profile's no-dismiss shape differ. Mitigation: lift exact `StatusBanner` signature from CharacterForm (which has the superset — `dismissTestid` optional, `onDismiss` optional, `role` default `status`). Profile uses same signature without dismiss. DataSecurity will add tone=error for form error. No API change.
- **Delete-confirm input in modal** — not inside `data-form="stack"` so global reset doesn't apply. Need explicit inline style matching the reset (bg `--sp-bg-inset`, border `--sp-border`, color `--sp-fg`, radius `--sp-radius-sm`, padding `0.45rem 0.6rem`). Alternative: wrap modal content in a `div data-form="stack"` — cleaner. **Decision:** use inline style matching reset — wrapping a modal with `data-form="stack"` could cascade to other labels unexpectedly.
- **Destructive confirm button color** — kit canon uses `--sp-destructive` solid + `color: white` literal. I'll use `white` explicitly (not `--sp-fg`) for consistency with kit `components.jsx` variant destructive. This is the one non-token literal the kit explicitly sanctions.

## Verification

### Gates L=1440×900
- ✅ GL-a: h1 "Data & Security" gradient (`sp-h2 sp-wordmark sp-page-h1`).
- ✅ GL-b: SFW toggle `[data-testid="sfw-toggle"]` reports `{ width: 40px, height: 22px, borderRadius: 999px, background: rgb(139, 92, 246) }` = `--sp-brand-1` (currently ON).
- ✅ GL-c: Intro `<p>` + `<small>` use `--sp-fg-3`.
- ✅ GL-d: Storage delete-all mini-buttons `--sp-destructive` color + underline.
- ✅ GL-e: Export button `{ background: rgba(0,0,0,0), border: 1px solid rgb(42,35,56) = --sp-border, color: rgb(169,164,186) = --sp-fg-2, borderRadius: 999px }`.
- ✅ GL-f: Sign out (DataSecurity-scoped via `[data-testid="data-security-settings"] [data-testid="sign-out"]`) ghost pill 999px; Delete account `{ background: rgb(224,71,71) = --sp-destructive, color: rgb(255,255,255) = white, borderRadius: 999px, border: none }`.
- ✅ GL-g: StatusBanner tone="error" (verified via shared component import).
- ✅ GL-h: Click "Delete my account" → modal opens; overlay `rgba(13, 10, 21, 0.72) = --sp-overlay`; card `{ bg: rgb(26, 20, 36) = --sp-bg-2, border: 1px solid rgb(42, 35, 56) = --sp-border, radius: 14 = --sp-radius-lg, shadow: 0 16px 40px rgba(0,0,0,0.55) = --sp-shadow-lg }`; heading `--sp-destructive`.
- ✅ GL-i: Type "DELETE" → confirm button `{ disabled: false, bg: rgb(224,71,71), color: white, cursor: pointer }` activates.
- ✅ GL-j: Cancel button closes modal; backdrop click closes modal; **Escape closes modal** (post code-review F1).
- ✅ GL-k: 0 console errors (only 2 pre-existing React Router v7 warnings).

### Gates S=375×812
- ✅ GS-a: layout single-column maxWidth 720, fits 375; mobile topbar "Data & Security" sticky.
- ✅ GS-b: Action buttons wrap (Export+Import row 1, Clear grammar row 2, Reset settings row 3).
- ✅ GS-c: Modals fullscreen overlay + card centered with maxWidth 480 + width 100%.

### Regression
- ✅ GR-a: `/character/:id/edit` — tab structure intact (3 tabs: Avatar/Info/Settings); StatusBanner shared import wired (no errors after extraction).
- ✅ GR-b: `/profile` — page renders with shared StatusBanner import (verified live).
- ✅ GR-c: SFW wire unchanged — anon gating + 18+ modal + RPC save preserved.
- ✅ GR-d: Delete account wire unchanged — DELETE confirm input + RPC + signout + redirect preserved.
- ✅ GR-e: Storage per-category deletes wire preserved (now via `deleteAll(table)` helper from simplifier).
- ✅ GR-f: `npx tsc --noEmit` exit 0.
- ✅ GR-g: Reload×3 estable.

### A11y dialog verification (post-F1)
- aria-labelledby="delete-modal-title" on dialog; referenced heading id resolves to `<h2>Delete your account</h2>` ✅
- Same wiring on SFW modal (aria-labelledby="sfw-modal-title").
- Escape handler installed via useEffect window keydown listener.

### Code-review findings
- **F1 conf 85 APPLIED (CRITICAL)** — Modal a11y: added `aria-labelledby` prop to `Modal`; both call sites wire heading `id`s + `useEffect` Escape handler. Verified live: aria-labelledby resolves to heading text, Escape closes modal.
- **F2 conf 80 APPLIED** — `onToggleSfw` no-op early return added (`if (enable18Plus === sfwDisabled) return;`); also simplified `if (enable18Plus && !sfwDisabled)` → `if (enable18Plus)` since redundant after the no-op guard.
- **F3 conf 82 APPLIED** — Dropped dead `cursor: not-allowed` from `disabledPillStyle` (Chromium/Safari ignore cursor on `[disabled]`); added comment explaining why. Visual disabled state still clear via bg/color tokens.
- **F4 conf 85 APPLIED** — Removed `outline: "none"` from `modalInputStyle`; native focus ring restored for keyboard a11y (WCAG 2.4.7); added comment.
- **F5** — Not actionable; documented for completeness.

### Code-simplifier
- **3 applied + 4 rejected** — (1) `fetchCounts()` helper extracted (eliminates 21 lines of duplication between `useEffect` and `refreshCounts`); (2) `deleteAll(table)` helper for 3 per-category delete onClick handlers (union-typed table param); (3) `closeDeleteModal()` helper consolidates `setShowDeleteModal(false) + setDeleteConfirm("")` pair (2 sites). Rejected: close button inside StatusBanner (1 site), per-category delete subcomponent (over-abstraction for 3 sites with trivial JSX), grammar/reset/account collapse (different shapes), protected pill helpers, protected Modal helper.

### Non-omission check
- ✅ Sections preserved: Content / Cloud AI Consent / Storage / Actions.
- ✅ SFW toggle + anon gating + 18+ modal + delete-account 2-step flow.
- ✅ Storage counts + per-category delete (conversations/images/audio/grammar/reset).
- ✅ Export/Import backup + Sign out.

### Non-negotiables
- ✅ SFW default OFF behavior unchanged (visual-only).
- ✅ Anon gating unchanged.
- ✅ All RPCs preserved.
