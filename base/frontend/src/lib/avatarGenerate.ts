import { supabase } from "./supabase";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000";

export class NoImageEngineError extends Error {
  constructor() {
    super("No active image engine configured");
    this.name = "NoImageEngineError";
  }
}

// `reference_ref` is returned by the fal.ai dual-gen path (white-bg
// reference image used to anchor chat scenes); the ComfyUI path omits it.
export async function generateCharacterAvatar(
  characterId: string,
  signal?: AbortSignal,
): Promise<{ avatar_ref: string; reference_ref?: string | null; seed: number }> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error("Not signed in");

  const res = await fetch(`${BACKEND_URL}/characters/${characterId}/generate-avatar`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${jwt}`, "Content-Type": "application/json" },
    signal,
  });

  if (res.status === 409) {
    let detail: string | null = null;
    try {
      const j = (await res.json()) as { detail?: string };
      detail = j.detail ?? null;
    } catch {
      // Ignore parse failure.
    }
    if (detail === "no_image_engine") throw new NoImageEngineError();
    throw new Error(`generate-avatar 409: ${detail ?? "conflict"}`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`generate-avatar ${res.status}: ${body.slice(0, 200)}`);
  }

  return (await res.json()) as { avatar_ref: string; reference_ref?: string | null; seed: number };
}

export async function generatePersonaAvatar(
  signal?: AbortSignal,
): Promise<{ photo_ref: string; seed: number }> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error("Not signed in");

  const res = await fetch(`${BACKEND_URL}/personas/me/generate-avatar`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${jwt}`, "Content-Type": "application/json" },
    signal,
  });

  if (res.status === 409) {
    let detail: string | null = null;
    try {
      const j = (await res.json()) as { detail?: string };
      detail = j.detail ?? null;
    } catch {
      // ignore
    }
    if (detail === "no_image_engine") throw new NoImageEngineError();
    throw new Error(`generate-persona-avatar 409: ${detail ?? "conflict"}`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`generate-persona-avatar ${res.status}: ${body.slice(0, 200)}`);
  }

  return (await res.json()) as { photo_ref: string; seed: number };
}
