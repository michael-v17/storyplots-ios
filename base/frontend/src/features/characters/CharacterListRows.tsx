import type { Character } from "../../lib/characters";
import type { CharacterStat } from "../../lib/characterStats";
import { relativeTime } from "../../lib/relativeTime";
import { useCharacterOpen } from "./useCharacterOpen";

export function CharacterListRows({
  characters,
  stats,
  testId = "character-list",
}: {
  characters: Character[];
  stats?: Map<string, CharacterStat>;
  testId?: string;
}) {
  return (
    <div data-testid={testId} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      {characters.map((c) => <Row key={c.id} character={c} stat={stats?.get(c.id)} />)}
    </div>
  );
}

function Row({ character, stat }: { character: Character; stat?: CharacterStat }) {
  const { avatarSrc, initial, busy, href, onClick } = useCharacterOpen(character);
  const modeIcon = character.mode === "assistant" ? "💬" : "🎭";
  const modeLabel = character.mode === "assistant" ? "Assistant" : "Roleplay";
  const count = stat?.count ?? 0;
  const lastAt = stat?.lastAt ?? null;

  return (
    <a
      href={href}
      onClick={onClick}
      data-testid={`char-row-${character.id}`}
      aria-busy={busy}
      style={{
        ["--char-accent" as string]: character.accent_color,
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.6rem 0.75rem",
        border: "1px solid var(--sp-border)",
        borderRadius: "var(--sp-radius)",
        textDecoration: "none",
        color: "inherit",
        cursor: busy ? "progress" : "pointer",
        transition: "background 120ms var(--sp-ease)",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 40, height: 40, borderRadius: "50%",
          backgroundColor: avatarSrc ? "var(--sp-bg-3)" : character.accent_color,
          backgroundImage: avatarSrc ? `url(${avatarSrc})` : undefined,
          backgroundSize: avatarSrc ? "cover" : undefined,
          backgroundPosition: avatarSrc ? "center" : undefined,
          color: "white", fontWeight: "bold",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          flexShrink: 0,
          boxShadow: `0 0 0 2px var(--sp-bg), 0 0 0 3px ${character.accent_color}`,
        }}
      >
        {!avatarSrc && initial}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <strong style={{ color: "var(--sp-fg)" }}>{character.name}</strong>
        {character.tagline && (
          <span style={{ fontSize: "0.85em", color: "var(--sp-fg-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {character.tagline}
          </span>
        )}
      </div>
      <div
        data-testid={`char-row-stats-${character.id}`}
        style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.8em", color: "var(--sp-fg-3)", flexShrink: 0 }}
      >
        <span title={modeLabel} aria-label={modeLabel}>{modeIcon}</span>
        <span aria-label={`${count} conversation${count === 1 ? "" : "s"}`}>💬 {count}</span>
        {lastAt && <span aria-label={`Last used ${relativeTime(lastAt)} ago`}>⏱ {relativeTime(lastAt)}</span>}
      </div>
    </a>
  );
}
