import { Check, Sparkles } from "lucide-react";
import { Button, Modal } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { type Feature, newlyOn } from "../../shared/features";
import { switchesOf, useCommunity } from "../data/community";
import { featureIcons } from "../ui/icons";
import { useMe } from "../data/me";

const key = (slug: string) => `norless:seen-switches:${slug}`;
// Storage can be unavailable (private windows, blocked site data).
const readSeen = (slug: string): string[] | undefined => {
  try {
    const value = localStorage.getItem(key(slug));
    return value ? (JSON.parse(value) as string[]) : undefined;
  } catch {
    return undefined;
  }
};
const writeSeen = (slug: string, seen: string[]) => {
  try {
    localStorage.setItem(key(slug), JSON.stringify(seen));
  } catch {
    // Shown again next time.
  }
};

/**
 * Once more features are on, a bubble with how many, whose dialog says what they add,
 * once per member (with the account) or visitor (on the device), each feature by its
 * name. A first visit only notes what's on.
 */
export function WhatsNew() {
  const community = useCommunity();
  const { slug } = community;
  const { me, savePreferences } = useMe();
  const [visitorSeen, setVisitorSeen] = useState(() => readSeen(slug));
  const seen = me?.user ? me.preferences.seenSwitches?.[slug] : visitorSeen;
  const on = switchesOf(community);
  const remember = (value: string[]) => {
    if (!me) return;
    if (me.user)
      savePreferences({
        ...me.preferences,
        seenSwitches: { ...me.preferences.seenSwitches, [slug]: value },
      });
    else {
      writeSeen(slug, value);
      setVisitorSeen(value);
    }
  };
  // Nothing to announce to someone who never saw the community: what's on is noted.
  const first = !!me && seen === undefined;
  useEffect(() => {
    if (!first || !me) return;
    if (me.user)
      savePreferences({
        ...me.preferences,
        seenSwitches: { ...me.preferences.seenSwitches, [slug]: [...on] },
      });
    else writeSeen(slug, [...on]);
  });

  const news =
    me && seen !== undefined ? newlyOn(new Set(seen), on) : undefined;
  const count = news?.length ?? 0;
  // What the dialog shows, kept while it's open: opening it counts as seen.
  const [shown, setShown] = useState<News | null>(null);
  return (
    <>
      {news && count > 0 && !shown && (
        <Bubble
          count={count}
          onOpen={() => {
            setShown(news);
            remember([...new Set([...(seen ?? []), ...on])]);
          }}
        />
      )}
      {shown && <NewsDialog news={shown} onClose={() => setShown(null)} />}
    </>
  );
}

type News = Feature[];

/** Where the bubble sits on this device: a side, and its center's height in the window. */
type Place = { side: "left" | "right"; y: number };
const PLACE = "norless:whatsNewPlace";
const readPlace = (): Place => {
  try {
    const place = JSON.parse(localStorage.getItem(PLACE) ?? "null") as Place;
    if (place && (place.side === "left" || place.side === "right"))
      return place;
  } catch {
    // The default place.
  }
  // At the left, a third of the way up: over the playlist's times, not the rows' ⋯
  // at the right, and above a phone's live bar.
  return { side: "left", y: 0.66 };
};
const SIZE = 56;
const MARGIN = 12;

/**
 * A round button floating over the page with how many things are new; dragged, it snaps
 * to the nearer side and stays there on this device (feature-switches spec, What's new).
 */
function Bubble({ count, onOpen }: { count: number; onOpen: () => void }) {
  const { t } = useTranslation();
  const [place, setPlace] = useState(readPlace);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // A drag ends with a click, which shouldn't open the dialog.
  const dragged = useRef(false);
  const top = drag
    ? drag.y - SIZE / 2
    : `calc(${Math.min(Math.max(place.y, 0.1), 0.9) * 100}% - ${SIZE / 2}px)`;
  const left = drag
    ? drag.x - SIZE / 2
    : place.side === "left"
      ? MARGIN
      : `calc(100% - ${SIZE + MARGIN}px)`;
  return (
    <button
      type="button"
      aria-label={t("whatsNew.open", { count })}
      className={`fixed z-40 grid touch-none place-items-center rounded-full bg-accent text-accent-foreground shadow-lg outline-none select-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${
        drag ? "cursor-grabbing" : "motion-safe:transition-[left,top]"
      }`}
      style={{ width: SIZE, height: SIZE, top, left }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        press.current = { x: event.clientX, y: event.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        const start = press.current;
        if (!start) return;
        const far =
          Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6;
        if (!start.moved && !far) return;
        start.moved = true;
        setDrag({ x: event.clientX, y: event.clientY });
      }}
      onPointerUp={(event) => {
        const start = press.current;
        press.current = null;
        if (!start?.moved) return;
        dragged.current = true;
        const next: Place = {
          side: event.clientX < window.innerWidth / 2 ? "left" : "right",
          y: event.clientY / window.innerHeight,
        };
        setPlace(next);
        setDrag(null);
        try {
          localStorage.setItem(PLACE, JSON.stringify(next));
        } catch {
          // Here until the page reloads.
        }
      }}
      onClick={() => {
        if (dragged.current) dragged.current = false;
        else onOpen();
      }}
    >
      <Sparkles className="size-6" />
      <span className="absolute -end-1 -top-1 min-w-5 rounded-full bg-foreground px-1 text-center text-xs leading-5 font-semibold text-background">
        {count}
      </span>
    </button>
  );
}

/** What's new: each feature with what it adds, and where it is in the graph. */
function NewsDialog({ news, onClose }: { news: News; onClose: () => void }) {
  const { t } = useTranslation();
  const names = news.map((f) => t(`features.${f}.name`));
  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>
              {names.length > 2
                ? t("whatsNew.many", { count: names.length })
                : t("whatsNew.new", { names: names.join(", ") })}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <ul className="flex flex-col gap-4">
              {news.map((f) => {
                const Icon = featureIcons[f];
                return (
                  <li key={f} className="flex flex-col gap-1">
                    {/* Its name leads to it in the feature graph, instead of a link
                        repeated under each (fix-ui-review-rest). */}
                    <Link
                      href={`/features?feature=${f}`}
                      className="link font-semibold"
                      onClick={onClose}
                    >
                      <Icon aria-hidden />
                      {t(`features.${f}.name`)}
                    </Link>
                    <span>{t(`features.${f}.adds`)}</span>
                  </li>
                );
              })}
            </ul>
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onClose}>
              <Check />
              {t("whatsNew.gotIt")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
