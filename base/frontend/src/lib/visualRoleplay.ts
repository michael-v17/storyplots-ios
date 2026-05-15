import { supabase } from "./supabase";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000";

export type VisualRoleplayMode = "manual" | "auto";
export type VisualRoleplayPov = "first_person" | "third_person";
export type VisualRoleplayShot =
  | "auto" | "close-up" | "portrait" | "medium_shot" | "cowboy_shot" | "full_body";

const SHOT_VALUES: readonly VisualRoleplayShot[] = [
  "auto", "close-up", "portrait", "medium_shot", "cowboy_shot", "full_body",
];

export type VisualRoleplayPrefs = {
  mode: VisualRoleplayMode;
  auto_generate_images: boolean;
  pov: VisualRoleplayPov;
  shot_framing: VisualRoleplayShot;
};

const DEFAULT_PREFS: VisualRoleplayPrefs = {
  mode: "manual",
  auto_generate_images: false,
  pov: "first_person",
  shot_framing: "auto",
};

export async function loadVisualRoleplayPrefs(userId: string): Promise<VisualRoleplayPrefs> {
  const { data, error } = await supabase.from("users").select("preferences").eq("id", userId).single();
  if (error) return { ...DEFAULT_PREFS };
  const prefs = (data?.preferences as Record<string, unknown> | null) ?? {};
  const vr = (prefs.visual_roleplay as Record<string, unknown> | undefined) ?? {};
  const mode = vr.mode === "auto" ? "auto" : "manual";
  const pov: VisualRoleplayPov = vr.pov === "third_person" ? "third_person" : "first_person";
  const rawShot = vr.shot_framing;
  const shot_framing: VisualRoleplayShot =
    typeof rawShot === "string" && (SHOT_VALUES as readonly string[]).includes(rawShot)
      ? (rawShot as VisualRoleplayShot)
      : "auto";
  return {
    mode,
    auto_generate_images: Boolean(vr.auto_generate_images),
    pov,
    shot_framing,
  };
}

export async function saveVisualRoleplayPrefs(patch: Partial<VisualRoleplayPrefs>): Promise<void> {
  // The `set_visual_roleplay_prefs` RPC only handles mode + auto_generate
  // (cycle 0014 signature). POV lives in the same JSONB sub-object but is
  // written via direct RMW to avoid a migration. Two writes per save is
  // acceptable — they write to the same row and we call them sequentially.
  if (patch.mode !== undefined || patch.auto_generate_images !== undefined) {
    const { error } = await supabase.rpc("set_visual_roleplay_prefs", {
      p_mode: patch.mode ?? null,
      p_auto_generate_images: patch.auto_generate_images ?? null,
    });
    if (error) throw error;
  }
  if (patch.pov !== undefined) {
    await saveVisualRoleplayPov(patch.pov);
  }
  if (patch.shot_framing !== undefined) {
    await saveVisualRoleplayShot(patch.shot_framing);
  }
}

// Loads the bundled Visual Roleplay Instructions default from the backend
// (cycle 0040). Used by the Prompt Editor's Custom tab for "Load default
// into editor" and the collapsed "View default" disclosure. Returns ""
// when not authenticated or if the fetch fails — the caller can fall back
// gracefully.
export async function loadVisualRoleplayDefaultInstructions(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) return "";
  const res = await fetch(`${BACKEND_URL}/prompt-editor/visual-roleplay-default`, {
    headers: { "Authorization": `Bearer ${jwt}` },
  });
  if (!res.ok) return "";
  const body = await res.json();
  return String(body.instructions ?? "");
}

// Direct read-modify-write on `users.preferences.visual_roleplay.pov`.
// Kept separate from the RPC above so we don't need a migration to extend
// the RPC signature with p_pov.
export async function saveVisualRoleplayPov(pov: VisualRoleplayPov): Promise<void> {
  await _mergeVrField({ pov });
}

// Cycle 0046 — same RMW pattern as POV, JSONB path
// `preferences.visual_roleplay.shot_framing`. Kept as a discrete helper so
// the PromptEditor can write only the selector it changed.
export async function saveVisualRoleplayShot(shot_framing: VisualRoleplayShot): Promise<void> {
  await _mergeVrField({ shot_framing });
}

async function _mergeVrField(patch: Record<string, unknown>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { data: row, error: readErr } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", user.id)
    .single();
  if (readErr) throw readErr;
  const prefsObj = (row?.preferences as Record<string, unknown>) || {};
  const currentVr = (prefsObj.visual_roleplay as Record<string, unknown>) || {};
  const nextVr = { ...currentVr, ...patch };
  const nextAll = { ...prefsObj, visual_roleplay: nextVr };
  const { error: updateErr } = await supabase
    .from("users")
    .update({ preferences: nextAll })
    .eq("id", user.id);
  if (updateErr) throw updateErr;
}

/**
 * Extract and strip a single `[image: …]` tag from an assistant message.
 *
 * The spec (visual_roleplay_instructions.txt) places the tag at the END
 * of the reply. We also accept a tag anywhere in the string as a tolerant
 * fallback (e.g. if the model adds trailing prose by mistake).
 */
export function extractImageTag(text: string): { imagePrompt: string | null; stripped: string } {
  if (!text) return { imagePrompt: null, stripped: "" };
  // End-of-STRING anchor only. The `m` flag would let `$` match end-of-line,
  // firing on tags that appear mid-message — we want the strict tail before
  // falling back to the tolerant "anywhere" pattern below.
  const re = /\[image:\s*([^\]]+?)\s*\]\s*$/i;
  const tail = text.match(re);
  if (tail) {
    return {
      imagePrompt: tail[1].trim(),
      stripped: text.slice(0, tail.index).trimEnd(),
    };
  }
  const anywhere = text.match(/\[image:\s*([^\]]+?)\s*\]/i);
  if (anywhere) {
    const start = anywhere.index ?? 0;
    const end = start + anywhere[0].length;
    return {
      imagePrompt: anywhere[1].trim(),
      stripped: (text.slice(0, start) + text.slice(end)).replace(/[ \t]+\n/g, "\n").trimEnd(),
    };
  }
  return { imagePrompt: null, stripped: text };
}
