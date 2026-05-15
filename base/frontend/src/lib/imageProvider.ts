import { supabase } from "./supabase";
import type { ProviderConfig } from "./providers";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000";

// Cycle 0090 — fal.ai introduced as a sibling image provider alongside
// ComfyUI. Migration 0036 added upsert_image_provider_v2 (per-family upsert
// + atomic is_active flip) and set_active_image_provider. The legacy v1 RPC
// stays in the DB for safety, but the frontend always uses v2 so saving
// either family preserves the other's row + key.
export const IMAGE_PROVIDER_FAMILIES = {
  COMFYUI: "comfyui",
  FAL: "fal",
} as const;

export type ImageProviderDraft = {
  base_url: string | null;
  api_key: string | null;
  workflow_config: Record<string, unknown>;
};

export type TestImageResult = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
};

// Single active row across all image-kind providers. ComfyUI form uses this
// for the legacy "active workflow + key" view.
export async function listActiveImageProvider(): Promise<ProviderConfig | null> {
  const { data, error } = await supabase
    .from("provider_configs")
    .select("*")
    .eq("kind", "image")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as ProviderConfig | null;
}

// All image-provider rows for the user (active + inactive). Used by the
// settings page to show ComfyUI + fal.ai side-by-side regardless of which is
// currently active.
export async function listImageProviders(): Promise<ProviderConfig[]> {
  const { data, error } = await supabase
    .from("provider_configs")
    .select("*")
    .eq("kind", "image")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProviderConfig[];
}

// ComfyUI form save — routes through v2 with family='comfyui' so a fal.ai
// row in the same account stays intact.
export async function upsertImageProvider(draft: ImageProviderDraft): Promise<ProviderConfig> {
  return upsertImageProviderForFamily(IMAGE_PROVIDER_FAMILIES.COMFYUI, draft);
}

// Generic per-family upsert. Pass null api_key to keep the existing key.
// workflow_config is the per-family config blob (ComfyUI workflow JSON,
// fal.ai style/refs config, etc.) — schema is opaque to the DB.
export async function upsertImageProviderForFamily(
  family: string,
  draft: ImageProviderDraft,
): Promise<ProviderConfig> {
  const { data, error } = await supabase.rpc("upsert_image_provider_v2", {
    p_provider_family: family,
    p_base_url: draft.base_url,
    p_api_key: draft.api_key,
    p_workflow_config: draft.workflow_config,
  });
  if (error) throw error;
  return data as ProviderConfig;
}

// Flip the active image provider without rotating the key. Throws if the
// named family has no row for this user.
export async function setActiveImageProvider(family: string): Promise<ProviderConfig> {
  const { data, error } = await supabase.rpc("set_active_image_provider", {
    p_provider_family: family,
  });
  if (error) throw error;
  return data as ProviderConfig;
}

// Cycle 0095 — fal-specific image prefs persisted on `users.preferences.image`.
// Style drives the prompt-template suffix (realistic/anime/custom). Custom
// template applies only when style==='custom' (free-form prose appended after
// the refined paragraph). use_chat_history_refs is a 0-5 stepper that opts
// into appending the last N chat-scene URLs as additional fal `image_urls`
// for stronger continuity at extra cost.
export type FalImagePrefs = {
  style: "realistic" | "anime" | "custom";
  custom_template: string;
  use_chat_history_refs: number;
};

export const FAL_IMAGE_PREFS_DEFAULTS: FalImagePrefs = {
  style: "anime",
  custom_template: "",
  use_chat_history_refs: 0,
};

const _STYLE_VALUES: ReadonlySet<FalImagePrefs["style"]> = new Set(["realistic", "anime", "custom"]);

export async function loadFalImagePrefs(userId: string): Promise<FalImagePrefs> {
  const { data, error } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const prefs = (data?.preferences ?? {}) as Record<string, unknown>;
  const image = (prefs.image ?? {}) as Record<string, unknown>;
  const rawStyle = typeof image.style === "string" ? image.style.toLowerCase() : "";
  const style = _STYLE_VALUES.has(rawStyle as FalImagePrefs["style"])
    ? (rawStyle as FalImagePrefs["style"])
    : FAL_IMAGE_PREFS_DEFAULTS.style;
  const custom_template = typeof image.custom_template === "string" ? image.custom_template : "";
  const rawN = image.use_chat_history_refs;
  const use_chat_history_refs =
    typeof rawN === "number" && Number.isFinite(rawN)
      ? Math.max(0, Math.min(5, Math.round(rawN)))
      : 0;
  return { style, custom_template, use_chat_history_refs };
}

export async function saveFalImagePrefs(userId: string, prefs: FalImagePrefs): Promise<void> {
  // Read-modify-write: the prefs blob holds many other keys (memory,
  // grammar, tts, …) and we don't want to clobber them. RLS allows the
  // user to update their own row; concurrent edits within the same tab
  // are not a real concern for a settings panel.
  const { data: row, error: readErr } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (readErr) throw readErr;
  const cur = (row?.preferences ?? {}) as Record<string, unknown>;
  const curImage = (cur.image ?? {}) as Record<string, unknown>;
  const next = {
    ...cur,
    image: {
      ...curImage,
      style: prefs.style,
      custom_template: prefs.custom_template,
      use_chat_history_refs: Math.max(0, Math.min(5, Math.round(prefs.use_chat_history_refs))),
    },
  };
  const { error: writeErr } = await supabase
    .from("users")
    .update({ preferences: next })
    .eq("id", userId);
  if (writeErr) throw writeErr;
}

export async function testImageProvider(): Promise<TestImageResult> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) return { ok: false, error: "not authenticated" };
  const res = await fetch(`${BACKEND_URL}/providers/image/test`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${jwt}`, "Content-Type": "application/json" },
  });
  return res.json();
}

export async function loadRefinerDefaultPrompt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) return "";
  const res = await fetch(`${BACKEND_URL}/providers/image/refiner-default`, {
    headers: { "Authorization": `Bearer ${jwt}` },
  });
  if (!res.ok) return "";
  const body = await res.json();
  return String(body.system_prompt ?? "");
}

export function validateWorkflowShape(workflow: unknown): { ok: true } | { ok: false; error: string } {
  if (!workflow || typeof workflow !== "object") return { ok: false, error: "Workflow must be a JSON object." };
  const nodes = workflow as Record<string, unknown>;

  // Accept an explicit title override (power-user convention).
  const titled = { positive: false, negative: false, sampler: false };
  // Fall back to topology: exactly one KSampler, wired to two CLIPTextEncode nodes.
  let samplerId: string | null = null;
  for (const [id, node] of Object.entries(nodes)) {
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    const title = String(((n._meta ?? {}) as Record<string, unknown>).title ?? "").trim().toLowerCase();
    if (title === "positive") titled.positive = true;
    if (title === "negative") titled.negative = true;
    if (title === "sampler") titled.sampler = true;
    const cls = String(n.class_type ?? "");
    if (!samplerId && cls.startsWith("KSampler")) samplerId = id;
  }
  if (titled.positive && titled.negative && titled.sampler) return { ok: true };
  if (!samplerId) return { ok: false, error: "No KSampler node found." };
  const sampler = nodes[samplerId] as Record<string, unknown>;
  const inputs = (sampler.inputs ?? {}) as Record<string, unknown>;
  const posRef = inputs.positive;
  const negRef = inputs.negative;
  if (!Array.isArray(posRef) || !Array.isArray(negRef)) {
    return { ok: false, error: "KSampler has no positive / negative input wires." };
  }
  return { ok: true };
}
