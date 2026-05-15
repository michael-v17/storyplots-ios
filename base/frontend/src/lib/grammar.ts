import { supabase } from "./supabase";

export type GrammarCorrection = {
  id: string;
  user_message_id: string;
  conversation_id: string;
  user_id: string;
  original_text: string;
  corrected_text: string;
  explanation: string | null;
  error_categories: string[];
  edit_distance: number | null;
  reinforcement_failures_count: number;
  created_at: string;
};

export type GrammarPrefs = {
  master: boolean;
  inline_enabled: boolean;
  inline_mode: "A" | "B";
  // Cycle 0128 — correction style. "literal" fixes only outright errors and
  // keeps the user's phrasing; "natural" also rewrites grammatical-but-
  // non-native phrasing into the idiomatic native version. Default "natural"
  // so existing users (no key in the JSONB pref blob) keep post-0126 behavior.
  correction_style: "literal" | "natural";
  sidebar_enabled: boolean;
  sidebar_frequency: "every" | "every_3" | "every_5" | "major_errors_only";
  sidebar_open: boolean;
  reinforcement_enabled: boolean;
  custom_model_id: string | null;
};

export function defaultGrammarPrefs(): GrammarPrefs {
  return {
    master: false,
    inline_enabled: false,
    inline_mode: "A",
    correction_style: "natural",
    sidebar_enabled: false,
    sidebar_frequency: "every",
    sidebar_open: false,
    reinforcement_enabled: false,
    custom_model_id: null,
  };
}

export function readGrammarPrefs(preferences: Record<string, unknown> | null): GrammarPrefs {
  const g = (preferences?.grammar ?? {}) as Partial<GrammarPrefs>;
  return { ...defaultGrammarPrefs(), ...g };
}

export async function listCorrectionsForConversation(conversationId: string): Promise<GrammarCorrection[]> {
  const { data, error } = await supabase
    .from("grammar_corrections")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GrammarCorrection[];
}

export async function clearGrammarForConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.from("grammar_corrections").delete().eq("conversation_id", conversationId);
  if (error) throw error;
}

export async function saveGrammarPrefs(userId: string, prefs: GrammarPrefs): Promise<void> {
  const { data: row } = await supabase.from("users").select("preferences").eq("id", userId).single();
  const current = (row?.preferences ?? {}) as Record<string, unknown>;
  const { error } = await supabase.from("users")
    .update({ preferences: { ...current, grammar: prefs } })
    .eq("id", userId);
  if (error) throw error;
}
