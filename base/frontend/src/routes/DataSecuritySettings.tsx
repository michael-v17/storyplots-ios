import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { exportMyData } from "../lib/dataExport";
import { importBackup, type ImportResult } from "../lib/dataImport";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import { StatusBanner } from "../lib/StatusBanner";
import { Spinner } from "../lib/Spinner";
import { Modal, modalHeadingStyle, modalActionsStyle } from "../lib/Modal";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Status = "loading" | "ready" | "saving" | "deleting";

type StorageCounts = {
  characters: number;
  conversations: number;
  images: number;
  audio: number;
};

export function DataSecuritySettings() {
  useDocumentTitle("Data & Security · Settings");
  const nav = useNavigate();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;

  const [status, setStatus] = useState<Status>("loading");
  const [sfwDisabled, setSfwDisabled] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showSfwModal, setShowSfwModal] = useState(false);
  const [counts, setCounts] = useState<StorageCounts>({ characters: 0, conversations: 0, images: 0, audio: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  async function fetchCounts(): Promise<StorageCounts> {
    const [chars, convs, imgs, audios] = await Promise.all([
      supabase.from("characters").select("id", { count: "exact", head: true }),
      supabase.from("conversations").select("id", { count: "exact", head: true }),
      supabase.from("generated_images").select("id", { count: "exact", head: true }),
      supabase.from("message_audio").select("id", { count: "exact", head: true }),
    ]);
    return {
      characters: chars.count ?? 0,
      conversations: convs.count ?? 0,
      images: imgs.count ?? 0,
      audio: audios.count ?? 0,
    };
  }

  async function refreshCounts() {
    setCounts(await fetchCounts());
  }

  useEffect(() => {
    if (sess.status !== "ready") return;
    if (!userId) { nav("/sign-in"); return; }
    let cancelled = false;
    (async () => {
      const [userRow, nextCounts] = await Promise.all([
        supabase.from("users").select("sfw_disabled, auth_method").eq("id", userId).single(),
        fetchCounts(),
      ]);
      if (cancelled) return;
      setSfwDisabled(userRow.data?.sfw_disabled === true);
      setIsAnonymous(userRow.data?.auth_method === "anonymous");
      setCounts(nextCounts);
      setStatus("ready");
    })();
    return () => { cancelled = true; };
  }, [sess.status, userId, nav]);

  async function saveSfw(enable18Plus: boolean) {
    setStatus("saving");
    setError(null);
    const { error: err } = await supabase
      .from("users")
      .update({ sfw_disabled: enable18Plus })
      .eq("id", userId!);
    if (err) {
      setError(err.message ?? err.details ?? "Could not save setting");
      setStatus("ready");
      return;
    }
    setSfwDisabled(enable18Plus);
    setStatus("ready");
  }

  async function onToggleSfw(enable18Plus: boolean) {
    if (enable18Plus === sfwDisabled) return; // already in desired state, no-op
    if (enable18Plus && isAnonymous) {
      setError("Sign in with email to enable NSFW content.");
      return;
    }
    if (enable18Plus) {
      setShowSfwModal(true);
      return;
    }
    await saveSfw(enable18Plus);
  }

  async function confirmSfw() {
    setShowSfwModal(false);
    await saveSfw(true);
  }

  async function deleteAll(table: "conversations" | "generated_images" | "message_audio") {
    setStatus("saving");
    await supabase.from(table).delete().eq("user_id", userId!);
    await refreshCounts();
    setStatus("ready");
  }

  async function onSignOut() {
    await supabase.auth.signOut();
    nav("/");
  }

  async function onDeleteAccount() {
    if (deleteConfirm !== "DELETE") return;
    setStatus("deleting"); setError(null);
    try {
      const { error: err } = await supabase.rpc("delete_my_account");
      if (err) throw err;
      await supabase.auth.signOut();
      nav("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string; details?: string })?.message ?? (err as { details?: string })?.details;
      setError(msg ?? "Could not delete account");
      setStatus("ready");
    }
  }

  function closeDeleteModal() {
    setShowDeleteModal(false);
    setDeleteConfirm("");
  }

  if (status === "loading") {
    return <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}><Spinner testId="data-security-loading" /></main>;
  }

  return (
    <main data-testid="data-security-settings" style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
      <header className="sp-settings-header" style={headerStyle}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1">Data & Security</h1>
        <Link to="/settings" className="sp-back-btn">← Back</Link>
      </header>

      <p style={sectionLabel}>Content</p>
      <div style={{ ...sectionCard, marginBottom: "1.5rem" }}>
        <p style={{ margin: 0, color: "var(--sp-fg-3)", fontSize: "0.9rem" }}>
          All characters and conversations are fiction. StoryPlots does not
          endorse, encourage, or facilitate real-world actions described in
          roleplay. You control the content — use responsibly.
        </p>
        <label style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <input
            type="checkbox"
            className="sp-toggle"
            data-testid="sfw-toggle"
            checked={sfwDisabled}
            disabled={isAnonymous}
            onChange={(e) => onToggleSfw(e.target.checked)}
          />
          <span>Allow NSFW Content (I'm 18+)</span>
        </label>
        <small style={{ color: "var(--sp-fg-3)" }}>
          Display media that may contain NSFW content. You must be 18 years or
          older to enable this setting.
        </small>
        {isAnonymous && (
          <small data-testid="sfw-anon-hint" style={{ color: "var(--sp-warning)" }}>
            Sign in with email to enable NSFW content.
          </small>
        )}
        <small style={{ color: "var(--sp-fg-3)" }}>
          When off, the image refiner blocks NSFW generations and the
          Conversation Agent stays within safe-for-work guidelines.
        </small>
      </div>

      <p style={sectionLabel}>Cloud AI Consent</p>
      <div style={{ ...sectionCard, gap: "0.5rem", marginBottom: "1.5rem" }}>
        <p style={{ margin: 0, color: "var(--sp-fg-3)", fontSize: "0.9rem" }}>
          Your API keys are stored encrypted in the vault. Conversation data
          is sent to your configured model provider (OpenRouter, OpenAI,
          ElevenLabs, etc.) only during active generation. StoryPlots does not
          train on your data or share it with third parties.
        </p>
      </div>

      <p style={sectionLabel}>Storage</p>
      <div style={{ ...sectionCard, marginBottom: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.35rem 1rem", alignItems: "center" }}>
          <span>Characters</span><strong data-testid="count-characters">{counts.characters}</strong><span />
          <span>Conversations</span><strong data-testid="count-conversations">{counts.conversations}</strong>
          <button type="button" data-testid="delete-conversations" style={deleteLinkStyle} disabled={status !== "ready" || counts.conversations === 0}
            onClick={() => deleteAll("conversations")}>
            delete all
          </button>
          <span>Generated images</span><strong data-testid="count-images">{counts.images}</strong>
          <button type="button" data-testid="delete-images" style={deleteLinkStyle} disabled={status !== "ready" || counts.images === 0}
            onClick={() => deleteAll("generated_images")}>
            delete all
          </button>
          <span>Audio clips</span><strong data-testid="count-audio">{counts.audio}</strong>
          <button type="button" data-testid="delete-audio" style={deleteLinkStyle} disabled={status !== "ready" || counts.audio === 0}
            onClick={() => deleteAll("message_audio")}>
            delete all
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
          <button type="button" data-testid="export-data" disabled={exporting}
            onClick={async () => { setExporting(true); try { await exportMyData(userId!); } catch (e) { setError(String(e)); } finally { setExporting(false); } }}
            style={ghostPillStyle}>
            {exporting ? "Exporting…" : "Export My Data"}
          </button>
          <button type="button" data-testid="import-data" disabled={importing}
            onClick={() => importFileRef.current?.click()}
            style={ghostPillStyle}>
            {importing ? "Importing…" : "Import Backup"}
          </button>
          <input ref={importFileRef} type="file" accept=".zip" hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setImporting(true); setImportResult(null); setError(null);
              try {
                const result = await importBackup(file, userId!);
                setImportResult(result);
                if (result.errors.length > 0) setError(`Import completed with ${result.errors.length} error(s)`);
                await refreshCounts();
              } catch (err) { setError(String(err)); }
              finally { setImporting(false); e.target.value = ""; }
            }} />
          <button type="button" data-testid="clear-grammar" disabled={status !== "ready"}
            onClick={async () => {
              setStatus("saving");
              await supabase.from("grammar_corrections").delete().eq("user_id", userId!);
              await supabase.from("grammar_aggregates").delete().eq("user_id", userId!);
              setStatus("ready");
            }}
            style={ghostPillStyle}>
            Clear grammar data
          </button>
          <button type="button" data-testid="reset-settings" disabled={status !== "ready"}
            onClick={async () => {
              setStatus("saving");
              await supabase.from("users").update({ preferences: {} }).eq("id", userId!);
              setStatus("ready");
            }}
            style={ghostPillStyle}>
            Reset settings
          </button>
        </div>

        {importResult && (
          <StatusBanner tone={importResult.errors.length > 0 ? "warning" : "success"} testid="import-result" role="status">
            Imported: {importResult.characters} characters, {importResult.conversations} conversations,
            {" "}{importResult.messages} messages, {importResult.personas} personas, {importResult.lorebook} lorebook.
            {importResult.errors.length > 0 && <span style={{ color: "var(--sp-destructive)" }}> ({importResult.errors.length} errors)</span>}
          </StatusBanner>
        )}
      </div>

      {error && (
        <StatusBanner tone="error" testid="data-security-error" role="alert">{error}</StatusBanner>
      )}

      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap", marginTop: "1rem" }}>
        <button
          type="button"
          data-testid="sign-out"
          onClick={onSignOut}
          style={ghostPillStyle}
        >
          Sign out
        </button>

        <button
          type="button"
          data-testid="delete-account-btn"
          onClick={() => setShowDeleteModal(true)}
          style={destructiveSolidPillStyle}
        >
          Delete my account
        </button>
      </div>

      {showSfwModal && (
        <Modal onClose={() => setShowSfwModal(false)} labelId="sfw-modal-title">
          <h2 id="sfw-modal-title" style={modalHeadingStyle}>Age verification</h2>
          <p style={{ margin: 0, color: "var(--sp-fg-2)" }}>You must be 18 or older to disable the SFW filter. By continuing you confirm you are of legal age.</p>
          <div style={modalActionsStyle}>
            <button type="button" onClick={() => setShowSfwModal(false)} style={ghostPillStyle}>Cancel</button>
            <button
              type="button"
              data-testid="sfw-confirm"
              onClick={confirmSfw}
              style={destructiveSolidPillStyle}
            >
              I am 18+ — continue
            </button>
          </div>
        </Modal>
      )}

      {showDeleteModal && (
        <Modal onClose={closeDeleteModal} labelId="delete-modal-title">
          <h2 id="delete-modal-title" style={{ ...modalHeadingStyle, color: "var(--sp-destructive)" }}>Delete your account</h2>
          <p style={{ margin: 0, color: "var(--sp-fg-2)" }}>This will <strong style={{ color: "var(--sp-fg)" }}>permanently erase</strong> all your data:</p>
          <ul style={{ fontSize: "0.9rem", color: "var(--sp-fg-2)", margin: "0.25rem 0 0.5rem", paddingLeft: "1.25rem" }}>
            <li>Characters, conversations, messages</li>
            <li>Generated images and audio</li>
            <li>Personas, lorebook entries, grammar data</li>
            <li>Provider configurations and API keys</li>
            <li>Your authentication account</li>
          </ul>
          <p style={{ color: "var(--sp-destructive)", fontWeight: 600, margin: 0 }}>This cannot be undone.</p>
          <label style={{ display: "grid", gap: "0.4rem", marginTop: "0.5rem" }}>
            <span style={{ color: "var(--sp-fg-2)" }}>Type <strong style={{ color: "var(--sp-fg)" }}>DELETE</strong> to confirm:</span>
            <input
              data-testid="delete-confirm-input"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              autoFocus
              style={modalInputStyle}
            />
          </label>
          <div style={modalActionsStyle}>
            <button type="button" onClick={closeDeleteModal} style={ghostPillStyle}>Cancel</button>
            <button
              type="button"
              data-testid="delete-confirm-btn"
              disabled={deleteConfirm !== "DELETE" || status === "deleting"}
              onClick={onDeleteAccount}
              style={deleteConfirm === "DELETE" && status !== "deleting" ? destructiveSolidPillStyle : disabledPillStyle}
            >
              {status === "deleting" ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.75rem" };

const sectionCard: React.CSSProperties = { background: "var(--sp-bg-2)", border: "1px solid var(--sp-border)", borderRadius: "var(--sp-radius)", padding: "1rem", display: "grid", gap: "0.85rem" };

const sectionLabel: React.CSSProperties = {
  fontSize: "var(--sp-text-xs)",
  fontWeight: 600,
  letterSpacing: "var(--sp-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--sp-fg-3)",
  paddingLeft: 4,
  margin: "0 0 0.5rem",
};

// Inline match for modal input — `data-form="stack"` reset doesn't cascade into
// modal overlays (different DOM subtree), so we replicate its shape here.
// Native focus ring kept (no `outline: none`) so keyboard users see focus state
// per WCAG 2.4.7 — the global stack reset removes it via CSS but we don't
// duplicate that here since the modal has only one input.
const modalInputStyle: React.CSSProperties = {
  background: "var(--sp-bg-inset)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  padding: "0.45rem 0.6rem",
  color: "var(--sp-fg)",
  fontSize: "1em",
  fontFamily: "inherit",
};

const deleteLinkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--sp-destructive)",
  cursor: "pointer",
  fontSize: "0.8rem",
  padding: 0,
  textDecoration: "underline",
  fontFamily: "inherit",
};

const basePillStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: "var(--sp-radius)",
  cursor: "pointer",
  fontSize: 14,
  fontFamily: "inherit",
  fontWeight: 500,
  transition: "background 160ms var(--sp-ease), color 160ms var(--sp-ease), border-color 160ms var(--sp-ease)",
};

const ghostPillStyle: React.CSSProperties = {
  ...basePillStyle,
  background: "transparent",
  border: "1px solid var(--sp-border)",
  color: "var(--sp-fg-2)",
};

// Destructive CTA for account-level actions. Kit canon: solid --sp-destructive
// bg + literal white text (higher contrast than `--sp-fg` on red; kit
// `components.jsx` PillButton variant destructive uses this exact pattern).
const destructiveSolidPillStyle: React.CSSProperties = {
  ...basePillStyle,
  background: "transparent",
  border: "1px solid var(--sp-destructive)",
  color: "var(--sp-destructive)",
  fontWeight: 600,
};

const disabledPillStyle: React.CSSProperties = {
  ...basePillStyle,
  background: "var(--sp-bg-3)",
  border: "1px solid var(--sp-border)",
  color: "var(--sp-fg-4)",
  // `cursor: not-allowed` omitted — Chromium/Safari ignore cursor on
  // [disabled] buttons; visual disabled state comes from bg/color tokens.
};
