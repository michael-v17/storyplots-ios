// Ghost message-bubble feed for the messages-loading state.
// Matches the actual MessageBubble silhouette (assistant pill 14-radius
// vs user pill 999-radius, 32px round avatar on assistant side, plus the
// 40×40 circular action-rail chips under each assistant bubble) so the
// transition into real content is shape-stable — no rail pop-in.
// Shimmer comes from the shared `.sp-skeleton` class.
//
// Bottom-anchored on purpose: chat feeds auto-scroll to the latest
// message, so the ghost bubbles cluster at the bottom of the available
// space to land where the real "recent messages" will sit. This kills
// the layout jump when MessageFeed swaps in.

const wrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  gap: "1rem",
  padding: "1rem",
  flex: 1,
  minHeight: 0,
};

const assistantRowStyle: React.CSSProperties = {
  display: "flex",
  width: "100%",
  justifyContent: "flex-start",
  alignItems: "flex-start",
  gap: 8,
};

const assistantColStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minWidth: 0,
};

const userRowStyle: React.CSSProperties = {
  display: "flex",
  width: "100%",
  justifyContent: "flex-end",
};

const avatarStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  flexShrink: 0,
};

const assistantBubbleStyle: React.CSSProperties = {
  borderRadius: 14,
  height: 64,
  maxWidth: "70%",
  width: "60%",
};

const userBubbleStyle: React.CSSProperties = {
  borderRadius: 999,
  height: 36,
  maxWidth: "55%",
  width: "40%",
};

const shortAssistantBubbleStyle: React.CSSProperties = {
  borderRadius: 14,
  height: 44,
  maxWidth: "60%",
  width: "45%",
};

// Mirrors actionRailRowStyle + railBtnStyle in MessageBubble — 40×40
// circular chips, gap 8, marginTop 6.
const railRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 6,
};

const railChipStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  flexShrink: 0,
};

function AssistantGhost({ bubbleStyle }: { bubbleStyle: React.CSSProperties }) {
  return (
    <div style={assistantRowStyle}>
      <div className="sp-skeleton" style={avatarStyle} aria-hidden />
      <div style={assistantColStyle}>
        <div className="sp-skeleton" style={bubbleStyle} aria-hidden />
        <div style={railRowStyle} aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="sp-skeleton" style={railChipStyle} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonMessages({ testId }: { testId?: string }) {
  return (
    <section
      role="status"
      aria-label="Loading messages"
      data-testid={testId}
      style={wrapStyle}
    >
      <AssistantGhost bubbleStyle={assistantBubbleStyle} />
      <div style={userRowStyle}>
        <div className="sp-skeleton" style={userBubbleStyle} aria-hidden />
      </div>
      <AssistantGhost bubbleStyle={shortAssistantBubbleStyle} />
      <div style={userRowStyle}>
        <div className="sp-skeleton" style={{ ...userBubbleStyle, width: "30%" }} aria-hidden />
      </div>
    </section>
  );
}
