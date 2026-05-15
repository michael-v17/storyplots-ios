import { supabase } from "./supabase";

export type MemoryChunkRow = {
  id: string;
  memory_document_id: string;
  text: string;
  topic: string;            // from joined memory_documents.title
  token_estimate: number;
  created_at: string;
  message_count_at_creation: number;
};

type ChunkWithDoc = {
  id: string;
  memory_document_id: string;
  text: string;
  token_estimate: number;
  created_at: string;
  message_count_at_creation: number;
  memory_documents: { title: string } | { title: string }[] | null;
};

/** List all memory chunks for this conversation, newest-first. Topic is
 * sourced from the parent memory_documents.title (which is the LLM's
 * extraction category per cycle 0031). */
export async function listMemoryForConversation(conversationId: string): Promise<MemoryChunkRow[]> {
  const { data, error } = await supabase
    .from("memory_document_chunks")
    .select("id, memory_document_id, text, token_estimate, created_at, message_count_at_creation, memory_documents(title)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: ChunkWithDoc) => {
    const doc = Array.isArray(r.memory_documents) ? r.memory_documents[0] : r.memory_documents;
    return {
      id: r.id,
      memory_document_id: r.memory_document_id,
      text: r.text,
      topic: doc?.title ?? "note",
      token_estimate: r.token_estimate ?? 0,
      created_at: r.created_at,
      message_count_at_creation: r.message_count_at_creation ?? 0,
    };
  });
}

/** Delete one chunk. RLS enforces user_id = auth.uid(). */
export async function deleteMemoryChunk(chunkId: string): Promise<void> {
  const { error } = await supabase.from("memory_document_chunks").delete().eq("id", chunkId);
  if (error) throw error;
}

/** Delete every memory_documents row for this conversation. Cascade removes
 * all chunks. Returns the number of documents deleted.
 * RLS enforces user_id = auth.uid(). */
export async function clearMemoryForConversation(conversationId: string): Promise<number> {
  const { data, error } = await supabase
    .from("memory_documents")
    .delete()
    .eq("conversation_id", conversationId)
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}
