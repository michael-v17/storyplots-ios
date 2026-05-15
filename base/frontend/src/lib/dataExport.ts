/**
 * Cycle 0024 — Export My Data.
 * Reads all user-owned data via supabase-js (RLS-scoped), builds a
 * .zip in the browser with JSZip, and triggers a download. Media
 * files (images, audio) are skipped — only DB metadata is exported.
 */

import JSZip from "jszip";
import { supabase } from "./supabase";

export async function exportMyData(userId: string): Promise<void> {
  const zip = new JSZip();
  const now = new Date().toISOString().slice(0, 10);

  // 1. Characters
  const { data: characters } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", userId);
  zip.file("characters.json", JSON.stringify(characters ?? [], null, 2));

  // 2. Conversations + messages + variants (per conversation)
  const { data: conversations } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId);

  const convsWithMessages = [];
  for (const conv of conversations ?? []) {
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at");

    const msgIds = (messages ?? []).map((m: { id: string }) => m.id);
    let variants: unknown[] = [];
    if (msgIds.length > 0) {
      // Batch in chunks of 50 to avoid URL length limits
      for (let i = 0; i < msgIds.length; i += 50) {
        const chunk = msgIds.slice(i, i + 50);
        const { data: v } = await supabase
          .from("message_variants")
          .select("*")
          .in("message_id", chunk);
        variants = variants.concat(v ?? []);
      }
    }

    convsWithMessages.push({
      ...conv,
      messages: messages ?? [],
      variants,
    });
  }
  zip.file("conversations.json", JSON.stringify(convsWithMessages, null, 2));

  // 3. Personas
  const { data: personas } = await supabase
    .from("user_personas")
    .select("*")
    .eq("user_id", userId);
  zip.file("personas.json", JSON.stringify(personas ?? [], null, 2));

  // 4. Lorebook entries
  const { data: lorebook } = await supabase
    .from("lorebook_entries")
    .select("*")
    .eq("user_id", userId);
  zip.file("lorebook.json", JSON.stringify(lorebook ?? [], null, 2));

  // 5. Grammar data
  const { data: corrections } = await supabase
    .from("grammar_corrections")
    .select("*")
    .eq("user_id", userId);
  zip.file("grammar_corrections.json", JSON.stringify(corrections ?? [], null, 2));

  const { data: aggregate } = await supabase
    .from("grammar_aggregates")
    .select("*")
    .eq("user_id", userId);
  zip.file("grammar_aggregate.json", JSON.stringify(aggregate ?? [], null, 2));

  // 6. Settings / preferences
  const { data: userRow } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  zip.file("settings.json", JSON.stringify(userRow?.preferences ?? {}, null, 2));

  // 7. Manifest
  zip.file("manifest.json", JSON.stringify({
    version: "storyplots-v0",
    exported_at: new Date().toISOString(),
    user_id: userId,
    counts: {
      characters: (characters ?? []).length,
      conversations: convsWithMessages.length,
      personas: (personas ?? []).length,
      lorebook: (lorebook ?? []).length,
      grammar_corrections: (corrections ?? []).length,
    },
  }, null, 2));

  // Generate + download
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `storyplots-export-${now}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
