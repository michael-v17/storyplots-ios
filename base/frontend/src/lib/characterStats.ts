import { supabase } from "./supabase";

export type CharacterStat = { count: number; lastAt: string | null };

export async function loadCharacterStats(userId: string): Promise<Map<string, CharacterStat>> {
  const { data, error } = await supabase
    .from("conversations")
    .select("character_id, last_message_at, created_at")
    .eq("user_id", userId);
  if (error) throw error;
  const map = new Map<string, CharacterStat>();
  for (const row of data ?? []) {
    const charId = (row as { character_id: string | null }).character_id;
    if (!charId) continue;
    const when = (row as { last_message_at: string | null; created_at: string }).last_message_at
      ?? (row as { created_at: string }).created_at;
    const prev = map.get(charId);
    if (!prev) {
      map.set(charId, { count: 1, lastAt: when });
    } else {
      const lastAt = !prev.lastAt || (when && when > prev.lastAt) ? when : prev.lastAt;
      map.set(charId, { count: prev.count + 1, lastAt });
    }
  }
  return map;
}
