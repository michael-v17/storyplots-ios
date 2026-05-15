import { extractImageTag } from "../../lib/visualRoleplay";

// ux.md §4.6 / creator-vision.md §5.2 — dual-voice chat typography.
// Assistant bubbles ("on-surface"): quoted "…" → dialogue, rendered
// upright in the primary text color; everything else → narration/action,
// rendered italic and dimmed. The model emits narration as plain prose
// (backend prompt_assembly tells it to "avoid markdown formatting"), so
// unmarked prose IS narration — legacy *asterisks* just have their
// markers stripped and fold into the same narration style.
// User bubbles ("on-accent"): the user's own text, not NPC roleplay
// prose — keep the legacy rendering where only *…* is italic and the
// rest is plain. Auto-italicising a whole plain user message would be
// wrong, and dimming white-on-accent hurts legibility.
const DIALOGUE = /"[^"\n]*"|“[^”\n]*”/g;
const ASTERISK = /\*([^*\n]+)\*/g;

// Match a partial `[image: ...` at the very end of a streaming chunk (no
// closing `]` yet). Without this, the refiner tag appears as visible raw
// text in the bubble until the SSE stream reaches the closing bracket.
const PARTIAL_IMAGE_TAG_TAIL = /\[image:[^\]]*$/i;

type Tone = "on-surface" | "on-accent";

export function TypographicText({ text, tone = "on-surface" }: { text: string; tone?: Tone }) {
  const displayText = extractImageTag(text).stripped.replace(PARTIAL_IMAGE_TAG_TAIL, "").trimEnd();

  const nodes = tone === "on-accent" ? renderAccent(displayText) : renderSurface(displayText);

  return (
    <span data-testid="typographic-text" style={{ whiteSpace: "pre-wrap" }}>
      {nodes}
    </span>
  );
}

// User bubble: only *…* → italic (markers stripped), the rest plain.
// Everything inherits the bubble's white-on-accent color.
function renderAccent(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const m of text.matchAll(ASTERISK)) {
    const start = m.index!;
    if (start > cursor) out.push(<span key={out.length}>{text.slice(cursor, start)}</span>);
    out.push(<em key={out.length}>{m[1]}</em>);
    cursor = start + m[0].length;
  }
  if (cursor < text.length) out.push(<span key={out.length}>{text.slice(cursor)}</span>);
  return out;
}

// Assistant bubble: quoted "…" → upright primary dialogue; everything
// else → dimmed italic narration (legacy *…* markers stripped). An
// unclosed trailing quote mid-stream stays narration until the closing
// quote arrives — same fall-through tolerance the old *…* parser had.
function renderSurface(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const m of text.matchAll(DIALOGUE)) {
    const start = m.index!;
    if (start > cursor) out.push(narration(text.slice(cursor, start), out.length));
    out.push(
      <span key={out.length} style={{ color: "var(--sp-fg)" }}>{m[0]}</span>,
    );
    cursor = start + m[0].length;
  }
  if (cursor < text.length) out.push(narration(text.slice(cursor), out.length));
  return out;
}

function narration(chunk: string, key: number): React.ReactNode {
  return (
    <em key={key} style={{ color: "var(--sp-fg-2)" }}>
      {chunk.replace(ASTERISK, "$1")}
    </em>
  );
}
