import { useState } from "react";
import { forkConversation, type ForkMode, type ForkResult } from "../../lib/fork";
import type { Message, MessageVariant } from "../../lib/messages";

type Props = {
  conversationId: string;
  anchor: Message;
  anchorPreview: string;
  onCancel: () => void;
  onForked: (result: ForkResult) => void;
};

export function ForkDialog({ conversationId, anchor, anchorPreview, onCancel, onForked }: Props) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<ForkMode>("keep_messages");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await forkConversation(conversationId, anchor.id, mode, title.trim() || null);
      onForked(result);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  const cta = mode === "keep_messages" ? "Create Branch" : "Summarize & Branch";
  const ctaBusy = mode === "keep_messages" ? "Creating…" : "Summarizing…";

  return (
    <div role="dialog" aria-modal="true" data-testid="fork-dialog" style={backdrop}>
      <div style={panel}>
        <h2 style={{ marginTop: 0 }}>Fork Conversation</h2>
        <p style={{ margin: 0, color: "var(--sp-fg-3)" }}>Create a new branch from this point to explore a different path.</p>

        <fieldset style={card}>
          <legend style={legend}>Starting point</legend>
          <div data-testid="fork-anchor-preview" style={{ color: "var(--sp-fg-2)", fontStyle: "italic" }}>
            {truncate(anchorPreview, 160)}
          </div>
        </fieldset>

        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Branch name</span>
          <input
            data-testid="fork-title-input"
            type="text"
            placeholder="Auto-generated if empty"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
          />
        </label>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          <ModeCard
            testid="fork-mode-keep"
            checked={mode === "keep_messages"}
            disabled={busy}
            onChange={() => setMode("keep_messages")}
            icon="⑂"
            title="Keep previous messages"
            subtitle="Create a new branch with all messages copied up to this point."
          />
          <ModeCard
            testid="fork-mode-summarize"
            checked={mode === "summarize_fresh"}
            disabled={busy}
            onChange={() => setMode("summarize_fresh")}
            icon="📄"
            title="Summarize & start fresh"
            subtitle="AI summarizes earlier messages; branch starts lightweight."
          />
        </div>

        {error && <p role="alert" style={{ color: "var(--sp-destructive)", margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button type="button" data-testid="fork-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" data-testid="fork-confirm" onClick={submit} disabled={busy}>
            {busy ? ctaBusy : cta}
          </button>
        </div>
      </div>
    </div>
  );
}

export function pickAnchorPreview(message: Message, variants: MessageVariant[] | undefined): string {
  if (message.role === "user") return message.text ?? "";
  const active = variants?.find((v) => v.id === message.active_variant_id);
  return active?.content ?? "";
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}

function ModeCard({
  testid, checked, disabled, onChange, icon, title, subtitle,
}: {
  testid: string; checked: boolean; disabled: boolean; onChange: () => void;
  icon: string; title: string; subtitle: string;
}) {
  return (
    <label
      data-testid={testid}
      style={{
        ...card,
        borderColor: checked ? "var(--char-accent, var(--sp-brand-1))" : "var(--sp-border)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <input
        type="radio"
        name="fork-mode"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        style={{ marginRight: "0.5rem" }}
      />
      <span style={{ fontSize: "1.2em", marginRight: "0.5rem" }}>{icon}</span>
      <span style={{ flex: 1 }}>
        <strong style={{ display: "block" }}>{title}</strong>
        <span style={{ color: "var(--sp-fg-3)", fontSize: "0.85em" }}>{subtitle}</span>
      </span>
    </label>
  );
}

const backdrop: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
};
const panel: React.CSSProperties = {
  background: "var(--sp-bg-2)", border: "1px solid var(--sp-border)", borderRadius: "var(--sp-radius)",
  padding: "1.25rem", maxWidth: 520, width: "92%",
  display: "grid", gap: "0.75rem", color: "var(--sp-fg)",
};
const card: React.CSSProperties = {
  border: "1px solid var(--sp-border)", borderRadius: "var(--sp-radius)", padding: "0.75rem",
  display: "flex", alignItems: "flex-start",
};
const legend: React.CSSProperties = {
  padding: "0 0.25rem", fontSize: "0.85em", color: "var(--sp-fg-3)",
};
