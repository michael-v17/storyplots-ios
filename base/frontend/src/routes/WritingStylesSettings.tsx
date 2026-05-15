import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session";
import {
  createWritingStyle,
  deleteWritingStyle,
  listWritingStyles,
  updateWritingStyle,
  type WritingStyle,
  type WritingStyleDraft,
} from "../lib/writingStyles";
import { Spinner } from "../lib/Spinner";
import { StatusBanner } from "../lib/StatusBanner";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type EditState =
  | { kind: "idle" }
  | { kind: "new"; draft: WritingStyleDraft }
  | { kind: "edit"; id: string; draft: WritingStyleDraft };

function emptyDraft(): WritingStyleDraft {
  return { name: "", writing_instructions: "" };
}

export function WritingStylesSettings() {
  useDocumentTitle("Writing Styles · Settings");
  const nav = useNavigate();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;

  const [rows, setRows] = useState<WritingStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<EditState>({ kind: "idle" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sess.status !== "ready") return;
    if (!userId) { nav("/sign-in"); return; }
    let cancelled = false;
    listWritingStyles()
      .then((r) => { if (!cancelled) setRows(r); })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sess.status, userId, nav]);

  const builtIns = useMemo(() => rows.filter((r) => r.is_built_in), [rows]);
  const customs = useMemo(() => rows.filter((r) => !r.is_built_in), [rows]);

  async function onSave() {
    if (edit.kind === "idle" || !userId) return;
    const draft = edit.draft;
    if (!draft.name.trim() || !draft.writing_instructions.trim()) {
      setError("Name and writing instructions are both required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (edit.kind === "new") {
        const created = await createWritingStyle(userId, draft);
        setRows((prev) => [...prev, created]);
      } else {
        const updated = await updateWritingStyle(edit.id, draft);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      }
      setEdit({ kind: "idle" });
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this writing style? Conversations that already snapshotted it stay unchanged.")) return;
    setError(null);
    try {
      await deleteWritingStyle(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <main data-testid="writing-styles-settings" style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
      <header className="sp-settings-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.75rem" }}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1">Writing Styles</h1>
        <Link to="/settings" className="sp-back-btn">← Back</Link>
      </header>

      <p style={{ color: "var(--sp-fg-3)", marginBottom: "1rem" }}>
        Snapshotted into each new Conversation as prompt position 1. Editing a preset only
        affects conversations you create afterwards.
      </p>

      {error && (
        <StatusBanner tone="error" testid="writing-styles-error" role="alert">
          {error}
        </StatusBanner>
      )}

      {loading ? (
        <Spinner testId="writing-styles-loading" />
      ) : (
        <section data-testid="writing-styles-list" style={{ display: "grid", gap: "0.5rem" }}>
          <p style={sectionLabel}>Built-in</p>
          {builtIns.map((r) => (
            <article key={r.id} data-testid={`writing-style-row-${r.id}`} style={rowStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <strong style={{ color: "var(--sp-fg)" }}>{r.name}</strong>
                <span style={{ fontSize: "0.8rem", color: "var(--sp-fg-3)" }}>built-in · read-only</span>
              </div>
              <p style={previewStyle}>{r.writing_instructions}</p>
            </article>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "1rem" }}>
            <p style={sectionLabel}>Your styles</p>
            {edit.kind === "idle" && (
              <button
                type="button"
                data-testid="writing-style-new"
                onClick={() => setEdit({ kind: "new", draft: emptyDraft() })}
                style={ghostBtnStyle}
              >
                New writing style
              </button>
            )}
          </div>

          {edit.kind === "new" && (
            <EditForm
              draft={edit.draft}
              saving={saving}
              onChange={(d) => setEdit({ kind: "new", draft: d })}
              onSave={onSave}
              onCancel={() => { setEdit({ kind: "idle" }); setError(null); }}
            />
          )}

          {customs.length === 0 && edit.kind !== "new" && (
            <p style={{ color: "var(--sp-fg-3)", fontStyle: "italic" }}>No custom writing styles yet.</p>
          )}

          {customs.map((r) =>
            edit.kind === "edit" && edit.id === r.id ? (
              <EditForm
                key={r.id}
                draft={edit.draft}
                saving={saving}
                onChange={(d) => setEdit({ kind: "edit", id: r.id, draft: d })}
                onSave={onSave}
                onCancel={() => { setEdit({ kind: "idle" }); setError(null); }}
              />
            ) : (
              <article key={r.id} data-testid={`writing-style-row-${r.id}`} style={rowStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <strong style={{ color: "var(--sp-fg)" }}>{r.name}</strong>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      data-testid={`writing-style-edit-${r.id}`}
                      onClick={() => setEdit({
                        kind: "edit",
                        id: r.id,
                        draft: { name: r.name, writing_instructions: r.writing_instructions },
                      })}
                      style={ghostSmallBtnStyle}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      data-testid={`writing-style-delete-${r.id}`}
                      onClick={() => onDelete(r.id)}
                      style={destructiveBtnStyle}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p style={previewStyle}>{r.writing_instructions}</p>
              </article>
            ),
          )}
        </section>
      )}
    </main>
  );
}

function EditForm({
  draft,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  draft: WritingStyleDraft;
  saving: boolean;
  onChange: (d: WritingStyleDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <article style={{ ...rowStyle, background: "var(--sp-bg-3)" }} data-form="stack">
      <label>
        Name
        <input
          data-testid="writing-style-name"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="e.g. Noir Detective"
        />
      </label>
      <label>
        Writing instructions
        <textarea
          data-testid="writing-style-instructions"
          value={draft.writing_instructions}
          onChange={(e) => onChange({ ...draft, writing_instructions: e.target.value })}
          rows={8}
          placeholder="Write in hardboiled first-person narration. Short sentences…"
        />
      </label>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button type="button" data-testid="writing-style-save" onClick={onSave} disabled={saving} style={saveBtnStyle(saving)}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" data-testid="writing-style-cancel" onClick={onCancel} disabled={saving} style={ghostBtnStyle}>
          Cancel
        </button>
      </div>
    </article>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: "var(--sp-text-xs)",
  fontWeight: 600,
  letterSpacing: "var(--sp-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--sp-fg-3)",
  paddingLeft: 4,
  margin: "0 0 0.5rem",
};

const rowStyle: React.CSSProperties = {
  padding: "0.75rem 1rem",
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
};

const previewStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "var(--sp-fg-3)",
  margin: "0.5rem 0 0",
  whiteSpace: "pre-wrap",
};

const ghostBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sp-border)",
  color: "var(--sp-fg-2)",
  borderRadius: "var(--sp-radius)",
  padding: "0.45rem 1rem",
  fontWeight: 500,
  fontFamily: "inherit",
  fontSize: "0.9em",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const ghostSmallBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sp-border)",
  color: "var(--sp-fg-2)",
  borderRadius: "var(--sp-radius)",
  padding: "0.25rem 0.7rem",
  fontWeight: 500,
  fontFamily: "inherit",
  fontSize: "0.8em",
  cursor: "pointer",
};

const destructiveBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sp-destructive-soft)",
  color: "var(--sp-destructive)",
  borderRadius: "var(--sp-radius)",
  padding: "0.25rem 0.7rem",
  fontWeight: 500,
  fontFamily: "inherit",
  fontSize: "0.8em",
  cursor: "pointer",
};

function saveBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "var(--sp-bg-3)" : "var(--sp-brand-1)",
    color: disabled ? "var(--sp-fg-4)" : "var(--sp-fg-on-brand)",
    border: "none",
    borderRadius: "var(--sp-radius)",
    padding: "0.45rem 1.25rem",
    fontWeight: 600,
    fontFamily: "inherit",
    fontSize: "0.9em",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
