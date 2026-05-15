import { useState } from "react";
import { validateRewrite } from "../../lib/reinforcement";

export function RewriteGate({
  correctedText,
  explanation,
  onPass,
  onExhausted,
}: {
  correctedText: string;
  explanation: string | null;
  onPass: (failuresBeforePass: number) => void;
  onExhausted: (totalFailures: number) => void;
}) {
  const [attempt, setAttempt] = useState("");
  const [strikes, setStrikes] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!attempt.trim()) return;
    const { pass, similarity } = validateRewrite(attempt, correctedText);
    if (pass) {
      onPass(strikes);
      return;
    }
    const next = strikes + 1;
    setStrikes(next);
    if (next >= 3) {
      setFeedback("That's enough — continuing.");
      setTimeout(() => onExhausted(next), 800);
      return;
    }
    setFeedback(`Not quite (${Math.round(similarity * 100)}% match). Attempt ${next}/3.`);
  }

  return (
    <footer data-testid="rewrite-gate" style={gateStyle}>
      <div style={{ fontWeight: "bold" }}>Rewrite this sentence:</div>
      <div data-testid="rewrite-target" style={{ padding: "0.5rem", background: "var(--sp-bg-3)", borderRadius: "var(--sp-radius)", color: "var(--sp-fg)" }}>
        {correctedText}
      </div>
      {explanation && <small style={{ color: "var(--sp-fg-3)" }}>Why: {explanation}</small>}
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.5rem" }}>
        <textarea
          data-testid="rewrite-input"
          value={attempt}
          onChange={(e) => setAttempt(e.target.value)}
          rows={2}
          placeholder="Type the corrected version here…"
          disabled={strikes >= 3}
        />
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button type="submit" data-testid="rewrite-submit" disabled={!attempt.trim() || strikes >= 3}>
            Check
          </button>
          <small style={{ color: "var(--sp-fg-3)" }}>Attempt {strikes}/3</small>
        </div>
      </form>
      {feedback && <p data-testid="rewrite-feedback" role="status" style={{ margin: 0 }}>{feedback}</p>}
    </footer>
  );
}

const gateStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  padding: "0.75rem 1rem",
  borderTop: "2px solid var(--sp-warning)",
  background: "var(--sp-warning-soft)",
  color: "var(--sp-fg)",
};
