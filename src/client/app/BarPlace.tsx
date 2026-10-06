import { type ReactNode, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";

// Places in the bars that a page fills: the open playlist's title
// after ☰. The bars know no pages, and other pages leave them as they are.

type Place = "title";
// ponytail: one bar at a time, so its places are global.
const places = new Map<Place, HTMLElement>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** For the community's name in a bar with ☰: smaller and muted after a page's title. */
export const besideTitle =
  "group-has-[[data-bar-title]]/bar:text-sm group-has-[[data-bar-title]]/bar:font-normal group-has-[[data-bar-title]]/bar:text-muted";

/**
 * On a phone with a playlist open, the community's name takes a line of its own above the
 * bar, centered, so ☰, the playlist's title and the account share the bar's line. By the address, so the line is there before the title
 * loads and nothing moves.
 */
export function useNameAbove(phone: boolean) {
  const [location] = useLocation();
  return phone && /^\/playlists\/[^/]+/.test(location);
}

/** Where a page's `place` goes in a bar, which has the `group/bar` class. */
export function BarPlace({ place }: { place: Place }) {
  const ref = useCallback(
    (element: HTMLSpanElement | null) => {
      if (!element) return;
      places.set(place, element);
      listeners.forEach((l) => l());
      return () => {
        if (places.get(place) === element) places.delete(place);
        listeners.forEach((l) => l());
      };
    },
    [place],
  );
  return <span ref={ref} className="contents" />;
}

/** `children` in the bar's `place`, while the page shows. */
export function InBar({
  place,
  children,
}: {
  place: Place;
  children: ReactNode;
}) {
  const element = useSyncExternalStore(
    subscribe,
    () => places.get(place) ?? null,
  );
  return element ? createPortal(children, element) : null;
}
