import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { loadCharacter, type Character } from "../lib/characters";
import { CharacterForm } from "../features/characters/CharacterForm";
import { Spinner } from "../lib/Spinner";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function CharacterEdit() {
  const { id } = useParams<{ id: string }>();
  const [character, setCharacter] = useState<Character | null | "missing">(null);
  const loadedName = character && character !== "missing" ? character.name : null;
  useDocumentTitle(loadedName ? `Edit ${loadedName}` : "Edit Character");

  useEffect(() => {
    if (!id) return;
    loadCharacter(id).then((c) => setCharacter(c ?? "missing"));
  }, [id]);

  if (character === null) {
    return (
      <main style={stateStyle}><Spinner testId="char-edit-loading" /></main>
    );
  }
  if (character === "missing") {
    return (
      <main data-testid="char-edit-missing" style={stateStyle}>Character not found.</main>
    );
  }
  return <CharacterForm character={character} />;
}

const stateStyle: React.CSSProperties = {
  maxWidth: 560,
  margin: "2rem auto",
  padding: "0 1rem",
  color: "var(--sp-fg-3)",
};
