import { useEffect, useRef } from "react";

export type ContextMenuItem = {
  label: string;
  testid: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type Props = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

export function MessageContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent | PointerEvent) {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // Defer binding so the originating click doesn't immediately close us.
    const t = setTimeout(() => {
      window.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Clamp to viewport so the menu doesn't flow off the right/bottom edges
  // on mobile touch anchoring.
  const MENU_W = 160, MENU_H = items.length * 36 + 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const left = Math.max(8, Math.min(x, vw - MENU_W - 8));
  const top = Math.max(8, Math.min(y, vh - MENU_H - 8));

  return (
    <div
      ref={ref}
      data-testid="message-context-menu"
      role="menu"
      style={{
        position: "fixed", left, top, minWidth: MENU_W, zIndex: 60,
        background: "var(--sp-bg-2)", border: "1px solid var(--sp-border)", borderRadius: "var(--sp-radius)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.4)", padding: "0.25rem",
        display: "grid", gap: "0.1rem",
      }}
    >
      {items.map((it) => (
        <button
          key={it.testid}
          type="button"
          data-testid={it.testid}
          onClick={() => { if (!it.disabled) { it.onClick(); onClose(); } }}
          disabled={it.disabled}
          style={{
            textAlign: "left", padding: "0.5rem 0.75rem", borderRadius: "var(--sp-radius)",
            border: "none", background: "transparent",
            color: it.destructive ? "var(--sp-destructive)" : "var(--sp-fg)",
            cursor: it.disabled ? "not-allowed" : "pointer",
            opacity: it.disabled ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!it.disabled) (e.currentTarget as HTMLButtonElement).style.background = "var(--sp-bg-3)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
