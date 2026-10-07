import { useEffect, useSyncExternalStore } from "react";

/** What the page shown names itself, e.g. its playlist or song; null for none. */
let place: string | null = null;
const listeners = new Set<() => void>();
const setPlace = (next: string | null) => {
  if (next === place) return;
  place = next;
  for (const listener of listeners) listener();
};

/** A page names where one is, for the window's title (`WindowTitle`). */
export function usePlace(name: string | null | undefined) {
  useEffect(() => {
    if (!name) return;
    setPlace(name);
    return () => setPlace(null);
  }, [name]);
}

export const usePagePlace = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => place,
  );

/**
 * The window's title in a community: the place (the page's own, else `fallback`, the
 * page's name), then the community.
 */
export function useWindowTitle(fallback: string | null, community: string) {
  const named = usePagePlace() ?? fallback;
  useEffect(() => {
    document.title = named ? `${named} · ${community}` : community;
    return () => {
      document.title = "Norless";
    };
  }, [named, community]);
}
