// Shared chat sub-panel skin primitives.
//
// Cycle 0071 re-skinned AuthorsNoteEditor / LorebookPanel / MemoryPanel /
// GenerationOverridePanel against the DesignSystem kit. The "back button",
// "panel title", and "primary pill" shapes repeated verbatim across these
// panels and map to DesignSystem primitives, so they live here.
//
// Deliberately NOT shared: panelStyle / headerStyle (each panel tunes width,
// gap, and layout — Memory is 420px with no space-between header, others are
// 360px with space-between), chipStyle (Notes's append-chip sits on bg-2 and
// uses bg-3; Lorebook's keyword tag sits on bg-3 and uses bg-2), and every
// one-off style (scopeChipStyle, stepperBtnStyle, entryStyle, ghostPillStyle,
// Memory's badge/clearAll/delete/chunkRow). Those stay local so future cycles
// can tune them independently.
import type { CSSProperties } from "react";

export const panelBackBtnStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sp-border)",
  color: "var(--sp-fg-2)",
  borderRadius: "var(--sp-radius)",
  padding: "0.25rem 0.6rem",
  fontSize: "0.85em",
  fontFamily: "inherit",
  cursor: "pointer",
};

export const panelTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--sp-fg)",
  fontWeight: 600,
  fontSize: "1rem",
};

// Form field chrome for panels that lay out their own labels (grid/flex)
// instead of the global `[data-form="stack"]` reset. Cycle 0133:
// GenerationOverridePanel used `data-form="stack"` AND an inline grid
// layout — the global `label`/`select` margins stacked on top of the grid
// gap, tripling the vertical rhythm. Dropping `data-form="stack"` there and
// styling its fields with this keeps spacing single-source. 16px font = the
// iOS no-zoom threshold (same as the global reset). AuthorsNoteEditor still
// uses `data-form="stack"` (textarea + stepper layout) and doesn't consume
// this yet.
export const panelFieldStyle: CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "0.5rem 0.7rem",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  background: "var(--sp-bg-2)",
  color: "var(--sp-fg)",
  font: "inherit",
  fontSize: "16px",
};

// Primary pill (brand gradient fill). `size: "sm"` uses Lorebook's tighter
// header-button tuning; default `"md"` matches Notes and GenerationOverride.
export function primaryPillStyle(
  disabled: boolean,
  size: "sm" | "md" = "md",
): CSSProperties {
  const sm = size === "sm";
  return {
    background: disabled ? "var(--sp-bg-3)" : "var(--sp-brand-grad)",
    color: disabled ? "var(--sp-fg-4)" : "var(--sp-fg-on-brand)",
    border: "none",
    borderRadius: "var(--sp-radius)",
    padding: sm ? "0.4rem 0.9rem" : "0.45rem 1rem",
    fontWeight: 600,
    fontFamily: "inherit",
    fontSize: sm ? "0.85em" : undefined,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
