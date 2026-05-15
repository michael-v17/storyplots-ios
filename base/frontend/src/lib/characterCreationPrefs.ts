import { supabase } from "./supabase";

// Cycle 0114 — Character Creation prefs. Persisted at
// users.preferences.character_creation. Pattern mirrors memoryPrefs.ts.
//
// Only one field today: reasoning_enabled. When true, the backend
// /character-refine route adds `reasoning: {effort: "medium"}` to the
// payload. Has no effect on providers/models that don't honor reasoning
// hints. The character_refine call is the only place this flag fires;
// chat replies stay fast.

export type CharacterCreationPrefs = {
  reasoning_enabled: boolean;
};

export const CHARACTER_CREATION_PREFS_DEFAULTS: CharacterCreationPrefs = {
  reasoning_enabled: false,
};

export function mergeCharacterCreationDefaults(
  raw: Partial<CharacterCreationPrefs> | null | undefined,
): CharacterCreationPrefs {
  if (!raw || typeof raw !== "object") return { ...CHARACTER_CREATION_PREFS_DEFAULTS };
  const out: CharacterCreationPrefs = { ...CHARACTER_CREATION_PREFS_DEFAULTS };
  if (typeof raw.reasoning_enabled === "boolean") out.reasoning_enabled = raw.reasoning_enabled;
  return out;
}

export async function loadCharacterCreationPrefs(userId: string): Promise<CharacterCreationPrefs> {
  const { data, error } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const raw = (data?.preferences as Record<string, unknown> | null)?.character_creation;
  return mergeCharacterCreationDefaults(raw as Partial<CharacterCreationPrefs> | null);
}

export async function saveCharacterCreationPrefs(
  userId: string,
  prefs: CharacterCreationPrefs,
): Promise<void> {
  const { data: row, error: readErr } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (readErr) throw readErr;
  const prefsObj = (row?.preferences as Record<string, unknown>) || {};
  const next = { ...prefsObj, character_creation: prefs };
  const { error: updateErr } = await supabase
    .from("users")
    .update({ preferences: next })
    .eq("id", userId);
  if (updateErr) throw updateErr;
}
