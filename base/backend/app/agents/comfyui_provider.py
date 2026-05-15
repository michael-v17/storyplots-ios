"""
Cycle 0091 — ComfyUIProvider wraps the existing comfyui.submit_and_wait flow.

Behavior-preserving shim: existing dispatchers stop calling submit_and_wait
directly and instead construct one of these per request, but the wire
behavior (workflow patching, polling, /view download) is unchanged.
"""

from __future__ import annotations

from typing import Any

from app.agents.comfyui import submit_and_wait
from app.agents.image_provider import ImageProvider, ProviderResult


class ComfyUIProvider(ImageProvider):
    def __init__(
        self,
        base_url: str,
        api_key: str | None,
        workflow: dict[str, Any],
        checkpoint: str | None = None,
        poll_timeout_s: float = 300.0,
    ) -> None:
        self.base_url = base_url
        self.api_key = api_key
        self.workflow = workflow
        self.checkpoint = checkpoint
        self.poll_timeout_s = poll_timeout_s

    async def submit(
        self,
        positive: str,
        negative: str | None = None,
        refs: list[str] | None = None,
        seed: int | None = None,
        width: int | None = None,
        height: int | None = None,
    ) -> ProviderResult:
        if seed is None:
            raise RuntimeError("ComfyUI requires an explicit seed")
        # `refs` deliberately ignored — ComfyUI as wired is text-only;
        # an IP-Adapter / ControlNet path is a separate future cycle.
        image_bytes = await submit_and_wait(
            base_url=self.base_url,
            api_key=self.api_key,
            workflow=self.workflow,
            positive=positive,
            negative=negative or "",
            seed=seed,
            width=width,
            height=height,
            checkpoint=self.checkpoint,
            poll_timeout_s=self.poll_timeout_s,
        )
        # external_url* fields are left at their dataclass defaults (None) —
        # ComfyUI never returns a stable external CDN URL.
        return ProviderResult(
            image_bytes=image_bytes,
            seed=seed,
            model=self.checkpoint,
        )
