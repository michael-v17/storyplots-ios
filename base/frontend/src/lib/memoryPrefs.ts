import { supabase } from "./supabase";

export type MemoryPrefs = {
  enabled: boolean;                        // master toggle (default OFF)
  notifications_enabled: boolean;           // "Memory saved" toast on extraction
  auto_extract_cadence_turns: number;       // 1..10, default 3
  retrieval_top_k: number;                  // 1..10, default 5
  retrieval_similarity_threshold: number;   // 0..1, default 0.5
  recency_weight: number;                   // cycle 0031 — 0..1, default 0.3
  extraction_prompt: string | null;         // cycle 0030 — null → backend default
};

export const MEMORY_PREFS_DEFAULTS: MemoryPrefs = {
  enabled: false,
  notifications_enabled: true,
  auto_extract_cadence_turns: 3,
  retrieval_top_k: 5,
  retrieval_similarity_threshold: 0.5,
  recency_weight: 0.3,
  extraction_prompt: null,
};

export function mergeWithDefaults(raw: Partial<MemoryPrefs> | null | undefined): MemoryPrefs {
  if (!raw || typeof raw !== "object") return { ...MEMORY_PREFS_DEFAULTS };
  const out: MemoryPrefs = { ...MEMORY_PREFS_DEFAULTS };
  if (typeof raw.enabled === "boolean") out.enabled = raw.enabled;
  if (typeof raw.notifications_enabled === "boolean") out.notifications_enabled = raw.notifications_enabled;
  if (typeof raw.auto_extract_cadence_turns === "number" && raw.auto_extract_cadence_turns > 0) {
    out.auto_extract_cadence_turns = Math.max(1, Math.min(10, Math.round(raw.auto_extract_cadence_turns)));
  }
  if (typeof raw.retrieval_top_k === "number" && raw.retrieval_top_k > 0) {
    out.retrieval_top_k = Math.max(1, Math.min(10, Math.round(raw.retrieval_top_k)));
  }
  if (typeof raw.retrieval_similarity_threshold === "number"
    && raw.retrieval_similarity_threshold >= 0
    && raw.retrieval_similarity_threshold <= 1) {
    out.retrieval_similarity_threshold = raw.retrieval_similarity_threshold;
  }
  if (typeof raw.recency_weight === "number") {
    out.recency_weight = Math.max(0, Math.min(1, raw.recency_weight));
  }
  if (typeof raw.extraction_prompt === "string") {
    const trimmed = raw.extraction_prompt.trim();
    out.extraction_prompt = trimmed ? raw.extraction_prompt : null;
  } else if (raw.extraction_prompt === null) {
    out.extraction_prompt = null;
  }
  return out;
}

export async function loadMemoryPrefs(userId: string): Promise<MemoryPrefs> {
  const { data, error } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const rawMem = (data?.preferences as Record<string, unknown> | null)?.memory;
  return mergeWithDefaults(rawMem as Partial<MemoryPrefs> | null);
}

export async function saveMemoryPrefs(userId: string, prefs: MemoryPrefs): Promise<void> {
  // Read-modify-write of users.preferences.memory. No atomic RPC for this
  // key — a concurrent edit could lose; ok for single-user single-device v0.
  const { data: row, error: readErr } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (readErr) throw readErr;
  const prefsObj = (row?.preferences as Record<string, unknown>) || {};
  const next = { ...prefsObj, memory: prefs };
  const { error: updateErr } = await supabase
    .from("users")
    .update({ preferences: next })
    .eq("id", userId);
  if (updateErr) throw updateErr;
}
