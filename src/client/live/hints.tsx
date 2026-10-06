import { Check } from "lucide-react";
import { Button } from "@heroui/react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useMe } from "../data/me";

/** Classic's hints, in the order they're shown (classic-layout spec). */
const hints = ["goLive", "search", "keys", "project"] as const;
export type HintId = (typeof hints)[number];

/** Where each hint's bubble goes: beside its control, or above one at the bottom. */
const placements: Record<HintId, "end" | "top"> = {
  goLive: "end",
  search: "end",
  keys: "top",
  project: "top",
};

const HintsContext = createContext<
  ((id: HintId) => (element: HTMLElement | null) => void) | null
>(null);

/** A ref for the control a hint is about; nothing outside <Hints>. */
export const useHintAnchor = (id: HintId) => use(HintsContext)?.(id);

/**
 * Shows the team, one at a time, the first hint not yet seen whose control is on the
 * page, in a bubble beside it that covers neither the control nor moves anything.
 * "Got it" hides it for good, with the member's preferences.
 */
export function Hints({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const { me, savePreferences } = useMe();
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
  const current = enabled
    ? hints.find((id) => !seen.includes(id) && anchors[id])
    : undefined;
  const anchor = current && anchors[current];
  return (
    <HintsContext value={register}>
      {children}
      {current && anchor && (
        <Bubble
          key={current}
          id={current}
          anchor={anchor}
          onDone={() =>
            me &&
            savePreferences({
              ...me.preferences,
              hints: [...seen, current],
            })
          }
        />
      )}
    </HintsContext>
  );
}

const WIDTH = 288;

function Bubble({
  id,
  anchor,
  onDone,
}: {
  id: HintId;
  anchor: HTMLElement;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [rect, setRect] = useState(() => anchor.getBoundingClientRect());
  useEffect(() => {
    const update = () => setRect(anchor.getBoundingClientRect());
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    window.addEventListener("resize", update);
    // Columns scroll on their own.
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor]);
  const room = window.innerWidth - WIDTH - 8;
  const style: React.CSSProperties =
    placements[id] === "top"
      ? {
          left: Math.max(8, Math.min(rect.left, room)),
          bottom: window.innerHeight - rect.top + 8,
        }
      : { left: Math.max(8, Math.min(rect.right + 8, room)), top: rect.top };
  return (
    <div
      role="note"
      aria-label={t("hints.label")}
      style={{ ...style, width: WIDTH }}
      className="fixed z-40 flex flex-col items-start gap-2 rounded-xl bg-accent p-3 text-sm text-accent-foreground shadow-lg"
    >
      <p>{t(`hints.${id}`)}</p>
      <Button size="sm" variant="secondary" onPress={onDone}>
        <Check />
        {t("hints.gotIt")}
      </Button>
    </div>
  );
}
