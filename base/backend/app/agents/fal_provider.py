"""
Cycle 0091 — FalProvider scaffold.

Calls fal.ai via the `fal-client` Python SDK. Two routes inferred from
whether reference images are passed:
    submit(positive, refs=None)   → /text-to-image (avatars, references)
    submit(positive, refs=[...])  → /edit          (chat scenes w/ ref)

The model slug (e.g. `fal-ai/bytedance/seedream/v5/lite`) is passed at
construction time; the dispatcher reads it from the user's
`provider_configs.workflow_config.model_slug`. Every call also captures
the fal CDN URL so Cycle 0094's dual-store display strategy can render
from the CDN for the first 24h post-gen.

NOTE: this cycle (0091) only scaffolds the class. Cycles 0093 (avatar
dual-gen) and 0094 (chat scene gen) are the ones that actually invoke
it; today's dispatcher in `image.py` / `avatar_generate.py` continues to
route to ComfyUI.

Concurrency: the BYOK key is passed via `fal_client.AsyncClient(key=...)`
per call — never written to `os.environ`. This is the safe path for a
multi-tenant backend where two concurrent requests carry different
users' keys; the older module-level `fal_client.subscribe(...)` reads
`FAL_KEY` from env, which would race under concurrency.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import fal_client  # type: ignore[import-untyped]
import httpx

from app.agents.image_provider import ImageProvider, ProviderResult

logger = logging.getLogger(__name__)

DEFAULT_MODEL_SLUG = "fal-ai/bytedance/seedream/v5/lite"
DEFAULT_T2I_ENDPOINT = f"{DEFAULT_MODEL_SLUG}/text-to-image"
DEFAULT_EDIT_ENDPOINT = f"{DEFAULT_MODEL_SLUG}/edit"

# Bytes-fetch timeout for the fal CDN download. The image URL is
# returned synchronously after generation completes; downloading is
# typically <2s for a 3-4 MB png, so 60s is comfortable headroom.
_DOWNLOAD_TIMEOUT_S = 60.0


class FalProvider(ImageProvider):
    """Two endpoints, one provider.

    The user can configure the text-to-image endpoint (avatars + the
    white-bg reference) and the image-to-image / edit endpoint (chat
    scenes with reference images) independently. Different fal models
    can excel at different jobs — e.g. Imagen for clean t2i avatars,
    Seedream for character-anchored scene edits — so the Settings UI
    exposes them as two distinct slugs (Cycle 0093 follow-up).

    Backwards compat: callers may still pass `model_slug` (the legacy
    base form, e.g. `fal-ai/bytedance/seedream/v5/lite`) and we'll
    derive both endpoints by appending `/text-to-image` and `/edit`.
    """

    def __init__(
        self,
        api_key: str,
        *,
        t2i_endpoint: str | None = None,
        edit_endpoint: str | None = None,
        model_slug: str | None = None,
    ) -> None:
        if not api_key:
            raise RuntimeError("FalProvider: api_key is required")
        self.api_key = api_key

        if model_slug and not (t2i_endpoint or edit_endpoint):
            base = model_slug.rstrip("/")
            self.t2i_endpoint = f"{base}/text-to-image"
            self.edit_endpoint = f"{base}/edit"
        else:
            self.t2i_endpoint = (t2i_endpoint or DEFAULT_T2I_ENDPOINT).strip()
            self.edit_endpoint = (edit_endpoint or DEFAULT_EDIT_ENDPOINT).strip()

    @staticmethod
    def _image_size(width: int | None, height: int | None) -> Any:
        # fal accepts either a named preset (square_hd, portrait_4_3, …)
        # or `{width, height}` for arbitrary sizes. When dimensions are
        # provided we prefer the explicit form; otherwise default to a
        # safe portrait that matches typical avatar / scene framing.
        if width and height:
            return {"width": width, "height": height}
        return "portrait_4_3"

    async def submit(
        self,
        positive: str,
        negative: str | None = None,
        refs: list[str] | None = None,
        seed: int | None = None,
        width: int | None = None,
        height: int | None = None,
    ) -> ProviderResult:
        arguments: dict[str, Any] = {
            "prompt": positive,
            "image_size": self._image_size(width, height),
            "num_images": 1,
            "enable_safety_checker": False,
        }
        if seed is not None:
            arguments["seed"] = seed

        if refs:
            arguments["image_urls"] = refs
            endpoint = self.edit_endpoint
        else:
            endpoint = self.t2i_endpoint

        if negative:
            # Seedream / fal don't expose a negative-prompt knob.
            # Drop it explicitly so the call signature is clean.
            logger.debug(
                "FalProvider: dropping negative prompt (not supported by %s)",
                endpoint,
            )

        # Per-call client → per-call key. No env mutation, no global
        # state, safe under concurrent BYOK requests from different users.
        client = fal_client.AsyncClient(key=self.api_key)
        result = await client.subscribe(endpoint, arguments=arguments)

        images = result.get("images") or []
        if not images:
            raise RuntimeError(f"fal {endpoint} returned no images: {result}")
        image_url = images[0].get("url")
        if not image_url:
            raise RuntimeError(
                f"fal {endpoint} image entry missing url: {images[0]}"
            )

        # Download bytes via httpx (async, already a project dep).
        async with httpx.AsyncClient(timeout=_DOWNLOAD_TIMEOUT_S) as http:
            resp = await http.get(image_url)
            resp.raise_for_status()
            image_bytes = resp.content

        return ProviderResult(
            image_bytes=image_bytes,
            external_url=image_url,
            external_url_provider="fal",
            external_url_captured_at=datetime.now(timezone.utc),
            seed=result.get("seed") or seed,
            model=endpoint,
        )
