import type { GrammarCorrection } from "../../lib/grammar";
import { diffWords } from "../../lib/diffWords";

// Inline grammar correction shown directly under the user bubble.
// Mode A: just the corrected sentence (with word-level diff coloring).
// Mode B: same + a "why:" explanation line underneath.
//
// Plan 0123 — Coloring: added/changed words in the corrected sentence
// pop so the user sees AT A GLANCE what changed, instead of having to
// mentally diff two prose strings.
// Plan 0129 — the highlight + left accent bar use `--char-accent` (the
// conversation's character accent, set on the ChatShell root) so the
// correction reads as part of the chat — matching the scenario pills /
// action-rail chips — instead of a foreign brand colour.

export function GrammarInlineRow({ correction, mode }: { correction: GrammarCorrection; mode: "A" | "B" }) {
  if (correction.original_text === correction.corrected_text) return null;

  const { addedTokens } = diffWords(correction.original_text, correction.corrected_text);

  return (
    <div data-testid={`grammar-inline-${correction.user_message_id}`} style={rowStyle}>
      <div>
        <span aria-hidden style={{ color: "var(--sp-fg-4)", marginRight: 4 }}>↳</span>
        <span style={{ color: "var(--sp-fg-3)", marginRight: 6 }}>corrected:</span>
        {addedTokens.map((t, i) => (
          t.kind === "added"
            ? <span key={i} style={addedStyle}>{t.text}</span>
            : <span key={i}>{t.text}</span>
        ))}
      </div>
      {mode === "B" && correction.explanation && (
        <div style={{ color: "var(--sp-fg-3)", fontSize: "0.85em", marginTop: 2 }}>why: {correction.explanation}</div>
      )}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  fontSize: "0.85em",
  color: "var(--sp-fg-2)",
  padding: "0.25rem 0.5rem",
  margin: "0.25rem 0",
  borderRight: "2px solid var(--char-accent)",
  textAlign: "right",
  maxWidth: "75%",
};

const addedStyle: React.CSSProperties = {
  color: "var(--char-accent)",
  fontWeight: 600,
};
