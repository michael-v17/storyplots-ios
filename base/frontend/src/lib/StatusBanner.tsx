import type { ReactNode } from "react";

export type StatusTone = "success" | "warning" | "error";

type Props = {
  tone: StatusTone;
  testid: string;
  dismissTestid?: string;
  onDismiss?: () => void;
  role?: "status" | "alert";
  children: ReactNode;
};

const toneColors: Record<StatusTone, { bg: string; border: string }> = {
  success: { bg: "var(--sp-success-soft)", border: "var(--sp-success)" },
  warning: { bg: "var(--sp-warning-soft)", border: "var(--sp-warning)" },
  error:   { bg: "var(--sp-destructive-soft)", border: "var(--sp-destructive)" },
};

export function StatusBanner({ tone, testid, dismissTestid, onDismiss, role = "status", children }: Props) {
  const colors = toneColors[tone];
  return (
    <div
      data-testid={testid}
      role={role}
      style={{
        padding: "0.75rem 1rem",
        border: `1px solid ${colors.border}`,
        borderRadius: "var(--sp-radius)",
        background: colors.bg,
        color: "var(--sp-fg)",
        display: onDismiss ? "flex" : "block",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "0.75rem",
        fontSize: "0.9em",
      }}
    >
      <span style={{ flex: 1 }}>{children}</span>
      {onDismiss && (
        <button
          type="button"
          data-testid={dismissTestid}
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{ background: "transparent", border: "none", color: "var(--sp-fg-2)", cursor: "pointer", fontSize: "1rem", padding: 0, lineHeight: 1 }}
        >×</button>
      )}
    </div>
  );
}
