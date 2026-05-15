"""Image generation: per-message ComfyUI run + provider test.

POST /messages/{message_id}/images   generate an image for this message
POST /providers/image/test           ComfyUI reachability probe

creator-vision.md §5.5 (ComfyUI + per-style workflows) + §7 (BYOK + vendor-
agnostic prompts) + §8 (SFW guardrail applies to generation too).

Flow for /messages/{id}/images:
  1. Load the message + parent conversation + owning character.
  2. Build the refinement context (last 3 turns + appearance when
     `append_appearance_to_image_prompts=true`).
  3. Run the image-refine agent (JSON-mode LLM). If it returns
     sfw_blocked=true, insert a generated_images row with
     sfw_blocked=true and return that — no ComfyUI call made.
  4. Patch + submit the active image provider's workflow, poll for
     output, fetch bytes.
  5. Upload bytes to generated-media/{uid}/{image_id}.png, update the
     row with storage_ref, and insert the inline_media link.
"""

from __future__ import annotations

import asyncio
import os
import random
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel

from pathlib import Path

from ..agents.comfyui import (
    ComfyWorkflowShapeError,
    append_sfw_negative,
    submit_and_wait,
    system_stats,
)
from ..agents.image_refine import ImageRefineCallConfig, ImageRefineResult, run_image_refine
from ..lib.image_compress import compress_for_storage
from ..lib.image_dispatch import gate_image_provider_family

_DEFAULT_REFINER_SYSTEM = (
    Path(__file__).parent.parent / "prompts" / "image_refine_system.txt"
).read_text().strip()
from ..deps.jwt import AuthUser, verify_supabase_jwt
from ..deps.supabase import UserSupabase

router = APIRouter()

SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

# 8 resolution presets exposed in Visual Roleplay settings.
_RESOLUTION_PRESETS: dict[str, tuple[int, int]] = {
    "square_1024":     (1024, 1024),
    "square_1408":     (1408, 1408),
    "portrait":        (1280, 1664),
    "landscape":       (1664, 1280),
    "tall_portrait":   (1088, 1920),
    "wide_landscape":  (1920, 1088),
    "ultra_tall":      (1024, 2048),
    "ultra_wide":      (2048, 1024),
}


def _preset_to_dims(preset: str | None) -> tuple[int, int, str]:
    """Return (w, h, resolved_preset). Accepts `custom_WxH` (e.g.
    `custom_1536x1024`). Unknown / blank falls back to square_1024.
    """
    if not preset:
        return (1024, 1024, "square_1024")
    if preset in _RESOLUTION_PRESETS:
        w, h = _RESOLUTION_PRESETS[preset]
        return (w, h, preset)
    if preset.startswith("custom_"):
        try:
            dims = preset[len("custom_"):]
            w_s, h_s = dims.split("x", 1)
            w, h = int(w_s), int(h_s)
            if 256 <= w <= 4096 and 256 <= h <= 4096:
                return (w, h, preset)
        except (ValueError, AttributeError):
            pass
    return (1024, 1024, "square_1024")


def _user_client(authorization: str) -> UserSupabase:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    if not SUPABASE_ANON_KEY:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "SUPABASE_ANON_KEY not configured")
    return UserSupabase(jwt=token.strip(), apikey=SUPABASE_ANON_KEY)


class TestImageResult(BaseModel):
    ok: bool
    status: int | None = None
    error: str | None = None


class GenerationOverrides(BaseModel):
    """Cycle 0047 — per-regen ephemeral overrides. Sent by the ImageViewer
    "Regenerate with…" button. Each field is optional; unset fields fall
    back to the user's saved `users.preferences.visual_roleplay.*` and
    `users.preferences.image.default_resolution_preset`. No DB writes to
    prefs — strictly per-call.
    """
    pov: str | None = None
    shot_framing: str | None = None
    resolution_preset: str | None = None
    # Cycle 0063 — editable positive prompt. When non-empty the refiner LLM
    # is skipped; the string is used verbatim as the refined_prompt (still
    # wrapped by _prompt_wrap downstream). Empty/None → refiner runs as
    # usual.
    prompt_override: str | None = None
    # Cycle 0097 — per-regen style override for fal chat scenes. When set,
    # this style drives the style suffix appended to the prompt for the
    # NEW variant only — the snapshot lands in generated_images.style so
    # variant nav can show side-by-side different styles. Ignored on the
    # ComfyUI path (the workflow's _prompt_wrap is the style mechanism
    # there). Accepts "realistic" | "anime" | "custom".
    style_override: str | None = None


@router.delete("/images/{image_id}")
async def delete_image(
    image_id: str,
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(..., alias="Authorization"),
) -> dict:
    del user
    sup = _user_client(authorization)
    async with httpx.AsyncClient(timeout=30.0) as client:
        rows = await sup.select(client, "generated_images", {
            "select": "id,storage_ref",
            "id": f"eq.{image_id}",
            "limit": "1",
        })
        if not rows:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "image not found")
        row = rows[0]
        # Cascade order: inline_media → generated_images → storage object.
        # Every step is RLS-scoped. Leftover storage orphans are harmless.
        try:
            await sup.delete(client, "inline_media", {"generated_image_id": f"eq.{image_id}"})
        except httpx.HTTPStatusError:
            pass
        await sup.delete(client, "generated_images", {"id": f"eq.{image_id}"})
        if row.get("storage_ref"):
            try:
                await sup.remove_object(client, "generated-media", row["storage_ref"])
            except httpx.HTTPStatusError:
                pass
    return {"ok": True}


@router.get("/providers/image/refiner-default")
async def refiner_default(
    user: AuthUser = Depends(verify_supabase_jwt),
) -> dict:
    del user
    return {"system_prompt": _DEFAULT_REFINER_SYSTEM}


@router.post("/providers/image/test")
async def test_image_provider(
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(..., alias="Authorization"),
) -> TestImageResult:
    del user
    sup = _user_client(authorization)
    async with httpx.AsyncClient(timeout=30.0) as client:
        providers = await sup.select(client, "provider_configs", {
            "select": "base_url",
            "kind": "eq.image",
            "is_active": "eq.true",
            "limit": "1",
        })
        if not providers:
            return TestImageResult(ok=False, error="no active image provider")
        base = providers[0].get("base_url") or ""
        api_key = await sup.rpc(client, "get_active_image_key")
    try:
        result = await system_stats(base, api_key)
        if result.get("ok"):
            return TestImageResult(ok=True)
        return TestImageResult(ok=False, status=result.get("status"), error=result.get("error"))
    except httpx.HTTPError as exc:
        return TestImageResult(ok=False, error=str(exc))


async def _load_context_for_message(
    client: httpx.AsyncClient,
    sup: UserSupabase,
    message_id: str,
) -> tuple[dict, dict, dict, list[dict], dict]:
    """Return (message, conversation, character, last_3_turns, user_row).

    Raises HTTPException(404) when anything is missing or not owned by caller.
    """
    msgs = await sup.select(client, "messages", {
        "select": "id,conversation_id,role,text,active_variant_id,created_at",
        "id": f"eq.{message_id}",
        "limit": "1",
    })
    if not msgs:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "message not found")
    message = msgs[0]
    if message["role"] != "assistant":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "images can only be generated from assistant messages")

    convs = await sup.select(client, "conversations", {
        "select": "id,user_id,character_id,character_snapshot,persona_id",
        "id": f"eq.{message['conversation_id']}",
        "limit": "1",
    })
    if not convs:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "conversation not found")
    conversation = convs[0]

    chars = await sup.select(client, "characters", {
        "select": "id,name,system_prompt,appearance_description,append_appearance_to_image_prompts,personality,goals,worldbuilding,scenario,age,gender,build,height,hair_color,hair_style,eye_color,skin_tone,distinctive_features,signature_style,voice_style,image_seed,group_size,group_members_description,reference_ref,avatar_style",
        "id": f"eq.{conversation['character_id']}",
        "limit": "1",
    })
    if not chars:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "character not found")
    character = chars[0]

    # Last 3 message pairs (up to 6 messages) ending at the target message.
    history = await sup.select(client, "messages", {
        "select": "id,role,text,active_variant_id,created_at",
        "conversation_id": f"eq.{conversation['id']}",
        "created_at": f"lte.{message['created_at']}",
        "order": "created_at.desc",
        "limit": "6",
    })
    history.reverse()

    assistant_variant_ids = [m["active_variant_id"] for m in history
                             if m["role"] == "assistant" and m.get("active_variant_id")]
    variant_content: dict[str, str] = {}
    if assistant_variant_ids:
        vs = await sup.select(client, "message_variants", {
            "select": "id,content",
            "id": f"in.({','.join(assistant_variant_ids)})",
        })
        variant_content = {v["id"]: v["content"] for v in vs}

    last_turns: list[dict[str, str]] = []
    for m in history:
        if m["role"] == "user":
            text = m.get("text") or ""
            if text:
                last_turns.append({"role": "user", "content": text})
        elif m["role"] == "assistant":
            active = m.get("active_variant_id")
            if active and active in variant_content:
                last_turns.append({"role": "assistant", "content": variant_content[active]})

    users = await sup.select(client, "users", {
        "select": "sfw_disabled,preferences",
        "id": f"eq.{conversation['user_id']}",
        "limit": "1",
    })
    user_row = users[0] if users else {}

    return message, conversation, character, last_turns, user_row


def _target_text(message: dict, last_turns: list[dict[str, str]]) -> str:
    # The assistant message's content lives in its active variant — already
    # materialized in last_turns because the loader included the target. The
    # target_message value for the refiner is the last assistant turn in
    # last_turns (which corresponds to `message`).
    for t in reversed(last_turns):
        if t["role"] == "assistant":
            return t["content"]
    return message.get("text") or ""


@router.post("/messages/{message_id}/images")
async def generate_image_for_message(
    message_id: str,
    overrides: GenerationOverrides | None = None,
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(..., alias="Authorization"),
) -> dict:
    sup = _user_client(authorization)

    async with httpx.AsyncClient(timeout=30.0) as client:
        message, conversation, character, last_turns, user_row = await _load_context_for_message(client, sup, message_id)

        # Active text provider drives both the Conversation Agent and the
        # image-prompt refiner (separate system prompt).
        text_providers = await sup.select(client, "provider_configs", {
            "select": "base_url,model_id",
            "kind": "eq.text",
            "is_active": "eq.true",
            "limit": "1",
        })
        if not text_providers:
            raise HTTPException(status.HTTP_409_CONFLICT, "no active text provider — configure one in Settings → Text Engine")
        text_provider = text_providers[0]
        text_api_key = await sup.rpc(client, "get_active_text_key")
        if not text_api_key:
            raise HTTPException(status.HTTP_409_CONFLICT, "active text provider has no stored key")

        prefs = user_row.get("preferences") or {}
        grammar_prefs = prefs.get("grammar") or {}
        refine_model = grammar_prefs.get("custom_model_id") or text_provider.get("model_id") or ""

        # Load per-Conversation overrides (resolution + provider).
        ccs_rows = await sup.select(client, "chat_controls_state", {
            "select": "image_provider_override_id,resolution_preset",
            "conversation_id": f"eq.{conversation['id']}",
            "limit": "1",
        })
        ccs = ccs_rows[0] if ccs_rows else {}

        # Resolve image provider: per-Conv override wins over the user's
        # active row. Override id must still satisfy RLS (own row).
        override_id = ccs.get("image_provider_override_id")
        if override_id:
            image_providers = await sup.select(client, "provider_configs", {
                "select": "base_url,workflow_config,provider_family",
                "id": f"eq.{override_id}",
                "kind": "eq.image",
                "limit": "1",
            })
        else:
            image_providers = await sup.select(client, "provider_configs", {
                "select": "base_url,workflow_config,provider_family",
                "kind": "eq.image",
                "is_active": "eq.true",
                "limit": "1",
            })
        if not image_providers:
            raise HTTPException(status.HTTP_409_CONFLICT, "no active image provider — configure ComfyUI in Settings → Image Engine")
        image_provider = image_providers[0]
        # Cycle 0091 — flag-gate non-comfyui families. fal.ai becomes
        # supported once Cycle 0094 wires FalProvider into the call below.
        gate_image_provider_family(image_provider)
        image_api_key = await sup.rpc(client, "get_active_image_key")

        # workflow_config holds the ComfyUI workflow + sidecar keys
        # (`_prompt_wrap`, `_refiner_system_prompt`). Normalized once so
        # downstream reads don't re-null-check.
        wf_raw = image_provider.get("workflow_config")
        workflow_raw: dict[str, Any] = wf_raw if isinstance(wf_raw, dict) else {}

        # Resolve resolution: per-regen override (cycle 0047) → per-Conv
        # override → user preference → default. The per-regen override is
        # ephemeral — sent in the POST body by the ImageViewer, not stored.
        image_prefs = prefs.get("image") if isinstance(prefs.get("image"), dict) else {}
        preset_pref = image_prefs.get("default_resolution_preset")
        override_preset = overrides.resolution_preset if overrides else None
        preset_effective = override_preset or ccs.get("resolution_preset") or preset_pref
        width, height, resolved_preset = _preset_to_dims(preset_effective)

        # 2. Refinement.
        appearance = character.get("appearance_description")
        include_appearance = bool(character.get("append_appearance_to_image_prompts"))
        target = _target_text(message, last_turns)
        sfw = not bool(user_row.get("sfw_disabled", False))

        # Per-user override for the refiner's system prompt, stashed in
        # workflow_config._refiner_system_prompt (editable in Settings →
        # Image Engine). Empty / missing → fall back to the file
        # default. For fal/Seedream the file default is the prose-style
        # system prompt (Cycle 0090 Decisions B + C); for ComfyUI it's
        # the Danbooru-tag style baked into image_refine_system.txt.
        provider_family = (image_provider.get("provider_family") or "comfyui").lower()
        refiner_override = None
        candidate = workflow_raw.get("_refiner_system_prompt")
        if isinstance(candidate, str) and candidate.strip():
            refiner_override = candidate
        elif provider_family == "fal":
            # Cycle 0094 — natural-language cinematic prose default for fal.
            refiner_override = (
                Path(__file__).parent.parent / "prompts" / "image_refine_system_seedream.txt"
            ).read_text().strip()

        refine_cfg = ImageRefineCallConfig(
            base_url=text_provider.get("base_url") or "",
            api_key=text_api_key,
            model=refine_model,
            system_prompt_override=refiner_override,
        )
        # Build character_context in layered order:
        # 1. Structured physical identity (cycle 0018) — highest signal.
        #    PHYSICAL_IDENTITY is what the reference image already anchors
        #    visually (face / build / complexion / marks); the refiner
        #    re-mentions it per the seedream system prompt's identity
        #    re-mention rule.
        # 2. Wardrobe baseline (cycle 0135) — `signature_style` lifted into
        #    its own labeled block. The refiner uses it as the default
        #    outfit when the chat moment has no wardrobe signal of its
        #    own; it is NOT identity, so the seedream system prompt's
        #    REFERENCE IMAGE SEMANTICS section can give it lower priority
        #    than recent_turns and skip it entirely when narration
        #    contradicts it.
        # 3. Appearance notes — free-form `appearance_description` (legacy
        #    cycle 0014 era); supplementary detail.
        # 4. System prompt + personality / goals / worldbuilding —
        #    personality.
        # 5. Scenario.
        # recent_turns (passed separately to the refiner) override the
        # wardrobe baseline when the scene mentions different attire or
        # state — the priority is encoded in the seedream system prompt
        # (cycle 0135 made it explicit; before that it was implicit via
        # `appearance_description` mixing identity and wardrobe).
        context_parts: list[str] = []

        # Cycle 0135 — `signature_style` is split out of PHYSICAL_IDENTITY
        # so the refiner can tell physical traits (anchored by the
        # reference image) from default wardrobe (overridable per scene).
        ident_parts: list[str] = []
        for key in ("age", "gender", "build", "height",
                    "hair_color", "hair_style", "eye_color", "skin_tone",
                    "distinctive_features", "voice_style"):
            v = character.get(key)
            if isinstance(v, str) and v.strip():
                ident_parts.append(f"- {key.replace('_', ' ')}: {v.strip()}")
        if ident_parts:
            context_parts.append("PHYSICAL_IDENTITY:\n" + "\n".join(ident_parts))

        signature_style = character.get("signature_style")
        if isinstance(signature_style, str) and signature_style.strip():
            context_parts.append(
                f"WARDROBE_BASELINE:\n{signature_style.strip()}"
            )

        if character.get("appearance_description"):
            context_parts.append(
                f"APPEARANCE_NOTES:\n{character['appearance_description']}"
            )

        if character.get("system_prompt"):
            context_parts.append(f"SYSTEM_PROMPT:\n{character['system_prompt']}")
        for key in ("personality", "goals", "worldbuilding"):
            group = character.get(key)
            if isinstance(group, dict):
                body = "\n".join(f"- {k.replace('_', ' ')}: {v.strip()}"
                                  for k, v in group.items()
                                  if isinstance(v, str) and v.strip())
                if body:
                    context_parts.append(f"{key.upper()}:\n{body}")
        if character.get("scenario"):
            context_parts.append(f"SCENARIO:\n{character['scenario']}")

        # Cycle 0079 — group character: replace per-field PHYSICAL_IDENTITY block
        # with a GROUP_MEMBERS block so the refiner sees structured multi-subject data.
        # Cycle 0135 — also drop the new WARDROBE_BASELINE block for groups;
        # a multi-subject row has no single signature_style and the group
        # members' attire lives inside group_members_description.
        group_size = int(character.get("group_size") or 1)
        group_members_text = (character.get("group_members_description") or "").strip()
        if group_size > 1 and group_members_text:
            context_parts = [
                p for p in context_parts
                if not p.startswith(("PHYSICAL_IDENTITY:", "WARDROBE_BASELINE:"))
            ]
            context_parts.insert(0, f"GROUP_MEMBERS:\n{group_members_text}")

        character_context = "\n\n".join(context_parts) if context_parts else None

        # Cycle 0040: user can configure the refiner behavior in Settings →
        # Image Engine. `enabled=false` bypasses the LLM refine pass; the
        # target scene description flows straight into the workflow (wrapped
        # by `_prompt_wrap` later). `context_messages` clamps how many
        # recent user+assistant turns get fed to the refiner.
        #
        # SFW override: when SFW mode is ON (sfw=True, i.e. `sfw_disabled`
        # is False) we force the refiner to run regardless of the user's
        # `enabled` toggle — the refiner LLM performs a semantic SFW check
        # (sfw_blocked), and bypassing it would leave only the diffusion
        # negative tags, which don't parse prompt intent. Safety-first per
        # creator-vision.md §8.
        refine_prefs_raw = prefs.get("image_refine")
        refine_prefs = refine_prefs_raw if isinstance(refine_prefs_raw, dict) else {}
        refine_enabled_pref = refine_prefs.get("enabled", True) is not False
        refine_enabled = refine_enabled_pref or sfw
        ctx_raw = refine_prefs.get("context_messages")
        ctx_msgs = int(ctx_raw) if isinstance(ctx_raw, int) else 3
        ctx_msgs = max(0, min(10, ctx_msgs))
        clipped_turns = last_turns[:-1] if last_turns and last_turns[-1]["role"] == "assistant" else last_turns
        if ctx_msgs == 0:
            clipped_turns = []
        elif len(clipped_turns) > ctx_msgs * 2:
            clipped_turns = clipped_turns[-(ctx_msgs * 2):]

        # Cycle 0041: for POV=third_person, load the user's Persona and pass
        # it + the POV to the refiner so it can compose a two-subject prompt
        # with escaped-parens syntax (Seaart convention). First-person leaves
        # user_persona at None — the refiner stays single-subject.
        vr_prefs_raw = prefs.get("visual_roleplay") if isinstance(prefs.get("visual_roleplay"), dict) else {}
        # Cycle 0047 — per-regen overrides (ephemeral). When present, they
        # win over the saved prefs for THIS call only; no DB writes.
        override_pov = overrides.pov if overrides else None
        override_shot = overrides.shot_framing if overrides else None
        pov_source = override_pov if override_pov in ("first_person", "third_person") else vr_prefs_raw.get("pov")
        pov = "third_person" if pov_source == "third_person" else "first_person"
        # Cycle 0046 — shot framing preference. `auto` (default) lets the
        # refiner pick from narrative context; other values force a specific
        # Danbooru framing tag. Validated against the canonical set; anything
        # unknown collapses to `auto`.
        _shot_allowed = {"close-up", "portrait", "medium_shot", "cowboy_shot", "full_body"}
        _raw_shot = override_shot if isinstance(override_shot, str) else vr_prefs_raw.get("shot_framing")
        shot_framing = _raw_shot if isinstance(_raw_shot, str) and _raw_shot in _shot_allowed else None
        user_persona_payload: dict[str, Any] | None = None
        if pov == "third_person":
            persona_id = conversation.get("persona_id")
            if persona_id:
                personas = await sup.select(client, "user_personas", {
                    "select": "name,gender,appearance,background_story",
                    "id": f"eq.{persona_id}",
                    "limit": "1",
                })
                if personas:
                    user_persona_payload = personas[0]

        # Cycle 0063 — per-regen editable prompt. When provided, use verbatim
        # and skip the refiner LLM call. Still passes through _prompt_wrap
        # below for style boosters + workflow negatives.
        raw_prompt_override = overrides.prompt_override if overrides else None
        prompt_override = raw_prompt_override.strip() if isinstance(raw_prompt_override, str) and raw_prompt_override.strip() else None

        if prompt_override is not None:
            refine = ImageRefineResult(
                refined_prompt=prompt_override,
                negative_prompt="",
                sfw_blocked=False,
                block_reason=None,
            )
        elif refine_enabled:
            # Cycle 0079: for group characters, always pass group_members_text as
            # the appearance (the individual fields don't apply). For single
            # characters the existing include_appearance flag still governs.
            effective_appearance = (
                group_members_text if group_size > 1 and group_members_text
                else (appearance if include_appearance else None)
            )
            refine = await run_image_refine(
                refine_cfg,
                appearance=effective_appearance,
                character_context=character_context if include_appearance else None,
                last_turns=clipped_turns,
                target_message=target,
                sfw=sfw,
                user_persona=user_persona_payload,
                pov=pov,
                shot_framing=shot_framing,
                character_group_size=group_size if group_size > 1 else None,
                character_group_members=group_members_text if group_size > 1 and group_members_text else None,
            )
        else:
            # Pass-through: skip LLM. Use the target message verbatim as the
            # refined positive prompt; negative_prompt stays empty (the
            # `_prompt_wrap` negative_prefix + SFW workflow negatives still
            # apply downstream). No LLM-level SFW block — we rely on the
            # per-provider negative prompt + the `sfw_disabled` guardrail
            # injected via build_chat_messages in chat.py to keep scenes safe.
            #
            # Known scope gap (cycle 0041): `pov=third_person` + SFW=off +
            # refine_enabled=off → the multi-subject "user is never
            # sexualized" rule from image_refine_system.txt is not applied
            # because the refiner LLM never runs. Requires all three
            # conditions to trigger (user must actively opt out of
            # refinement AND SFW); documented here for a follow-up cycle.
            refine = ImageRefineResult(
                refined_prompt=target.strip(),
                negative_prompt="",
                sfw_blocked=False,
                block_reason=None,
            )

        provider_snapshot = {
            "provider_family": "comfyui",
            "base_url": image_provider.get("base_url"),
            "text_refiner_model": refine_model,
            "prompt_wrap": workflow_raw.get("_prompt_wrap"),
            "resolution_preset": resolved_preset,
            "pov": pov,
            "shot_framing": shot_framing,
            # Cycle 0047 — record which settings came from a per-regen
            # override vs the user's saved prefs, for trace / debug.
            "regen_overrides": (
                {k: v for k, v in overrides.model_dump(exclude_none=True).items()}
                if overrides else None
            ),
        }

        # Next position for inline_media on this message. Regenerate ALWAYS
        # appends — previous images stay attached so the user can step
        # through variants with the N/M control in MessageBubble.
        existing_inline = await sup.select(client, "inline_media", {
            "select": "position",
            "message_id": f"eq.{message['id']}",
            "order": "position.desc",
            "limit": "1",
        })
        next_position = (int(existing_inline[0]["position"]) + 1) if existing_inline else 0

        # 3. SFW-blocked path: persist a row flagged as blocked; no bytes.
        if refine.sfw_blocked:
            row = await sup.insert(client, "generated_images", {
                "user_id": user.id,
                "character_id": character["id"],
                "conversation_id": conversation["id"],
                "message_id": message["id"],
                "prompt": target,
                "refined_prompt": refine.refined_prompt or refine.block_reason or "",
                "provider_snapshot": provider_snapshot,
                "resolution_preset": resolved_preset,
                "dimensions": {"w": width, "h": height},
                "sfw_blocked": True,
            })
            await sup.insert(client, "inline_media", {
                "message_id": message["id"],
                "generated_image_id": row["id"],
                "position": next_position,
            })
            return row

        # Cycle 0094 — fal.ai dual-store async branch.
        # Per the dual-store strategy decided 2026-05-05: respond
        # IMMEDIATELY with the fal CDN URL (zero download / compress /
        # upload during the request — gen already cost the user 5-15s
        # of model time, no need to add Storage round-trip on top).
        # A separate sweeper (scripts/storage_backfill.py) downloads,
        # compresses with Cycle 0092, and uploads to Storage out-of-band
        # so the row gets `storage_ref` populated before the fal CDN
        # URL TTL would have expired (24h+ for Seedream). The frontend
        # `display_url` resolver picks fal CDN for <24h-old rows and
        # Storage signed URLs after that.
        if provider_family == "fal":
            wf_cfg_raw = image_provider.get("workflow_config")
            wf_cfg = wf_cfg_raw if isinstance(wf_cfg_raw, dict) else {}
            t2i_endpoint = wf_cfg.get("t2i_model_endpoint") if isinstance(wf_cfg.get("t2i_model_endpoint"), str) else None
            edit_endpoint = wf_cfg.get("edit_model_endpoint") if isinstance(wf_cfg.get("edit_model_endpoint"), str) else None
            if not (t2i_endpoint and edit_endpoint):
                base = (wf_cfg.get("model_slug") or "fal-ai/bytedance/seedream/v5/lite").rstrip("/")
                t2i_endpoint = t2i_endpoint or f"{base}/text-to-image"
                edit_endpoint = edit_endpoint or f"{base}/edit"

            # Style resolution priority:
            #   1. Per-regen override (Cycle 0097) — ephemeral, only this gen.
            #   2. characters.avatar_style snapshot (Cycle 0093) — preserves
            #      per-character look across global flips.
            #   3. users.preferences.image.style — global default.
            #   4. "anime" — backstop matching the original Animagine setup.
            override_style = overrides.style_override if overrides else None
            char_style = character.get("avatar_style")
            scene_style = (
                override_style
                or char_style
                or (image_prefs.get("style") if isinstance(image_prefs, dict) else None)
            )
            scene_style_norm = (scene_style or "anime").lower()
            from ..lib.fal_avatar import _style_suffix
            custom_template = image_prefs.get("custom_template") if isinstance(image_prefs, dict) else None
            style_suffix = _style_suffix(scene_style_norm, custom_template if isinstance(custom_template, str) else None)

            # Build the prompt: refined paragraph + style suffix appended.
            scene_prompt = refine.refined_prompt.strip()
            if style_suffix:
                scene_prompt = f"{scene_prompt}\n\n{style_suffix}"

            # Sign the character's reference image so fal's CDN can
            # dereference it once. RLS allows the user's own row.
            ref_ref = character.get("reference_ref")
            image_urls: list[str] = []
            if isinstance(ref_ref, str) and ref_ref.strip():
                ref_signed = await sup.create_signed_url(client, "avatars", ref_ref, expires_in=60 * 60)
                image_urls.append(ref_signed)

            # Optional: append last-N chat-scene refs (opt-in setting
            # users.preferences.image.use_chat_history_refs, default 0).
            history_n_raw = image_prefs.get("use_chat_history_refs") if isinstance(image_prefs, dict) else 0
            history_n = int(history_n_raw) if isinstance(history_n_raw, int) and 0 <= history_n_raw <= 5 else 0
            if history_n > 0 and image_urls:
                # Find recent inline_media → generated_images on this conv,
                # excluding this message, take last N. Append their fal CDN
                # URL when fresh, else their Storage signed URL.
                recent = await sup.select(client, "generated_images", {
                    "select": "external_url,external_url_captured_at,storage_ref,bucket",
                    "conversation_id": f"eq.{conversation['id']}",
                    "engine": "eq.fal",
                    "order": "created_at.desc",
                    "limit": str(history_n),
                })
                for r in recent:
                    cdn = r.get("external_url")
                    if isinstance(cdn, str) and cdn.strip():
                        image_urls.append(cdn)
                    elif isinstance(r.get("storage_ref"), str):
                        bucket = r.get("bucket") or "generated-media"
                        signed = await sup.create_signed_url(client, bucket, r["storage_ref"], expires_in=60 * 60)
                        image_urls.append(signed)

            # Call fal /edit (since we have refs). FalProvider.submit
            # routes by the presence of refs.
            from ..agents.fal_provider import FalProvider
            fp = FalProvider(api_key=image_api_key, t2i_endpoint=t2i_endpoint, edit_endpoint=edit_endpoint)
            try:
                fal_result = await fp.submit(
                    positive=scene_prompt,
                    refs=image_urls if image_urls else None,
                    width=width,
                    height=height,
                )
            except Exception as exc:
                raise HTTPException(
                    status.HTTP_502_BAD_GATEWAY,
                    f"fal.ai chat scene generation failed: {exc}",
                ) from exc

            # Override the snapshot for fal — different shape than ComfyUI.
            provider_snapshot = {
                "provider_family": "fal",
                "t2i_endpoint": t2i_endpoint,
                "edit_endpoint": edit_endpoint,
                "text_refiner_model": refine_model,
                "resolution_preset": resolved_preset,
                "pov": pov,
                "shot_framing": shot_framing,
                "ref_count": len(image_urls),
                "regen_overrides": (
                    {k: v for k, v in overrides.model_dump(exclude_none=True).items()}
                    if overrides else None
                ),
            }

            # Persist row IMMEDIATELY (no Storage upload yet — sweeper
            # owns it). storage_ref=null is the signal that the
            # backfill job needs to process this row.
            captured_at = (
                fal_result.external_url_captured_at.isoformat()
                if fal_result.external_url_captured_at else None
            )
            row = await sup.insert(client, "generated_images", {
                "user_id": user.id,
                "character_id": character["id"],
                "conversation_id": conversation["id"],
                "message_id": message["id"],
                "prompt": target,
                "refined_prompt": refine.refined_prompt,
                "provider_snapshot": provider_snapshot,
                "resolution_preset": resolved_preset,
                "dimensions": {"w": width, "h": height},
                "seed": fal_result.seed,
                "engine": "fal",
                "style": scene_style_norm,
                "external_url": fal_result.external_url,
                "external_url_provider": "fal",
                "external_url_captured_at": captured_at,
                "bucket": "generated-media",
            })
            try:
                await sup.insert(client, "inline_media", {
                    "message_id": message["id"],
                    "generated_image_id": row["id"],
                    "position": next_position,
                })
            except Exception:
                try:
                    await sup.delete(client, "generated_images", {"id": f"eq.{row['id']}"})
                except Exception:
                    pass
                raise

            # Augment the row response with display_url (fal CDN now;
            # frontend re-resolves from `external_url + storage_ref` on
            # subsequent loads via lib/images.ts displayUrl helper).
            row["display_url"] = fal_result.external_url
            return row

        # 4. ComfyUI submit + poll + fetch. The workflow_config stores an
        # optional `_prompt_wrap` key with user-editable prefix/suffix tokens
        # (style boosters, quality tags, global negatives). We strip that key
        # before sending the workflow to ComfyUI and splice the strings
        # around the refiner's output.
        if not workflow_raw:
            raise HTTPException(status.HTTP_409_CONFLICT, "image provider has no workflow_config — upload a ComfyUI API-format workflow")
        wrap_raw = workflow_raw.get("_prompt_wrap")
        wrap = wrap_raw if isinstance(wrap_raw, dict) else {}
        # Strip every sidecar key (prefix `_`) before sending to ComfyUI so it
        # only sees real workflow nodes. Currently `_prompt_wrap` and
        # `_refiner_system_prompt`; future sidecars (`_style`, etc.) inherit.
        workflow = {k: v for k, v in workflow_raw.items() if not (isinstance(k, str) and k.startswith("_"))}

        def _wrap(prefix: str, body: str, suffix: str) -> str:
            parts = [p.strip() for p in (prefix, body, suffix) if p and p.strip()]
            return "\n\n".join(parts)

        final_positive = _wrap(str(wrap.get("positive_prefix") or ""),
                               refine.refined_prompt,
                               str(wrap.get("positive_suffix") or ""))
        final_negative = _wrap(str(wrap.get("negative_prefix") or ""),
                               refine.negative_prompt,
                               str(wrap.get("negative_suffix") or ""))
        # SFW guardrail: append diffusion-side anti-NSFW tokens unless the
        # user has explicitly opted into NSFW (sfw_disabled=True).
        final_negative = append_sfw_negative(final_negative, sfw_disabled=not sfw)

        # Cycle 0042 — optional checkpoint override (see _patch_workflow).
        # Reject path separators: the value is fed straight into ComfyUI's
        # checkpoint loader, and a stricter-than-ComfyUI guard avoids relying
        # on the LAN box's hardening. `..` also blocked even though ComfyUI
        # normally resolves within models/checkpoints/.
        raw_ckpt = wrap.get("checkpoint")
        checkpoint_override = raw_ckpt.strip() if isinstance(raw_ckpt, str) else ""
        if checkpoint_override and any(c in checkpoint_override for c in ("/", "\\", "..")):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "checkpoint name must be a bare filename (no path separators or '..')",
            )

        # Cycle 0019 — per-character image seed lock. When the character
        # has a locked seed, every image reuses it for visual consistency;
        # null falls back to a fresh random seed per call.
        locked_seed = character.get("image_seed")
        seed = int(locked_seed) if isinstance(locked_seed, int) else random.randint(1, 2**31 - 1)
        try:
            image_bytes = await submit_and_wait(
                base_url=image_provider.get("base_url") or "",
                api_key=image_api_key,
                workflow=workflow,
                positive=final_positive,
                negative=final_negative,
                seed=seed,
                width=width,
                height=height,
                checkpoint=checkpoint_override or None,
            )
        except ComfyWorkflowShapeError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"workflow_config shape: {exc}") from exc

        # 5. Compress + persist. Cycle 0092 encodes everything to WebP
        # before upload (≤500KB target for scenes). If the DB insert fails
        # after the bytes are up, delete the orphan object so we don't leak
        # storage. If the inline_media insert fails, remove both the object
        # and the DB row so `listImagesForMessage` stays consistent.
        image_id = str(uuid.uuid4())
        # Run Pillow off the asyncio loop — the encode is pure CPU and
        # ~100-300ms for a 2048-px WebP. Wrapping in to_thread lets
        # other concurrent requests progress while this one encodes.
        compressed = await asyncio.to_thread(compress_for_storage, image_bytes, "scene")
        storage_ref = f"{user.id}/{image_id}.webp"
        await sup.upload_bytes(client, "generated-media", storage_ref, compressed.bytes, compressed.mime)

        try:
            row = await sup.insert(client, "generated_images", {
                "id": image_id,
                "user_id": user.id,
                "character_id": character["id"],
                "conversation_id": conversation["id"],
                "message_id": message["id"],
                "prompt": target,
                "refined_prompt": refine.refined_prompt,
                "provider_snapshot": provider_snapshot,
                "resolution_preset": resolved_preset,
                "dimensions": {"w": compressed.width, "h": compressed.height},
                "seed": seed,
                "storage_ref": storage_ref,
                "bytes_size": compressed.bytes_size,
            })
        except Exception:
            try:
                await sup.remove_object(client, "generated-media", storage_ref)
            except Exception:
                pass  # best-effort
            raise

        try:
            await sup.insert(client, "inline_media", {
                "message_id": message["id"],
                "generated_image_id": row["id"],
                "position": next_position,
            })
        except Exception:
            try:
                await sup.delete(client, "generated_images", {"id": f"eq.{row['id']}"})
            except Exception:
                pass
            try:
                await sup.remove_object(client, "generated-media", storage_ref)
            except Exception:
                pass
            raise
        return row
