"""
Cycle 0093 — fal.ai avatar dual-gen helpers.

Two separate text-to-image calls per character/persona avatar:

  preview:    user-facing avatar (with scene/background; user prefix
              applies). Stored in characters.avatar_ref (or
              user_personas.photo_ref).
  reference:  white-bg half-body canonical view used as image_urls[0]
              when Cycle 0094 generates chat scenes. Stored in
              characters.reference_ref / user_personas.reference_ref.
              Deterministic prompt — user prefix does NOT apply because
              the reference's role is mechanical: feed Seedream a clean
              identity anchor, not let the user mood-stylize it.

Style picker (`users.preferences.image.style`, default 'anime') maps
each prompt's "render style" suffix. 'realistic' → photoreal; 'anime'
→ Seedream's anime mode; 'custom' → user's own template appended at
the end (Cycle 0095 polish wires the UI; 0093 reads the field
defensively in case the Settings cycle hasn't shipped yet).

The reference prompt template comes from Cycle 0090 Decision A — the
empirical research showed half-body whitebg gave the best face / outfit
fidelity cross-scene over multi-view turnaround.
"""

from __future__ import annotations

from typing import Any

# Style suffixes appended to prompts to nudge Seedream's render. fal /
# Seedream lacks a style enum; this is the prompt-template layer the
# Cycle 0090 research validated as the right approach.
_STYLE_SUFFIX = {
    "realistic": "photorealistic, sharp focus, natural lighting",
    "anime": "anime style, masterpiece, high detail, cel shading",
    # 'custom' — appended verbatim from users.preferences.image.custom_template.
}

# Cycle 0135 — sterile identity reference tokens.
#
# The `reference_ref` is consumed by fal's `/edit` endpoint as an
# IP-adapter / image-to-image anchor when chat scenes are generated
# (`routes/image.py` signs a 60-min URL and passes it as `image_urls[0]`).
# fal-ai/bytedance/seedream/v5/lite/edit does NOT expose a `strength` /
# `image_strength` / `denoise` / `guidance_scale` parameter (verified
# against fal's model API page 2026-05-14), so we cannot dial down how
# strongly the reference templates pose / clothing / expression / framing
# across every generated scene. The only available lever is making the
# reference itself neutral on those axes — body shape, face, complexion,
# distinctive marks stay; clothing, mood and pose are pinned to a model-
# sheet baseline so the chat refiner's prose dominates the scene look.
#
# The preview avatar (`avatar_ref`, shown in the UI) is unaffected — it
# keeps the character's `signature_style` and the user style prefix.
IDENTITY_REF_NEUTRAL_CLOTHING = (
    "plain white short-sleeve t-shirt, plain neutral gray pants, "
    "no jacket, no accessories, no jewelry, no hat"
)
IDENTITY_REF_NEUTRAL_EXPRESSION = (
    "neutral relaxed expression, mouth closed, calm"
)


def _style_suffix(style: str | None, custom_template: str | None) -> str:
    s = (style or "anime").lower()
    if s == "custom":
        return (custom_template or "").strip()
    return _STYLE_SUFFIX.get(s, _STYLE_SUFFIX["anime"])


def _physical_attrs_line(
    character: dict[str, Any],
    *,
    exclude_wardrobe: bool = False,
) -> str:
    """Compact descriptor of the canonical 11-attribute identity block
    (Cycle 0018). Re-mentioned in every fal prompt to guard against
    drift on color-specific traits per Cycle 0090 Decision C.

    When ``exclude_wardrobe=True`` the ``signature_style`` column is
    dropped from the descriptor — used by ``build_reference_prompt`` so
    the white-bg identity reference does not bake the character's
    signature outfit into the IP-adapter anchor (Cycle 0135). The
    preview path (``build_avatar_preview_prompt``) keeps the default
    ``exclude_wardrobe=False`` so the user-facing avatar still reflects
    the character's signature look.
    """
    parts: list[str] = []
    age = character.get("age")
    gender = character.get("gender")
    if age:
        parts.append(str(age))
    if gender and gender != "unspecified":
        parts.append(str(gender))
    cols = ("build", "height", "hair_color", "hair_style", "eye_color",
            "skin_tone", "distinctive_features", "signature_style")
    if exclude_wardrobe:
        cols = tuple(c for c in cols if c != "signature_style")
    for col in cols:
        v = character.get(col)
        if isinstance(v, str) and v.strip():
            parts.append(v.strip())
    if parts:
        return ", ".join(parts)
    # Fall back to the legacy free-form description (Cycle 0014 era).
    # Personas hit this path because their schema only has
    # `appearance_description`; we accept whatever the user typed there
    # rather than mangling it. Cycle 0135 leaves the persona case
    # untouched — when SCENE_STATE (pieza 2) lands it will give personas
    # a structured wardrobe slot too.
    appearance = character.get("appearance_description")
    return str(appearance).strip() if isinstance(appearance, str) else ""


def build_avatar_preview_prompt(
    *,
    character: dict[str, Any],
    style: str | None,
    custom_template: str | None,
    user_prefix: str | None,
    background_tags: str | None = None,
) -> str:
    """User-facing avatar prompt: prefix + identity + scene + style suffix.

    Args:
        character: row from `public.characters`.
        style: users.preferences.image.style ('realistic'|'anime'|'custom').
        custom_template: users.preferences.image.custom_template (style='custom').
        user_prefix: users.preferences.prompt_editor.avatar_prefix
            (free-form, may be empty / None — passes through verbatim).
        background_tags: optional scene/background context (e.g. from
            Cycle 0048's avatar_refine LLM). When present, adds to the
            scene framing; absent = neutral framing.
    """
    parts: list[str] = []
    prefix = (user_prefix or "").strip()
    if prefix:
        parts.append(prefix)
    identity = _physical_attrs_line(character)
    if identity:
        parts.append(identity)
    bg = (background_tags or "").strip()
    if bg:
        parts.append(bg)
    suffix = _style_suffix(style, custom_template)
    if suffix:
        parts.append(suffix)
    return ", ".join(p for p in parts if p)


def build_reference_prompt(
    *,
    character: dict[str, Any],
    style: str | None,
    custom_template: str | None,
) -> str:
    """Deterministic half-body whitebg reference prompt (Cycle 0090
    Decision A, Cycle 0135 sterile hardening). User prefix DOES NOT
    apply — the reference is mechanical, its job is identity-anchoring
    not mood.

    The phrasing builds on the Cycle 0090 matrix winner (half body
    portrait, neutral standing pose, plain white studio background, soft
    even lighting, looking at camera, sharp focus) and adds Cycle 0135's
    sterile tokens: identity is built with ``exclude_wardrobe=True`` so
    the character's signature_style does NOT enter this prompt, and the
    parts list pins clothing + expression to neutral baselines
    (``IDENTITY_REF_NEUTRAL_CLOTHING`` / ``IDENTITY_REF_NEUTRAL_EXPRESSION``).
    The contract: this reference image carries identity (face / body /
    complexion / marks) only — clothing, pose, expression, framing,
    lighting and mood for each chat scene come from the refiner prose
    (see ``prompts/image_refine_system_seedream.txt``).
    """
    identity = _physical_attrs_line(character, exclude_wardrobe=True)
    suffix = _style_suffix(style, custom_template)
    parts = [
        identity,
        "half body portrait, neutral standing pose",
        IDENTITY_REF_NEUTRAL_CLOTHING,
        IDENTITY_REF_NEUTRAL_EXPRESSION,
        "plain white studio background, soft even lighting",
        "looking at camera, sharp focus",
    ]
    if suffix:
        parts.append(suffix)
    return ", ".join(p for p in parts if p)
