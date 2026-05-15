import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listCharacters, type Character } from "../lib/characters";
import { loadCharacterStats, type CharacterStat } from "../lib/characterStats";
import { loadHomePrefs, saveHomeLayout, type HomeLayout } from "../lib/homePrefs";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import { SkeletonGrid } from "../lib/SkeletonGrid";
import { CharacterGrid } from "../features/characters/CharacterGrid";
import { CharacterCirclesList } from "../features/characters/CharacterCirclesList";
import { CharacterListRows } from "../features/characters/CharacterListRows";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function Characters() {
  useDocumentTitle("Characters");
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;
  const [state, setState] = useState<{
    status: "loading" | "ready";
    list: Character[];
    stats: Map<string, CharacterStat>;
  }>({ status: "loading", list: [], stats: new Map() });
  const [layout, setLayout] = useState<HomeLayout>("grid");
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Session still resolving — keep the loading skeleton up. `userId` is
    // null both while the session restores and when there's genuinely no
    // user; only the latter should resolve to the empty state. Without
    // this guard the screen flashed `characters-empty` over the skeleton.
    if (sess.status !== "ready") return;
    if (!userId) {
      setState({ status: "ready", list: [], stats: new Map() });
      return;
    }
    let cancelled = false;
    Promise.all([
      listCharacters(userId),
      loadHomePrefs(userId).catch(() => ({ layout: "grid" as HomeLayout })),
      loadCharacterStats(userId).catch(() => new Map<string, CharacterStat>()),
    ]).then(([list, prefs, stats]) => {
      if (cancelled) return;
      setLayout(prefs.layout);
      setState({ status: "ready", list, stats });
    });

    const channel = supabase
      .channel(`characters-list-${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "characters",
        filter: `user_id=eq.${userId}`,
      }, () => {
        Promise.all([listCharacters(userId), loadCharacterStats(userId)])
          .then(([list, stats]) => setState((s) => ({ ...s, list, stats })));
      })
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId, sess.status]);

  function changeLayout(next: HomeLayout) {
    setLayout(next);
    if (userId) saveHomeLayout(userId, next).catch(() => {/* best-effort */});
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return state.list;
    return state.list.filter((c) => c.name.toLowerCase().includes(q));
  }, [state.list, search]);

  if (sess.status !== "ready" || state.status === "loading") {
    return (
      <main
        data-testid="characters-loading"
        className="sp-page-content"
        style={{ maxWidth: 1280, margin: "1.5rem auto", padding: "0 1.5rem", boxSizing: "border-box" }}
      >
        <SkeletonGrid count={10} withAddCard withFilterBar />
      </main>
    );
  }

  const empty = state.list.length === 0;
  const noMatch = !empty && filtered.length === 0;

  return (
    <main data-testid="characters" className="sp-page-content" style={{ maxWidth: 1280, margin: "1.5rem auto", padding: "0 1.5rem", boxSizing: "border-box" }}>
      <header className="sp-main-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem", gap: "0.75rem", flexWrap: "wrap" }}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1" style={{ margin: 0 }}>Your Characters</h1>
      </header>

      <div style={{ marginBottom: "1.25rem" }}>
        <Link to="/character/new" data-testid="characters-add" style={addCharacterCardStyle}>
          <span aria-hidden style={addCharacterIconStyle}>＋</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <strong style={{ color: "var(--sp-fg)", fontWeight: 600 }}>Add Character</strong>
            <span style={{ color: "var(--sp-fg-3)", fontSize: "0.85em" }}>Create from scratch or import a card</span>
          </span>
        </Link>
      </div>

      {!empty && (
        <div className="sp-characters-filterbar" data-testid="characters-filterbar">
          <div className="sp-characters-filterbar-top">
            <input
              type="search"
              data-testid="characters-search"
              placeholder="Search your companions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={searchInputStyle}
            />
            <div role="radiogroup" aria-label="Layout" style={{ display: "flex", gap: "0.35rem" }}>
              <LayoutButton active={layout === "grid"} onClick={() => changeLayout("grid")} testId="layout-grid" label="Grid">▦</LayoutButton>
              <LayoutButton active={layout === "circles"} onClick={() => changeLayout("circles")} testId="layout-circles" label="Circles">●●</LayoutButton>
              <LayoutButton active={layout === "list"} onClick={() => changeLayout("list")} testId="layout-list" label="List">≡</LayoutButton>
            </div>
          </div>
        </div>
      )}

      {empty ? (
        <section data-testid="characters-empty" style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <h2 className="sp-h2 sp-wordmark sp-page-h1" style={{ margin: 0 }}>No Companions Yet</h2>
          <p style={{ color: "var(--sp-fg-2)", marginTop: "0.75rem" }}>Create your first AI persona or import an existing character.</p>
        </section>
      ) : noMatch ? (
        <p data-testid="characters-no-match" style={{ color: "var(--sp-fg-3)", textAlign: "center", padding: "2rem" }}>
          No companions match "{search}".
        </p>
      ) : layout === "grid" ? (
        <CharacterGrid characters={filtered} stats={state.stats} />
      ) : layout === "circles" ? (
        <CharacterCirclesList characters={filtered} />
      ) : (
        <CharacterListRows characters={filtered} stats={state.stats} />
      )}
    </main>
  );
}

function LayoutButton({
  active, onClick, testId, label, children,
}: {
  active: boolean;
  onClick: () => void;
  testId: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      data-testid={testId}
      onClick={onClick}
      style={{
        padding: "0.5rem 0.75rem",
        border: `1px solid ${active ? "var(--sp-border-strong)" : "var(--sp-border)"}`,
        borderRadius: "var(--sp-radius)",
        background: active ? "var(--sp-bg-3)" : "transparent",
        color: active ? "var(--sp-fg)" : "var(--sp-fg-2)",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        minWidth: 44,
        transition: "background 120ms var(--sp-ease), border-color 120ms var(--sp-ease), color 120ms var(--sp-ease)",
      }}
    >
      {children}
    </button>
  );
}

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

const searchInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 200,
  padding: "0.6rem 0.85rem",
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  color: "var(--sp-fg)",
  fontSize: 16,
  fontFamily: "inherit",
  outline: "none",
};
