import { supabase } from "./supabase";

export type MessageRole = "user" | "assistant";

export type Message = {
  id: string;
  conversation_id: string;
  role: MessageRole;
  text: string | null;
  active_variant_id: string | null;
  created_at: string;
  edited_at: string | null;
};

export async function listMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendUserMessage(conversationId: string, text: string): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role: "user", text })
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

// Edit-as-trim (domain.md §6 invariant #5). PostgREST doesn't expose
// multi-statement transactions; we issue the DELETE and UPDATE sequentially
// and rely on RLS + the messages_touch_conversation trigger to keep derived
// values (message_count, last_message_at) consistent. If the UPDATE fails
// after the DELETE succeeds, the conversation ends at the edit target —
// which is still a valid trimmed state.
export async function editUserMessage(message: Message, newText: string): Promise<Message> {
  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .eq("conversation_id", message.conversation_id)
    .gt("created_at", message.created_at);
  if (deleteError) throw deleteError;

  const { data, error } = await supabase
    .from("messages")
    .update({ text: newText, edited_at: new Date().toISOString() })
    .eq("id", message.id)
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) throw error;
}

export type MessageVariant = {
  id: string;
  message_id: string;
  content: string;
  model_snapshot: string;
  generation_params_snapshot: Record<string, unknown>;
  created_at: string;
};

export async function listVariantsForMessage(messageId: string): Promise<MessageVariant[]> {
  const { data, error } = await supabase
    .from("message_variants")
    .select("*")
    .eq("message_id", messageId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MessageVariant[];
}

export async function setActiveVariant(messageId: string, variantId: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ active_variant_id: variantId })
    .eq("id", messageId);
  if (error) throw error;
}
