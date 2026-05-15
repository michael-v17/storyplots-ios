// WCAG relative luminance → legible foreground color over a character accent.
//
// Cycle 0071 adds this helper so the user-side chat bubble stays readable
// when the character's accent is a pastel (Evelyn's legacy #6BE08C mint
// made white text wash out after Cycle 0069 migrated the bubble to a solid
// accent fill).
//
// We intentionally use a luminance *threshold* rather than a strict
// contrast-ratio comparison. The DesignSystem kit pins user-bubble text to
// `color: white` across every sample persona (ChatScreen.jsx) — including
// mid-saturation coral like AXIOM-7 `#E04747` whose WCAG ratio against
// white is ≈3.2:1, marginal but deliberate kit aesthetic. Flipping those
// mid-range accents to near-black would fix WCAG AA but regress the kit
// look on characters like Aria `#E06B6B` that the creator has already
// accepted. The threshold is tuned high enough that only pastels beyond
// the kit's range (mint, light lime) flip to `--sp-bg` near-black.
//
// Pure function, no deps. Invalid / empty input falls back to white so the
// 0069 default is preserved for callers that somehow pass a malformed accent.
export function accentTextColor(hex: string | null | undefined): string {
  const fallback = "white";
  if (!hex) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const channel = (i: number) => parseInt(m[1].slice(i, i + 2), 16) / 255;
  const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const r = linearize(channel(0));
  const g = linearize(channel(2));
  const b = linearize(channel(4));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // 0.45 catches pastels (mint #6BE08C L≈0.58, lime #84CC16 L≈0.48) while
  // preserving kit-spec white on Aria-class coral (L≈0.27) and teal / amber
  // (L≈0.37). Every 0072-polish ACCENT_PRESET shade-600/700 has L < 0.28,
  // so all newly-selectable accents keep white without regression.
  return L > 0.45 ? "#0D0A15" : "white";
}
