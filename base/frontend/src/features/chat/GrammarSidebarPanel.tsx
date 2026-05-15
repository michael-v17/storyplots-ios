import type { GrammarCorrection, GrammarPrefs } from "../../lib/grammar";
import { clearGrammarForConversation } from "../../lib/grammar";
import { diffWords } from "../../lib/diffWords";

type Props = {
  corrections: GrammarCorrection[];
  prefs: GrammarPrefs;
  conversationId: string;
  onClear: () => void;
  // "inline" (default): renders as a 280px flex sibling of the chat feed
  // on L. "overlay": renders as a full-screen fixed overlay with a
  // backdrop + close button on S/M so it is not cramped by the feed width.
  mode?: "inline" | "overlay";
  onClose?: () => void;
};

export function GrammarSidebarPanel({
  corrections,
  prefs,
  conversationId,
  onClear,
  mode = "inline",
  onClose,
}: Props) {
  const filtered = filterByFrequency(corrections, prefs.sidebar_frequency);

  const body = (
    <>
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <h3 style={titleStyle}>Grammar</h3>
          {filtered.length > 0 && (
            <span data-testid="grammar-count" style={countPillStyle}>{filtered.length}</span>
          )}
        </div>
        {mode === "overlay" && (
          <button
            type="button"
            data-testid="grammar-close"
            onClick={onClose}
            aria-label="Close grammar"
            style={closeBtnStyle}
          >
            ×
          </button>
        )}
      </header>

      {/* Mini per-Conversation summary line (ux.md §4.6). */}
      <p style={summaryStyle}>
        {filtered.length === 0
          ? "No corrections in this conversation yet."
          : `${filtered.length} correction${filtered.length === 1 ? "" : "s"} in this conversation`}
      </p>

      {filtered.length > 0 && (
        <div style={cardListStyle}>
          {filtered.map((c) => (
            // Key on user_message_id, not id: SSE-inserted optimistic
            // corrections carry id="" until a reload repopulates from the
            // DB, so id is not unique. corrections is already keyed by
            // user_message_id (one row per user message), so it is.
            <CorrectionCard key={c.user_message_id} correction={c} />
          ))}
        </div>
      )}

      <button
        type="button"
        data-testid="grammar-clear"
        style={clearBtnStyle}
        onClick={async () => {
          if (!window.confirm("Clear grammar corrections for this conversation?")) return;
          await clearGrammarForConversation(conversationId);
          onClear();
        }}
      >
        Clear grammar for this conversation
      </button>
    </>
  );

  if (mode === "overlay") {
    return (
      <>
        <div
          data-testid="grammar-backdrop"
          onClick={onClose}
          style={{ position: "fixed", inset: 0, background: "var(--sp-overlay)", zIndex: 55 }}
        />
        <aside data-testid="grammar-sidebar" data-mode="overlay" style={overlayPanelStyle}>
          {body}
        </aside>
      </>
    );
  }

  return (
    <aside data-testid="grammar-sidebar" data-mode="inline" style={inlinePanelStyle}>
      {body}
    </aside>
  );
}

// One correction = one card. Original (struck, muted, removed words
// emphasized) over corrected (primary, changed words in brand amber via
// diffWords — same convention as GrammarInlineRow), an optional "why:"
// note, and humanized error-category chips.
function CorrectionCard({ correction: c }: { correction: GrammarCorrection }) {
  const { removedTokens, addedTokens } = diffWords(c.original_text, c.corrected_text);
  return (
    <div data-testid={`grammar-card-${c.id}`} style={cardStyle}>
      <div style={originalLineStyle}>
        {removedTokens.map((t, i) =>
          t.kind === "removed"
            ? <span key={i} style={removedTokenStyle}>{t.text}</span>
            : <span key={i}>{t.text}</span>,
        )}
      </div>
      <div style={correctedLineStyle}>
        {addedTokens.map((t, i) =>
          t.kind === "added"
            ? <span key={i} style={addedTokenStyle}>{t.text}</span>
            : <span key={i}>{t.text}</span>,
        )}
      </div>
      {c.explanation && (
        <div style={whyStyle}>
          <span style={whyLabelStyle}>why</span> {c.explanation}
        </div>
      )}
      {c.error_categories.length > 0 && (
        <div style={chipsRowStyle}>
          {c.error_categories.map((cat) => (
            <span key={cat} style={chipStyle}>{cat.replace(/_/g, " ")}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function filterByFrequency(corrections: GrammarCorrection[], freq: string): GrammarCorrection[] {
  if (freq === "every") return corrections;
  if (freq === "every_3") return corrections.filter((_, i) => i % 3 === 0);
  if (freq === "every_5") return corrections.filter((_, i) => i % 5 === 0);
  // "major_errors_only" (or any fallthrough): keep corrections that have categorized errors.
  return corrections.filter((c) => c.error_categories.length > 0);
}

const inlinePanelStyle: React.CSSProperties = {
  width: 280,
  borderLeft: "1px solid var(--sp-border)",
  padding: "0.85rem",
  overflowY: "auto",
  flexShrink: 0,
  height: "100%",
  background: "var(--sp-bg-2)",
  color: "var(--sp-fg)",
};

// Right-docked panel like ChatControlsPanel — fixed to right edge, 360px
// wide, full viewport height. Box-shadow softens the boundary against
// the darkened backdrop. Explicit maxHeight + overflowY:auto + minHeight:0
// so the inner scroll engages when corrections list grows past the
// viewport.
const overlayPanelStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  width: 360,
  maxWidth: "100%",
  // border-box so the 1rem padding is inside the 360 / maxWidth:100% width —
  // content-box let the panel render ~392px and spill off a 375px viewport.
  boxSizing: "border-box",
  zIndex: 56,
  padding: "1rem",
  maxHeight: "100vh",
  overflowY: "auto",
  minHeight: 0,
  background: "var(--sp-bg-2)",
  borderLeft: "1px solid var(--sp-border)",
  boxShadow: "-12px 0 32px rgba(0, 0, 0, 0.4)",
  color: "var(--sp-fg)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "0.25rem",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--sp-fg)",
  fontWeight: 600,
  fontSize: "1rem",
};

// Mini count pill — the seed's "mini per-Conversation summary" affordance.
// Accent = `--char-accent` (the conversation's character accent) so the
// panel reads as part of the chat, matching the inline correction row.
const countPillStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "var(--char-accent)",
  background: "var(--sp-bg-3)",
  border: "1px solid var(--sp-border-soft)",
  borderRadius: 999,
  padding: "0.05rem 0.45rem",
  lineHeight: 1.6,
};

const closeBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--sp-fg-2)",
  fontSize: "1.2rem",
  cursor: "pointer",
  padding: "0 0.35rem",
  lineHeight: 1,
};

const summaryStyle: React.CSSProperties = {
  margin: "0 0 0.75rem",
  fontSize: "0.78rem",
  color: "var(--sp-fg-3)",
};

// flex column (not grid): a single-column `display:grid` expands to the
// widest child's intrinsic width and won't shrink, overflowing the panel
// on a long unbreakable word — a pattern this project has been bitten by
// twice (cycles 0075, 0108). flex column + minWidth:0 + overflow-wrap
// keeps long corrections inside the panel.
const cardListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const cardStyle: React.CSSProperties = {
  background: "var(--sp-bg-3)",
  border: "1px solid var(--sp-border-soft)",
  borderRadius: "var(--sp-radius)",
  padding: "0.6rem 0.7rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.3rem",
  minWidth: 0,
  overflowWrap: "break-word",
};

const originalLineStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  color: "var(--sp-fg-3)",
  lineHeight: 1.45,
};

const removedTokenStyle: React.CSSProperties = {
  textDecoration: "line-through",
  color: "var(--sp-fg-4)",
};

const correctedLineStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "var(--sp-fg)",
  lineHeight: 1.5,
};

// Changed/added words pop in the conversation's `--char-accent` — same
// convention as GrammarInlineRow, so the correction reads as part of the chat.
const addedTokenStyle: React.CSSProperties = {
  color: "var(--char-accent)",
  fontWeight: 600,
};

const whyStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  color: "var(--sp-fg-3)",
  lineHeight: 1.45,
  marginTop: "0.05rem",
};

const whyLabelStyle: React.CSSProperties = {
  textTransform: "uppercase",
  fontSize: "0.62rem",
  fontWeight: 700,
  letterSpacing: "var(--sp-tracking-caps)",
  color: "var(--sp-fg-4)",
  marginRight: "0.15rem",
};

const chipsRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.25rem",
  marginTop: "0.1rem",
};

const chipStyle: React.CSSProperties = {
  fontSize: "0.66rem",
  color: "var(--sp-fg-3)",
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border-soft)",
  borderRadius: 999,
  padding: "0.05rem 0.4rem",
  whiteSpace: "nowrap",
};

const clearBtnStyle: React.CSSProperties = {
  marginTop: "1rem",
  fontSize: "0.85em",
  padding: "0.4rem 0.9rem",
  background: "transparent",
  border: "1px solid var(--sp-destructive)",
  borderRadius: "var(--sp-radius)",
  color: "var(--sp-destructive)",
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
};
