import { SkeletonMessages } from "./SkeletonMessages";

// Full chat-shell silhouette for the Phase 1 loading state in Chat.tsx
// (character + conversation still resolving). Mirrors the layout of
// ChatShell so when the real shell mounts the transition is a content
// swap with zero reflow — header avatar/title slide into the same slot,
// composer pill stays anchored, ghost bubbles persist until messages
// resolve and MessageFeed takes over from SkeletonMessages.

const rootStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: "var(--sp-bg)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px",
  borderBottom: "1px solid var(--sp-border-soft)",
  flexShrink: 0,
};

const headerAvatarStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  flexShrink: 0,
};

const headerNameLineStyle: React.CSSProperties = {
  height: 16,
  width: 140,
  borderRadius: 6,
};

const headerTaglineStyle: React.CSSProperties = {
  height: 11,
  width: 280,
  maxWidth: "70%",
  borderRadius: 6,
  marginTop: 6,
};

const headerActionStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  marginLeft: "auto",
  flexShrink: 0,
};

const composerWrapStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderTop: "1px solid var(--sp-border-soft)",
  flexShrink: 0,
};

const composerPillStyle: React.CSSProperties = {
  height: 44,
  width: "100%",
  borderRadius: 22,
};

export function ChatShellSkeleton({ testId }: { testId?: string }) {
  return (
    <main role="status" aria-label="Loading chat" data-testid={testId} style={rootStyle}>
      <header style={headerStyle} aria-hidden>
        <div className="sp-skeleton" style={headerAvatarStyle} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div className="sp-skeleton" style={headerNameLineStyle} />
          <div className="sp-skeleton" style={headerTaglineStyle} />
        </div>
        <div className="sp-skeleton" style={headerActionStyle} />
      </header>

      <SkeletonMessages />

      <footer style={composerWrapStyle} aria-hidden>
        <div className="sp-skeleton" style={composerPillStyle} />
      </footer>
    </main>
  );
}
