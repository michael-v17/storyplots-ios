import { useState } from "react";

// 16 shade-600/700 recontrasted presets (Cycle 0072 polish). All have
// ≥5:1 contrast against white so user-bubble fills stay legible with
// white dialogue. Four rows of 4: reds/oranges, greens/teals, blues/
// violets, pinks/neutrals.
export const ACCENT_PRESETS = [
  "#B91C1C", "#C2410C", "#B45309", "#8B6319",
  "#4D7C0F", "#15803D", "#0F766E", "#0369A1",
  "#1D4ED8", "#4338CA", "#6D28D9", "#A21CAF",
  "#BE185D", "#BE123C", "#57534E", "#475569",
];

type Props = {
  value: string;
  onChange: (hex: string) => void;
};

export function AccentPicker({ value, onChange }: Props) {
  const [focused, setFocused] = useState(false);
  const normalized = value.trim().toLowerCase();
  const isPreset = ACCENT_PRESETS.some((hex) => hex.toLowerCase() === normalized);
  const hexValid = /^#[0-9a-f]{6}$/i.test(value.trim());

  function handleInput(raw: string) {
    // Auto-prefix `#` so creators can paste "6D28D9" without the hash
    // and still have the draft field match the hex regex downstream.
    const next = raw.startsWith("#") ? raw : raw.length ? "#" + raw : "";
    onChange(next);
  }

  return (
    <div>
      <div style={gridStyle}>
        {ACCENT_PRESETS.map((hex) => {
          const selected = normalized === hex.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              aria-label={`Accent ${hex}`}
              aria-pressed={selected}
              data-testid={`accent-${hex}`}
              onClick={() => onChange(hex)}
              style={circleStyle(hex, selected)}
            />
          );
        })}
      </div>
      <div style={hexWrapStyle(focused)}>
        <span
          aria-hidden
          style={previewStyle(hexValid ? value : undefined)}
        />
        <span style={hexLabelStyle}>HEX</span>
        <input
          data-testid="accent-hex"
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="#6D28D9"
          maxLength={7}
          spellCheck={false}
          style={hexInputStyle}
        />
        {!isPreset && hexValid && (
          <span style={customBadgeStyle}>Custom</span>
        )}
      </div>
    </div>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(8, 1fr)",
  gap: 10,
  marginBottom: 14,
  // The kit's AccentPicker was authored for a ~360-400px container
  // (mobile-first, iPhone 402). In the Edit form the fieldset inherits
  // the 640-720px form width so uncapped circles inflate to ~75×75 —
  // too assertive next to the compact avatar tokens. Cap the grid.
  maxWidth: 400,
};

function circleStyle(hex: string, selected: boolean): React.CSSProperties {
  return {
    aspectRatio: "1",
    borderRadius: "50%",
    background: hex,
    cursor: "pointer",
    border: "none",
    padding: 0,
    boxShadow: selected
      ? `0 0 0 2px var(--sp-bg), 0 0 0 4px ${hex}`
      : "none",
    transition: "box-shadow 160ms var(--sp-ease)",
  };
}

function hexWrapStyle(focused: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "var(--sp-bg-2)",
    border: `1px solid ${focused ? "var(--sp-brand-1)" : "var(--sp-border)"}`,
    borderRadius: "var(--sp-radius)",
    padding: "10px 12px",
    boxShadow: focused
      ? "0 0 0 3px color-mix(in oklab, var(--sp-brand-1) 25%, transparent)"
      : "none",
    transition: "border-color 160ms var(--sp-ease), box-shadow 160ms var(--sp-ease)",
  };
}

function previewStyle(resolved: string | undefined): React.CSSProperties {
  return {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: resolved ?? "var(--sp-bg-3)",
    border: "1px solid var(--sp-border)",
    flexShrink: 0,
    display: "inline-block",
  };
}

const hexLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--sp-fg-3)",
  fontFamily: "var(--sp-font-mono)",
  letterSpacing: "0.04em",
};

const hexInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "transparent",
  border: "none",
  outline: "none",
  color: "var(--sp-fg)",
  fontSize: 14,
  fontFamily: "var(--sp-font-mono)",
  textTransform: "uppercase",
  padding: 0,
};

const customBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--sp-fg-4)",
  fontFamily: "var(--sp-font-mono)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
