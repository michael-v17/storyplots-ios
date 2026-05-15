import type { CharacterDraft } from "./characters";
import { supabase } from "./supabase";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000";

/**
 * Wrap the current CharacterDraft into a Tavern V2 card structure so the
 * Enrich-with-AI button can reuse the /character-refine endpoint. The
 * refiner doesn't distinguish between imported cards and user-authored
 * drafts — it treats every input as "preserve intent, expand where sparse".
 */
export function buildFakeV2CardFromDraft(draft: CharacterDraft): Record<string, unknown> {
  // For group characters, include existing group_members_description in the card
  // description so the refiner can read it and improve / generate member details.
  const personalityLines = draft.personality
    ? Object.entries(draft.personality)
        .filter(([, v]) => typeof v === "string" && v.trim())
        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
        .join("\n")
    : "";
  const goalsLines = draft.goals
    ? Object.entries(draft.goals)
        .filter(([, v]) => typeof v === "string" && v.trim())
        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
        .join("\n")
    : "";
  const worldLines = draft.worldbuilding
    ? Object.entries(draft.worldbuilding)
        .filter(([, v]) => typeof v === "string" && v.trim())
        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
        .join("\n")
    : "";
  const description = [
    draft.system_prompt,
    goalsLines ? `Goals:\n${goalsLines}` : "",
    worldLines ? `Worldbuilding:\n${worldLines}` : "",
    draft.group_members_description ? `Group members:\n${draft.group_members_description}` : "",
  ].filter(Boolean).join("\n\n");
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: draft.name,
      description,
      personality: personalityLines,
      scenario: draft.scenario ?? "",
      first_mes: draft.greeting ?? "",
      creator_notes: draft.tagline ?? "",
      tags: draft.tags ?? [],
    },
  };
}

export class NoTextEngineError extends Error {
  constructor() {
    super("No active text engine configured");
    this.name = "NoTextEngineError";
  }
}

export type RefinedDraft = {
  name: string;
  tagline: string;
  system_prompt: string;
  personality: { core_traits: string; fears_insecurities: string; communication_style: string; quirks_habits: string };
  goals: { primary_goal: string; secret_desire: string; fears_to_overcome: string; would_sacrifice: string };
  worldbuilding: { origin_birthplace: string; backstory: string; world_setting: string; special_abilities: string };
  scenario: string;
  greeting: string;
  tags: string[];
  age: string | null;
  gender: "male" | "female" | "non_binary" | "unspecified" | null;
  build: string | null;
  height: string | null;
  hair_color: string | null;
  hair_style: string | null;
  eye_color: string | null;
  skin_tone: string | null;
  distinctive_features: string | null;
  signature_style: string | null;
  voice_style: string | null;
  group_members_description: string | null;
  detected_group_size: number;
  // Cycle 0115 — Ali:Chat voice samples; 3-5 entries with ≥1 refusal.
  dialogue_examples: Array<{ user_msg: string; char_reply: string; kind: "everyday" | "refusal" | "unguarded" }>;
};

export async function refineCharacterCard(
  rawCard: Record<string, unknown>,
  format: "v1" | "v2" | "v3",
  groupSize: number = 1,
  signal?: AbortSignal,
): Promise<RefinedDraft> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error("Not signed in");

  const res = await fetch(`${BACKEND_URL}/character-refine`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw_card: rawCard, format, group_size: groupSize }),
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
    throw new Error(`character-refine 400: ${detail ?? "bad request"}`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`character-refine ${res.status}: ${body.slice(0, 200)}`);
  }

  return (await res.json()) as RefinedDraft;
}
