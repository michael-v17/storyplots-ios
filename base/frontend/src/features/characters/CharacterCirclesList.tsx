import type { Character } from "../../lib/characters";
import { useCharacterOpen } from "./useCharacterOpen";

export function CharacterCirclesList({
  characters,
  testId = "character-circles",
}: {
  characters: Character[];
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
        gap: "1rem",
        justifyItems: "center",
      }}
    >
      {characters.map((c) => <Circle key={c.id} character={c} />)}
    </div>
  );
}

function Circle({ character }: { character: Character }) {
  const { avatarSrc, initial, busy, href, onClick } = useCharacterOpen(character);

  return (
    <a
      href={href}
      onClick={onClick}
      data-testid={`char-circle-${character.id}`}
      aria-busy={busy}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.5rem",
        textDecoration: "none",
        color: "inherit",
        cursor: busy ? "progress" : "pointer",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 72, height: 72, borderRadius: "50%",
          backgroundColor: avatarSrc ? "var(--sp-bg-3)" : character.accent_color,
          backgroundImage: avatarSrc ? `url(${avatarSrc})` : undefined,
          backgroundSize: avatarSrc ? "cover" : undefined,
          backgroundPosition: avatarSrc ? "center" : undefined,
          color: "white", fontSize: "1.6em", fontWeight: "bold",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          boxShadow: `0 0 0 2px var(--sp-bg), 0 0 0 3px ${character.accent_color}`,
        }}
      >
        {!avatarSrc && initial}
      </div>
      <span style={{ fontSize: 13, color: "var(--sp-fg-2)", textAlign: "center" }}>{character.name}</span>
    </a>
  );
}
