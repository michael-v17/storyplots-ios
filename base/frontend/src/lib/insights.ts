import { supabase } from "./supabase";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000";

export type GrammarAggregate = {
  user_id: string;
  detected_level: string | null;
  top_errors: Array<{ category: string; count: number }> | null;
  filler_words: Array<{ word: string; count: number }> | null;
  overused_words: Array<{ word: string; count: number }> | null;
  connector_stats: Array<{ connector: string; count: number }> | null;
  ai_narrative_feedback: string | null;
  improvement_suggestions: string | null;
  reinforcement_performance_pct: number | null;
  dirty: boolean;
  new_messages_since_last_run: number;
  updated_at: string;
};

export async function loadAggregate(): Promise<GrammarAggregate | null> {
  const { data, error } = await supabase
    .from("grammar_aggregates")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as GrammarAggregate | null;
}

export async function triggerInsightsIfDirty(minCorrections: number = 3): Promise<boolean> {
  const agg = await loadAggregate();
  if (!agg || !agg.dirty || agg.new_messages_since_last_run < minCorrections) return false;

  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) return false;

  fetch(`${BACKEND_URL}/insights/run`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${jwt}`, "Content-Type": "application/json" },
  }).catch(() => {});

  return true;
}

export async function clearAllGrammarData(): Promise<void> {
  const { error: gcErr } = await supabase.from("grammar_corrections").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (gcErr) throw gcErr;

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (uid) {
    await supabase.from("grammar_aggregates").delete().eq("user_id", uid);
  }
}
