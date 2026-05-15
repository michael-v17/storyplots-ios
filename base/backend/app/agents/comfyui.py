"""ComfyUI API client.

The workflow_config on provider_configs is the API-format JSON exported
from ComfyUI (Save (API Format)). Rather than requiring the user to
rename nodes to specific titles, we auto-detect by topology:

  - `sampler`  = the one node with class_type KSampler (or KSamplerAdvanced)
  - `positive` = the CLIPTextEncode wired into sampler.inputs.positive
  - `negative` = the CLIPTextEncode wired into sampler.inputs.negative

Title-based matching ("positive"/"negative"/"sampler") is still honored as
an override for workflows that deliberately name nodes that way.

"""

from __future__ import annotations

import asyncio
from typing import Any

import httpx


class ComfyWorkflowShapeError(ValueError):
    """Raised when the user-supplied workflow cannot be resolved to sampler + pos + neg."""


# Explicit SFW guardrail tokens appended to ComfyUI negative when the user has
# SFW mode ON (preferences.sfw_disabled = False). Removed when the user opts
# into NSFW. This is the diffusion-side mirror of the SFW guardrail at the
# chat layer; both must be in place for SFW to actually hold.
SFW_IMAGE_NEGATIVE_TOKENS = (
    "nsfw, nude, naked, lewd, explicit, sexual, erotic, sexy pose, "
    "revealing clothes, see-through, cleavage, underwear, lingerie, "
    "panties, pantyshot, bare chest, bare shoulders, exposed midriff, "
    "partially nude, suggestive"
)


def append_sfw_negative(final_negative: str, sfw_disabled: bool) -> str:
    """Append SFW guardrail tokens to a ComfyUI negative prompt when the user
    has NOT disabled SFW mode. Idempotent — safe to call once after building
    the wrapped negative; if the tokens are already present, returns the
    string unchanged."""
    if sfw_disabled:
        return final_negative
    if SFW_IMAGE_NEGATIVE_TOKENS in final_negative:
        return final_negative
    base = final_negative.rstrip().rstrip(",").rstrip()
    if not base:
        return SFW_IMAGE_NEGATIVE_TOKENS
    return f"{base}, {SFW_IMAGE_NEGATIVE_TOKENS}"


def _resolve_node_ids(workflow: dict[str, Any]) -> tuple[str, str, str]:
    """Return (sampler_id, positive_id, negative_id). Prefers explicit _meta
    titles `sampler`/`positive`/`negative`; falls back to class_type +
    topology traversal.
    """
    # 1. Explicit title wins.
    by_title: dict[str, str] = {}
    for node_id, node in workflow.items():
        if not isinstance(node, dict):
            continue
        title = str((node.get("_meta") or {}).get("title") or "").strip().lower()
        if title in ("sampler", "positive", "negative") and title not in by_title:
            by_title[title] = node_id
    if "sampler" in by_title and "positive" in by_title and "negative" in by_title:
        return by_title["sampler"], by_title["positive"], by_title["negative"]

    # 2. Find KSampler / KSamplerAdvanced nodes. v0 supports single-stage
    # workflows only: multiple KSamplers (e.g. SDXL base+refiner, hires-fix)
    # need explicit titles on the node the caller wants us to patch.
    sampler_ids = [
        node_id for node_id, node in workflow.items()
        if isinstance(node, dict) and str(node.get("class_type") or "").startswith("KSampler")
    ]
    if not sampler_ids:
        raise ComfyWorkflowShapeError("workflow has no KSampler node")
    if len(sampler_ids) > 1:
        raise ComfyWorkflowShapeError(
            f"workflow has {len(sampler_ids)} KSampler nodes; v0 supports single-stage "
            "workflows only. Label the sampler you want patched with "
            "_meta.title = \"sampler\" (and its CLIP encoders with \"positive\"/\"negative\") "
            "to disambiguate."
        )
    sampler_id = sampler_ids[0]

    sampler_inputs = (workflow[sampler_id].get("inputs") or {})
    pos_ref = sampler_inputs.get("positive")
    neg_ref = sampler_inputs.get("negative")
    if not isinstance(pos_ref, list) or not isinstance(neg_ref, list):
        raise ComfyWorkflowShapeError(
            "KSampler has no positive/negative input wires; either label nodes "
            "titled 'positive' and 'negative' or connect them to the sampler."
        )
    positive_id = str(pos_ref[0])
    negative_id = str(neg_ref[0])
    if positive_id not in workflow or negative_id not in workflow:
        raise ComfyWorkflowShapeError("positive/negative refs point at missing nodes")

    # Assert both resolved refs are text encoders we can patch by the `text`
    # input. ConditioningConcat / ConditioningSetTimestepRange / etc. would
    # silently no-op in _patch_workflow — fail loud instead.
    for role, nid in (("positive", positive_id), ("negative", negative_id)):
        cls = str(workflow[nid].get("class_type") or "")
        if cls != "CLIPTextEncode":
            raise ComfyWorkflowShapeError(
                f"workflow's {role} node (id={nid}) is {cls or 'unknown'}, not "
                f"CLIPTextEncode. Wire the sampler's {role} directly to a "
                "CLIPTextEncode, or label the encoder _meta.title = "
                f"\"{role}\" to override."
            )
    return sampler_id, positive_id, negative_id


def _resolve_latent_id(workflow: dict[str, Any]) -> str | None:
    """First EmptyLatentImage (or SDXLEmptyLatentImage) node, or None."""
    for node_id, node in workflow.items():
        if not isinstance(node, dict):
            continue
        cls = str(node.get("class_type") or "")
        if cls in ("EmptyLatentImage", "SDXLEmptyLatentImage", "EmptySD3LatentImage"):
            return node_id
    return None


def _resolve_checkpoint_id(workflow: dict[str, Any]) -> str | None:
    """The single CheckpointLoaderSimple node id, or None. Raises when the
    workflow has more than one loader — the user's override is ambiguous in
    that case (base + refiner SDXL pairs, ControlNet-loaded secondaries),
    mirroring the KSampler disambiguation gate.
    """
    ids = [
        node_id for node_id, node in workflow.items()
        if isinstance(node, dict)
        and str(node.get("class_type") or "") == "CheckpointLoaderSimple"
    ]
    if not ids:
        return None
    if len(ids) > 1:
        raise ComfyWorkflowShapeError(
            f"workflow has {len(ids)} CheckpointLoaderSimple nodes; the "
            "checkpoint override cannot target more than one. Clear the "
            "override or simplify the workflow to a single checkpoint loader."
        )
    return ids[0]


def _patch_workflow(
    workflow: dict[str, Any],
    positive: str,
    negative: str,
    seed: int,
    width: int | None = None,
    height: int | None = None,
    checkpoint: str | None = None,
) -> dict[str, Any]:
    """Return a shallow copy of the workflow with positive/negative/seed patched.

    When `width`/`height` are provided, also patches the first
    EmptyLatentImage node so the generated image comes out at the
    requested resolution. Workflows without a latent node (e.g. img2img)
    are left untouched — the caller's workflow decides the shape.

    When `checkpoint` is a non-empty string, patches the first
    CheckpointLoaderSimple node's `ckpt_name`. Blank / None leaves the
    JSON's baked model untouched.
    """
    sampler_id, positive_id, negative_id = _resolve_node_ids(workflow)
    latent_id = _resolve_latent_id(workflow) if (width and height) else None
    ckpt_override = (checkpoint or "").strip()
    ckpt_id = _resolve_checkpoint_id(workflow) if ckpt_override else None
    out: dict[str, Any] = {}
    for node_id, node in workflow.items():
        if not isinstance(node, dict):
            out[node_id] = node
            continue
        node_copy = dict(node)
        inputs = dict(node_copy.get("inputs") or {})
        if node_id == positive_id and "text" in inputs:
            inputs["text"] = positive
        elif node_id == negative_id and "text" in inputs:
            inputs["text"] = negative
        elif node_id == sampler_id and "seed" in inputs:
            inputs["seed"] = seed
        elif latent_id is not None and node_id == latent_id:
            if "width" in inputs: inputs["width"] = width
            if "height" in inputs: inputs["height"] = height
        elif ckpt_id is not None and node_id == ckpt_id and "ckpt_name" in inputs:
            inputs["ckpt_name"] = ckpt_override
        node_copy["inputs"] = inputs
        out[node_id] = node_copy
    return out


def _extract_error_message(status: dict[str, Any]) -> str | None:
    """Pull the most useful error string from a ComfyUI `/history` status
    block. ComfyUI puts node-level errors into `messages` as tuples like
    `("execution_error", {..., "exception_message": "...", "node_type": "..."})`.
    """
    messages = status.get("messages") or []
    for m in messages:
        if isinstance(m, (list, tuple)) and len(m) == 2 and m[0] == "execution_error":
            detail = m[1] if isinstance(m[1], dict) else {}
            msg = detail.get("exception_message") or ""
            node = detail.get("node_type") or ""
            if msg:
                msg = msg.strip()
                return f"{node}: {msg}" if node else msg
    return None


async def system_stats(base_url: str, api_key: str | None) -> dict:
    """Lightweight reachability + health probe for Test Connection."""
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    url = base_url.rstrip("/") + "/system_stats"
    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            return {"ok": False, "status": resp.status_code, "error": resp.text[:300]}
        return {"ok": True, "stats": resp.json()}


async def submit_and_wait(
    base_url: str,
    api_key: str | None,
    workflow: dict[str, Any],
    positive: str,
    negative: str,
    seed: int,
    width: int | None = None,
    height: int | None = None,
    checkpoint: str | None = None,
    poll_timeout_s: float = 300.0,
) -> bytes:
    """Submit the workflow, poll until complete, return the first output image bytes.

    Raises RuntimeError on timeout or provider failure; ComfyWorkflowShapeError
    propagates if the workflow is missing one of the expected titled nodes.
    """
    patched = _patch_workflow(workflow, positive, negative, seed, width=width, height=height, checkpoint=checkpoint)
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    base = base_url.rstrip("/")
    # Short connect + long read: /history polls return immediately, but the
    # final /view download of a 2048-px SDXL image over LAN can run past 30s.
    timeouts = httpx.Timeout(connect=10.0, read=180.0, write=30.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeouts) as client:
        # 1. Submit.
        resp = await client.post(f"{base}/prompt", headers=headers, json={"prompt": patched})
        if resp.status_code != 200:
            raise RuntimeError(f"ComfyUI /prompt returned {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        prompt_id = data.get("prompt_id")
        if not prompt_id:
            raise RuntimeError(f"ComfyUI /prompt missing prompt_id: {data}")

        # 2. Poll /history until the job is complete.
        deadline = asyncio.get_running_loop().time() + poll_timeout_s
        outputs: dict | None = None
        while asyncio.get_running_loop().time() < deadline:
            h = await client.get(f"{base}/history/{prompt_id}", headers=headers)
            if h.status_code == 200:
                body = h.json()
                entry = body.get(prompt_id)
                if entry:
                    # Fail fast when the job errored server-side (node crash,
                    # VRAM overflow, missing checkpoint, tqdm OSError on
                    # Windows, etc). Without this the loop waits for
                    # `images` that never arrive until the 300 s deadline.
                    status = entry.get("status") or {}
                    if status.get("status_str") == "error":
                        reason = _extract_error_message(status) or "unknown error"
                        raise RuntimeError(f"ComfyUI execution error: {reason}")
                    outputs = entry.get("outputs") or {}
                    # Outputs appear when every node has finished. A successful
                    # job has at least one node with an `images` list.
                    if any(isinstance(v, dict) and v.get("images") for v in outputs.values()):
                        break
            await asyncio.sleep(1.0)
        if outputs is None or not any(isinstance(v, dict) and v.get("images") for v in outputs.values()):
            raise RuntimeError("ComfyUI job timed out before producing an image")

        # 3. Pull the first image.
        first_image = None
        for node_out in outputs.values():
            if isinstance(node_out, dict):
                imgs = node_out.get("images") or []
                if imgs:
                    first_image = imgs[0]
                    break
        if not first_image:
            raise RuntimeError("ComfyUI returned no image entries")

        filename = first_image.get("filename")
        subfolder = first_image.get("subfolder", "")
        type_ = first_image.get("type", "output")
        if not filename:
            raise RuntimeError("ComfyUI image entry missing filename")

        v = await client.get(
            f"{base}/view",
            headers=headers,
            params={"filename": filename, "subfolder": subfolder, "type": type_},
        )
        if v.status_code != 200:
            raise RuntimeError(f"ComfyUI /view returned {v.status_code}: {v.text[:300]}")
        return v.content
