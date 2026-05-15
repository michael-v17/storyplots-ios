---
id: 0003
slug: user-persona
status: approved
created: 2026-04-15
---

# Cycle 0003 — UserPersona entity + `/profile` editor

## Context

Cycles 0001 and 0002 shipped the auth substrate: `public.users`,
RLS, anonymous sign-in, sign-up/sign-in/link/reset. This cycle adds
the **UserPersona** — the user's self-representation inside roleplay.
PersonaLLM calls this "Your Persona" / "About You"; the v0 seed keeps
it essentially unchanged from the observed app.

Scope is a single table (`user_personas`) plus one route (`/profile`),
plus a small sidebar update so the user can reach the editor. Still
deferred: Characters, Conversations, prompt assembly (position 4
consumer), Grammar, BYOK, the image provider needed for "Generate
photo".

**Done when:** from a fresh authenticated session, the user can visit
`/profile`, upload a photo, fill name + gender + appearance +
background, save, and see the sidebar user-section update to show
the persona's avatar + name; anonymous sessions can also edit a
persona (per RLS invariant #11); attempting to create a second row
per user is rejected by the DB.

## Shape of the change

```
┌────────────── public.user_personas ───────────────┐
│  id uuid PK                                        │
│  user_id uuid → users.id (unique, cascade)         │
│  photo_ref text   (Supabase Storage path)          │
│  name text NOT NULL                                │
│  gender text   (free-text; widened per seed)       │
│  appearance jsonb   ({ skin, eyes, hair, extras }) │
│  background_story text                             │
│  is_default bool NOT NULL default true             │
│  created_at / updated_at                           │
│  RLS: user_id = auth.uid()                         │
└────────────────────────────────────────────────────┘
                  ▲                         ▲
                  │                         │
/profile screen ──┘             sidebar UserSection
  Empty / Editing / Saving / Error           │
  - Photo upload → Storage bucket `avatars/{user_id}/…`
  - Name, Gender, Appearance(4), Background
  - Save / Clear persona / Cancel

Supabase Storage:
  bucket 'avatars'   (private, per-user path prefix via RLS)
```

## 1. Seed sections satisfied

- [user-stories.md §5.11 story #52](../Seed/user-stories.md)
  *Create or edit my UserPersona · High · [Observed]* — all 5 ACs.
  The "UserPersona is never sent to the Grammar Agent" AC is trivially
  preserved this cycle (no Grammar Agent exists yet); the invariant
  lands for real when the Grammar cycle ships.
- [creator-vision.md §2](../Seed/creator-vision.md) *Core Hierarchy* —
  `User → UserPersona (0..1, optional)`.
- [creator-vision.md §4](../Seed/creator-vision.md) *Navigation* — the
  sidebar user section (avatar + display name) opens the UserPersona
  editor. Wired in this cycle.
- [creator-vision.md §5.4](../Seed/creator-vision.md) *User Profile /
  UserPersona (/profile) — Unchanged from PersonaLLM.*
- [creator-vision.md §7](../Seed/creator-vision.md) *Conversation
  Agent* — reserves UserPersona at prompt position 4. No consumer
  shipped this cycle; the fields are stored in a shape the future
  consumer can read directly.
- [domain.md §2.2](../Seed/domain.md) *UserPersona* — entity
  definition, invariants, lifecycle. 0..1 per User.
- [schema.md §2.2 `user_personas`](../Seed/schema.md) — column set
  replicated verbatim (see §5 below), with `(user_id)` unique, RLS,
  cascade-with-user.
- [schema.md §2.19](../Seed/schema.md) — `avatars` Storage bucket
  named; this cycle creates it with per-user RLS.
- [schema.md §5 items #1 #2](../Seed/schema.md) — per-user RLS on
  every user-scoped table; anonymous users get identical RLS.
- [ux.md §1 sitemap](../Seed/ux.md) — adds `/profile`. (`/settings`
  and other routes remain out of scope — they land in later cycles.)
- [ux.md §2 navigation model](../Seed/ux.md) — sidebar user section
  tap opens the editor.
- [ux.md §4.7 `/profile`](../Seed/ux.md) — full contract: photo,
  name, gender, appearance (skin/eyes/hair/extras), background
  story; Save + Upload photo + Generate photo (primary); Clear
  persona + Cancel (secondary); required states empty/editing/
  saving/error.

## 2. PersonaLLM-Reference provenance

Principle 5 (observed vs. extended separation):

- [PersonaLLM-Reference/04-screens/user-profile.md](../Seed/PersonaLLM-Reference/04-screens/user-profile.md)
  — observed STATUS / IDENTITY / APPEARANCE / ABOUT YOU sections.
  **Replicated**: the field set and section groupings.
  **Explicit extensions this cycle ships**:
  - `gender` as **free-text input** (seed widens beyond observed
    Male/Female — see User Extensions in that file, and
    open-questions.md §4.2).
  - `appearance` as **structured JSON** `{ skin, eyes, hair,
    extras }` (per domain.md §2.2 / schema.md §2.2). PersonaLLM
    showed a single "Description" text; the seed formalizes it into
    four sub-fields.
- [PersonaLLM-Reference/03-data-model.md](../Seed/PersonaLLM-Reference/03-data-model.md)
  — observed UserPersona shape; seed column names preserve
  one-to-one.
- [PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md](../Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md)
  — position 4 in roleplay & assistant scaffolds reads UserPersona.
  **Not consumed this cycle** — fields are reserved for the future
  Conversation Agent.

## 3. User stories touched

- **#52 Create or edit my UserPersona · High** — all 5 ACs, with one
  caveat: "UserPersona is injected into the Conversation Agent's
  prompt at the configured position" is not *shipped* this cycle
  (no agent exists yet); it is *unblocked* — the fields are in the
  schema in the exact shape position 4 expects.
- **Related stories untouched:**
  - #16 (Conversation Agent) — references UserPersona; lands when
    the Agent lands.
  - #49 (TTS) — references UserPersona.gender; lands with TTS.

## 4. Domain invariants preserved

From [domain.md §6](../Seed/domain.md):

- **#1 Per-user RLS on every user-scoped table.** `user_personas`
  gets RLS `using (user_id = auth.uid())`.
- **#11 Anonymous RLS identical to authenticated.** No branch on
  `auth_method`.
- **#15 No cross-user DB reads.** Declarative via RLS; Playwright
  verifies.
- **UserPersona is never sent to the Grammar Agent** (domain.md §2.2,
  §6 #2). Trivially preserved — no Grammar Agent exists.
- **0..1 UserPersona per User.** `UNIQUE (user_id)` on
  `user_personas`. Playwright verifies the second insert is rejected.

## 5. Schema scope / RLS

### New migration `supabase/migrations/0003_user_personas.sql`

```sql
create table public.user_personas (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique
                      references public.users(id) on delete cascade,
  photo_ref           text,
  name                text not null,
  gender              text,
  appearance          jsonb,
  background_story    text,
  is_default          boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.user_personas enable row level security;

create policy user_personas_select_own on public.user_personas
  for select using (user_id = auth.uid());
create policy user_personas_insert_own on public.user_personas
  for insert with check (user_id = auth.uid());
create policy user_personas_update_own on public.user_personas
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());
create policy user_personas_delete_own on public.user_personas
  for delete using (user_id = auth.uid());

-- updated_at touch on every update.
create trigger user_personas_touch_updated_at
  before update on public.user_personas
  for each row execute function public.touch_updated_at();
```

### Shared trigger helper (also in 0003_user_personas.sql, emitted once)

```sql
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
```

Defined here (not 0001) because this is the first table that needs
it. Future tables reuse the function; domain.md §6 doesn't govern
this — it's a mechanical helper.

### Storage bucket + policies

```sql
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- Per-user prefix: objects at path '{auth.uid()}/...'
create policy avatars_read_own on storage.objects
  for select using (bucket_id = 'avatars'
                    and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_insert_own on storage.objects
  for insert with check (bucket_id = 'avatars'
                         and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_update_own on storage.objects
  for update using (bucket_id = 'avatars'
                    and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_delete_own on storage.objects
  for delete using (bucket_id = 'avatars'
                    and (storage.foldername(name))[1] = auth.uid()::text);
```

Frontend uploads to path `{user.id}/persona-{timestamp}.{ext}` and
stores that key in `user_personas.photo_ref`.

## 6. UX surfaces

From [ux.md §4.7](../Seed/ux.md):

### `/profile` — new route

- **Must-have sections** (non-omission):
  - Photo: current avatar + Upload button. Generate button rendered
    but **disabled** with a tooltip "Configure an image provider in
    Settings" — the gate condition is always true for now because
    BYOK hasn't landed.
  - Name (text input, required).
  - Gender — **dropdown with finite options**: `Male`, `Female`,
    `Non-binary`, `Prefer not to say`. Creator decision this cycle
    (widened from PersonaLLM's observed Male/Female per User
    Extensions, committed as a 4-option set). DB column stays
    `text` per schema.md §2.2, so the set can grow or migrate to
    an enum later without a breaking change.
  - Appearance — four sub-inputs: skin, eyes, hair, extras.
  - Background story (multiline).
- **Primary actions:** Save; Upload photo; ~~Generate photo~~
  (button visible, disabled with tooltip).
- **Secondary actions:** Clear persona (deletes the row after
  confirm); Cancel (navigates back to `/`).
- **Required states:**
  - Loading — initial fetch of existing persona (if any).
  - Empty — no persona yet; form shows the same fields, pre-populated
    with placeholder copy from PersonaLLM ("What should characters
    call you?" on Name).
  - Editing — form is dirty; Save is enabled.
  - Saving — Save button shows pending; all inputs disabled.
  - Error — a form-level error message renders above Save.

### Sidebar `UserSection` update

Extend the existing `UserSection` component (cycle 0002):

- Anonymous: unchanged — "Sign up to access from anywhere" CTA.
- Authenticated + no persona: email (muted) + Sign out + a small
  "Set up your persona" link → `/profile`.
- Authenticated + persona: render persona avatar (24px) + persona
  `name`, which is itself a link to `/profile`; Sign out button
  stays.

This is a surgical addition — the sidebar shell beyond this slot
stays the skeleton from 0001/0002.

### Home nudge, /sign-in, /sign-up, /reset-password

Untouched this cycle. Home still renders the empty-state shell.

## 7. Open questions

- **`gender` enum** (open-questions.md §4.2 / schema.md §9) — creator
  committed for this cycle to a finite 4-option UI set: `Male`,
  `Female`, `Non-binary`, `Prefer not to say`. The DB column stays
  `text` per schema.md §2.2 — the seed's open question about
  migrating to a Postgres enum is NOT resolved by this cycle; it
  stays open for a later decision. Widening the set later is
  additive (the DB accepts any string), so the commitment is
  cheap to revise. No new open-questions entry; no seed
  modification needed.
- **Smart-default fill at read time** (ux.md §4.7 "Interactions:
  gender-appropriate smart defaults fill blank fields at read
  time") — this is a **prompt-assembly concern**, not a UI one. The
  editor saves whatever the user typed; the eventual prompt-assembly
  cycle substitutes defaults when reading UserPersona into position
  4. Nothing here to decide.
- **Persona switcher per-Conversation** (PersonaLLM-Reference
  user-profile.md open question) — deferred. v0 is 0..1 UserPersona;
  per-Conversation override lives on `conversations.persona_id`
  (schema.md §2.4), which doesn't exist yet.

No items touched in [open-questions.md](../Seed/open-questions.md)
§1 needing new entries.

## 8. Implementation order

1. **Migration `0003_user_personas.sql`.** Write + apply via Supabase
   SQL Editor. Smoke: insert a row via PostgREST as an anon user;
   confirm RLS lets them read their own; try a second insert → 23505
   unique violation on `user_id`.
2. **Create avatars bucket + storage policies.** Included in the
   same migration file.
3. **Frontend: `lib/persona.ts`.** Tiny helper that wraps
   `supabase.from('user_personas')` reads/writes and the storage
   upload. Keeps the component free of API plumbing.
4. **`/profile` route + `ProfileForm` component.** Implement all
   required states per §6 above. Mount the route in `App.tsx`.
5. **Update `UserSection`.** Hook in the `lib/persona.ts` read so
   the sidebar shows avatar + name when a persona exists; renders
   the "Set up your persona" fallback otherwise.
6. **Playwright verification (§9).**
7. **`code-review` + `code-simplifier` passes.**

No new frontend or backend dependencies. No backend changes beyond
the migration.

## 9. Verification

### Playwright gates

1. **Empty state.** Authenticated session with no persona →
   navigate to `/profile`. Assert: form renders with empty fields;
   Save is disabled until name is non-empty; Loading → Empty
   transitions happen in the right order.
2. **Create + RLS.** Fill name, gender, appearance, background;
   click Save. Assert: exactly one `user_personas` row exists for
   this user; `is_default=true`; `updated_at > created_at` is false
   on the fresh row (trigger has not fired yet); sidebar
   `UserSection` now shows the persona's name (no avatar yet).
3. **Update + `updated_at` trigger.** Change the background; click
   Save. Assert: `updated_at > created_at`.
4. **Photo upload.** Upload a small PNG. Assert: file lands at
   `avatars/{user_id}/persona-*.png`; `photo_ref` is the same key;
   the `<img>` on the page renders (signed URL resolved); a second
   user cannot read the first user's object (Playwright's second
   isolated client tries `storage.from('avatars').download(path)`
   and expects an RLS-denied error).
5. **0..1 cardinality.** Via SDK, attempt a second
   `insert({ user_id: <same uid>, name: 'dup' })`. Assert: error
   code `23505` on `user_personas_user_id_key`.
6. **Clear persona.** Click Clear, confirm. Assert:
   `user_personas` row count for this user = 0; sidebar falls back
   to "Set up your persona"; `avatars/{user_id}/*` is deleted
   (or scheduled for deletion — deletion is best-effort client-side
   this cycle; if we can't guarantee it, document the decision).
7. **Anonymous persona (invariant #11).** Fresh anon session →
   `/profile` → create persona → assert row exists; RLS lets only
   this anon read/write it. Same UX as an authenticated user.
8. **Regressions.** Re-run the relevant cycle 0001/0002 gates:
   anon sign-in still works; `/sign-up` link path still preserves
   data (now including the persona row if one exists); backend
   `/health` still accepts both roles.

### Done definition

- All Playwright gates 1–8 green (gate #6 may record a known-issue
  for the storage cleanup if it's racy).
- `pnpm typecheck` clean.
- `uv run python -c 'from app.main import app'` still clean.
- `code-review` and `code-simplifier` passes completed; findings
  either fixed or explicitly recorded in the plan's Verification
  section.
- Migration committed; no manual ALTER required on the hosted DB.
- No files under `Seed/` modified.

## Verification

Run date: 2026-04-15. Supabase hosted project `tjytndffwwwanfeoeuze`.
Migration 0003 applied via SQL Editor (Success, no rows returned).

### Playwright gates

1. **Empty state. ✅ PASS.** `/profile` for an authed user with no
   persona renders: h1 "Set up your persona"; Upload photo label;
   Generate photo button **disabled with tooltip** "Configure an
   image provider in Settings"; Name with placeholder "What should
   characters call you?"; Gender `<select>` with 5 options (—,
   Male, Female, Non-binary, Prefer not to say) and "—" selected;
   Appearance fieldset with skin/eyes/hair/extras; Background
   textarea; Save button **disabled** until Name has text; Cancel
   link → `/`. No Clear button (persona is null).
2. **Create + RLS. ✅ PASS.** Filled name=Alex Kim, gender=Non-binary,
   all 4 appearance fields, background. Clicked Save. `public.user_personas`
   row count for this user = 1; appearance stored as structured JSON
   `{ skin, eyes, hair, extras }`; `is_default=true`;
   `created_at === updated_at` on the fresh row.
3. **Update + `updated_at` trigger. ✅ PASS.** Updated background,
   saved. `updated_at` advanced ~21s past `created_at` — the
   `user_personas_touch_updated_at` trigger fired.
4. **Photo upload + cross-user RLS. ✅ PASS.**
   - Uploaded a 1×1 PNG. File landed at
     `avatars/{user_id}/persona-1776281823627.png`; `photo_ref`
     matches; signed URL resolved.
   - Isolated anonymous client called
     `storage.from('avatars').download(<path>)` → error "Object
     not found" (the correct RLS denial — 404 rather than 403 to
     avoid leaking existence). Proves per-user prefix policy works.
5. **0..1 cardinality. ✅ PASS.** Second insert for the same
   `user_id` rejected with error code `23505` on
   `user_personas_user_id_key` (the UNIQUE constraint from the
   migration).
6. **Clear persona. ✅ PASS.** Clicked Clear → `confirm()` stubbed
   to accept →
   - DB: 0 rows for this `user_id`;
   - Storage: `storage.from('avatars').list('{uid}/')` returns
     empty — the storage object was removed in
     `lib/persona.ts:clearPersona` before the DB delete;
   - UI: heading back to "Set up your persona"; Clear button
     disappears.
7. **Anonymous persona (invariant #11). ✅ PASS.** Fresh anon
   client inserted a persona with `user_id = auth.uid()` and read
   it back under RLS; no branching on `auth_method` anywhere in
   the policy. Identical UX path to authenticated.
8. **Regressions 0001/0002. ✅ PASS.**
   - 0001 CHECK on `sfw_disabled` for anon — still rejects with
     `23514` (`users_sfw_requires_auth`).
   - 0002 auth-shadow guard — `auth_method` UPDATE still rejected
     with "read-only from the client".
   - 0002 F5 link flow — preserves `users.id` and `user_email`.
   - **New F5-equivalent observation for this cycle:** a
     `user_personas` row created as anonymous **survives the
     anon→auth link** unchanged (same row id, same `user_id`,
     same name). Confirms flow F5 extends naturally to this new
     table via `on delete cascade` + `user_id = auth.uid()` RLS.
9. **Sidebar surface. ✅ PASS.** After Save on /profile, `/` shows
   the `UserSection` with a 24×24 `<img>` (signed URL) +
   "Alex Kim" as a link to `/profile`. After Clear, the sidebar
   falls back to email + "Set up your persona" link. (Snapshot
   didn't render the `alt=""` img label; confirmed via
   `document.querySelector` that the img element is present and
   `complete=true`.)

Screenshot of the authenticated Home with populated sidebar:
[`0003-home-with-persona.png`](0003-home-with-persona.png).

### `code-review` findings

Three findings; one dropped at threshold, two fixed:

- **#1 (important) — stale signed URL after 1h in sidebar.**
  **Valid; fixed.** Bumped `avatarUrl` TTL to 7 days
  (`AVATAR_URL_TTL_SECONDS = 60*60*24*7`) since the avatar is a
  low-sensitivity image at an already-unguessable path. No
  re-fetch logic needed within a single session.
- **#2 (important) — `uploadAvatar` orphans old objects.**
  **Valid; fixed.** `uploadAvatar` now takes a `previous:
  string | null` parameter and removes the prior object
  best-effort after the new upload succeeds. `Profile.tsx onUpload`
  passes `draft.photo_ref` so iterative re-uploads don't leak.
- **#3 (borderline) — `is_default` not explicitly set by the
  client.** **Dropped by reviewer at threshold.** DB default
  (`true`) correctly applies on every insert; v0 is 0..1, so
  there is no scenario that needs to set it `false`. If the
  cardinality relaxes, this returns as a real concern.

### `code-simplifier` deltas

- `lib/persona.ts:40` — removed redundant `?? null`;
  `maybeSingle()` already returns null on miss.
- `lib/persona.ts:62` — replaced ternary with `||` fallback for
  the file extension default.
- `Profile.tsx` — extracted a `fail(err)` helper, collapsing three
  identical `setError(String(err)); setStatus("error")` pairs
  into one-liners in `onUpload` / `onSave` / `onClear`.

Post-simplifier: `pnpm typecheck` clean. All Playwright gates
still green.

### Status

**Cycle closeable.** 9 Playwright checks PASS (8 planned + 1
bonus sidebar surface). Two `code-review` findings fixed, one
dropped at threshold. Simplifier deltas recorded. `Seed/`
untouched. No backend changes. Migration already applied to the
hosted DB in-session; no post-cycle dashboard action required.
