"""TTS routes.

POST /providers/tts/test              one-shot synth + reachability probe
POST /messages/{message_id}/audio     generate + cache audio for active variant

Cache semantics: one audio row per (variant_id, provider_family, voice_id,
segment_index). Dual-voice splits the reply into narrator + character
segments at synth time; each segment caches independently. Because
variants are immutable, cached rows are valid indefinitely. Switching a
voice in settings leaves old rows intact (they're keyed on voice_id).
The endpoint returns a LIST of rows in play order — the frontend plays
them sequentially through a single <audio> element.
"""

from __future__ import annotations

import os

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel

from ..agents import tts_elevenlabs, tts_openai
from ..agents.tts_openai import OPENAI_VOICES, TTSCallConfig, strip_image_tag
from ..agents.tts_split import Segment, split_for_tts
from ..deps.jwt import AuthUser, verify_supabase_jwt
from ..deps.supabase import UserSupabase

router = APIRouter()

SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")


def _user_client(authorization: str) -> UserSupabase:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    if not SUPABASE_ANON_KEY:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "SUPABASE_ANON_KEY not configured")
    return UserSupabase(jwt=token.strip(), apikey=SUPABASE_ANON_KEY)


class TestTTSResult(BaseModel):
    ok: bool
    error: str | None = None


async def _synthesize_by_family(family: str, api_key: str, voice_id: str, text: str) -> bytes:
    """Dispatch synthesis by provider_family. Adding a new provider is
    two changes: new adapter module + one branch here."""
    if family == "openai":
        return await tts_openai.synthesize(TTSCallConfig(api_key=api_key, voice_id=voice_id), text)
    if family == "elevenlabs":
        cfg = tts_elevenlabs.ElevenLabsCallConfig(api_key=api_key, voice_id=voice_id)
        return await tts_elevenlabs.synthesize(cfg, text)
    raise HTTPException(status.HTTP_409_CONFLICT, f"unknown TTS provider family: {family}")


@router.post("/providers/tts/test")
async def test_tts_provider(
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(..., alias="Authorization"),
) -> TestTTSResult:
    del user
    sup = _user_client(authorization)
    async with httpx.AsyncClient(timeout=30.0) as client:
        providers = await sup.select(client, "provider_configs", {
            "select": "provider_family,model_id",
            "kind": "eq.tts",
            "is_active": "eq.true",
            "limit": "1",
        })
        if not providers:
            return TestTTSResult(ok=False, error="no active TTS provider")
        p = providers[0]
        family = p.get("provider_family") or ""
        if family not in ("openai", "elevenlabs"):
            return TestTTSResult(ok=False, error=f"unknown TTS family: {family}")
        voice = p.get("model_id") or ""
        if family == "openai" and voice not in OPENAI_VOICES:
            voice = "alloy"
        if family == "elevenlabs" and not voice:
            voice = tts_elevenlabs.ELEVENLABS_DEFAULT_VOICES["Rachel (narrator)"]
        api_key = await sup.rpc(client, "get_active_tts_key")
        if not api_key:
            return TestTTSResult(ok=False, error="TTS provider has no stored key")
    try:
        await _synthesize_by_family(family, api_key, voice, "Hello — testing your voice.")
        return TestTTSResult(ok=True)
    except Exception as exc:
        return TestTTSResult(ok=False, error=str(exc))


@router.get("/providers/tts/elevenlabs/voices")
async def list_elevenlabs_voices(
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(..., alias="Authorization"),
) -> list[dict]:
    """Proxy the user's ElevenLabs voice catalog. The key stays
    server-side; the frontend only gets voice metadata.
    """
    del user
    sup = _user_client(authorization)
    async with httpx.AsyncClient(timeout=20.0) as client:
        api_key = await sup.rpc(client, "get_tts_key_for_family", {"p_provider_family": "elevenlabs"})
    if not api_key:
        raise HTTPException(status.HTTP_409_CONFLICT, "no ElevenLabs key stored — save one first")
    try:
        return await tts_elevenlabs.list_voices(api_key)
    except Exception as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"ElevenLabs voice list failed: {exc}") from exc


def _voice_for_segment(
    seg: Segment,
    gender: str | None,
    prefs: dict,
    family: str,
    legacy_voice: str,
    char_override: dict | None = None,
) -> str:
    """Resolve the voice for a segment. Priority:
    1. Per-character override (cycle 0022) if set.
    2. Per-family gender slot from user prefs (cycle 0021).
    3. Legacy single-voice fallback.

    Single-voice mode (dual_voice=false) skips 1+2 and returns
    legacy_voice directly.
    """
    if not bool(prefs.get("dual_voice")):
        return legacy_voice

    # Per-character override takes priority over global slots.
    if char_override:
        if seg.kind == "narrator" and char_override.get("tts_narrator_voice_id"):
            return str(char_override["tts_narrator_voice_id"])
        if seg.kind == "character" and char_override.get("tts_character_voice_id"):
            return str(char_override["tts_character_voice_id"])

    family_block = (prefs.get(family) or {}) if isinstance(prefs.get(family), dict) else {}
    if seg.kind == "narrator":
        return str(family_block.get("narrator") or legacy_voice)
    if gender == "male":
        slot = family_block.get("char_male")
    elif gender == "female":
        slot = family_block.get("char_female")
    else:
        slot = family_block.get("char_fallback")
    return str(slot or legacy_voice)


@router.post("/messages/{message_id}/audio")
async def generate_audio_for_message(
    message_id: str,
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(..., alias="Authorization"),
) -> list[dict]:
    sup = _user_client(authorization)
    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. Message + active variant + owning conversation's character_id.
        msgs = await sup.select(client, "messages", {
            "select": "id,role,active_variant_id,conversation_id",
            "id": f"eq.{message_id}",
            "limit": "1",
        })
        if not msgs:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "message not found")
        msg = msgs[0]
        if msg["role"] != "assistant":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "audio is only generated for assistant messages")
        variant_id = msg.get("active_variant_id")
        if not variant_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "message has no active variant")

        convs = await sup.select(client, "conversations", {
            "select": "character_id",
            "id": f"eq.{msg['conversation_id']}",
            "limit": "1",
        })
        character_id = convs[0].get("character_id") if convs else None
        character_gender: str | None = None
        char_override: dict | None = None
        if character_id:
            chars = await sup.select(client, "characters", {
                "select": "gender,tts_narrator_voice_id,tts_character_voice_id",
                "id": f"eq.{character_id}",
                "limit": "1",
            })
            if chars:
                g = chars[0].get("gender")
                character_gender = g if isinstance(g, str) else None
                if chars[0].get("tts_narrator_voice_id") or chars[0].get("tts_character_voice_id"):
                    char_override = chars[0]

        # 2. Provider + legacy voice + key.
        providers = await sup.select(client, "provider_configs", {
            "select": "provider_family,model_id",
            "kind": "eq.tts",
            "is_active": "eq.true",
            "limit": "1",
        })
        if not providers:
            raise HTTPException(status.HTTP_409_CONFLICT, "no active TTS provider — configure one in Settings → Text-to-Speech")
        provider = providers[0]
        family = provider.get("provider_family") or ""
        if family not in ("openai", "elevenlabs"):
            raise HTTPException(status.HTTP_409_CONFLICT, f"unknown TTS family: {family}")
        # legacy_voice is the "single-voice fallback" pin on the active
        # provider_configs row. For OpenAI it's a voice name from the
        # fixed catalogue; for ElevenLabs any non-empty voice_id is
        # accepted (we validate at synth time).
        legacy_voice = provider.get("model_id") or ""
        if family == "openai" and legacy_voice not in OPENAI_VOICES:
            legacy_voice = "alloy"
        if family == "elevenlabs" and not legacy_voice:
            legacy_voice = tts_elevenlabs.ELEVENLABS_DEFAULT_VOICES["Rachel (narrator)"]

        # 3. TTS prefs (dual_voice toggle + 4 voice slots).
        rows = await sup.select(client, "users", {
            "select": "preferences",
            "id": f"eq.{user.id}",
            "limit": "1",
        })
        user_prefs_all = rows[0].get("preferences") if rows else None
        tts_prefs = (user_prefs_all or {}).get("tts") or {}

        # 4. Variant content → segments. When dual-voice is off, collapse to
        # a single narrator segment of the whole stripped text — one OpenAI
        # call, one row at segment_index=0, cache-key-compatible with the
        # cycle-0017 single-voice rows.
        variants = await sup.select(client, "message_variants", {
            "select": "content",
            "id": f"eq.{variant_id}",
            "limit": "1",
        })
        if not variants:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "variant not found")
        raw = variants[0].get("content") or ""
        if bool(tts_prefs.get("dual_voice")):
            segments = split_for_tts(raw)
        else:
            whole = strip_image_tag(raw or "").strip()
            segments = [Segment("narrator", whole)] if whole else []
        if not segments:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "no text to synthesize")

        # 5. For each segment: cache lookup → synth → insert. Plays
        #    sequentially in the frontend, so rows come back in play
        #    order (segment_index ascending).
        api_key: str | None = None
        out_rows: list[dict] = []
        for seg_index, seg in enumerate(segments):
            voice_id = _voice_for_segment(seg, character_gender, tts_prefs, family, legacy_voice, char_override)
            if family == "openai" and voice_id not in OPENAI_VOICES:
                raise HTTPException(status.HTTP_409_CONFLICT, f"unknown OpenAI voice: {voice_id}")
            if family == "elevenlabs" and not voice_id:
                raise HTTPException(status.HTTP_409_CONFLICT, "ElevenLabs voice_id required")

            cached = await sup.select(client, "message_audio", {
                "select": "*",
                "variant_id": f"eq.{variant_id}",
                "provider_family": f"eq.{family}",
                "voice_id": f"eq.{voice_id}",
                "segment_index": f"eq.{seg_index}",
                "limit": "1",
            })
            if cached:
                out_rows.append(cached[0])
                continue

            if api_key is None:
                api_key = await sup.rpc(client, "get_active_tts_key")
                if not api_key:
                    raise HTTPException(status.HTTP_409_CONFLICT, "TTS provider has no stored key")

            try:
                mp3 = await _synthesize_by_family(family, api_key, voice_id, seg.text)
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"TTS synth failed: {exc}") from exc

            storage_ref = f"{user.id}/{variant_id}_{seg_index}_{family}_{voice_id}.mp3"
            await sup.upload_bytes(client, "generated-audio", storage_ref, mp3, "audio/mpeg")
            provider_snapshot: dict = {"kind": seg.kind}
            provider_snapshot["model"] = "tts-1" if family == "openai" else "eleven_multilingual_v2"
            try:
                row = await sup.insert(client, "message_audio", {
                    "user_id": user.id,
                    "variant_id": variant_id,
                    "provider_family": family,
                    "voice_id": voice_id,
                    "segment_index": seg_index,
                    "storage_ref": storage_ref,
                    "provider_snapshot": provider_snapshot,
                })
            except Exception:
                try:
                    await sup.remove_object(client, "generated-audio", storage_ref)
                except Exception:
                    pass
                raise
            out_rows.append(row)
        return out_rows
