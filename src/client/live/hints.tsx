import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useMe } from "../data/me";

/** Classic's hints, in the order they're listed (classic-layout spec). */
const hints = ["goLive", "search", "keys", "project"] as const;
export type HintId = (typeof hints)[number];

const HintsContext = createContext<
  ((id: HintId) => (element: HTMLElement | null) => void) | null
>(null);

/** A ref for the control a hint is about; nothing outside <Hints>. */
export const useHintAnchor = (id: HintId) => use(HintsContext)?.(id);

/** The hints this page offers now, which the What's new bubble holds as its tips. */
let tips: readonly HintId[] = [];
const listeners = new Set<() => void>();
const setTips = (next: readonly HintId[]) => {
  if (next.join() === tips.join()) return;
  tips = next;
  for (const listener of listeners) listener();
};
export const usePageTips = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => tips,
  );

/**
 * Notes, for the team, the hints not yet seen whose control is on the page; they wait in
 * the What's new bubble instead of covering the page (What's new marks them seen).
 */
export function Hints({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const { me } = useMe();
  const [anchors, setAnchors] = useState<Partial<Record<HintId, HTMLElement>>>(
    {},
  );
  // One stable callback ref per hint, so React doesn't detach and attach it each render.
  const refs = useRef(new Map<HintId, (element: HTMLElement | null) => void>());
  const register = useCallback((id: HintId) => {
    let ref = refs.current.get(id);
    if (!ref) {
      ref = (element) =>
        setAnchors((all) =>
          (all[id] ?? null) === element
            ? all
            : { ...all, [id]: element ?? undefined },
        );
      refs.current.set(id, ref);
    }
    return ref;
  }, []);
  const seen = me?.preferences.hints ?? [];
  const offered = enabled
    ? hints.filter((id) => !seen.includes(id) && anchors[id])
    : [];
  const key = offered.join();
  useEffect(() => {
    setTips(key ? (key.split(",") as HintId[]) : []);
    return () => setTips([]);
  }, [key]);
  return <HintsContext value={register}>{children}</HintsContext>;
}
