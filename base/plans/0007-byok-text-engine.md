---
id: 0007
slug: byok-text-engine
status: approved
created: 2026-04-15
---

# Cycle 0007 — BYOK text-engine settings

## Context

The Conversation Agent and streaming land in cycle 0008. Before that
can call an LLM, the user needs a place to save their own API key —
BYOK is non-negotiable per
[creator-vision.md §6, §7](../Seed/creator-vision.md) and
[product.md §9](../Seed/product.md). This cycle ships the storage
layer and the Settings → Text Engine screen. **No LLM calls, no
Test-Connection, no streaming, no model-list refresh** — those all
live next to the agent in cycle 0008.

In parallel, this cycle resolves the **`byok_keys` encryption
envelope** open question in
[Seed/open-questions.md §2.3](../Seed/open-questions.md) by
committing to **Supabase Vault** (one `vault.secrets` row per
`provider_configs` row, referenced by `vault_secret_id`). The
append-only §2.3 resolution will be added by this cycle.

**Done when:** from an authenticated or anonymous session, the user
can visit `/settings/text-engine`, pick a provider family, enter
a key, save, and have it land encrypted via Vault. The Composer in
ChatShell becomes **gated on an active text provider**: no key →
disabled textarea + inline CTA to `/settings/text-engine`; key
present → enabled (same UX as cycle 0006 today). Deleting the
provider removes both the row and the underlying Vault secret.

## Shape of the change

```
Tables:
 public.provider_configs           schema.md §2.17 verbatim, +
                                   vault_secret_id uuid (opaque
                                   pointer into vault.secrets).

Functions (SECURITY DEFINER, authenticated-only):
 public.upsert_text_provider(...)  rotates the vault secret,
                                   deactivates the prior active
                                   row, inserts the new one as
                                   is_active=true.
 public.delete_text_provider(id)   deletes the row + its Vault
                                   secret.

Frontend:
 /settings                         index page with a single
                                   "Text Engine" entry (other
                                   kinds disabled with tooltip).
 /settings/text-engine             full form — provider picker,
                                   base url, API key (masked),
                                   model id (text), temperature,
                                   max_tokens, context_length,
                                   thinking mode. Cloud AI
                                   Consent inline on first save.
 lib/providers.ts                  thin wrapper over the two RPCs
                                   + a listActiveTextProvider().
 ChatShell                         composer now gates on the
                                   active text provider being
                                   present (ux.md §4.6 "BYOK
                                   missing" state).
```

## 1. Seed sections satisfied

- [user-stories.md §5.9 story #39](../Seed/user-stories.md)
  *Configure my BYOK provider keys · Critical · [Observed +
  Extension]* — Settings → Text Engine accepts an OpenRouter key;
  Cloud AI Consent inline on first entry; keys encrypted +
  RLS-isolated; Text Engine is also where the Conversation Agent
  model is selected (selector shipped; consumer is next cycle).
  Local-network providers configurable. No Test Connection AC
  this cycle (deferred to 0008).
- [creator-vision.md §6](../Seed/creator-vision.md) — "Cloud AI
  Consent — inline in Settings when the user first enters an API
  key, not a blocking onboarding screen."
- [creator-vision.md §7 BYOK](../Seed/creator-vision.md) — "Keys
  stored encrypted server-side in `User.byok_keys` (Supabase
  Postgres + RLS)." Discipline 2 — prompts vendor-agnostic; the
  form shape stays generic (no provider-specific field).
- [creator-vision.md §5.7](../Seed/creator-vision.md) — Text
  Engine hosts the Conversation Agent model selector.
- [product.md §9](../Seed/product.md) — "**BYOK-only.** No shared
  server-side keys, no centralized billing."
- [product.md §7 principle 5](../Seed/product.md) — "BYOK keys
  stored encrypted."
- [domain.md §2.17 ProviderConfig](../Seed/domain.md) — entity
  definition, `is_active` uniqueness per `(user_id, kind)`.
- [domain.md §6 invariant #18](../Seed/domain.md) — "Exactly one
  `ProviderConfig` is `is_active = true` per `kind` per User at
  any time." Enforced via partial unique index **and** the upsert
  function's transactional deactivate-then-insert.
- [schema.md §2.17 provider_configs](../Seed/schema.md) — full
  column list, reproduced below with one addition
  (`vault_secret_id`).
- [schema.md §5 rule #8](../Seed/schema.md) — "**Exactly one
  `provider_configs` row has `is_active = true` per `(user_id,
  kind)`.** Partial unique index." Shipped literally.
- [ux.md §1 sitemap](../Seed/ux.md) — `/settings`,
  `/settings/text-engine` added.
- [ux.md §4.10.6](../Seed/ux.md) — Text Engine screen contract.
  Shipped minus Test Connection + model refresh (deferred to 0008).
- [ux.md §5 modal registry](../Seed/ux.md) — "Inline Cloud AI
  Consent" — shipped as an inline notice on first save, not a
  blocking overlay.
- [ux.md §6 / §9](../Seed/ux.md) — "BYOK absent — composer
  disabled; inline CTA" — the Composer from cycle 0006 now
  enters this state when no active text provider exists.
- [architecture.md §3, §6.1](../Seed/architecture.md) —
  encryption on save happens with a server-owned key (here,
  Supabase Vault's managed key); decryption happens server-side
  only. Plaintext is never written back to the client in this
  cycle (cycle 0008's agent path will fetch it server-side via
  FastAPI + another SECURITY DEFINER RPC).

## 2. PersonaLLM-Reference provenance

- [04-screens/settings/text-engine.md](../Seed/PersonaLLM-Reference/04-screens/settings/text-engine.md)
  — replicated Custom-tab field inventory: Base URL, API Key
  (masked + reveal), Model, Thinking Mode, Temperature,
  Max Tokens, Context Length. **Dropped this cycle** (deferred
  with visible placeholder / disabled-with-tooltip):
  - Test Connection button — disabled with tooltip "Test Connection
    lands with the Conversation Agent in the next cycle".
  - Model refresh / fetch-models button — same treatment; free-text
    model id for now.
  - Advanced collapsible (top-p / top-k / freq/pres penalty / stop
    sequences) — PersonaLLM didn't surface these; the seed's
    "expand under an Advanced section" direction is a power-user
    add that we explicitly defer to a later cycle. Non-omission
    acknowledged.
- [PersonaLLM-Reference/08-generation-parameters.md](../Seed/PersonaLLM-Reference/08-generation-parameters.md)
  — defaults committed verbatim: Temperature 0.7, Max Tokens
  8192, Context Length 32768, Thinking Mode OFF.
- Provider picker (schema.md §2.17 `provider_family` enumeration):
  OpenRouter (primary/default), OpenAI, Google, Ollama, LM Studio,
  KoboldCpp, llama.cpp, Text Gen WebUI, vLLM, xAI, Atlas Cloud,
  Alibaba Cloud. (Image-only families — ComfyUI — aren't in the
  Text Engine picker; they land in `/settings/image-engine`.)

## 3. User stories touched

- **#39 Configure BYOK · Critical** — all ACs except Test
  Connection. Specifically satisfied:
  - Settings → Text Engine accepts OpenRouter (and other cloud
    + local providers) via a common form.
  - Inline Cloud AI Consent on first cloud-provider save.
  - Keys stored encrypted via Vault; RLS isolates `provider_configs`
    rows per user.
  - Text Engine surface is where the Conversation Agent model is
    picked — the field writes `provider_configs.model_id`, which
    cycle 0008's agent will read.
- **Partial #42 Grammar model picker · High** — **not** satisfied
  this cycle. Grammar shares the Text Engine provider per
  [open-questions.md §5.1](../Seed/open-questions.md); the model
  picker for Grammar lives in `/settings/grammar` and ships with
  the Grammar cycle.

## 4. Domain invariants preserved

From [domain.md §6](../Seed/domain.md):

- **#1 Per-user RLS** — `provider_configs.user_id = auth.uid()`
  on all 4 policies.
- **#11 Anonymous RLS identical** — anon users can also save a key.
  (Whether anon users *should* save keys is a UX choice;
  functionally, allowing it is consistent with the "anon gets
  identical RLS" invariant.)
- **#15 No cross-user reads** — enforced by RLS + by Vault access
  being gated by the SECURITY DEFINER RPCs (which check
  `auth.uid()` matches the row's `user_id`).
- **#18 Exactly one `is_active=true` per (user_id, kind)** —
  enforced by partial unique index **and** by the upsert function
  deactivating the previous active row inside the same statement.

New decisions this cycle:

- **BYOK encryption envelope is Supabase Vault, one secret per
  `provider_configs` row.** Appended to
  [Seed/open-questions.md §2.3](../Seed/open-questions.md). The
  reference text in text-engine.md that hinted at "envelope
  encryption per user data-key" is satisfied by Vault — each
  secret is independently encrypted; Vault's managed key is the
  server-owned KEK.

## 5. Schema scope / RLS

### New migration `supabase/migrations/0007_provider_configs.sql`

```sql
create type public.provider_kind as enum ('text', 'image', 'video', 'tts', 'stt');

create table public.provider_configs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  kind              public.provider_kind not null,
  provider_family   text not null,
  base_url          text,
  vault_secret_id   uuid,                        -- points into vault.secrets
  api_key_encrypted bytea,                       -- schema.md §2.17 preserved (unused when vault_secret_id set)
  model_id          text,
  temperature       numeric,
  max_tokens        integer,
  context_length    integer,
  thinking_mode     boolean not null default false,
  workflow_config   jsonb,
  last_tested_ok    boolean,
  last_tested_at    timestamptz,
  is_active         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index provider_configs_one_active_per_kind
  on public.provider_configs (user_id, kind) where is_active;

alter table public.provider_configs enable row level security;

create policy provider_configs_select_own on public.provider_configs
  for select using (user_id = auth.uid());
create policy provider_configs_insert_own on public.provider_configs
  for insert with check (user_id = auth.uid());
create policy provider_configs_update_own on public.provider_configs
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());
create policy provider_configs_delete_own on public.provider_configs
  for delete using (user_id = auth.uid());

create trigger provider_configs_touch_updated_at
  before update on public.provider_configs
  for each row execute function public.touch_updated_at();

-- Upsert the active text provider. Rotates the Vault secret (drops
-- old, inserts new) so a previously-stored key is never left dangling.
create or replace function public.upsert_text_provider(
  p_provider_family   text,
  p_base_url          text,
  p_api_key           text,
  p_model_id          text,
  p_temperature       numeric,
  p_max_tokens        integer,
  p_context_length    integer,
  p_thinking_mode     boolean
) returns public.provider_configs
language plpgsql
security definer
set search_path = public
as $$
declare
  uid           uuid := auth.uid();
  new_secret_id uuid;
  old_row       public.provider_configs;
  result        public.provider_configs;
begin
  if uid is null then raise exception 'auth required'; end if;

  -- Drop the secret from any previous active text provider.
  for old_row in
    select * from public.provider_configs
    where user_id = uid and kind = 'text' and is_active
  loop
    if old_row.vault_secret_id is not null then
      delete from vault.secrets where id = old_row.vault_secret_id;
    end if;
  end loop;

  update public.provider_configs
    set is_active = false
    where user_id = uid and kind = 'text' and is_active;

  if p_api_key is not null and btrim(p_api_key) <> '' then
    new_secret_id := vault.create_secret(
      p_api_key,
      format('byok_text_%s_%s', uid, extract(epoch from now())::bigint),
      'BYOK text-provider key (StoryPlots v0)'
    );
  end if;

  insert into public.provider_configs
    (user_id, kind, provider_family, base_url, vault_secret_id,
     model_id, temperature, max_tokens, context_length, thinking_mode,
     is_active)
  values
    (uid, 'text', p_provider_family, p_base_url, new_secret_id,
     p_model_id, p_temperature, p_max_tokens, p_context_length, p_thinking_mode,
     true)
  returning * into result;

  return result;
end;
$$;

grant execute on function public.upsert_text_provider(
  text, text, text, text, numeric, integer, integer, boolean
) to authenticated, anon;

-- Delete a provider row and its Vault secret atomically.
create or replace function public.delete_provider(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.provider_configs;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select * into row from public.provider_configs where id = p_id;
  if row is null or row.user_id <> auth.uid() then
    raise exception 'not found';
  end if;
  if row.vault_secret_id is not null then
    delete from vault.secrets where id = row.vault_secret_id;
  end if;
  delete from public.provider_configs where id = p_id;
end;
$$;

grant execute on function public.delete_provider(uuid) to authenticated, anon;
```

### Append to `Seed/open-questions.md`

§2.3 gets a new resolution note (append-only):

> **Resolved (plan 0007):** BYOK encryption uses **Supabase Vault**,
> one `vault.secrets` row per `provider_configs` row, referenced by
> a `vault_secret_id` uuid column. Save / rotate / delete go through
> SECURITY DEFINER functions that check `auth.uid()`. Plaintext never
> leaves server-side memory. Aligns with architecture.md §3, §6.1.

## 6. UX surfaces

### `/settings` — index

Minimal list. One active entry:

- **Text Engine** → `/settings/text-engine`

Other entries render disabled with tooltips:

- Image Engine — "Ships with Visual Roleplay cycle".
- Grammar — "Ships with Grammar cycle".
- Data & Security — "Ships with a later cycle".
- Account — "Ships with a later cycle".

Non-omission notes per [ux.md §4.10](../Seed/ux.md): the full
10-sub-section Settings surface lives in later cycles. Placeholders
surface the structure without faking feature completeness.

### `/settings/text-engine` — the form

Sections:

1. **Provider family** — `<select>` with options from schema.md
   §2.17's enumerated list. Default is `OpenRouter` on first entry;
   pre-selected on edit if a row exists.
2. **Base URL** — `<input>`. Pre-filled per provider family when
   blank (`https://openrouter.ai/api/v1` for OpenRouter;
   `http://localhost:11434/v1` for Ollama; etc.).
3. **API key** — masked `<input type="password">` with a reveal
   (👁) toggle. The form **never reads back the currently-stored
   key** (Vault is write-only from the client's perspective). If a
   key is already saved, the field shows a muted `••••••••` with a
   note "Leave blank to keep the current key" and submit with an
   empty key means no rotation.
4. **Model id** — free-text `<input>` (`deepseek/deepseek-v3.2`,
   `openai/gpt-4o`, etc.). No refresh-list button this cycle.
5. **Temperature** — `<input type="range">` 0–2 step 0.05, default
   0.7.
6. **Max tokens** — number input / slider, default 8192.
7. **Context length** — number input / slider, default 32768.
8. **Thinking mode** — checkbox, default OFF, subcopy "Enable
   chain-of-thought reasoning for supported models. Uses more
   tokens and is slower."
9. **Cloud AI Consent** — inline notice rendered **above Save**
   **only on first save of a cloud provider** (OpenRouter / OpenAI
   / Google / xAI / Atlas / Alibaba). Copy: "Using a cloud provider
   means your messages, Character data, and Grammar text leave your
   device and go to the provider. Your API key is stored encrypted.
   You can delete it anytime." Plus a checkbox **"I understand"**
   that must be ticked before Save is enabled. Once checked, the
   user's `users.preferences.security.cloud_consent_at` is populated
   — once set, the notice becomes a one-line "Cloud AI Consent
   acknowledged on <date>" and no checkbox.
10. **Actions** — Save, Delete (if a row exists).

Deferred with visible placeholder:

- Test Connection button — rendered **disabled** with tooltip
  "Test Connection lands with the Conversation Agent in the next
  cycle". Non-omission preserved.

### ChatShell composer (cycle 0006 update)

Composer now has three states:

- **No active text provider**: `disabled` + single inline line
  "Add a model provider in Settings → Text Engine" with the phrase
  "Settings → Text Engine" as a `<Link>` to `/settings/text-engine`.
- **Active provider but no key saved**: same state. (Happens if a
  row exists with `vault_secret_id = null`, e.g. the user created
  a local-provider entry without a key and then pointed at a URL
  that requires one — edge case, handled by the same CTA.)
- **Active provider with a key**: same enabled behavior as 0006.

### Required states (ux.md §4.10.6)

- loading / form / submitting / error on the Text Engine form.
- empty vs. configured on the Settings index (shown as active/
  disabled entries).

### Non-omission items deferred with explicit reason

- Test Connection — next cycle.
- Model list refresh — next cycle.
- Advanced knobs (top-p etc.) — later power-user cycle.
- Grammar sub-section — Grammar cycle.

## 7. Open questions

**Resolved this cycle** (append to open-questions.md §2.3):

- `users.byok_keys` / `provider_configs.api_key_encrypted`
  encryption envelope → **Supabase Vault per-row**.

Pre-existing items untouched:

- §5.1 Grammar-shares-Text-Engine — resolved; Grammar cycle
  consumes it.
- §2.3 Email verification — unchanged.
- §5.10 (from cycle 0006) `messages.text` — unchanged.

## 8. Implementation order

1. **Migration `0007_provider_configs.sql`.** Apply via SQL
   Editor. Smoke:
   - `select vault.create_secret('x','y','z');` works (confirms
     Vault is enabled — it is, on Supabase hosted, by default).
   - `select upsert_text_provider(...)` inserts a row and a
     matching `vault.secrets` entry.
   - A second call rotates the secret (old vault row is gone; new
     one exists).
   - `delete_provider(id)` removes both.
   - Cross-tenant: anon user B cannot SELECT from another user's
     `provider_configs`.
2. **Append the §2.3 resolution** to `Seed/open-questions.md`.
3. **`lib/providers.ts`.** Wraps `.rpc('upsert_text_provider')`,
   `.rpc('delete_provider')`, and
   `listActiveTextProvider(userId)` which does a plain SELECT.
4. **Routes `/settings` + `/settings/text-engine`.** Form per §6.
5. **`ChatShell` composer gate.** Reads active text provider on
   mount; shows the disabled-with-CTA variant or the enabled
   composer.
6. **Cloud AI Consent inline.** Reads
   `users.preferences.security.cloud_consent_at`; writes on first
   cloud save by updating the `preferences` jsonb.
7. **Playwright gates §9.**
8. **`code-review` + `code-simplifier`.**

No new frontend or backend dependencies.

## 9. Verification

### Playwright gates

1. **Settings index renders.** `/settings` shows "Text Engine"
   as a link; other entries render disabled with tooltips.
2. **Create a new provider.** From `/settings/text-engine`: pick
   OpenRouter, enter a fake key, set model `openai/gpt-4o`, save.
   `provider_configs` has one row for this user with
   `is_active=true`, `kind='text'`, `provider_family='OpenRouter'`,
   `vault_secret_id` non-null. `vault.secrets` has a row with that
   id. The form never shows the plaintext key back.
3. **Edit without rotating the key.** Change `temperature` to
   0.3, leave API key blank, save. Row updated;
   `vault_secret_id` unchanged (same UUID before and after).
4. **Rotate the key.** Enter a new fake key, save. New
   `vault_secret_id`; old secret is absent from `vault.secrets`.
5. **Cloud AI Consent.** Before first cloud save:
   `users.preferences.security.cloud_consent_at` is null; the
   inline notice + "I understand" checkbox render; Save disabled
   until checked. After save: `cloud_consent_at` is populated; on
   next visit the notice is a single acknowledged line.
6. **Composer gate — no provider.** Delete the provider (or
   create a fresh anon user). `/chat/:charId/:convId` Composer
   renders disabled with the "Settings → Text Engine" CTA link.
7. **Composer gate — provider active.** With a saved provider,
   the Composer is enabled and sending a message works (as in
   cycle 0006).
8. **One-active-per-kind invariant.** From a user with one row,
   call `upsert_text_provider` again: the old row flips to
   `is_active=false` in the same transaction; only one row has
   `is_active=true`. A direct INSERT attempt that sets
   `is_active=true` while another such row exists fails with
   unique-violation code `23505` on the partial index.
9. **Delete provider.** `delete_provider(id)` removes both the
   row and its vault secret.
10. **RLS isolation.** Isolated anon client B sees zero rows
    from user A's `provider_configs`. A direct SELECT against
    `vault.secrets` from a non-service role returns zero rows
    (Vault is service-role-only by default — this is what we
    rely on for confidentiality).
11. **Regressions 0001–0006.** sfw CHECK still rejects for anon;
    auth_method spoof still blocked; cycle 0006 messaging still
    works when a provider is present.

### Done definition

- Gates 1–11 green.
- `pnpm typecheck` + backend import clean.
- `code-review` + `code-simplifier` passes recorded.
- Migration applied; Vault secret round-trips confirmed.
- `Seed/open-questions.md` §2.3 updated (append-only) with the
  Vault resolution.
- Composer in ChatShell correctly gates on active provider.

## Verification

Run date: 2026-04-15. Supabase hosted project `tjytndffwwwanfeoeuze`.
Migration 0007 applied + follow-up patch applied after code-review.
`Seed/open-questions.md §5.9.1` appended with the Vault resolution
(append-only per CLAUDE.md).

### Playwright gates

1. **Settings index. ✅ PASS.** `/settings` shows `Text Engine` as
   the only live link (href `/settings/text-engine`); the four
   deferred entries render disabled with tooltips.
2. **Create provider + Cloud AI Consent flow. ✅ PASS.** From a
   fresh authenticated session, picked OpenRouter (pre-selected),
   filled API key + model `openai/gpt-4o`, ticked the consent
   checkbox, Save. `provider_configs` gained one row with
   `is_active=true`, `kind='text'`,
   `provider_family='OpenRouter'`, `vault_secret_id` non-null,
   `temperature=0.7`. `users.preferences.security.cloud_consent_at`
   stamped; the inline consent block flipped to an "acknowledged
   on …" muted line. API-key input cleared after save; plaintext
   never read back.
3. **Edit without rotating the key. ✅ PASS.** Changed temperature
   to 0.3, left API key blank, saved. Same `vault_secret_id` on
   the row, same row id; `temperature=0.3`. Vault secret count
   unchanged.
4. **Rotate the key. ✅ PASS.** Entered a new key, saved.
   `vault_secret_id` is a new UUID (old Vault row was deleted).
5. **Consent line renders on return visit. ✅ PASS** (verified in
   gate 2 — the "acknowledged on 4/15/2026" line renders and the
   checkbox is no longer required for subsequent saves).
6. **Composer gate — no provider. ✅ PASS.** After deleting the
   provider row, navigating back to `/chat/:charId/:convId`: the
   composer textarea is `disabled`, Send is `disabled`, the
   gate copy "Add a model provider in Settings → Text Engine"
   renders with the link targeting `/settings/text-engine`.
7. **Composer gate — provider active. ✅ PASS.** With a saved
   provider, the textarea is enabled; Send is disabled only
   because the text is empty (normal behavior from cycle 0006).
8. **One-active-per-kind. ✅ PASS.** Two successive
   `upsert_text_provider` calls with different families leave
   exactly **one** `is_active=true` row (the UPDATE branch now
   explicitly sets `is_active=true` after the code-review fix).
   A direct INSERT that sets `is_active=true` alongside the
   existing row fails with error code `23505` on
   `provider_configs_one_active_per_kind`.
9. **Delete provider. ✅ PASS** (verified in gate 6 — row and
   Vault secret both removed).
10. **RLS isolation. ✅ PASS.** Isolated anonymous client B
    cannot SELECT user A's `provider_configs` rows (zero
    returned).
11. **Regressions 0001–0006. ✅ PASS.** `sfw_disabled` CHECK
    still rejects for anon (23514); `auth_method` spoof still
    blocked; user_personas, characters, conversations, messages
    all still per-user isolated.

Screenshot: [`0007-text-engine.png`](0007-text-engine.png) — Text
Engine form with provider dropdown, prefilled Base URL, masked
API key input, model id, temperature slider, max/context token
inputs, thinking-mode toggle, consent-acknowledged line, and the
disabled Test Connection placeholder.

### `code-review` findings

Three findings, all fixed:

- **#1 (critical) — `upsert_text_provider` UPDATE path did not
  explicitly set `is_active=true`.** **Valid; fixed.** UPDATE's
  SET clause now includes `is_active = true`. Patched on the
  hosted DB via `create or replace function public.
  upsert_text_provider(...)`.
- **#2 (important) — `anon` role granted EXECUTE on both
  SECURITY DEFINER vault functions.** **Valid; fixed.** Revoked
  from both. Anonymous-sign-in users still have PostgREST role
  `authenticated` (the JWT carries `role=authenticated` even
  when `is_anonymous=true`), so this doesn't lock them out; it
  removes the unnecessary path for truly unauthenticated
  requests.
- **#3 (important) — cloud-consent read-modify-write race on
  `users.preferences`.** **Valid; fixed.** Added a new
  `stamp_cloud_consent()` SECURITY DEFINER RPC that uses
  `jsonb_set(coalesce(preferences, '{}'), '{security,
  cloud_consent_at}', ...)` on the server. The frontend now
  calls the RPC instead of read-modify-write, eliminating the
  race.

### `code-simplifier` deltas

- `Settings.tsx` — removed the tautological `rowActive` alias;
  `rowBase` style used directly on the Link.
- `lib/providers.ts:71` — dropped redundant `?? null` after the
  `as ProviderConfig | null` cast (maybeSingle already returns
  null on miss).
- `TextEngineSettings.tsx` — factored `trimmedModelId` so
  `modelId.trim()` runs once; dropped the always-truthy
  `providerFamily` guard from `canSave`.
- `ChatShell.tsx` — hoisted the composer `disabledReason` JSX
  into a named `composerDisabledReason` binding; renamed
  `computeSubsequentCount` to `subsequentCountFor(target, list)`
  (pure function, parameterized inputs).

Post-simplifier: `pnpm typecheck` clean; behavior unchanged.

### Status

**Cycle closeable.** 11 Playwright gates PASS; three code-review
findings all fixed (including a patch snippet applied to the
hosted DB); simplifier deltas recorded. `Seed/open-questions.md`
§5.9.1 appended (append-only) resolving §2.3 to Supabase Vault.
The composer in ChatShell now correctly gates on an active text
provider with a non-null `vault_secret_id`. The next cycle (0008)
will consume the stored key via a decryption-side RPC called from
the FastAPI backend, then run the Conversation Agent over SSE.
