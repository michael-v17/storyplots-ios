"""
Cycle 0091 — image-provider abstraction.

`ImageProvider` is the common interface that the dispatcher in
`routes/image.py` and `routes/avatar_generate.py` calls against. Concrete
implementations (`ComfyUIProvider`, `FalProvider`) are constructed per
request from the active `provider_configs` row and produce a
`ProviderResult` with bytes plus, where the engine surfaces one, an
external CDN URL captured at gen time (used by Cycle 0094's dual-store
display strategy).

Compression and Storage upload are NOT the provider's responsibility —
they live in the dispatcher path (Cycle 0092 owns the WebP step).
Keeping the provider thin lets each engine focus on "given prompt + refs
+ params, produce bytes".
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Any

# Families that the dispatcher knows how to invoke. Cycle 0093 lifts
# 'fal' for avatar_generate.py (dual-gen: preview + reference); Cycle
# 0094 will exercise the same family for image.py chat scenes.
SUPPORTED_PROVIDER_FAMILIES = frozenset({"comfyui", "fal"})


class UnsupportedProviderFamilyError(RuntimeError):
    """Raised when the dispatcher resolves an image provider whose
    `provider_family` isn't yet wired into the call paths. Routes catch
    and translate to a 501 (known-future engine, e.g. fal) or 409
    (unknown family). Pure domain exception — no FastAPI imports here
    so non-HTTP consumers (background tasks, CLI, tests) can use the
    abstraction without dragging in the web framework.
    """

    def __init__(self, family: str, *, known_future: bool) -> None:
        self.family = family
        self.known_future = known_future
        super().__init__(family)


def assert_family_supported(provider_row: dict[str, Any]) -> None:
    """Gate invoked right after the dispatcher resolves the active
    image provider row. Raises `UnsupportedProviderFamilyError` when
    the family isn't supported by the current call paths; no-op for
    supported families.

    Centralizing this lets cycles 0093/0094 expand
    SUPPORTED_PROVIDER_FAMILIES in one place when they wire the actual
    fal call sites.
    """
    family = (provider_row.get("provider_family") or "").lower()
    if family in SUPPORTED_PROVIDER_FAMILIES:
        return
    raise UnsupportedProviderFamilyError(family, known_future=(family == "fal"))


@dataclass
class ProviderResult:
    """One image generation result.

    `image_bytes` is always populated. `external_url` is set only when
    the engine's response includes a stable third-party URL (currently
    fal CDN). `external_url_captured_at` is the timestamp the URL was
    handed back — Cycle 0094's display logic treats <24h-old URLs as
    "render from CDN" to keep Egress off Supabase.
    """

    image_bytes: bytes
    external_url: str | None = None
    external_url_provider: str | None = None
    external_url_captured_at: datetime | None = None
    seed: int | None = None
    model: str | None = None


class ImageProvider(ABC):
    """Engine-agnostic interface for one-shot image generation calls."""

    @abstractmethod
    async def submit(
        self,
        positive: str,
        negative: str | None = None,
        refs: list[str] | None = None,
        seed: int | None = None,
        width: int | None = None,
        height: int | None = None,
    ) -> ProviderResult:
        """Run one image generation.

        Args:
            positive: main prompt text.
            negative: ComfyUI-style negative prompt; engines that don't
                support it (fal/Seedream) silently discard with a debug
                log.
            refs: optional reference image URLs. fal: passed as
                `image_urls` and routes to /edit instead of
                /text-to-image. ComfyUI: ignored (text-only path until a
                future cycle wires IP-Adapter / ControlNet).
            seed: deterministic seed (when supported).
            width / height: target dimensions (when supported).

        Raises:
            RuntimeError on engine errors. Callers map this to
            user-visible messages.
        """
        ...
