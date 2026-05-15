import { useEffect, useState } from "react";

// Seed/ux.md §3 — adaptive shell breakpoints.
// Distinct from useIsMobile (768px) which governs touch-vs-mouse gesture
// affordances (long-press vs right-click) in MessageBubble etc.
export const BP_S_MAX = 640;
export const BP_L_MIN = 1025;

export type Breakpoint = "S" | "M" | "L";

function resolve(): Breakpoint {
  if (typeof window === "undefined") return "L";
  const w = window.innerWidth;
  if (w <= BP_S_MAX) return "S";
  if (w >= BP_L_MIN) return "L";
  return "M";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => resolve());
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setBp(resolve()));
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return bp;
}
