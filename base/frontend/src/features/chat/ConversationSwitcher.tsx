import { useState } from "react";
import { List } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../lib/Icon";
import type { Character } from "../../lib/characters";
import {
  createConversationFromCharacter,
  deleteConversation,
  type Conversation,
} from "../../lib/conversations";

export function ConversationSwitcher({
  character,
  active,
  conversations,
  userId,
  onChange,
  compact = false,
}: {
  character: Character;
  active: Conversation;
  conversations: Conversation[];
  userId: string;
  onChange: (next: Conversation[]) => void;
  compact?: boolean;
}) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onNew() {
    setOpen(false);
    setError(null);
    try {
      const conv = await createConversationFromCharacter(userId, character);
      onChange([conv, ...conversations]);
      nav(`/chat/${character.id}/${conv.id}`);
    } catch (err) {
      setError(String(err));
    }
  }

  async function onDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    setError(null);
    try {
      await deleteConversation(id);
    } catch (err) {
      setError(String(err));
      return;
    }
    const next = conversations.filter((c) => c.id !== id);
    onChange(next);
    if (id !== active.id) return;
    nav(next.length ? `/chat/${character.id}/${next[0].id}` : `/characters`);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="switcher-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={compact ? `Conversations (current: ${active.title})` : undefined}
        title={compact ? active.title : undefined}
        style={compact
          ? {
              ...toggleBaseStyle,
              width: 36,
              height: 36,
              padding: 0,
              fontSize: "1rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              // Mobile/compact: drop the visible border so this button
              // matches the other ghost-icon affordances in the chat
              // header (keyboard, edit, more). The border-shape only
              // makes sense for the labeled desktop pill below.
              border: "1px solid transparent",
            }
          : {
              ...toggleBaseStyle,
              padding: "0.35rem 0.75rem",
              maxWidth: 200,
            }}
      >
        {compact ? <Icon icon={List} size={17} /> : `${active.title} ▾`}
      </button>
      {open && (
        <div data-testid="switcher-panel" style={panelStyle}>
          <button
            type="button"
            data-testid="switcher-new"
            onClick={onNew}
            style={newBtnStyle}
          >
            + New conversation
          </button>
          {conversations.map((c) => {
            const isActive = c.id === active.id;
            return (
              <div key={c.id} style={rowStyle(isActive)}>
                <button
                  type="button"
                  data-testid={`switcher-row-${c.id}`}
                  onClick={() => { setOpen(false); nav(`/chat/${character.id}/${c.id}`); }}
                  style={rowTitleBtnStyle}
                >
                  <div style={{ color: "var(--sp-fg)", fontSize: "0.9em" }}>{c.title}</div>
                  <small style={{ color: "var(--sp-fg-3)" }}>{c.message_count} msgs</small>
                </button>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  data-testid={`switcher-delete-${c.id}`}
                  onClick={(e) => onDelete(e, c.id)}
                  style={deleteBtnStyle}
                >
                  ×
                </button>
              </div>
            );
          })}
          {error && (
            <p role="alert" style={{ color: "var(--sp-destructive)", padding: "0.25rem 0.75rem", margin: 0, fontSize: "0.85em" }}>{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

const toggleBaseStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  color: "var(--sp-fg-2)",
  fontFamily: "inherit",
  fontSize: "0.85em",
  cursor: "pointer",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  transition: "border-color 120ms var(--sp-ease), color 120ms var(--sp-ease)",
};

const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  right: 0,
  minWidth: 240,
  marginTop: 4,
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  boxShadow: "var(--sp-shadow-md)",
  padding: 4,
  display: "flex",
  flexDirection: "column",
  gap: 2,
  zIndex: 10,
};

const newBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "0.5rem 0.75rem",
  background: "transparent",
  border: "none",
  borderRadius: "var(--sp-radius)",
  color: "var(--sp-fg)",
  fontFamily: "inherit",
  fontSize: "0.9em",
  fontWeight: 600,
  cursor: "pointer",
};

function rowStyle(isActive: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    padding: "4px 8px",
    gap: 4,
    background: isActive ? "var(--sp-bg-3)" : "transparent",
    borderRadius: "var(--sp-radius)",
  };
}

const rowTitleBtnStyle: React.CSSProperties = {
  flex: 1,
  textAlign: "left",
  padding: "0.25rem 0.25rem",
  background: "transparent",
  border: "none",
  borderRadius: "var(--sp-radius)",
  fontFamily: "inherit",
  cursor: "pointer",
};

const deleteBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--sp-fg-4)",
  cursor: "pointer",
  fontSize: "1rem",
  padding: "0 0.5rem",
};
