import { supabase } from "./supabase";

export type LorebookSource = "manual" | "auto_extracted";

export type LorebookEntry = {
  id: string;
  conversation_id: string;
  user_id: string;
  title: string;
  keywords: string[];
  body: string;
  source: LorebookSource;
  token_estimate: number;
  created_at: string;
  updated_at: string;
};

export type LorebookDraft = {
  title: string;
  keywords: string[];
  body: string;
};

export async function listLorebookForConversation(conversationId: string): Promise<LorebookEntry[]> {
  const { data, error } = await supabase
    .from("lorebook_entries")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LorebookEntry[];
}

export async function createLorebookEntry(userId: string, conversationId: string, draft: LorebookDraft): Promise<LorebookEntry> {
  const { data, error } = await supabase
    .from("lorebook_entries")
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      title: draft.title.trim(),
      keywords: draft.keywords.filter((k) => k.trim().length > 0),
      body: draft.body,
      source: "manual",
      token_estimate: Math.ceil(draft.body.length / 4),
    })
    .select()
    .single();
  if (error) throw error;
  return data as LorebookEntry;
}

export async function updateLorebookEntry(id: string, draft: LorebookDraft): Promise<LorebookEntry> {
  const { data, error } = await supabase
    .from("lorebook_entries")
    .update({
      title: draft.title.trim(),
      keywords: draft.keywords.filter((k) => k.trim().length > 0),
      body: draft.body,
      token_estimate: Math.ceil(draft.body.length / 4),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as LorebookEntry;
}

export async function deleteLorebookEntry(id: string): Promise<void> {
  const { error } = await supabase.from("lorebook_entries").delete().eq("id", id);
  if (error) throw error;
}
