import { supabase } from "./supabase";
import { urlCacheGet, urlCacheSet } from "./urlCache";

const BUCKET = "avatars";
const AVATAR_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function uploadCharacterAvatar(
  userId: string,
  characterId: string,
  file: File,
  previous: string | null,
): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/character-${characterId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  if (previous) {
    await supabase.storage.from(BUCKET).remove([previous]);
  }
  return path;
}

export async function avatarUrl(ref: string | null): Promise<string | null> {
  if (!ref) return null;
  const key = `sp_av_${ref}`;
  const cached = urlCacheGet(key);
  if (cached) return cached;
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(ref, AVATAR_URL_TTL_SECONDS);
  const url = data?.signedUrl ?? null;
  if (url) urlCacheSet(key, url, AVATAR_URL_TTL_SECONDS);
  return url;
}
