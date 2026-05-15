import { useEffect, useState } from "react";
import { BookMarked } from "lucide-react";
import { Icon } from "../../lib/Icon";
import {
  createLorebookEntry,
  deleteLorebookEntry,
  listLorebookForConversation,
  updateLorebookEntry,
  type LorebookDraft,
  type LorebookEntry,
} from "../../lib/lorebook";
import { panelBackBtnStyle, panelTitleStyle, primaryPillStyle } from "./panelStyles";
import { Spinner } from "../../lib/Spinner";

type Props = {
  conversationId: string;
  userId: string;
  onBack: () => void;
  onChanged: (count: number) => void;
};

export function LorebookPanel({ conversationId, userId, onBack, onChanged }: Props) {
  const [entries, setEntries] = useState<LorebookEntry[]>([]);
  const [editing, setEditing] = useState<LorebookEntry | "new" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listLorebookForConversation(conversationId).then((list) => {
      setEntries(list);
      setLoading(false);
    });
  }, [conversationId]);

  async function refresh() {
    const list = await listLorebookForConversation(conversationId);
    setEntries(list);
    onChanged(list.length);
  }

  if (loading) return <main style={panelStyle}><Spinner testId="lorebook-panel-loading" /></main>;

  if (editing) {
    return (
      <EntryEditor
        entry={editing === "new" ? null : editing}
        onSave={async (draft) => {
          if (editing === "new") {
            await createLorebookEntry(userId, conversationId, draft);
          } else {
            await updateLorebookEntry(editing.id, draft);
          }
          await refresh();
          setEditing(null);
        }}
        onDelete={editing !== "new" ? async () => {
          if (!window.confirm("Delete this entry?")) return;
          await deleteLorebookEntry(editing.id);
          await refresh();
          setEditing(null);
        } : undefined}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div data-testid="lorebook-panel" style={panelStyle}>
      <header style={headerStyle}>
        <button type="button" onClick={onBack} data-testid="lorebook-back" style={panelBackBtnStyle}>← Back</button>
        <h3 style={panelTitleStyle}>Lorebook</h3>
        <button type="button" data-testid="lorebook-new" onClick={() => setEditing("new")} style={primaryPillStyle(false, "sm")}>+ New</button>
      </header>
      <p
        style={descStyle}
        title="Each entry has keywords. When any keyword appears in the latest messages, the entry's text is added to the prompt for that turn — so the character can recall it."
      >
        Facts the character can recall — injected when a keyword matches recent messages.
      </p>
      {entries.length === 0 ? (
        <div data-testid="lorebook-empty" style={emptyCardStyle}>
          <Icon icon={BookMarked} size={22} />
          <strong style={{ color: "var(--sp-fg-2)" }}>No entries yet</strong>
          <span style={{ color: "var(--sp-fg-3)", fontSize: "0.85em" }}>
            Add a place, person, or fact the character should remember. Tap + New to create one.
          </span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {entries.map((e) => (
            <button key={e.id} type="button" data-testid={`lorebook-entry-${e.id}`}
              onClick={() => setEditing(e)} style={entryStyle}>
              <strong style={{ color: "var(--sp-fg)" }}>{e.title}</strong>
              <div style={{ color: "var(--sp-fg-3)", fontSize: "0.85em" }}>{e.body.slice(0, 80)}{e.body.length > 80 ? "…" : ""}</div>
              <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                {e.keywords.map((k) => <span key={k} style={chipStyle}>{k}</span>)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EntryEditor({
  entry, onSave, onDelete, onCancel,
}: {
  entry: LorebookEntry | null;
  onSave: (draft: LorebookDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [keywordsText, setKeywordsText] = useState((entry?.keywords ?? []).join(", "));
  const [body, setBody] = useState(entry?.body ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave({
        title,
        keywords: keywordsText.split(",").map((k) => k.trim()).filter(Boolean),
        body,
      });
    } finally { setSaving(false); }
  }

  return (
    <div data-testid="lorebook-editor" data-form="stack" style={panelStyle}>
      <header style={headerStyle}>
        <button type="button" onClick={onCancel} data-testid="lorebook-editor-back" style={panelBackBtnStyle}>← Back</button>
        <h3 style={panelTitleStyle}>{entry ? "Edit entry" : "New entry"}</h3>
        <span />
      </header>
      <label>Title
        <input data-testid="lorebook-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label>Keywords (comma-separated)
        <input data-testid="lorebook-keywords" value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)}
          placeholder="e.g. castle, vexen, throne" />
      </label>
      <label>Body
        <textarea data-testid="lorebook-body" value={body} onChange={(e) => setBody(e.target.value)}
          rows={6} required />
      </label>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button type="button" data-testid="lorebook-save" onClick={save}
          disabled={saving || !title.trim() || !body.trim()} style={primaryPillStyle(saving || !title.trim() || !body.trim(), "sm")}>
          {saving ? "Saving…" : "Save"}
        </button>
        {onDelete && <button type="button" data-testid="lorebook-delete" onClick={onDelete} disabled={saving} style={destructivePillStyle}>Delete</button>}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  // Positioned so it paints above the modal backdrop sibling — matches the
  // root panel + GenerationOverride/Memory. Without it the absolute backdrop
  // intercepts every click in modal (mobile) mode.
  position: "relative",
  display: "grid", gap: "0.75rem",
  // height:100% > content height; alignContent:start stops the grid from
  // stretching its rows to fill (which spread the header/desc/empty-card far
  // apart and ballooned the dashed card).
  alignContent: "start",
  padding: "1rem", background: "var(--sp-bg-2)",
  borderLeft: "1px solid var(--sp-border)",
  color: "var(--sp-fg)",
  width: 360, height: "100%", overflowY: "auto",
};
const headerStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem",
};
const descStyle: React.CSSProperties = {
  margin: 0, color: "var(--sp-fg-3)", fontSize: "0.8rem", lineHeight: 1.45,
};
// Dashed-card empty state — same primitive as Home "Add Character" / Gallery.
const emptyCardStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center",
  gap: "0.4rem", textAlign: "center",
  padding: "1.5rem 1.25rem",
  border: "1.5px dashed var(--sp-border-strong)",
  borderRadius: "var(--sp-radius-lg)",
  background: "var(--sp-bg-2)",
  color: "var(--sp-fg-3)",
};
const entryStyle: React.CSSProperties = {
  textAlign: "left", padding: "0.6rem 0.85rem",
  border: "1px solid var(--sp-border)", borderRadius: "var(--sp-radius)",
  background: "var(--sp-bg-3)",
  cursor: "pointer",
  fontFamily: "inherit", fontSize: "inherit",
};
const chipStyle: React.CSSProperties = {
  fontSize: "0.75em", padding: "0.15rem 0.55rem",
  background: "var(--sp-bg-2)", borderRadius: "var(--sp-radius)",
  color: "var(--sp-fg-2)", border: "1px solid var(--sp-border-soft)",
};
const destructivePillStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sp-destructive)",
  color: "var(--sp-destructive)",
  borderRadius: "var(--sp-radius)",
  padding: "0.45rem 1rem", fontWeight: 600, fontFamily: "inherit",
  cursor: "pointer",
};
