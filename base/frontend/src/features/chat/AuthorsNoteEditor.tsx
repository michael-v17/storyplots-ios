import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Icon } from "../../lib/Icon";
import { deleteAuthorsNote, loadAuthorsNote, upsertAuthorsNote, type AuthorsNote } from "../../lib/notes";
import { panelBackBtnStyle, panelTitleStyle, primaryPillStyle } from "./panelStyles";
import { Spinner } from "../../lib/Spinner";

const EXAMPLES = [
  "A storm is approaching the city.",
  "The user's character is hiding a secret.",
  "Build toward a confrontation this scene.",
  "We are in a medieval fantasy setting.",
];

type Props = {
  conversationId: string;
  userId: string;
  onBack: () => void;
  onChanged: (note: AuthorsNote | null) => void;
};

export function AuthorsNoteEditor({ conversationId, userId, onBack, onChanged }: Props) {
  const [note, setNote] = useState<AuthorsNote | null>(null);
  const [text, setText] = useState("");
  const [depth, setDepth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAuthorsNote(conversationId).then((n) => {
      setNote(n);
      setText(n?.notes_text ?? "");
      setDepth(n?.injection_depth ?? 0);
      setLoading(false);
    });
  }, [conversationId]);

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const saved = await upsertAuthorsNote(userId, conversationId, text.trim(), depth);
      setNote(saved);
      onChanged(saved);
    } finally { setSaving(false); }
  }

  async function clearNote() {
    if (!note) return;
    if (!window.confirm("Delete the Author's Note for this conversation?")) return;
    setSaving(true);
    try {
      await deleteAuthorsNote(conversationId);
      setNote(null); setText(""); setDepth(0);
      onChanged(null);
    } finally { setSaving(false); }
  }

  if (loading) return <main style={panelStyle}><Spinner testId="notes-editor-loading" /></main>;

  return (
    <div data-testid="notes-editor" data-form="stack" style={panelStyle}>
      <header style={headerStyle}>
        <button type="button" onClick={onBack} data-testid="notes-back" style={panelBackBtnStyle}>← Back</button>
        <h3 style={panelTitleStyle}>Author's Notes</h3>
        <span />
      </header>
      <small
        style={{ color: "var(--sp-fg-3)", lineHeight: 1.45 }}
        title="An Author's Note is your out-of-character direction. It is re-injected every turn at the depth you set below, so it keeps steering the story even as the conversation grows."
      >
        A standing instruction injected near the latest messages every turn — use it to steer where the story goes.
      </small>

      <span style={scopeChipStyle}>This Conversation</span>

      {/* marginTop:0 neutralises the global `[data-form="stack"] label`
          margin — this panel keeps data-form="stack" for the textarea chrome
          but lays its rows out with the grid gap, so the global label margin
          would otherwise double the rhythm. */}
      <label style={{ marginTop: 0 }}>Notes
        <textarea data-testid="notes-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      </label>

      <label style={{ marginTop: 0 }}>Depth: {depth}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.25rem" }}>
          <button type="button" data-testid="notes-depth-dec" onClick={() => setDepth((d) => Math.max(0, d - 1))} style={stepperBtnStyle} aria-label="Decrease depth">
            <Icon icon={Minus} size={16} />
          </button>
          <span style={{ fontSize: "1.2em", minWidth: 30, textAlign: "center", color: "var(--sp-fg)" }}>{depth}</span>
          <button type="button" data-testid="notes-depth-inc" onClick={() => setDepth((d) => d + 1)} style={stepperBtnStyle} aria-label="Increase depth">
            <Icon icon={Plus} size={16} />
          </button>
        </div>
        <small style={{ color: "var(--sp-fg-3)" }}>0 = right before your latest message. Higher = further back in history (counted by messages).</small>
      </label>

      <div>
        <small style={{ color: "var(--sp-fg-3)", display: "block", marginBottom: "0.35rem" }}>Examples (tap to append):</small>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setText((t) => (t ? `${t} ${ex}` : ex))}
              style={chipStyle}>{ex}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button type="button" data-testid="notes-save" onClick={save} disabled={saving || !text.trim()} style={primaryPillStyle(saving || !text.trim())}>
          {saving ? "Saving…" : "Save Notes"}
        </button>
        {note && <button type="button" data-testid="notes-delete" onClick={clearNote} disabled={saving} style={destructivePillStyle}>Delete</button>}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  // Positioned so it paints above the modal backdrop sibling — matches the
  // root panel + GenerationOverride/Memory. Without it the absolute backdrop
  // intercepts every click in modal (mobile) mode.
  position: "relative",
  display: "grid", gap: "0.5rem",
  // height:100% makes the grid taller than its content; without this the
  // default `align-content: normal` stretches the rows to fill, and a
  // short row (the scope chip, pinned `alignSelf: start`) shows a gap.
  alignContent: "start",
  padding: "1rem", background: "var(--sp-bg-2)",
  borderLeft: "1px solid var(--sp-border)",
  color: "var(--sp-fg)",
  width: 360, height: "100%", overflowY: "auto",
};
const headerStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem",
};
const scopeChipStyle: React.CSSProperties = {
  display: "inline-block", padding: "0.25rem 0.75rem",
  background: "var(--char-accent-soft)", border: "1px solid var(--char-accent)",
  color: "var(--char-accent)",
  borderRadius: "var(--sp-radius)", fontSize: "0.75em", fontWeight: 600,
  // The panel is `display: grid`. Grid items default to `stretch` on BOTH
  // axes, so the chip needs `justifySelf` (inline) AND `alignSelf` (block)
  // pinned to `start` to hug its own content instead of filling the cell.
  justifySelf: "start",
  alignSelf: "start",
};
const chipStyle: React.CSSProperties = {
  fontSize: "0.75em", padding: "0.3rem 0.6rem",
  background: "var(--sp-bg-3)", borderRadius: "var(--sp-radius)",
  cursor: "pointer", border: "1px solid var(--sp-border-soft)",
  color: "var(--sp-fg-2)", fontFamily: "inherit",
};
const stepperBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: "50%",
  background: "transparent", border: "1px solid var(--sp-border)",
  color: "var(--sp-fg-2)", cursor: "pointer",
  fontSize: "1rem", lineHeight: 1, padding: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
};
const destructivePillStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sp-destructive)",
  color: "var(--sp-destructive)",
  borderRadius: "var(--sp-radius)",
  padding: "0.45rem 1rem", fontWeight: 600, fontFamily: "inherit",
  cursor: "pointer",
};
