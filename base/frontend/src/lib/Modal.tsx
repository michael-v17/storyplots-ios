import { useEffect, type ReactNode, type CSSProperties } from "react";

// Shared overlay-modal helper. Renders a fixed scrim using `--sp-overlay`
// + centered card on `--sp-bg-2` with `--sp-radius-lg` + `--sp-shadow-lg`.
// Escape key + backdrop click both dismiss; inner card stops propagation.
// `labelId` ARIA wires the dialog to its heading id (WCAG dialog pattern).
type Props = {
  children: ReactNode;
  onClose: () => void;
  labelId?: string;
};

export function Modal({ children, onClose, labelId }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      style={overlayStyle}
      onClick={onClose}
    >
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// Helpers consumers can spread for the modal-internal heading + actions row.
// Keeps the modal "look" coherent across consumers without forcing layout.
export const modalHeadingStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.1rem",
  fontWeight: 600,
  color: "var(--sp-fg)",
};

export const modalActionsStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  justifyContent: "flex-end",
  marginTop: "0.5rem",
};

const overlayStyle: CSSProperties = {
  position: "fixed", inset: 0, background: "var(--sp-overlay)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
  padding: "1rem",
};

const modalCardStyle: CSSProperties = {
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  boxShadow: "var(--sp-shadow-lg)",
  padding: "1.5rem",
  maxWidth: 480,
  width: "100%",
  maxHeight: "80vh",
  overflow: "auto",
  color: "var(--sp-fg)",
  display: "grid",
  gap: "0.75rem",
};
