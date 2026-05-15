import { useRef } from "react";

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 14;

/** Wire long-press on mobile. Returns handlers to spread onto an element.
 *
 * iOS rubber-band overscroll can start with sub-10px touch movement, so the
 * threshold is bumped to 14px. A `scroll` listener is also armed alongside
 * the timer so that any window-level scroll cancels the long-press even if
 * touchmove events are consumed by the browser's passive scroll handler.
 */
export function useLongPress(handler: (x: number, y: number) => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const scrollListenerRef = useRef<(() => void) | null>(null);

  function clear() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (scrollListenerRef.current) {
      window.removeEventListener("scroll", scrollListenerRef.current, true);
      scrollListenerRef.current = null;
    }
    startRef.current = null;
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    const fireX = t.clientX; const fireY = t.clientY;
    timerRef.current = setTimeout(() => {
      handler(fireX, fireY);
      clear();
    }, LONG_PRESS_MS);
    // Cancel on any scroll — passive listener conflicts can silence
    // touchmove while the page keeps scrolling.
    scrollListenerRef.current = clear;
    window.addEventListener("scroll", scrollListenerRef.current, true);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!startRef.current || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clear();
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd: clear,
    onTouchCancel: clear,
  };
}
