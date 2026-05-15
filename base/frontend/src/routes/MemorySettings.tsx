import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import {
  MEMORY_PREFS_DEFAULTS,
  loadMemoryPrefs,
  saveMemoryPrefs,
  type MemoryPrefs,
} from "../lib/memoryPrefs";
import { listActiveEmbeddingProvider } from "../lib/providers";
import { Spinner } from "../lib/Spinner";
import { StatusBanner } from "../lib/StatusBanner";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Status = "loading" | "ready" | "saving" | "error";

export function MemorySettings() {
  useDocumentTitle("Memory · Settings");
  const nav = useNavigate();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;

  const [status, setStatus] = useState<Status>("loading");
  const [prefs, setPrefs] = useState<MemoryPrefs>(MEMORY_PREFS_DEFAULTS);
  const [hasEngine, setHasEngine] = useState(false);
  const [factCount, setFactCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sess.status !== "ready") return;
    if (!userId) { nav("/sign-in"); return; }
    let cancelled = false;
    (async () => {
      try {
        const [loaded, engine, countRes] = await Promise.all([
          loadMemoryPrefs(userId),
          listActiveEmbeddingProvider(),
          supabase
            .from("memory_document_chunks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId),
        ]);
        if (cancelled) return;
        setPrefs(loaded);
        setHasEngine(!!engine);
        setFactCount(countRes.count ?? 0);
        setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setError(String(e));
          setStatus("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [sess.status, userId, nav]);

  async function onSave() {
    if (!userId) return;
    setStatus("saving");
    setError(null);
    try {
      await saveMemoryPrefs(userId, prefs);
      setStatus("ready");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }

  function patch<K extends keyof MemoryPrefs>(key: K, value: MemoryPrefs[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  const saving = status === "saving";

  if (status === "loading") return <main style={mainStyle}><Spinner testId="memory-settings-loading" /></main>;

  return (
    <main data-testid="memory-settings" style={mainStyle}>
      <header className="sp-settings-header" style={headerStyle}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1">Memory</h1>
        <Link to="/settings" className="sp-back-btn">← Back</Link>
      </header>

      <p style={{ color: "var(--sp-fg-3)", marginBottom: "1.25rem" }}>
        The system can remember concrete facts from your recent dialogue ("Aria fears storms",
        "The user's sister is Mia") and surface them in later turns via vector retrieval.
        Memory is <strong>off by default</strong> — toggle it on and configure a Memory Engine to start.
      </p>

      {prefs.enabled && !hasEngine && (
        <StatusBanner tone="warning" testid="memory-no-engine" role="status">
          Memory is enabled but no Memory Engine is configured.{" "}
          <Link to="/settings/memory-engine">Configure a Memory Engine</Link> to start saving facts.
        </StatusBanner>
      )}

      <div style={{ display: "grid", gap: "1.25rem", marginTop: prefs.enabled && !hasEngine ? "1rem" : 0 }}>

        {/* Toggle group */}
        <div>
          <p style={sectionLabel}>Behavior</p>
          <div style={groupCard}>
            <label className="sp-row-interactive" style={toggleRowStyle(false)}>
              <span style={{ flex: 1 }}>
                <strong>Memory enabled</strong>
                <span style={{ ...subStyle, display: "block" }}>Turn the whole system on/off for all characters. Per-character toggles still apply.</span>
              </span>
              <input
                type="checkbox"
                className="sp-toggle"
                data-testid="mem-prefs-enabled"
                checked={prefs.enabled}
                onChange={(e) => patch("enabled", e.target.checked)}
              />
            </label>
            <label className="sp-row-interactive" style={toggleRowStyle(true)}>
              <span style={{ flex: 1 }}>
                <strong>Show memory notifications</strong>
                <span style={{ ...subStyle, display: "block" }}>A small "Memory saved" popup appears in chat when the system remembers something.</span>
              </span>
              <input
                type="checkbox"
                className="sp-toggle"
                data-testid="mem-prefs-notifications"
                checked={prefs.notifications_enabled}
                onChange={(e) => patch("notifications_enabled", e.target.checked)}
                disabled={!prefs.enabled}
              />
            </label>
          </div>
        </div>

        {/* Retrieval group */}
        <div>
          <p style={sectionLabel}>Retrieval</p>
          <div style={groupCard}>
            <label style={sliderRowStyle(false)}>
              <span>
                <strong>Auto-extract facts every N turns</strong>
                <span style={{ ...subStyle, display: "block" }}>Current: {prefs.auto_extract_cadence_turns} · range 1–10</span>
              </span>
              <input
                type="range"
                className="sp-range"
                min={1}
                max={10}
                step={1}
                data-testid="mem-prefs-cadence"
                value={prefs.auto_extract_cadence_turns}
                onChange={(e) => patch("auto_extract_cadence_turns", Number(e.target.value))}
                disabled={!prefs.enabled}
              />
            </label>
            <label style={sliderRowStyle(false)}>
              <span>
                <strong>Retrieval top-K</strong>
                <span style={{ ...subStyle, display: "block" }}>Max facts injected per turn. Current: {prefs.retrieval_top_k}</span>
              </span>
              <input
                type="range"
                className="sp-range"
                min={1}
                max={10}
                step={1}
                data-testid="mem-prefs-top-k"
                value={prefs.retrieval_top_k}
                onChange={(e) => patch("retrieval_top_k", Number(e.target.value))}
                disabled={!prefs.enabled}
              />
            </label>
            <label style={sliderRowStyle(false)}>
              <span>
                <strong>Similarity threshold</strong>
                <span style={{ ...subStyle, display: "block" }}>
                  Current: {prefs.retrieval_similarity_threshold.toFixed(2)}. Higher = stricter matching.
                </span>
              </span>
              <input
                type="range"
                className="sp-range"
                min={0}
                max={1}
                step={0.05}
                data-testid="mem-prefs-threshold"
                value={prefs.retrieval_similarity_threshold}
                onChange={(e) => patch("retrieval_similarity_threshold", Number(e.target.value))}
                disabled={!prefs.enabled}
              />
            </label>
            <label style={sliderRowStyle(true)}>
              <span>
                <strong>Recency weight</strong>
                <span style={{ ...subStyle, display: "block" }}>
                  Current: {prefs.recency_weight.toFixed(2)}. 0 = pure similarity · 1 = pure recency · 0.3 is a reasonable blend.
                </span>
              </span>
              <input
                type="range"
                className="sp-range"
                min={0}
                max={1}
                step={0.05}
                data-testid="mem-prefs-recency"
                value={prefs.recency_weight}
                onChange={(e) => patch("recency_weight", Number(e.target.value))}
                disabled={!prefs.enabled}
              />
            </label>
          </div>
        </div>

        {/* Advanced: extraction prompt */}
        {prefs.enabled && (
          <div>
            <p style={sectionLabel}>Advanced</p>
            <div style={promptSection}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
                <strong>Memory extraction prompt</strong>
                <button
                  type="button"
                  data-testid="mem-prefs-reset-prompt"
                  onClick={() => patch("extraction_prompt", null)}
                  disabled={prefs.extraction_prompt === null}
                  style={resetBtnStyle}
                >
                  ↻ Reset to default
                </button>
              </div>
              <div style={subStyle}>
                Advanced: override the extraction system prompt. Placeholders{" "}
                <code>{"{name}"}</code> and <code>{"{description}"}</code> are substituted
                at call time. Leave blank (Reset) to use the packaged default.
              </div>
              <textarea
                data-testid="mem-prefs-extraction-prompt"
                rows={10}
                value={prefs.extraction_prompt ?? ""}
                placeholder={EXTRACTION_PROMPT_PLACEHOLDER}
                onChange={(e) => {
                  const v = e.target.value;
                  patch("extraction_prompt", v.trim() ? v : null);
                }}
                style={promptTextareaStyle}
              />
            </div>
          </div>
        )}

        {/* Save row */}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" data-testid="mem-prefs-save" onClick={onSave} disabled={saving} style={saveBtnStyle(saving)}>
            {saving ? "Saving…" : "Save"}
          </button>
          <span style={{ color: "var(--sp-fg-3)", fontSize: "0.85rem" }}>
            {factCount === null ? "" : `${factCount} fact${factCount === 1 ? "" : "s"} remembered across your conversations.`}
          </span>
        </div>

        {error && (
          <StatusBanner tone="error" testid="mem-prefs-error" role="alert">{error}</StatusBanner>
        )}

        <p style={{ fontSize: "0.85rem", color: "var(--sp-fg-3)", marginTop: "0.25rem" }}>
          Auto Lore Extraction (per-conversation Lorebook entries) lives on the chat controls panel —
          this page is just the RAG retrieval + fact-memory side.
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

function sliderRowStyle(isLast: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 160px",
    gap: "0.75rem",
    alignItems: "center",
    padding: "0.85rem 1rem",
    borderBottom: isLast ? "none" : "1px solid var(--sp-border-soft)",
  };
}

const subStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--sp-fg-3)", marginTop: "0.2rem" };

const promptSection: React.CSSProperties = {
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  padding: "1rem",
  display: "grid",
  gap: "0.65rem",
};

const promptTextareaStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0.55rem 0.75rem",
  background: "var(--sp-bg-inset)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  color: "var(--sp-fg)",
  fontFamily: "ui-monospace, monospace",
  fontSize: "0.8rem",
  resize: "vertical",
};

const resetBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sp-border)",
  color: "var(--sp-fg-2)",
  borderRadius: "var(--sp-radius)",
  padding: "0.25rem 0.7rem",
  fontSize: "0.8em",
  fontFamily: "inherit",
  cursor: "pointer",
};

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

const EXTRACTION_PROMPT_PLACEHOLDER = `You extract 1-3 concise standalone facts from recent dialogue between a user and a character named {name}.

Character: {name}
Description: {description}

Return JSON: {"facts": [{"topic": "...", "fact": "..."}]}

(This placeholder shows the shape. The packaged default is richer. Leave the textarea empty to use the packaged default.)`;
