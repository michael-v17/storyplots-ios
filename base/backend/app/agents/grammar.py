"""Grammar Agent — single-pass JSON-mode correction.

Input: the user's raw message text ONLY. No Character, no history, no
conversation context. This is the bidirectional-isolation invariant from
domain.md §6 #2.

Output: structured JSON with corrected_text, explanation?, error_categories[],
edit_distance. JSON mode / structured outputs are explicitly permitted for
non-Conversation-Agent paths per creator-vision.md §7.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

_GRAMMAR_SYSTEM = (Path(__file__).parent.parent / "prompts" / "grammar_system.txt").read_text().strip()

# Cycle 0128 — correction-style blocks appended to the style-neutral base
# prompt. LITERAL fixes only outright errors and keeps the user's phrasing;
# NATURAL additionally rewrites grammatical-but-non-native phrasing into the
# idiomatic native version. Unknown values fall back to NATURAL.
_STYLE_LITERAL = (
    "\n\nCorrection style: LITERAL. Fix ONLY outright errors — grammar, "
    "spelling, punctuation, capitalization, mechanics, verb tense, "
    "subject-verb agreement, articles, prepositions, word order. Do NOT "
    "rephrase text that is free of outright errors, even when a native "
    "speaker would word it differently. Preserve the user's wording and "
    "sentence structure. Set already_correct=true when the message has no "
    "outright errors, even if it still sounds non-native."
)
_STYLE_NATURAL = (
    "\n\nCorrection style: NATURAL. Your job is to return EXACTLY what a "
    "native American English speaker would actually say to mean the same "
    "thing — phrasing that sounds good and normal, never stiff, textbook, "
    "or foreign. Go well beyond mechanical fixes:\n"
    "- Eliminate every word-for-word-translation pattern, unidiomatic "
    "collocation, awkward word choice, and clunky construction. If a phrase "
    "is grammatically valid but no native speaker would phrase it that way, "
    "it MUST be rewritten.\n"
    "- Restructure freely: change word order, swap words, split or join "
    "sentences, replace whole phrases with the idiom a native would reach "
    "for. The output should read like natural, casual conversational "
    "English, not a corrected version of the original.\n"
    "- The ONLY hard constraint is meaning: the rewrite says the SAME thing "
    "the user meant, with nothing added or dropped.\n"
    "- Example: 'she continue thinking while she reach home' is awkward and "
    "literal — a native would say something like 'she kept thinking the "
    "whole way home'.\n"
    "- The explanation names why the original sounded non-native.\n"
    "- Set already_correct=true ONLY when the message already sounds like "
    "natural native speech with nothing to improve — not merely when it is "
    "grammatically correct."
)


@dataclass
class GrammarResult:
    already_correct: bool
    corrected_text: str
    explanation: str | None
    error_categories: list[str]
    edit_distance: int | None


@dataclass
class GrammarCallConfig:
    base_url: str
    api_key: str
    model: str


async def run_grammar_agent(
    cfg: GrammarCallConfig,
    user_text: str,
    mode: str,
    correction_style: str,
) -> GrammarResult:
    system = _GRAMMAR_SYSTEM
    system += _STYLE_LITERAL if correction_style == "literal" else _STYLE_NATURAL
    if mode == "A":
        system += "\n\nSet explanation to null (the user has Mode A — correction only)."

    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": cfg.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_text},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": 1024,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            body = resp.text[:500]
            raise RuntimeError(f"Grammar Agent provider error {resp.status_code}: {body}")

        data = resp.json()
        raw = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            raise RuntimeError(f"Grammar Agent returned non-JSON: {raw[:200]}")

    return GrammarResult(
        already_correct=bool(parsed.get("already_correct", False)),
        corrected_text=str(parsed.get("corrected_text", user_text)),
        explanation=parsed.get("explanation") if mode == "B" else None,
        error_categories=parsed.get("error_categories", []),
        edit_distance=parsed.get("edit_distance"),
    )
