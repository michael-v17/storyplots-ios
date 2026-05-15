import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type MemoryToast = {
  id: string;
  fact: string;
  topic: string;
};

/**
 * Subscribe to new memory_documents inserts for a conversation. Calls
 * `onSaved` with the first chunk's text for each new document.
 * Returns an unsubscribe function.
 */
export function subscribeMemorySaves(
  conversationId: string,
  onSaved: (toast: MemoryToast) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`memory-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "memory_documents",
        filter: `conversation_id=eq.${conversationId}`,
      },
      async (payload) => {
        const row = payload.new as { id: string; title: string | null };
        if (!row?.id) return;
        try {
          const { data } = await supabase
            .from("memory_document_chunks")
            .select("text")
            .eq("memory_document_id", row.id)
            .order("chunk_index", { ascending: true })
            .limit(1)
            .maybeSingle();
          const text = data?.text as string | undefined;
          if (text && text.trim()) {
            onSaved({
              id: row.id,
              fact: text.trim(),
              topic: row.title?.trim() || "memory",
            });
          }
        } catch {
          // Best-effort; skip on fetch failure.
        }
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
