import { supabase } from "./supabase";

export type WritingStyle = {
  id: string;
  user_id: string | null;
  name: string;
  is_built_in: boolean;
  writing_instructions: string;
  default_authors_note: string | null;
  created_at: string;
  updated_at: string;
};

export type WritingStyleDraft = {
  name: string;
  writing_instructions: string;
};

export type WritingStyleSnapshot = {
  id: string;
  name: string;
  writing_instructions: string;
  default_authors_note: string | null;
};

export async function listWritingStyles(): Promise<WritingStyle[]> {
  const { data, error } = await supabase
    .from("writing_styles")
    .select("*")
    .order("is_built_in", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WritingStyle[];
}

export async function fetchWritingStyleById(id: string): Promise<WritingStyle | null> {
  const { data, error } = await supabase
    .from("writing_styles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as WritingStyle | null;
}

export async function fetchRoleplayBuiltIn(): Promise<WritingStyle | null> {
  const { data, error } = await supabase
    .from("writing_styles")
    .select("*")
    .eq("is_built_in", true)
    .eq("name", "Roleplay")
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as WritingStyle | null;
}

export async function createWritingStyle(userId: string, draft: WritingStyleDraft): Promise<WritingStyle> {
  const { data, error } = await supabase
    .from("writing_styles")
    .insert({
      user_id: userId,
      name: draft.name.trim(),
      is_built_in: false,
      writing_instructions: draft.writing_instructions,
    })
    .select()
    .single();
  if (error) throw error;
  return data as WritingStyle;
}

export async function updateWritingStyle(id: string, draft: WritingStyleDraft): Promise<WritingStyle> {
  const { data, error } = await supabase
    .from("writing_styles")
    .update({
      name: draft.name.trim(),
      writing_instructions: draft.writing_instructions,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as WritingStyle;
}

export async function deleteWritingStyle(id: string): Promise<void> {
  const { error } = await supabase.from("writing_styles").delete().eq("id", id);
  if (error) throw error;
}

export function buildWritingStyleSnapshot(style: WritingStyle): WritingStyleSnapshot {
  return {
    id: style.id,
    name: style.name,
    writing_instructions: style.writing_instructions,
    default_authors_note: style.default_authors_note,
  };
}
