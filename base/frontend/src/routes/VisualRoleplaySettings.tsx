import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import {
  loadVisualRoleplayPrefs,
  saveVisualRoleplayPrefs,
  type VisualRoleplayMode,
} from "../lib/visualRoleplay";
import { Spinner } from "../lib/Spinner";
import { StatusBanner } from "../lib/StatusBanner";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Status = "loading" | "ready" | "saving";

export function VisualRoleplaySettings() {
  useDocumentTitle("Visual Roleplay · Settings");
  const nav = useNavigate();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;

  const [status, setStatus] = useState<Status>("loading");
  const [imageEnabled, setImageEnabled] = useState(false);
  const [mode, setMode] = useState<VisualRoleplayMode>("manual");
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    if (sess.status !== "ready") return;
    if (!userId) { nav("/sign-in"); return; }
    let cancelled = false;
    (async () => {
      const [prefs, userRow] = await Promise.all([
        loadVisualRoleplayPrefs(userId),
        supabase.from("users").select("preferences").eq("id", userId).single(),
      ]);
      if (cancelled) return;
      setMode(prefs.mode);
      setAutoGenerate(prefs.auto_generate_images);
      const imgPrefs = (userRow.data?.preferences as Record<string, unknown> | null)?.image;
      setImageEnabled(typeof imgPrefs === "object" && imgPrefs !== null && (imgPrefs as Record<string, unknown>).enabled === true);
      setStatus("ready");
    })();
    return () => { cancelled = true; };
  }, [sess.status, userId, nav]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving"); setError(null); setSavedBanner(false);
    try {
      await saveVisualRoleplayPrefs({ mode, auto_generate_images: autoGenerate });
      const { data: row } = await supabase.from("users").select("preferences").eq("id", userId!).single();
      const prefs = { ...((row?.preferences ?? {}) as Record<string, unknown>) };
      const img = { ...((prefs.image ?? {}) as Record<string, unknown>), enabled: imageEnabled };
      prefs.image = img;
      await supabase.from("users").update({ preferences: prefs }).eq("id", userId!);
      setSavedBanner(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setStatus("ready");
    }
  }

  if (status === "loading") return <main style={mainStyle}><Spinner testId="vr-loading" /></main>;

  const autoDisabled = mode === "manual";

  return (
    <main data-testid="visual-roleplay-settings" style={mainStyle}>
      <header className="sp-settings-header" style={headerStyle}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1">Visual Roleplay</h1>
        <Link to="/settings" className="sp-back-btn">← Back</Link>
      </header>

      <p style={{ color: "var(--sp-fg-3)", marginBottom: "1.25rem" }}>
        Steer the assistant to end every reply with a bracketed image
        prompt, and optionally auto-generate the image for every reply.
      </p>

      <form onSubmit={onSave} style={{ display: "grid", gap: "1.25rem" }}>

        {/* Image generation */}
        <div>
          <p style={sectionLabel}>Image generation</p>
          <div style={groupCard}>
            <label className="sp-row-interactive" style={toggleRowStyle}>
              <span style={{ flex: 1 }}>
                <strong>Enable image generation</strong>
                <span style={{ ...subStyle, display: "block" }}>
                  When off, the 🎨 Generate Image button is hidden and the assistant won&apos;t
                  emit <code>[image: …]</code> tags. Turn this on after configuring a ComfyUI
                  provider in Image Engine settings.
                </span>
              </span>
              <input
                type="checkbox"
                className="sp-toggle"
                data-testid="vr-image-enabled"
                checked={imageEnabled}
                onChange={(e) => setImageEnabled(e.target.checked)}
              />
            </label>
          </div>
        </div>

        {/* VR Mode */}
        <div style={{ opacity: imageEnabled ? 1 : 0.5 }}>
          <p style={sectionLabel}>Visual Roleplay Mode</p>
          <div style={groupCard}>
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--sp-border-soft)", color: "var(--sp-fg-3)", fontSize: "0.85rem" }}>
              When set to <strong style={{ color: "var(--sp-fg-2)" }}>Auto</strong>, the assistant is instructed
              to append <code>[image: …]</code> Danbooru-style tags at the end
              of each reply. The tag is stripped from the chat bubble but kept
              in the stored message.
            </div>
            <label className="sp-row-interactive" style={radioRowStyle(false)}>
              <input
                type="radio"
                name="vr-mode"
                data-testid="vr-mode-manual"
                value="manual"
                checked={mode === "manual"}
                onChange={() => setMode("manual")}
              />
              <span><strong>Manual</strong></span>
              <span style={subStyle}>— replies are plain text</span>
            </label>
            <label className="sp-row-interactive" style={radioRowStyle(true)}>
              <input
                type="radio"
                name="vr-mode"
                data-testid="vr-mode-auto"
                value="auto"
                checked={mode === "auto"}
                onChange={() => setMode("auto")}
              />
              <span><strong>Auto</strong></span>
              <span style={subStyle}>— assistant emits image tags</span>
            </label>
          </div>
        </div>

        {/* Auto-generate */}
        <div style={{ opacity: autoDisabled ? 0.5 : 1 }}>
          <p style={sectionLabel}>Auto-generate images</p>
          <div style={groupCard}>
            <label className="sp-row-interactive" style={toggleRowStyle}>
              <span style={{ flex: 1 }}>
                <strong>Auto-generate on each reply</strong>
                <span style={{ ...subStyle, display: "block" }}>
                  {autoDisabled
                    ? "Turn on Visual Roleplay Mode first — without the tag, there's nothing to auto-generate from."
                    : "You can still tap 🎨 manually on any reply even when this is off."}
                </span>
              </span>
              <input
                type="checkbox"
                className="sp-toggle"
                data-testid="vr-auto-generate"
                checked={autoGenerate}
                disabled={autoDisabled}
                onChange={(e) => setAutoGenerate(e.target.checked)}
              />
            </label>
          </div>
        </div>

        {error && <StatusBanner tone="error" testid="vr-error" role="alert">{error}</StatusBanner>}
        {savedBanner && <StatusBanner tone="success" testid="vr-saved" role="status">Saved.</StatusBanner>}

        <div>
          <button type="submit" data-testid="vr-save" disabled={status === "saving"} style={saveBtnStyle(status === "saving")}>
            {status === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
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

const toggleRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.85rem 1rem",
  gap: "1rem",
  cursor: "pointer",
};

function radioRowStyle(isLast: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "0.65rem",
    padding: "0.75rem 1rem",
    borderBottom: isLast ? "none" : "1px solid var(--sp-border-soft)",
    cursor: "pointer",
  };
}

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
