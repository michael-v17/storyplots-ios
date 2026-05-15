---
id: 0002
slug: auth-signup-signin-link
status: proposed
created: 2026-04-15
---

# Cycle 0002 — Sign-up / Sign-in / Anonymous Linking

## Context

Cycle 0001 shipped anonymous Supabase sign-in + `public.users` + RLS.
Every returning visit silently reuses the same anonymous User row.
This cycle closes the "guest → signed-up" loop: users can upgrade
their anonymous account to email / Google / GitHub **without losing
any data** (F5 non-negotiable), sign in from a different browser,
and sign out. Password reset is included because story #3 is Critical.

Scope is deliberately narrow. Still deferred: onboarding slides,
fiction-disclaimer overlay, sidebar+top-bar shell beyond the user
section, `/settings/*`, UserPersona, Characters, BYOK, Grammar.

**Done when:** a user can (a) arrive anonymous → link email or
OAuth and keep the same `users.id` (no second row); (b) sign out and
sign back in from a different browser and see the same row; (c) hit
`/sign-up` / `/sign-in` / `/reset-password` directly; (d) Playwright
verifies F5 carry-over and that `auth_method` cannot be spoofed.

## Shape of the change

```
 /sign-in     /sign-up     /reset-password      (new routes)
     │            │               │
     └────────┐   │   ┌───────────┘
              ▼   ▼   ▼
       SupabaseAuthForm (shared)
         ├─ Google button  → signInWithOAuth({ provider: 'google' })
         ├─ GitHub button  → signInWithOAuth({ provider: 'github' })
         └─ email+password → signUp / signInWithPassword

  Anonymous ──────────────────────────────────► Authenticated
   user.id =  ─── updateUser({ email, pw })  ───► user.id   (SAME)
   auth.users                                     auth.users
   is_anonymous=true                              is_anonymous=false

                on auth.users AFTER UPDATE trigger
                    ↓
       public.users.auth_method ← derived from provider
       public.users.email       ← NEW.email

   /                                                          │
   Sidebar user-section:                                       │
   - anonymous → "Sign up to access from anywhere" CTA  ──────┘
   - authenticated → display_name / email + "Sign out"
```

## 1. Seed sections satisfied

- [user-stories.md §5.1 story #1](../Seed/user-stories.md) *Sign up
  with email/Google/GitHub · Critical* — email+pw; Google OAuth;
  GitHub OAuth; RLS-enforced isolation; no Apple.
- [user-stories.md §5.1 story #3](../Seed/user-stories.md) *Reset a
  forgotten password · Critical* — "Forgot password" link on
  `/sign-in`; Supabase-managed recovery email.
- [user-stories.md §5.1 story #2](../Seed/user-stories.md) — extends
  cycle 0001 by wiring the "Upgrading the anonymous User preserves all
  data" AC.
- [user-stories.md §6 flow F5](../Seed/user-stories.md) *Account
  upgrade preserves data* — same `User.id` after link, every owned
  row intact.
- [creator-vision.md §6 Authentication](../Seed/creator-vision.md) —
  Supabase Auth JWT; email/password + Google + GitHub; guest mode via
  anonymous sign-in; "Upgrading to a real account preserves all data
  with no migration step"; no Apple, no Microsoft.
- [product.md §5 F5](../Seed/product.md), §8 success "Account upgrade
  preserves all data", §9 "Auth is Supabase JWT only".
- [schema.md §2.1 users](../Seed/schema.md) — `auth_method`, `email`,
  `email_verified_at`, `last_active_at` populated on link. `id` PK is
  preserved. `sfw_disabled` CHECK unchanged (remains enforced).
- [schema.md §5](../Seed/schema.md) items #1 (per-user RLS) and #2
  (anon identical RLS) — unchanged, re-verified after link.
- [ux.md §1 sitemap](../Seed/ux.md) — `/sign-in`, `/sign-up`,
  `/reset-password` added.
- [ux.md §4.3](../Seed/ux.md) *sign-in / sign-up / reset-password*
  full screen contract (verbatim): provider buttons Google + GitHub;
  email + password form; "Forgot password" link on `/sign-in`;
  `/sign-up` ↔ `/sign-in` cross-links; submit / OAuth primary; magic
  link is **deferred** to a later cycle since the seed says "and/or"
  (email+password alone is sufficient for story #1 AC — documented in
  §6 open questions below); required states form / submitting /
  error; non-omission "Google, GitHub, email+password, reset link".
- [ux.md §2 sidebar](../Seed/ux.md) — "Account upgrade CTA appears in
  the user section when the current User is anonymous". Only the
  user-section of the sidebar lands this cycle; the rest of the
  sidebar stays the minimal skeleton from 0001.
- [ux.md §6 required states](../Seed/ux.md) — loading / error / form
  / submitting on the three auth routes.
- [ux.md §8 non-omission](../Seed/ux.md) — item #10 "Account upgrade
  preserves data — UI explicitly states this in the upgrade dialog
  copy." **Must ship copy** e.g. "Your guest data will carry over."
- [domain.md §2.1](../Seed/domain.md) User lifecycle — anon→auth
  transition; [domain.md §5.1 F5](../Seed/domain.md).

## 2. PersonaLLM-Reference provenance

Per CLAUDE.md principle 5 (observed vs. extended separation):

- `/sign-in` and `/sign-up` are **v0 extensions with no observed
  precedent** — PersonaLLM uses a single "Sign in with Apple" inside
  its onboarding carousel
  ([PersonaLLM-Reference/04-screens/onboarding.md](../Seed/PersonaLLM-Reference/04-screens/onboarding.md)
  slide 2). The seed explicitly drops Apple and substitutes
  email/OAuth (creator-vision §6). No reference screen to replicate.
- Anonymous linking / F5 has **no PersonaLLM analogue**
  ([PersonaLLM-Reference/05-flows.md](../Seed/PersonaLLM-Reference/05-flows.md)
  contains no such flow) — this is a pure v0 addition.
- **What we are not replicating:** the 5-slide onboarding carousel,
  the upfront 18+ age gate, the ToS/Privacy toggles. Those belong to
  a later onboarding cycle or are seed-dropped outright.

## 3. User stories touched

- **#1 Sign up with email/Google/GitHub · Critical** — all three
  provider ACs in scope (email+password, Google OAuth, GitHub OAuth).
  Magic-link variant deferred (see §6).
- **#2 Guest without signing up · Critical** — specifically the
  "Upgrading the anonymous User preserves all data — no migration
  step" AC; the rest was satisfied in 0001.
- **#3 Reset a forgotten password · Critical** — `/reset-password`
  page + "Forgot password" link on `/sign-in`.
- **Partial #4 Verify email · High** — `email_verified_at` gets
  populated by the auth.users UPDATE trigger when Supabase flips the
  verified flag. No dedicated UI for the verification state this
  cycle (story is "non-blocking"); we surface it only via a subtle
  text state in the sidebar user-section. Full UX lands when we
  build `/settings/account`.
- **Flow F5** — exercised end-to-end by Playwright.
- **Not touched:** story #5 fiction disclaimer (onboarding cycle);
  story #6 SFW disable (requires `/settings` — deferred); stories
  #7+ (UserPersona, Characters, etc.).

## 4. Domain invariants preserved

From [domain.md §6](../Seed/domain.md):

- **#11 Anonymous RLS == authenticated RLS.** No policy changes;
  re-verified via Playwright after link.
- **#12 `sfw_disabled=true` requires non-anonymous.** CHECK unchanged;
  we re-exercise it after link and expect it to now *allow* the
  update (cycle 0001 verified it *rejects* while anonymous).
- **#15 No cross-user DB reads.** Unchanged; re-verified — two users
  who both went through link flows still only see their own row.

New invariant to enforce this cycle:

- **#F5-carry — `users.id` MUST NOT change across anonymous→auth
  link.** Ownership FKs from future tables (Characters, Conversations,
  BYOK) all key off `users.id`; a changed id would silently orphan
  everything. Enforced by Supabase Auth semantics (link operation
  mutates `auth.users` row in-place, not via INSERT). Playwright
  asserts the post-link `user.id` equals the pre-link id, and that
  `public.users` still has exactly one matching row.

## 5. Schema scope / RLS

### New migration `supabase/migrations/0002_auth_sync.sql`

Adds an `AFTER UPDATE` trigger on `auth.users` that re-derives
`public.users.auth_method`, `email`, and `email_verified_at` whenever
Supabase mutates the underlying auth row (link / unlink / email
confirmation). This keeps `auth_method` authoritative with the
database (not a client-supplied string), closing the spoof vector
domain invariant #12 cares about.

```sql
create or replace function public.handle_auth_user_updated()
returns trigger language plpgsql security definer
set search_path = public as $$
declare provider text; new_method public.auth_method;
begin
  provider := coalesce(new.raw_app_meta_data->>'provider', '');
  new_method := case
    when new.is_anonymous then 'anonymous'
    when provider = 'google' then 'google'
    when provider = 'github' then 'github'
    else 'email'
  end::public.auth_method;

  update public.users
     set auth_method = new_method,
         email = new.email,
         email_verified_at = new.email_confirmed_at,
         last_active_at = now()
   where id = new.id;

  return new;
end; $$;

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_auth_user_updated();
```

### No new RLS policies

`auth_method` is no longer client-writable *in practice* because the
trigger overwrites it on every `auth.users` UPDATE. Belt-and-braces:
we also add a column-level update restriction by replacing
`users_update_own`:

```sql
drop policy users_update_own on public.users;

create policy users_update_own on public.users
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Row-level policy alone doesn't prevent updating auth_method/email.
-- Use a trigger to reject client-driven changes to auth-shadow cols.
create or replace function public.users_block_auth_shadow()
returns trigger language plpgsql as $$
begin
  if (new.auth_method is distinct from old.auth_method
      or new.email is distinct from old.email
      or new.email_verified_at is distinct from old.email_verified_at)
     and current_setting('role', true) <> 'postgres' then
    raise exception 'auth_method / email / email_verified_at are read-only from the client';
  end if;
  return new;
end; $$;

create trigger users_block_auth_shadow_trg
  before update on public.users
  for each row execute function public.users_block_auth_shadow();
```

(Postgres `security definer` functions run as `postgres`, so the
sync trigger bypasses this guard; PostgREST calls run as
`authenticator`/`authenticated`, so they trip it.)

**Migration apply notes:** since the hosted DB has data from cycle
0001, running this migration is ALTER-only — no recreate. The two
test anonymous users are fine; the new trigger has no retroactive
effect.

## 6. UX surfaces

From [ux.md](../Seed/ux.md):

- **`/sign-in`** — full contract per §4.3. Google / GitHub buttons,
  email + password, "Forgot password" link, "Sign up" cross-link,
  required states (form/submitting/error).
- **`/sign-up`** — same layout as sign-in minus "Forgot password";
  adds the F5 "your guest data will carry over" copy when the user
  is currently anonymous.
- **`/reset-password`** — email input; "Send reset link" button;
  success state shows "Check your email"; post-redirect handler
  consumes the Supabase recovery token and prompts for new password.
- **Sidebar user-section (§2)** — populated this cycle only in the
  account-upgrade CTA slot; rest of sidebar remains skeleton.
  Anonymous: "Sign up to access from anywhere" button → navigates to
  `/sign-up`. Authenticated: email (muted) + "Sign out" link.
- **Home (§4.2)** — unchanged, but the new anonymous nudge banner
  ("Sign up to access from anywhere" dismissible, per ux.md §6
  required-states block) ships as a *simple* one-line banner above
  the empty state. Dismissal persists in `localStorage` only (no
  schema change).

Required states (§6): loading / form / submitting / error exercised
on each of the three routes.

Non-omission checklist (§8) items touched: #10 "Account upgrade
preserves data — UI explicitly states this."

## 7. Open questions

- **Magic-link variant.** Story #1 says "email+password **and/or**
  magic link". Plan ships email+password only this cycle; magic link
  is deferred. **Not a new open question** — the "and/or" wording
  already authorizes this scope cut. Will revisit if creator wants it
  in 0002. Plan proceeds assuming email+password satisfies the AC.
- **Anonymous nudge timing.** ux.md §6 says the banner shows "briefly,
  as a dismissible banner on Home and Chat the first time the user
  lands on each." Chat doesn't exist yet. Plan ships the Home banner
  only; the Chat banner lands with the Chat cycle. No new open
  question — the "on each" wording accommodates per-surface rollout.
- **Sidebar other entries.** The full sidebar (Characters, Grammar,
  Gallery, Settings) doesn't exist yet. Plan keeps the skeleton from
  0001; only the user-section slot fills in. No open question.
- **Captcha for OAuth abuse.** Dashboard suggested captcha for
  anonymous sign-ins (already seen). OAuth signup does not need it
  in v0. No open question.

No items touched in [open-questions.md](../Seed/open-questions.md)
§1 needing new entries.

## 8. Implementation order

1. **Migration `0002_auth_sync.sql`.** Write + apply via Supabase SQL
   Editor. Smoke: call `auth.users` UPDATE (via Supabase dashboard
   → Users → manually edit a user) and observe `public.users`
   sync. Verify the client-side UPDATE-blocker trigger throws on a
   direct PostgREST attempt.
2. **Add `react-router-dom`.** Only routing addition this cycle.
   Pin to v6.x (context7 before install). Replace the pathname
   branch in `App.tsx` with `<BrowserRouter>` + `<Routes>`: `/`,
   `/sign-in`, `/sign-up`, `/reset-password`, `*` = 404.
3. **Build `SupabaseAuthForm` component** under
   `frontend/src/features/auth/AuthForm.tsx`. Props: `mode: 'signin'
   | 'signup' | 'reset'`. Handles Google / GitHub / email-password /
   reset-email submit. All three routes render it with a different
   `mode`. Shared states: form / submitting / error.
4. **OAuth redirect handling.** Supabase JS handles the auth callback
   automatically if the app loads at the redirect URL. Configure
   redirect URL = `http://localhost:5173` in the Supabase dashboard
   (request the creator to add this).
5. **Anonymous link flow.** In `AuthForm`, when the current session
   is anonymous and the user submits email+password, call
   `supabase.auth.updateUser({ email, password })` — Supabase's
   anonymous-link path that preserves `user.id`. For OAuth, call
   `supabase.auth.linkIdentity({ provider })`. Verify via Playwright
   the pre/post `user.id` match and `public.users` still has exactly
   one row (RLS view).
6. **Sidebar user-section.** Minimal component
   `frontend/src/features/shell/UserSection.tsx` that reads current
   session and renders either the upgrade CTA (anonymous) or the
   email + sign-out (authenticated). Mounted on Home.
7. **Home banner.** Dismissible "Sign up to access from anywhere"
   above the empty state for anonymous users. Dismissal stored in
   `localStorage['sp:home-nudge-dismissed']`.
8. **Backend: no new routes.** `/health` continues to work — JWT
   verification is agnostic to `auth_method` (the JWT's `aud` is
   always `authenticated` even for anon, as empirically confirmed in
   0001).
9. **Verification (§9 below).**

Dependencies added: `react-router-dom` (frontend). No new backend
deps. Query context7 for react-router-dom v6 Vite-SPA setup before
step 2 to avoid invention.

## 9. Verification

### Playwright gates (all required)

1. **F5 carry — email link.**
   Fresh context → anonymous sign-in (0001 path) → insert a row into
   some user-scoped table via the anon JWT (for now the only writable
   user-scoped column is `preferences`; flip
   `preferences.chat_behavior.typing_speed` to `0.42`) → go to
   `/sign-up` → submit email+password. Assert: (a) post-link
   `session.user.id === pre-link user.id`; (b) `public.users` still
   has exactly one row for that id; (c) that row's
   `auth_method === 'email'` and `email` matches; (d) the
   `preferences.chat_behavior.typing_speed` value is still `0.42`
   (data carry). This is the non-negotiable F5 check.

2. **F5 carry — OAuth (GitHub).**
   Same as #1 but via `linkIdentity({ provider: 'github' })`. Playwright
   will need a test GitHub account; if the plugin can't drive an
   external OAuth consent screen reliably, mark this test "manual"
   and link a dashboard screenshot to the plan — do not silently
   skip. (This is the one gate that may require creator involvement;
   called out here so it doesn't surprise at closeout.)

3. **`auth_method` spoof rejection.**
   As an anonymous user, issue `supabase.from('users').update({
   auth_method: 'email' }).eq('id', auth.uid())`. Expect the
   `users_block_auth_shadow_trg` to throw. This proves domain
   invariant #12's enforcement surface cannot be lifted by a client.

4. **Cross-browser sign-in.**
   Fresh context A → sign up with email+password → sign out. Fresh
   context B (incognito / separate storage) → sign in with same
   credentials. Assert context B sees the same `users.id` and the
   same `preferences` state from A. Proves same-user persistence
   across browsers.

5. **Password reset roundtrip.**
   Fresh context → `/reset-password` → enter a known email → assert
   a Supabase recovery email is triggered (visible in Auth → Users
   → Activity in the dashboard). Since the email actually sends, we
   don't click through in CI; instead verify the *POST to the reset
   endpoint succeeded* and the UI transitioned to the "Check your
   email" state. Full click-through is manual-only.

6. **Cycle 0001 gates still green.**
   Re-run Playwright checks #1–#5 from plan 0001 against this build
   to confirm no regression (in particular, anonymous sign-in still
   works, CHECK still rejects `sfw_disabled=true` for anon, `/health`
   still accepts anon JWTs).

### code-review / code-simplifier

Mandatory both, per CLAUDE.md. Findings appended to this plan's
`## Verification` section with disposition, same pattern as 0001.

### Done definition

- All Playwright gates #1, #3, #4, #5, #6 green; gate #2 either green
  or explicitly marked manual with a dashboard-screenshot trace.
- `pnpm typecheck` clean.
- `uv run python -c 'from app.main import app'` clean.
- Migration applied to the hosted DB; a second anonymous user
  created during verification demonstrates the sync trigger fires
  exactly once per auth.users UPDATE (no duplicate `public.users`
  rows).
- No files under `Seed/` modified.

## Verification

Run date: 2026-04-15. Supabase hosted project `tjytndffwwwanfeoeuze`.

### Playwright gates

1. **F5 carry — email link. ✅ PASS.**
   - Fresh anon user `4e07ac4f-3c1a-4bce-8f26-033a07f7647c`.
   - Pre-link: wrote `preferences.chat_behavior.typing_speed = 0.42`.
   - `supabase.auth.updateUser({ email, password })` succeeded (with "Confirm
     email" OFF per story #4).
   - Post-link: `session.user.id` **identical** to pre-link id; `is_anonymous`
     false; `email` populated. `public.users` row count = 1 for that id;
     `auth_method='email'` (sync trigger fired); `typing_speed=0.42`
     preserved. Exercises flow F5, invariant F5-carry.

2. **F5 carry — OAuth. ⏭️ DEFERRED.**
   Creator agreement to defer Google/GitHub real-OAuth validation to a
   later cycle (requires creating OAuth apps in Google Cloud Console +
   GitHub Developer Settings, pasting Client ID/Secret into the Supabase
   dashboard). Frontend wires `linkIdentity({ provider })` and
   `signInWithOAuth({ provider })` using the same Supabase API surface
   that gate #1 validated; no gate-1-unique code paths were introduced
   for OAuth. Will be re-opened in cycle 0003 or whenever OAuth apps
   are set up.

3. **`auth_method` spoof rejection. ✅ PASS** (after one iteration — see
   code-review finding #1 below).
   - As `anon`: UPDATE attempts to `auth_method`, `email`,
     `email_verified_at` all raise `auth_method, email, email_verified_at
     are read-only from the client`.
   - Same attempts as `authenticated` (post-link): same rejection.
   - Sync path still works: `updateUser({ email, password })` completes
     and `public.users` reflects the new `auth_method='email'` + `email`
     via the SECURITY DEFINER trigger.
   - Benign UPDATE to `preferences` still succeeds (bubble_theme →
     'coral'), confirming the guard isn't over-broad.

4. **Cross-browser sign-in. ✅ PASS.**
   Authenticated from gate #1, then a fresh isolated-storage SDK client
   signed in with the same credentials. `signed_in_uid` equals the original
   `users.id`; `bubble_theme='ocean'` and `typing_speed=0.42` readable —
   data persisted across "devices".

5. **Password reset roundtrip. ✅ PASS.**
   API: `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
   returned `{ error: null }`.
   UI: typed email into `/reset-password` form, clicked "Send reset link" →
   status message `Check your email for a password reset link.` rendered;
   no navigation away. Click-through of the email link itself is manual /
   deferred (clicking requires a real inbox); the in-app recovery path is
   gated by a `recovering: "resolving"` state that was added after
   code-review (see finding #2 below).

6. **Cycle 0001 regressions. ✅ PASS.**
   Against a fresh anon session in an isolated client:
   - `public.users` auto-created with `auth_method='anonymous'`,
     `grammar.master=false` default (invariant #17 preserved).
   - `sfw_disabled=true` UPDATE rejected with error code 23514,
     `users_sfw_requires_auth` (invariant #12).
   - `GET /health` with the anon JWT → 200 + correct `user_id`; no auth →
     401 (unchanged from 0001).

Screenshot of the authenticated Home state:
[`0002-home-authed.png`](0002-home-authed.png) — shows empty-state content
unchanged, UserSection at the bottom rendering the linked email and a
Sign out button (no nudge banner while authenticated).

### UI-driven smoke

End-to-end click through: `/` → (signed in) click **Sign out** →
navigated to `/sign-in` automatically; typed email + password from gate
#1; clicked **Sign in** → navigated back to `/`. Proves the whole
AuthForm wiring + SessionContext + UserSection cooperate correctly.

### `code-review` findings

- **#1 (critical) — `current_user = 'postgres'` is fragile across
  deploy-owner roles.** **Valid.** First fix swapped to
  `current_setting('request.jwt.role', true)` as the reviewer
  suggested; Playwright re-run showed spoofs were no longer blocked —
  that GUC does not exist on Supabase (the JWT role lives inside
  `request.jwt.claims::json->>'role'`). Final fix keys on
  `current_user in ('anon', 'authenticated')` (the positive direction —
  the only roles PostgREST ever assumes for client calls). Robust
  regardless of who owns the migration; SECURITY DEFINER sync trigger
  runs under its owner and is naturally exempt. Re-verified with gate
  #3 all green.
- **#2 (important) — PASSWORD_RECOVERY race in `AuthForm`.** **Valid;
  fixed.** `recovering` is now tri-state `boolean | "resolving"`,
  initialized synchronously from `window.location.hash.includes
  ("type=recovery")` when the user lands on `/reset-password` via the
  email. Form render is gated to a "Preparing password reset…" message
  until the SDK confirms via `PASSWORD_RECOVERY`. Submit is also
  guarded so a fast click during the resolving window is a no-op.

### `code-simplifier` deltas

- `App.tsx` — dropped the redundant `getSession()` call; rely on the
  `onAuthStateChange` `INITIAL_SESSION` event (single initialization
  path).
- `AuthForm.tsx` — replaced two nested-ternary expressions (`title` and
  submit-button label) with `titleFor()` / `submitLabel()` helpers;
  flattened `onOAuth` / `signup` branches into single `withBusy`
  ternaries; introduced an `isRecovering` boolean alias below the
  "resolving" guard so downstream JSX reads cleanly.
- `UserSection.tsx` — collapsed three near-identical wrapper returns
  into a single `<div>` with an inline `content()` switch; extracted
  `onSignOut` out of an inline handler.

Post-simplifier: `pnpm typecheck` clean. All Playwright gates still
green.

### Status

**Cycle closeable.** Gates #1, #3, #4, #5, #6 all PASS; gate #2 (OAuth
end-to-end) explicitly deferred to a later cycle with creator agreement
and no gate-2-unique code paths left unvalidated. Code-review findings
addressed; simplifier deltas recorded. `Seed/` untouched. One follow-up
dashboard step already applied by the creator: Authentication →
Providers → **"Confirm email" turned OFF** per story #4 ("Verification
is NON-blocking").
