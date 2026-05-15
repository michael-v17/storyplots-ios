import { supabase } from "./supabase";

// Persistent under `users.preferences.prompt_editor`. JSONB sub-object, no
// schema change. Cycle 0039 adds only Avatar prefix/suffix; future cycles
// will extend this with visual roleplay instructions, video prompts, etc.
export type PromptEditorPrefs = {
  avatar_prefix: string | null;                   // null → backend default; "" → opt-out
  avatar_suffix: string | null;
  visual_roleplay_instructions: string | null;    // cycle 0040 — null → use the default VR instructions file; "" → opt-out
  avatar_background_refine_enabled: boolean;      // cycle 0048 — off → avatar uses `simple background` fallback
};

export const PROMPT_EDITOR_DEFAULTS: PromptEditorPrefs = {
  avatar_prefix: null,
  avatar_suffix: null,
  visual_roleplay_instructions: null,
  avatar_background_refine_enabled: true,
};

// Mirrors backend/app/routes/avatar_generate.py AVATAR_PREFIX_DEFAULT /
// AVATAR_SUFFIX_DEFAULT. Kept in sync manually; the "Reset to default"
// button in the UI restores these.
export const AVATAR_PREFIX_DEFAULT =
  "solo, medium shot portrait, face focus, soft lighting, looking at viewer";
export const AVATAR_SUFFIX_DEFAULT = "high quality, detailed face, sharp focus";

function coerceNullableString(v: unknown): string | null {
  if (typeof v === "string") return v;
  return null;
}

export function mergeWithDefaults(raw: Partial<PromptEditorPrefs> | null | undefined): PromptEditorPrefs {
  if (!raw || typeof raw !== "object") return { ...PROMPT_EDITOR_DEFAULTS };
  return {
    avatar_prefix: coerceNullableString(raw.avatar_prefix),
    avatar_suffix: coerceNullableString(raw.avatar_suffix),
    visual_roleplay_instructions: coerceNullableString(raw.visual_roleplay_instructions),
    avatar_background_refine_enabled:
      typeof raw.avatar_background_refine_enabled === "boolean"
        ? raw.avatar_background_refine_enabled
        : PROMPT_EDITOR_DEFAULTS.avatar_background_refine_enabled,
  };
}

export async function loadPromptEditorPrefs(userId: string): Promise<PromptEditorPrefs> {
  const { data, error } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const rawPe = (data?.preferences as Record<string, unknown> | null)?.prompt_editor;
  return mergeWithDefaults(rawPe as Partial<PromptEditorPrefs> | null);
}

export async function savePromptEditorPrefs(
  userId: string,
  patch: Partial<PromptEditorPrefs>,
): Promise<PromptEditorPrefs> {
  // Partial read-modify-write of `users.preferences.prompt_editor`.
  // Saving only the changed field (rather than the whole prefs object)
  // prevents concurrent flushes on different fields from clobbering each
  // other: e.g. prefix blur kicks off a save, suffix blur kicks off a
  // second save before the first lands — the second read will pick up
  // the latest DB state for prefix regardless of whether the first save
  // had landed when we cached prefs in the UI.
  const { data: row, error: readErr } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (readErr) throw readErr;
  const prefsObj = (row?.preferences as Record<string, unknown>) || {};
  const currentPe = mergeWithDefaults(prefsObj.prompt_editor as Partial<PromptEditorPrefs> | null);
  const nextPe: PromptEditorPrefs = { ...currentPe, ...patch };
  const nextAll = { ...prefsObj, prompt_editor: nextPe };
  const { error: updateErr } = await supabase
    .from("users")
    .update({ preferences: nextAll })
    .eq("id", userId);
  if (updateErr) throw updateErr;
  return nextPe;
}
