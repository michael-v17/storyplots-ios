import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session";
import { Spinner } from "../lib/Spinner";
import { StatusBanner } from "../lib/StatusBanner";
import {
  ROLEPLAY_PREFS_DEFAULTS,
  loadRoleplayPrefs,
  saveRoleplayPrefs,
  AUTHOR_FRAMING_TEXT,
  PACING_SLOW_BURN_TEXT,
  PACING_WARM_TEXT,
  STYLE_ANCHOR_TEXT,
  type RoleplayPrefs,
  type Pacing,
} from "../lib/rpPrefs";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Status = "loading" | "ready" | "saving" | "error";

export function RoleplaySettings() {
  useDocumentTitle("Roleplay · Settings");
  const nav = useNavigate();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;

  const [status, setStatus] = useState<Status>("loading");
  const [prefs, setPrefs] = useState<RoleplayPrefs>(ROLEPLAY_PREFS_DEFAULTS);
  const [error, setError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    if (sess.status !== "ready") return;
    if (!userId) { nav("/sign-in"); return; }
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadRoleplayPrefs(userId);
        if (cancelled) return;
        setPrefs(loaded);
        setStatus("ready");
      } catch (e) {
        if (!cancelled) { setError(String(e)); setStatus("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [sess.status, userId, nav]);

  function patch<K extends keyof RoleplayPrefs>(key: K, value: RoleplayPrefs[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
    setSaveOk(false);
  }

  async function onSave() {
    if (!userId) return;
    setStatus("saving");
    setError(null);
    setSaveOk(false);
    try {
      await saveRoleplayPrefs(userId, prefs);
      setStatus("ready");
      setSaveOk(true);
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }

  const saving = status === "saving";

  if (status === "loading") {
    return <main style={mainStyle}><Spinner testId="roleplay-settings-loading" /></main>;
  }

  const pacingPreview =
    prefs.pacing === "off" ? null
    : prefs.pacing === "warm" ? PACING_WARM_TEXT
    : PACING_SLOW_BURN_TEXT;

  return (
    <main data-testid="roleplay-settings" style={mainStyle}>
      <header className="sp-settings-header" style={headerStyle}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1">Roleplay</h1>
        <Link to="/settings" className="sp-back-btn">← Back</Link>
      </header>

      <p style={{ color: "var(--sp-fg-3)", marginBottom: "1.25rem" }}>
        These three switches shape how the model approaches <em>every</em> character you chat with.
        They live at the system level — every character carries them without per-character editing.
        Turn them off if you want a character's raw <code>system_prompt</code> to be the only instruction
        the model sees. The defaults below are based on community-validated patterns for character-driven roleplay
        (less assistant-feeling, more in-voice, slower intimacy gates).
      </p>

      <div style={{ display: "grid", gap: "1.25rem" }}>

        {/* Author framing */}
        <div>
          <p style={sectionLabel}>Author framing</p>
          <div style={groupCard}>
            <label className="sp-row-interactive" style={toggleRowStyle(true)}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>Frame the model as an author giving voice to the character</strong>
                <span style={{ ...subStyle, display: "block" }}>
                  Instead of telling the model "you are X" (which is brittle and breaks on edge cases), tell it
                  "you are a skilled author giving voice to X." Survives ambiguous user input and unusual scenes
                  more gracefully, less likely to slip into assistant tone. The most leverage of any single change.
                </span>
              </span>
              <input
                type="checkbox"
                className="sp-toggle"
                data-testid="rp-prefs-author-framing"
                checked={prefs.author_framing}
                onChange={(e) => patch("author_framing", e.target.checked)}
              />
            </label>
            <details style={previewDetailsStyle}>
              <summary style={previewSummaryStyle}>Preview the text that gets injected</summary>
              <pre data-testid="rp-prefs-author-framing-preview" style={previewPreStyle}>{AUTHOR_FRAMING_TEXT}</pre>
            </details>
          </div>
        </div>

        {/* Pacing */}
        <div>
          <p style={sectionLabel}>Pacing</p>
          <div style={groupCard}>
            <div style={pacingRowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>Relationship pacing</strong>
                <span style={{ ...subStyle, display: "block" }}>
                  How a character defaults to attraction and intimacy.
                  <br/><strong>Slow-burn</strong>: neutral or reserved by default, warms up only after trust + shared experience + vulnerability.
                  <br/><strong>Warm</strong>: friendly but bounded — same gates, softer opening posture.
                  <br/><strong>Off</strong>: no system-level pacing block injected (useful for short scenes or assistant-mode characters).
                </span>
              </div>
            </div>
            <div style={segmentedWrapStyle}>
              <div role="radiogroup" aria-label="Pacing mode" style={segmentedTrackStyle}>
                {(["off","slow_burn","warm"] as Pacing[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={prefs.pacing === value}
                    data-testid={`rp-prefs-pacing-${value}`}
                    onClick={() => patch("pacing", value)}
                    style={segmentedBtnStyle(prefs.pacing === value)}
                  >
                    {value === "off" ? "Off" : value === "slow_burn" ? "Slow-burn" : "Warm"}
                  </button>
                ))}
              </div>
            </div>
            {pacingPreview && (
              <details style={previewDetailsStyle}>
                <summary style={previewSummaryStyle}>Preview the text that gets injected</summary>
                <pre data-testid="rp-prefs-pacing-preview" style={previewPreStyle}>{pacingPreview}</pre>
              </details>
            )}
            {!pacingPreview && (
              <div style={{ ...previewDetailsStyle, color: "var(--sp-fg-3)", fontSize: "0.85em" }}>
                Pacing off — no block injected. Character behavior is governed only by their own <code>system_prompt</code>.
              </div>
            )}
          </div>
        </div>

        {/* Style anchor */}
        <div>
          <p style={sectionLabel}>Style anchor</p>
          <div style={groupCard}>
            <label className="sp-row-interactive" style={toggleRowStyle(true)}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>Inject a turn-level style anchor</strong>
                <span style={{ ...subStyle, display: "block" }}>
                  A short reminder added at the end of every turn: "write one reply, don't speak for the user,
                  stay in the character's voice and pace." Designed to counter the drift that creeps in around
                  the 20-turn mark when novelty wears off and the model relaxes back into helpful-AI cadence.
                </span>
              </span>
              <input
                type="checkbox"
                className="sp-toggle"
                data-testid="rp-prefs-style-anchor"
                checked={prefs.style_anchor}
                onChange={(e) => patch("style_anchor", e.target.checked)}
              />
            </label>
            <details style={previewDetailsStyle}>
              <summary style={previewSummaryStyle}>Preview the text that gets injected</summary>
              <pre data-testid="rp-prefs-style-anchor-preview" style={previewPreStyle}>{STYLE_ANCHOR_TEXT}</pre>
            </details>
          </div>
        </div>

        {/* Save row */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            data-testid="rp-prefs-save"
            disabled={saving}
            onClick={onSave}
            style={saveBtnStyle(saving)}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {saveOk && (
          <StatusBanner tone="success" testid="rp-prefs-save-result" role="status">
            Roleplay defaults updated. New conversations and the next turn of existing ones will use the new scaffolding.
          </StatusBanner>
        )}

        {error && (
          <StatusBanner tone="error" testid="rp-prefs-error" role="alert">{error}</StatusBanner>
        )}

        <p style={{ fontSize: "0.85rem", color: "var(--sp-fg-3)" }}>
          <strong>Note:</strong> these settings apply to <em>every</em> conversation regardless of character.
          Per-character overrides are not exposed in this release — if a character needs the global default
          relaxed (e.g. an assistant-mode character that should be warm right away), edit its <code>system_prompt</code>
          to override the pacing in-character, or toggle the global setting for the duration of that session.
        </p>
      </div>
    </main>
  );
}

const mainStyle: React.CSSProperties = { maxWidth: 640, margin: "2rem auto", padding: "0 1rem" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.75rem" };

const sectionLabel: React.CSSProperties = {
  fontSize: "var(--sp-text-xs)",
  fontWeight: 600,
  letterSpacing: "var(--sp-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--sp-fg-3)",
  paddingLeft: 4,
  margin: "0 0 0.5rem",
};

const groupCard: React.CSSProperties = {
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  overflow: "hidden",
};

function toggleRowStyle(isLast: boolean): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.85rem 1rem",
    borderBottom: isLast ? "none" : "1px solid var(--sp-border-soft)",
    gap: "1rem",
    cursor: "pointer",
  };
}

const pacingRowStyle: React.CSSProperties = {
  display: "flex",
  padding: "0.85rem 1rem 0.5rem",
  gap: "1rem",
};

const segmentedWrapStyle: React.CSSProperties = {
  padding: "0 1rem 0.85rem",
};

const segmentedTrackStyle: React.CSSProperties = {
  display: "inline-flex",
  background: "var(--sp-bg-3)",
  border: "1px solid var(--sp-border)",
  borderRadius: 999,
  padding: 4,
  gap: 2,
};

function segmentedBtnStyle(active: boolean): React.CSSProperties {
  return {
    appearance: "none",
    border: "none",
    background: active ? "var(--sp-brand-1)" : "transparent",
    color: active ? "var(--sp-fg-on-brand)" : "var(--sp-fg-2)",
    fontWeight: active ? 600 : 500,
    fontFamily: "inherit",
    fontSize: "0.9rem",
    padding: "0.35rem 0.95rem",
    borderRadius: 999,
    cursor: "pointer",
    transition: "background 160ms var(--sp-ease), color 160ms var(--sp-ease)",
  };
}

const previewDetailsStyle: React.CSSProperties = {
  borderTop: "1px solid var(--sp-border-soft)",
  padding: "0.75rem 1rem",
};

const previewSummaryStyle: React.CSSProperties = {
  color: "var(--sp-fg-2)",
  fontSize: "0.85em",
  cursor: "pointer",
  listStyle: "revert",
};

const previewPreStyle: React.CSSProperties = {
  marginTop: "0.5rem",
  padding: "0.75rem 0.9rem",
  background: "var(--sp-bg-inset)",
  border: "1px solid var(--sp-border-soft)",
  borderRadius: "var(--sp-radius-sm)",
  color: "var(--sp-fg-2)",
  fontFamily: "ui-monospace, monospace",
  fontSize: "0.78em",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  maxHeight: 360,
  overflowY: "auto",
};

const subStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--sp-fg-3)", marginTop: "0.2rem" };

function saveBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "var(--sp-bg-3)" : "var(--sp-brand-1)",
    color: disabled ? "var(--sp-fg-4)" : "var(--sp-fg-on-brand)",
    border: "none",
    borderRadius: "var(--sp-radius)",
    padding: "0.5rem 1.25rem",
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
