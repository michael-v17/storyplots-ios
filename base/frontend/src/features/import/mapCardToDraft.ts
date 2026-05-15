import { freshSeed, type CharacterDraft, type Gender } from "../../lib/characters";
import type { CharacterBookEntry, ParsedCard, TavernV1Card, CharacterCardV2Data } from "./parseCharacterCard";

/** Best-effort pre-fill of the new 0018 canonical attribute fields from
 *  Tavern card tags. The user sees anything we pre-fill in the form and
 *  can correct whatever the heuristic got wrong. Unknown tags stay in
 *  the free-form `tags[]` untouched. */
function inferAttributesFromTags(tagList: string[] | undefined | null): Partial<CharacterDraft> {
  const out: Partial<CharacterDraft> = {};
  if (!tagList || tagList.length === 0) return out;
  const t = new Set(tagList.map((s) => s.toLowerCase().replaceAll(" ", "_")));
  const gender: Gender | null =
    t.has("1boy") || t.has("male") || t.has("old_man") || t.has("mature_male") ? "male" :
    t.has("1girl") || t.has("female") || t.has("old_woman") || t.has("mature_female") ? "female" :
    null;
  if (gender) out.gender = gender;
  const age =
    t.has("elderly") || t.has("old_man") || t.has("old_woman") ? "elderly" :
    t.has("mature_male") || t.has("mature_female") ? "mature" :
    t.has("young_adult") ? "young adult" :
    t.has("teenager") ? "teenager" :
    t.has("child") || t.has("young_child") ? "child" :
    null;
  if (age) out.age = age;
  const COLORS = ["black", "brown", "blonde", "red", "silver", "white", "blue", "green", "pink", "purple", "gray"];
  for (const c of COLORS) {
    if (t.has(`${c}_hair`) && !out.hair_color) out.hair_color = c;
    if (t.has(`${c}_eyes`) && !out.eye_color) out.eye_color = c;
  }
  // Western Tavern cards commonly use "grey" — normalise to "gray".
  if (t.has("grey_hair") && !out.hair_color) out.hair_color = "gray";
  if (t.has("grey_eyes") && !out.eye_color) out.eye_color = "gray";
  return out;
}

export type MapResult = {
  draft: CharacterDraft;
  pendingCharacterBook: CharacterBookEntry[] | null;
};

/** Map a parsed Tavern V1/V2/V3 card into our CharacterDraft.
 *  V3 data is a strict superset of V2 for the fields we consume, so V3
 *  routes through the V2 path. V3-only fields (nickname, source,
 *  group_only_greetings, creator_notes_multilingual, assets) are ignored
 *  by the heuristic and preserved only in the raw payload we ship to the
 *  refiner. */
export function mapCardToDraft(parsed: ParsedCard): MapResult {
  if (parsed.format === "v2" || parsed.format === "v3") return mapV2(parsed.card);
  return mapV1(parsed.card);
}

function mapV1(c: TavernV1Card): MapResult {
  const base = baseDraft({
    name: c.name,
    systemPrompt: joinBlocks([c.description, c.mes_example ? `Example dialogue:\n${c.mes_example}` : null]),
    personalityCore: c.personality,
    scenario: c.scenario,
    greeting: c.first_mes?.trim() || null,
    tagline: trim(c.creatorcomment, 200),
    tags: c.tags ?? null,
  });
  return {
    draft: { ...base, ...inferAttributesFromTags(c.tags) },
    pendingCharacterBook: null,
  };
}

function mapV2(d: CharacterCardV2Data): MapResult {
  // Concatenate description + system_prompt + mes_example for the
  // Conversation Agent system prompt. System prompt takes precedence in
  // ordering so specific instructions land right before the NPC's
  // descriptions. mes_example lands under a heading so the model reads
  // it as reference rather than as live history.
  const systemPrompt = joinBlocks([
    d.description,
    d.system_prompt,
    d.post_history_instructions ? `Post-history: ${d.post_history_instructions}` : null,
    d.mes_example ? `Example dialogue:\n${d.mes_example}` : null,
  ]);

  const base = baseDraft({
    name: d.name,
    systemPrompt,
    personalityCore: d.personality,
    scenario: d.scenario,
    greeting: d.first_mes?.trim() || null,
    tagline: trim(d.creator_notes, 200),
    tags: d.tags ?? null,
  });
  return {
    draft: { ...base, ...inferAttributesFromTags(d.tags) },
    pendingCharacterBook: d.character_book?.entries?.length ? d.character_book.entries : null,
  };
}

function baseDraft(input: {
  name: string;
  systemPrompt: string;
  personalityCore: string | undefined;
  scenario: string | undefined;
  greeting: string | null;
  tagline: string | null;
  tags: string[] | null;
}): CharacterDraft {
  return {
    name: input.name,
    tagline: input.tagline,
    system_prompt: input.systemPrompt,
    mode: "roleplay",
    avatar_ref: null,
    reference_ref: null,
    appearance_description: null,
    append_appearance_to_image_prompts: true,
    accent_color: "#6b7280",
    personality: input.personalityCore ? { core_traits: input.personalityCore.trim() } : null,
    goals: null,
    worldbuilding: null,
    default_writing_style_id: null,
    default_persona_id: null,
    character_memory_enabled: true,
    tags: input.tags && input.tags.length > 0 ? input.tags : null,
    scenario: input.scenario?.trim() || null,
    greeting: input.greeting,
    english_style: "neutral_american",
    expertise_areas: null,
    communication_style_assistant: null,
    rules: null,
    pending_character_book: null,
    age: null,
    gender: null,
    build: null,
    height: null,
    hair_color: null,
    hair_style: null,
    eye_color: null,
    skin_tone: null,
    distinctive_features: null,
    signature_style: null,
    voice_style: null,
    image_seed: freshSeed(),
    tts_narrator_voice_id: null,
    tts_character_voice_id: null,
    group_size: 1,
    group_members_description: null,
    // Cycle 0115 — best-effort parse of mes_example into structured rows
    // happens via a separate post-processing step (see parseMesExampleToDialogueExamples).
    // For the heuristic V1/V2 mapping we leave null; the refiner fills it.
    dialogue_examples: null,
    rp_overrides: null,
  };
}

function joinBlocks(parts: (string | null | undefined)[]): string {
  return parts.filter((p) => typeof p === "string" && p.trim()).map((p) => (p as string).trim()).join("\n\n");
}

function trim(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}
