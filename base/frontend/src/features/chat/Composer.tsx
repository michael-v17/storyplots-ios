import { useEffect, useRef, useState } from "react";

type Props = {
  onSend: (text: string) => Promise<void>;
  /** Visible explanation shown above the input (e.g. "configure a model"). */
  disabledReason?: React.ReactNode;
  /** Silently disable input + send (no explanation banner). Used for
   *  transient gates like assistant streaming where the typing dots are
   *  already a sufficient signal — adding text undermines realism. */
  disabled?: boolean;
  extraButton?: React.ReactNode;
};

export function Composer({ onSend, disabledReason, disabled, extraButton }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabledReason && !disabled) ref.current?.focus();
  }, [disabledReason, disabled]);

  const gated = !!disabledReason || !!disabled;
  const hasText = text.trim().length > 0;

  async function submit(): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setText("");
    ref.current?.focus();
    try {
      await onSend(trimmed);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    // Enter sends; Shift+Enter inserts newline (ux.md §4.6, creator-vision.md §5.2).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const sendDisabled = busy || gated || !hasText;

  return (
    <footer data-testid="chat-composer" style={composerStyle}>
      {disabledReason && (
        <p data-testid="chat-gated" style={{ margin: 0, color: "var(--sp-fg-3)", fontSize: "0.9em" }}>
          {disabledReason}
        </p>
      )}
      {error && <p role="alert" style={{ color: "var(--sp-destructive)", margin: 0 }}>{error}</p>}
      <div style={pillStyle}>
        <textarea
          ref={ref}
          data-testid="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy || gated}
          placeholder="Type a message…"
          rows={2}
          style={textareaStyle}
        />
        <button
          type="button"
          data-testid="chat-send"
          disabled={sendDisabled}
          onClick={submit}
          aria-label="Send"
          title="Send"
          style={{
            ...sendBtnStyle,
            background: "var(--sp-bg-3)",
            border: `1px solid ${sendDisabled ? "var(--sp-border-soft)" : "var(--sp-border)"}`,
            color: sendDisabled ? "var(--sp-fg-4)" : "var(--sp-fg)",
            cursor: sendDisabled ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "…" : "↑"}
        </button>
      </div>
      {extraButton && (
        <div style={extrasRowStyle}>
          {extraButton}
        </div>
      )}
    </footer>
  );
}

const composerStyle: React.CSSProperties = {
  // `display: flex; flexDirection: column` + `minWidth: 0`: same fix as
  // cycle 0075 ImageViewer footer. With `display: grid` (no explicit
  // template-columns), the auto column expanded to the intrinsic width
  // of the widest child — the textarea's natural-text-width was wider
  // than the viewport on narrow phones, pushing the pill past the
  // viewport's right edge (Web Inspector showed 402×56 on a 375 wide
  // device). Flex column with min-width:0 lets each child shrink to
  // the container width.
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  minWidth: 0,
  // 16 px horizontal matches the feed gutter (`1.25rem 1rem`) so the
  // composer pill aligns vertically with the message column.
  padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
};

const pillStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  padding: "8px 10px 8px 16px",
};

const textareaStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "transparent",
  border: "none",
  outline: "none",
  color: "var(--sp-fg)",
  fontFamily: "inherit",
  fontSize: 16,
  lineHeight: 1.5,
  resize: "none",
  maxHeight: 120,
  paddingTop: 6,
  paddingBottom: 2,
};

const sendBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  flexShrink: 0,
  borderRadius: "50%",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  fontWeight: 600,
  transition: "background 160ms var(--sp-ease), color 160ms var(--sp-ease)",
};

const extrasRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "0.5rem",
  fontSize: "0.85em",
  color: "var(--sp-fg-3)",
};
