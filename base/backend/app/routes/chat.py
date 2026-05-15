"""POST /chat (SSE) + POST /providers/test.

/chat streams the Conversation Agent's reply to the active variant, creating
the assistant `messages` row + initial `message_variants` row on the fly.
Regenerate is the same endpoint with `regenerate_message_id` set — it adds
a NEW variant to that message and flips `active_variant_id`.
"""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, AsyncIterator

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import StreamingResponse

import asyncio

from ..agents.conversation import ProviderCallConfig, one_shot_probe, stream_completion
from ..agents.canon_regen import CanonRegenCallConfig, run_canon_regen
from ..agents.embeddings import EmbeddingCallConfig, embed_text
from ..agents.grammar import GrammarCallConfig, GrammarResult, run_grammar_agent
from ..agents.memory_extract import MemoryExtractCallConfig, run_memory_extract
from ..deps.jwt import AuthUser, verify_supabase_jwt
from ..deps.supabase import UserSupabase
from ..prompt_assembly import (
    VISUAL_ROLEPLAY_INSTRUCTIONS,
    PromptBundle,
    build_chat_messages,
)

logger = logging.getLogger("storyplots.chat")

router = APIRouter()


@router.get("/prompt-editor/visual-roleplay-default")
async def visual_roleplay_instructions_default(
    user: AuthUser = Depends(verify_supabase_jwt),
) -> dict:
    """Exposes the bundled Visual Roleplay Instructions default (cycle 0040).
    The Prompt Editor's Custom tab uses this to render a "Load default into
    the editor" button. The POV clause is NOT included here — POV is a
    structural modifier composed at prompt-assembly time.
    """
    del user
    return {"instructions": VISUAL_ROLEPLAY_INSTRUCTIONS}

SUPABASE_URL = os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")


def _pack_sse(kind: str, **fields: Any) -> bytes:
    return f"event: {kind}\ndata: {json.dumps(fields)}\n\n".encode("utf-8")


# Cycle 0120 — Proper-noun-ish heuristic for entity-anchored retrieval.
# Detects capitalized words that aren't at sentence-start position. Triggers
# the tsvector fallback when the query mentions someone or something by name.
_SENTENCE_START_RE = re.compile(r"(?:^|[.!?]\s+)([A-Z][a-zA-Z]+)")
_CAP_WORD_RE = re.compile(r"\b([A-Z][a-zA-Z]+)\b")

def _has_entity_token(text: str) -> bool:
    if not text or len(text) < 3:
        return False
    sentence_starts = set(_SENTENCE_START_RE.findall(text))
    for match in _CAP_WORD_RE.findall(text):
        if match in sentence_starts:
            continue
        # Skip the trivial "I" capitalization.
        if match.lower() in ("i", "i'm", "i'll", "i'd", "i've", "the", "a", "an"):
            continue
        return True
    return False


def _user_client(authorization: str) -> UserSupabase:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    if not SUPABASE_ANON_KEY:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "SUPABASE_ANON_KEY not configured")
    return UserSupabase(jwt=token.strip(), apikey=SUPABASE_ANON_KEY)


@dataclass
class _GrammarPrefs:
    master: bool
    inline_enabled: bool
    inline_mode: str  # "A" or "B"
    reinforcement_enabled: bool
    grammar_model_override: str | None
    correction_style: str  # "literal" or "natural" (cycle 0128)

@dataclass
class _Bundle:
    conversation: dict
    user_persona: dict | None
    messages_for_prompt: list[dict]  # {role, content}
    sfw_disabled: bool
    provider: dict
    api_key: str
    grammar: _GrammarPrefs
    last_user_text: str | None
    last_user_msg_id: str | None
    lorebook_entries: list[dict]
    authors_note: dict | None
    knowledge_budget_chars: int
    visual_roleplay_mode_auto: bool
    visual_roleplay_pov: str                 # cycle 0040; "first_person" | "third_person"
    visual_roleplay_instructions_custom: str | None  # cycle 0040; optional user override
    memory_facts: list[dict[str, str]]
    memory_enabled: bool             # user_global AND character_toggle; gates extraction
    memory_prefs: dict[str, Any]     # cadence, top_k, threshold, notifications_enabled
    rp_author_framing: bool          # cycle 0113 — Position 0 author frame
    rp_pacing: str                   # cycle 0113 — off | slow_burn | warm
    rp_style_anchor: bool            # cycle 0113 — depth-0 style anchor every turn
    # Cycle 0116 — sampler hygiene
    sampler_top_p: float
    sampler_top_k: int
    sampler_min_p: float
    sampler_frequency_penalty: float
    sampler_presence_penalty: float
    # Cycle 0119 — session resume text (T2 canon + elapsed-time recap).
    session_resume_text: str | None
    jwt_token: str                   # for post-SSE task


def _apply_char_rp_override(
    char_rp: object,
    author_framing: bool,
    pacing: str,
    style_anchor: bool,
) -> tuple[bool, str, str]:
    """Cycle 0130 — merge a per-character ``rp_overrides`` dict over the resolved
    global RP settings, key-by-key. A non-dict input (NULL / missing column) or
    an absent/invalid key leaves the corresponding global value untouched, so a
    character with no override behaves exactly as pre-0130.
    """
    if not isinstance(char_rp, dict):
        return author_framing, pacing, style_anchor
    if isinstance(char_rp.get("author_framing"), bool):
        author_framing = char_rp["author_framing"]
    if char_rp.get("pacing") in ("off", "slow_burn", "warm"):
        pacing = char_rp["pacing"]
    if isinstance(char_rp.get("style_anchor"), bool):
        style_anchor = char_rp["style_anchor"]
    return author_framing, pacing, style_anchor


async def _load_bundle(
    client: httpx.AsyncClient,
    sup: UserSupabase,
    user_id: str,
    conversation_id: str,
    jwt_token: str,
) -> _Bundle:
    convs = await sup.select(client, "conversations", {
        "select": "*",
        "id": f"eq.{conversation_id}",
        "limit": "1",
    })
    if not convs:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "conversation not found")
    conv = convs[0]

    user_persona: dict | None = None
    if conv.get("persona_id"):
        rows = await sup.select(client, "user_personas", {
            "select": "*",
            "id": f"eq.{conv['persona_id']}",
            "limit": "1",
        })
        user_persona = rows[0] if rows else None

    messages = await sup.select(client, "messages", {
        "select": "id,role,text,active_variant_id,created_at",
        "conversation_id": f"eq.{conversation_id}",
        "order": "created_at.asc",
    })

    # Fetch active variant content for each assistant message in one round-trip.
    assistant_variant_ids = [m["active_variant_id"] for m in messages
                             if m["role"] == "assistant" and m["active_variant_id"]]
    variant_content: dict[str, str] = {}
    if assistant_variant_ids:
        vs = await sup.select(client, "message_variants", {
            "select": "id,content",
            "id": f"in.({','.join(assistant_variant_ids)})",
        })
        variant_content = {v["id"]: v["content"] for v in vs}

    messages_for_prompt: list[dict] = []
    for m in messages:
        if m["role"] == "user":
            messages_for_prompt.append({"role": "user", "content": m.get("text") or ""})
        elif m["role"] == "assistant":
            active = m.get("active_variant_id")
            if active and active in variant_content:
                messages_for_prompt.append({"role": "assistant", "content": variant_content[active]})

    users = await sup.select(client, "users", {
        "select": "sfw_disabled,preferences",
        "id": f"eq.{user_id}",
        "limit": "1",
    })
    user_row = users[0] if users else {}
    sfw_disabled = bool(user_row.get("sfw_disabled", False))
    prefs = user_row.get("preferences") or {}
    g = prefs.get("grammar") or {}
    grammar = _GrammarPrefs(
        master=bool(g.get("master", False)),
        inline_enabled=bool(g.get("inline_enabled", False)),
        inline_mode=g.get("inline_mode", "A"),
        reinforcement_enabled=bool(g.get("reinforcement_enabled", False)),
        grammar_model_override=g.get("custom_model_id"),
        correction_style=g.get("correction_style", "natural"),
    )

    last_user_text: str | None = None
    last_user_msg_id: str | None = None
    for m in reversed(messages):
        if m["role"] == "user":
            last_user_text = m.get("text") or ""
            last_user_msg_id = m["id"]
            break

    providers = await sup.select(client, "provider_configs", {
        "select": "*",
        "kind": "eq.text",
        "is_active": "eq.true",
        "limit": "1",
    })
    if not providers:
        raise HTTPException(status.HTTP_409_CONFLICT, "no active text provider — configure one in Settings → Text Engine")
    provider = providers[0]

    api_key = await sup.rpc(client, "get_active_text_key")
    if not api_key:
        raise HTTPException(status.HTTP_409_CONFLICT, "active provider has no stored key")

    lorebook_entries = await sup.select(client, "lorebook_entries", {
        "select": "id,title,keywords,body,token_estimate",
        "conversation_id": f"eq.{conversation_id}",
    })
    notes = await sup.select(client, "authors_notes", {
        "select": "notes_text,injection_depth",
        "conversation_id": f"eq.{conversation_id}",
        "limit": "1",
    })
    authors_note = notes[0] if notes else None

    mem_prefs = (prefs.get("memory") or {}) if isinstance(prefs.get("memory"), dict) else {}
    knowledge_budget = mem_prefs.get("knowledge_budget") or 3500
    knowledge_budget_chars = int(knowledge_budget) * 4

    # Character Memory (cycle 0029): global toggle AND character toggle must be on.
    # Default global = False (opt-in); default character = True.
    mem_enabled_global = bool(mem_prefs.get("enabled", False))
    char_snap = conv.get("character_snapshot") or {}
    # Fall back to the live character row if the snapshot doesn't carry the key
    # (pre-0029 conversations have no character_memory_enabled in the snapshot).
    if "character_memory_enabled" in char_snap:
        mem_enabled_char = char_snap.get("character_memory_enabled") is not False
    else:
        chars = await sup.select(client, "characters", {
            "select": "character_memory_enabled",
            "id": f"eq.{conv['character_id']}",
            "limit": "1",
        })
        mem_enabled_char = bool(chars[0].get("character_memory_enabled", True)) if chars else True
    memory_enabled = mem_enabled_global and mem_enabled_char

    # Retrieval (position 8): embed the UNION of the prior assistant reply +
    # the current user turn, then vector-search memory_document_chunks scoped
    # to this conversation. Silent fallback to empty facts list on any
    # failure — chat must never break.
    #
    # Union-query rationale (cycle 0030): use BOTH last-assistant + current
    # user (continuity + responsiveness) so topic-change user turns still
    # retrieve relevant facts for the ongoing NPC thread. Capped at 4000
    # chars each (8000 combined) before truncation at the embed layer.
    memory_facts: list[dict[str, str]] = []
    last_assistant_text = ""
    for m in reversed(messages_for_prompt):
        if m.get("role") == "assistant" and isinstance(m.get("content"), str):
            candidate = m["content"].strip()
            if candidate:
                last_assistant_text = candidate
                break
    query_parts: list[str] = []
    if last_assistant_text:
        query_parts.append(last_assistant_text[:4000])
    user_part = (last_user_text or "").strip()
    if user_part:
        query_parts.append(user_part[:4000])
    query_text = "\n".join(query_parts).strip()

    if memory_enabled and query_text:
        try:
            emb_providers = await sup.select(client, "provider_configs", {
                "select": "base_url,model_id",
                "kind": "eq.embedding",
                "is_active": "eq.true",
                "limit": "1",
            })
            if emb_providers:
                emb_key = await sup.rpc(client, "get_active_embedding_key")
                if emb_key:
                    emb_cfg = EmbeddingCallConfig(
                        base_url=str(emb_providers[0].get("base_url") or ""),
                        api_key=str(emb_key),
                        model=str(emb_providers[0].get("model_id") or "text-embedding-3-small"),
                    )
                    vec = await embed_text(emb_cfg, query_text[:8000])
                    if vec is not None:
                        top_k = int(mem_prefs.get("retrieval_top_k") or 5)
                        thresh = float(mem_prefs.get("retrieval_similarity_threshold") or 0.5)
                        rows = await sup.rpc(client, "memory_search", {
                            "p_conversation_id": conversation_id,
                            "p_query_vec": vec,
                            "p_match_threshold": thresh,
                            "p_match_count": top_k,
                            "p_current_message_count": int(conv.get("message_count") or 0),
                            "p_recency_weight": float(mem_prefs.get("recency_weight") or 0.3),
                        })
                        t3_facts: list[dict[str, Any]] = []
                        if isinstance(rows, list):
                            t3_facts = [
                                {"fact": str(r.get("text") or ""),
                                 "score": float(r.get("score") or 0),
                                 "tier": "T3"}
                                for r in rows if r.get("text")
                            ]
                        # Cycle 0118 — T1 character-scoped retrieval in parallel.
                        # Lower threshold (more aggressive) per doc §9.10 since
                        # these are facts the character permanently knows.
                        t1_facts: list[dict[str, Any]] = []
                        character_id = conv.get("character_id")
                        if character_id:
                            t1_rows = await sup.rpc(client, "character_memory_search", {
                                "p_character_id": character_id,
                                "p_query_vec": vec,
                                "p_match_threshold": max(0.0, thresh - 0.1),
                                "p_match_count": top_k,
                            })
                            if isinstance(t1_rows, list):
                                t1_facts = [
                                    {"fact": str(r.get("content") or ""),
                                     "score": float(r.get("score") or 0),
                                     "tier": "T1"}
                                    for r in t1_rows if r.get("content")
                                ]
                        # Cycle 0120 — entity-anchored fallback. Heuristic:
                        # if the query window contains a proper-noun-ish token
                        # (capitalized word not at sentence start), also run
                        # the tsvector fallback. Catches cases where the user
                        # mentions someone by name and pure cosine misses the
                        # memory because prior wording was different.
                        if _has_entity_token(query_text):
                            try:
                                t3_ent = await sup.rpc(client, "memory_search_entity", {
                                    "p_conversation_id": conversation_id,
                                    "p_query_text": query_text[:1000],
                                    "p_match_count": top_k,
                                })
                                if isinstance(t3_ent, list):
                                    # Normalize tsvector rank to score scale. ts_rank
                                    # values are typically 0..0.1; multiply by 5 to
                                    # roughly compete with cosine 0..1 boosted scores.
                                    for r in t3_ent:
                                        if r.get("text"):
                                            t3_facts.append({
                                                "fact": str(r.get("text") or ""),
                                                "score": float(r.get("rank") or 0) * 5.0 + 0.3,
                                                "tier": "T3-entity",
                                            })
                            except Exception as exc:
                                logger.warning("entity fallback T3 failed: %s", exc)
                            if character_id:
                                try:
                                    t1_ent = await sup.rpc(client, "character_memory_search_entity", {
                                        "p_character_id": character_id,
                                        "p_query_text": query_text[:1000],
                                        "p_match_count": top_k,
                                    })
                                    if isinstance(t1_ent, list):
                                        for r in t1_ent:
                                            if r.get("content"):
                                                t1_facts.append({
                                                    "fact": str(r.get("content") or ""),
                                                    "score": float(r.get("rank") or 0) * 5.0 + 0.4,
                                                    "tier": "T1-entity",
                                                })
                                except Exception as exc:
                                    logger.warning("entity fallback T1 failed: %s", exc)

                        # Merge + rerank: combined top_k, dedupe by fact text,
                        # T1 keeps its score (already includes higher boosts).
                        seen: set[str] = set()
                        merged: list[dict[str, Any]] = []
                        for f in sorted(t3_facts + t1_facts, key=lambda x: x["score"], reverse=True):
                            key = f["fact"].strip().lower()
                            if key in seen or not key:
                                continue
                            seen.add(key)
                            merged.append({"fact": f["fact"]})
                            if len(merged) >= top_k:
                                break
                        memory_facts = merged
        except Exception as exc:
            logger.warning("memory retrieval failed: %s", exc)

    # Cycle 0113 — Roleplay scaffolding defaults. Missing key → defaults
    # (author_framing on, pacing slow_burn, style_anchor on) per migration
    # 0039 + coalesce contract documented in plan 0113.
    rp_prefs = prefs.get("rp") if isinstance(prefs.get("rp"), dict) else {}
    rp_author_framing = bool(rp_prefs.get("author_framing", True))
    rp_pacing_raw = rp_prefs.get("pacing", "slow_burn")
    rp_pacing = rp_pacing_raw if rp_pacing_raw in ("off", "slow_burn", "warm") else "slow_burn"
    rp_style_anchor = bool(rp_prefs.get("style_anchor", True))

    # Cycle 0130 — per-character override. characters.rp_overrides is snapshotted
    # into character_snapshot at conversation creation; pre-0130 conversations
    # have no such key, so fall back to the live character row (same pattern as
    # character_memory_enabled above). The merge itself is _apply_char_rp_override.
    char_rp = char_snap.get("rp_overrides")
    if not isinstance(char_rp, dict) and "rp_overrides" not in char_snap:
        rp_rows = await sup.select(client, "characters", {
            "select": "rp_overrides",
            "id": f"eq.{conv['character_id']}",
            "limit": "1",
        })
        char_rp = rp_rows[0].get("rp_overrides") if rp_rows else None
    rp_author_framing, rp_pacing, rp_style_anchor = _apply_char_rp_override(
        char_rp, rp_author_framing, rp_pacing, rp_style_anchor,
    )

    # Cycle 0116 — sampler hygiene. Doc §1.1 RP-validated defaults applied
    # when the user has no values set (i.e. fresh install behavior).
    sampler_prefs = prefs.get("sampler") if isinstance(prefs.get("sampler"), dict) else {}
    sampler_top_p = sampler_prefs.get("top_p")
    sampler_top_k = sampler_prefs.get("top_k")
    sampler_min_p = sampler_prefs.get("min_p")
    sampler_freq_penalty = sampler_prefs.get("frequency_penalty")
    sampler_presence_penalty = sampler_prefs.get("presence_penalty")
    # Apply doc-validated defaults at request time when the user hasn't set
    # them. Existing users with no sampler key get the doc defaults from
    # day one (no migration backfill needed).
    if sampler_top_p is None: sampler_top_p = 0.95
    if sampler_top_k is None: sampler_top_k = 40
    if sampler_min_p is None: sampler_min_p = 0.01
    if sampler_freq_penalty is None: sampler_freq_penalty = 0.0
    if sampler_presence_penalty is None: sampler_presence_penalty = 0.0

    # Cycle 0119 — Session resume. If the last assistant message is older than
    # the threshold (default 4h), build a "[Session context: ...]" string from
    # the T2 character_canon (if any) + elapsed time. This is injected as
    # Position 0.5 in the system prompt for the first user turn back; once
    # the user sends a fresh message and the conversation accumulates new
    # turns, the gap closes and the block stops appearing on subsequent
    # requests in the same session.
    session_resume_text: str | None = None
    try:
        SESSION_GAP_HOURS = 4.0
        char_id_for_resume = conv.get("character_id")
        if char_id_for_resume and messages:
            # Find the most recent assistant message timestamp.
            last_assistant_at: str | None = None
            for m in reversed(messages):
                if m.get("role") == "assistant" and m.get("created_at"):
                    last_assistant_at = m["created_at"]
                    break
            if last_assistant_at:
                from datetime import datetime, timezone, timedelta
                # Supabase timestamps come back as ISO 8601 with TZ.
                last_dt = datetime.fromisoformat(last_assistant_at.replace("Z", "+00:00"))
                now_dt = datetime.now(timezone.utc)
                gap = now_dt - last_dt
                if gap >= timedelta(hours=SESSION_GAP_HOURS):
                    # Format elapsed time humanely.
                    days = gap.days
                    hours = int(gap.seconds // 3600)
                    if days >= 14:
                        elapsed = f"about {days // 7} weeks"
                    elif days >= 2:
                        elapsed = f"{days} days"
                    elif days == 1:
                        elapsed = "about a day"
                    else:
                        elapsed = f"about {max(1, hours)} hours"
                    # Pull T2 canon if it exists.
                    canon_rows = await sup.select(client, "character_canon", {
                        "select": "content",
                        "user_id": f"eq.{user_id}",
                        "character_id": f"eq.{char_id_for_resume}",
                        "limit": "1",
                    })
                    canon_text = (canon_rows[0].get("content") or "").strip() if canon_rows else ""
                    char_name = (conv.get("character_snapshot") or {}).get("name") or "the character"
                    if canon_text:
                        session_resume_text = (
                            f"[Session context: It has been {elapsed} since {char_name} last spoke "
                            f"with the user.\n\nRelationship summary (in {char_name}'s voice):\n"
                            f"{canon_text}\n\n{char_name} has had intervening time to think, get "
                            "distracted by their own life, possibly cool off or escalate. They are "
                            "not picking up exactly where they left off emotionally — they have "
                            "lived intervening time.]"
                        )
                    else:
                        # Degraded version with elapsed-time only when canon hasn't been generated yet.
                        session_resume_text = (
                            f"[Session context: It has been {elapsed} since {char_name} last spoke "
                            f"with the user. {char_name} has had intervening time to think and "
                            "live their own life; they are not picking up exactly where they left "
                            "off emotionally.]"
                        )
    except Exception as exc:
        logger.warning("session resume build failed: %s", exc)

    vr_prefs = prefs.get("visual_roleplay") if isinstance(prefs.get("visual_roleplay"), dict) else {}
    image_prefs = prefs.get("image") if isinstance(prefs.get("image"), dict) else {}
    image_enabled = bool(image_prefs.get("enabled"))
    visual_roleplay_mode_auto = image_enabled and (vr_prefs.get("mode") == "auto")
    # Cycle 0040: POV selector + optional custom VR instructions.
    pov_raw = vr_prefs.get("pov")
    visual_roleplay_pov = "third_person" if pov_raw == "third_person" else "first_person"
    prompt_editor_prefs = prefs.get("prompt_editor") if isinstance(prefs.get("prompt_editor"), dict) else {}
    vr_custom_raw = prompt_editor_prefs.get("visual_roleplay_instructions")
    visual_roleplay_instructions_custom = vr_custom_raw if isinstance(vr_custom_raw, str) and vr_custom_raw.strip() else None

    return _Bundle(
        conversation=conv,
        user_persona=user_persona,
        messages_for_prompt=messages_for_prompt,
        sfw_disabled=sfw_disabled,
        provider=provider,
        api_key=api_key,
        grammar=grammar,
        last_user_text=last_user_text,
        last_user_msg_id=last_user_msg_id,
        lorebook_entries=lorebook_entries,
        authors_note=authors_note,
        knowledge_budget_chars=knowledge_budget_chars,
        visual_roleplay_mode_auto=visual_roleplay_mode_auto,
        visual_roleplay_pov=visual_roleplay_pov,
        visual_roleplay_instructions_custom=visual_roleplay_instructions_custom,
        memory_facts=memory_facts,
        memory_enabled=memory_enabled,
        memory_prefs=mem_prefs,
        rp_author_framing=rp_author_framing,
        rp_pacing=rp_pacing,
        rp_style_anchor=rp_style_anchor,
        sampler_top_p=float(sampler_top_p),
        sampler_top_k=int(sampler_top_k),
        sampler_min_p=float(sampler_min_p),
        sampler_frequency_penalty=float(sampler_freq_penalty),
        sampler_presence_penalty=float(sampler_presence_penalty),
        session_resume_text=session_resume_text,
        jwt_token=jwt_token,
    )


def _build_extraction_turns(history: list[dict], assistant_reply: str) -> list[dict[str, str]]:
    """Last 6 messages + the just-finalized assistant reply as oldest→newest.
    History entries are {role, content} shaped."""
    turns: list[dict[str, str]] = []
    for m in history[-5:]:
        role = str(m.get("role") or "")
        content = str(m.get("content") or "")
        if content.strip() and role in ("user", "assistant"):
            turns.append({"role": role, "content": content})
    if assistant_reply.strip():
        # The accumulated reply isn't yet in history at this point, append it.
        turns.append({"role": "assistant", "content": assistant_reply})
    return turns


async def _run_memory_extraction_task(
    jwt_token: str,
    conversation_id: str,
    character_id: str | None,
    character_name: str,
    recent_turns: list[dict[str, str]],
    sfw_disabled: bool,
    extraction_prompt_override: str | None = None,
    character_description: str | None = None,
) -> None:
    """Fire-and-forget background task that runs post-SSE. Re-fetches the
    text + embedding providers under the caller's JWT, runs memory_extract,
    embeds each fact, and inserts memory_documents + memory_document_chunks.
    All failures are logged + swallowed.
    """
    try:
        if not jwt_token or not SUPABASE_ANON_KEY:
            return
        sup = UserSupabase(jwt=jwt_token, apikey=SUPABASE_ANON_KEY)
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Text provider (for extraction LLM call)
            text_providers = await sup.select(client, "provider_configs", {
                "select": "base_url,model_id",
                "kind": "eq.text",
                "is_active": "eq.true",
                "limit": "1",
            })
            if not text_providers:
                return
            text_key = await sup.rpc(client, "get_active_text_key")
            if not text_key:
                return

            # Embedding provider (for chunk vectorization)
            emb_providers = await sup.select(client, "provider_configs", {
                "select": "base_url,model_id",
                "kind": "eq.embedding",
                "is_active": "eq.true",
                "limit": "1",
            })
            if not emb_providers:
                return
            emb_key = await sup.rpc(client, "get_active_embedding_key")
            if not emb_key:
                return

            extract_cfg = MemoryExtractCallConfig(
                base_url=str(text_providers[0].get("base_url") or ""),
                api_key=str(text_key),
                model=str(text_providers[0].get("model_id") or ""),
            )
            facts = await run_memory_extract(
                extract_cfg,
                recent_turns,
                character_name,
                sfw_disabled,
                system_prompt_override=extraction_prompt_override,
                character_description=character_description,
            )
            if not facts:
                return

            emb_cfg = EmbeddingCallConfig(
                base_url=str(emb_providers[0].get("base_url") or ""),
                api_key=str(emb_key),
                model=str(emb_providers[0].get("model_id") or "text-embedding-3-small"),
            )

            # Fetch user_id from JWT via the first select we do against users.
            users = await sup.select(client, "users", {
                "select": "id",
                "limit": "1",
            })
            if not users:
                logger.warning("memory extraction: no user row for JWT")
                return
            user_id = users[0]["id"]

            # Cycle 0031 — stamp each chunk with the conversation's current
            # message_count so retrieval can compute message-distance recency.
            convs = await sup.select(client, "conversations", {
                "select": "message_count",
                "id": f"eq.{conversation_id}",
                "limit": "1",
            })
            current_count = int(convs[0].get("message_count") or 0) if convs else 0

            # Cycle 0118 — character_id is now passed in as a parameter
            # (was attempting to read from out-of-scope `bundle`).

            # One memory_documents row groups all facts from this extraction.
            doc_title = facts[0].topic[:60] if facts else "Auto-extracted memory"
            doc_row = await sup.insert(client, "memory_documents", {
                "user_id": user_id,
                "conversation_id": conversation_id,
                "title": doc_title,
                "source_type": "conversation_extract",
            })
            doc_id = doc_row["id"]

            for idx, fact in enumerate(facts):
                vec = await embed_text(emb_cfg, fact.fact)
                if vec is None:
                    continue
                # T3 (per-conversation) — always write here.
                await sup.insert(client, "memory_document_chunks", {
                    "memory_document_id": doc_id,
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "chunk_index": idx,
                    "text": fact.fact,
                    "token_estimate": max(1, len(fact.fact) // 4),
                    "embedding": vec,
                    "message_count_at_creation": current_count,
                    "topic": fact.topic,
                    "significance": fact.significance,
                })
                # Cycle 0118 — T1 (character-scoped, cross-conv) promotion.
                # Rule: significance >= 4 OR topic in (promise|boundary|relationship).
                # These are the items the doc §9.5 says should outlive the
                # conversation they happened in.
                if character_id and (
                    fact.significance >= 4
                    or fact.topic in ("promise", "boundary", "relationship")
                ):
                    await sup.insert(client, "character_memories", {
                        "user_id": user_id,
                        "character_id": character_id,
                        "source_conversation_id": conversation_id,
                        "topic": fact.topic,
                        "significance": fact.significance,
                        "content": fact.fact,
                        "embedding": vec,
                    })

            # Cycle 0119 — T2 canon regeneration. Trigger when N new T1
            # memories have accumulated since the canon was last generated.
            # Default threshold: 5 (doc §9.5 reference).
            if character_id:
                try:
                    t1_rows = await sup.select(client, "character_memories", {
                        "select": "id,content,topic,significance,created_at",
                        "user_id": f"eq.{user_id}",
                        "character_id": f"eq.{character_id}",
                        "order": "created_at.asc",
                    })
                    t1_count = len(t1_rows) if isinstance(t1_rows, list) else 0
                    canon_rows = await sup.select(client, "character_canon", {
                        "select": "source_memory_count",
                        "user_id": f"eq.{user_id}",
                        "character_id": f"eq.{character_id}",
                        "limit": "1",
                    })
                    canon_src = int(canon_rows[0].get("source_memory_count") or 0) if canon_rows else 0
                    if t1_count > 0 and (t1_count - canon_src) >= 5:
                        # character_name is the function param; use it directly.
                        canon_cfg = CanonRegenCallConfig(
                            base_url=extract_cfg.base_url,
                            api_key=extract_cfg.api_key,
                            model=extract_cfg.model,
                        )
                        new_canon = await run_canon_regen(canon_cfg, character_name or "the character", t1_rows or [])
                        if new_canon:
                            # Upsert via PostgREST: POST with Prefer: resolution=merge-duplicates.
                            upsert_url = f"{SUPABASE_URL}/rest/v1/character_canon"
                            upsert_headers = {
                                "Authorization": f"Bearer {jwt_token}",
                                "apikey": SUPABASE_ANON_KEY,
                                "Content-Type": "application/json",
                                "Prefer": "resolution=merge-duplicates,return=minimal",
                            }
                            await client.post(upsert_url, headers=upsert_headers, json={
                                "user_id": user_id,
                                "character_id": character_id,
                                "content": new_canon,
                                "source_memory_count": t1_count,
                            })
                except Exception as exc:
                    logger.warning("canon regen failed: %s", exc)
    except Exception as exc:
        logger.warning("memory extraction task failed: %s", exc)


def _generation_params_snapshot(provider: dict) -> dict:
    return {
        "provider_family": provider.get("provider_family"),
        "base_url": provider.get("base_url"),
        "temperature": provider.get("temperature"),
        "max_tokens": provider.get("max_tokens"),
        "context_length": provider.get("context_length"),
        "thinking_mode": provider.get("thinking_mode"),
    }


async def _stream_npc_reply(
    db_client: httpx.AsyncClient,
    sup: UserSupabase,
    bundle: _Bundle,
    conversation_id: str,
    msg_id: str | None,
    regenerate: bool,
) -> AsyncIterator[bytes]:
    """Stream the Conversation Agent reply (shared by default + reinforcement paths)."""
    if regenerate:
        if bundle.messages_for_prompt and bundle.messages_for_prompt[-1]["role"] == "assistant":
            bundle.messages_for_prompt.pop()
    elif msg_id is None:
        new_msg = await sup.insert(db_client, "messages", {
            "conversation_id": conversation_id,
            "role": "assistant",
        })
        msg_id = new_msg["id"]

    chat_messages = build_chat_messages(PromptBundle(
        character_snapshot=bundle.conversation.get("character_snapshot") or {},
        writing_style_snapshot=bundle.conversation.get("writing_style_snapshot") or {},
        user_persona=bundle.user_persona,
        messages=bundle.messages_for_prompt,
        current_user_text=None,
        sfw_disabled=bundle.sfw_disabled,
        lorebook_entries=bundle.lorebook_entries,
        authors_note=bundle.authors_note,
        knowledge_budget_chars=bundle.knowledge_budget_chars,
        parent_branch_summary=bundle.conversation.get("parent_branch_summary"),
        visual_roleplay_mode_auto=bundle.visual_roleplay_mode_auto,
        visual_roleplay_pov=bundle.visual_roleplay_pov,
        visual_roleplay_instructions_custom=bundle.visual_roleplay_instructions_custom,
        memory_facts=bundle.memory_facts,
        rp_author_framing=bundle.rp_author_framing,
        rp_pacing=bundle.rp_pacing,
        rp_style_anchor=bundle.rp_style_anchor,
        session_resume_text=bundle.session_resume_text,
    ))

    variant = await sup.insert(db_client, "message_variants", {
        "message_id": msg_id,
        "content": "",
        "model_snapshot": bundle.provider.get("model_id") or "",
        "generation_params_snapshot": _generation_params_snapshot(bundle.provider),
    })
    variant_id = variant["id"]
    yield _pack_sse("start", message_id=msg_id, variant_id=variant_id)

    cfg = ProviderCallConfig(
        base_url=bundle.provider.get("base_url") or "",
        api_key=bundle.api_key,
        model=bundle.provider.get("model_id") or "",
        temperature=bundle.provider.get("temperature"),
        max_tokens=bundle.provider.get("max_tokens"),
        thinking_mode=bool(bundle.provider.get("thinking_mode")),
        top_p=bundle.sampler_top_p,
        top_k=bundle.sampler_top_k,
        min_p=bundle.sampler_min_p,
        frequency_penalty=bundle.sampler_frequency_penalty,
        presence_penalty=bundle.sampler_presence_penalty,
    )

    accumulated: list[str] = []
    stream_error_msg: str | None = None
    try:
        async for ev in stream_completion(cfg, chat_messages):
            if ev["type"] == "token":
                accumulated.append(ev["text"])
                yield _pack_sse("token", text=ev["text"])
    except Exception as exc:  # noqa: BLE001 — surface provider failure to user
        stream_error_msg = str(exc) or f"{type(exc).__name__}"
        logger.warning(
            "chat stream failed: %s (model=%s base_url=%s tokens_received=%d)",
            exc,
            bundle.provider.get("model_id"),
            bundle.provider.get("base_url"),
            len(accumulated),
            exc_info=True,
        )

    # Detect degenerate model output — empty, single asterisk, lone
    # punctuation. These all render as nonsense bubbles ("*" / "" / "...")
    # so we surface a real error instead of persisting them as a valid
    # reply. The model snapshot + token count log lets the operator
    # diagnose whether it's a max_tokens cap, content filter, refiner
    # loop, or provider hiccup.
    final_content = "".join(accumulated).strip()
    is_degenerate = (
        stream_error_msg is None
        and final_content in {"", "*", "**", "_", '"', "'", "…", "...", "—", "-"}
    )
    if is_degenerate:
        stream_error_msg = (
            f"Model returned only {final_content!r} — the response was "
            "empty or truncated. Check max_tokens / model id, or try regenerating."
        )
        logger.warning(
            "chat stream degenerate output: content=%r model=%s base_url=%s prompt_msgs=%d",
            final_content,
            bundle.provider.get("model_id"),
            bundle.provider.get("base_url"),
            len(chat_messages),
        )

    if stream_error_msg is not None:
        # Persist empty content so the variant row isn't a phantom "*"
        # bubble forever in the conversation history. Active variant
        # pointer still updates so the regenerate flow has an anchor.
        await sup.update(db_client, "message_variants",
                         {"id": f"eq.{variant_id}"},
                         {"content": ""})
        await sup.update(db_client, "messages",
                         {"id": f"eq.{msg_id}"},
                         {"active_variant_id": variant_id})
        yield _pack_sse("error", message=stream_error_msg)
        return  # Skip memory extraction + done event on failed turn.

    await sup.update(db_client, "message_variants",
                     {"id": f"eq.{variant_id}"},
                     {"content": "".join(accumulated)})
    await sup.update(db_client, "messages",
                     {"id": f"eq.{msg_id}"},
                     {"active_variant_id": variant_id})

    # Post-turn memory extraction (cycle 0029). Fire-and-forget: must never
    # block or fail the SSE stream. Gated on memory_enabled + cadence.
    try:
        if bundle.memory_enabled and not regenerate:
            cadence = int(bundle.memory_prefs.get("auto_extract_cadence_turns") or 3)
            if cadence > 0:
                # Count ASSISTANT messages after this one persists.
                # The current assistant variant was just saved above.
                asst_rows = await sup.select(db_client, "messages", {
                    "select": "id",
                    "conversation_id": f"eq.{conversation_id}",
                    "role": "eq.assistant",
                })
                # Cycle 0121 — subtract 1 for the greeting (cycle 0025 auto-
                # inserts the character's first message as an assistant row at
                # conversation creation, which inflates the count by 1). Without
                # the offset, cadence=3 misses greeting+3 turns (4 % 3 ≠ 0).
                # Effective trigger: every `cadence` user-driven assistant
                # replies after the greeting.
                asst_count = max(0, len(asst_rows) - 1)
                if asst_count > 0 and asst_count % cadence == 0:
                    assistant_reply = "".join(accumulated)
                    char_snap = bundle.conversation.get("character_snapshot") or {}
                    # Cycle 0030 — editable extraction prompt from user prefs.
                    # Empty/missing → backend default. Placeholders {name} and
                    # {description} substitute into the override string.
                    raw_override = bundle.memory_prefs.get("extraction_prompt")
                    extraction_prompt_override = (
                        raw_override.strip() if isinstance(raw_override, str) and raw_override.strip() else None
                    )
                    asyncio.create_task(_run_memory_extraction_task(
                        jwt_token=bundle.jwt_token,
                        conversation_id=conversation_id,
                        character_id=bundle.conversation.get("character_id"),
                        character_name=str(char_snap.get("name") or "character"),
                        recent_turns=_build_extraction_turns(bundle.messages_for_prompt, assistant_reply),
                        sfw_disabled=bundle.sfw_disabled,
                        extraction_prompt_override=extraction_prompt_override,
                        character_description=str(char_snap.get("system_prompt") or ""),
                    ))
    except Exception as exc:
        logger.warning("memory extraction enqueue failed: %s", exc)

    yield _pack_sse("done", message_id=msg_id, variant_id=variant_id)


async def _run_grammar_and_persist(
    db_client: httpx.AsyncClient,
    sup: UserSupabase,
    bundle: _Bundle,
    user_id: str,
    conversation_id: str,
    user_message_id: str,
    user_text: str,
) -> GrammarResult:
    """Run the Grammar Agent and write the grammar_corrections row."""
    grammar_model = bundle.grammar.grammar_model_override or bundle.provider.get("model_id") or ""
    gcfg = GrammarCallConfig(
        base_url=bundle.provider.get("base_url") or "",
        api_key=bundle.api_key,
        model=grammar_model,
    )
    result = await run_grammar_agent(
        gcfg, user_text, bundle.grammar.inline_mode, bundle.grammar.correction_style,
    )

    if not result.already_correct:
        await sup.insert(db_client, "grammar_corrections", {
            "user_message_id": user_message_id,
            "conversation_id": conversation_id,
            "user_id": user_id,
            "original_text": user_text,
            "corrected_text": result.corrected_text,
            "explanation": result.explanation,
            "error_categories": result.error_categories,
            "edit_distance": result.edit_distance,
        })
        # Mark aggregates dirty + increment counter.
        await sup.rpc(db_client, "upsert_grammar_dirty", {"p_user_id": user_id})

    return result


@router.post("/chat")
async def chat(
    request: Request,
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(default=""),
) -> StreamingResponse:
    body = await request.json()
    conversation_id = body.get("conversation_id")
    regenerate_message_id = body.get("regenerate_message_id")
    reinforcement_pass = bool(body.get("reinforcement_pass"))
    reinforcement_exhausted = bool(body.get("reinforcement_exhausted"))
    reinforcement_user_message_id = body.get("reinforcement_user_message_id")
    # Actual count of failed reinforcement attempts (frontend RewriteGate
    # tracks strikes locally and sends the final count on pass or exhausted).
    # Domain §2.14 — this field drives the Insights reinforcement_performance_pct.
    reinforcement_failures = max(0, int(body.get("reinforcement_failures") or 0))
    if not conversation_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "conversation_id required")

    sup = _user_client(authorization)
    jwt_token = authorization.partition(" ")[2].strip()

    async def event_source() -> AsyncIterator[bytes]:
        async with httpx.AsyncClient(timeout=30.0) as db_client:
            try:
                bundle = await _load_bundle(db_client, sup, user.id, conversation_id, jwt_token)
                g = bundle.grammar

                # --- Reinforcement re-POST path (pass or exhausted) ----------
                if reinforcement_pass or reinforcement_exhausted:
                    if reinforcement_failures > 0 and reinforcement_user_message_id:
                        # Increment the existing count by the actual failure
                        # total (may be 1 or 2 on pass; is 3 on exhausted).
                        # PostgREST has no atomic increment — read-then-write is
                        # acceptable: the grammar row is written once per user
                        # message and only the reinforcement flow increments it.
                        existing = await sup.select(db_client, "grammar_corrections", {
                            "select": "reinforcement_failures_count",
                            "user_message_id": f"eq.{reinforcement_user_message_id}",
                            "limit": "1",
                        })
                        prev = int((existing[0] if existing else {}).get("reinforcement_failures_count") or 0)
                        await sup.update(db_client, "grammar_corrections",
                                         {"user_message_id": f"eq.{reinforcement_user_message_id}"},
                                         {"reinforcement_failures_count": prev + reinforcement_failures})

                    # Idempotency guard: if the client retries this POST (e.g.
                    # network drop mid-stream) an assistant message may already
                    # exist after the user turn. Reuse it as a regenerate
                    # anchor instead of creating a phantom second row.
                    resume_msg_id: str | None = None
                    if reinforcement_user_message_id:
                        anchor = await sup.select(db_client, "messages", {
                            "select": "created_at",
                            "id": f"eq.{reinforcement_user_message_id}",
                            "limit": "1",
                        })
                        if anchor:
                            existing_assistant = await sup.select(db_client, "messages", {
                                "select": "id",
                                "conversation_id": f"eq.{conversation_id}",
                                "role": "eq.assistant",
                                "created_at": f"gt.{anchor[0]['created_at']}",
                                "order": "created_at.asc",
                                "limit": "1",
                            })
                            if existing_assistant:
                                resume_msg_id = existing_assistant[0]["id"]

                    async for chunk in _stream_npc_reply(
                        db_client, sup, bundle, conversation_id,
                        resume_msg_id, resume_msg_id is not None,
                    ):
                        yield chunk
                    return

                # --- Regenerate path (no grammar, same as 0008) --------------
                if regenerate_message_id:
                    async for chunk in _stream_npc_reply(db_client, sup, bundle, conversation_id, regenerate_message_id, True):
                        yield chunk
                    return

                # --- Normal turn: Grammar + Conversation Agent ---------------
                last_user_msg_id = bundle.last_user_msg_id
                should_grammar = (
                    g.master and g.inline_enabled
                    and bundle.last_user_text is not None
                    and last_user_msg_id is not None
                )

                if should_grammar and last_user_msg_id and bundle.last_user_text:
                    if g.reinforcement_enabled:
                        # --- SERIAL: Grammar first, then maybe NPC -----------
                        grammar_result = await _run_grammar_and_persist(
                            db_client, sup, bundle, user.id,
                            conversation_id, last_user_msg_id, bundle.last_user_text,
                        )
                        # Always emit correction so the inline row renders.
                        yield _pack_sse("correction",
                            user_message_id=last_user_msg_id,
                            original_text=bundle.last_user_text,
                            already_correct=grammar_result.already_correct,
                            corrected_text=grammar_result.corrected_text,
                            explanation=grammar_result.explanation,
                            error_categories=grammar_result.error_categories,
                        )
                        if grammar_result.already_correct:
                            # NPC responds immediately.
                            async for chunk in _stream_npc_reply(db_client, sup, bundle, conversation_id, None, False):
                                yield chunk
                        else:
                            # Emit rewrite_required and STOP — NPC does not run yet.
                            yield _pack_sse("rewrite_required",
                                user_message_id=last_user_msg_id,
                                corrected_text=grammar_result.corrected_text,
                                explanation=grammar_result.explanation,
                                error_categories=grammar_result.error_categories,
                            )
                        return

                    else:
                        # --- PARALLEL: Grammar + NPC race ---------------------
                        # Plan 0123: previously serial (grammar awaited before
                        # NPC). The grammar agent now fires as a background
                        # task while the NPC stream starts immediately; the
                        # correction event is yielded as soon as the task
                        # completes (between two token chunks or after the
                        # stream ends). User sees the reply with the same
                        # latency as if grammar were OFF, and the inline
                        # correction lands wherever it's ready — keyed by
                        # user_message_id so frontend renders it in the
                        # right slot regardless of order.
                        grammar_task = asyncio.create_task(_run_grammar_and_persist(
                            db_client, sup, bundle, user.id,
                            conversation_id, last_user_msg_id, bundle.last_user_text,
                        ))
                        grammar_emitted = False

                        def _grammar_event() -> bytes | None:
                            """Drain the grammar task if done. Returns the SSE
                            packet (correction or grammar_error) or None."""
                            if grammar_task.done():
                                try:
                                    gr = grammar_task.result()
                                    return _pack_sse("correction",
                                        user_message_id=last_user_msg_id,
                                        original_text=bundle.last_user_text,
                                        already_correct=gr.already_correct,
                                        corrected_text=gr.corrected_text,
                                        explanation=gr.explanation,
                                        error_categories=gr.error_categories,
                                    )
                                except Exception as ge:  # noqa: BLE001
                                    return _pack_sse("grammar_error", message=str(ge))
                            return None

                        async for chunk in _stream_npc_reply(db_client, sup, bundle, conversation_id, None, False):
                            if not grammar_emitted:
                                ev = _grammar_event()
                                if ev is not None:
                                    yield ev
                                    grammar_emitted = True
                            yield chunk

                        # NPC stream done — wait for grammar if still running
                        # (large grammar models can outlast a short NPC reply).
                        if not grammar_emitted:
                            try:
                                gr = await grammar_task
                                yield _pack_sse("correction",
                                    user_message_id=last_user_msg_id,
                                    original_text=bundle.last_user_text,
                                    already_correct=gr.already_correct,
                                    corrected_text=gr.corrected_text,
                                    explanation=gr.explanation,
                                    error_categories=gr.error_categories,
                                )
                            except Exception as ge:  # noqa: BLE001
                                yield _pack_sse("grammar_error", message=str(ge))
                        return

                # --- No grammar: just stream NPC reply (Master OFF or no user msg)
                async for chunk in _stream_npc_reply(db_client, sup, bundle, conversation_id, None, False):
                    yield chunk

            except HTTPException as e:
                yield _pack_sse("error", message=e.detail)
            except Exception as e:  # noqa: BLE001
                yield _pack_sse("error", message=str(e))

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/providers/test")
async def providers_test(
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(default=""),
):
    sup = _user_client(authorization)
    async with httpx.AsyncClient(timeout=10.0) as client:
        providers = await sup.select(client, "provider_configs", {
            "select": "*",
            "kind": "eq.text",
            "is_active": "eq.true",
            "limit": "1",
        })
        if not providers:
            return {"ok": False, "error": "no active text provider"}
        provider = providers[0]
        api_key = await sup.rpc(client, "get_active_text_key")
        if not api_key:
            return {"ok": False, "error": "no stored key"}

        cfg = ProviderCallConfig(
            base_url=provider.get("base_url") or "",
            api_key=api_key,
            model=provider.get("model_id") or "",
            temperature=None,
            max_tokens=1,
            thinking_mode=False,
        )
        result = await one_shot_probe(cfg)

        await sup.update(client, "provider_configs",
                         {"id": f"eq.{provider['id']}"},
                         {"last_tested_ok": bool(result.get("ok")),
                          "last_tested_at": datetime.now(timezone.utc).isoformat()})
    return result
