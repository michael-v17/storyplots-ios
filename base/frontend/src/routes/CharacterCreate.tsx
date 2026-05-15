import { useLocation } from "react-router-dom";
import { CharacterForm, type ImportState } from "../features/characters/CharacterForm";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function CharacterCreate() {
  useDocumentTitle("Create Character");
  const loc = useLocation();
  const importState = (loc.state as ImportState | null) ?? undefined;
  return <CharacterForm importState={importState} />;
}
