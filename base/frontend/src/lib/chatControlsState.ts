import { supabase } from "./supabase";

export type ChatControlsState = {
  conversation_id: string;
  user_id: string;
  image_provider_override_id: string | null;
  resolution_preset: string | null;
  auto_images: boolean | null;
  auto_tts: boolean | null;
  created_at: string;
  updated_at: string;
};

export async function loadChatControlsState(conversationId: string): Promise<ChatControlsState | null> {
  const { data, error } = await supabase
    .from("chat_controls_state")
    .select("*")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw error;
  return data as ChatControlsState | null;
}

export async function upsertChatControlsState(
  userId: string,
  conversationId: string,
  patch: Partial<Pick<ChatControlsState, "image_provider_override_id" | "resolution_preset" | "auto_images" | "auto_tts">>,
): Promise<ChatControlsState> {
  const { data, error } = await supabase
    .from("chat_controls_state")
    .upsert({
      conversation_id: conversationId,
      user_id: userId,
      ...patch,
    }, { onConflict: "conversation_id" })
    .select()
    .single();
  if (error) throw error;
  return data as ChatControlsState;
}

export async function clearChatControlsState(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_controls_state")
    .delete()
    .eq("conversation_id", conversationId);
  if (error) throw error;
}
