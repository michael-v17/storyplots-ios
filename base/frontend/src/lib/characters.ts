import { supabase } from "./supabase";
import type { RpOverrides } from "./rpPrefs";

export type CharacterMode = "roleplay" | "assistant";
export type EnglishStyle = "formal_american" | "neutral_american" | "casual_american";
export type Gender = "male" | "female" | "non_binary" | "unspecified";

export type Personality = {
  core_traits?: string;
  fears_insecurities?: string;
  communication_style?: string;
  quirks_habits?: string;
};
export type Goals = {
  primary_goal?: string;
  secret_desire?: string;
  fears_to_overcome?: string;
  would_sacrifice?: string;
};
export type Worldbuilding = {
  origin_birthplace?: string;
  backstory?: string;
  world_setting?: string;
  special_abilities?: string;
};

export type Character = {
  id: string;
  user_id: string;
  name: string;
  tagline: string | null;
  system_prompt: string;
  mode: CharacterMode;
  avatar_ref: string | null;
  // Cycle 0093 — fal.ai dual-gen. White-bg half-body reference image used
  // as image_urls[0] for chat-scene generation. NULL on ComfyUI-only
  // characters and on rows that pre-date the fal migration.
  reference_ref: string | null;
  appearance_description: string | null;
  append_appearance_to_image_prompts: boolean;
  accent_color: string;
  personality: Personality | null;
  goals: Goals | null;
  worldbuilding: Worldbuilding | null;
  default_writing_style_id: string | null;
  default_persona_id: string | null;
  character_memory_enabled: boolean;
  tags: string[] | null;
  scenario: string | null;
  english_style: EnglishStyle;
  expertise_areas: string | null;
  communication_style_assistant: string | null;
  rules: string | null;
  is_example: boolean;
  pending_character_book: unknown[] | null;
  // Cycle 0018 — canonical physical identity. Nullable by design so
  // existing rows keep working; the image refiner falls back to
  // appearance_description + system_prompt when these are absent.
  age: string | null;
  gender: Gender | null;
  build: string | null;
  height: string | null;
  hair_color: string | null;
  hair_style: string | null;
  eye_color: string | null;
  skin_tone: string | null;
  distinctive_features: string | null;
  signature_style: string | null;
  voice_style: string | null;
  // Cycle 0019 — null = random seed per image generation;
  // non-null = locked seed, every image reuses this value for
  // visual consistency. Default ON (emptyDraft assigns a random
  // seed at creation time).
  image_seed: number | null;
  // Cycle 0079 — group character support. group_size=1 is the default (single
  // NPC, existing behavior unchanged). When > 1, group_members_description
  // replaces the 11 individual physical fields for image generation.
  group_size: number;
  group_members_description: string | null;
  greeting: string | null;
  tts_narrator_voice_id: string | null;
  tts_character_voice_id: string | null;
  // Cycle 0115 — Ali:Chat voice samples. Array of {user_msg, char_reply, kind}.
  // Null when the character has none configured; the prompt-assembly Position
  // 5.5 silently skips when null/empty. Refiner populates with 3-5 entries
  // including ≥1 refusal.
  dialogue_examples: DialogueExample[] | null;
  // Cycle 0130 — per-character override of the global Roleplay scaffolding
  // (author_framing / pacing / style_anchor). NULL = inherit the user's global
  // RoleplayPrefs entirely. Snapshotted into character_snapshot at conversation
  // creation; the backend merges it over the global per-key.
  rp_overrides: RpOverrides | null;
  created_at: string;
  updated_at: string;
};

export type DialogueExampleKind = "everyday" | "refusal" | "unguarded";

export type DialogueExample = {
  user_msg: string;
  char_reply: string;
  kind: DialogueExampleKind;
};

export const DIALOGUE_EXAMPLE_KINDS: ReadonlyArray<DialogueExampleKind> = [
  "everyday",
  "refusal",
  "unguarded",
];

export type CharacterDraft = Omit<
  Character,
  "id" | "user_id" | "is_example" | "created_at" | "updated_at"
>;

/** Fresh random seed in [1, 2^31 - 1] — matches the backend
 *  random.randint(1, 2**31-1) range and the migration 0024 backfill. */
export function freshSeed(): number {
  return Math.floor(Math.random() * (2 ** 31 - 1)) + 1;
}

export async function listCharacters(userId: string): Promise<Character[]> {
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Character[];
}

export async function loadCharacter(id: string): Promise<Character | null> {
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Character | null;
}

export async function createCharacter(
  userId: string,
  draft: CharacterDraft,
): Promise<Character> {
  const { data, error } = await supabase
    .from("characters")
    .insert({ user_id: userId, ...draft })
    .select()
    .single();
  if (error) throw error;
  return data as Character;
}

export async function updateCharacter(
  id: string,
  patch: Partial<Omit<CharacterDraft, "mode">>,
): Promise<Character> {
  const { data, error } = await supabase
    .from("characters")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Character;
}

export async function deleteCharacter(id: string): Promise<void> {
  const { error } = await supabase.from("characters").delete().eq("id", id);
  if (error) throw error;
}
