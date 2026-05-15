import { supabase } from "./supabase";
import type { ProviderConfig } from "./providers";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000";

// Keep in sync with backend/app/agents/tts_openai.py::OPENAI_VOICES.
export const OPENAI_VOICES = [
  "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer",
] as const;
export type OpenAIVoice = typeof OPENAI_VOICES[number];

export type ProviderFamily = "openai" | "elevenlabs" | "webspeech";

// Cycle 0021 — pre-configured ElevenLabs defaults matching the backend.
// Keep in sync with backend/app/agents/tts_elevenlabs.py::ELEVENLABS_DEFAULT_VOICES.
export const ELEVENLABS_DEFAULT_SLOTS = {
  narrator:      "21m00Tcm4TlvDq8ikWAM",  // Rachel
  char_male:     "pNInz6obpgDQGcFmaJgB",  // Adam
  char_female:   "EXAVITQu4vr4xnSDxMaL",  // Bella
  char_fallback: "ErXwobaYiN019PkySvjV",  // Antoni
} as const;

export const OPENAI_DEFAULT_SLOTS = {
  narrator:      "nova",
  char_male:     "onyx",
  char_female:   "shimmer",
  char_fallback: "alloy",
} as const;

export type TTSProviderDraft = {
  provider_family: ProviderFamily;
  api_key: string | null;        // blank to keep existing
  voice_id: string;
};

export type TestTTSResult = { ok: boolean; error?: string | null };

export type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  gender: string | null;
  age: string | null;
  accent: string | null;
  category: string | null;
};

export async function listActiveTTSProvider(): Promise<ProviderConfig | null> {
  const { data, error } = await supabase
    .from("provider_configs")
    .select("*")
    .eq("kind", "tts")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as ProviderConfig | null;
}

/** All TTS provider rows the user has stored, keyed by family.
 *  `active` comes from preferences.tts.active_provider (supports
 *  webspeech which has no DB row). Falls back to the is_active flag
 *  on provider_configs for backwards compat. */
export async function listAllTTSProviders(userId: string): Promise<{
  openai: ProviderConfig | null;
  elevenlabs: ProviderConfig | null;
  active: ProviderFamily | null;
}> {
  const [{ data: provRows, error }, { data: userRow }] = await Promise.all([
    supabase.from("provider_configs").select("*").eq("kind", "tts"),
    supabase.from("users").select("preferences").eq("id", userId).single(),
  ]);
  if (error) throw error;
  const rows = (provRows ?? []) as ProviderConfig[];
  const byFamily: Record<string, ProviderConfig> = {};
  let dbActive: ProviderFamily | null = null;
  for (const r of rows) {
    byFamily[r.provider_family] = r;
    if (r.is_active && (r.provider_family === "openai" || r.provider_family === "elevenlabs")) {
      dbActive = r.provider_family;
    }
  }
  const prefsActive = ((userRow?.preferences as Record<string, unknown> | null)?.tts as Record<string, unknown> | undefined)?.active_provider;
  const active: ProviderFamily | null =
    prefsActive === "webspeech" ? "webspeech" :
    prefsActive === "openai" || prefsActive === "elevenlabs" ? prefsActive :
    dbActive;
  return {
    openai: byFamily.openai ?? null,
    elevenlabs: byFamily.elevenlabs ?? null,
    active,
  };
}

/** Set the active provider family in preferences. For openai/elevenlabs
 *  also flips the DB is_active flag. For webspeech, only the pref is set
 *  (no provider_configs row). */
export async function setActiveProvider(family: ProviderFamily): Promise<void> {
  // Store in prefs (single source of truth for the frontend).
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) return;
  const { data: row } = await supabase.from("users").select("preferences").eq("id", uid).single();
  const prefs = { ...((row?.preferences ?? {}) as Record<string, unknown>) };
  const tts = { ...((prefs.tts ?? {}) as Record<string, unknown>) };
  tts.active_provider = family;
  prefs.tts = tts;
  await supabase.from("users").update({ preferences: prefs }).eq("id", uid);

  // For cloud providers, also flip the DB is_active.
  if (family === "openai" || family === "elevenlabs") {
    await switchActiveTTSProvider(family);
  }
}

export async function upsertTTSProvider(draft: TTSProviderDraft): Promise<ProviderConfig> {
  const { data, error } = await supabase.rpc("upsert_tts_provider", {
    p_provider_family: draft.provider_family,
    p_api_key: draft.api_key,
    p_voice_id: draft.voice_id,
  });
  if (error) throw error;
  return data as ProviderConfig;
}

export async function switchActiveTTSProvider(family: ProviderFamily): Promise<void> {
  const { error } = await supabase.rpc("switch_active_tts_provider", {
    p_provider_family: family,
  });
  if (error) throw error;
}

export async function testTTSProvider(): Promise<TestTTSResult> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) return { ok: false, error: "not authenticated" };
  const res = await fetch(`${BACKEND_URL}/providers/tts/test`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${jwt}`, "Content-Type": "application/json" },
  });
  return res.json();
}

/** Proxy to the backend which holds the ElevenLabs key server-side.
 *  Returns the user's full catalogue (premade + cloned). */
export async function listElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error("not authenticated");
  const res = await fetch(`${BACKEND_URL}/providers/tts/elevenlabs/voices`, {
    headers: { "Authorization": `Bearer ${jwt}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`voice list failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as ElevenLabsVoice[];
}

export type VoiceSlots = {
  narrator: string;
  char_male: string;
  char_female: string;
  char_fallback: string;
};

export type TTSPrefs = {
  mode: "manual" | "auto";
  dual_voice: boolean;
  speed: number;             // clamped 0.75..1.25 client-side
  volume: number;            // 0.0..1.0 (single-voice mode)
  narrator_volume: number;   // 0.0..1.0 (dual-voice narrator)
  character_volume: number;  // 0.0..1.0 (dual-voice character)
  openai: VoiceSlots;
  elevenlabs: VoiceSlots;
};

export const SPEED_MIN = 0.75;
export const SPEED_MAX = 1.25;

function asStr(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}
function asNum(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function clampSpeed(n: number): number {
  return Math.max(SPEED_MIN, Math.min(SPEED_MAX, n));
}
function clampVolume(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export async function loadTTSPrefs(userId: string): Promise<TTSPrefs> {
  const { data } = await supabase.from("users").select("preferences").eq("id", userId).single();
  const prefs = (data?.preferences as Record<string, unknown> | null) ?? {};
  const tts = (prefs.tts as Record<string, unknown> | undefined) ?? {};
  const openai = (tts.openai as Record<string, unknown> | undefined) ?? {};
  const elevenlabs = (tts.elevenlabs as Record<string, unknown> | undefined) ?? {};
  return {
    mode: tts.mode === "auto" ? "auto" : "manual",
    dual_voice: tts.dual_voice === true,
    speed: clampSpeed(asNum(tts.speed, 1.0)),
    volume: clampVolume(asNum(tts.volume, 1.0)),
    narrator_volume: clampVolume(asNum(tts.narrator_volume, 1.0)),
    character_volume: clampVolume(asNum(tts.character_volume, 1.0)),
    openai: {
      narrator:      asStr(openai.narrator,      OPENAI_DEFAULT_SLOTS.narrator),
      char_male:     asStr(openai.char_male,     OPENAI_DEFAULT_SLOTS.char_male),
      char_female:   asStr(openai.char_female,   OPENAI_DEFAULT_SLOTS.char_female),
      char_fallback: asStr(openai.char_fallback, OPENAI_DEFAULT_SLOTS.char_fallback),
    },
    elevenlabs: {
      narrator:      asStr(elevenlabs.narrator,      ELEVENLABS_DEFAULT_SLOTS.narrator),
      char_male:     asStr(elevenlabs.char_male,     ELEVENLABS_DEFAULT_SLOTS.char_male),
      char_female:   asStr(elevenlabs.char_female,   ELEVENLABS_DEFAULT_SLOTS.char_female),
      char_fallback: asStr(elevenlabs.char_fallback, ELEVENLABS_DEFAULT_SLOTS.char_fallback),
    },
  };
}

/** Partial update for the flat knobs (mode, dual_voice, speed, volume,
 *  narrator_volume, character_volume). Voice slots go through
 *  saveTTSVoices() per family. Per-kind volumes are written directly
 *  to the jsonb since the RPC doesn't have params for them (avoids
 *  a migration for a pure UX polish). */
export async function saveTTSPrefs(
  patch: Partial<Pick<TTSPrefs, "mode" | "dual_voice" | "speed" | "volume" | "narrator_volume" | "character_volume">>,
): Promise<void> {
  const { error } = await supabase.rpc("set_user_tts_prefs", {
    p_mode: patch.mode ?? null,
    p_dual_voice: patch.dual_voice ?? null,
    p_narrator_voice: null,
    p_char_voice_male: null,
    p_char_voice_female: null,
    p_char_voice_fallback: null,
    p_speed: patch.speed ?? null,
    p_volume: patch.volume ?? null,
  });
  if (error) throw error;

  // Per-kind volumes are additive — merge them into the existing tts
  // block via a direct supabase update (no RPC needed for v0).
  if (patch.narrator_volume != null || patch.character_volume != null) {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return;
    const { data: row } = await supabase.from("users").select("preferences").eq("id", uid).single();
    const prefs = ((row?.preferences ?? {}) as Record<string, unknown>);
    const tts = { ...((prefs.tts ?? {}) as Record<string, unknown>) };
    if (patch.narrator_volume != null) tts.narrator_volume = patch.narrator_volume;
    if (patch.character_volume != null) tts.character_volume = patch.character_volume;
    await supabase.from("users").update({ preferences: { ...prefs, tts } }).eq("id", uid);
  }
}

export async function saveTTSVoices(family: ProviderFamily, slots: VoiceSlots): Promise<void> {
  const { error } = await supabase.rpc("set_tts_voices", {
    p_provider_family: family,
    p_narrator:       slots.narrator,
    p_char_male:      slots.char_male,
    p_char_female:    slots.char_female,
    p_char_fallback:  slots.char_fallback,
  });
  if (error) throw error;
}

// Legacy helpers (0017) kept for call-site inertia.
export async function loadTTSMode(userId: string): Promise<"manual" | "auto"> {
  return (await loadTTSPrefs(userId)).mode;
}

export async function saveTTSMode(mode: "manual" | "auto"): Promise<void> {
  await saveTTSPrefs({ mode });
}
