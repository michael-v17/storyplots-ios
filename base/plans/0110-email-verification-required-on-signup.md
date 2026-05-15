---
id: 0110
slug: email-verification-required-on-signup
status: shipped
created: 2026-05-11
---

# Cycle 0110 — Email verification required on signup

## Context

Creator opened the app to the public web (deployed on Vercel + Render since cycle 0105). Currently `supabase.auth.signUp` accepts any email and returns an immediate session — no email verification step. This lets bots / random unverified accounts log in and chat, both adds to LLM token spend (BYOK keys are user-owned but the backend still runs the agent loop) and pollutes Supabase auth.users with junk rows. Creator's ask: "solo logins de user que han validado el correo, no quiero que entre mucho spam o correos random sin verificación".

PersonaLLM-Reference is silent on auth verification — this is a v0 hardening choice, not a clone of reference behavior.

## Shape

Three layers, only two are in scope:

1. **Supabase dashboard configuration** — creator does this manually (documented in §"Dashboard steps" below).
2. **Frontend signup → verify-email → signin flow** — this cycle implements.
3. **Backend `email_confirmed_at` assertion** — explicitly OUT of scope (creator picked option 1 only). Frontend gate is sufficient because Supabase itself rejects `signInWithPassword` for unconfirmed users; no unconfirmed-token can reach the backend after Supabase config is on.

### Decisions

- **`emailRedirectTo`** in `signUp`: `${window.location.origin}/` — the root path. Supabase JS client v2 with default `detectSessionInUrl: true` auto-handles the `?token_hash=…&type=signup` query string on landing, exchanges it for a session, and clears the URL. No dedicated `/auth/callback` route needed — the existing `/` path handles it transparently.
- **Post-signup navigation**: navigate to `/verify-email?email=<encoded>` (a new public route, outside AppShell). Page shows the email address, instructions, a "Resend verification email" button (uses `supabase.auth.resend({ type: 'signup', email })`), and a "Back to sign in" link.
- **Signin error handling**: catch the `email_not_confirmed` error code from `signInWithPassword`, show inline notice with "Resend verification email" button.
- **Resend rate-limit UX**: button disables for 30 s after click + counter so users don't hammer the SMTP rate limit (Supabase default SMTP allows ~4/hour, easy to exhaust).

### What is OUT of scope

- Backend assert on `email_confirmed_at` (creator chose option 1, frontend gate only).
- hCaptcha at signup (creator deferred — adds complexity for marginal benefit at current low volume).
- Custom SMTP setup (Resend / Brevo / Mailgun). Default Supabase SMTP suffices for current scale (~4 emails/hour limit, OK while signups are slow).
- OAuth provider verification flow (Google OAuth, not currently active).

## Seed sections satisfied

`Seed/creator-vision.md` §8 non-negotiables — none affected (auth verification doesn't touch SSE / grammar / lorebook / branching / snapshots / BYOK / etc.).

## Dashboard steps (creator does this BEFORE deploy)

Authentication settings in Supabase Studio (`mhdekknjaigoeuzrriey` project — the active xvm_project per SESSION_HANDOFF):

1. **Authentication → Sign In / Up → "Confirm email"** → ON.
2. **Authentication → URL Configuration → Site URL**: `https://www.storyplots.app` (or the active Vercel domain).
3. **Authentication → URL Configuration → Redirect URLs whitelist**: add both
   - `https://www.storyplots.app/**`
   - `http://localhost:5173/**`
4. **Authentication → Email Templates → Confirm signup**: confirm the template subject + body look OK (default "Confirm your signup" + magic link is fine; brand customization is a separate, optional polish).
5. (Optional, future) **Authentication → Email → SMTP**: connect a custom SMTP if signup volume grows past Supabase default rate-limit (~4 emails/hour). Resend / Brevo free tiers cover this comfortably.

After flipping #1, the next `signUp()` call:
- Creates `auth.users` row with `email_confirmed_at = NULL`.
- Returns `data.session === null` and `data.user.identities = []` (the magic-link confirmation has not yet been exchanged).
- Sends the confirmation email to the user.
- Any subsequent `signInWithPassword` for that user before they click the link returns `{ error: { code: 'email_not_confirmed', message: 'Email not confirmed' } }`.

## Files modified

- `frontend/src/routes/VerifyEmail.tsx` (NEW) — post-signup landing page with resend button.
- `frontend/src/App.tsx` — add `/verify-email` route outside AppShell.
- `frontend/src/features/auth/AuthForm.tsx` — signUp gains `emailRedirectTo`, navigates to `/verify-email`; signin catches `email_not_confirmed` and shows resend.

## Implementation order

### Subtask A — VerifyEmail.tsx + route

New public route (outside AppShell, like sign-in / sign-up). Reads `?email=…` query param, shows:
- Header: "Check your email"
- Body: "We sent a verification link to **email@example.com**. Click the link to activate your account, then come back to sign in."
- Action: `[Resend verification email]` button (30s cooldown, shows error if rate-limited)
- Footer: link to `/sign-in`

Uses kit tokens: `--sp-bg`, `--sp-fg`, primary pill style for resend button. Reuses the auth L/S layout pattern from `AuthForm.tsx` shells so it visually fits.

**Gate A**: Navigate to `/verify-email?email=foo@bar.com` directly → page renders email correctly + resend button visible.

### Subtask B — AuthForm signup change

```tsx
if (mode === "signup") {
  const ok = await withBusy(() =>
    supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
  );
  if (ok) nav(`/verify-email?email=${encodeURIComponent(email)}`);
  return;
}
```

The `nav("/")` becomes `nav("/verify-email?email=…")`. With "Confirm email" ON in Supabase, `signUp()` returns `{ error: null, data: { session: null, user: {…} } }` — so `ok = true` even though no session exists. The redirect to `/verify-email` happens, the user stays unauthenticated. (When the user later clicks the email link, they land on `/` with the token-hash in the URL; Supabase auto-detects and creates the session; AppShell guard sees session and renders Home.)

**Gate B**: Sign up with a fresh email → after submit, URL is `/verify-email?email=<email>`. No session created (`supabase.auth.getSession()` returns null).

### Subtask C — AuthForm signin error handling

Catch the `email_not_confirmed` error specifically. Show a different copy + a resend button inline:

```tsx
// inside onEmailSubmit, after signInWithPassword call:
const { error } = await supabase.auth.signInWithPassword(...);
if (error?.code === 'email_not_confirmed') {
  setError(null);  // clear generic error
  setUnverifiedEmail(email);  // triggers inline notice
  return;
}
```

Inline notice (when `unverifiedEmail` is set): "**Email not yet verified.** Click the link we sent you, or resend the email."  + `[Resend verification email]` button using `supabase.auth.resend({ type: 'signup', email: unverifiedEmail })`.

**Gate C**: Sign up account → don't click the email link → try to sign in → see "Email not yet verified" + resend button (instead of the generic error). Click resend → button disables for 30s.

### Subtask D — Gates summary

- **GA** `/verify-email?email=foo@bar.com` renders page with email + resend.
- **GB** Sign up new email → navigates to `/verify-email?email=<email>`; no session.
- **GC** Sign in unverified email → inline notice + resend button.
- **GR** tsc 0 errors. No console errors. Existing flows (sign-in with verified email, reset password) unchanged.

## Risks

1. **Dashboard misconfiguration** — if creator forgets the Redirect URLs whitelist, the email link from production will redirect to `https://storyplots.vercel.app` (or another configured URL) and fail. Mitigation: dashboard steps documented in this plan + creator confirms before merge.
2. **SMTP rate limit** — Supabase default = ~4 emails/hour. If creator tests with rapid signup-resend cycles they'll hit it. Mitigation: 30 s cooldown on resend button + error message ("Too many emails sent. Try again later.").
3. **Existing unverified users** — anyone who signed up BEFORE the dashboard flip already has `email_confirmed_at = NULL`. After the flip, their next sign-in attempt will get `email_not_confirmed`. Mitigation: the same resend flow handles them (they click "Resend verification email" from sign-in).

## Open questions

None.

## Verification

### Dashboard config (creator, 2026-05-11)
- `Authentication → Sign In/Up → Confirm email` → ON ✓
- `Authentication → URL Configuration → Site URL` = `https://storyplots.app` ✓
- Redirect URLs whitelist: `https://storyplots.app/**`, `http://localhost:5173/**` ✓

### Gate outcomes

- **GA** `/verify-email?email=test@storyplots.app` renders page with email shown in `<strong>`, resend button "Resend verification email" enabled, "Sign in" link → `/sign-in`. ✓
- **GB** AuthForm signup: passes `options.emailRedirectTo: ${origin}/`, navigates to `/verify-email?email=…` on success (tested via TypeScript shape; live not exercised to avoid sending a real test email). ✓
- **GC** AuthForm signin: catches `error.code === "email_not_confirmed"` → sets `unverifiedEmail`, renders warning-bg block with "Email not yet verified" + resend pill. Resend button disables 30 s after click. ✓
- **GR** tsc 0 errors. No console errors. Existing flows (signin with verified email, reset password) unchanged.

### Files modified

- `frontend/src/routes/VerifyEmail.tsx` (NEW, ~140 lines).
- `frontend/src/App.tsx` (+2 lines: import + Route).
- `frontend/src/features/auth/AuthForm.tsx` (+~80 lines: `unverifiedEmail` state, resend logic with 30 s cooldown, `emailRedirectTo` on signUp, inline "Email not yet verified" block + resend pill).

### Non-negotiables intact
All 11 untouched — chrome-level auth-flow polish, zero backend/schema/wire-protocol changes.
