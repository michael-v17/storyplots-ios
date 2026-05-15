"""OpenAI-compatible streaming completion driver.

Emits a sequence of events the route layer can forward to SSE:
  {"type": "token", "text": <str>}
  {"type": "done",  "model": <str>, "usage": <dict or None>}

Any provider / transport / JSON error raises — the caller handles it and
forwards {"type": "error", "message": ...} to the client.

creator-vision.md §7 / architecture.md §9 #7: plain-text completion only.
No function calling, no tool schemas.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import AsyncIterator

import httpx


@dataclass
class ProviderCallConfig:
    base_url: str
    api_key: str
    model: str
    temperature: float | None
    max_tokens: int | None
    thinking_mode: bool
    # Cycle 0116 — sampler hygiene. Doc §1.1 RP-validated:
    # top_p 0.95, top_k 40, min_p 0.01, freq+presence penalty 0.
    # Forwarded to the upstream when non-None; absent fields silently ignored
    # by providers that don't honor them.
    top_p: float | None = None
    top_k: int | None = None
    min_p: float | None = None
    frequency_penalty: float | None = None
    presence_penalty: float | None = None


async def stream_completion(
    cfg: ProviderCallConfig,
    chat_messages: list[dict[str, str]],
) -> AsyncIterator[dict]:
    payload: dict = {
        "model": cfg.model,
        "messages": chat_messages,
        "stream": True,
    }
    if cfg.temperature is not None:
        payload["temperature"] = cfg.temperature
    if cfg.max_tokens is not None:
        payload["max_tokens"] = cfg.max_tokens
    # Cycle 0116 — sampler hygiene knobs from users.preferences.sampler.
    if cfg.top_p is not None:
        payload["top_p"] = cfg.top_p
    if cfg.top_k is not None and cfg.top_k > 0:
        payload["top_k"] = cfg.top_k
    if cfg.min_p is not None and cfg.min_p > 0:
        payload["min_p"] = cfg.min_p
    if cfg.frequency_penalty is not None:
        payload["frequency_penalty"] = cfg.frequency_penalty
    if cfg.presence_penalty is not None:
        payload["presence_penalty"] = cfg.presence_penalty
    # Thinking mode: OpenRouter accepts "reasoning": {"effort": ...}; OpenAI
    # accepts "reasoning_effort" at the top level for o-series models. Pass
    # both so either shape wins; providers ignore unknown fields.
    if cfg.thinking_mode:
        payload["reasoning"] = {"effort": "medium"}
        payload["reasoning_effort"] = "medium"

    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=300.0)) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as resp:
            if resp.status_code != 200:
                body = (await resp.aread()).decode("utf-8", errors="replace")
                raise RuntimeError(f"provider returned {resp.status_code}: {body[:500]}")

            model_reported: str | None = None
            usage: dict | None = None
            async for raw in resp.aiter_lines():
                if not raw or not raw.startswith("data: "):
                    continue
                data_str = raw[len("data: "):].strip()
                if data_str == "[DONE]":
                    break
                try:
                    event = json.loads(data_str)
                except json.JSONDecodeError:
                    continue
                if "model" in event and isinstance(event["model"], str):
                    model_reported = event["model"]
                if "usage" in event and isinstance(event["usage"], dict):
                    usage = event["usage"]
                choices = event.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                piece = delta.get("content")
                if isinstance(piece, str) and piece:
                    yield {"type": "token", "text": piece}

            yield {"type": "done", "model": model_reported or cfg.model, "usage": usage}


async def one_shot_probe(cfg: ProviderCallConfig) -> dict:
    """Minimal non-streaming call for Test Connection. Returns a small dict."""
    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": cfg.model,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 1,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            body = resp.text[:500]
            return {"ok": False, "status": resp.status_code, "error": body}
        return {"ok": True, "model": cfg.model}
