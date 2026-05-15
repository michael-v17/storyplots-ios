import { useEffect, useRef } from "react";
import { substituteCardPlaceholders } from "../../lib/conversations";
import type { GrammarCorrection } from "../../lib/grammar";
import type { GeneratedImage } from "../../lib/images";
import type { Message, MessageVariant } from "../../lib/messages";
import { GrammarInlineRow } from "./GrammarInlineRow";
import { MessageBubble } from "./MessageBubble";

type Props = {
  messages: Message[];
  variantsByMessage: Record<string, MessageVariant[]>;
  streamingMessageId: string | null;
  streamErrorByMessage: Record<string, string>;
  accentColor: string;
  characterName: string;
  characterAvatarRef: string | null;
  userName: string;
  userAvatarRef: string | null;
  imagesByMessage: Record<string, GeneratedImage[]>;
  imageGeneratingFor: string | null;
  onEditRequest: (message: Message) => void;
  onDelete: (message: Message) => void;
  onRegenerate: (message: Message) => void;
  onSelectVariant: (message: Message, variantId: string) => void;
  onFork: (message: Message) => void;
  onGenerateImage: (message: Message) => void;
  onOpenImage: (image: GeneratedImage) => void;
  imageEnabled?: boolean;
  scenario?: string | null;
  // Character's current greeting template — if empty/null, the creator
  // has removed the greeting from the character card; we hide any frozen
  // greeting bubble in the conversation to respect that intent. Greeting
  // is a live character-metadata template, not part of the conversation
  // snapshot (see CharacterSnapshot type in lib/conversations.ts).
  characterGreeting?: string | null;
  corrections: Record<string, GrammarCorrection>;
  grammarMode: "A" | "B";
};

export function MessageFeed(props: Props) {
  const { messages, variantsByMessage, streamingMessageId, streamErrorByMessage } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const mountedAtBottomRef = useRef(true);
  const lastId = messages[messages.length - 1]?.id;
  // Anchor the feed to the latest message on mount and whenever a new
  // message arrives. Double-rAF waits two frames so CSS layout (padding,
  // avatars, message heights) fully settles before measuring scrollHeight.
  // The 200ms fallback catches slow cases where fonts/avatars resolve late.
  useEffect(() => {
    if (!lastId) return;
    mountedAtBottomRef.current = true;
    const scrollToBottom = () => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToBottom);
    });
    const t = setTimeout(scrollToBottom, 200);
    return () => clearTimeout(t);
  }, [lastId]);

  // Stick-to-bottom while the user hasn't scrolled away. When images/
  // avatars resolve after the initial paint the content height grows —
  // without this observer the user would end up mid-feed on first open.
  // Threshold 120px so minor drift doesn't snap them back mid-read.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      mountedAtBottomRef.current = distanceFromBottom < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => {
      if (!mountedAtBottomRef.current) return;
      el.scrollTo({ top: el.scrollHeight });
    });
    ro.observe(el);
    Array.from(el.children).forEach((child) => ro.observe(child));

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [lastId]);

  // Regenerate is available on every assistant message while no stream is in
  // flight. For non-last assistants, ChatShell.onRegenerate prompts first and
  // trims everything after the target (rewind-in-place semantics). See
  // cycle 0016.2 in plans/.

  // Hide frozen greeting bubble if the creator has cleared the character's
  // greeting template. Effective list is what we actually render.
  const characterHasGreeting = !!props.characterGreeting && props.characterGreeting.trim().length > 0;
  const visibleMessages = messages.filter((m, i) => {
    const isGreeting = i === 0 && m.role === "assistant";
    return !(isGreeting && !characterHasGreeting);
  });
  const isEmpty = visibleMessages.length === 0;
  const testid = isEmpty ? "chat-feed-empty" : "chat-feed";

  return (
    <section ref={scrollRef} data-testid={testid} style={feedStyle}>
      {props.scenario && (
        <div data-testid="scenario-card" style={scenarioCardStyle}>
          <div style={scenarioHeaderRowStyle}>
            <span style={scenarioPillStyle}>Scenario</span>
            <span style={scenarioPillStyle}>{props.characterName}</span>
          </div>
          <div style={scenarioBodyStyle}>
            {substituteCardPlaceholders(props.scenario, props.userName, props.characterName)}
          </div>
        </div>
      )}
      {isEmpty && (
        <p style={{ color: "var(--sp-fg-3)", textAlign: "center", margin: props.scenario ? "1.5rem auto 0" : "auto" }}>
          {props.scenario
            ? "Send a message to begin."
            : "No messages yet. Send one to start the conversation."}
        </p>
      )}
      {visibleMessages.map((m, index) => {
        const variants = variantsByMessage[m.id] ?? [];
        let content = m.text ?? "";
        if (m.role === "assistant") {
          const active = variants.find((v) => v.id === m.active_variant_id);
          content = active?.content ?? "";
        }
        const correction = m.role === "user" ? props.corrections[m.id] : undefined;
        // Greeting = first assistant message (no user turn before it). It's
        // a seed text from the character card, not a reply to regenerate/fork.
        const isGreeting = index === 0 && m.role === "assistant";
        return (
          <div key={m.id} style={{ overflowAnchor: "none" }}>
            <MessageBubble
              message={m}
              variants={variants}
              displayedContent={content}
              accentColor={props.accentColor}
              characterName={props.characterName}
              characterAvatarRef={props.characterAvatarRef}
              userName={props.userName}
              userAvatarRef={props.userAvatarRef}
              images={props.imagesByMessage[m.id] ?? []}
              imageGenerating={props.imageGeneratingFor === m.id}
              isStreaming={streamingMessageId === m.id}
              anyStreamActive={streamingMessageId !== null}
              canRegenerate={!isGreeting && m.role === "assistant" && streamingMessageId === null}
              streamError={streamErrorByMessage[m.id] ?? null}
              onEditRequest={props.onEditRequest}
              onDelete={props.onDelete}
              onRegenerate={props.onRegenerate}
              onSelectVariant={props.onSelectVariant}
              onFork={props.onFork}
              onGenerateImage={props.onGenerateImage}
              onOpenImage={props.onOpenImage}
              imageEnabled={props.imageEnabled}
              isGreeting={isGreeting}
            />
            {correction && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <GrammarInlineRow correction={correction} mode={props.grammarMode} />
              </div>
            )}
          </div>
        );
      })}
      {/* Scroll anchor: browser keeps this 1px div visible as content grows above it,
          eliminating the programmatic-scrollTo jumps during streaming. */}
      <div data-testid="scroll-anchor" style={{ overflowAnchor: "auto", height: 1, flexShrink: 0 }} />
    </section>
  );
}

const feedStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  overflowAnchor: "none",
  // Trap rubber-band scrolling inside the feed so iOS doesn't drag the
  // whole shell when the user pulls past the top/bottom — header and
  // composer stay visually pinned.
  overscrollBehavior: "contain",
  WebkitOverflowScrolling: "touch",
  padding: "1.25rem 1rem 0.75rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const scenarioCardStyle: React.CSSProperties = {
  margin: "0 auto 1rem",
  maxWidth: 560,
  padding: "12px 14px",
  borderRadius: "var(--sp-radius)",
  border: "1px solid var(--char-accent-border)",
  background: "var(--char-accent-softer)",
};

const scenarioHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
  gap: 8,
};

const scenarioPillStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--char-accent)",
  border: "1px solid var(--char-accent)",
  borderRadius: "var(--sp-radius)",
  padding: "3px 10px",
  lineHeight: 1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 180,
};

const scenarioBodyStyle: React.CSSProperties = {
  fontStyle: "italic",
  color: "var(--sp-fg-1)",
  fontSize: 14.5,
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
};
