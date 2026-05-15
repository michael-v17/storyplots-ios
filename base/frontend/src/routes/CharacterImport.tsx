import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { mapCardToDraft } from "../features/import/mapCardToDraft";
import { parseCharacterCard, type ParsedCard } from "../features/import/parseCharacterCard";
import type { CharacterDraft, Gender } from "../lib/characters";
import {
  NoTextEngineError,
  refineCharacterCard,
  type RefinedDraft,
} from "../lib/characterRefine";
import type { ImportState, RefineReason } from "../features/characters/CharacterForm";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Phase =
  | { kind: "empty" }
  | { kind: "parsing" }
  | { kind: "refining"; abort: () => void }
  | { kind: "error"; message: string };

export function CharacterImport() {
  useDocumentTitle("Import Character");
  const nav = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "empty" });

  function navigateWithFallback(
    parsed: ParsedCard,
    file: File,
    reason: RefineReason,
    detail?: string,
  ) {
    const { draft, pendingCharacterBook } = mapCardToDraft(parsed);
    const state: ImportState = {
      draft,
      pendingCharacterBook,
      avatarBlob: parsed.avatarBlob,
      rawCard: { file, format: parsed.format },
      refineSource: "heuristic",
      refineReason: reason,
      refineDetail: detail,
    };
    nav("/character/new/manual", { state });
  }

  function navigateWithRefined(parsed: ParsedCard, file: File, refined: RefinedDraft) {
    const draft = mergeRefinedIntoDraft(parsed, refined);
    const pendingCharacterBook =
      (parsed.format === "v2" || parsed.format === "v3")
        ? parsed.card.character_book?.entries?.length
          ? parsed.card.character_book.entries
          : null
        : null;
    const state: ImportState = {
      draft,
      pendingCharacterBook,
      avatarBlob: parsed.avatarBlob,
      rawCard: { file, format: parsed.format },
      refineSource: "llm",
    };
    nav("/character/new/manual", { state });
  }

  async function onFile(file: File) {
    setPhase({ kind: "parsing" });
    let parsed: ParsedCard;
    try {
      parsed = await parseCharacterCard(file);
    } catch (e) {
      setPhase({ kind: "error", message: (e as Error).message || "Could not parse the card" });
      return;
    }

    const abortCtrl = new AbortController();
    setPhase({ kind: "refining", abort: () => abortCtrl.abort() });

    try {
      const refined = await refineCharacterCard(
        { format: parsed.format, card: parsed.card },
        parsed.format,
        1,
        abortCtrl.signal,
      );
      navigateWithRefined(parsed, file, refined);
    } catch (e) {
      if (abortCtrl.signal.aborted) {
        navigateWithFallback(parsed, file, "skipped");
        return;
      }
      if (e instanceof NoTextEngineError) {
        navigateWithFallback(parsed, file, "no_engine");
        return;
      }
      navigateWithFallback(parsed, file, "llm_error", (e as Error).message);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void onFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void onFile(f);
  }

  const busy = phase.kind === "parsing" || phase.kind === "refining";

  const isError = phase.kind === "error";
  return (
    <main data-testid="character-import" style={mainStyle}>
      <p style={{ margin: "0 0 0.75rem" }}><Link to="/character/new">← Back</Link></p>
      <h1 className="sp-h2 sp-wordmark sp-page-h1" style={{ margin: "0 0 0.5rem" }}>Import Character</h1>
      <p style={{ color: "var(--sp-fg-3)", margin: "0 0 1.25rem" }}>Drop a TavernAI / SillyTavern / Chub.ai character card here.</p>

      <div
        data-testid="import-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !busy && fileInput.current?.click()}
        style={dropzoneStyle(isError, busy)}
      >
        <div style={{ fontSize: "2.5em", marginBottom: "0.5rem", lineHeight: 1 }}>
          {phase.kind === "refining" ? "✨" : "⬇"}
        </div>
        <div data-testid={phaseTestId(phase)} style={{ fontWeight: 600, marginBottom: "0.25rem", color: "var(--sp-fg)" }}>
          {phaseLabel(phase)}
        </div>
        <div style={{ fontSize: "0.9em", color: "var(--sp-fg-3)" }}>PNG or JSON format</div>
        <div style={{ fontSize: "0.75em", color: "var(--sp-fg-4)", marginTop: "1rem" }}>
          Supported: TavernAI, SillyTavern, Chub.ai · Character Card V1, V2 &amp; V3
        </div>
        <input
          ref={fileInput}
          type="file"
          data-testid="import-file-input"
          accept=".png,.json,application/json,image/png"
          style={{ display: "none" }}
          onChange={onPick}
          disabled={busy}
        />
      </div>

      {phase.kind === "refining" && (
        <p style={{ marginTop: "0.75rem", textAlign: "center" }}>
          <button
            type="button"
            data-testid="import-skip"
            onClick={(e) => { e.stopPropagation(); phase.abort(); }}
            style={ghostPillStyle}
          >
            Skip AI refinement
          </button>
          <span style={{ marginLeft: "0.75rem", fontSize: "0.85em", color: "var(--sp-fg-3)" }}>
            Uses the heuristic parser instead
          </span>
        </p>
      )}

      {phase.kind === "error" && (
        <p role="alert" data-testid="import-error" style={{ color: "var(--sp-destructive)", marginTop: "1rem" }}>
          {phase.message} —{" "}
          <button
            type="button"
            onClick={() => setPhase({ kind: "empty" })}
            style={ghostPillStyle}
          >
            Try another file
          </button>
        </p>
      )}
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  maxWidth: 560,
  margin: "2rem auto",
  padding: "0 1rem",
};

function dropzoneStyle(error: boolean, busy: boolean): React.CSSProperties {
  return {
    border: `2px dashed ${error ? "var(--sp-destructive)" : "var(--sp-border-strong)"}`,
    borderRadius: "var(--sp-radius)",
    padding: "2.5rem 1rem",
    textAlign: "center",
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.6 : 1,
    background: error ? "var(--sp-destructive-soft)" : "var(--sp-bg-2)",
    color: "var(--sp-fg)",
    transition: "border-color 160ms var(--sp-ease), background 160ms var(--sp-ease)",
  };
}

const ghostPillStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sp-border)",
  color: "var(--sp-fg-2)",
  borderRadius: "var(--sp-radius)",
  padding: "0.35rem 0.85rem",
  fontSize: "0.85em",
  fontFamily: "inherit",
  cursor: "pointer",
};

function phaseTestId(phase: Phase): string {
  switch (phase.kind) {
    case "parsing": return "import-parsing";
    case "refining": return "import-refining";
    case "error": return "import-error-label";
    default: return "import-idle";
  }
}

function phaseLabel(phase: Phase): string {
  switch (phase.kind) {
    case "parsing": return "Reading card…";
    case "refining": return "Refining with AI…";
    case "error": return "Try another file";
    default: return "Tap to Select";
  }
}

function isGender(v: string | null): v is Gender {
  return v === "male" || v === "female" || v === "non_binary" || v === "unspecified";
}

/** Build a CharacterDraft from the refiner's output, taking the parser's
 *  avatar and preserving the heuristic baseline for anything the LLM
 *  refused to produce (defense-in-depth; the agent's prompt already
 *  requires every field to be populated). */
function mergeRefinedIntoDraft(parsed: ParsedCard, refined: RefinedDraft): CharacterDraft {
  const { draft: baseline } = mapCardToDraft(parsed);
  const isGroup = (refined.detected_group_size ?? 1) > 1;
  const gender = (!isGroup && refined.gender && isGender(refined.gender)) ? refined.gender : baseline.gender;
  return {
    ...baseline,
    name: refined.name || baseline.name,
    tagline: refined.tagline || baseline.tagline,
    system_prompt: refined.system_prompt || baseline.system_prompt,
    personality: refined.personality || baseline.personality,
    goals: refined.goals || baseline.goals,
    worldbuilding: refined.worldbuilding || baseline.worldbuilding,
    scenario: refined.scenario || baseline.scenario,
    greeting: refined.greeting || baseline.greeting,
    tags: refined.tags.length ? refined.tags : baseline.tags,
    // Group detected: apply group fields, leave per-member physical attrs blank
    ...(isGroup ? {
      group_size: refined.detected_group_size,
      group_members_description: refined.group_members_description ?? baseline.group_members_description,
    } : {
      age: refined.age ?? baseline.age,
      gender,
      build: refined.build ?? baseline.build,
      height: refined.height ?? baseline.height,
      hair_color: refined.hair_color ?? baseline.hair_color,
      hair_style: refined.hair_style ?? baseline.hair_style,
      eye_color: refined.eye_color ?? baseline.eye_color,
      skin_tone: refined.skin_tone ?? baseline.skin_tone,
      distinctive_features: refined.distinctive_features ?? baseline.distinctive_features,
      signature_style: refined.signature_style ?? baseline.signature_style,
      voice_style: refined.voice_style ?? baseline.voice_style,
    }),
  };
}
