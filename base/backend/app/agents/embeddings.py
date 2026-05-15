"""Embedding agent — OpenAI-compatible /embeddings call (cycle 0029).

Memory is best-effort: this function returns None on any failure (non-200,
JSON decode, timeout, network). Callers treat None as "skip this request's
memory" — chat must never break because of memory.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger("storyplots.embeddings")


@dataclass
class EmbeddingCallConfig:
    base_url: str
    api_key: str
    model: str  # e.g., "text-embedding-3-small"


async def embed_text(cfg: EmbeddingCallConfig, text: str) -> list[float] | None:
    """POST {base_url}/embeddings with {model, input}. Returns the embedding
    vector on success, None on any failure. 10s timeout.
    """
    if not text or not text.strip():
        return None
    if not cfg.base_url or not cfg.api_key or not cfg.model:
        logger.warning("embed_text: missing base_url/api_key/model")
        return None

    url = cfg.base_url.rstrip("/") + "/embeddings"
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": cfg.model,
        "input": text,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                logger.warning(
                    "embed_text: provider returned %s: %s",
                    resp.status_code, resp.text[:200],
                )
                return None
            data = resp.json()
    except Exception as exc:
        logger.warning("embed_text: request failed: %s", exc)
        return None

    try:
        items = data.get("data") or []
        if not items:
            logger.warning("embed_text: empty data array in response")
            return None
        vector = items[0].get("embedding")
        if not isinstance(vector, list) or not vector:
            logger.warning("embed_text: no embedding array in first item")
            return None
        # Coerce to float list defensively.
        return [float(x) for x in vector]
    except Exception as exc:
        logger.warning("embed_text: response parse failed: %s", exc)
        return None
