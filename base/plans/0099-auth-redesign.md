# Plan 0099 — Auth screen redesign (full-hero cinematic, dark, dual-shape)

## Provenance

- Lift estructural del kit `ui-prototype-traveliru-partners/ui_kits/auth/sign-in/sign-in.jsx` (concretamente el patrón `compact` mobile vs split desktop). Se adapta — no se copia: paleta, tono y producto son distintos.
- DesignSystem es autoridad visual sobre Seed cuando hay conflicto (CLAUDE.md "Design system" §1, §5).
- Seed/ux.md no especifica forma exacta del auth screen — el seed solo lista que hay sign-in / sign-up / reset-password como flows. Esto cae en el espacio "DesignSystem decide forma".
- Seed/design.md §13 anti-patterns: evitar light-card-en-dark-shell, light-mode-only sin razón. Validamos.
- Cycle 0066+ (Tokens + SF Pro) ya está aplicado al resto de la app — auth quedó atrás del resto y se ve plain HTML porque nunca fue tocado en el overhaul.

## Decisión de shape — son dos layouts intencionalmente distintos

No es un responsive shrink. El kit Traveliru tiene dos branches (`compact` vs split) y replicamos esa lógica con dos shapes propios para StoryPlots:

### L (≥768px) — Full-hero cinematic con glass card flotante
- Fondo entero = imagen anime full-bleed (`auth-hero.webp`).
- Vignette + scrim diagonal para legibilidad de texto + foreground calmo de la card.
- Wordmark + brand pitch flotando arriba-izquierda, texto en `--sp-fg` con text-shadow sutil.
- Glass card con el form anclada **abajo-izquierda** (sobre el lower-foreground del que hablamos en el prompt Seedream): `--sp-bg-2` + `backdrop-filter: blur(12px)` + border-soft + `--sp-shadow-lg` + `--sp-radius-lg` (14px), max-width 440, padding holgado.
- Footer copyright debajo del card, también flotante, en `--sp-fg-3`.

### S (<768px) — Top-image + bottom-sheet sólido
- Mitad superior = imagen anime ocupa el viewport-top (~50–55vh), gradient bottom que la corta limpiamente contra la sheet.
- Wordmark + brand pitch en blanco encima de la imagen, top.
- Sheet sólida (no glass) en `--sp-bg-2` que sube desde abajo, `--sp-radius-xl` (20px) en top corners, sombra hacia arriba `0 -10px 40px var(--sp-overlay)`. Ocupa el resto del viewport, contiene todo el form + OAuth + footer.
- Inputs dentro de la sheet usan `--sp-bg-3` o `--sp-bg-inset` (decido en implementación según hover/focus contrast).
- Sin glass, sin scrim radial — el corte imagen↔sheet es el contraste.

Razón: en mobile el glass se vuelve frágil (poco viewport, blur cae mal en performance), la sheet sólida se siente nativa y se conecta con el patrón modal que ya usamos en Settings.

## Modos cubiertos

Tres modos compartiendo shell (signin / signup / reset-password) — exactamente como funciona hoy AuthForm.tsx, pero re-skineados.

- **signin**: Email + Password + Sign in primary + OR + Google + GitHub + "New to StoryPlots? Create account" + Forgot password link.
- **signup**: igual a signin, con copy "Create your account" / "Step into your first story". Si el user es anon (`isAnonymous(session)`) → copy "Link account" porque sus guest data carry over.
- **reset-password**: dos sub-estados ya existentes — `isRecovering = false` muestra solo Email + "Send reset link"; `isRecovering = true` muestra solo "New password" + "Save". El "resolving" guard (early-return spinner) se preserva intacto, solo se re-skina con copy en `--sp-fg-2`.

## Toda la state machine actual se preserva

- `mode`, `email`, `password`, `submitting`, `error`, `notice`, `recovering` (incl. el `"resolving"` tri-state).
- `useEffect` que escucha `PASSWORD_RECOVERY` event → preservado.
- `withBusy`, `onOAuth`, `onEmailSubmit` → preservados sin cambios de lógica.
- Anon → upgrade flow (`linkIdentity`, `updateUser`) → preservado.
- Both Google AND GitHub OAuth → preservados (Traveliru solo tiene Google; nosotros tenemos los dos ya wireados, no los sacrificamos).

## Tokens binding (todos del DesignSystem, ningún hex literal)

| Surface | Token |
|---|---|
| App bg de fallback (hero loading state) | `--sp-bg` |
| Glass card (L) / sheet (S) | `--sp-bg-2` |
| Inputs bg | `--sp-bg-3` |
| Inputs hover/focus border | `--sp-border-strong` |
| Inputs idle border | `--sp-border` |
| Card border | `--sp-border-soft` |
| Card shadow (L glass) | `--sp-shadow-lg` |
| Sheet shadow (S, upward) | inline `0 -10px 40px var(--sp-overlay)` |
| Card radius (L) | `--sp-radius-lg` |
| Sheet radius top (S) | `--sp-radius-xl` |
| Input radius | `--sp-radius-md` |
| Primary copy | `--sp-fg` |
| Body copy | `--sp-fg-1` |
| Subcopy / hints | `--sp-fg-2` |
| Section label / muted | `--sp-fg-3` |
| Placeholder | `--sp-fg-4` |
| Primary button | brand grad (`--sp-brand-grad`) sobre `--sp-fg` text |
| OR divider | `--sp-border` line + `--sp-fg-3` text |
| Error | `--sp-destructive` + `--sp-destructive-soft` bg |
| Status notice | `--sp-fg-2` |
| Hero scrim L | `radial-gradient(ellipse at 30% 70%, transparent 0%, rgba(13,10,21,0.45) 50%, var(--sp-bg) 100%)` (literal alpha because tokens don't include partial opacities) |
| Hero scrim S | `linear-gradient(180deg, transparent 0%, transparent 60%, var(--sp-bg-2) 100%)` (cuts cleanly into the sheet seam) |
| Kicker chip | `background: rgba(139,92,246,0.18); color: var(--sp-brand-1)` (uses brand-1 hex shade because no soft-purple token exists) |

## Archivos

- `frontend/src/features/auth/AuthForm.tsx` — rewrite completo del JSX y estilos inline (todas las inline styles bind a tokens). State preservada. Probable extracción de `BrandPitch` y `FormCard` como componentes locales si AuthForm queda >180 líneas.
- `frontend/public/auth-hero.webp` — imagen Seedream que el creador genera y pega. **No se commitea desde Claude**; el path es lo único hardcoded.
- Sin nueva CSS file. Sin nueva dep. Sin migración.

## Implementation order — 4 subtareas, cada una con su Playwright assertion

Verificación entre subtareas. Si un assertion falla, se arregla antes de avanzar.

1. **L+S shell + scrim, sin imagen aún** — placeholder bg `--sp-bg` con un linear-gradient subtle que simule la imagen. Layout L: hero + glass card vacía abajo-izquierda. Layout S: top half + sheet vacía abajo. Test: `/sign-in` carga sin horizontal scroll en 1440×900 y 375×812; ambos `data-testid="auth-shell-l"` y `data-testid="auth-shell-s"` se renderizan según breakpoint.
2. **Brand pitch (wordmark + kicker + H2 + sub) sobre el hero** — copy provisional pero final. Posiciones: top-left L, top-center S. Test: `data-testid="auth-brand-pitch"` visible, no overflow contra la card en L (no chocar), no overflow contra la sheet en S.
3. **Form card / sheet con todo el contenido y state preservada** — email, password, primary submit, OR, Google, GitHub, secondary link. Testids existentes (`signin-submit`, etc.) preservados. Test: en `/sign-in`, escribir `xvp@storyplots.app` + clave dummy, click Sign in → fetch a Supabase auth (intercept Network, no necesita login real); error case renderiza `role="alert"` con `--sp-destructive`. En `/sign-up` y `/reset-password`, los mismos testids responden con copy correcto.
4. **Imagen real `auth-hero.webp` enganchada** — una vez que el creador la deje en `frontend/public/`, conectar al `background-image` de la zona hero. Test: GET `/auth-hero.webp → 200` en Network panel; el wrapper hero tiene `background-image` no vacío (verificable via getComputedStyle).

## Verificación final (post-subtask 4)

- `code-review` plugin pass — findings van al docs section abajo.
- `code-simplifier` pass — buscar inline styles repetidos, extraer si vale la pena.
- Playwright sweep en L (1440×900) y S (375×812):
  - `/sign-in` happy path: render → submit fail mock → error render → submit success mock → redirect.
  - `/sign-up` igual.
  - `/reset-password` ambos sub-modos (forgot vs recovering).
  - Anon-mode upgrade flow: signin como anon → /sign-up → linkIdentity hit (sin completar real OAuth, solo Network verify).
- TypeScript `tsc --noEmit` clean.
- `Seed/ux.md §10` non-omission self-check: ningún surface seed-required cae fuera de scope. Auth no es modal-listed en seed §registry, sí está en flows §6 user stories #1/#2 → preserved.

## Verification

Implementado 2026-05-05. Resultados:

- **Typecheck:** `tsc --noEmit` clean.
- **L (1440×900) `/sign-in`:** `shape="l"`, `auth-shell-l` rendered, brand pitch shows "STEP INTO STORIES / Welcome back / Sign in to your StoryPlots workspace.", glass card flotante abajo-izquierda con email + password + Forgot password? link + Sign in primary (brand grad) + OR + Continue with Google + Continue with GitHub + "New to StoryPlots? Create account". Footer abajo-derecha. Sin horizontal scroll. Screenshot `.playwright-mcp/auth-l-1440.png`.
- **S (375×812) `/sign-in`:** `shape="s"`, `auth-shell-s` rendered, brand pitch encima, sheet sólida abajo con todo el form + footer. `marginTop: -20` softens the seam. Sin horizontal scroll. Screenshot `.playwright-mcp/auth-s-375.png`.
- **`/sign-up` S:** pitch "Create your account / Step into your first story in seconds.", submit "Create account →", 2 OAuth buttons, "Sign in" secondary link.
- **`/reset-password` S (default sub-mode):** pitch "Reset your password / We'll email you a link to set a new password.", submit "Send reset link →", 0 OAuth buttons (correctamente ocultos para reset), email input present, password input not present.
- **Error path L:** signin con bogus creds → Supabase devuelve "Invalid login credentials", `[data-testid="auth-error"]` con `role="alert"`, bg `--sp-destructive-soft`, border `--sp-destructive`. Screenshot `.playwright-mcp/auth-l-error.png`.
- **State preservation:** anon→upgrade flow no tested live (require an anon session) but la lógica de `isAnonymous(session)` + `linkIdentity` + `updateUser` está intacta línea por línea.
- **`recovering="resolving"` guard:** path no exercised live (requires `#type=recovery` URL) but el early-return spinner se reskined a `--sp-bg` + `--sp-fg-2`.
- **Image asset:** `frontend/public/auth-hero.webp` no commiteado — el creador lo genera con el prompt Seedream documentado en SESSION_HANDOFF y lo deja en ese path. La página funciona sin la imagen (cae al `--sp-bg` color).

**Code-review pass:** 2 cleanups aplicados:
1. `data-testid-shell="auth-shell-l"` typo en `<main>` (residuo de borrador, no era un testid válido) — eliminado.
2. `data-form="stack"` en `<form>` referenciaba una convención inexistente del proyecto — eliminado.

**Code-simplifier pass:** ningún speculative abstraction encontrada. `brandPitch` y `formBlock` son helpers locales reutilizados entre los branches L y S — extracción justificada. `fieldStyle / labelStyle / inputStyle / inlineLinkStyle / footerLinkStyle` factorizados al final del file porque cada uno se usa 2+ veces.

**Open follow-ups (NO en este cycle):**
- `/terms` y `/privacy` routes no existen — los links del footer 404'an. El kit Traveliru tiene el mismo placeholder. Capturable como un cycle aparte cuando esas pages se redacten.
- Imagen `auth-hero.webp` pendiente de generación con el prompt Seedream documentado.
- a11y deep-pass (focus rings, contrast WCAG AA) — los inputs heredan global `:focus-visible` del Cycle 0070 pero no hice un audit visual exhaustivo. Posible follow-up del Cycle 0084 (Final QA sweep).

## Risks / Open

- Si la imagen Seedream que el creador genera no respeta el "lower foreground calmo" que pedimos en el prompt, la glass card en L puede chocar con personajes y verse pobre. Mitigación: si pasa, re-prompt con énfasis "lower-left third must be visually calm" o reposicionamos card a bottom-center.
- `backdrop-filter: blur(12px)` en glass card: Safari iOS ≤14 no lo soporta bien. Fallback ya cubierto por `--sp-bg-2` opaco (la card sigue siendo legible sin blur, solo pierde el efecto glass). Aceptable.
- El `auth-hero.webp` sin compresión cuidadosa puede ser >500 KB y romper Cycle 0092 spirit. Recomendación al creador: WebP quality 80, max dim 1600px en su lado más largo. Target ≤300 KB.
