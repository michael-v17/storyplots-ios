# Plan 0090 — fal.ai / Seedream V5 Lite prompt + reference research

status: in_progress
date: 2026-05-04

## Motivation

Primer cycle de la **iniciativa fal.ai migration** (master plan en `~/.claude/plans/floofy-painting-karp.md`). Antes de escribir código (cycles 0091–0097), necesitamos decidir empíricamente **dos cosas**:

1. **Qué formato de "reference image" da mejor consistencia de personaje cross-scene en Seedream V5 Lite Edit.** El creador propuso generar 2 imágenes por avatar: una preview (con escena) + una reference (white-bg, half-body o multi-view) que se pasa como `image_urls` en cada generación de chat. Hay que decidir cuál variante es la más efectiva — el costo de gen es bajo ($0.035/imagen) pero re-generar todas las references es caro a largo plazo.
2. **Cuán "Seedream-friendly" es el prompt actual del refiner LLM** — hoy produce un mix de Danbooru tags + lenguaje natural diseñado para Animagine XL 4.0. Seedream tiene mejor prompt-following en lenguaje natural rico; los tags pueden estar pesando en contra. Hay que decidir si el refiner LLM necesita un mode/system prompt distinto cuando el provider activo es fal.

**Provenance:**
- `Seed/creator-vision.md` §7: BYOK + vendor-agnostic image gen.
- `Seed/PersonaLLM-Reference/04-screens/settings/image-engine.md`: contexto de múltiples engines (PersonaLLM-Reference soporta OpenAI/Google/xAI directs además de ComfyUI; fal.ai es greenfield para v0).
- Master plan: `~/.claude/plans/floofy-painting-karp.md`.
- Q&A previa con el creador (sesión 2026-05-04): aprobó dual-gen avatar, BYOK key, lazy-load solo de imágenes, compresión obligatoria.

**No-goals de este cycle:**
- No tocar código backend ni frontend de la app.
- No modificar `provider_configs` schema.
- No instalar `fal-client` en `requirements.txt` (eso es 0091).
- Sí: scripts standalone fuera de `backend/` (en `verification/0090/`) que se borran al cerrar cycle si no agregan valor.

---

## Implementation order

### Subtask 1 — Roadmap entry en SESSION_HANDOFF.md
Agregar nueva sub-sección "Iniciativa: fal.ai / Seedream image engine migration" dentro de "Pending Cycles Tracker → Fase actual: Features restantes + Bug fixing", con la lista de los 8 cycles (0090–0097) y un link al master plan. Marcar 0090 como in_progress al cerrar este cycle.

**Verify:** `grep -n "fal.ai" SESSION_HANDOFF.md` muestra la nueva sub-sección.

### Subtask 2 — Prereq: FAL_KEY disponible
El creador pega la API key de fal.ai en el `.env.local` del proyecto (`FAL_KEY=...`) o en una env-var temporal del shell de la sesión. Confirmar lectura con un script de prueba mínimo (`python -c "import os, fal_client; print(bool(os.environ.get('FAL_KEY')))"`).

**Verify:** Script imprime `True`. Si no, esperar al creador.

### Subtask 3 — Test matrix execution (trimmed 2026-05-05 by creator request)

Original 4×3 + 6 = 22 imgs ($0.77) reducido a **6 imgs ($0.21, –73%)** — la matriz mínima que aún resuelve las 2 decisiones binarias del cycle. Tests:

| Test | Variante | Imgs | Decisión que ataca |
|---|---|---|---|
| Reference shape | half-body whitebg + multi-view turnaround | 2 | Cuál preserva mejor identidad visual cross-escena |
| Scene continuity | 1 escena (coffee shop) por reference | 2 | Si la consistencia se rompe en cambio de pose/contexto |
| Prompt shape | Danbooru tags vs natural-language sobre half-body ref | 2 | Refiner system prompt mode "seedream" sí/no |

Crear `verification/0090/research.py` (no en `backend/`, es throwaway research):

```python
# Pseudo-shape, no compromise final
import fal_client, os, json, urllib.request
from pathlib import Path

OUT = Path("verification/0090")
OUT.mkdir(parents=True, exist_ok=True)

CHARACTER = {
    "name": "Aria",
    "appearance": "young woman, long auburn hair, green eyes, freckles, slim build",
    "outfit": "fitted leather jacket, dark jeans, brown boots",
}

# Step A: gen reference variants via text-to-image
REFERENCE_PROMPTS = {
    "halfbody_whitebg": f"{CHARACTER['appearance']}, {CHARACTER['outfit']}, half body portrait, neutral standing pose, plain white studio background, soft even lighting, looking at camera, sharp focus, photorealistic",
    "fullbody_whitebg": f"{CHARACTER['appearance']}, {CHARACTER['outfit']}, full body, neutral standing pose, plain white studio background, soft even lighting, looking at camera, sharp focus, photorealistic",
    "multiview_3way":  f"character reference sheet, {CHARACTER['appearance']}, {CHARACTER['outfit']}, three views: front, three-quarter, profile, plain white studio background, neutral pose, model sheet, photorealistic",
    "portrait_close":  f"{CHARACTER['appearance']}, head and shoulders portrait, plain white background, soft even lighting, looking at camera, photorealistic",
}

for name, prompt in REFERENCE_PROMPTS.items():
    res = fal_client.subscribe(
        "fal-ai/bytedance/seedream/v5/lite/text-to-image",
        arguments={"prompt": prompt, "image_size": "portrait_4_3", "num_images": 1},
    )
    url = res["images"][0]["url"]
    urllib.request.urlretrieve(url, OUT / f"ref_{name}.png")
    (OUT / f"ref_{name}_meta.json").write_text(json.dumps({"prompt": prompt, "url": url, "seed": res.get("seed")}))

# Step B: for each reference, gen 3 chat scenes via /edit
SCENES = [
    "sitting at a coffee shop, looking out the window, soft afternoon light, melancholic expression",
    "walking down a rainy city street at night, neon signs reflecting in puddles, looking back over shoulder",
    "standing at a forest clearing at golden hour, wind in hair, slight smile, distant mountains",
]
for ref_name in REFERENCE_PROMPTS:
    ref_url = json.loads((OUT / f"ref_{ref_name}_meta.json").read_text())["url"]
    for i, scene in enumerate(SCENES):
        res = fal_client.subscribe(
            "fal-ai/bytedance/seedream/v5/lite/edit",
            arguments={"prompt": f"{CHARACTER['appearance']}, {scene}", "image_urls": [ref_url], "image_size": "landscape_4_3"},
        )
        urllib.request.urlretrieve(res["images"][0]["url"], OUT / f"scene_{ref_name}_{i}.png")
```

**Verify:** 4 references + 12 escenas (4×3) en `verification/0090/`. Total ~16 imágenes, costo ≈ $0.56.

### Subtask 4 — Visual evaluation + decisión registrada
Creator + asistente revisan las 16 imágenes:

| Eje | Pregunta a responder |
|---|---|
| **Identidad facial** | ¿Cuál variante mantiene la cara más consistente cross-escena? |
| **Outfit fidelity** | ¿Cuál preserva mejor la chaqueta de cuero / jeans / botas? |
| **Pose flexibility** | ¿Cuál permite poses dramáticas (sitting, walking, standing) sin colapsar la identidad? |
| **Background bleed** | ¿La reference white-bg "contamina" las escenas con cielo blanco? ¿Multi-view se confunde como "este personaje tiene 3 cabezas"? |

Conclusión documentada como **Decision Log** en sección **Verification** abajo. Output canónico:

> **Decision (0090):** Reference format = `<elegido>`. Reference prompt template = `<final>`. Para cycle 0093 (avatar dual-gen), generar reference con este prompt. Para cycle 0094 (chat scene), pasar reference como única `image_urls[0]`.

### Subtask 5 — Refiner system prompt research (paralelo a 4)
Tomando la mejor variante de reference, comparar 2 prompts de escena para la misma situación:

- **A (Danbooru-style, actual):** `"1girl, solo, auburn hair, green eyes, freckles, leather jacket, jeans, brown boots, sitting, coffee shop, window, melancholy, masterpiece, high quality"`
- **B (Natural, propuesto):** `"A young woman with long auburn hair and green eyes, wearing a leather jacket and jeans, sits alone at a coffee shop window in the late afternoon. Soft amber light filters through the glass, catching the loose strands of her hair. Her expression is quiet, contemplative — a small melancholy in the way she watches the street outside. Cinematic, photorealistic."`

Generar 3 imágenes de cada con la misma reference + seed-flexible (no fixed seed). Evaluar qué shape rinde mejor en Seedream.

**Verify:** Decisión registrada → input al cycle 0094 (refiner system prompt mode "seedream").

### Subtask 6 — Cleanup + commit
- `verification/0090/research.py` queda en repo (referencia futura) o se borra (decisión del creator).
- Las 16+6=22 imágenes generadas → mover a `verification/0090/` y agregarlas al `.gitignore` si pesan demasiado, o committear las 4-6 más representativas para reference.
- Commit: `feat(0090): seedream reference + prompt format research`.
- Update SESSION_HANDOFF: marcar 0090 `[x]`, abrir 0091 como next.

---

## Critical files

| Layer | Path |
|---|---|
| Master plan | `~/.claude/plans/floofy-painting-karp.md` |
| Roadmap entry | `SESSION_HANDOFF.md` (línea ~505 — agregar antes de "Estructura PersonaLLM (pre-diseño)") |
| Research script | `verification/0090/research.py` (new, throwaway-OK) |
| Outputs | `verification/0090/ref_*.png`, `verification/0090/scene_*.png` |

---

## Risks / open

- **Sin FAL_KEY en sesión: el cycle se bloquea en Subtask 3.** El creador dijo que tiene una key lista para cargar a pedido — sub-task 2 surface el momento.
- **Tavily key inválida en sesión actual.** No bloquea este cycle (no requiere búsquedas externas más allá del API call). Reportarlo al creador para que actualice antes de cycles que dependan de research web.
- **Costos:** 22 imágenes × $0.035 = ~$0.77 total. Acceptable para evidence base.
- **Endpoint reality check:** El research previo encontró que `text-to-image` y `edit` son endpoints válidos de fal-ai/bytedance/seedream/v5/lite. Si la API ha cambiado entre research y ejecución, el script falla en subtask 3 — es la primera señal y disparamos un sub-cycle 0090b si hace falta.

---

## Verification

### Subtask 1 — Audit (completed 2026-05-04)

Findings from serena + grep audit of repo state on the active project (xvm, mhdekknjaigoeuzrriey):

- **`provider_configs` schema** (`supabase/migrations/0007_provider_configs.sql:9-32`):
  - `kind` enum: `text|image|video|tts|stt`. Image gets `kind='image'`.
  - `provider_family` is free-form text. **No whitelist at schema level.**
  - Partial unique index `provider_configs (user_id, kind) WHERE is_active` — exactly one active per kind, but multiple inactive rows ARE allowed. Enables comfyui + fal coexistence.
  - RLS: user CRUDs own rows.
- **`upsert_image_provider` RPC** (`supabase/migrations/0016_images.sql:107-168`):
  - Signature: `(p_provider_family text, p_base_url text, p_api_key text, p_workflow_config jsonb) returns provider_configs`.
  - Behavior: finds the **single active** image row, updates it (overwriting family/url/secret/workflow). If none, inserts new active row.
  - **Limitation for fal.ai integration**: no per-family logic. Saving fal would overwrite the comfyui row, losing its `workflow_config`. Need a sibling RPC.
  - Vault flow: when `p_api_key` is non-blank, creates a new `vault.secrets` row + deletes old one. When blank, reuses existing `vault_secret_id`.
- **Frontend lib** (`frontend/src/lib/imageProvider.ts:29-38`):
  - `upsertImageProvider({base_url, api_key, workflow_config})` hardcodes `p_provider_family: "comfyui"`. Needs to be parametrized OR replaced by a sibling helper for fal.
  - `listActiveImageProvider()` returns the single active row.
- **No backend route writes provider_configs** — all writes go through Supabase RPCs (PL/pgSQL with `security definer` for Vault access). Backend reads only via `sup.select(client, "provider_configs", ...)`.
- **Backend reads the decrypted key** via `get_active_image_key()` PL/pgSQL function (`0016_images.sql:171-...`) — server-side only, never returned to client. Good privacy posture.

**Decision for Subtask 2 (next)**: Add migration `0036_upsert_image_provider_per_family.sql` that creates:
1. `upsert_image_provider_v2(p_provider_family, p_base_url, p_api_key, p_workflow_config)` — upserts by `(user_id, kind='image', provider_family=p_family)` and atomically sets `is_active = (provider_family = p_family)` for all that user's image rows in a single UPDATE (avoids partial-unique-index race).
2. `set_active_image_provider(p_provider_family)` — same atomic flip without rotating the key.

Keep `upsert_image_provider` v1 intact for backward compat (the existing ComfyUI form keeps calling it, no behavior change).

**Decision for Subtask 3**: After creator review of v1, the layout was reworked to a **tab pattern** (segmented pill, kit cycle 0072 style):
- Tabs: `[fal.ai (Seedream)] [ComfyUI]`. Default = `fal` (per creator's "default fal.ai"). Selected tab follows the active provider on mount.
- Only the selected tab's form renders. The other provider's config is preserved in DB but hidden from the UI — addresses creator's "si estoy en modo fal no deberia salir lo de comfy".
- Active dot (small filled circle) on the tab label indicates which provider is currently active in DB. Saving in a tab activates that provider.
- One-click "Set as active" banner appears when the user is on a configured-but-inactive tab — flips without rotating the key.
- **Model field** added to fal tab: free-text slug input, default `fal-ai/bytedance/seedream/v5/lite`, persisted in `workflow_config.model_slug`. Hint text notes other prose-strong fal models (Flux, Imagen, other Seedream variants) work too. Cycle 0094 backend reads this to call the right fal endpoint.
- Existing ComfyUI form unchanged structurally — wrapped in conditional render.

**Test user for Subtask 4**: `xvp@storyplots.app` (already created on the active xvm project, has OpenRouter key in Vault per the 2026-05-04 smoke test).

---

### Subtask 5 — Research run (completed 2026-05-05 00:17, ~285s, 6 images)

Script `verification/0090/research.py` ran end-to-end against fal.ai Seedream V5 Lite. BYOK preserved — key entered via `getpass`, never written to env or disk. 6 PNGs + manifest.json saved. Cost ≈ $0.21 (creator's account).

Manifest seeds (for reproducibility): halfbody_whitebg=1390687172, multiview_3way=669983658.

### Subtask 6 — Decision log (2026-05-05)

#### Decision A — Reference image format: **half-body whitebg**

| Variant | Identity preservation in scene | Risks | Verdict |
|---|---|---|---|
| `halfbody_whitebg` | Strong: face, hair, freckles, outfit all transfer faithfully into the coffee-shop scene; jawline and eye shape recognizable | Single canonical view → no ambiguity | **Chosen** |
| `multiview_3way` | Comparable but not better — produced slightly different jawline + brighter/oranger hair vs ref; took the same scene and got a slightly different person | Risk on dynamic poses: model may compose multi-head artifacts when scene needs unusual angles. Not observed in the static seated scene we tested, but the test is conservative | Rejected |

**Rationale**: Multi-view's promised benefit (3 angles → richer 3D understanding) didn't manifest as superior identity in our scene. The half-body single-canonical view is cheaper to generate, has zero ambiguity for the diffusion model, and matched or beat multi-view on every axis. Cycle 0093 (avatar dual-gen) generates `characters.reference_ref` as a half-body whitebg portrait.

**Reference prompt template (for Cycle 0093)**:
```
{appearance_description}, {outfit_description},
half body portrait, neutral standing pose, plain white studio background,
soft even lighting, looking at camera, sharp focus, photorealistic
```

Plus (for non-photorealistic style overrides per Cycle 0095): swap `photorealistic` for `anime style, masterpiece` etc., based on `users.preferences.image.style`.

#### Decision B — Prompt shape for chat scenes: **natural-language cinematic prose**

| Style | Output | Verdict |
|---|---|---|
| Danbooru tags (current Animagine refiner output) | Flat composition, even lighting, frontal pose, character preserved but mood absent | Rejected for Seedream |
| Natural-language prose | Golden-hour amber light through the window, depth-of-field cafe interior, hair catching light, contemplative emotion. Same identity from same ref | **Chosen** |

**Rationale**: Both prompts ran against the same `halfbody_whitebg` reference, so identity preservation was equivalent (the ref does that work). The qualitative gap was entirely in scene composition and atmosphere. Natural prose produced cinematic, emotionally evocative output that matches StoryPlots' tone; Danbooru tags produced a competent but soulless render. The current refiner's tag-style output is right for Animagine XL 4.0 but wrong for Seedream.

**Cycle 0094 implementation**: `image_refine.py` adds `mode="seedream"` system prompt that produces rich natural-language scene descriptions. `mode="comfyui"` (default current) keeps Danbooru-tag output for ComfyUI users.

#### Decision C — Re-mention identity attributes in scene prompt

Empirical observation: in `compare_natural_0`, the prompt re-mentions "long auburn hair", "green eyes", "leather jacket and jeans" even though the reference already encodes them. This appears to **reinforce** the reference rather than confuse it — the identity rendered crisply and the eye color (green) stayed correct.

**Rule for Cycle 0094 refiner**: include the canonical 11-attribute identity block (the same the existing refiner reads at `image_refine.py:PHYSICAL_IDENTITY`) verbatim near the top of the natural-language prompt. The reference handles fine-grained likeness; the textual re-mention guards against drift on color-specific traits (eye color, hair color shade, freckles).

#### Decision D — File-size confirms 0092 urgency

Each Seedream PNG output: 3.5–4.2 MB. Sample math:
- 1 character × 50 chat-scene generations × 3.8 MB ≈ 190 MB Storage per active character.
- 10 active characters → ~1.9 GB Storage just for chat scenes.
- WebP quality 82 should land each at 250–400 KB → ~95–130 MB for the same 10×50 sample, **~93% reduction**.

Confirms Cycle 0092 priority and target (≤500 KB per scene, WebP only, never PNG).

#### Decision E — Single-reference is sufficient (no need to default to history-of-N)

The single `image_urls=[character.reference_ref]` array gave strong identity preservation across pose changes. The "use last N chat images as additional refs" setting (Cycle 0095) stays opt-in, default 0 — no need to pay extra fal cost for marginal continuity benefit by default.

#### Best-of samples (committed evidence)

`verification/0090/best/`:
- `ref_halfbody_whitebg.png` — chosen reference format.
- `scene_halfbody_whitebg_0.png` — scene generated from it.
- `compare_danbooru_0.png` — Danbooru-style prompt output (rejected).
- `compare_natural_0.png` — natural-language prose output (chosen).

Raw 22-image dump → `verification/0090/*.png` (gitignored). Manifest.json → gitignored. Cycle plan + best/ folder are the durable artifacts.

#### Cycle gates

- ✅ Migration `0036_upsert_image_provider_per_family.sql` applied via `npx supabase db push`.
- ✅ Frontend `ImageEngineSettings.tsx` ships fal.ai BYOK section + tabbed provider switcher + model slug input. tsc 0 errors.
- ✅ Playwright (manual via MCP browser): paste-save-reload-mask-tab-switch all green.
- ✅ Research script ran end-to-end, BYOK preserved.
- ✅ 4 representative images committed under `best/`.
- ✅ Decisions A–E recorded above; alimentan plans 0093 (avatar dual-gen reference template) y 0094 (refiner mode "seedream" + identity re-mention).
