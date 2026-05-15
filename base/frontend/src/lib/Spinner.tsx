// Centered pulse used for state loaders that aren't card grids
// (Settings, panels, forms). For card grids prefer `SkeletonGrid`.
//
// Visual: three pulsing dots reusing the `sp-typing-dot` keyframe shared
// with the chat streaming placeholder. Same motion across the app — the
// user already associates the 3-dot pulse with "the system is thinking",
// whether it's a chat agent streaming a reply or a route gating on data.
//
// Backwards-compatible API: the previous `Loader2 + "Loading…"` Spinner
// took `{ size, label, inline, testId }`. The new body ignores `size`
// (dots are a fixed visual mass), keeps `label` only as the aria-label
// (screen readers — never rendered as text), keeps `inline` to switch
// between block (40vh centered, used as page gate) and inline (panel
// rows, button-internal usage), and keeps `testId` for Playwright.
type Props = {
  size?: number;
  label?: string;
  inline?: boolean;
  testId?: string;
};

export function Spinner({ label = "Loading", inline = false, testId }: Props) {
  return (
    <div
      role="status"
      aria-label={label}
      data-testid={testId}
      style={{
        display: inline ? "inline-flex" : "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: inline ? 0 : "2rem 1rem",
        minHeight: inline ? undefined : "40vh",
        color: "var(--sp-fg-3)",
      }}
    >
      <span className="sp-typing-dot" />
      <span className="sp-typing-dot" />
      <span className="sp-typing-dot" />
    </div>
  );
}
