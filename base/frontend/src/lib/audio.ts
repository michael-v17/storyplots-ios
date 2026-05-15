import { supabase } from "./supabase";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000";
const AUDIO_URL_TTL_SECONDS = 60 * 60 * 24;

export type MessageAudio = {
  id: string;
  user_id: string;
  variant_id: string;
  provider_family: string;
  voice_id: string | null;
  segment_index: number;
  storage_ref: string | null;
  duration_ms: number | null;
  provider_snapshot: Record<string, unknown>;
  created_at: string;
};

/** Cycle 0020 — returns a list of audio rows in play order (ascending
 *  segment_index). Dual-voice routing split the reply into narrator +
 *  character segments server-side; single-voice mode returns a one-row
 *  list (segment_index=0). */
export async function generateAudioForMessage(messageId: string): Promise<MessageAudio[]> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error("Not signed in");

  const res = await fetch(`${BACKEND_URL}/messages/${messageId}/audio`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${jwt}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`audio generation failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as MessageAudio[];
}

export async function audioUrl(storageRef: string | null): Promise<string | null> {
  if (!storageRef) return null;
  const { data } = await supabase.storage
    .from("generated-audio")
    .createSignedUrl(storageRef, AUDIO_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

/** Cycle 0022 — simple client-side text splitter for WebSpeech.
 *  Mirrors the backend's tts_split.py convention: *italic* → narrator,
 *  "quoted" → character, plain → narrator. Adjacent same-kind segments
 *  merge. Strips [image: …] tags. */
export type TextSegment = { kind: "narrator" | "character"; text: string };

export function splitTextForTTS(raw: string): TextSegment[] {
  const stripped = raw.replace(/\[image:\s*[^\]]+?\s*\]/gi, "").trim();
  if (!stripped) return [];
  const re = /\*([^*\n]+?)\*|"([^"\n]+?)"/g;
  const segs: TextSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    if (m.index > last) {
      const plain = stripped.slice(last, m.index).trim();
      if (plain) segs.push({ kind: "narrator", text: plain });
    }
    if (m[1] != null) {
      const body = m[1].trim();
      if (body) segs.push({ kind: "narrator", text: body });
    } else if (m[2] != null) {
      const body = m[2].trim();
      if (body) segs.push({ kind: "character", text: body });
    }
    last = m.index + m[0].length;
  }
  if (last < stripped.length) {
    const tail = stripped.slice(last).trim();
    if (tail) segs.push({ kind: "narrator", text: tail });
  }
  // Merge adjacent same-kind
  const merged: TextSegment[] = [];
  for (const s of segs) {
    if (merged.length > 0 && merged[merged.length - 1].kind === s.kind) {
      merged[merged.length - 1] = { kind: s.kind, text: merged[merged.length - 1].text + " " + s.text };
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

/** Cycle 0022 — WebSpeech client-side synthesis. Returns a Promise
 *  that resolves when the utterance finishes. No backend involved,
 *  no DB rows, no storage. Speed + volume applied via the
 *  SpeechSynthesisUtterance API. */
export function speakWebSpeech(
  text: string,
  voiceURI: string | null,
  prefs: PlaybackPrefs,
  segmentKind?: "narrator" | "character",
): Promise<void> {
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = prefs.speed;
    if (prefs.dual_voice && segmentKind) {
      utterance.volume = segmentKind === "narrator" ? prefs.narrator_volume : prefs.character_volume;
    } else {
      utterance.volume = prefs.volume;
    }
    if (voiceURI) {
      const voices = speechSynthesis.getVoices();
      const match = voices.find((v) => v.voiceURI === voiceURI);
      if (match) utterance.voice = match;
    }
    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(new Error(e.error ?? "speech synthesis error"));
    speechSynthesis.speak(utterance);
  });
}

export type PlaybackPrefs = {
  speed: number;
  volume: number;
  dual_voice: boolean;
  narrator_volume: number;
  character_volume: number;
  active_provider: string | null;
};

export async function loadPlaybackPrefs(): Promise<PlaybackPrefs> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) return { speed: 1.0, volume: 1.0, dual_voice: false, narrator_volume: 1.0, character_volume: 1.0, active_provider: null };
  const { data } = await supabase.from("users").select("preferences").eq("id", uid).maybeSingle();
  const tts = ((data?.preferences as Record<string, unknown> | null)?.tts as Record<string, unknown> | undefined) ?? {};
  const rawSpeed = typeof tts.speed === "number" ? tts.speed : 1.0;
  const rawVolume = typeof tts.volume === "number" ? tts.volume : 1.0;
  const rawNV = typeof tts.narrator_volume === "number" ? tts.narrator_volume : 1.0;
  const rawCV = typeof tts.character_volume === "number" ? tts.character_volume : 1.0;
  return {
    speed: Math.max(0.75, Math.min(1.25, rawSpeed)),
    volume: Math.max(0, Math.min(1, rawVolume)),
    dual_voice: tts.dual_voice === true,
    narrator_volume: Math.max(0, Math.min(1, rawNV)),
    character_volume: Math.max(0, Math.min(1, rawCV)),
    active_provider: typeof tts.active_provider === "string" ? tts.active_provider : null,
  };
}

/** Applies playback prefs to an `<audio>` element. When dual-voice is
 *  on, volume branches by segment kind (narrator vs character). Call
 *  this AFTER assigning `el.src` — Chrome resets playbackRate on src
 *  change. */
export function applyPlaybackPrefs(
  el: HTMLAudioElement,
  prefs: PlaybackPrefs,
  segmentKind?: "narrator" | "character",
): void {
  el.playbackRate = prefs.speed;
  if (prefs.dual_voice && segmentKind) {
    el.volume = segmentKind === "narrator" ? prefs.narrator_volume : prefs.character_volume;
  } else {
    el.volume = prefs.volume;
  }
  (el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
}
