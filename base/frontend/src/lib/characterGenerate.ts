import { supabase } from "./supabase";
import { NoTextEngineError, type RefinedDraft } from "./characterRefine";

// Cycle 0122 — AI Generate from idea + creative knobs. Server-side at
// POST /character-generate. Returns the same RefinedDraft shape as the
// refiner so the frontend pipeline (mergeRefinedIntoDraft → CharacterForm)
// is identical.

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000";

export type DramaLevel = "none" | "light" | "medium" | "heavy";
export type GenderHint = "any" | "female" | "male" | "non_binary" | "unspecified";
export type AgeRangeHint = "any" | "young_adult" | "adult" | "mid_life" | "older";
export type ToneHint = "any" | "slice_of_life" | "contemporary" | "historical" | "fantasy" | "scifi" | "surreal";

export type GenerateInput = {
  idea: string;
  drama_level: DramaLevel;
  nsfw_allowed: boolean;
  gender_hint: GenderHint;
  age_range_hint: AgeRangeHint;
  tone_hint: ToneHint;
};

export async function generateCharacter(
  input: GenerateInput,
  signal?: AbortSignal,
): Promise<RefinedDraft> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error("Not signed in");

  const res = await fetch(`${BACKEND_URL}/character-generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });

  if (res.status === 400) {
    let detail: string | null = null;
    try {
      const j = (await res.json()) as { detail?: string };
      detail = j.detail ?? null;
    } catch {
      // Ignore parse failure; fall through.
    }
    if (detail === "no_text_engine") throw new NoTextEngineError();
    throw new Error(`character-generate 400: ${detail ?? "bad request"}`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`character-generate ${res.status}: ${body.slice(0, 200)}`);
  }

  return (await res.json()) as RefinedDraft;
}
