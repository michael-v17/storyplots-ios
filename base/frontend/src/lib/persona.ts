import { supabase } from "./supabase";
import { urlCacheGet, urlCacheSet } from "./urlCache";

export type Appearance = {
  skin?: string;
  eyes?: string;
  hair?: string;
  extras?: string;
};

export type Persona = {
  id: string;
  user_id: string;
  photo_ref: string | null;
  name: string;
  gender: string | null;
  appearance: Appearance | null;
  background_story: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type PersonaDraft = {
  name: string;
  gender: string | null;
  appearance: Appearance | null;
  background_story: string | null;
  photo_ref: string | null;
};

const BUCKET = "avatars";

export async function loadPersona(userId: string): Promise<Persona | null> {
  const { data, error } = await supabase
    .from("user_personas")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Persona | null;
}

export async function savePersona(userId: string, draft: PersonaDraft): Promise<Persona> {
  const { data, error } = await supabase
    .from("user_personas")
    .upsert({ user_id: userId, ...draft }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data as Persona;
}

export async function clearPersona(userId: string, photoRef: string | null): Promise<void> {
  if (photoRef) {
    await supabase.storage.from(BUCKET).remove([photoRef]);
  }
  const { error } = await supabase.from("user_personas").delete().eq("user_id", userId);
  if (error) throw error;
}

export async function uploadAvatar(
  userId: string,
  file: File,
  previous: string | null,
): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/persona-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  if (previous) {
    // Best-effort cleanup of the replaced object; RLS makes this idempotent
    // per-user, and a stale orphan is not worth blocking the upload.
    await supabase.storage.from(BUCKET).remove([previous]);
  }
  return path;
}

const AVATAR_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function avatarUrl(photoRef: string | null): Promise<string | null> {
  if (!photoRef) return null;
  const key = `sp_persona_${photoRef}`;
  const cached = urlCacheGet(key);
  if (cached) return cached;
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(photoRef, AVATAR_URL_TTL_SECONDS);
  const url = data?.signedUrl ?? null;
  if (url) urlCacheSet(key, url, AVATAR_URL_TTL_SECONDS);
  return url;
}
