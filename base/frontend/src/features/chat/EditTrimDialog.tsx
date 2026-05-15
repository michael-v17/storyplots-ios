import { useEffect, useState } from "react";
import type { Message } from "../../lib/messages";

type Props = {
  target: Message;
  subsequentCount: number;
  onCancel: () => void;
  onConfirm: (newText: string) => Promise<void>;
};

// ux.md §8 inv 5: copy uses "edit" and "trim the feed"; never "update" or "revise".
export function EditTrimDialog({ target, subsequentCount, onCancel, onConfirm }: Props) {
  const [text, setText] = useState(target.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the textarea when the dialog is re-opened for a different target.
  useEffect(() => {
    setText(target.text ?? "");
    setError(null);
  }, [target.id]);

  async function confirm(): Promise<void> {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(text.trim());
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" data-testid="edit-trim-dialog" style={backdrop}>
      <div style={panel}>
        <h2 style={{ marginTop: 0 }}>Edit this message?</h2>
        <p>
          Saving will delete {describeTrimTarget(subsequentCount)} in this conversation. This can&apos;t be undone.
        </p>
        <textarea
          data-testid="edit-trim-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{ width: "100%" }}
        />
        {error && <p role="alert" style={{ color: "var(--sp-destructive)" }}>{error}</p>}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button type="button" data-testid="edit-trim-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" data-testid="edit-trim-confirm" onClick={confirm} disabled={busy || !text.trim()}>
            {busy ? "Saving…" : "Edit & trim"}
          </button>
        </div>
      </div>
    </div>
  );
}

function describeTrimTarget(count: number): string {
  if (count === 0) return "no later messages";
  if (count === 1) return "the 1 message sent after this one";
  return `the ${count} messages sent after this one`;
}

const backdrop: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
};
const panel: React.CSSProperties = {
  background: "white", borderRadius: "var(--sp-radius)", padding: "1.25rem", maxWidth: 480, width: "90%",
  display: "grid", gap: "0.75rem",
};
