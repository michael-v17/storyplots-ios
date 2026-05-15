import { supabase } from "./supabase";

// Cycle 0116 — Sampler hygiene defaults from the audit reference §1.1.
// Stored at users.preferences.sampler. Applied to the upstream chat call only
// when the user has values set; defaults below are written on first save.
// `temperature` and `max_tokens` stay per-provider (provider_configs.*);
// these knobs are user-global because the doc-recommended values apply
// regardless of which model is active.

export type SamplerPrefs = {
  top_p: number;             // 0..1 — doc default 0.95
  top_k: number;             // 0..200 — doc default 40 (0 = off)
  min_p: number;             // 0..1 — doc default 0.01
  frequency_penalty: number; // -2..2 — MUST be 0 for character voice
  presence_penalty: number;  // -2..2 — MUST be 0 for character voice
};

// Doc §1.1 RP-validated defaults (MiniMax M2 / DeepSeek V3.2 reference).
export const SAMPLER_PREFS_DEFAULTS: SamplerPrefs = {
  top_p: 0.95,
  top_k: 40,
  min_p: 0.01,
  frequency_penalty: 0,
  presence_penalty: 0,
};

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

export function mergeSamplerDefaults(raw: Partial<SamplerPrefs> | null | undefined): SamplerPrefs {
  if (!raw || typeof raw !== "object") return { ...SAMPLER_PREFS_DEFAULTS };
  return {
    top_p: typeof raw.top_p === "number" ? clamp(raw.top_p, 0, 1) : SAMPLER_PREFS_DEFAULTS.top_p,
    top_k: typeof raw.top_k === "number" ? clamp(Math.round(raw.top_k), 0, 200) : SAMPLER_PREFS_DEFAULTS.top_k,
    min_p: typeof raw.min_p === "number" ? clamp(raw.min_p, 0, 1) : SAMPLER_PREFS_DEFAULTS.min_p,
    frequency_penalty: typeof raw.frequency_penalty === "number" ? clamp(raw.frequency_penalty, -2, 2) : 0,
    presence_penalty: typeof raw.presence_penalty === "number" ? clamp(raw.presence_penalty, -2, 2) : 0,
  };
}

export async function loadSamplerPrefs(userId: string): Promise<SamplerPrefs> {
  const { data, error } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const raw = (data?.preferences as Record<string, unknown> | null)?.sampler;
  return mergeSamplerDefaults(raw as Partial<SamplerPrefs> | null);
}

export async function saveSamplerPrefs(userId: string, prefs: SamplerPrefs): Promise<void> {
  const { data: row, error: readErr } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (readErr) throw readErr;
  const prefsObj = (row?.preferences as Record<string, unknown>) || {};
  const next = { ...prefsObj, sampler: prefs };
  const { error: updateErr } = await supabase
    .from("users")
    .update({ preferences: next })
    .eq("id", userId);
  if (updateErr) throw updateErr;
}
