import { type RefObject, useLayoutEffect, useRef } from "react";

/** How long after a change on this device its reorders snap instead of gliding. */
const LOCAL_MS = 1500;

/** Marks a change made on this device: its reorders snap (`useGlide`). */
export const markLocal = (quiet: RefObject<number>) => {
  quiet.current = performance.now() + LOCAL_MS;
};

/**
 * Rows under `container` marked `data-glide` with their key glide to a new place instead
 * of jumping there, when a render changes their order (FLIP, with the Web Animations
 * API): others' drags and changes. A reorder soon after a change made on this device
 * (`markLocal`) snaps, with the server's answer, so a click or key right after it lands
 * where it's aimed. Positions are measured from the container's top, so scrolling and
 * what's above the list don't count as moves; a row moved again mid-glide glides on from
 * where it's drawn. Off for people who ask for less motion.
 */
export function useGlide(
  container: RefObject<HTMLElement | null>,
  quiet: RefObject<number>,
) {
  const last = useRef({ order: "", tops: new Map<string, number>() });
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const rows = [...element.querySelectorAll<HTMLElement>("[data-glide]")];
    const order = rows.map((row) => row.dataset.glide).join();
    const base = element.getBoundingClientRect().top;
    const tops = new Map(
      rows.map((row) => [
        row.dataset.glide ?? "",
        row.getBoundingClientRect().top - base,
      ]),
    );
    const moved = order !== last.current.order;
    const local = performance.now() < quiet.current;
    if (moved && local)
      for (const row of rows) for (const a of row.getAnimations()) a.finish();
    if (
      moved &&
      !local &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      for (const row of rows) {
        const before = last.current.tops.get(row.dataset.glide ?? "");
        const top = tops.get(row.dataset.glide ?? "") ?? 0;
        if (before === undefined || Math.abs(before - top) < 1) continue;
        row.animate(
          [
            { transform: `translateY(${before - top}px)` },
            { transform: "none" },
          ],
          { duration: 200, easing: "ease-out" },
        );
      }
    last.current = { order, tops };
  });
}
