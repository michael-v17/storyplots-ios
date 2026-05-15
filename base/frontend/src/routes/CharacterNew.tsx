import { Link } from "react-router-dom";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function CharacterNew() {
  useDocumentTitle("New Character");
  return (
    <main data-testid="character-new-picker" style={mainStyle}>
      <h1 className="sp-h2 sp-wordmark sp-page-h1" style={{ margin: "0 0 0.5rem" }}>New Character</h1>
      <p style={{ color: "var(--sp-fg-3)", margin: "0 0 1.25rem" }}>Pick a creation method.</p>

      <Link to="/character/new/ai-generate" data-testid="row-ai" style={rowStyle}>
        <div style={iconStyle}>✨</div>
        <div style={{ flex: 1 }}>
          <strong style={titleStyle}>AI Generate</strong>
          <div style={subtitleStyle}>
            Describe an idea and let AI generate a complete character. Drama, tone, SFW/NSFW knobs.
          </div>
        </div>
        <span style={chevronStyle}>›</span>
      </Link>

      <Link to="/character/new/manual" data-testid="row-manual" style={rowStyle}>
        <div style={iconStyle}>✏️</div>
        <div style={{ flex: 1 }}>
          <strong style={titleStyle}>Manual</strong>
          <div style={subtitleStyle}>Create your character with a form.</div>
        </div>
        <span style={chevronStyle}>›</span>
      </Link>

      <Link to="/character/new/import" data-testid="row-import" style={rowStyle}>
        <div style={iconStyle}>⬇</div>
        <div style={{ flex: 1 }}>
          <strong style={titleStyle}>Import</strong>
          <div style={subtitleStyle}>
            Import from TavernAI / SillyTavern / Chub.ai (JSON or PNG, V1 &amp; V2).
          </div>
        </div>
        <span style={chevronStyle}>›</span>
      </Link>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  maxWidth: 560,
  margin: "2rem auto",
  padding: "0 1rem",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.85rem",
  padding: "1rem 1.25rem",
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  marginBottom: "0.75rem",
  textDecoration: "none",
  color: "var(--sp-fg)",
  cursor: "pointer",
  transition: "border-color 160ms var(--sp-ease), background 160ms var(--sp-ease)",
};

const iconStyle: React.CSSProperties = {
  fontSize: "1.4em",
  lineHeight: 1,
  flexShrink: 0,
  marginTop: 2,
};

const titleStyle: React.CSSProperties = {
  color: "var(--sp-fg)",
  fontWeight: 600,
  display: "block",
  marginBottom: 2,
};

const subtitleStyle: React.CSSProperties = {
  color: "var(--sp-fg-3)",
  fontSize: "0.9em",
  lineHeight: 1.45,
};

const chevronStyle: React.CSSProperties = {
  color: "var(--sp-fg-4)",
  fontSize: "1.25rem",
  lineHeight: 1,
  alignSelf: "center",
  flexShrink: 0,
};
