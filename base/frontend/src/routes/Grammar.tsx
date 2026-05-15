import { useEffect, useState } from "react";
import { readGrammarPrefs, type GrammarCorrection } from "../lib/grammar";
import { clearAllGrammarData, loadAggregate, triggerInsightsIfDirty, type GrammarAggregate } from "../lib/insights";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import { Spinner } from "../lib/Spinner";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function Grammar() {
  useDocumentTitle("Grammar");
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;
  const [agg, setAgg] = useState<GrammarAggregate | null>(null);
  const [corrections, setCorrections] = useState<GrammarCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [aggregate, allCorrections, userRow] = await Promise.all([
        loadAggregate(),
        supabase.from("grammar_corrections").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("users").select("preferences").eq("id", userId).single(),
      ]);
      if (cancelled) return;
      setAgg(aggregate);
      setCorrections((allCorrections.data ?? []) as GrammarCorrection[]);
      setLoading(false);

      // Fire insights job in background if dirty.
      const prefs = readGrammarPrefs(userRow.data?.preferences as Record<string, unknown> | null);
      if (prefs.master && aggregate?.dirty) {
        setRefreshing(true);
        await triggerInsightsIfDirty(1); // low threshold for dashboard visits
        // Re-load after a delay to pick up fresh data.
        await new Promise((r) => setTimeout(r, 5000));
        const fresh = await loadAggregate();
        if (!cancelled) { setAgg(fresh); setRefreshing(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  async function onClear() {
    if (!window.confirm("Clear all grammar data? This removes every correction and resets your dashboard. This can't be undone.")) return;
    await clearAllGrammarData();
    setCorrections([]);
    setAgg(null);
  }

  if (loading) {
    return <main style={{ maxWidth: 960, margin: "1.5rem auto", padding: "0 1rem" }}><Spinner testId="grammar-loading" /></main>;
  }

  const hasAnyData = !!agg?.detected_level;

  return (
    <main data-testid="grammar-dashboard" className="sp-page-content" style={{ maxWidth: 960, margin: "1.5rem auto", padding: "0 1rem" }}>
      <header className="sp-main-header" style={{ marginBottom: "1.75rem" }}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1" style={{ margin: 0 }}>Grammar</h1>
      </header>
      {refreshing && <small style={{ color: "var(--sp-fg-3)", display: "block", marginBottom: "0.75rem" }}>Refreshing insights in background…</small>}

      {!hasAnyData && (
        <p data-testid="grammar-empty-hint" style={{
          color: "var(--sp-fg-3)",
          padding: "1.25rem",
          border: "1.5px dashed var(--sp-border-strong)",
          background: "var(--sp-bg-2)",
          borderRadius: "var(--sp-radius)",
        }}>
          Your detected level, common errors, and overused words will appear here as you chat with grammar enabled.
        </p>
      )}

      {/* Hero — level + reinforcement */}
      <section style={heroGrid}>
        <div data-testid="block-level" style={heroCard}>
          <small className="sp-section-label">Detected Level</small>
          <div style={heroValue}>{agg?.detected_level ?? "—"}</div>
        </div>
        <div data-testid="block-reinforcement" style={heroCard}>
          <small className="sp-section-label">Reinforcement Performance</small>
          <div style={heroValue}>
            {agg?.reinforcement_performance_pct != null ? `${agg.reinforcement_performance_pct}%` : "—"}
          </div>
          {agg?.reinforcement_performance_pct != null && (
            <small style={{ color: "var(--sp-fg-3)" }}>failure rate</small>
          )}
        </div>
      </section>

      {/* Stats grid — 4 list cards */}
      <section style={statsGrid}>
        <StatCard title="Most Common Errors" data-testid="block-errors" count={agg?.top_errors?.length ?? 0}>
          <CountList items={agg?.top_errors} getKey={(e) => e.category} getLabel={(e) => e.category.replace(/_/g, " ")} getCount={(e) => e.count} />
        </StatCard>
        <StatCard title="Filler Words" data-testid="block-fillers" count={agg?.filler_words?.length ?? 0}>
          <CountList items={agg?.filler_words} getKey={(f) => f.word} getLabel={(f) => f.word} getCount={(f) => f.count} />
        </StatCard>
        <StatCard title="Overused Words" data-testid="block-overused" count={agg?.overused_words?.length ?? 0}>
          <CountList items={agg?.overused_words} getKey={(o) => o.word} getLabel={(o) => o.word} getCount={(o) => o.count} />
        </StatCard>
        <StatCard title="Connector Analysis" data-testid="block-connectors" count={agg?.connector_stats?.length ?? 0}>
          <CountList items={agg?.connector_stats} getKey={(c) => c.connector} getLabel={(c) => c.connector} getCount={(c) => c.count} />
        </StatCard>
      </section>

      {/* Narrative row — two text blocks */}
      <section style={narrativeGrid}>
        <div data-testid="block-feedback" style={narrativeCard}>
          <strong>AI Narrative Feedback</strong>
          <div style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap", color: "var(--sp-fg-2)" }}>{agg?.ai_narrative_feedback ?? <Empty />}</div>
        </div>
        <div data-testid="block-suggestions" style={narrativeCard}>
          <strong>Improvement Suggestions</strong>
          <div style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap", color: "var(--sp-fg-2)" }}>{agg?.improvement_suggestions ?? <Empty />}</div>
        </div>
      </section>

      {/* Corrections at the bottom */}
      <section data-testid="block-corrections" style={{ ...narrativeCard, marginBottom: "1rem" }}>
        <strong>Full Correction List</strong>
        {corrections.length > 0 ? (
          <div style={{ maxHeight: 320, overflowY: "auto", marginTop: "0.5rem" }}>
            {corrections.map((c) => (
              <div key={c.id} style={{ padding: "0.4rem 0", borderBottom: "1px solid var(--sp-border-soft)", fontSize: "0.9em" }}>
                <div style={{ textDecoration: "line-through", color: "var(--sp-fg-3)" }}>{c.original_text}</div>
                <div style={{ color: "var(--sp-fg)" }}>{c.corrected_text}</div>
              </div>
            ))}
          </div>
        ) : <div style={{ marginTop: "0.5rem" }}><Empty /></div>}
      </section>

      <button
        type="button"
        data-testid="clear-all-grammar"
        onClick={onClear}
        style={clearAllPillStyle}
      >
        Clear all grammar data
      </button>
    </main>
  );
}

function StatCard({
  title, count, children, ...rest
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  "data-testid"?: string;
}) {
  return (
    <div {...rest} style={statCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong>{title}</strong>
        {count > 0 && <small style={{ color: "var(--sp-fg-3)" }}>{count}</small>}
      </div>
      <div style={{ marginTop: "0.4rem" }}>{children}</div>
    </div>
  );
}

function Empty() {
  return <span style={{ color: "var(--sp-fg-3)" }}>No data yet.</span>;
}

function CountList<T>({
  items, getKey, getLabel, getCount,
}: {
  items: T[] | null | undefined;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getCount: (item: T) => number;
}) {
  if (!items?.length) return <Empty />;
  return (
    <ul style={listStyle}>
      {items.map((item) => (
        <li key={getKey(item)}>{getLabel(item)} <span style={countChip}>{getCount(item)}</span></li>
      ))}
    </ul>
  );
}

const heroGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "0.75rem",
  marginBottom: "0.75rem",
};
const heroCard: React.CSSProperties = {
  padding: "1rem 1.25rem",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  background: "var(--sp-bg-2)",
};
const heroValue: React.CSSProperties = {
  fontSize: "1.8em",
  fontWeight: 600,
  marginTop: "0.25rem",
  color: "var(--sp-fg)",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "0.75rem",
  marginBottom: "0.75rem",
};
const statCard: React.CSSProperties = {
  padding: "0.85rem 1rem",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  background: "var(--sp-bg-2)",
};
const listStyle: React.CSSProperties = {
  margin: "0.25rem 0 0",
  paddingLeft: "1rem",
  fontSize: "0.9em",
  lineHeight: 1.7,
  color: "var(--sp-fg-2)",
};
// Pill chip matching Home 0068 pattern (bg-3 + fg-2, radius 999, weight 600)
// — visible chip > muted text per cycle 0069 legibility feedback.
const countChip: React.CSSProperties = {
  background: "var(--sp-bg-3)",
  color: "var(--sp-fg-2)",
  borderRadius: "var(--sp-radius)",
  padding: "0.05rem 0.5rem",
  fontSize: "0.8em",
  fontWeight: 600,
  marginLeft: "0.4rem",
};

const narrativeGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "0.75rem",
  marginBottom: "0.75rem",
};
const narrativeCard: React.CSSProperties = {
  padding: "1rem 1.1rem",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  background: "var(--sp-bg-2)",
};

const clearAllPillStyle: React.CSSProperties = {
  background: "transparent",
  color: "var(--sp-destructive)",
  border: "1px solid var(--sp-destructive)",
  padding: "0.5rem 1.1rem",
  borderRadius: "var(--sp-radius)",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "inherit",
};
