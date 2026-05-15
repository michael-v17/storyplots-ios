import { supabase } from "./supabase";

// Persistent under `users.preferences.image_refine`. JSONB sub-object, no
// schema change. Cycle 0040. The refiner *system prompt* lives per-provider
// in `workflow_config._refiner_system_prompt` (see ImageEngineSettings),
// NOT here — this shape only carries the toggle + context-messages knob.
export type ImageRefinePrefs = {
  enabled: boolean;           // master toggle, default true
  context_messages: number;   // 0..10 pairs, default 3
};

export const IMAGE_REFINE_DEFAULTS: ImageRefinePrefs = {
  enabled: true,
  context_messages: 3,
};

export function mergeWithDefaults(raw: Partial<ImageRefinePrefs> | null | undefined): ImageRefinePrefs {
  if (!raw || typeof raw !== "object") return { ...IMAGE_REFINE_DEFAULTS };
  const out: ImageRefinePrefs = { ...IMAGE_REFINE_DEFAULTS };
  if (typeof raw.enabled === "boolean") out.enabled = raw.enabled;
  if (typeof raw.context_messages === "number" && raw.context_messages >= 0) {
    out.context_messages = Math.max(0, Math.min(10, Math.round(raw.context_messages)));
  }
  return out;
}

export async function loadImageRefinePrefs(userId: string): Promise<ImageRefinePrefs> {
  const { data, error } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const raw = (data?.preferences as Record<string, unknown> | null)?.image_refine;
  return mergeWithDefaults(raw as Partial<ImageRefinePrefs> | null);
}

export async function saveImageRefinePrefs(
  userId: string,
  patch: Partial<ImageRefinePrefs>,
): Promise<ImageRefinePrefs> {
  // Partial read-modify-write (same pattern as promptEditorPrefs).
  const { data: row, error: readErr } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (readErr) throw readErr;
  const prefsObj = (row?.preferences as Record<string, unknown>) || {};
  const current = mergeWithDefaults(prefsObj.image_refine as Partial<ImageRefinePrefs> | null);
  const next: ImageRefinePrefs = { ...current, ...patch };
  if (typeof next.context_messages === "number") {
    next.context_messages = Math.max(0, Math.min(10, Math.round(next.context_messages)));
  }
  const nextAll = { ...prefsObj, image_refine: next };
  const { error: updateErr } = await supabase
    .from("users")
    .update({ preferences: nextAll })
    .eq("id", userId);
  if (updateErr) throw updateErr;
  return next;
}
