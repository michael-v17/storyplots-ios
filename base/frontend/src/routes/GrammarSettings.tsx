import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import { readGrammarPrefs, saveGrammarPrefs, type GrammarPrefs } from "../lib/grammar";
import { listActiveTextProvider } from "../lib/providers";
import { StatusBanner } from "../lib/StatusBanner";
import { Spinner } from "../lib/Spinner";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Status = "loading" | "ready" | "saving" | "error";

export function GrammarSettings() {
  useDocumentTitle("Grammar · Settings");
  const nav = useNavigate();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;

  const [status, setStatus] = useState<Status>("loading");
  const [prefs, setPrefs] = useState<GrammarPrefs | null>(null);
  const [hasProvider, setHasProvider] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sess.status !== "ready") return;
    if (!userId) { nav("/sign-in"); return; }
    let cancelled = false;
    (async () => {
      try {
        const [userRow, prov] = await Promise.all([
          supabase.from("users").select("preferences").eq("id", userId).single(),
          listActiveTextProvider(),
        ]);
        if (cancelled) return;
        setPrefs(readGrammarPrefs(userRow.data?.preferences as Record<string, unknown> | null));
        setHasProvider(!!prov?.vault_secret_id);
        setStatus("ready");
      } catch (e) {
        if (!cancelled) { setError(String(e)); setStatus("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [sess.status, userId]);

  async function save() {
    if (!userId || !prefs) return;
    setStatus("saving"); setError(null);
    try {
      await saveGrammarPrefs(userId, prefs);
      setStatus("ready");
    } catch (e) {
      setError(String(e)); setStatus("error");
    }
  }

  function patch(p: Partial<GrammarPrefs>) {
    setPrefs((prev) => prev ? { ...prev, ...p } : prev);
  }

  if (status === "loading" || !prefs) {
    return <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}><Spinner testId="grammar-settings-loading" /></main>;
  }
  const saving = status === "saving";

  return (
    <main data-testid="grammar-settings" style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
      <header className="sp-settings-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.75rem" }}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1">Grammar</h1>
        <Link to="/settings" className="sp-back-btn">← Back</Link>
      </header>

      <p style={{ color: "var(--sp-fg-3)", marginBottom: "1.25rem" }}>
        Master toggle, inline corrections, sidebar panel, and grammar model override.
        Grammar Master must be on for any corrections to run.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); save(); }} data-form="stack" style={{ display: "grid", gap: "1.25rem" }}>
        <div style={sectionCard}>
          <label style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <input
              data-testid="grammar-master"
              type="checkbox"
              className="sp-toggle"
              checked={prefs.master}
              disabled={!hasProvider}
              onChange={(e) => patch({ master: e.target.checked })}
            />
            <strong>Grammar Master</strong>
          </label>
          {!hasProvider && (
            <small style={{ color: "var(--sp-warning)" }}>Configure a <Link to="/settings/text-engine">Text Engine</Link> provider first.</small>
          )}
        </div>

        <div style={{ display: "grid", gap: "1.25rem", opacity: prefs.master ? 1 : 0.45, pointerEvents: prefs.master ? "auto" : "none" }}>
          <div>
            <p style={sectionLabel}>Inline</p>
            <div style={sectionCard}>
              <label style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <input
                  type="checkbox"
                  className="sp-toggle"
                  data-testid="grammar-inline"
                  checked={prefs.inline_enabled}
                  onChange={(e) => patch({ inline_enabled: e.target.checked })}
                />
                Inline corrections on
              </label>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <input type="radio" name="inline_mode" data-testid="grammar-mode-a" checked={prefs.inline_mode === "A"}
                    onChange={() => patch({ inline_mode: "A" })} />
                  Correction only (A)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <input type="radio" name="inline_mode" data-testid="grammar-mode-b" checked={prefs.inline_mode === "B"}
                    onChange={() => patch({ inline_mode: "B" })} />
                  Correction + explanation (B)
                </label>
              </div>

              {/* Cycle 0128 — correction style. Lives in the Inline card
                  because that is the primary surface, but it shapes every
                  correction the agent produces (inline row, sidebar, dashboard
                  and the Reinforcement rewrite gate). */}
              <div style={{ display: "grid", gap: "0.4rem" }}>
                <span style={{ fontWeight: 600 }}>Correction style</span>
                <label style={styleRadioRow}>
                  <input type="radio" name="correction_style" data-testid="grammar-style-literal"
                    checked={prefs.correction_style === "literal"}
                    onChange={() => patch({ correction_style: "literal" })} />
                  <span>
                    Literal
                    <span style={styleRadioHint}>
                      fixes clear errors only — keeps your phrasing
                    </span>
                  </span>
                </label>
                <label style={styleRadioRow}>
                  <input type="radio" name="correction_style" data-testid="grammar-style-natural"
                    checked={prefs.correction_style === "natural"}
                    onChange={() => patch({ correction_style: "natural" })} />
                  <span>
                    Natural
                    <span style={styleRadioHint}>
                      rewrites it like a native speaker — same meaning, natural words
                    </span>
                  </span>
                </label>
                <small style={{ color: "var(--sp-fg-3)" }}>
                  Shapes every correction — inline, sidebar, and the rewrite gate.
                </small>
              </div>

              <div style={{ opacity: prefs.inline_enabled ? 1 : 0.45, pointerEvents: prefs.inline_enabled ? "auto" : "none" }}>
                <label style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    className="sp-toggle"
                    data-testid="grammar-reinforcement"
                    checked={prefs.reinforcement_enabled}
                    onChange={(e) => patch({ reinforcement_enabled: e.target.checked })}
                  />
                  <span>
                    <strong>Reinforcement Mode</strong>
                    <span style={{ display: "block", fontSize: "0.8rem", color: "var(--sp-fg-3)" }}>rewrite gate</span>
                  </span>
                </label>
                {!prefs.inline_enabled && <small style={{ color: "var(--sp-fg-3)", display: "block", marginTop: "0.25rem" }}>Enable inline corrections first.</small>}
              </div>
            </div>
          </div>

          <div>
            <p style={sectionLabel}>Sidebar</p>
            <div style={sectionCard}>
              <label style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <input
                  type="checkbox"
                  className="sp-toggle"
                  data-testid="grammar-sidebar"
                  checked={prefs.sidebar_enabled}
                  onChange={(e) => patch({ sidebar_enabled: e.target.checked })}
                />
                Sidebar panel on
              </label>
              <label>
                Frequency
                <select data-testid="grammar-frequency" value={prefs.sidebar_frequency}
                  onChange={(e) => patch({ sidebar_frequency: e.target.value as GrammarPrefs["sidebar_frequency"] })}>
                  <option value="every">Every correction</option>
                  <option value="every_3">Every 3rd</option>
                  <option value="every_5">Every 5th</option>
                  <option value="major_errors_only">Major errors only</option>
                </select>
              </label>
            </div>
          </div>

          <div>
            <p style={sectionLabel}>Grammar model</p>
            <div style={sectionCard}>
              <small style={{ color: "var(--sp-fg-3)" }}>
                Uses the same API key as Text Engine. Only the model changes.
              </small>
              <label>
                <span style={srOnlyStyle}>Custom grammar model</span>
                <input data-testid="grammar-model" value={prefs.custom_model_id ?? ""}
                  onChange={(e) => patch({ custom_model_id: e.target.value || null })}
                  placeholder="Leave blank to use the Text Engine model" />
              </label>
              {!prefs.custom_model_id && (
                <small style={{ color: "var(--sp-fg-3)" }}>
                  Currently using: Text Engine model
                </small>
              )}
              {prefs.custom_model_id && (
                <small style={{ color: "var(--sp-fg-3)" }}>
                  Grammar will use: <strong style={{ color: "var(--sp-fg)" }}>{prefs.custom_model_id}</strong>
                </small>
              )}
            </div>
          </div>
        </div>

        {error && <StatusBanner tone="error" testid="grammar-settings-error" role="alert">{error}</StatusBanner>}
        <button type="submit" data-testid="grammar-save" disabled={saving} style={primaryPillStyle(saving)}>
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </main>
  );
}

const sectionCard: React.CSSProperties = { background: "var(--sp-bg-2)", border: "1px solid var(--sp-border)", borderRadius: "var(--sp-radius)", padding: "1rem", display: "grid", gap: "0.85rem" };

// Cycle 0128 — correction-style radio rows share these recipes.
const styleRadioRow: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: "0.4rem" };
const styleRadioHint: React.CSSProperties = { display: "block", fontSize: "0.8rem", color: "var(--sp-fg-3)" };

const sectionLabel: React.CSSProperties = {
  fontSize: "var(--sp-text-xs)",
  fontWeight: 600,
  letterSpacing: "var(--sp-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--sp-fg-3)",
  paddingLeft: 4,
  margin: "0 0 0.5rem",
};

// Canonical visually-hidden recipe (2024) — paired clip + clip-path covers
// modern + legacy browsers; white-space: nowrap prevents focus-ring drift.
const srOnlyStyle: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

// Solid pill matching the destructive shape from DataSecurity (cycle 0077) —
// same fontWeight/border/color treatment, just `--sp-brand-1` violet instead
// of `--sp-destructive` red. Reserved for committal CTAs in settings sub-routes
// where the brand-grad gradient feels too loud (per creator polish 2026-04-21).
function primaryPillStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "0.6rem 1.25rem",
    border: "none",
    borderRadius: "var(--sp-radius)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600,
    fontSize: 14,
    fontFamily: "inherit",
    background: disabled ? "var(--sp-bg-3)" : "var(--sp-brand-1)",
    color: disabled ? "var(--sp-fg-4)" : "var(--sp-fg-on-brand)",
    transition: "background 160ms var(--sp-ease), color 160ms var(--sp-ease)",
    justifySelf: "start",
  };
}
