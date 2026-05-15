import { supabase } from "./supabase";
import { urlCacheGet, urlCacheSet } from "./urlCache";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000";
const IMAGE_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export type GeneratedImage = {
  id: string;
  user_id: string;
  character_id: string;
  conversation_id: string | null;
  message_id: string | null;
  kind: "image" | "video";
  prompt: string;
  refined_prompt: string | null;
  resolution_preset: string;
  dimensions: { w: number; h: number };
  provider_snapshot: Record<string, unknown>;
  seed: number | null;
  storage_ref: string | null;
  sfw_blocked: boolean;
  favorite: boolean;
  created_at: string;
  // Cycle 0091 — per-image snapshots + dual-store URLs.
  engine?: string | null;
  style?: string | null;
  bucket?: string | null;
  bytes_size?: number | null;
  external_url?: string | null;
  external_url_provider?: string | null;
  external_url_captured_at?: string | null;
};

// Cycle 0094 — display URL strategy.
// fal generations land in two places: the fal CDN (URL captured at gen
// time) and Supabase Storage (uploaded async by the storage_backfill
// sweeper). For chat scenes <24h old we render straight from the fal
// CDN — costs zero Supabase Egress during the period the user is most
// likely to be reading the chat. After 24h (or if the fal URL fails
// to load) we fall back to a signed Storage URL.
const FAL_CDN_FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

export const RESOLUTION_PRESETS: Array<{ id: string; label: string; dims: [number, number] }> = [
  { id: "square_1024",    label: "Square 1024",    dims: [1024, 1024] },
  { id: "square_1408",    label: "Square 1408",    dims: [1408, 1408] },
  { id: "portrait",       label: "Portrait",       dims: [1280, 1664] },
  { id: "landscape",      label: "Landscape",      dims: [1664, 1280] },
  { id: "tall_portrait",  label: "Tall portrait",  dims: [1088, 1920] },
  { id: "wide_landscape", label: "Wide landscape", dims: [1920, 1088] },
  { id: "ultra_tall",     label: "Ultra tall",     dims: [1024, 2048] },
  { id: "ultra_wide",     label: "Ultra wide",     dims: [2048, 1024] },
];

export function labelForPreset(preset: string | null | undefined): string {
  if (!preset) return "Default (Square 1024)";
  const known = RESOLUTION_PRESETS.find((p) => p.id === preset);
  if (known) return `${known.label} (${known.dims[0]}×${known.dims[1]})`;
  if (preset.startsWith("custom_")) {
    const dims = preset.slice("custom_".length);
    return `Custom (${dims})`;
  }
  return preset;
}

// Cycle 0047 — per-regen ephemeral overrides. Sent in the POST body when
// the user regenerates from the ImageViewer with custom settings. Any
// unset field falls back to the user's saved prefs on the backend.
export type GenerationOverrides = {
  pov?: "first_person" | "third_person";
  shot_framing?: "auto" | "close-up" | "portrait" | "medium_shot" | "cowboy_shot" | "full_body";
  resolution_preset?: string;
  // Cycle 0063 — when set, skip the refiner and use verbatim as the
  // positive prompt (still wrapped by _prompt_wrap).
  prompt_override?: string;
  // Cycle 0097 — per-regen style override (fal only — the ComfyUI path
  // styles via _prompt_wrap so this is a no-op there). Snapshot lands
  // on generated_images.style so variant nav can show different styles
  // side-by-side.
  style_override?: "realistic" | "anime" | "custom";
};

export async function generateImageForMessage(
  messageId: string,
  overrides?: GenerationOverrides,
): Promise<GeneratedImage> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error("Not signed in");

  const res = await fetch(`${BACKEND_URL}/messages/${messageId}/images`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: overrides && Object.keys(overrides).length > 0 ? JSON.stringify(overrides) : undefined,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`image generation failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as GeneratedImage;
}

export async function listImagesForMessage(messageId: string): Promise<GeneratedImage[]> {
  const { data, error } = await supabase
    .from("inline_media")
    .select("position, generated_image:generated_images(*)")
    .eq("message_id", messageId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .map((r) => r.generated_image as unknown as GeneratedImage)
    .filter((img): img is GeneratedImage => !!img);
}

export async function imageUrl(
  storageRef: string | null,
  bucket: string = "generated-media",
): Promise<string | null> {
  if (!storageRef) return null;
  const key = `sp_img_${bucket}_${storageRef}`;
  const cached = urlCacheGet(key);
  if (cached) return cached;
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storageRef, IMAGE_URL_TTL_SECONDS);
  const url = data?.signedUrl ?? null;
  if (url) urlCacheSet(key, url, IMAGE_URL_TTL_SECONDS);
  return url;
}

// Cycle 0094 — pick the best URL for an image given the dual-store
// strategy. Returns null when nothing is yet renderable (rare —
// happens briefly between row insert and the first fal CDN URL hit).
export async function displayUrl(image: GeneratedImage): Promise<string | null> {
  const isFal = (image.engine ?? "").toLowerCase() === "fal";
  const cdn = image.external_url ?? null;
  const capturedAt = image.external_url_captured_at;
  const ageMs =
    capturedAt && !Number.isNaN(Date.parse(capturedAt))
      ? Date.now() - Date.parse(capturedAt)
      : Number.POSITIVE_INFINITY;
  const cdnFresh = isFal && cdn && ageMs < FAL_CDN_FRESH_WINDOW_MS;
  if (cdnFresh) return cdn;
  if (image.storage_ref) {
    return imageUrl(image.storage_ref, image.bucket ?? "generated-media");
  }
  // Edge: Storage upload still pending and the CDN URL is past the
  // freshness window. Fall back to the CDN URL anyway — it usually
  // resolves for a while past the 24h mark; <img onError> in the
  // component handles the post-TTL failure with a placeholder.
  return cdn;
}

export async function toggleFavorite(imageId: string, favorite: boolean): Promise<void> {
  const { error } = await supabase
    .from("generated_images")
    .update({ favorite })
    .eq("id", imageId);
  if (error) throw error;
}

export async function deleteImage(imageId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error("Not signed in");

  const res = await fetch(`${BACKEND_URL}/images/${imageId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${jwt}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`delete failed (${res.status}): ${body.slice(0, 200)}`);
  }
}

export async function listImagesByCharacter(characterId: string): Promise<GeneratedImage[]> {
  const { data, error } = await supabase
    .from("generated_images")
    .select("*")
    .eq("character_id", characterId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GeneratedImage[];
}

/** Max rows returned by `listAllImages`. Keep in sync with the Gallery banner. */
export const IMAGE_LIST_CAP = 500;

export async function listAllImages(): Promise<GeneratedImage[]> {
  // Capped pull to avoid both silent PostgREST truncation (default 1000) and
  // full-payload OOM in the browser at scale. Cursor pagination is a later
  // cycle; this keeps Gallery usable until then.
  const { data, error } = await supabase
    .from("generated_images")
    .select("*")
    .order("created_at", { ascending: false })
    .range(0, IMAGE_LIST_CAP - 1);
  if (error) throw error;
  return (data ?? []) as GeneratedImage[];
}
