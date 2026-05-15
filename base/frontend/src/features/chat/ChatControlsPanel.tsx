import { useEffect, useState } from "react";
import {
  BookMarked,
  Brain,
  Bug,
  ChevronRight,
  Clapperboard,
  Image as ImageIcon,
  NotebookPen,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "../../lib/Icon";
import { loadChatControlsState, type ChatControlsState } from "../../lib/chatControlsState";
import { labelForPreset } from "../../lib/images";
import { listLorebookForConversation } from "../../lib/lorebook";
import { listMemoryForConversation } from "../../lib/memory";
import { loadAuthorsNote, type AuthorsNote } from "../../lib/notes";
import { AuthorsNoteEditor } from "./AuthorsNoteEditor";
import { GenerationOverridePanel } from "./GenerationOverridePanel";
import { LorebookPanel } from "./LorebookPanel";
import { MemoryPanel } from "./MemoryPanel";
import { panelTitleStyle } from "./panelStyles";

type View = "root" | "lorebook" | "notes" | "generation" | "memory";

type Props = {
  conversationId: string;
  userId: string;
  onClose: () => void;
  onNoteChanged: (note: AuthorsNote | null) => void;
  // "modal" (default): fixed overlay with backdrop, for S/M breakpoints.
  // "inline": flex sibling rendered in-flow next to the feed, for L.
  mode?: "modal" | "inline";
};

export function ChatControlsPanel({ conversationId, userId, onClose, onNoteChanged, mode = "modal" }: Props) {
  const [view, setView] = useState<View>("root");
  const [loreCount, setLoreCount] = useState(0);
  const [memCount, setMemCount] = useState(0);
  const [note, setNote] = useState<AuthorsNote | null>(null);
  const [genOverride, setGenOverride] = useState<ChatControlsState | null>(null);

  useEffect(() => {
    listLorebookForConversation(conversationId).then((list) => setLoreCount(list.length));
    listMemoryForConversation(conversationId).then((list) => setMemCount(list.length)).catch(() => setMemCount(0));
    loadAuthorsNote(conversationId).then((n) => setNote(n));
    loadChatControlsState(conversationId).then((s) => setGenOverride(s)).catch(() => setGenOverride(null));
  }, [conversationId]);

  const genSubtitle = genOverride && (genOverride.image_provider_override_id || genOverride.resolution_preset)
    ? `Active: ${[
        genOverride.image_provider_override_id ? "custom provider" : null,
        genOverride.resolution_preset ? labelForPreset(genOverride.resolution_preset) : null,
      ].filter(Boolean).join(" · ")}`
    : "Per-conversation image/video provider overrides";

  return (
    <div data-testid="chat-controls-panel" data-mode={mode} style={mode === "inline" ? inlineWrapStyle : overlayStyle}>
      {mode === "modal" && <div onClick={onClose} style={backdropStyle} />}
      {view === "root" && (
        <aside style={panelStyle}>
          <header style={headerStyle}>
            <h3 style={panelTitleStyle}>Chat Controls</h3>
            <button type="button" onClick={onClose} data-testid="controls-close" style={closeBtnStyle} aria-label="Close chat controls">
              <Icon icon={X} size={18} />
            </button>
          </header>
          <Row
            testid="controls-notes"
            icon={NotebookPen}
            title="Author's Notes"
            subtitle={note?.notes_text ? note.notes_text.slice(0, 60) + (note.notes_text.length > 60 ? "…" : "") : "Guide the story direction"}
            onClick={() => setView("notes")}
          />
          <Row
            testid="controls-lorebook"
            icon={BookMarked}
            title="Lorebook"
            subtitle={`${loreCount} ${loreCount === 1 ? "entry" : "entries"}`}
            onClick={() => setView("lorebook")}
          />
          <Row
            testid="controls-memory"
            icon={Brain}
            title="Memory"
            subtitle={`${memCount} ${memCount === 1 ? "fact" : "facts"} remembered`}
            onClick={() => setView("memory")}
          />
          <Row
            testid="controls-generation"
            icon={ImageIcon}
            title="Generation overrides"
            subtitle={genSubtitle}
            onClick={() => setView("generation")}
          />
          <div style={{ height: 1, background: "var(--sp-border-soft)", margin: "0.5rem 0" }} />
          <Disabled icon={Clapperboard} title="Autopilot" hint="Lands with the Autopilot cycle" />
          <Disabled icon={Volume2} title="Auto TTS" hint="Ships with the TTS cycle" />
          <Disabled icon={Bug} title="Debug Mode" hint="Ships with a later cycle" />
        </aside>
      )}
      {view === "lorebook" && (
        <LorebookPanel
          conversationId={conversationId}
          userId={userId}
          onBack={() => setView("root")}
          onChanged={setLoreCount}
        />
      )}
      {view === "notes" && (
        <AuthorsNoteEditor
          conversationId={conversationId}
          userId={userId}
          onBack={() => setView("root")}
          onChanged={(n) => { setNote(n); onNoteChanged(n); }}
        />
      )}
      {view === "generation" && (
        <GenerationOverridePanel
          conversationId={conversationId}
          userId={userId}
          onBack={() => setView("root")}
          onChanged={setGenOverride}
        />
      )}
      {view === "memory" && (
        <MemoryPanel
          conversationId={conversationId}
          onBack={() => setView("root")}
          onChanged={setMemCount}
        />
      )}
    </div>
  );
}

// 28×28 token tile holding the row's Lucide glyph — mirrors the Settings
// screen's row pattern (cycle 0074) so the panel reads as part of the app.
function IconTile({ icon }: { icon: LucideIcon }) {
  return (
    <span style={iconTileStyle}>
      <Icon icon={icon} size={16} />
    </span>
  );
}

function Row({ testid, icon, title, subtitle, onClick }: { testid: string; icon: LucideIcon; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button type="button" data-testid={testid} onClick={onClick} style={rowStyle}>
      <IconTile icon={icon} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ color: "var(--sp-fg)", fontWeight: 600 }}>{title}</strong>
        <div style={{ color: "var(--sp-fg-3)", fontSize: "0.85em" }}>{subtitle}</div>
      </div>
      <Icon icon={ChevronRight} size={16} />
    </button>
  );
}

// Placeholder for a not-yet-shipped surface. The whole row dims (not just the
// icon) so it reads unambiguously as "coming later" rather than a live but
// muted control.
function Disabled({ icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  return (
    <div title={hint} style={{ ...rowStyle, cursor: "not-allowed", opacity: 0.5 }}>
      <IconTile icon={icon} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ color: "var(--sp-fg-2)", fontWeight: 600 }}>{title}</strong>
        <div style={{ color: "var(--sp-fg-3)", fontSize: "0.85em" }}>{hint}</div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, display: "flex", justifyContent: "flex-end", zIndex: 50,
};
const inlineWrapStyle: React.CSSProperties = {
  display: "flex", justifyContent: "flex-end", flexShrink: 0, height: "100%",
};
const backdropStyle: React.CSSProperties = {
  position: "absolute", inset: 0, background: "var(--sp-overlay)",
};
const panelStyle: React.CSSProperties = {
  position: "relative",
  display: "flex", flexDirection: "column", gap: "0.5rem",
  padding: "1rem", background: "var(--sp-bg-2)",
  borderLeft: "1px solid var(--sp-border)",
  // Subtle shadow on the left edge softens the boundary against the
  // darkened backdrop so the panel reads as a lifted drawer rather
  // than a hard-cut column.
  boxShadow: "-12px 0 32px rgba(0, 0, 0, 0.4)",
  color: "var(--sp-fg)",
  width: 360, maxWidth: "100%",
  // Explicit viewport-height bound + overflowY:auto + minHeight:0 so
  // the panel can shrink below its content height and the inner
  // scroll engages reliably (height:100% inside a flex parent doesn't
  // always resolve, leaving the drawer un-scrollable).
  height: "100vh",
  maxHeight: "100vh",
  overflowY: "auto",
  minHeight: 0,
};
const headerStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
};
const closeBtnStyle: React.CSSProperties = {
  background: "transparent", border: "none", color: "var(--sp-fg-2)",
  cursor: "pointer", padding: "0.25rem", lineHeight: 0,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.75rem",
  padding: "0.75rem", textAlign: "left",
  border: "1px solid var(--sp-border)", borderRadius: "var(--sp-radius)",
  background: "var(--sp-bg-2)",
  color: "var(--sp-fg)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "inherit",
};
const iconTileStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 28, height: 28, flexShrink: 0,
  borderRadius: "var(--sp-radius-sm)",
  background: "var(--sp-bg-3)", color: "var(--sp-fg-2)",
};
