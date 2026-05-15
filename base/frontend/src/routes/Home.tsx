import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SkeletonGrid } from "../lib/SkeletonGrid";
import { CharacterGrid } from "../features/characters/CharacterGrid";
import { HomeNudge } from "../features/shell/HomeNudge";
import { listCharacters, type Character } from "../lib/characters";
import { loadCharacterStats, type CharacterStat } from "../lib/characterStats";
import { readGrammarPrefs } from "../lib/grammar";
import { loadAggregate, triggerInsightsIfDirty, type GrammarAggregate } from "../lib/insights";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import { useBreakpoint } from "../lib/useBreakpoint";
import { useDocumentTitle } from "../lib/useDocumentTitle";

// Home is a preview surface: top 5 recent characters on desktop, top 4
// on mobile (the 2-col mobile grid → 2 clean rows). The full unbounded
// library lives on /characters. Load a 5-card buffer, slice by breakpoint
// at render so a resize re-slices without a refetch.
const RECENT_LIMIT = 5;

export function Home() {
  useDocumentTitle(null);
  const sess = useSession();
  const bp = useBreakpoint();
  const recentLimit = bp === "S" ? 4 : 5;
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [stats, setStats] = useState<Map<string, CharacterStat>>(new Map());
  const [grammarSnapshot, setGrammarSnapshot] = useState<GrammarAggregate | null>(null);
  const [grammarMasterOn, setGrammarMasterOn] = useState(false);

  useEffect(() => {
    if (!userId) { setCharacters(null); setStats(new Map()); return; }
    let cancelled = false;
    Promise.all([
      listCharacters(userId),
      loadCharacterStats(userId).catch(() => new Map<string, CharacterStat>()),
    ]).then(([list, s]) => {
      if (cancelled) return;
      setCharacters(list.slice(0, RECENT_LIMIT));
      setStats(s);
    });
    // Load grammar snapshot for the Home widget.
    (async () => {
      const userRow = await supabase.from("users").select("preferences").eq("id", userId).single();
      const prefs = readGrammarPrefs(userRow.data?.preferences as Record<string, unknown> | null);
      if (cancelled) return;
      setGrammarMasterOn(prefs.master);
      if (prefs.master) {
        const agg = await loadAggregate();
        if (!cancelled) setGrammarSnapshot(agg);
        triggerInsightsIfDirty().catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (sess.status !== "ready" || characters === null) {
    return (
      <main
        data-testid="loading"
        className="sp-page-content"
        style={{ padding: "2rem 1.5rem", maxWidth: 1280, margin: "0 auto", boxSizing: "border-box" }}
      >
        <SkeletonGrid count={recentLimit} withAddCard withSectionHeader withGrammarCard />
      </main>
    );
  }

  return (
    <>
      <HomeNudge />
      <main data-testid="home" className="sp-page-content" style={{ padding: "2rem 1.5rem", maxWidth: 1280, margin: "0 auto", boxSizing: "border-box" }}>
        {characters && characters.length > 0 ? (
          <>
            <div style={{ marginBottom: "1.75rem" }}>
              <Link to="/character/new" data-testid="home-add-character" style={addCharacterCardStyle}>
                <span aria-hidden style={addCharacterIconStyle}>＋</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <strong style={{ color: "var(--sp-fg)", fontWeight: 600 }}>Add Character</strong>
                  <span style={{ color: "var(--sp-fg-3)", fontSize: "0.85em" }}>Create from scratch or import a card</span>
                </span>
              </Link>
            </div>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.25rem" }}>
              <h1 className="sp-h2 sp-wordmark sp-page-h1" style={{ margin: 0 }}>Recent Characters</h1>
              <Link to="/characters" data-testid="see-all" style={mutedLinkStyle}>See all</Link>
            </header>
            <CharacterGrid characters={characters.slice(0, recentLimit)} stats={stats} testId="home-recent-grid" hideTags />
            {grammarMasterOn && grammarSnapshot?.detected_level && (
              <Link
                to="/grammar"
                data-testid="grammar-snapshot"
                style={grammarCardStyle}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.55rem" }}>
                  <strong style={{ color: "var(--sp-fg)" }}>Grammar</strong>
                  <span style={{ color: "var(--sp-fg-3)", fontSize: "0.85em" }}>See full details →</span>
                </div>
                <div style={kpiGridStyle}>
                  <Kpi label="Level" value={grammarSnapshot.detected_level ?? "—"} />
                  <Kpi
                    label="Reinforcement"
                    value={grammarSnapshot.reinforcement_performance_pct != null
                      ? `${grammarSnapshot.reinforcement_performance_pct}%`
                      : "—"}
                    hint={grammarSnapshot.reinforcement_performance_pct != null ? "failure rate" : undefined}
                  />
                  <Kpi
                    label="Errors"
                    value={String((grammarSnapshot.top_errors ?? []).reduce((s, e) => s + e.count, 0))}
                    hint={(grammarSnapshot.top_errors?.length ?? 0) > 0 ? `${grammarSnapshot.top_errors?.length} categories` : undefined}
                  />
                  <Kpi
                    label="Fillers"
                    value={String((grammarSnapshot.filler_words ?? []).reduce((s, f) => s + f.count, 0))}
                    hint={(grammarSnapshot.filler_words?.length ?? 0) > 0 ? `${grammarSnapshot.filler_words?.length} words` : undefined}
                  />
                </div>
                {grammarSnapshot.top_errors?.length ? (
                  <div style={{ marginTop: "0.7rem", paddingTop: "0.6rem", borderTop: "1px solid var(--sp-border-soft)" }}>
                    <div style={{ fontSize: "var(--sp-text-xs)", letterSpacing: "var(--sp-tracking-caps)", textTransform: "uppercase", color: "var(--sp-fg-3)", marginBottom: "0.4rem" }}>
                      Top patterns
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {grammarSnapshot.top_errors.slice(0, 6).map((e) => (
                        <span key={e.category} style={patternChipStyle}>
                          {e.category.replace(/_/g, " ")}
                          <span style={{ color: "var(--sp-fg-3)", marginLeft: "0.4rem", fontWeight: 600 }}>{e.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Link>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center" }}>
            <h1 className="sp-h2 sp-wordmark sp-page-h1" style={{ margin: 0 }}>No Companions Yet</h1>
            <p style={{ color: "var(--sp-fg-2)" }}>Create your first AI persona or import an existing character.</p>
            <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
              <Link to="/character/new" data-testid="home-add-character" style={addCharacterCardStyle}>
                <span aria-hidden style={addCharacterIconStyle}>＋</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
                  <strong style={{ color: "var(--sp-fg)", fontWeight: 600 }}>Add Character</strong>
                  <span style={{ color: "var(--sp-fg-3)", fontSize: "0.85em" }}>Create from scratch or import a card</span>
                </span>
              </Link>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

const mutedLinkStyle: React.CSSProperties = {
  color: "var(--sp-fg-2)",
  textDecoration: "none",
  fontSize: "0.9em",
};

const addCharacterCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.9rem",
  padding: "1rem 1.25rem",
  background: "var(--sp-bg-2)",
  border: "1.5px dashed var(--sp-border-strong)",
  borderRadius: "var(--sp-radius)",
  textDecoration: "none",
  color: "var(--sp-fg)",
  transition: "border-color 160ms var(--sp-ease), background 160ms var(--sp-ease)",
};

const addCharacterIconStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--sp-bg-3)",
  color: "var(--sp-fg-2)",
  fontSize: "1.4rem",
  fontWeight: 400,
  flexShrink: 0,
};

// Compact treatment (cycle 0125 follow-up): the Home Grammar card is a
// glanceable preview, not the full dashboard — tightened paddings, gaps
// and KPI value size to shave vertical space.
const grammarCardStyle: React.CSSProperties = {
  display: "block",
  marginTop: "1.25rem",
  padding: "1rem",
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  textDecoration: "none",
  color: "inherit",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "0.5rem",
};

const kpiCardStyle: React.CSSProperties = {
  padding: "0.55rem 0.7rem",
  background: "var(--sp-bg-3)",
  border: "1px solid var(--sp-border-soft)",
  borderRadius: "var(--sp-radius)",
};

const patternChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.3rem 0.8rem",
  background: "var(--sp-bg-3)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  fontSize: "0.85em",
  color: "var(--sp-fg-2)",
};

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={kpiCardStyle}>
      <div style={{ fontSize: "var(--sp-text-xs)", letterSpacing: "var(--sp-tracking-caps)", textTransform: "uppercase", color: "var(--sp-fg-3)" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.2em", fontWeight: 600, marginTop: "0.1rem", color: "var(--sp-fg)" }}>{value}</div>
      {hint && <div style={{ fontSize: "0.75em", color: "var(--sp-fg-3)", marginTop: "0.1rem" }}>{hint}</div>}
    </div>
  );
}
