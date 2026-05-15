import { useCallback, useEffect, useRef, useState } from "react";
import { GitFork, ImagePlus, RotateCw } from "lucide-react";
import { accentTextColor } from "../../lib/accentTextColor";
import { Icon } from "../../lib/Icon";
import type { GeneratedImage } from "../../lib/images";
import type { Message, MessageVariant } from "../../lib/messages";
import { useIsMobile } from "../../lib/useIsMobile";
import { useLongPress } from "../../lib/useLongPress";
import { MessageAudioButton } from "./MessageAudioButton";
import { MessageAvatar } from "./MessageAvatar";
import { MessageContextMenu, type ContextMenuItem } from "./MessageContextMenu";
import { MessageImage, MessageImageSkeleton } from "./MessageImage";
import { TypographicText } from "./TypographicText";

type Props = {
  message: Message;
  // For assistant messages: the full variant list (used for the <N/M> counter)
  // plus the currently-displayed variant's content. For user messages, pass empty list.
  variants: MessageVariant[];
  displayedContent: string;
  accentColor: string;
  characterName: string;
  characterAvatarRef: string | null;
  userName: string;
  userAvatarRef: string | null;
  images: GeneratedImage[];
  imageGenerating: boolean;
  isStreaming: boolean;              // this bubble's own variant is the in-flight one
  anyStreamActive: boolean;          // some other (or this) stream is in flight — disables all mutations
  canRegenerate: boolean;
  streamError: string | null;
  onEditRequest: (message: Message) => void;
  onDelete: (message: Message) => void;
  onRegenerate: (message: Message) => void;
  onSelectVariant: (message: Message, variantId: string) => void;
  onFork: (message: Message) => void;
  onGenerateImage: (message: Message) => void;
  onOpenImage: (image: GeneratedImage) => void;
  imageEnabled?: boolean;
  // True for the auto-inserted greeting (first assistant message of a
  // conversation). Regenerate / Fork / Generate image / TTS controls do
  // not apply to a seed text with no user turn behind it.
  isGreeting?: boolean;
};

export function MessageBubble(props: Props) {
  const { message, variants, displayedContent, accentColor, characterName, characterAvatarRef, images, imageGenerating, isStreaming, anyStreamActive, canRegenerate, streamError } = props;
  const isUser = message.role === "user";
  const isMobile = useIsMobile();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // Stable onClose identity so the MessageContextMenu's useEffect doesn't
  // rebind its pointerdown / keydown listeners on every parent render
  // (unstable refs caused race windows where outside-clicks were missed).
  const closeMenu = useCallback(() => setMenu(null), []);

  // Right-click (desktop) or long-press (mobile) on user bubbles opens a
  // mini menu with Edit / Delete / Fork. Inline user-action buttons are
  // dropped to keep the feed clean.
  const longPress = useLongPress((x, y) => { if (!anyStreamActive) setMenu({ x, y }); });
  const userMenuItems: ContextMenuItem[] = [
    { label: "✎ Edit", testid: `ctx-edit-${message.id}`,
      onClick: () => props.onEditRequest(message), disabled: anyStreamActive },
    { label: "⑂ Fork from here", testid: `ctx-fork-${message.id}`,
      onClick: () => props.onFork(message), disabled: anyStreamActive },
    { label: "🗑 Delete", testid: `ctx-delete-${message.id}`, destructive: true,
      onClick: () => props.onDelete(message), disabled: anyStreamActive },
  ];

  const activeIdx = variants.findIndex((v) => v.id === message.active_variant_id);
  const hasManyVariants = variants.length > 1;

  function stepVariant(delta: number) {
    if (!hasManyVariants) return;
    const n = variants.length;
    const next = (activeIdx + delta + n) % n;
    props.onSelectVariant(message, variants[next].id);
  }

  // UX contract committed this session:
  // - User messages (right side): no avatar, no name — plain bubble only.
  // - Assistant messages (left): show character avatar on DESKTOP only.
  //   Mobile keeps the left margin clean; the character identity lives
  //   in the header.
  const showAssistantAvatar = !isUser && !isMobile;

  return (
    <div
      data-testid={`msg-${message.id}`}
      data-role={message.role}
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
        gap: "0.5rem",
        margin: "0.5rem 0",
      }}
    >
      {showAssistantAvatar && (
        <MessageAvatar
          role="assistant"
          avatarRef={characterAvatarRef}
          accentColor={accentColor}
          name={characterName}
        />
      )}
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        flex: 1, minWidth: 0,
      }}>
      {!isUser && hasManyVariants && (
        <div data-testid={`variant-counter-${message.id}`} style={{ fontSize: "0.75em", color: "var(--sp-fg-3)", display: "flex", gap: "0.35rem", alignItems: "center", marginBottom: "0.3rem" }}>
          <button type="button" data-testid={`variant-prev-${message.id}`} onClick={() => stepVariant(-1)} style={variantStepBtn}>‹</button>
          <span>{activeIdx + 1}/{variants.length}</span>
          <button type="button" data-testid={`variant-next-${message.id}`} onClick={() => stepVariant(1)} style={variantStepBtn}>›</button>
        </div>
      )}

      <div
        data-testid={`bubble-${message.id}`}
        onContextMenu={isUser ? (e) => { if (!anyStreamActive) { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); } } : undefined}
        {...(isUser ? longPress : {})}
        style={isUser ? {
          maxWidth: "78%",
          padding: "10px 14px",
          borderRadius: "var(--sp-radius)",
          background: "linear-gradient(135deg, var(--char-accent) 0%, color-mix(in oklab, var(--char-accent) 80%, black) 100%)",
          color: accentTextColor(accentColor),
          cursor: "context-menu",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          fontSize: 15,
          lineHeight: 1.5,
        } : {
          maxWidth: "78%",
          padding: "12px 14px",
          borderRadius: "var(--sp-radius)",
          background: "var(--sp-bg-3)",
          color: "var(--sp-fg)",
          border: hasManyVariants ? "1px solid var(--char-accent-border)" : "1px solid var(--sp-border-soft)",
          boxShadow: hasManyVariants ? "0 0 24px -4px var(--char-accent-glow)" : "none",
          fontSize: 15,
          lineHeight: 1.6,
          transition: "border-color 200ms var(--sp-ease), box-shadow 200ms var(--sp-ease)",
        }}
      >
        {isStreaming && !displayedContent ? (
          <span
            data-testid={`streaming-caret-${message.id}`}
            aria-label="Typing…"
            style={{ display: "inline-flex", gap: 5, alignItems: "center", color: "var(--sp-fg-3)", padding: "2px 0" }}
          >
            <span className="sp-typing-dot" />
            <span className="sp-typing-dot" />
            <span className="sp-typing-dot" />
          </span>
        ) : !isUser && !isStreaming && streamError && displayedContent.trim().length === 0 ? (
          // Failed assistant turn: backend signaled stream error AND the
          // variant has no usable content. Replace the bubble body with
          // an inline error block so the user sees what failed instead
          // of an empty pill. (cycle 0123)
          <div
            data-testid={`stream-error-${message.id}`}
            role="alert"
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            <strong style={{ color: "var(--sp-destructive)", fontSize: 14 }}>
              Reply failed
            </strong>
            <span style={{ color: "var(--sp-fg-2)", fontSize: 13, lineHeight: 1.5 }}>
              {streamError}
            </span>
            <span style={{ color: "var(--sp-fg-3)", fontSize: 12 }}>
              Tap ↻ to regenerate.
            </span>
          </div>
        ) : (
          <>
            <TypographicText text={displayedContent} tone={isUser ? "on-accent" : "on-surface"} />
            {isStreaming && <span data-testid={`streaming-caret-${message.id}`} aria-hidden>▌</span>}
          </>
        )}
        {message.edited_at && (
          <small style={{ display: "block", color: "var(--sp-fg-4)", marginTop: "0.25rem", fontSize: "0.75em" }}>edited</small>
        )}
      </div>

      {/* Mid-stream errors (provider dropped after some text already
          rendered) still show below the bubble so the partial reply
          stays readable. Fully-empty errors are rendered inside the
          bubble above (see `stream-error-{id}` div). */}
      {streamError && displayedContent.trim().length > 0 && (
        <small data-testid={`stream-error-tail-${message.id}`} role="alert" style={{ color: "var(--sp-destructive)", marginTop: "0.25rem" }}>
          stream stopped — {streamError}
        </small>
      )}

      {/* Inline action rail: assistant-side only (regenerate / fork /
          generate image / play TTS). Circular 40×40 chips tinted with
          the per-character accent (Cycle 0071). Emoji-only; the hover
          title + aria-label carry the full action name. User-side
          actions live in the context menu (right-click or long-press). */}
      {!isUser && !props.isGreeting && (
        <div style={{ ...actionRailRowStyle, opacity: isStreaming ? 0 : 1, pointerEvents: isStreaming ? "none" : "auto", transition: "opacity 0.35s ease" }}>
          {canRegenerate && (
            <button
              type="button"
              data-testid={`msg-regenerate-${message.id}`}
              disabled={anyStreamActive}
              onClick={() => props.onRegenerate(message)}
              style={railBtnStyle(anyStreamActive)}
              title="Regenerate"
              aria-label="Regenerate"
            >
              <Icon icon={RotateCw} size={17} />
            </button>
          )}
          <button
            type="button"
            data-testid={`msg-fork-${message.id}`}
            disabled={anyStreamActive}
            onClick={() => props.onFork(message)}
            style={railBtnStyle(anyStreamActive)}
            title="Fork from here"
            aria-label="Fork from here"
          >
            <Icon icon={GitFork} size={17} />
          </button>
          {props.imageEnabled !== false && (
            <button
              type="button"
              data-testid={`msg-image-${message.id}-action`}
              disabled={anyStreamActive || imageGenerating}
              onClick={() => props.onGenerateImage(message)}
              style={railBtnStyle(anyStreamActive || imageGenerating)}
              title={imageGenerating ? "Generating image…" : "Generate an image from this reply"}
              aria-label="Generate an image from this reply"
            >
              <Icon icon={ImagePlus} size={17} />
            </button>
          )}
          <MessageAudioButton messageId={message.id} disabled={anyStreamActive} accent />
        </div>
      )}

      {menu && isUser && (
        <MessageContextMenu
          x={menu.x}
          y={menu.y}
          items={userMenuItems}
          onClose={closeMenu}
        />
      )}

      <ImageSlot
        messageId={message.id}
        images={images}
        imageGenerating={imageGenerating}
        onOpen={props.onOpenImage}
      />
      </div>
    </div>
  );
}

function ImageSlot({
  messageId, images, imageGenerating, onOpen,
}: {
  messageId: string;
  images: GeneratedImage[];
  imageGenerating: boolean;
  onOpen: (image: GeneratedImage) => void;
}) {
  // Local active-variant state per message.
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, images.length - 1));
  const prevLen = useRef(images.length);
  useEffect(() => {
    // When the array grows (regenerate appends), auto-advance to the newly-
    // generated image so the user doesn't have to click ›. When it shrinks
    // (delete), clamp down so we don't point past the end.
    if (images.length > prevLen.current) {
      setActiveIndex(images.length - 1);
    } else if (activeIndex >= images.length && images.length > 0) {
      setActiveIndex(images.length - 1);
    }
    prevLen.current = images.length;
  }, [images.length, activeIndex]);

  const clamped = images.length === 0 ? 0 : Math.min(activeIndex, images.length - 1);

  if (images.length === 0 && !imageGenerating) return null;

  // While generating, show the skeleton IN PLACE OF the current image (not
  // below) so the feed doesn't stretch out with the old image + a pending
  // slot. The stepper label hints that a new variant is on the way.
  if (imageGenerating) {
    const pretendTotal = images.length + 1;
    return (
      <div data-testid={`msg-images-${messageId}`} style={{ display: "grid", gap: "0.5rem" }}>
        {images.length > 0 && (
          <div data-testid={`image-stepper-loading-${messageId}`} style={{ fontSize: "0.75em", color: "var(--sp-fg-3)" }}>
            {pretendTotal}/{pretendTotal} · generating…
          </div>
        )}
        <MessageImageSkeleton />
      </div>
    );
  }

  return (
    <div data-testid={`msg-images-${messageId}`} style={{ display: "grid", gap: "0.5rem" }}>
      <MessageImage
        images={images}
        activeIndex={clamped}
        onStep={setActiveIndex}
        onOpen={onOpen}
      />
    </div>
  );
}

const actionRailRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 6,
  flexWrap: "wrap",
};

function railBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "var(--sp-bg-3)",
    border: "1px solid var(--sp-border-soft)",
    color: "var(--char-accent)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    lineHeight: 1,
    padding: 0,
    transition: "transform 120ms var(--sp-ease), opacity 120ms var(--sp-ease)",
  };
}

const variantStepBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--sp-fg-2)",
  cursor: "pointer",
  padding: "0 0.25rem",
  fontSize: "1em",
  lineHeight: 1,
};
