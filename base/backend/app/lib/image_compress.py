"""
Cycle 0092 — image compression pipeline (WebP, never PNG).

Every image that lands in Supabase Storage goes through this module.
Sources today: ComfyUI generation outputs, fal.ai generation outputs
(once Cycles 0093/0094 wire), user-pasted/imported avatars. Targets:

    kind="scene"     → max 2048 px, ≤500 KB, alpha preserved.
    kind="avatar"    → max 2048 px, ≤500 KB, alpha preserved.
    kind="reference" → max 1024 px, ≤350 KB (smaller because it's only
                       used as a Seedream `image_urls[0]` reference,
                       not directly rendered to the user).

The Cycle 0090 research run produced 3.5-4.2 MB PNGs from Seedream;
WebP at quality 82 lands the same images at 250-400 KB — ~93%
reduction per scene. Multiplied by the chat-scene volume of an active
session (50+ per character), this is the single largest Storage win
in the fal.ai migration roadmap.

Adaptive quality keeps WebP encoding deterministic enough to debug
while still honouring the size ceiling: start at 85, step down by 5
until the result fits or we hit 70 (the floor below which Seedream's
fine details — eye color, freckle texture — start washing out).
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import Literal

from PIL import Image, ImageFile

logger = logging.getLogger(__name__)

ImageKind = Literal["scene", "avatar", "reference"]


# Pillow's default decompression-bomb guard kicks in around 178 MP. fal /
# ComfyUI outputs cap at ~9 MP today; user uploads can technically be
# larger but are clamped via _MAX_DIM_PX below. We keep Pillow's default
# guard active. Truncated images (network drops mid-fetch) are still
# raised — opt out of silent loading.
ImageFile.LOAD_TRUNCATED_IMAGES = False


_MAX_DIM_PX: dict[ImageKind, int] = {
    "scene": 2048,
    "avatar": 2048,
    "reference": 1024,
}

_TARGET_KB: dict[ImageKind, int] = {
    "scene": 500,
    "avatar": 500,
    "reference": 350,
}

_QUALITY_START = 85
_QUALITY_FLOOR = 70
_QUALITY_STEP = 5


@dataclass(frozen=True)
class CompressionResult:
    """Compressed image ready for Storage upload.

    `mime` is always `image/webp`. The dispatcher uses `bytes_size` to
    populate `generated_images.bytes_size` for telemetry / billing.
    """

    bytes: bytes
    mime: str
    width: int
    height: int
    bytes_size: int
    quality_used: int


def compress_for_storage(image_bytes: bytes, kind: ImageKind = "scene") -> CompressionResult:
    """Compress arbitrary input bytes (PNG/JPEG/WebP/etc.) to WebP.

    Resizes if any dimension exceeds the kind's max. Adaptive quality
    re-encodes the same resized buffer until size fits or quality
    bottoms out at 70.

    Raises:
        ValueError: input is not a valid image.
        RuntimeError: PIL refused to encode (rare — corrupt input).
    """
    max_dim = _MAX_DIM_PX[kind]
    target_bytes = _TARGET_KB[kind] * 1024

    # Manage Pillow lifecycles explicitly: the source-context-manager
    # pattern (`with Image.open(...) as img: img = img.convert(...)`)
    # rebinds `img` mid-block, so the `with` exit closes the original
    # source object but never the converted/resized copy. Under
    # concurrent load that leaks pixel buffers until GC catches up.
    src = Image.open(io.BytesIO(image_bytes))
    img = src
    try:
        # Force decode + materialise so the BytesIO can be GC'd before
        # we re-encode. Ensures alpha-aware modes survive.
        img.load()
        original_size = (img.width, img.height)
        original_mode = img.mode

        # WebP supports RGB and RGBA cleanly. Coerce every other mode
        # (P, L, LA, CMYK, …) to whichever of those preserves the alpha
        # channel content. `P` carries alpha only when its palette has a
        # transparency entry; `LA` always does; everything else is opaque.
        if img.mode not in ("RGB", "RGBA"):
            has_alpha = img.mode == "LA" or (img.mode == "P" and "transparency" in img.info)
            img = img.convert("RGBA" if has_alpha else "RGB")

        # Resize once before quality search — quality dial doesn't
        # change geometry, so doing this inside the loop would re-do
        # the same resize on every iteration.
        if max(img.width, img.height) > max_dim:
            scale = max_dim / max(img.width, img.height)
            new_w = max(1, round(img.width * scale))
            new_h = max(1, round(img.height * scale))
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        final_w, final_h = img.width, img.height

        # Adaptive quality search. Track `quality_used` separately so
        # the post-loop telemetry / result reflects the quality of the
        # bytes we kept, not whatever value the loop counter held when
        # it exited (the decrement-then-test pattern would otherwise
        # report the value one step below the actual encode).
        quality = _QUALITY_START
        quality_used = _QUALITY_START
        out_bytes: bytes | None = None
        while quality >= _QUALITY_FLOOR:
            buf = io.BytesIO()
            try:
                img.save(buf, format="WEBP", quality=quality, method=4)
            except Exception as exc:  # pragma: no cover — Pillow is forgiving on encode
                raise RuntimeError(f"WebP encode failed at quality={quality}: {exc}") from exc
            out_bytes = buf.getvalue()
            quality_used = quality
            if len(out_bytes) <= target_bytes:
                break
            quality -= _QUALITY_STEP

        # Floor reached. Use the floor result even if still oversized —
        # going lossier than 70 produces visible artifacts; the caller
        # accepts the slight overshoot.
        if out_bytes is None:  # pragma: no cover — loop always runs once
            raise RuntimeError("compress_for_storage: empty output buffer")

        logger.info(
            "image_compress kind=%s in=%dKB out=%dKB ratio=%.2f dims=%dx%d→%dx%d quality=%d mode=%s→%s",
            kind,
            len(image_bytes) // 1024,
            len(out_bytes) // 1024,
            len(out_bytes) / max(1, len(image_bytes)),
            original_size[0],
            original_size[1],
            final_w,
            final_h,
            quality_used,
            original_mode,
            img.mode,
        )

        return CompressionResult(
            bytes=out_bytes,
            mime="image/webp",
            width=final_w,
            height=final_h,
            bytes_size=len(out_bytes),
            quality_used=quality_used,
        )
    finally:
        if img is not src:
            img.close()
        src.close()
