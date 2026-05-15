# Plan 0123 — Square character cards + desktop chrome unification

> Polish cycle iniciado por feedback del creator post-0122. Dos issues visuales en `/characters` (y `/` Home, por compartir `CharacterCard`): (a) cards portrait 3/4 con avatares "zoomeados" porque la imagen cubre el frame; (b) en desktop el outer `--sp-bg-2` (sidebar tone, plan 0108) sigue contrastando contra el content card `--sp-bg` y se ve cortado/no integrado al chrome de Safari.

## Seed sections satisfied

- `Seed/design.md` §13 anti-patterns (avoid cropped portraits as identity tiles when full avatar is meaningful)
- `Seed/ux.md` §10 non-omission (Characters tile must show full identity)
- DesignSystem precedence: `--sp-bg-2` is the elevated sidebar/sheet tone. Unifying outer + inner removes the residual seam from 0108's inversion.

PersonaLLM-Reference: `04-screens/CharacterScreen` documents the observed-app tile as image-on-top + meta-below; nothing in §3 forces a portrait aspect — square is consistent with the data model.

## User stories / non-negotiables

No behavior change. Frontend chrome only. No SSE / agent-isolation / grammar / lorebook / snapshot path touched.

## Implementation order

1. **CharacterCard image frame square + contain fit.** `features/characters/CharacterCard.tsx`: `aspectRatio: "3 / 4"` → `"1 / 1"`. Replace `backgroundImage` background-size:cover trick with a real `<img>` child sized 100%×100% + `objectFit: "contain"` so the entire avatar shows (matches MessageImage letter-box pattern shipped in cycle 0074F). Container keeps `--sp-bg-3` (when has avatar) or accent color (fallback) as the letter-box.
   - Verify L=1440 + S=375: tile image frame is square; avatars show the entire image; no crop; mode badge + count badge still positioned correctly.

2. **Card bg elevates against the new desktop page tone.** Bump `background` on the `<a>` from `var(--sp-bg-2)` → `var(--sp-bg-3)` so the card retains elevation when the desktop page bg shifts to `--sp-bg-2` (step 3). Mobile: card sits on `--sp-bg`, so bg-3 is still readable (1-step elevation).
   - Verify reload: card visibly elevated on both L and S.

3. **AppShell desktop content card unified to `--sp-bg-2`.** `features/shell/AppShell.tsx`: line 182 `background: persistent ? "var(--sp-bg)" : "transparent"` → `persistent ? "var(--sp-bg-2)" : "transparent"`. The inset margin + radius stay (no visible seam now, but they keep the rhythm). `boxShadow: "var(--sp-shadow-sm)"` removed when persistent — no shadow on a same-tone surface (would create a soft halo on identical color).
   - Verify L=1440: sidebar + content area read as one continuous surface. Mobile S=375: unchanged.

4. **Auto-typecheck + Playwright assertion across all routes that consume `CharacterCard`.** `npx tsc --noEmit` + browse `/` + `/characters` at both breakpoints.
   - Gate: 0 ts errors, tiles square with full avatars, desktop chrome unified.

## Out of scope

- Other surfaces that still consume `--sp-bg-2` (Composer, modals, etc.) — they sit on different parents and are fine.
- Sidebar / drawer chrome — already on `--sp-bg-2`, no change.
- Touchups to text padding inside the card (still 0.65rem 0.75rem 0.75rem — kit-faithful).

## Riesgos

- If an existing character avatar is heavily landscape, contain leaves vertical empty bars (accent / bg-3). Acceptable per cycle 0074F established pattern for MessageImage.
- `--sp-bg-3` cards on `--sp-bg-2` page may feel subtle. Border `var(--sp-border)` already present, that's the secondary differentiator.

## Verification

**Round 1 (cycle-0123-L-*.png):** misread the scope — bumped the inner content card to `--sp-bg-2` thinking the user wanted a single continuous surface. Creator clarified: only the outer/backdrop should be sidebar tone (already was); the inner card has to stay dark `--sp-bg` so the backdrop visibly wraps around the content card. Also flagged: tags felt scattered, need a wrapper.

**Round 2 — reverts + tag wrapper:**

- AppShell content card reverted to `--sp-bg` + `var(--sp-shadow-sm)` (Plan 0108 baseline restored).
- `CharacterCard` card bg reverted to `--sp-bg-2`; image-frame interior letterbox reverted to `--sp-bg-3`.
- `Home.tsx` `addCharacterCardStyle` + `grammarCardStyle` reverted to `--sp-bg-2`.
- `Characters.tsx` `addCharacterCardStyle` + `searchInputStyle` reverted to `--sp-bg-2`.
- **Tag wrapper (new):** the tag-pill row is now wrapped in `tagWrapperStyle` — `var(--sp-bg-3)` fill + `1px solid var(--sp-border-soft)` outline + radius 10 + padding `0.4rem 0.5rem`. Pills inside flipped from `--sp-bg-3` → `--sp-bg-2` + `1px solid var(--sp-border-soft)` so they read against the wrapper.
- **Kept:** square 1/1 image frame + `<img>` with `objectFit: contain` (avatars no longer cropped).

**Round 2 gates (cycle-0123-r2-*.png):** AppShell + card revertidos OK, backdrop visible, but tag wrapper introduced was rejected by creator — "los tags debe ser algo que no esten contenidos" (image #10 reference shows floating pills, no container). Also creator clarified the bg ask was about the **body bg** itself (image #11 DevTools): on desktop, `html, body { background }` should match the sidebar tone so Safari's chrome (rubber band, scrollbar gutters, toolbar transparency) integrates "full".

**Round 3 — body bg media query + drop tag wrapper:**

- `tokens.css`: added `@media (min-width: 1025px) { html, body { background: var(--sp-bg-2); } }` (1025px = `BP_L_MIN` in `useBreakpoint.ts`). Mobile and M keep `--sp-bg`.
- `CharacterCard.tsx`: removed `tagWrapperStyle`; tag row reverts to original inline `display: flex; flexWrap: wrap; gap: 4; marginTop: 0.15rem`. Pill style reverted to `--sp-bg-3` + no border (original).

Gates re-run:

- `npx tsc --noEmit` → 0 errors.
- Playwright eval at L=1440×900: `getComputedStyle(document.body).background → rgb(28, 28, 30)` = `#1C1C1E` = `--sp-bg-2` ✓ (sidebar tone).
- Playwright eval at S=375×812: `getComputedStyle(document.body).backgroundColor → rgb(15, 15, 16)` = `#0F0F10` = `--sp-bg` ✓ (mobile dark preserved).
- Playwright S=375 `/characters` (`cycle-0123-r3-S-characters.png`): pills floating clean, no container (matches creator reference image #10); tiles square with full avatars; mobile chrome dark end-to-end.
- Playwright L=1440 `/characters` (`cycle-0123-r3-L-characters.png`): backdrop tone unified with sidebar, content card dark inside with rounded inset.
- Console 0 errors on every nav; 2 pre-existing warnings unchanged.
- Non-negotiables: untouched.

**Tag deeper polish deferred** per creator: "ahorita entramos a lo de los tags para hacerlo mejor pero de momento que se vea mejor" — current state is the floor we keep; redesign is a follow-up cycle.

**Round 4 — wider content area:** creator flagged that the characters grid was capped too narrow. Bumped the inline `maxWidth` on both `Home.tsx` (`960 → 1600`) and `Characters.tsx` (`1200 → 1600`). The grid uses `repeat(auto-fill, minmax(200px, 1fr))` from `.sp-character-grid` so the extra width turns into more columns automatically. Sidebar collapse (280→64px) naturally hands the content area more room since the cap rarely kicks in at typical viewports.

Gates re-run:

- `npx tsc --noEmit` → 0 errors.
- Playwright L=1440×900 `/` expanded (`cycle-0123-r4-L-home-expanded-real.png`) + `/characters` expanded (`cycle-0123-r4-L-characters-expanded.png`): 5-card row, content fills available width past the old caps.
- Playwright L=1440×900 `/characters` collapsed (`cycle-0123-r4-L-characters-collapsed.png`): same 5 cards but visibly wider — `main.getBoundingClientRect().width = 1360` at viewport 1440 (cap 1600 not hit). Confirms collapsed yields more room as creator requested.

**Round 5 — slight margin + narrower cards:** creator follow-up: "deja quizas un poquito mas margen, y quizas un poquito mas angosto cada card". Iterations:

- First pass `maxWidth: 1400` → no effect at L=1440 collapsed because `<main>` defaults to `box-sizing: content-box`, so `maxWidth` only caps the content area; padding adds on top and the available 1360 stayed below the cap.
- Final: `maxWidth: 1280` + `boxSizing: "border-box"` (cap = total width incl. padding) on both `Home.tsx` and `Characters.tsx`. Also bumped horizontal padding `1rem → 1.5rem` for internal breathing room.

Gates re-run (`cycle-0123-r5c-L-*.png`):

- `npx tsc --noEmit` → 0 errors.
- L=1440 collapsed `/`: `main.width = 1280`, mainLeft=104, mainRight=1384, rightGap from viewport=56 (16 AppShell margin + 40 free) — visible right margin matching creator request.
- L=1440 collapsed `/characters`: same pattern, 5 cards still in row but slightly narrower.
- L=1440 expanded `/characters`: available 1144 < cap 1280, no cap hit, main uses 1144; 5 cards still fit (cards ~206px each — within minmax(200, 1fr) floor).
- Mobile S=375: unchanged (max-width cap above viewport, padding 1.5rem fine).
