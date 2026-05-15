"""POST /characters/{character_id}/generate-avatar — Character portrait (cycle 0028).

Builds a deterministic positive/negative prompt from the character's text
fields (name + 11 physical attrs + appearance_description + signature_style),
submits through the user's active ComfyUI image engine, uploads the result to
the `avatars` bucket, and persists `characters.avatar_ref`. Edit-only on the
frontend (requires a saved character id).

No LLM refinement pass: the character's physical fields are already concrete,
and the workflow_config._prompt_wrap handles style boosters. Cycle 0019's
per-character `image_seed` is reused for visual consistency.
"""

from __future__ import annotations

import asyncio
import os
import random
import re
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status

from ..agents.avatar_refine import run_avatar_background_refine
from ..agents.comfyui import (
    ComfyWorkflowShapeError,
    append_sfw_negative,
    submit_and_wait,
)
from ..agents.fal_provider import FalProvider
from ..agents.image_refine import ImageRefineCallConfig
from ..lib.fal_avatar import build_avatar_preview_prompt, build_reference_prompt
from ..lib.image_compress import compress_for_storage
from ..lib.image_dispatch import gate_image_provider_family
from ..deps.jwt import AuthUser, verify_supabase_jwt
from ..deps.supabase import UserSupabase

router = APIRouter()

SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

# Portrait dimensions — hardcoded. Avatars are per-Character and standalone;
# the user's per-Conversation resolution preset does not apply.
_PORTRAIT_WIDTH = 768
_PORTRAIT_HEIGHT = 1024

# Defaults for the user-editable Avatar prompt prefix / suffix exposed in
# Settings → Prompt Editor. `solo` lives inside the prefix now — previously
# it was emitted unconditionally inside `_build_portrait_prompt`.
AVATAR_PREFIX_DEFAULT = (
    "solo, medium shot portrait, face focus, soft lighting, looking at viewer"
)
AVATAR_SUFFIX_DEFAULT = "high quality, detailed face, sharp focus"

# Cycle 0048 — used as the background hint when the context refiner is
# disabled, the LLM returns empty tags, or the call fails. Previously
# hardcoded into AVATAR_PREFIX_DEFAULT; now applied only when we
# genuinely can't infer a richer setting.
AVATAR_BACKGROUND_FALLBACK = "simple background"


def _user_client(authorization: str) -> UserSupabase:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    if not SUPABASE_ANON_KEY:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "SUPABASE_ANON_KEY not configured")
    return UserSupabase(jwt=token.strip(), apikey=SUPABASE_ANON_KEY)


def _flatten(s: str) -> str:
    """Collapse whitespace runs into single ASCII spaces to keep prompts tidy."""
    return " ".join(s.split())


# Chars that break ComfyUI/A1111 attention-weight syntax or the prompt
# structure if they leak in from user-controlled character fields. Stripped
# on read so a malicious or accidental value can't escape its token wrapper.
_PROMPT_UNSAFE = re.compile(r"[()\[\]:\\]")


def _sanitize(s: str) -> str:
    cleaned = _PROMPT_UNSAFE.sub("", s)
    # Neutralize the literal "BREAK" keyword which ComfyUI treats as a
    # conditioning segment separator — a freeform field that contains
    # "BREAK" would split the prompt mid-way.
    cleaned = re.sub(r"\bBREAK\b", "break", cleaned)
    return cleaned


def _field(character: dict[str, Any], key: str) -> str | None:
    v = character.get(key)
    if isinstance(v, str) and v.strip():
        return _sanitize(_flatten(v.strip()))
    return None


def _parse_age_years(age_str: str) -> int | None:
    """Pull the first integer out of an age string. `"mid-40s"` → 40,
    `"45"` → 45, `"fifty"` → None, `""` → None.
    """
    m = re.search(r"\d+", age_str)
    return int(m.group()) if m else None


def _age_tier_tokens(age_str: str | None, *, is_male: bool, is_female: bool) -> str | None:
    """Map an age string to booru-style age-tier tokens so `1boy` / `1girl`
    (which the anime checkpoint reads as young-skewing) don't produce a
    child/teen when the character is an adult. Uses numeric hints first
    (parses the first integer), then keyword hints. Returns None when the
    age can't be classified — the raw age string still flows through as
    a descriptive token.
    """
    if not age_str:
        return None
    lower = age_str.lower()

    def pick(male: str, female: str) -> str | None:
        if is_male:
            return male
        if is_female:
            return female
        return None

    # Keyword hints (EN + ES) for descriptive ages that don't carry a
    # numeric. Order matters: old-related first, then child, teen, then
    # adult/mature, then young-adult. Numeric fallback below.
    if any(k in lower for k in (
        "elder", "senior", "old", "aged",
        "anciano", "anciana", "viejo", "vieja", "mayor",
    )):
        return pick("(old man:1.3), mature, wrinkled", "(old woman:1.3), mature, aged")
    if any(k in lower for k in ("child", "kid", "niño", "niña", "infant")):
        # Intentionally omit — avatars for children are not a use case we
        # want to reinforce; fall through to no tier.
        return None
    if any(k in lower for k in ("teen", "teenager", "adolescente")):
        return "teenager"
    # Check "young adult" variants BEFORE the mature substrings so "joven
    # adulta" doesn't match on "adulta" first.
    if any(k in lower for k in ("young adult", "twenties", "joven adulto", "joven adulta")):
        return pick("(adult male:1.3), young adult", "(adult female:1.3), young adult")
    if any(k in lower for k in (
        "middle-aged", "middle aged", "midlife",
        "mature", "adulto", "adulta", "maduro", "madura",
        "mediana edad",
    )):
        return pick("(mature male:1.4), adult man, middle-aged", "(mature female:1.4), adult woman")

    years = _parse_age_years(lower)
    if years is not None:
        if years >= 55:
            return pick("(old man:1.3), mature, middle-aged", "(old woman:1.3), mature")
        if years >= 30:
            return pick("(mature male:1.4), adult man, middle-aged", "(mature female:1.4), adult woman")
        if years >= 18:
            return pick("(adult male:1.3), young adult", "(adult female:1.3), young adult")
        if years >= 13:
            return "teenager"

    return None


def _gender_class(gender_value: str | None) -> str | None:
    """Normalize the character's free-text gender field to `"male"`,
    `"female"`, or `None` for non-binary / unspecified / custom values.
    """
    if not gender_value:
        return None
    g = gender_value.strip().lower()
    if g in ("male", "m", "man", "boy"):
        return "male"
    if g in ("female", "f", "woman", "girl"):
        return "female"
    return None


def _booru_gender_tokens(gender_class: str | None) -> str | None:
    """Map the normalized gender class to Danbooru-style count/focus tokens.
    Attention weight is boosted (1.4) because anime SDXL checkpoints have
    heavy feminine priors — plain `1boy` is often overridden by the base
    distribution, especially when a previously-locked seed already steered
    feminine. Age-tier tokens (see `_age_tier_tokens`) handle whether the
    subject reads as adult vs teen.
    """
    if gender_class == "male":
        return "(1boy:1.4), male focus, masculine face"
    if gender_class == "female":
        return "(1girl:1.4), female focus, feminine features"
    return None


def _build_portrait_prompt(
    character: dict[str, Any],
    *,
    user_prefix: str | None = None,
    user_suffix: str | None = None,
    background_tags: list[str] | None = None,
) -> str:
    """Concatenate the character's portrait-relevant fields into a single
    positive prompt body. Booru-style gender tokens lead so the anime SDXL
    checkpoint enforces the character's gender up front; then the user's
    configured Avatar Prefix (Prompt Editor, cycle 0039) which by default
    carries `solo, medium shot portrait, face focus, ...`; then name /
    age-tier / hair / eyes / skin / signature / distinctive features /
    free-form appearance; finally the user's Avatar Suffix (`high quality,
    detailed face, sharp focus` by default). Empty user fields are treated
    as explicit opt-outs — they do not fall back to defaults. Pass `None`
    to request the default. The workflow_config._prompt_wrap still applies
    globally around this body.
    """
    parts: list[str] = []

    gender_class = _gender_class(_field(character, "gender"))
    gender_token = _booru_gender_tokens(gender_class)
    if gender_token:
        parts.append(gender_token)

    # User-editable Avatar Prefix (Prompt Editor). Fallback to the default
    # only when the stored value is None (unset); an empty string is an
    # intentional opt-out from the prefix.
    prefix_value = AVATAR_PREFIX_DEFAULT if user_prefix is None else user_prefix
    if prefix_value.strip():
        parts.append(_sanitize(_flatten(prefix_value.strip())))

    name = _field(character, "name")
    if name:
        parts.append(f"of {name}")

    # All physical attrs get attention weights so anime SDXL respects them
    # against its base distribution. Tiers: gender (already 1.4 above),
    # age-tier (1.3–1.4 depending on range), hair (1.3), build/height/eye/
    # skin (1.2). Without weights these tokens are frequently overridden by
    # the checkpoint's priors (e.g. "short hair" → long hair; "mid-40s" →
    # teen; `1boy` → young teenage anime boy).
    age = _field(character, "age")
    age_tier = _age_tier_tokens(
        age,
        is_male=gender_class == "male",
        is_female=gender_class == "female",
    )
    if age_tier:
        parts.append(age_tier)
    if age:
        parts.append(f"({age}:1.3)")

    build = _field(character, "build")
    height = _field(character, "height")
    if build:
        parts.append(f"({build} build:1.2)")
    if height:
        parts.append(f"({height}:1.2)")

    for key in ("hair_style", "hair_color"):
        v = _field(character, key)
        if v:
            parts.append(f"({v} hair:1.3)")

    eye_color = _field(character, "eye_color")
    if eye_color:
        parts.append(f"({eye_color} eyes:1.2)")

    skin_tone = _field(character, "skin_tone")
    if skin_tone:
        parts.append(f"({skin_tone} skin:1.2)")

    for key in ("signature_style", "distinctive_features"):
        v = _field(character, key)
        if v:
            parts.append(v)

    appearance = _field(character, "appearance_description")
    if appearance:
        parts.append(appearance)

    # Cycle 0048 — background / setting / lighting tags. When the refiner
    # returned tags, use them. Empty list = refiner was disabled / failed /
    # produced no clues; inject the fallback so SDXL has some background
    # signal instead of whatever the checkpoint prior picks.
    if background_tags:
        parts.extend(background_tags)
    else:
        parts.append(AVATAR_BACKGROUND_FALLBACK)

    # User-editable Avatar Suffix (Prompt Editor). Same null-vs-empty rule
    # as the prefix: None → default; "" → explicit opt-out.
    suffix_value = AVATAR_SUFFIX_DEFAULT if user_suffix is None else user_suffix
    if suffix_value.strip():
        parts.append(_sanitize(_flatten(suffix_value.strip())))

    return ", ".join(parts)


def _build_avatar_context(character: dict[str, Any]) -> str:
    """Assemble the narrative context the avatar-background refiner skims.

    Same layered order used by the chat image refiner so the two agents
    see a consistent view: system prompt → personality / goals →
    worldbuilding → scenario. Physical identity is intentionally omitted
    — the background refiner only cares about the world / setting, not
    the body.
    """
    chunks: list[str] = []
    sys_prompt = _field(character, "system_prompt")
    if sys_prompt:
        chunks.append(f"SYSTEM_PROMPT:\n{sys_prompt}")
    for key in ("personality", "goals", "worldbuilding"):
        group = character.get(key)
        if isinstance(group, dict):
            body = "\n".join(
                f"- {k.replace('_', ' ')}: {v.strip()}"
                for k, v in group.items()
                if isinstance(v, str) and v.strip()
            )
            if body:
                chunks.append(f"{key.upper()}:\n{body}")
    scenario = _field(character, "scenario")
    if scenario:
        chunks.append(f"SCENARIO:\n{scenario}")
    return "\n\n".join(chunks)


# ---------------------------------------------------------------------------
# Cycle 0079 — Group character helpers
# ---------------------------------------------------------------------------

def _parse_group_members(text: str) -> list[dict]:
    """Parse "N. Name | gender | age | description" lines into dicts.
    Lines that don't match the pattern (wrong separator count, not starting
    with a digit) are silently skipped so malformed input degrades gracefully.
    """
    members: list[dict] = []
    for line in text.strip().splitlines():
        line = line.strip()
        if not line or not line[0].isdigit():
            continue
        line = re.sub(r"^\d+\.\s*", "", line)
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 4:
            continue
        members.append({
            "name": _sanitize(_flatten(parts[0])),
            "gender": parts[1].strip().lower(),
            "age": _sanitize(_flatten(parts[2])),
            "appearance": _sanitize(_flatten(", ".join(parts[3:]))),
        })
    return members


def _group_count_tag(members: list[dict]) -> str:
    """Derive the Danbooru subject-count tag from the members' genders."""
    genders = [_gender_class(m["gender"]) for m in members]
    males = genders.count("male")
    females = genders.count("female")
    n = len(members)
    if n == 2:
        if males == 2:
            return "2boys"
        if females == 2:
            return "2girls"
        return "1boy 1girl"
    if n == 3:
        if males == 3:
            return "3boys"
        if females == 3:
            return "3girls"
        return "multiple_people"
    return "multiple_people"


def _build_group_portrait_prompt(
    members: list[dict],
    *,
    user_prefix: str | None = None,
    user_suffix: str | None = None,
    background_tags: list[str] | None = None,
) -> str:
    """Multi-subject portrait prompt for group characters (cycle 0079).

    Avatars are profile-picture context, so `looking at viewer` is kept as
    the interaction cue. Chat images derive their framing from the scene via
    the image refiner — this function is only called for avatar generation.
    """
    parts: list[str] = []

    parts.append(_group_count_tag(members))

    # Prefix — strip "solo" when present (single-subject cue incompatible with
    # a group portrait). For avatar context keep "looking at viewer".
    GROUP_PREFIX_DEFAULT = "medium shot portrait, looking at viewer"
    raw_prefix = GROUP_PREFIX_DEFAULT if user_prefix is None else user_prefix
    cleaned_prefix = re.sub(r"\bsolo\b,?\s*", "", raw_prefix, flags=re.IGNORECASE).strip(", ")
    if cleaned_prefix:
        parts.append(_sanitize(_flatten(cleaned_prefix)))

    # Per-member escaped-parens group — same format as image refiner.
    for m in members:
        gender_cls = _gender_class(m["gender"])
        gender_tag = {"male": "1boy", "female": "1girl"}.get(gender_cls or "", "1other")
        age_tier = _age_tier_tokens(
            m["age"] or None,
            is_male=gender_cls == "male",
            is_female=gender_cls == "female",
        )
        name_tag = m["name"].lower().replace(" ", "_") if m["name"] else ""
        inner: list[str] = []
        if name_tag:
            inner.append(name_tag)
        if age_tier:
            inner.append(age_tier)
        if m["age"]:
            inner.append(f"({m['age']}:1.3)")
        for tag in [t.strip() for t in m["appearance"].split(",") if t.strip()]:
            inner.append(tag)
        parts.append(f"{gender_tag} \\({', '.join(inner)}\\)")

    if background_tags:
        parts.extend(background_tags)
    else:
        parts.append(AVATAR_BACKGROUND_FALLBACK)

    suffix_value = AVATAR_SUFFIX_DEFAULT if user_suffix is None else user_suffix
    if suffix_value.strip():
        parts.append(_sanitize(_flatten(suffix_value.strip())))

    return ", ".join(parts)


def _build_portrait_negative() -> str:
    """Anti-deformity negatives. SFW guardrail tokens are appended later by
    `append_sfw_negative` once the wrap is built, so callers do not need to
    branch on `sfw_disabled` here."""
    return "blurry, lowres, bad anatomy, watermark, signature, extra limbs, deformed"


def _wrap(prefix: Any, body: str, suffix: Any) -> str:
    chunks: list[str] = []
    if isinstance(prefix, str) and prefix.strip():
        chunks.append(prefix.strip())
    if body.strip():
        chunks.append(body.strip())
    if isinstance(suffix, str) and suffix.strip():
        chunks.append(suffix.strip())
    return "\n\n".join(chunks)


def _resolve_fal_endpoints(workflow_cfg: dict[str, Any]) -> tuple[str, str]:
    """Extract t2i + edit endpoints from a fal provider's workflow_config.
    New shape: explicit `t2i_model_endpoint` + `edit_model_endpoint` (full
    slugs including the `/text-to-image` or `/edit` suffix). Legacy
    fallback: `model_slug` (base form) → derive both by appending the
    fixed suffixes.
    """
    t2i = workflow_cfg.get("t2i_model_endpoint")
    edit = workflow_cfg.get("edit_model_endpoint")
    if isinstance(t2i, str) and t2i.strip() and isinstance(edit, str) and edit.strip():
        return t2i.strip(), edit.strip()
    base = (workflow_cfg.get("model_slug") or "fal-ai/bytedance/seedream/v5/lite").rstrip("/")
    return f"{base}/text-to-image", f"{base}/edit"


async def _fal_dual_gen(
    *,
    api_key: str,
    t2i_endpoint: str,
    edit_endpoint: str,
    preview_prompt: str,
    reference_prompt: str,
) -> tuple[Any, Any | None]:
    """Run two fal /text-to-image calls — preview + reference.

    Both avatar paths use the t2i endpoint (no refs). Edit endpoint is
    threaded through so the same FalProvider can be reused by Cycle 0094
    chat scenes without re-instantiating.

    Reference call failure is non-fatal (returns None for that slot);
    avatar gen still succeeds with the preview alone. The preview
    failure propagates as an HTTPException since the call is the
    user's whole request.
    """
    fp = FalProvider(api_key=api_key, t2i_endpoint=t2i_endpoint, edit_endpoint=edit_endpoint)
    try:
        preview = await fp.submit(preview_prompt, width=1024, height=1024)
    except Exception as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"fal.ai preview generation failed: {exc}",
        ) from exc
    try:
        reference = await fp.submit(reference_prompt, width=896, height=1280)
    except Exception:
        # Best-effort: log via logger if added; for now silently
        # continue with preview only. Reference is enrichment.
        reference = None
    return preview, reference


def _iso_or_none(dt: Any) -> str | None:
    return dt.isoformat() if dt is not None else None


@router.post("/characters/{character_id}/generate-avatar")
async def generate_character_avatar(
    character_id: str,
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(default=""),
) -> dict:
    sup = _user_client(authorization)

    async with httpx.AsyncClient(timeout=120.0) as client:
        # 1. Load character — RLS enforces ownership.
        chars = await sup.select(client, "characters", {
            "select": "*",
            "id": f"eq.{character_id}",
            "limit": "1",
        })
        if not chars:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "character not found")
        character = chars[0]

        # 2. Load active image engine config.
        providers = await sup.select(client, "provider_configs", {
            "select": "base_url,workflow_config,provider_family",
            "kind": "eq.image",
            "is_active": "eq.true",
            "limit": "1",
        })
        if not providers:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="no_image_engine")
        provider = providers[0]
        # Cycle 0091 — flag-gate non-comfyui families until 0093 lifts.
        gate_image_provider_family(provider)

        api_key = await sup.rpc(client, "get_active_image_key")

        # 3. Resolve SFW flag + user's Prompt Editor overrides (cycle 0039).
        users = await sup.select(client, "users", {
            "select": "sfw_disabled,preferences",
            "id": f"eq.{user.id}",
            "limit": "1",
        })
        sfw_disabled = bool(users[0].get("sfw_disabled")) if users else False
        user_prefs_raw = users[0].get("preferences") if users else None
        user_prefs = user_prefs_raw if isinstance(user_prefs_raw, dict) else {}
        prompt_editor_raw = user_prefs.get("prompt_editor")
        prompt_editor = prompt_editor_raw if isinstance(prompt_editor_raw, dict) else {}
        avatar_prefix_pref = prompt_editor.get("avatar_prefix")
        avatar_suffix_pref = prompt_editor.get("avatar_suffix")
        # Coerce to str | None — None means "use default"; empty string means
        # "user opted out"; anything non-str falls back to None.
        user_prefix = avatar_prefix_pref if isinstance(avatar_prefix_pref, str) else None
        user_suffix = avatar_suffix_pref if isinstance(avatar_suffix_pref, str) else None
        # Cycle 0048 — context-aware background. Default ON; user can
        # opt out in Prompt Editor. Missing key → treat as enabled.
        bg_enabled = prompt_editor.get("avatar_background_refine_enabled")
        bg_refine_enabled = bg_enabled is not False

        # 4a. Call the avatar background refiner (optional, best-effort).
        # Failures here never break avatar generation — we fall back to the
        # `simple background` hint baked into `_build_portrait_prompt`.
        background_tags: list[str] = []
        if bg_refine_enabled:
            text_providers = await sup.select(client, "provider_configs", {
                "select": "base_url,model_id",
                "kind": "eq.text",
                "is_active": "eq.true",
                "limit": "1",
            })
            if text_providers:
                text_provider = text_providers[0]
                text_api_key = await sup.rpc(client, "get_active_text_key")
                if text_api_key:
                    ctx = _build_avatar_context(character)
                    if ctx.strip():
                        refine_cfg = ImageRefineCallConfig(
                            base_url=text_provider.get("base_url") or "",
                            api_key=text_api_key,
                            model=text_provider.get("model_id") or "",
                        )
                        try:
                            bg = await run_avatar_background_refine(refine_cfg, ctx)
                            background_tags = bg.tags
                        except Exception:
                            # Timeout / 5xx / invalid JSON — fall through to
                            # the fallback. Avatar gen stays responsive.
                            background_tags = []

        # Cycle 0093 — fal.ai dual-gen branch. Generates the user-facing
        # preview avatar + the white-bg reference image used as
        # image_urls[0] in chat scenes (Cycle 0094). Snapshots
        # avatar_style so chat scenes for this character keep matching
        # styling even if the user's global preference flips.
        provider_family = (provider.get("provider_family") or "comfyui").lower()
        if provider_family == "fal":
            image_prefs_raw = user_prefs.get("image")
            image_prefs = image_prefs_raw if isinstance(image_prefs_raw, dict) else {}
            style = image_prefs.get("style")
            custom_template = image_prefs.get("custom_template")
            wf_cfg_raw = provider.get("workflow_config")
            wf_cfg = wf_cfg_raw if isinstance(wf_cfg_raw, dict) else {}
            t2i_endpoint, edit_endpoint = _resolve_fal_endpoints(wf_cfg)

            preview_prompt = build_avatar_preview_prompt(
                character=character,
                style=style,
                custom_template=custom_template,
                user_prefix=user_prefix,
                background_tags=", ".join(background_tags) or None,
            )
            reference_prompt = build_reference_prompt(
                character=character,
                style=style,
                custom_template=custom_template,
            )

            preview_result, reference_result = await _fal_dual_gen(
                api_key=api_key,
                t2i_endpoint=t2i_endpoint,
                edit_endpoint=edit_endpoint,
                preview_prompt=preview_prompt,
                reference_prompt=reference_prompt,
            )

            ts = int(time.time() * 1000)
            preview_path = f"{user.id}/character-{character_id}-{ts}.webp"
            preview_compressed = await asyncio.to_thread(
                compress_for_storage, preview_result.image_bytes, "avatar",
            )
            await sup.upload_bytes(client, "avatars", preview_path,
                                    preview_compressed.bytes, preview_compressed.mime)

            reference_path: str | None = None
            if reference_result is not None:
                reference_path = f"{user.id}/character-{character_id}-{ts}-ref.webp"
                reference_compressed = await asyncio.to_thread(
                    compress_for_storage, reference_result.image_bytes, "reference",
                )
                await sup.upload_bytes(client, "avatars", reference_path,
                                        reference_compressed.bytes, reference_compressed.mime)

            # Best-effort cleanup of previous Storage objects so the
            # `avatars` bucket doesn't grow stale entries on re-gen.
            for prev in (character.get("avatar_ref"), character.get("reference_ref")):
                if prev and prev not in (preview_path, reference_path):
                    try:
                        await sup.remove_object(client, "avatars", prev)
                    except Exception:
                        pass

            update_payload: dict[str, Any] = {
                "avatar_ref": preview_path,
                "avatar_external_url": preview_result.external_url,
                "avatar_external_url_captured_at": _iso_or_none(preview_result.external_url_captured_at),
                "avatar_style": (style or "anime").lower(),
            }
            if reference_result is not None and reference_path:
                update_payload.update({
                    "reference_ref": reference_path,
                    "reference_external_url": reference_result.external_url,
                    "reference_external_url_captured_at": _iso_or_none(reference_result.external_url_captured_at),
                })

            await sup.update(client, "characters", {"id": f"eq.{character_id}"}, update_payload)
            return {
                "avatar_ref": preview_path,
                "reference_ref": reference_path,
                "engine": "fal",
                "model": t2i_endpoint,
                "seed": preview_result.seed,
            }

        # 4b. Build deterministic positive/negative prompts from character fields.
        # Cycle 0079: when group_size > 1 and group_members_description is filled,
        # use the multi-subject group portrait builder. Single-subject path unchanged.
        group_size = int(character.get("group_size") or 1)
        group_members_text = (character.get("group_members_description") or "").strip()
        use_group_mode = group_size > 1 and bool(group_members_text)

        if use_group_mode:
            members = _parse_group_members(group_members_text)
            if members:
                positive_body = _build_group_portrait_prompt(
                    members,
                    user_prefix=user_prefix,
                    user_suffix=user_suffix,
                    background_tags=background_tags,
                )
            else:
                # Parsed empty (malformed lines) — graceful fallback.
                positive_body = _build_portrait_prompt(
                    character,
                    user_prefix=user_prefix,
                    user_suffix=user_suffix,
                    background_tags=background_tags,
                )
        else:
            positive_body = _build_portrait_prompt(
                character,
                user_prefix=user_prefix,
                user_suffix=user_suffix,
                background_tags=background_tags,
            )
        negative_body = _build_portrait_negative()

        # 5. Apply workflow_config._prompt_wrap + strip sidecars.
        wf_raw = provider.get("workflow_config")
        workflow_raw: dict[str, Any] = wf_raw if isinstance(wf_raw, dict) else {}
        if not workflow_raw:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "image provider has no workflow_config — upload a ComfyUI API-format workflow",
            )
        wrap_raw = workflow_raw.get("_prompt_wrap")
        wrap = wrap_raw if isinstance(wrap_raw, dict) else {}
        workflow = {
            k: v for k, v in workflow_raw.items()
            if not (isinstance(k, str) and k.startswith("_"))
        }
        final_positive = _wrap(wrap.get("positive_prefix"), positive_body, wrap.get("positive_suffix"))
        final_negative = _wrap(wrap.get("negative_prefix"), negative_body, wrap.get("negative_suffix"))
        # SFW guardrail: diffusion-side anti-NSFW tokens unless user opted in.
        final_negative = append_sfw_negative(final_negative, sfw_disabled=sfw_disabled)

        # Cycle 0042 — checkpoint override mirroring image.py so avatars
        # honor the active provider's _prompt_wrap.checkpoint instead of
        # the workflow JSON's hardcoded ckpt_name.
        raw_ckpt = wrap.get("checkpoint")
        checkpoint_override = raw_ckpt.strip() if isinstance(raw_ckpt, str) else ""
        if checkpoint_override and any(c in checkpoint_override for c in ("/", "\\", "..")):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "checkpoint name must be a bare filename (no path separators or '..')",
            )

        # 6. Seed: honor cycle 0019 locked seed for consistency; else random.
        locked_seed = character.get("image_seed")
        seed = int(locked_seed) if isinstance(locked_seed, int) else random.randint(1, 2**31 - 1)

        # 7. ComfyUI submit + poll + fetch bytes.
        try:
            image_bytes = await submit_and_wait(
                base_url=str(provider.get("base_url") or ""),
                api_key=api_key,
                workflow=workflow,
                positive=final_positive,
                negative=final_negative,
                seed=seed,
                width=_PORTRAIT_WIDTH,
                height=_PORTRAIT_HEIGHT,
                checkpoint=checkpoint_override or None,
            )
        except ComfyWorkflowShapeError as exc:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"workflow_config shape: {exc}",
            ) from exc

        # 8. Compress + upload to the `avatars` bucket. Cycle 0092
        # encodes everything to WebP — never store PNG.
        ts = int(time.time() * 1000)
        compressed = await asyncio.to_thread(compress_for_storage, image_bytes, "avatar")
        new_path = f"{user.id}/character-{character_id}-{ts}.webp"
        await sup.upload_bytes(client, "avatars", new_path, compressed.bytes, compressed.mime)

        # 9. Best-effort remove of the previous avatar object — don't block on failure.
        previous = character.get("avatar_ref")
        if previous and previous != new_path:
            try:
                await sup.remove_object(client, "avatars", previous)
            except Exception:
                pass

        # 10. Persist new avatar_ref.
        await sup.update(
            client,
            "characters",
            {"id": f"eq.{character_id}"},
            {"avatar_ref": new_path},
        )

    return {"avatar_ref": new_path, "seed": seed}


def _build_persona_portrait_prompt(
    persona: dict[str, Any],
    *,
    user_prefix: str | None = None,
    user_suffix: str | None = None,
) -> str:
    """Cycle 0064 — Deterministic positive prompt body for a user persona.
    Personas have a narrower field set than characters: name + gender +
    appearance {skin, eyes, hair, extras} + background_story. No age-tier,
    build, height, signature_style, etc. The prompt follows the same
    structure as `_build_portrait_prompt` so the two portrait flows keep
    consistent weighting behaviour.
    """
    parts: list[str] = []

    gender_class = _gender_class(_field(persona, "gender"))
    gender_token = _booru_gender_tokens(gender_class)
    if gender_token:
        parts.append(gender_token)

    prefix_value = AVATAR_PREFIX_DEFAULT if user_prefix is None else user_prefix
    if prefix_value.strip():
        parts.append(_sanitize(_flatten(prefix_value.strip())))

    name = _field(persona, "name")
    if name:
        parts.append(f"of {name}")

    appearance_raw = persona.get("appearance")
    appearance = appearance_raw if isinstance(appearance_raw, dict) else {}

    def _app_field(key: str) -> str | None:
        v = appearance.get(key)
        if isinstance(v, str) and v.strip():
            return _sanitize(_flatten(v.strip()))
        return None

    hair = _app_field("hair")
    if hair:
        parts.append(f"({hair} hair:1.3)")
    eyes = _app_field("eyes")
    if eyes:
        parts.append(f"({eyes} eyes:1.2)")
    skin = _app_field("skin")
    if skin:
        parts.append(f"({skin} skin:1.2)")
    extras = _app_field("extras")
    if extras:
        parts.append(extras)

    parts.append(AVATAR_BACKGROUND_FALLBACK)

    suffix_value = AVATAR_SUFFIX_DEFAULT if user_suffix is None else user_suffix
    if suffix_value.strip():
        parts.append(_sanitize(_flatten(suffix_value.strip())))

    return ", ".join(parts)


@router.post("/personas/me/generate-avatar")
async def generate_persona_avatar(
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(default=""),
) -> dict:
    """Cycle 0064 — Generate an AI avatar for the signed-in user's persona.
    Mirrors `/characters/{id}/generate-avatar` but reads from `user_personas`
    (one row per user by RLS) and writes `user_personas.photo_ref`.
    """
    sup = _user_client(authorization)

    async with httpx.AsyncClient(timeout=120.0) as client:
        personas = await sup.select(client, "user_personas", {
            "select": "id,name,gender,appearance,photo_ref,reference_ref,avatar_style",
            "user_id": f"eq.{user.id}",
            "limit": "1",
        })
        if not personas:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "persona not set — save your persona first")
        persona = personas[0]

        providers = await sup.select(client, "provider_configs", {
            "select": "base_url,workflow_config,provider_family",
            "kind": "eq.image",
            "is_active": "eq.true",
            "limit": "1",
        })
        if not providers:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="no_image_engine")
        provider = providers[0]
        # Cycle 0091 — flag-gate non-comfyui families until 0093 lifts.
        gate_image_provider_family(provider)

        api_key = await sup.rpc(client, "get_active_image_key")

        users = await sup.select(client, "users", {
            "select": "sfw_disabled,preferences",
            "id": f"eq.{user.id}",
            "limit": "1",
        })
        sfw_disabled = bool(users[0].get("sfw_disabled")) if users else False
        user_prefs_raw = users[0].get("preferences") if users else None
        user_prefs = user_prefs_raw if isinstance(user_prefs_raw, dict) else {}
        prompt_editor_raw = user_prefs.get("prompt_editor")
        prompt_editor = prompt_editor_raw if isinstance(prompt_editor_raw, dict) else {}
        avatar_prefix_pref = prompt_editor.get("avatar_prefix")
        avatar_suffix_pref = prompt_editor.get("avatar_suffix")
        user_prefix = avatar_prefix_pref if isinstance(avatar_prefix_pref, str) else None
        user_suffix = avatar_suffix_pref if isinstance(avatar_suffix_pref, str) else None

        # Cycle 0093 — fal.ai dual-gen branch (persona equivalent of the
        # character flow). Personas store the preview as `photo_ref` and
        # the reference as `reference_ref` (Cycle 0091 migration 0037).
        provider_family = (provider.get("provider_family") or "comfyui").lower()
        if provider_family == "fal":
            image_prefs_raw = user_prefs.get("image")
            image_prefs = image_prefs_raw if isinstance(image_prefs_raw, dict) else {}
            style = image_prefs.get("style")
            custom_template = image_prefs.get("custom_template")
            wf_cfg_raw = provider.get("workflow_config")
            wf_cfg = wf_cfg_raw if isinstance(wf_cfg_raw, dict) else {}
            t2i_endpoint, edit_endpoint = _resolve_fal_endpoints(wf_cfg)

            # Personas don't carry the 11 typed character columns; the
            # build helpers fall back to `appearance_description`, so
            # pre-shape persona's `appearance` (and `gender`) into that.
            persona_as_char = {
                "appearance_description": persona.get("appearance") or "",
                "gender": persona.get("gender"),
            }
            preview_prompt = build_avatar_preview_prompt(
                character=persona_as_char,
                style=style,
                custom_template=custom_template,
                user_prefix=user_prefix,
                background_tags=None,
            )
            reference_prompt = build_reference_prompt(
                character=persona_as_char,
                style=style,
                custom_template=custom_template,
            )

            preview_result, reference_result = await _fal_dual_gen(
                api_key=api_key,
                t2i_endpoint=t2i_endpoint,
                edit_endpoint=edit_endpoint,
                preview_prompt=preview_prompt,
                reference_prompt=reference_prompt,
            )

            ts = int(time.time() * 1000)
            preview_path = f"{user.id}/persona-{ts}.webp"
            preview_compressed = await asyncio.to_thread(
                compress_for_storage, preview_result.image_bytes, "avatar",
            )
            await sup.upload_bytes(client, "avatars", preview_path,
                                    preview_compressed.bytes, preview_compressed.mime)

            reference_path: str | None = None
            if reference_result is not None:
                reference_path = f"{user.id}/persona-{ts}-ref.webp"
                reference_compressed = await asyncio.to_thread(
                    compress_for_storage, reference_result.image_bytes, "reference",
                )
                await sup.upload_bytes(client, "avatars", reference_path,
                                        reference_compressed.bytes, reference_compressed.mime)

            for prev in (persona.get("photo_ref"), persona.get("reference_ref")):
                if prev and prev not in (preview_path, reference_path):
                    try:
                        await sup.remove_object(client, "avatars", prev)
                    except Exception:
                        pass

            update_payload: dict[str, Any] = {
                "photo_ref": preview_path,
                "avatar_external_url": preview_result.external_url,
                "avatar_external_url_captured_at": _iso_or_none(preview_result.external_url_captured_at),
                "avatar_style": (style or "anime").lower(),
            }
            if reference_result is not None and reference_path:
                update_payload.update({
                    "reference_ref": reference_path,
                    "reference_external_url": reference_result.external_url,
                    "reference_external_url_captured_at": _iso_or_none(reference_result.external_url_captured_at),
                })

            await sup.update(client, "user_personas", {"id": f"eq.{persona['id']}"}, update_payload)
            return {
                "photo_ref": preview_path,
                "reference_ref": reference_path,
                "engine": "fal",
                "model": t2i_endpoint,
                "seed": preview_result.seed,
            }

        positive_body = _build_persona_portrait_prompt(
            persona,
            user_prefix=user_prefix,
            user_suffix=user_suffix,
        )
        negative_body = _build_portrait_negative()

        wf_raw = provider.get("workflow_config")
        workflow_raw: dict[str, Any] = wf_raw if isinstance(wf_raw, dict) else {}
        if not workflow_raw:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "image provider has no workflow_config — upload a ComfyUI API-format workflow",
            )
        wrap_raw = workflow_raw.get("_prompt_wrap")
        wrap = wrap_raw if isinstance(wrap_raw, dict) else {}
        workflow = {
            k: v for k, v in workflow_raw.items()
            if not (isinstance(k, str) and k.startswith("_"))
        }
        final_positive = _wrap(wrap.get("positive_prefix"), positive_body, wrap.get("positive_suffix"))
        final_negative = _wrap(wrap.get("negative_prefix"), negative_body, wrap.get("negative_suffix"))
        # SFW guardrail: diffusion-side anti-NSFW tokens unless user opted in.
        final_negative = append_sfw_negative(final_negative, sfw_disabled=sfw_disabled)

        # Cycle 0042 — checkpoint override (same rules as image.py).
        raw_ckpt = wrap.get("checkpoint")
        checkpoint_override = raw_ckpt.strip() if isinstance(raw_ckpt, str) else ""
        if checkpoint_override and any(c in checkpoint_override for c in ("/", "\\", "..")):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "checkpoint name must be a bare filename (no path separators or '..')",
            )

        # Personas have no locked seed — always random.
        seed = random.randint(1, 2**31 - 1)

        try:
            image_bytes = await submit_and_wait(
                base_url=str(provider.get("base_url") or ""),
                api_key=api_key,
                workflow=workflow,
                positive=final_positive,
                negative=final_negative,
                seed=seed,
                width=_PORTRAIT_WIDTH,
                height=_PORTRAIT_HEIGHT,
                checkpoint=checkpoint_override or None,
            )
        except ComfyWorkflowShapeError as exc:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"workflow_config shape: {exc}",
            ) from exc

        ts = int(time.time() * 1000)
        compressed = await asyncio.to_thread(compress_for_storage, image_bytes, "avatar")
        new_path = f"{user.id}/persona-{ts}.webp"
        await sup.upload_bytes(client, "avatars", new_path, compressed.bytes, compressed.mime)

        previous = persona.get("photo_ref")
        if previous and previous != new_path:
            try:
                await sup.remove_object(client, "avatars", previous)
            except Exception:
                pass

        await sup.update(
            client,
            "user_personas",
            {"id": f"eq.{persona['id']}"},
            {"photo_ref": new_path},
        )

    return {"photo_ref": new_path, "seed": seed}
