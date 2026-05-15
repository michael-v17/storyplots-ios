import { supabase } from "./supabase";

export type AuthorsNote = {
  id: string;
  user_id: string;
  conversation_id: string;
  notes_text: string;
  injection_depth: number;
  created_at: string;
  updated_at: string;
};

export async function loadAuthorsNote(conversationId: string): Promise<AuthorsNote | null> {
  const { data, error } = await supabase
    .from("authors_notes")
    .select("*")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw error;
  return (data as AuthorsNote | null) ?? null;
}

export async function upsertAuthorsNote(
  userId: string,
  conversationId: string,
  notesText: string,
  injectionDepth: number,
): Promise<AuthorsNote> {
  const { data, error } = await supabase
    .from("authors_notes")
    .upsert(
      { user_id: userId, conversation_id: conversationId, notes_text: notesText, injection_depth: injectionDepth },
      { onConflict: "conversation_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as AuthorsNote;
}

export async function deleteAuthorsNote(conversationId: string): Promise<void> {
  const { error } = await supabase.from("authors_notes").delete().eq("conversation_id", conversationId);
  if (error) throw error;
}
