import { supabase } from "./supabase";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000";

export type ForkMode = "keep_messages" | "summarize_fresh";

export type ForkResult = {
  conversation_id: string;
  title: string;
  branch_mode: ForkMode;
};

export async function forkConversation(
  conversationId: string,
  messageId: string,
  mode: ForkMode,
  title: string | null,
): Promise<ForkResult> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error("Not signed in");

  const res = await fetch(`${BACKEND_URL}/conversations/${conversationId}/fork`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message_id: messageId, mode, title: title || null }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fork failed (${res.status}): ${body.slice(0, 200)}`);
  }

  return (await res.json()) as ForkResult;
}
