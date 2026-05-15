"""
Cycle 0091 — route-side helper that bridges the domain-layer image
provider gate to FastAPI HTTPExceptions. Keeps `app.agents.image_provider`
free of web-framework imports while still letting routes call the gate
in one line.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status

from app.agents.image_provider import (
    UnsupportedProviderFamilyError,
    assert_family_supported,
)


def gate_image_provider_family(provider_row: dict[str, Any]) -> None:
    """Raise an HTTPException if the active image provider can't be
    invoked by the current dispatcher. 501 for known-future families
    (fal — wired in Cycles 0093/0094), 409 for unknown strings.

    Drop-in replacement for the previous `assert_family_supported`
    direct import at route call sites.
    """
    try:
        assert_family_supported(provider_row)
    except UnsupportedProviderFamilyError as exc:
        if exc.known_future:
            raise HTTPException(
                status.HTTP_501_NOT_IMPLEMENTED,
                (
                    f"{exc.family}.ai image generation lands in Cycles 0093 "
                    "(avatar) and 0094 (chat scene) — not yet enabled. "
                    "Switch to ComfyUI in Settings → Image Engine for now."
                ),
            ) from exc
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"unknown image provider family: {exc.family!r}",
        ) from exc
