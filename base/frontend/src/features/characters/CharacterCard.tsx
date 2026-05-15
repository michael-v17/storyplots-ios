import type { Character } from "../../lib/characters";
import type { CharacterStat } from "../../lib/characterStats";
import { relativeTime } from "../../lib/relativeTime";
import { useCharacterOpen } from "./useCharacterOpen";

const MAX_TAGS_VISIBLE = 3;

const tagPillStyle: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "var(--sp-bg-3)",
  color: "var(--sp-fg-2)",
  fontSize: 11,
  fontWeight: 500,
  whiteSpace: "nowrap",
};

export function CharacterCard({
  character,
  stat,
  hideTags = false,
}: {
  character: Character;
  stat?: CharacterStat;
  // Home renders cards as a compact preview — tags are dropped there to
  // keep each card short so the whole screen fits without scrolling.
  // The full /characters list keeps them.
  hideTags?: boolean;
}) {
  const { avatarSrc, initial, busy, href, onClick } = useCharacterOpen(character);
  const modeIcon = character.mode === "assistant" ? "💬" : "🎭";
  const modeLabel = character.mode === "assistant" ? "Assistant" : "Roleplay";
  const count = stat?.count ?? 0;
  const lastAt = stat?.lastAt ?? null;
  const tags = character.tags ?? [];
  const visibleTags = tags.slice(0, MAX_TAGS_VISIBLE);
  const overflowTags = Math.max(0, tags.length - MAX_TAGS_VISIBLE);

  return (
    <a
      href={href}
      onClick={onClick}
      data-testid={`char-tile-${character.id}`}
      aria-busy={busy}
      className="sp-char-card"
      style={{
        ["--char-accent" as string]: character.accent_color,
        display: "flex",
        flexDirection: "column",
        background: "var(--sp-bg-2)",
        border: "1px solid var(--sp-border)",
        borderRadius: "var(--sp-radius)",
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        cursor: busy ? "progress" : "pointer",
        transition: "transform 200ms var(--sp-ease), box-shadow 200ms var(--sp-ease)",
      }}
    >
      {/* Image hero — square frame. Avatar fits inside with objectFit:contain
          (letter-box pattern from cycle 0074F MessageImage) so the entire
          image shows; the frame bg (--sp-bg-3) fills any empty space.
          Fallback (no avatar) paints the accent color with the initial. */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          background: avatarSrc ? "var(--sp-bg-3)" : character.accent_color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        ) : (
          <span style={{ color: "white", fontSize: "2.4em", fontWeight: 700 }}>
            {initial}
          </span>
        )}
        {/* Mode badge — small accent chip top-left to mark roleplay vs
            assistant without taking from the name area below. */}
        <span
          title={modeLabel}
          aria-label={modeLabel}
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--char-accent-soft)",
            color: "var(--char-accent)",
            fontSize: 14,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          {modeIcon}
        </span>
        {/* Count badge — bottom-right, only when the character has at least
            one conversation. Shows total chat threads at a glance like
            Crushon's chat-count overlay. */}
        {count > 0 && (
          <span
            data-testid={`char-tile-count-${character.id}`}
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 999,
              background: "rgba(0, 0, 0, 0.55)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              color: "white",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            💬 {count}
          </span>
        )}
      </div>

      {/* Text block under the image. Padding kept tight so the card stays
          dense on mobile two-column layouts. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
          padding: "0.65rem 0.75rem 0.75rem",
          flex: 1,
          minWidth: 0,
        }}
      >
        <strong
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--sp-fg)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {character.name}
        </strong>
        {/* Tagline span renders unconditionally with a fixed 2-line
            min-height so a row mixing characters with/without tagline
            keeps the text block aligned. (code-review F3) */}
        <span
          className="sp-card-tagline"
          style={{
            color: "var(--sp-fg-3)",
            fontSize: 13,
            lineHeight: 1.35,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: "2.7em",
          }}
        >
          {character.tagline ?? ""}
        </span>

        {!hideTags && tags.length > 0 && (
          <div
            data-testid={`char-tile-tags-${character.id}`}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginTop: "0.15rem",
            }}
          >
            {visibleTags.map((tag) => (
              <span key={tag} style={tagPillStyle}>
                {tag}
              </span>
            ))}
            {overflowTags > 0 && (
              <span style={{ ...tagPillStyle, color: "var(--sp-fg-3)" }}>
                +{overflowTags}
              </span>
            )}
          </div>
        )}

        {lastAt && (
          <span
            data-testid={`char-tile-time-${character.id}`}
            style={{
              fontSize: 11,
              color: "var(--sp-fg-3)",
              marginTop: "auto",
              paddingTop: "0.2rem",
            }}
            title={`Last used ${relativeTime(lastAt)} ago`}
          >
            ⏱ {relativeTime(lastAt)}
          </span>
        )}
      </div>
    </a>
  );
}
