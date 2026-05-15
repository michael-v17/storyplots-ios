# StoryPlots

**Status: v0.2 — public beta.** The functional layer is in place and
usable end-to-end, and the dedicated visual-design overhaul has shipped
(amber-accent rebrand, sidebar redesign, mobile sheet pattern, auth
contrast). Many edge cases — especially around character creation,
character memory tuning, and image-generation defaults — are still being
exercised. Behavior, APIs, and database schema may change between
releases; pin a specific commit if you depend on a particular shape.

> **Step into stories — create AI characters and explore a new plot with
> every conversation.**
>
> StoryPlots is a roleplay-style chat app where every conversation is its
> own self-contained story. You write to a Character — a shrine maiden,
> a therapist, an old assistant, anything — and the model writes back in
> character, in real time. Each Conversation has its own memory and its
> own Lorebook; branch a thread, edit a turn, keep the canon you want.
>
> An optional Grammar pass quietly keeps notes on what you write, so
> users practicing English can review patterns later — a side benefit
> for those who want it, not the headline.

This repository is the working implementation. It is feature-complete on
the functional layer (chat, characters, memory, lorebook, branching, image
and voice generation, grammar feedback) and the **dedicated visual design
pass has landed** in v0.2 — see [Status](#status) below for what's still
being polished.

---

## What it does today

- **Per-Conversation Agent.** Every chat owns its own state — no leakage
  across conversations. Edits trim the conversation to that point;
  branching produces an independent copy.
- **BYOK (Bring Your Own Keys).** You plug in your own provider keys for
  text (OpenRouter / OpenAI-compatible), images (fal.ai or ComfyUI), and TTS
  (OpenAI / ElevenLabs / WebSpeech). Keys land encrypted in Supabase Vault
  — never in the database in cleartext.
- **Characters.** Manual creation, AI-assisted enrichment, and import of
  V1 / V2 / V3 character cards (PNG `tEXt` + JSON). Each character gets a
  generated avatar with a locked seed for visual consistency.
- **Lorebook & Author's Notes.** Per-Conversation knowledge base with
  keyword-triggered injection plus a depth-injected author's note.
- **Character Memory (RAG).** Opt-in. Every few turns the assistant
  extracts events / facts / promises / actions / relationships from the
  conversation, embeds them with `text-embedding-3-small`, and retrieves
  the top-K most relevant ones on the next user turn (with recency
  blending so older facts decay gracefully).
- **Visual Roleplay.** The model can append `[image: ...]` tags that
  trigger image generation through the configured engine — **fal.ai**
  (recommended, paid) or a self-hosted **ComfyUI** instance. A small
  refiner LLM normalizes the tags
  into Danbooru-canon prompts with framing-aware detail suppression
  (close-up vs. full body), POV awareness (first-person camera vs.
  third-person multi-subject composition), and per-regenerate ephemeral
  overrides.
- **Voice.** Dual-voice TTS (separate narrator and character voices,
  gender-matched), per-character voice overrides, per-kind volume.
- **Grammar pass.** A dedicated, isolated agent reviews recent user
  messages for errors, fillers, overused words, and pattern issues —
  with no access to memory, lorebook, or persona context, so the
  feedback stays purely linguistic.
- **Forking, snapshotting, branching.** Conversations can be forked into
  independent copies; branch summaries are injected at a fixed prompt
  position to preserve continuity.
- **Insights dashboard, gallery, snapshots, data & security panel,
  export / import backup, per-category deletion.**

The 11-position prompt-assembly pipeline (writing style → character →
scenario → user persona → descriptions → knowledge base → author's note →
character memory → visual roleplay → parent branch summary → reserved)
lives in [`backend/app/prompt_assembly.py`](backend/app/prompt_assembly.py).

---

## Status

| Phase | State |
|---|---|
| Foundation (auth, characters, conversations, messages, providers) | ✅ Done |
| Chat (SSE streaming, agent isolation, edit-as-trim) | ✅ Done |
| Memory engine (RAG, opt-in, recency blending) | ✅ Done |
| Visual roleplay (image refiner, POV, framing) | ✅ Done |
| TTS (dual voice, per-character override) | ✅ Done |
| Grammar dashboard | ✅ Done |
| Forking / branching / import / export | ✅ Done |
| App shell, sidebar, recent chats, settings layout | ✅ Done |
| Visual design overhaul (rebrand, tokens, components) | ✅ Done — v0.2 |
| Character creation flow polish | ⏳ Ongoing |
| Character memory engine tuning | ⏳ Ongoing |
| QA / bug-fix sweep | ⏳ Ongoing |

**v0.2 shipped the visual overhaul.** The codebase now runs on a
tokenized design system (amber accent, dark surfaces, One-Radius
14px, SF Pro stack, mobile-first sheet pattern, redesigned sidebar with
auto-collapse and floating toggle, auth surface with hero copy and
inset card). The next polish targets sit on top of the functional layer:
the character-creation flow and the character-memory engine are the
priority items being exercised toward v0.3.

---

## Stack

- **Frontend** — React 18 + Vite + TypeScript (strict)
- **Backend** — FastAPI + Python 3.11 (run via `uv`)
- **Database** — Supabase (Postgres 15 + pgvector + Vault + RLS + Storage)
- **Streaming** — Server-Sent Events from FastAPI to the browser
- **Models (BYOK)** — OpenRouter / OpenAI-compatible for text + embeddings,
  fal.ai or ComfyUI for images, OpenAI / ElevenLabs / WebSpeech for TTS

---

## Repository layout

```
frontend/         React + Vite + TS SPA
  src/
    lib/          Supabase client, session, domain helpers
    features/     Grouped UI features (chat, characters, shell, settings)
    routes/       Page components

backend/          FastAPI app
  app/
    routes/       HTTP / SSE endpoints
    agents/       Streaming LLM drivers + image / TTS clients
    deps/         JWT verification + RLS-scoped Supabase client
    prompts/      System-prompt text files
    prompt_assembly.py   The 11-position prompt builder

supabase/
  migrations/     Versioned SQL migrations (source of truth for the schema)
                  — not bundled in the public repo for v0.2; see Step 2

LICENSE           MIT
```

---

## Run it locally

### Prerequisites

Install these first — nothing else on this page will work without them.

- **Node ≥ 20** with **pnpm** (once Node is installed, run `corepack enable`
  so the `pnpm` command is available)
- **Python ≥ 3.11** and **[uv](https://docs.astral.sh/uv/)**
  (`curl -LsSf https://astral.sh/uv/install.sh | sh` on macOS / Linux)
- **Git**
- *Optional — only needed for those features:*
  - A **fal.ai** account *(recommended)* or a **ComfyUI** instance
    reachable over HTTP for image generation
  - An **OpenAI** or **ElevenLabs** account for higher-quality TTS
  - An **OpenRouter** (or any OpenAI-compatible) account for text + embeddings

### Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**. The free
   tier is fine.
2. Once it provisions (about 2 minutes), open **Project Settings → API**
   in the sidebar and keep the following values open in a tab — you'll
   paste them into `.env.local` in step 4:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`)
   - **Project API keys → `anon public`** (starts with `sb_publishable_…`)
   - **JWT settings → JWT secret** (used by the backend to verify HS256
     tokens — the field is labelled "JWT Secret" under the same API page)

That is all the Supabase UI work — everything else is SQL that you paste
in step 2.

### Step 2 — Load the database schema

> **Note for v0.2:** the migrations live under `supabase/migrations/` and
> are the source of truth for the schema, but that directory is not yet
> bundled in this public repo (it's gated alongside the maintainer's
> working seed). A consolidated baseline SQL is planned for v0.3.
> Until then, set-up from a fresh clone is **maintainer-only** —
> contributors who need a working DB should reach out and we'll share
> the bundle separately.

What the schema creates, for reference: every `public.*` table, the RLS
policies, all RPCs, the four storage buckets (`avatars`,
`character-imports`, `generated-media`, `generated-audio`), the
auth-hook trigger that mirrors `auth.users` into `public.users`, and the
`pgvector` extension used by the memory engine.

### Step 3 — Clone and install

```sh
git clone https://github.com/michael-v17/storyplots.git
cd storyplots

# Install frontend dependencies
cd frontend && pnpm install && cd ..

# Install backend dependencies
cd backend && uv sync && cd ..
```

### Step 4 — Configure environment variables

The project reads two separate env files — one for the backend, one for
Vite (the frontend).

```sh
cp .env.example .env.local              # backend
cp .env.example frontend/.env.local     # frontend
```

Open both files and paste the three values from step 1. The shape is the
same in each file; only the variable names differ.

**`.env.local`** (backend — lives in the repo root):

```
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=sb_publishable_…
SUPABASE_JWT_SECRET=<your-hs256-jwt-secret>
```

**`frontend/.env.local`** (Vite):

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_…
```

Both files are already in `.gitignore` — **do not commit them**.

### Step 5 — Run the backend (FastAPI, port 8000)

Open a terminal in the repo root:

```sh
cd backend && \
  SUPABASE_URL="https://<your-project-ref>.supabase.co" \
  SUPABASE_ANON_KEY="sb_publishable_…" \
  SUPABASE_JWT_SECRET="<your-hs256-jwt-secret>" \
  uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

If you prefer not to prepend the env inline every time, export them in
your shell first (`source .env.local && export $(cut -d= -f1 .env.local)`)
or use a tool like `direnv`.

You should see:

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

Leave this terminal running.

### Step 6 — Run the frontend (Vite, port 5173)

Open a **second** terminal in the repo root:

```sh
cd frontend && pnpm dev
```

You should see:

```
  VITE v…  ready in … ms
  ➜  Local:   http://localhost:5173/
```

### Step 7 — Open the app

Go to **[http://localhost:5173](http://localhost:5173)** in your browser.

- On first visit you'll be redirected to the **sign-in screen**. Create
  an account with email + password (anonymous sessions were removed in
  v0.2 — with pure BYOK there is no usable surface for an anonymous
  user; see the [seed update](Seed/creator-vision.md#session-model) for
  the full rationale).
- Head to **Settings → Text Engine** and paste an OpenRouter (or any
  OpenAI-compatible) API key to enable chat. The key is encrypted into
  Supabase Vault — it never lives in the database in cleartext.
- *(Optional)* Configure **Settings → Image Engine** with a **fal.ai**
  API key (recommended) or the URL of your ComfyUI instance to unlock
  Visual Roleplay, and **Settings → Text-to-Speech** with an OpenAI /
  ElevenLabs key for TTS.

That's it — create a Character from the sidebar, start a Conversation,
and the first assistant reply should stream back via SSE.

### Troubleshooting

- **"SUPABASE_JWT_SECRET not set"** — the backend raises this on every
  request if the env var is missing. Re-check step 5.
- **CORS errors in the browser console** — the backend allows
  `http://localhost:5173` by default. If you run Vite on a different
  origin (or you want a deployed backend to also accept your local dev
  server), set `FRONTEND_ORIGIN` accordingly. It accepts a single origin
  or a comma-separated list, e.g.
  `FRONTEND_ORIGIN=https://storyplots.app,http://localhost:5173`.
- **`relation "public.users" does not exist`** — the schema was not
  applied to the Supabase project referenced by your env vars. Re-run
  step 2 against the correct project.
- **Images not generating** — image generation is optional and not
  pre-wired. In Settings → Image Engine, either pick **fal.ai** and
  paste an API key (simplest), or pick **ComfyUI** and enter the URL of
  a running instance (e.g. `http://127.0.0.1:8188`) plus the workflow
  JSON for your checkpoint. Without an engine configured, chat works
  normally but `[image: …]` tags silently become no-ops.

---

## Architectural principles

These are baked into the implementation; touching them costs more than
the change saves:

- **Agent isolation.** Per-Conversation agent state. No cross-conversation
  leakage of memory, lorebook, persona, or model.
- **Edit-as-trim.** Editing a message trims the conversation to that
  point — it never silently mutates history in place.
- **Branching = copy.** Forking produces an independent conversation;
  there is no shared mutable state with the parent.
- **Snapshot semantics.** Writing styles, character context, and persona
  data are snapshotted at conversation creation; later edits to the
  source don't retroactively rewrite running conversations.
- **Vendor-agnostic prompts.** No vendor lock-in baked into the prompt
  layer. Anything OpenAI-compatible works for text / embeddings.
- **Supabase as source of truth.** Browser and backend both go through
  Supabase under the same JWT; RLS enforces scope.
- **BYOK.** Provider keys belong to the user. Stored encrypted (Vault),
  surfaced only to the agent layer at request time.
- **Grammar Module default OFF, Memory Module default OFF.** Both are
  opt-in per user / per conversation.

---

## Contributing

This is an indie project. Issues and pull requests are welcome; small,
focused changes are preferred.

---

## Disclaimer and responsible use

StoryPlots is released as a public beta for educational and personal
use. The software is provided **"as is", without warranty of any kind**
(see [LICENSE](LICENSE)).

- **User responsibility.** Each operator is solely responsible for how
  they deploy, configure, and use this software, including compliance
  with local laws and with the terms of service of every third-party
  provider they choose to connect (model providers, image-generation
  backends, TTS services, hosting, etc.).
- **Bring-your-own-key model.** The project does not ship or proxy API
  credentials. Keys you save are encrypted in your own Supabase Vault
  and used only against the providers you configure. Provider billing,
  quotas, and abuse policies remain between you and your provider.
- **Generated content.** The model outputs, images, and audio produced
  by this application come from third-party models under their own
  licenses and content policies. Review and moderate generated content
  before redistribution.
- **Minors and NSFW content.** The NSFW toggle is opt-in, gated behind
  an 18+ self-attestation. It must not be enabled on behalf of minors
  under any circumstances.
- **No production guarantees.** Many flows and edge cases have not yet
  been exhaustively tested. Do not deploy this in a production-critical
  setting without your own validation, backups, and monitoring.
- **Data handling.** All persistent data lives in the Supabase project
  the operator configures. It is the operator's responsibility to
  handle privacy notices, data-retention, export and deletion requests,
  and any other obligations that may apply to their users.

By using the software you agree to assume all associated risk and to
hold the authors harmless as described in the MIT License below.

---

## License

Released under the [MIT License](LICENSE). Copyright holders and
contributors are not liable for any damages arising from use of this
software. If you redistribute it or a substantial portion of it,
preserve the copyright notice and the license text.
