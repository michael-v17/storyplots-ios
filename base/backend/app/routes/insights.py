"""POST /insights/run — Insights Job.

Reads grammar_corrections for the calling user, aggregates stats locally,
calls LLM for narrative assessment, writes grammar_aggregates, resets
dirty + counter. Never blocks the Dashboard render — the frontend fires
this in the background and renders cached values immediately.
"""

from __future__ import annotations

import json
import os
from collections import Counter
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status

from ..deps.jwt import AuthUser, verify_supabase_jwt
from ..deps.supabase import UserSupabase

router = APIRouter()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
_INSIGHTS_SYSTEM = (Path(__file__).parent.parent / "prompts" / "insights_system.txt").read_text().strip()

FILLER_WORDS = {
    "um", "uh", "like", "you know", "basically", "actually", "literally",
    "honestly", "right", "so", "well", "I mean", "kind of", "sort of",
    "just", "really", "very", "totally", "absolutely", "definitely",
}

CONNECTORS = {
    "however", "therefore", "moreover", "furthermore", "although",
    "because", "since", "while", "whereas", "nevertheless",
    "consequently", "meanwhile", "additionally", "in addition",
    "on the other hand", "as a result", "in fact", "for example",
    "such as", "in contrast", "similarly", "finally", "first",
    "second", "third", "then", "next", "also", "but", "and", "or",
    "so", "yet", "still",
}


def _user_client(authorization: str) -> UserSupabase:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    if not SUPABASE_ANON_KEY:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "SUPABASE_ANON_KEY not configured")
    return UserSupabase(jwt=token.strip(), apikey=SUPABASE_ANON_KEY)


def _aggregate_stats(corrections: list[dict]) -> dict:
    error_counter: Counter = Counter()
    filler_counter: Counter = Counter()
    word_counter: Counter = Counter()
    connector_counter: Counter = Counter()
    total_failures = 0
    total_corrections = len(corrections)

    for c in corrections:
        for cat in (c.get("error_categories") or []):
            error_counter[cat] += 1
        total_failures += c.get("reinforcement_failures_count", 0)

        text_lower = (c.get("original_text") or "").lower()
        words = text_lower.split()
        for w in words:
            clean = w.strip(".,!?;:\"'")
            if clean in FILLER_WORDS:
                filler_counter[clean] += 1
            if clean:
                word_counter[clean] += 1

        for conn in CONNECTORS:
            if conn in text_lower:
                connector_counter[conn] += 1

    top_errors = [{"category": cat, "count": cnt} for cat, cnt in error_counter.most_common(10)]
    filler_words = [{"word": w, "count": cnt} for w, cnt in filler_counter.most_common(10)]

    overused = [{"word": w, "count": cnt} for w, cnt in word_counter.most_common(20)
                if cnt >= 3 and w not in FILLER_WORDS and len(w) > 2][:10]

    connector_stats = [{"connector": c, "count": cnt} for c, cnt in connector_counter.most_common(10)]

    reinforcement_pct = None
    if total_corrections > 0:
        reinforcement_pct = round((total_failures / total_corrections) * 100, 1)

    return {
        "top_errors": top_errors,
        "filler_words": filler_words,
        "overused_words": overused,
        "connector_stats": connector_stats,
        "reinforcement_performance_pct": reinforcement_pct,
        "total_corrections": total_corrections,
    }


async def _llm_assessment(
    stats: dict,
    base_url: str,
    api_key: str,
    model: str,
) -> dict:
    summary = (
        f"Total corrections: {stats['total_corrections']}. "
        f"Top errors: {json.dumps(stats['top_errors'][:5])}. "
        f"Filler words: {json.dumps(stats['filler_words'][:5])}. "
        f"Overused words: {json.dumps(stats['overused_words'][:5])}."
    )
    url = base_url.rstrip("/") + "/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": _INSIGHTS_SYSTEM},
            {"role": "user", "content": summary},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.3,
        "max_tokens": 512,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            return {"detected_level": None, "ai_narrative_feedback": None, "improvement_suggestions": None}
        data = resp.json()
        raw = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"detected_level": None, "ai_narrative_feedback": raw[:500], "improvement_suggestions": None}


@router.post("/insights/run")
async def run_insights(
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(default=""),
):
    sup = _user_client(authorization)

    async with httpx.AsyncClient(timeout=30.0) as client:
        corrections = await sup.select(client, "grammar_corrections", {
            "select": "original_text,corrected_text,error_categories,reinforcement_failures_count",
            "user_id": f"eq.{user.id}",
            "order": "created_at.desc",
        })

        if not corrections:
            return {"ok": True, "message": "no corrections to analyze"}

        stats = _aggregate_stats(corrections)

        providers = await sup.select(client, "provider_configs", {
            "select": "base_url,model_id",
            "kind": "eq.text",
            "is_active": "eq.true",
            "limit": "1",
        })
        api_key = await sup.rpc(client, "get_active_text_key")

        llm_result = {"detected_level": None, "ai_narrative_feedback": None, "improvement_suggestions": None}
        if providers and api_key:
            p = providers[0]
            # Use grammar model override if set, else text engine model.
            users = await sup.select(client, "users", {
                "select": "preferences",
                "id": f"eq.{user.id}",
                "limit": "1",
            })
            prefs = (users[0].get("preferences") or {}) if users else {}
            grammar_prefs = prefs.get("grammar") or {}
            model = grammar_prefs.get("custom_model_id") or p.get("model_id") or ""
            llm_result = await _llm_assessment(stats, p.get("base_url") or "", api_key, model)

        aggregate_row = {
            "user_id": user.id,
            "detected_level": llm_result.get("detected_level"),
            "top_errors": stats["top_errors"],
            "filler_words": stats["filler_words"],
            "overused_words": stats["overused_words"],
            "connector_stats": stats["connector_stats"],
            "ai_narrative_feedback": llm_result.get("ai_narrative_feedback"),
            "improvement_suggestions": llm_result.get("improvement_suggestions"),
            "reinforcement_performance_pct": stats["reinforcement_performance_pct"],
        }

        # Pass the processed count so the RPC only drains by the amount the job
        # aggregated. Corrections written during the LLM call keep dirty=true
        # and leave a residue on new_messages_since_last_run.
        await sup.rpc(client, "upsert_grammar_aggregates", {
            "p_data": aggregate_row,
            "p_processed_corrections": len(corrections),
        })

    return {"ok": True, "total_corrections": stats["total_corrections"]}
