import type { Character } from "../../lib/characters";
import type { CharacterStat } from "../../lib/characterStats";
import { CharacterCard } from "./CharacterCard";

export function CharacterGrid({
  characters,
  stats,
  testId = "character-grid",
  hideTags = false,
}: {
  characters: Character[];
  stats?: Map<string, CharacterStat>;
  testId?: string;
  // Forwarded to every card — Home passes this to render compact,
  // tagless preview cards (see CharacterCard).
  hideTags?: boolean;
}) {
  // Grid template-columns + gap are driven by the `.sp-character-grid`
  // class in tokens.css: 2 fixed columns on mobile (≤640 px) — matches
  // app-feel of Character.AI / Crushon — and auto-fill `minmax(200px, 1fr)`
  // on tablet+desktop so the grid breathes from 4 cols (narrow desktop)
  // up to 6+ cols on ultrawide without ever shrinking a card below 200 px.
  return (
    <div data-testid={testId} className="sp-character-grid">
      {characters.map((c) => (
        <CharacterCard key={c.id} character={c} stat={stats?.get(c.id)} hideTags={hideTags} />
      ))}
    </div>
  );
}
