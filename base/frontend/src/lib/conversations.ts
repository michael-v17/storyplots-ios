import { supabase } from "./supabase";
import type { Character } from "./characters";
import { loadPersona } from "./persona";
import {
  buildWritingStyleSnapshot,
  fetchRoleplayBuiltIn,
  fetchWritingStyleById,
} from "./writingStyles";

type BranchMode = "keep_messages" | "summarize_fresh";

// Shape of character_snapshot — the prompt-relevant subset of Character
// that the future 11-position assembly reads. Committed in schema.md §2.4.
type CharacterSnapshot = {
  name: string;
  system_prompt: string;
  mode: Character["mode"];
  personality: Character["personality"];
  goals: Character["goals"];
  worldbuilding: Character["worldbuilding"];
  english_style: Character["english_style"];
  scenario: Character["scenario"];
  expertise_areas: Character["expertise_areas"];
  communication_style_assistant: Character["communication_style_assistant"];
  rules: Character["rules"];
  character_memory_enabled: Character["character_memory_enabled"];
  // Cycle 0115 — Ali:Chat voice samples, snapshotted with the rest of the
  // character data so per-conversation prompt assembly is decoupled from
  // later edits to the live character row.
  dialogue_examples: Character["dialogue_examples"];
  // Cycle 0130 — per-character Roleplay scaffolding override, frozen at
  // creation so editing the character later does not retroactively change
  // existing conversations (snapshot semantics, creator-vision §8).
  rp_overrides: Character["rp_overrides"];
};

export type Conversation = {
  id: string;
  user_id: string;
  character_id: string;
  title: string;
  character_snapshot: CharacterSnapshot;
  writing_style_snapshot: Record<string, unknown>;
  persona_id: string | null;
  last_message_at: string | null;
  message_count: number;
  branch_parent_conversation_id: string | null;
  branch_parent_message_id: string | null;
  branch_mode: BranchMode | null;
  parent_branch_summary: string | null;
  created_at: string;
  updated_at: string;
};

// V2 Tavern convention: greeting / first-message / scenario templates may
// contain `{{user}}` / `{{char}}` placeholders that expand to the active
// User Persona name and the Character name. Single-brace `{user}` / `{char}`
// are accepted too because observed cards in the wild mix both forms.
// Exported so the chat feed can substitute the scenario card at render time
// (scenario text is read live from the character, unlike the greeting which
// is frozen into messages at creation).
export function substituteCardPlaceholders(text: string, userName: string, charName: string): string {
  return text
    .replace(/\{\{user\}\}/g, userName)
    .replace(/\{user\}/g, userName)
    .replace(/\{\{char\}\}/g, charName)
    .replace(/\{char\}/g, charName);
}

function buildCharacterSnapshot(c: Character): CharacterSnapshot {
  return {
    name: c.name,
    system_prompt: c.system_prompt,
    mode: c.mode,
    personality: c.personality,
    goals: c.goals,
    worldbuilding: c.worldbuilding,
    english_style: c.english_style,
    scenario: c.scenario,
    expertise_areas: c.expertise_areas,
    communication_style_assistant: c.communication_style_assistant,
    rules: c.rules,
    character_memory_enabled: c.character_memory_enabled,
    dialogue_examples: c.dialogue_examples,
    rp_overrides: c.rp_overrides,
  };
}

export async function listRecentConversations(
  userId: string,
  limit = 5,
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

export async function listConversationsForCharacter(
  userId: string,
  characterId: string,
): Promise<Conversation[]> {
  // Explicit user_id predicate in addition to RLS — defense-in-depth so
  // findOrCreateForCharacter can never route a caller into another user's
  // conversation if RLS is ever misconfigured or bypassed.
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .eq("character_id", characterId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

export async function loadConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Conversation | null;
}

// Cycle 0131 — resolve the persona a conversation should carry: the character's
// own default_persona_id wins, falling back to the user's global persona so a
// conversation always carries one when the user has set up a persona at all.
async function resolvePersonaId(userId: string, character: Character): Promise<string | null> {
  if (character.default_persona_id) return character.default_persona_id;
  const persona = await loadPersona(userId).catch(() => null);
  return persona?.id ?? null;
}

export async function createConversationFromCharacter(
  userId: string,
  character: Character,
): Promise<Conversation> {
  const personaId = await resolvePersonaId(userId, character);
  // Resolve the Writing Style preset and snapshot it into the initial INSERT
  // (not a later UPDATE) so the snapshot is "write once at creation" per
  // architecture.md §4.1 §Snapshot semantics.
  // Null character default falls back to the Roleplay built-in so position 1
  // is always populated for new conversations.
  let styleRow = character.default_writing_style_id
    ? await fetchWritingStyleById(character.default_writing_style_id).catch(() => null)
    : null;
  if (!styleRow) {
    styleRow = await fetchRoleplayBuiltIn().catch(() => null);
  }
  const writing_style_snapshot = styleRow ? buildWritingStyleSnapshot(styleRow) : {};

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      character_id: character.id,
      character_snapshot: buildCharacterSnapshot(character),
      writing_style_snapshot,
      persona_id: personaId,
    })
    .select()
    .single();
  if (error) throw error;
  const conversation = data as Conversation;

  // Auto-insert greeting as the first assistant message (cycle 0025).
  if (character.greeting) {
    try {
      let userName = "User";
      if (personaId) {
        const { data: persona } = await supabase
          .from("user_personas")
          .select("name")
          .eq("id", personaId)
          .maybeSingle();
        if (persona?.name) userName = persona.name;
      }
      const greetingText = substituteCardPlaceholders(character.greeting, userName, character.name);
      const { data: msg } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          role: "assistant",
          text: greetingText,
        })
        .select()
        .single();
      if (msg) {
        // Cycle 0008 made model_snapshot + generation_params_snapshot NOT NULL
        // on message_variants, but cycle 0025's greeting auto-insert was
        // written without those fields — the insert silently failed under
        // the swallow-all try/catch below, leaving active_variant_id NULL
        // and producing empty greeting bubbles. Populate with sentinels
        // (this variant is a card template, not an LLM generation).
        await supabase.from("message_variants").insert({
          message_id: msg.id,
          content: greetingText,
          model_snapshot: "greeting",
          generation_params_snapshot: {},
        });
        // Set active_variant to the one just created.
        const { data: variant } = await supabase
          .from("message_variants")
          .select("id")
          .eq("message_id", msg.id)
          .limit(1)
          .single();
        if (variant) {
          await supabase.from("messages").update({ active_variant_id: variant.id }).eq("id", msg.id);
        }
      }
    } catch {
      // Greeting insert failure doesn't invalidate the conversation.
    }
  }

  // Drain pending_character_book (from a V2 import) into this first
  // Conversation's lorebook_entries, then clear the character field so
  // later Conversations don't re-import. Best-effort — a failure here
  // does not invalidate the created Conversation.
  const book = character.pending_character_book;
  if (Array.isArray(book) && book.length > 0) {
    try {
      const rows = book.flatMap((raw) => {
        if (!raw || typeof raw !== "object") return [];
        const e = raw as { keys?: unknown; content?: unknown; name?: unknown };
        const keywords = Array.isArray(e.keys) ? e.keys.filter((k): k is string => typeof k === "string" && k.trim().length > 0) : [];
        const body = typeof e.content === "string" ? e.content : "";
        if (!body.trim()) return [];
        const title = typeof e.name === "string" && e.name.trim() ? e.name.trim() : keywords[0] ?? "Imported entry";
        return [{
          user_id: userId,
          conversation_id: conversation.id,
          title,
          keywords,
          body,
          source: "auto_extracted",
          token_estimate: Math.ceil(body.length / 4),
        }];
      });
      if (rows.length > 0) {
        await supabase.from("lorebook_entries").insert(rows);
      }
      await supabase.from("characters").update({ pending_character_book: null }).eq("id", character.id);
    } catch {
      // Leave pending_character_book set for a future attempt.
    }
  }

  return conversation;
}

export async function findOrCreateForCharacter(
  userId: string,
  character: Character,
): Promise<Conversation> {
  const existing = await listConversationsForCharacter(userId, character.id);
  if (existing.length > 0) {
    const conv = existing[0];
    // Cycle 0131 — backfill a missing persona on open so an older conversation
    // (created before the user had a persona, or via a path that passed null)
    // still sends the User Persona block to the model. Never overwrite an
    // existing persona_id — "mantener fijo".
    if (conv.persona_id === null) {
      const personaId = await resolvePersonaId(userId, character);
      if (personaId) {
        const { data } = await supabase
          .from("conversations")
          .update({ persona_id: personaId })
          .eq("id", conv.id)
          // Defense-in-depth user_id predicate in addition to RLS — same
          // rationale as listConversationsForCharacter above.
          .eq("user_id", userId)
          .select()
          .single();
        if (data) return data as Conversation;
      }
    }
    return conv;
  }
  return createConversationFromCharacter(userId, character);
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from("conversations").delete().eq("id", id);
  if (error) throw error;
}
