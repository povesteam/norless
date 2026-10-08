import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Church,
  Circle,
  Drum,
  Eye,
  EyeOff,
  MonitorCog,
} from "lucide-react";
import { TempoButton } from "../stage/TempoListener";
import { RecordButton } from "../stage/Recorder";
import { Button, Chip } from "@heroui/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tip } from "../ui/tip";
import type { LiveView } from "../../server/live/live-view";
import { formatReference } from "../../shared/bible";
import { titleFor } from "../../shared/song-render";
import { partLabels } from "../../shared/song-text";
import { BibleComSync } from "../playlists/BibleCom";
import { useCommunity, useShows } from "../data/community";
import { useDeviceType } from "../data/device";
import { useMe } from "../data/me";
import { liveSlides, sendLive, useLocal } from "../data/room";
import { MediaKeys } from "./MediaKeys";
import { ScreenLauncher } from "./ScreenLauncher";
import { RoomMenu } from "./PracticeRooms";
import { clock } from "../ui/time";
import { usePartName } from "../stage/parts";
import { LocalProjection, type ProjectHere } from "./LocalProjection";
import { Pages } from "./Pages";
import { StageMessage } from "./StageMessage";

/** What's live, as the live bar and the media keys name it: its title and the part. */
export function useLiveTitle(view: LiveView | undefined) {
  const { i18n } = useTranslation();
  const community = useCommunity();
  const partName = usePartName();
  const song = view?.song;
  const slides = useMemo(
    () => (song ? liveSlides(song, community.languages) : []),
    [song, community.languages],
  );
  const labels = partLabels(slides);
  const live = view?.entry;
  const title = live?.song
    ? titleFor(live.song.titles, [i18n.language, ...community.languages])
    : live?.bible
      ? formatReference(live.bible, i18n.language)
      : (live?.text?.split("\n")[0]?.replace(/^#+\s*/, "") ?? "");
  const slide = view?.slide ?? 0;
  const where = live?.song
    ? partName(slides[slide], labels[slide] ?? "")
    : title;
  return { live, slides, labels, title, where };
}

/** Whether this phone shows the whole live bar (live-control spec). */
const OPENED = "norless:liveBarOpened";
/** Whether this device's section of the live panel is open. */
const SETUP_OPENED = "norless:thisDeviceOpened";

/**
 * For the team, at the bottom of the playlist: the live entry and its parts, previous,
 * next and blank, the mode, and who changed it last. When someone else changes it, it
 * says who and to what for a few seconds ("Ioana → Verse 2"). On a phone, only the title
 * and previous, blank and next, until it's opened.
 */
export function LiveBar({
  view,
  side = false,
  big = false,
  project,
  split = false,
}: {
  view: LiveView | undefined;
  /** Projecting here, where the page can. */
  project?: ProjectHere;
  /** In a column beside the playlist, instead of a bar at the bottom. */
  side?: boolean;
  /** Large buttons, for touch. */
  big?: boolean;
  /** Without Pages, the stage message and this device's section: see LiveExtras. */
  split?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const community = useCommunity();
  const me = useMe().me?.user?.id;
  const shows = useShows();
  const partName = usePartName();
  // Projecting locally, only the slides: modes, messages, pages and screens are the room's.
  const local = useLocal()?.slug === community.slug;
  const { live, slides, labels, title, where } = useLiveTitle(view);
  const act = (action: Parameters<typeof sendLive>[1]) =>
    void sendLive(community.slug, action, "button");
  // On a phone, the bottom bar is compact unless opened, so the playlist keeps the screen.
  const phone = useDeviceType().deviceType === "phone";
  const [opened, setOpened] = useState(() => {
    try {
      return localStorage.getItem(OPENED) === "1";
    } catch {
      return false;
    }
  });
  const compact = phone && !side && !opened;
  const toggle = () => {
    setOpened(!opened);
    try {
      localStorage.setItem(OPENED, opened ? "0" : "1");
    } catch {
      // Opened until the page reloads.
    }
  };
  // Someone else's change shows for a few seconds.
  const [notice, setNotice] = useState<string | null>(null);
  const changedAt = view?.changedAt;
  const by = view?.changedBy;
  const [seen, setSeen] = useState(changedAt);
  if (changedAt !== seen) {
    setSeen(changedAt);
    if (by && by.userId !== me && shows("presence"))
      setNotice(t("live.changedBy", { name: by.name, part: where }));
  }
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice, changedAt]);

  const titleBar = useOpensBy(phone && !side, opened, toggle);
  if (!view) return null;
  const toggleButton = phone && !side && (
    <Button
      size="sm"
      variant="ghost"
      isIconOnly
      aria-expanded={opened}
      aria-label={t(opened ? "live.fewerControls" : "live.moreControls")}
      onPress={toggle}
    >
      {opened ? <ChevronDown /> : <ChevronUp />}
    </Button>
  );
  const buttons = (
    <div
      // Blank fits its longest label; where the three don't fit, icons only.
      className={`@container grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 ${
        compact
          ? "[&_button]:h-14 [&_button]:text-lg"
          : big
            ? "[&_button]:h-16 [&_button]:text-lg"
            : ""
      }`}
    >
      {/* Their names in a tooltip too, where a narrow bar shows only their icons. */}
      <Tip label={t("live.previous")}>
        <Button
          fullWidth
          variant="secondary"
          onPress={() => act({ type: "previous" })}
        >
          <ChevronLeft />
          <span className="@max-md:sr-only">{t("live.previous")}</span>
        </Button>
      </Tip>
      <BlankButton
        blank={view.blank}
        onPress={() => act({ type: "blank", blank: !view.blank })}
        labelClassName="@max-md:sr-only"
      />
      <Tip label={t("live.next")}>
        <Button fullWidth onPress={() => act({ type: "next" })}>
          <span className="@max-md:sr-only">{t("live.next")}</span>
          <ChevronRight />
        </Button>
      </Tip>
    </div>
  );
  const titleText = live ? (
    <>
      <span className="font-semibold">{title}</span>
      {view.blank && (
        <Chip size="sm" className="ms-2" color="warning" variant="soft">
          {t("live.blanked")}
        </Chip>
      )}
    </>
  ) : (
    <span className="text-muted">{t("live.nothing")}</span>
  );
  const barClass =
    "sticky bottom-0 z-10 -mx-4 mt-auto flex flex-col gap-2 border-t border-separator bg-background px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]";

  if (compact)
    return (
      <div data-bottom-bar className={barClass}>
        <div
          {...titleBar}
          className={`flex items-center gap-2 ${titleBar.className ?? ""}`}
        >
          {toggleButton}
          {/* Projecting here, its window and Stop stay at hand. */}
          {local && project && <LocalProjection {...project} narrow />}
          {/* Someone else's change takes the title's place for a few seconds: one cell, so nothing moves. */}
          <span className="grid min-w-0 flex-1 *:[grid-area:1/1]">
            <span className={`truncate ${notice ? "invisible" : ""}`}>
              {titleText}
            </span>
            <span
              aria-live="polite"
              className="truncate text-sm font-semibold text-warning-soft-foreground"
            >
              {notice}
            </span>
          </span>
        </div>
        {buttons}
      </div>
    );

  return (
    <div
      data-bottom-bar={side ? undefined : true}
      className={
        side
          ? "flex flex-col gap-3 rounded-xl border border-separator p-3"
          : barClass
      }
    >
      <div
        {...titleBar}
        className={`flex flex-wrap items-center gap-2 ${titleBar.className ?? ""}`}
      >
        {toggleButton}
        {/* Wide enough to read: the buttons wrap below it instead. */}
        <span className="min-w-24 flex-1 truncate">{titleText}</span>
        <div className={setupRow}>
          {project && <LocalProjection {...project} narrow />}
          {!local && shows("screenMenu") && <ScreenLauncher />}
        </div>
        {by && view.changedAt && shows("presence") && (
          <span className="text-xs text-muted">
            {t("live.lastChange", {
              name: by.name,
              time: clock(view.changedAt, i18n.language),
            })}
          </span>
        )}
      </div>
      {slides.length > 0 && (
        <div
          role="group"
          aria-label={t("live.parts")}
          className="flex flex-wrap gap-1"
        >
          {labels.map((label, i) => (
            <Button
              key={i}
              size="sm"
              isIconOnly={label.length <= 2}
              variant={i === view.slide ? "primary" : "secondary"}
              aria-label={partName(slides[i], label)}
              aria-pressed={i === view.slide}
              onPress={() =>
                live &&
                void sendLive(
                  community.slug,
                  { type: "go", entryId: live.id, slide: i },
                  "part",
                )
              }
            >
              {label}
            </Button>
          ))}
        </div>
      )}
      {buttons}
      <div
        aria-live="polite"
        className="text-sm font-semibold text-warning-soft-foreground"
      >
        {notice}
      </div>
      {!split && <LiveExtras view={view} />}
    </div>
  );
}

/**
 * The live panel's other controls: Pages, the message to the stage, and this device's
 * section, folded. With the panel's `split`, a page places them itself, e.g. under the
 * slides on a tablet.
 */
export function LiveExtras({ view }: { view: LiveView | undefined }) {
  const { t } = useTranslation();
  const community = useCommunity();
  const me = useMe().me?.user?.id;
  const shows = useShows();
  const local = useLocal()?.slug === community.slug;
  // This device's section, open or folded, per device.
  const setupId = useId();
  const [setup, setSetup] = useState(() => {
    try {
      return localStorage.getItem(SETUP_OPENED) === "1";
    } catch {
      return false;
    }
  });
  const toggleSetup = () => {
    setSetup(!setup);
    try {
      localStorage.setItem(SETUP_OPENED, setup ? "0" : "1");
    } catch {
      // Open until the page reloads.
    }
  };

  if (!view) return null;
  return (
    <>
      {!local && (
        <>
          <Pages live={view.page?.id ?? null} />
          {shows("stageViews") && (
            <StageMessage message={view.message ?? null} />
          )}
        </>
      )}
      {!local && shows("screens") && <BibleComSync view={view} />}
      {/* What concerns this device and the room's setup, folded (live-control spec, This
          device). Hidden, not removed, so a recording or listening goes on. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={setup}
          aria-controls={setupId}
          onPress={toggleSetup}
        >
          <MonitorCog />
          {t("live.thisDevice")}
          {setup ? <ChevronUp /> : <ChevronDown />}
        </Button>
        {!setup && view.recording && (
          <Chip size="sm" color="danger" variant="soft">
            <Circle className="size-2 fill-current" />
            {t("recordings.on")}
          </Chip>
        )}
        {!setup && view.tempo?.listenerId === me && (
          <Chip size="sm" variant="soft">
            <Activity />
            {t("tempo.listeningAt", { bpm: view.tempo?.measured ?? "––" })}
          </Chip>
        )}
      </div>
      <div id={setupId} hidden={!setup} className={setupRow}>
        <MediaKeys view={view} narrow />
        {!local && (
          <>
            {/* Status only: the schedule sets it; an unplanned service is a one-off event. */}
            <Chip
              size="sm"
              variant="soft"
              aria-label={t("live.modeLabel", {
                mode: t(`live.${view.mode}`),
              })}
            >
              {view.mode === "service" ? <Church /> : <Drum />}
              {t(`live.${view.mode}`)}
            </Chip>
            {shows("practiceRooms") && <RoomMenu />}
            {shows("recordings") && <RecordButton slug={community.slug} />}
            {shows("tempoCheck") && (
              <TempoButton
                slug={community.slug}
                view={view}
                settings={community.tempoCheck}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

/**
 * A phone's live bar opens and folds by its title too: a tap, or a drag of 24 pixels up
 * to open and down to fold. The arrow button stays for the keyboard and screen readers,
 * and the row's other buttons keep their own taps.
 */
function useOpensBy(
  on: boolean,
  opened: boolean,
  toggle: () => void,
): React.HTMLAttributes<HTMLDivElement> {
  const from = useRef<number | null>(null);
  // A drag ends with a click, which mustn't toggle again.
  const dragged = useRef(false);
  if (!on) return {};
  const onButton = (target: EventTarget) =>
    !!(target as Element).closest("button, a, input");
  return {
    // Unselectable: a drag that selected the title would make the next drag one of the
    // selected text, which cancels the pointer events.
    className: "cursor-pointer touch-none select-none",
    onClick: (event: React.MouseEvent) => {
      if (dragged.current) dragged.current = false;
      else if (!onButton(event.target)) toggle();
    },
    onPointerDown: (event: React.PointerEvent) => {
      if (onButton(event.target)) return;
      from.current = event.clientY;
      dragged.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (from.current === null) return;
      const by = event.clientY - from.current;
      if (Math.abs(by) < 24) return;
      from.current = null;
      dragged.current = true;
      if (by < 0 !== opened) toggle();
    },
    onPointerUp: () => {
      from.current = null;
    },
  };
}

// On a phone, one row that scrolls sideways, so the bar keeps its height.
const setupRow =
  "flex items-center gap-2 max-[749px]:w-full max-[749px]:overflow-x-auto max-[749px]:py-1 min-[750px]:flex-wrap [&>*]:shrink-0";

/**
 * Blank, or Show again while blank. Both labels sit in one cell, the other hidden, so
 * the button keeps its width when it switches.
 */
export function BlankButton({
  blank,
  onPress,
  labelClassName = "",
  isDisabled = false,
}: {
  blank: boolean;
  onPress: () => void;
  isDisabled?: boolean;
  /** E.g. to hide the label on narrow screens. */
  labelClassName?: string;
}) {
  const { t } = useTranslation();
  return (
    // Its name in a tooltip too, where only its icon shows.
    <Tip label={t(blank ? "live.show" : "live.blank")}>
      <Button
        variant={blank ? "primary" : "secondary"}
        isDisabled={isDisabled}
        onPress={onPress}
      >
        {blank ? <Eye /> : <EyeOff />}
        {/* Both labels in one cell, at the icon's side. */}
        <span
          className={`grid justify-items-start *:[grid-area:1/1] ${labelClassName}`}
        >
          <span className={blank ? "invisible" : undefined}>
            {t("live.blank")}
          </span>
          <span className={blank ? undefined : "invisible"}>
            {t("live.show")}
          </span>
        </span>
      </Button>
    </Tip>
  );
}
