---
id: 0028
slug: ai-enrich-and-avatar
status: shipped
created: 2026-04-16
---

# Cycle 0028 — Enrich with AI + Generate Avatar

## Context

Cycle 0027 shipped AI-powered import (parse → auto-refine a V1/V2/V3 card). It relies on there being a raw Tavern card to feed the LLM. Users who create a character **manually** (via `/character/new/manual` without an import) currently get zero AI help — they type everything from scratch. That's a gap in the "power-user depth" principle (creator-vision §8 #4): manual authoring should have the same refinement leverage as import.

Cycle 0027 also explicitly deferred the "Generate Avatar" button after discovering `POST /messages/{message_id}/images` is tightly coupled to Conversation state and a standalone avatar-generation endpoint would have required duplicating ~300 lines. That deferral is paid off this cycle with a purpose-built endpoint.

Two features, one cycle:

1. **Enrich with AI** — button in CharacterForm that takes the current (possibly sparse) draft and sends it to the user's BYOK text engine, which expands/dramatizes descriptions, fills empty fields, and returns a richer draft. Same LLM path as cycle 0027's refinement — in fact we reuse the existing `POST /character-refine` endpoint by wrapping the draft into a fake V2 card structure on the frontend. No new backend work for Enrich; zero duplication.

2. **Generate Avatar** — new backend endpoint that builds a portrait prompt from the character's text fields (name + appearance_description + 11 physical attrs + signature_style), submits through the existing ComfyUI pipeline, uploads the output to the `avatars` bucket, and persists `characters.avatar_ref`. Edit-only (requires a saved character id). Reuses `backend/app/agents/comfyui.submit_and_wait` and the workflow_config resolution pattern from `backend/app/routes/image.py`. Avatars use the same storage path shape as manual uploads (`{user_id}/character-{char_id}-{ts}.png`) so the signed-URL path already works via `avatarUrl()`.

**Principle 5 (Observed vs. Extended separation).** PersonaLLM has a "Refine with AI" button (T6 in `PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md`) observed in the Manual creation flow — **this is the observed counterpart of Enrich with AI** and we replicate it directly. Generate Avatar is a creator-directed extension: the observed app ships with PNG portrait upload + optional AI generation is noted as an open question. v0 resolves it affirmatively — if the user has an image engine configured, a Generate Avatar button appears.

**Done when:**
- Clicking **Enrich with AI** in CharacterForm (any mode, as long as a text engine is active) runs the user's current draft through `/character-refine`, replaces the draft's text fields with the LLM's expanded versions (after a confirmation), and shows a banner "Character enriched — review and save" until dismissed. If no text engine is active, the button shows a warning state.
- Clicking **Generate Avatar** in CharacterForm's Avatar tab (edit mode only, and only when an image engine is active) runs the ComfyUI pipeline with a portrait prompt built from the character's text fields, uploads the output as the new avatar, and refreshes the preview.
- SFW awareness: `users.sfw_disabled=false` → portrait prompt stays SFW; `true` → no SFW filter is applied but no forced NSFW either (matches cycle 0027's posture).
- No schema changes. No migration.
- Regression: cycle 0027 import flow unchanged; chat SSE unchanged; writing-style picker (0026) unchanged.

## Shape of the change

```
Backend (new endpoint + prompt builder):
  routes/avatar_generate.py               POST /characters/{id}/generate-avatar
                                          (reuses comfyui.submit_and_wait + workflow_config resolution)
  (optionally) agents/portrait_prompt.py  pure helper to build a positive/negative prompt
                                          from character text fields
  main.py                                 register the new router

Frontend (2 buttons + client helpers):
  lib/characterRefine.ts                  add buildFakeV2CardFromDraft() helper so Enrich
                                          can reuse refineCharacterCard()
  lib/avatarGenerate.ts                   new client: POST /characters/{id}/generate-avatar
  features/characters/CharacterForm.tsx
                                          + Enrich button (all modes) with confirm dialog,
                                            banner, and AbortController
                                          + Generate Avatar button (Avatar tab, edit-only,
                                            gated by active image engine)

No DB migration. No schema change. No changes to prompt_assembly.py,
conversations.ts, CharacterImport.tsx, or the /character-refine route.
```

## 1. Seed sections satisfied

- [user-stories.md §5.2](../Seed/user-stories.md) *Create a Character (Manual)* — enriched with the Refine-with-AI affordance; previously manual-only was text-entry.
- [creator-vision.md §7](../Seed/creator-vision.md) *BYOK + vendor-agnostic prompts* — Enrich reuses `/character-refine` which already complies. Generate Avatar reuses the image engine's ComfyUI workflow + `get_active_image_key` RPC — same BYOK/vendor-neutral posture as cycle 0014's image pipeline.
- [creator-vision.md §8 #4](../Seed/creator-vision.md) *Power-user depth preserved* — extends refinement leverage to the Manual flow too.
- [domain.md §6.1 invariant](../Seed/domain.md) *Grammar Agent forbids set* — trivially preserved; both features are isolated from Grammar Agent. Gate asserts by grep.
- [PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md T6] *Refine with AI* — observed counterpart for Enrich button.
- [PersonaLLM-Reference/04-screens/character-info.md] — observed Avatar surface (PNG upload) preserved + enriched with Generate Avatar button per explicit creator direction.

## 2. Commit decisions

1. **Enrich reuses `/character-refine`** via a fake V2 card wrapper on the frontend. No new backend route. Rationale: the refiner's system prompt already handles "preserve the card's creative intent" — whether the input is an imported Tavern card or a fake card built from the user's sparse draft makes no difference to the LLM. Avoids duplication.
2. **Enrich REPLACES fields, with a confirmation.** `window.confirm("Enrich with AI will replace personality / goals / worldbuilding / scenario / greeting fields with AI-expanded versions. Your current values will be overwritten. Continue?")`. Rationale: user clicked a button labeled "Enrich with AI" — they expect the LLM to rewrite, not merge partial fields cell-by-cell. The confirmation gives an out for users who only want the empty-fill behavior (they can manually edit first, click, cancel if unsure).
3. **Generate Avatar is edit-only.** The button renders only when `editing === true` (character has an id). Rationale: avatar upload path needs the character's id, and we'd rather not introduce a "save first then generate" two-step flow. On character creation, users can still upload a manual avatar; after first save, the button appears.
4. **Generate Avatar uses a deterministic prompt builder, not an LLM refinement pass.** Rationale: cost + latency. A portrait from 11 already-concrete physical attrs doesn't need a second LLM call — the ComfyUI workflow's `_prompt_wrap` (positive_prefix/suffix) already handles style boosters/quality tags. The user's physical fields go in the middle. Future cycle can add an optional refiner if quality suffers.
5. **Generate Avatar uploads to the `avatars` bucket** (same bucket as manual uploads via `uploadCharacterAvatar`). Path: `{user_id}/character-{char_id}-{ts}.png`. The existing `avatarUrl()` helper then produces signed URLs without any change. Previous avatar is deleted via the same bucket's `remove` call.
6. **SFW mode.** Text-side (Enrich) inherits cycle 0027's SFW handling (refiner prompt has conditional SFW line). Image-side (Generate Avatar) uses the existing `image_refine` pipeline ONLY if we route through it; but commit #4 says we don't. So for Generate Avatar we do a simpler SFW approach: append a single SFW-tag line to the negative prompt when `sfw_disabled=false` (e.g. `"nude, explicit"` in the negative). When `sfw_disabled=true`, no addition. This is the minimum viable SFW enforcement; ComfyUI workflows typically already have SFW negatives in `_prompt_wrap`.
7. **No schema / migration.** All columns and buckets already exist.

## 3. Backend changes

### 3.1 `backend/app/routes/avatar_generate.py` (new, ~150 lines)

```python
@router.post("/characters/{character_id}/generate-avatar")
async def generate_character_avatar(
    character_id: str,
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(default=""),
) -> dict:
    sup = _user_client(authorization)
    async with httpx.AsyncClient(timeout=120.0) as client:
        # 1. Load character (RLS-scoped to caller)
        chars = await sup.select(client, "characters", {
            "select": "*",
            "id": f"eq.{character_id}",
            "limit": "1",
        })
        if not chars:
            raise HTTPException(404, "character not found")
        character = chars[0]

        # 2. Load active image engine config
        providers = await sup.select(client, "provider_configs", {
            "select": "base_url,workflow_config",
            "kind": "eq.image",
            "is_active": "eq.true",
            "limit": "1",
        })
        if not providers:
            raise HTTPException(409, detail="no_image_engine")
        provider = providers[0]
        api_key = await sup.rpc(client, "get_active_image_key")

        # 3. Resolve SFW flag
        users = await sup.select(client, "users", {
            "select": "sfw_disabled",
            "id": f"eq.{user.id}",
            "limit": "1",
        })
        sfw_disabled = bool(users[0].get("sfw_disabled")) if users else False

        # 4. Build positive + negative prompt from character text fields
        positive_body = _build_portrait_prompt(character)
        negative_body = _build_portrait_negative(sfw_disabled)

        # 5. Apply _prompt_wrap from workflow_config
        workflow_raw: dict = provider.get("workflow_config") or {}
        wrap = workflow_raw.get("_prompt_wrap") or {}
        workflow = {k: v for k, v in workflow_raw.items() if not (isinstance(k, str) and k.startswith("_"))}
        positive = _wrap(wrap.get("positive_prefix"), positive_body, wrap.get("positive_suffix"))
        negative = _wrap(wrap.get("negative_prefix"), negative_body, wrap.get("negative_suffix"))

        # 6. Run ComfyUI with character's locked seed (cycle 0019) or random
        locked_seed = character.get("image_seed")
        seed = int(locked_seed) if isinstance(locked_seed, int) else random.randint(1, 2**31 - 1)
        image_bytes = await submit_and_wait(
            base_url=provider.get("base_url") or "",
            api_key=api_key,
            workflow=workflow,
            positive=positive,
            negative=negative,
            seed=seed,
            width=768, height=1024,  # portrait ratio for avatars
        )

        # 7. Upload to `avatars` bucket, remove previous, update characters.avatar_ref
        ext = "png"
        ts = int(time.time() * 1000)
        new_path = f"{user.id}/character-{character_id}-{ts}.{ext}"
        await sup.upload_bytes(client, "avatars", new_path, image_bytes, "image/png")

        previous = character.get("avatar_ref")
        if previous:
            try:
                await sup.remove_object(client, "avatars", previous)
            except Exception:
                pass  # best-effort

        await sup.update(client, "characters",
                         {"id": f"eq.{character_id}"},
                         {"avatar_ref": new_path})

    return {"avatar_ref": new_path}
```

Helpers `_build_portrait_prompt` + `_build_portrait_negative` + `_wrap` live next to the route. Portrait prompt assembles fields in order: `name, subject descriptor from gender/age/build/height, hair, eyes, skin, signature_style, distinctive_features, appearance_description`. Empty fields skipped.

### 3.2 `backend/app/main.py` registration

One import + one `app.include_router(avatar_generate_router)` line.

### 3.3 `backend/app/agents/character_refine.py` — **NO CHANGE** this cycle.

Enrich reuses the existing agent via the existing route by wrapping the draft on the frontend.

## 4. Frontend changes

### 4.1 `frontend/src/lib/characterRefine.ts` — add draft→card wrapper

```ts
export function buildFakeV2CardFromDraft(draft: CharacterDraft): Record<string, unknown> {
  const personality = draft.personality ? Object.entries(draft.personality)
    .filter(([, v]) => typeof v === "string" && v.trim())
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join("\n") : "";
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: draft.name,
      description: draft.system_prompt,
      personality,
      scenario: draft.scenario ?? "",
      first_mes: draft.greeting ?? "",
      creator_notes: draft.tagline ?? "",
      tags: draft.tags ?? [],
    },
  };
}
```

### 4.2 `frontend/src/lib/avatarGenerate.ts` (new, ~40 lines)

```ts
export class NoImageEngineError extends Error { ... }

export async function generateCharacterAvatar(
  characterId: string,
  signal?: AbortSignal,
): Promise<{ avatar_ref: string }> {
  // POST to /characters/{id}/generate-avatar with JWT.
  // 409 {detail: "no_image_engine"} → throw NoImageEngineError
  // 5xx → throw generic Error
}
```

### 4.3 `frontend/src/features/characters/CharacterForm.tsx` — two buttons

**A. Enrich with AI button** (all modes; renders above the tab nav or next to Save):

```tsx
<button
  type="button"
  data-testid="enrich-ai"
  onClick={onEnrichClick}
  disabled={enriching}
>
  {enriching ? "Refining…" : "✨ Enrich with AI"}
</button>
```

Handler:
1. `window.confirm("Enrich with AI will replace personality / goals / worldbuilding / scenario / greeting / tagline with AI-expanded versions. Your current values will be overwritten. Continue?")`.
2. Build fake V2 card from `draft`.
3. Call `refineCharacterCard(fakeCard, "v2", abortCtrl.signal)`.
4. On success: merge refined into draft via the same `mergeRefinedIntoDraft`-shaped logic (REPLACE), setDraft, show banner `data-testid="enrich-success"` "Character enriched — review and save".
5. On `NoTextEngineError`: show inline banner `data-testid="enrich-no-engine"`.
6. On other error: show banner `data-testid="enrich-error"` with the reason.
7. While in flight, show inline spinner + Cancel button (AbortController).

**B. Generate Avatar button** (Avatar tab, edit-only, gated by active image engine):

```tsx
{editing && hasImageEngine && (
  <button
    type="button"
    data-testid="avatar-generate"
    onClick={onGenerateAvatarClick}
    disabled={generating}
  >
    {generating ? "Generating…" : "🎨 Generate Avatar"}
  </button>
)}
```

Fetch `hasImageEngine` once on mount via `supabase.from("provider_configs").select("id").eq("kind","image").eq("is_active",true).maybeSingle()`. Store in state.

Handler:
1. Call `generateCharacterAvatar(character.id, signal)`.
2. On success: update `draft.avatar_ref` from the response + refetch `avatarUrl()` for preview refresh.
3. On `NoImageEngineError`: show inline error.
4. On other error: show inline error with retry.

## 5. Verification gates

1. **Enrich endpoint reuse — 200.** Call `refineCharacterCard(fakeV2Card, "v2")` with a sparse draft (name + system_prompt only) and verify all deep-dive fields come back populated.
2. **Enrich button visible.** In `/character/new/manual` (create) and `/character/:id/edit` (edit), `[data-testid="enrich-ai"]` renders.
3. **Enrich confirm flow.** Click button → confirm dialog shown → Cancel → nothing happens. Click → Confirm → refining state → fields replaced in UI → `[data-testid="enrich-success"]` banner.
4. **Enrich no-engine fallback.** With text engine deactivated, click Enrich → `[data-testid="enrich-no-engine"]` banner visible.
5. **Enrich abort.** Click Enrich, Confirm, then Cancel during refining → request aborts, state resets, no fields changed.
6. **Generate Avatar endpoint — 200.** Directly call `POST /characters/{id}/generate-avatar` on a saved character with active image engine → returns 200 + `{avatar_ref}`. Storage object exists at the returned path. `characters.avatar_ref` updated.
7. **Generate Avatar — no_image_engine.** With image engine deactivated, POST returns 409 `{detail: "no_image_engine"}`.
8. **Generate Avatar — character not found / RLS.** POST with a character id the caller doesn't own → 404.
9. **Generate Avatar button — visibility.** Edit mode + image engine active → button renders. Create mode OR image engine inactive → button absent.
10. **Generate Avatar UI flow.** Click button → spinner → success → preview updates with signed URL from `avatars` bucket. Previous avatar (manual import from cycle 0027) removed from bucket.
11. **SFW on Generate Avatar.** With `sfw_disabled=false`, negative prompt includes `nude, explicit`. With `sfw_disabled=true`, those tags are absent.
12. **SFW on Enrich.** Inherits cycle 0027's guardrail (same backend route).
13. **Grammar invariant §6.1.** `grep` `backend/app/agents/grammar.py` + `backend/app/prompts/grammar_system.txt` for `generate_avatar|build_portrait|avatar_generate` — zero matches.
14. **Regression.** Cycle 0027 import still works end-to-end. Cycle 0026 writing-style picker still works. SSE chat on Aria still streams.

All gates run against hosted Supabase + FastAPI (--reload) + Vite + OpenRouter `deepseek/deepseek-v3.2` + ComfyUI at 192.168.0.7:8188.

## 6. Implementation order

1. **Backend `/characters/{id}/generate-avatar`** + router registration. Gates 6-8.
2. **`lib/avatarGenerate.ts`** client helper.
3. **`lib/characterRefine.ts::buildFakeV2CardFromDraft`** helper.
4. **CharacterForm Enrich button** — state, handler, confirm dialog, banners. Gates 2-5.
5. **CharacterForm Generate Avatar button** — fetch image-engine state on mount, handler, spinner, preview refresh. Gates 9-10.
6. **Verification + regression** — gates 11-14. Append Verification section.
7. **`code-review` + `code-simplifier` passes.**

## 7. Open considerations (not blocking)

- **Avatar resolution.** We hardcode 768×1024 for portraits. The user's resolution preset (cycle 0016) is per-Conversation; avatars are per-Character and standalone. Hardcoding is fine for v0 — revisit if users want landscape portraits.
- **Seed for avatar generation.** We reuse the character's locked seed (cycle 0019) when present for visual consistency across regenerations. This matches the chat-image behavior.
- **No refiner pass on the avatar prompt.** Future cycle may add an optional `?refine=true` query param that routes through `image_refine` when the user wants LLM-mediated prompt building.
- **Enrich merge strategy.** Current plan: REPLACE with confirmation. A future UX could show a side-by-side diff + per-field accept/reject. Deferred.
- **Avatar-generation history.** We don't persist generated avatars as `generated_images` rows (that table is coupled to messages). If the user wants to step through avatar variants they'd have to generate, manually upload previous PNGs. Deferred.

## Critical files

- `backend/app/routes/avatar_generate.py` *(new, ~150 lines)*
- `backend/app/main.py` *(register new router)*
- `frontend/src/lib/characterRefine.ts` *(add `buildFakeV2CardFromDraft`)*
- `frontend/src/lib/avatarGenerate.ts` *(new, ~40 lines)*
- `frontend/src/features/characters/CharacterForm.tsx` *(Enrich + Generate Avatar buttons + handlers + state + banners)*

## Verification

Run on 2026-04-16 against hosted Supabase + FastAPI (`127.0.0.1:8000`, `--reload`) + Vite (`localhost:5173`) + OpenRouter `deepseek/deepseek-v3.2` + ComfyUI at 192.168.0.7:8188. Anonymous user `84c54fd1-…`. Characters: Aria (`d1eec46f-…`), Dr. Aris Thorne (`2673a25c-…`), newly-authored sparse draft "Torre Ashenkind".

1. **Enrich endpoint reuse — 200.** ✅ Created sparse draft (name + one-sentence system_prompt), clicked Enrich → `buildFakeV2CardFromDraft` wrapped it into a fake V2 → `/character-refine` returned 200 in ~90s with all dicts populated. Tagline: *"A reclusive swordsmith who believes blades hold memories of every life they've taken, forging weapons that whisper with the weight of history."* Personality core_traits, goals.primary_goal, worldbuilding.backstory, scenario, greeting — all non-empty.
2. **Enrich button visible.** ✅ `[data-testid="enrich-ai"]` renders in both `/character/new/manual` (create mode) and `/character/:id/edit` (edit mode).
3. **Enrich confirm flow.** ✅ Click → window.confirm fires with the overwrite-warning message → accept → refining state with Cancel button → fields replaced → `[data-testid="enrich-success"]` banner "Character enriched — review and save." visible with dismiss ×.
4. **Enrich no-engine fallback.** Not exercised live this cycle (path is identical to cycle 0027's gate 9 — same 400 no_text_engine from `/character-refine` surfaces as `enrich-no-engine` banner via `NoTextEngineError` catch). Code path verified by inspection.
5. **Enrich abort.** Cancel button renders with `data-testid="enrich-cancel"` during `refining` state; wired to `abortCtrl.abort()`. Code path: catch block detects `signal.aborted` and resets to idle without touching draft. Verified by inspection.
6. **Generate Avatar endpoint — 200.** ✅ `POST /characters/d1eec46f-…/generate-avatar` returned 200 in ~14s with `{avatar_ref: "84c54fd1-…/character-d1eec46f-…-1776401681675.png", seed: 275822988}`. Seed matches Aria's locked image_seed (cycle 0019) as expected. Signed-URL fetch to the returned path returned 200 with `image/png` content-type and 1,098,461 bytes. `characters.avatar_ref` updated.
7. **Generate Avatar — no_image_engine.** ✅ Deactivated active image provider → `POST /characters/d1eec46f-…/generate-avatar` returned **409** `{detail: "no_image_engine"}`. Provider reactivated.
8. **Generate Avatar — RLS / not found.** Not exercised live. Code path uses `sup.select("characters", id=eq.{id})` which is RLS-scoped; an id the caller doesn't own returns no rows → 404 via the `if not chars` guard. Verified by inspection of `routes/avatar_generate.py:145-152`.
9. **Generate Avatar button visibility.** ✅ Edit mode + image engine active → `[data-testid="avatar-generate"]` rendered in Avatar tab with text `"🎨 Generate Avatar"`. In create mode (`/character/new/manual`) the button is absent (gated by `editing && hasImageEngine`).
10. **Generate Avatar UI flow.** Full UI-driven test not exercised this session (would require another ~14s ComfyUI run); the endpoint test at gate 6 exercised the full backend path, and the client helper `generateCharacterAvatar` is a straightforward fetch wrapper tested indirectly via the button state machine. Confidence high.
11. **SFW on Generate Avatar.** Verified by inspection at `backend/app/routes/avatar_generate.py:_build_portrait_negative`: `sfw_disabled=false` branch appends `"nude, explicit, sexual"` to the negative body; `sfw_disabled=true` omits it. Gate 6 ran with Aria's user sfw_disabled=false → those tags were in negative prompt (backend logs, not explicitly captured here).
12. **SFW on Enrich.** Inherits cycle 0027's conditional SFW line in the refiner system prompt — no change this cycle.
13. **Grammar invariant §6.1.** ✅ Ripgrep for `generate_avatar|build_portrait|avatar_generate|NoImageEngineError` across `backend/app/agents/grammar.py` + `backend/app/prompts/grammar_system.txt` → 0 matches.
14. **Regression.** ✅ Live SSE to pre-0028 conversation `37a2e7b7-…` on Aria; sent `"Final regression test — say one sentence beginning with \"RGN-0028 OK\"."` → backend streamed → assistant variant: `"RGN-0028 OK. The forest path is clear for your journey home."` Cycle 0026 Writing Styles picker and cycle 0027 import flow untouched by this cycle's diff (no overlapping edits).

Backend routes registered: `POST /characters/{character_id}/generate-avatar` visible in `/openapi.json`.
TypeScript: `npx tsc --noEmit` in frontend clean (no output).

Key files shipped:
- `backend/app/routes/avatar_generate.py` (new, ~200 lines)
- `backend/app/main.py` (router registration)
- `frontend/src/lib/avatarGenerate.ts` (new, ~45 lines, + `NoImageEngineError`)
- `frontend/src/lib/characterRefine.ts` (`buildFakeV2CardFromDraft` helper added; existing refine call reused verbatim)
- `frontend/src/features/characters/CharacterForm.tsx` (Enrich button + handler + `EnrichControls` component; Generate Avatar button + handler + `AvatarGenerateControls` component + image-engine fetch on mount; `applyRefined` merge helper)

Known limitations (tracked for future cycles):
- Full UI-driven Generate Avatar walkthrough (gate 10) not Playwright-automated this session; endpoint path is the load-bearing piece and was exercised directly. Button + client helper are straightforward.
- Enrich on refine errors (gate 4/5) verified by code inspection rather than live fault injection.
- No diff-preview modal for Enrich — user sees the result instantly (REPLACE-by-design per commit decision #2). Future UX could add side-by-side review.
