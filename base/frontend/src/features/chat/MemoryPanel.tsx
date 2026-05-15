import { useEffect, useState } from "react";
import { FileText, Heart, Lock, Pin, Play, Trash2, X, Zap } from "lucide-react";
import {
  clearMemoryForConversation,
  deleteMemoryChunk,
  listMemoryForConversation,
  type MemoryChunkRow,
} from "../../lib/memory";
import { Icon } from "../../lib/Icon";
import { panelBackBtnStyle, panelTitleStyle } from "./panelStyles";
import { Spinner } from "../../lib/Spinner";

type Props = {
  conversationId: string;
  onBack: () => void;
  onChanged: (count: number) => void;
};

type LucideIcon = typeof Zap;

const TOPIC_ICONS: Record<string, LucideIcon> = {
  event: Zap,
  action: Play,
  promise: Lock,
  fact: Pin,
  relationship: Heart,
};

function topicIcon(topic: string): LucideIcon {
  return TOPIC_ICONS[topic.toLowerCase().trim()] ?? FileText;
}

export function MemoryPanel({ conversationId, onBack, onChanged }: Props) {
  const [chunks, setChunks] = useState<MemoryChunkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMemoryForConversation(conversationId)
      .then((list) => { if (!cancelled) { setChunks(list); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [conversationId]);

  async function onDelete(chunkId: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteMemoryChunk(chunkId);
      const next = chunks.filter((c) => c.id !== chunkId);
      setChunks(next);
      onChanged(next.length);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onClearAll() {
    if (chunks.length === 0) return;
    const ok = window.confirm(
      `Delete all ${chunks.length} remembered fact${chunks.length === 1 ? "" : "s"} for this conversation? This cannot be undone.`,
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await clearMemoryForConversation(conversationId);
      setChunks([]);
      onChanged(0);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside data-testid="memory-panel" style={panelStyle}>
      <header style={headerStyle}>
        <button type="button" onClick={onBack} data-testid="memory-panel-back" style={panelBackBtnStyle}>← Back</button>
        <h3 style={panelTitleStyle}>
          Memory {loading ? "" : `· ${chunks.length}`}
        </h3>
      </header>

      <p style={{ color: "var(--sp-fg-3)", fontSize: "0.85rem", margin: 0 }}>
        Auto-extracted facts, actions, events, promises, and relationships from this conversation. These are injected as retrieved memory at chat time.
      </p>

      {error && (
        <div data-testid="memory-panel-error" role="alert" style={errStyle}>{error}</div>
      )}

      {loading ? (
        <Spinner testId="memory-panel-loading" />
      ) : chunks.length === 0 ? (
        <div style={{ color: "var(--sp-fg-3)", fontStyle: "italic", padding: "1rem 0" }}>
          No memories extracted yet. They'll appear automatically every few turns while memory is enabled.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.4rem" }}>
          {chunks.map((c) => (
            <li
              key={c.id}
              data-testid={`memory-chunk-${c.id}`}
              style={chunkRowStyle}
            >
              <span style={badgeStyle} title={c.topic}>
                <Icon icon={topicIcon(c.topic)} size={11} aria-hidden />
                {" "}{c.topic}
              </span>
              <span style={{ flex: 1, fontSize: "0.9rem", lineHeight: 1.35 }}>{c.text}</span>
              <button
                type="button"
                data-testid={`memory-delete-${c.id}`}
                onClick={() => onDelete(c.id)}
                disabled={busy}
                style={deleteBtnStyle}
                title="Delete this memory"
                aria-label="Delete this memory"
              >
                <Icon icon={X} size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {chunks.length > 0 && (
        <button
          type="button"
          data-testid="memory-clear-all"
          onClick={onClearAll}
          disabled={busy}
          style={clearAllStyle}
        >
          <Icon icon={Trash2} size={14} style={{ marginRight: "0.4rem" }} />
          Clear all memory for this conversation
        </button>
      )}
    </aside>
  );
}

const panelStyle: React.CSSProperties = {
  position: "relative", display: "grid", gap: "0.6rem",
  // alignContent:start — keep rows content-sized; height:100% would otherwise
  // stretch them (cycle 0133, same fix as the sibling panels).
  alignContent: "start",
  padding: "1rem", background: "var(--sp-bg-2)",
  borderLeft: "1px solid var(--sp-border)",
  color: "var(--sp-fg)",
  width: 420, height: "100%", overflowY: "auto",
};

const headerStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.75rem",
};

const chunkRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: "0.5rem",
  padding: "0.6rem 0.7rem",
  border: "1px solid var(--sp-border-soft)",
  borderRadius: "var(--sp-radius)",
  background: "var(--sp-bg-3)",
  color: "var(--sp-fg)",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.7rem",
  padding: "0.15rem 0.55rem",
  border: "1px solid var(--sp-border-soft)",
  borderRadius: "var(--sp-radius)",
  background: "var(--sp-bg-2)",
  color: "var(--sp-fg-2)",
  whiteSpace: "nowrap",
  textTransform: "lowercase",
  lineHeight: 1.2,
  fontWeight: 600,
};

const deleteBtnStyle: React.CSSProperties = {
  background: "transparent", border: "none", color: "var(--sp-fg-3)",
  cursor: "pointer", fontSize: "1.1rem", padding: "0 0.35rem",
};

const clearAllStyle: React.CSSProperties = {
  marginTop: "0.5rem",
  padding: "0.5rem 0.9rem",
  border: "1px solid var(--sp-destructive)",
  borderRadius: "var(--sp-radius)",
  background: "transparent",
  color: "var(--sp-destructive)",
  fontWeight: 600, fontFamily: "inherit", fontSize: "0.85em",
  cursor: "pointer",
};

const errStyle: React.CSSProperties = {
  padding: "0.55rem 0.85rem",
  border: "1px solid var(--sp-destructive)",
  borderRadius: "var(--sp-radius)",
  background: "var(--sp-destructive-soft)",
  color: "var(--sp-destructive)",
};
