import { type RefObject, useEffect, useEffectEvent } from "react";

/**
 * A sideways swipe of one finger on `target`, at least 60 pixels and mostly sideways:
 * `onSwipe(1)` to the left, for what comes next, `onSwipe(-1)` to the right. Scrolling up
 * and down stays the browser's.
 */
export function useSwipe(
  target: RefObject<HTMLElement | null>,
  onSwipe: (by: 1 | -1) => void,
) {
  const swiped = useEffectEvent(onSwipe);
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    let start: { x: number; y: number } | null = null;
    const down = (event: TouchEvent) => {
      const touch = event.touches[0];
      start =
        event.touches.length === 1 && touch
          ? { x: touch.clientX, y: touch.clientY }
          : null;
    };
    const up = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      start = null;
      if (Math.abs(dx) >= 60 && Math.abs(dx) > 2 * Math.abs(dy))
        swiped(dx < 0 ? 1 : -1);
    };
    element.addEventListener("touchstart", down, { passive: true });
    element.addEventListener("touchend", up, { passive: true });
    return () => {
      element.removeEventListener("touchstart", down);
      element.removeEventListener("touchend", up);
    };
  }, [target]);
}
