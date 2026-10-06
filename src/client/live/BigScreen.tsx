import { Button, Modal } from "@heroui/react";
import { Settings, TriangleAlert, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type { LiveView } from "../../server/live/live-view";
import type { Entry } from "../../server/playlists/playlists";
import type { Problem } from "../../server/playlists/problems";
import type { PlaylistTimes } from "../../server/playlists/times";
import type { OnlineMember, StageView } from "../../shared/live";
import type { Screen } from "../../shared/screens";
import { useCommunity, useShows } from "../data/community";
import { live } from "../data/connection";
import { useLiveView } from "../data/room";
import { useChanges } from "../data/changes";
import { useJson } from "../data/fetch";
import { useWindowWidth } from "../data/device";
import { hasRole, useRoles } from "../data/me";
import { PlaylistEnd } from "../playlists/PlaylistHeader";
import { useDescribe } from "../playlists/problems";
import { Overlay } from "../screens/Overlay";
import { ProjectorScreen } from "../screens/Projector";
import { Musicians } from "../stage/Musicians";
import type { Profile } from "../stage/instrument-layouts";
import { StageMonitor } from "../stage/StageMonitor";
import { Vocalists, type VocalistsLayout } from "../stage/Vocalists";
import { DeviceIcon, LanguageMark } from "../ui/icons";
import { clock } from "../ui/time";
import { tierOf } from "./big-screen";
import { EntryParts } from "./ControllerViews";
import { OnlineMembers } from "./OnlineMembers";
import { StageMessage } from "./StageMessage";

/** The size a screen and each device type are drawn at, before they're made small. */
const SCREEN = { width: 1920, height: 1080 };
const DEVICES = {
  phone: { width: 390, height: 844 },
  tablet: { width: 1024, height: 768 },
  laptop: { width: 1440, height: 900 },
};

/**
 * Big screen, for Full HD, QHD and 4K windows: the playlist, the
 * live song with the controls, every screen of the room and every musician's and
 * vocalist's device as they are now, and the room's information. A wider window adds
 * panels; the text stays the app's size.
 */
export function BigScreen({
  list,
  parts,
  liveBar,
  view,
  entries,
  times,
  problems,
}: {
  list: React.ReactNode;
  /** The selected entry's parts, or the song editor. */
  parts: React.ReactNode;
  liveBar: React.ReactNode;
  view: LiveView | undefined;
  entries: Entry[];
  times: PlaylistTimes | null | undefined;
  problems: Problem[];
}) {
  const tier = tierOf(useWindowWidth());
  const shows = useShows();
  // A 4K window at 100% shows the app's text half as big as Full HD's: 125%, and the
  // previews two per row, so they stay about twice Full HD's and fill the height
  //.
  useEffect(() => {
    if (tier !== 3) return;
    const root = document.documentElement;
    root.style.fontSize = "125%";
    return () => {
      root.style.fontSize = "";
    };
  }, [tier]);
  const people = useStageDevices();
  const tiles = shows("stageViews") && <PeopleTiles people={people} />;
  // The next song after what's live, to read ahead (from 4K).
  const liveIndex = entries.findIndex((e) => e.id === view?.entryId);
  const nextSong = entries.slice(liveIndex + 1).find((e) => e.song);
  // At 4K the screens' previews take their share of the width, about twice Full HD's
  //.
  const columns = [
    "minmax(20rem,26rem)",
    "minmax(24rem,1fr)",
    ["minmax(26rem,1.3fr)", "minmax(30rem,1.5fr)", "minmax(30rem,4fr)"][
      tier - 1
    ],
    ...(tier >= 2 ? ["minmax(20rem,1fr)"] : []),
    ...(tier === 3 ? ["minmax(24rem,1fr)"] : []),
    "17rem",
  ];
  return (
    <div
      data-tier={tier}
      className="grid items-start gap-4"
      style={{ gridTemplateColumns: columns.join(" ") }}
    >
      {list}
      <div className="flex min-w-0 flex-col gap-3">
        {liveBar}
        {parts}
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <ScreenPreviews perRow={2} />
        {tier === 1 && tiles}
      </div>
      {tier >= 2 && <div className="min-w-0">{tiles}</div>}
      {tier === 3 && (
        <section className="flex min-w-0 flex-col gap-2">
          <NextSongHeading entry={nextSong} />
          {nextSong && <EntryParts entry={nextSong} view={view} />}
        </section>
      )}
      <RoomColumn
        view={view}
        times={times}
        problems={problems}
        entries={entries}
      />
    </div>
  );
}

/** Members' devices showing a stage view now, from presence. */
function useStageDevices() {
  const { slug } = useCommunity();
  const [online, setOnline] = useState<OnlineMember[]>([]);
  useEffect(
    () =>
      live.subscribe(`presence:${slug}`, (data) =>
        setOnline(data as OnlineMember[]),
      ),
    [slug],
  );
  return online.flatMap((person) =>
    person.views.map((view) => ({ person, view })),
  );
}

/**
 * Draws its content at `width` × `height` and scales it into the tile's width. A scaled
 * box contains even what's fixed to the screen inside it; `inert` keeps clicks out, so
 * a preview never changes what's live.
 */
function Scaled({
  width,
  height,
  children,
  className = "",
}: {
  width: number;
  height: number;
  children: React.ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setScale((entry?.contentRect.width ?? 0) / width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);
  return (
    <div
      ref={box}
      className={`relative w-full overflow-hidden rounded-lg ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div
        inert
        className="absolute start-0 top-0 origin-top-left"
        style={{ width, height, transform: `scale(${scale})` }}
      >
        {scale > 0 && children}
      </div>
    </div>
  );
}

/** A screen of the room, as it shows now, with its settings. */
function ScreenContent({ screen }: { screen: Screen }) {
  const community = useCommunity();
  if (screen.type === "stage")
    return (
      <StageMonitor
        slug={community.slug}
        languages={screen.languages}
        fallback={community.languages}
        settings={screen.settings}
        preview
      />
    );
  if (screen.type === "overlay")
    return (
      <Overlay
        slug={community.slug}
        languages={screen.languages}
        settings={screen.settings}
        preview
      />
    );
  if (screen.type === "musicians" || screen.type === "vocalists")
    return (
      <div className="dark flex h-full flex-col bg-background text-foreground">
        {screen.type === "musicians" ? (
          <Musicians
            slug={community.slug}
            languages={[...screen.languages, ...community.languages]}
            layout={screen.layout === "chords" ? "chords" : "bar-grid"}
            canControl={false}
          />
        ) : (
          <Vocalists
            slug={community.slug}
            languages={screen.languages}
            layout={
              screen.layout === "sideways" || screen.layout === "tablet"
                ? screen.layout
                : "whole"
            }
            canControl={false}
          />
        )}
      </div>
    );
  return (
    <ProjectorScreen
      slug={community.slug}
      languages={screen.languages}
      fallback={community.languages}
      settings={screen.settings}
      preview
    />
  );
}

/** Every screen of the room, live; without screens set up, a projector per language. */
function ScreenPreviews({ perRow }: { perRow: 2 | 3 }) {
  const { t } = useTranslation();
  const community = useCommunity();
  const screens = useJson<Screen[]>(
    `/api/communities/${community.slug}/screens`,
    useChanges(community.slug, "screens"),
  ).data;
  const [open, setOpen] = useState<Screen | null>(null);
  const shown: Screen[] =
    screens && screens.length > 0
      ? screens
      : community.languages.map((language) => ({
          id: language,
          name: t("controller.preview", { language }),
          type: "projector",
          languages: [language],
          layout: null,
          settings: {},
          secret: "",
        }));
  return (
    <section
      aria-label={t("bigScreen.screens")}
      className={`grid gap-3 ${perRow === 3 ? "grid-cols-3" : "grid-cols-2"}`}
    >
      {shown.map((screen) => (
        <Tile
          key={screen.id}
          label={
            <>
              <span className="truncate">{screen.name}</span>
              {screen.languages.map((l) => (
                <LanguageMark key={l} language={l} />
              ))}
            </>
          }
          name={screen.name}
          onOpen={() => setOpen(screen)}
        >
          <Scaled {...SCREEN} className="bg-neutral-800">
            <ScreenContent screen={screen} />
          </Scaled>
        </Tile>
      ))}
      {open && (
        <Closer title={open.name} onClose={() => setOpen(null)}>
          <Scaled {...SCREEN} className="bg-neutral-800">
            <ScreenContent screen={open} />
          </Scaled>
          <ScreenTools screen={open} />
        </Closer>
      )}
    </section>
  );
}

/** Under an enlarged screen: its settings for owners, the message for the stage. */
function ScreenTools({ screen }: { screen: Screen }) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const message = useLiveView(slug)?.message ?? null;
  const owner = hasRole(useRoles(slug), "owner");
  return (
    <div className="flex flex-wrap items-center gap-3">
      {screen.type === "stage" && <StageMessage message={message} />}
      {owner && screen.secret && (
        <Link href="/settings/screens" className="link flex items-center gap-1">
          <Settings className="size-4" />
          {t("bigScreen.screenSettings")}
        </Link>
      )}
    </div>
  );
}

/** A tile per device with a musicians or vocalists view open, drawing what it shows. */
function PeopleTiles({
  people,
}: {
  people: { person: OnlineMember; view: StageView & { id: number } }[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<(typeof people)[number] | null>(null);
  const label = ({ person, view }: (typeof people)[number]) =>
    t("bigScreen.device", {
      name: person.name,
      layout: t(
        `${view.view === "musicians" ? "musicians" : "vocalists"}.layouts.${view.layout}`,
      ),
      device: t(`device.${view.device}`),
    });
  return (
    <section
      aria-label={t("bigScreen.people")}
      // Readable at a glance; with many devices they wrap.
      className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3"
    >
      {people.length === 0 && (
        <p className="col-span-full text-sm text-muted">
          {t("bigScreen.nobody")}
        </p>
      )}
      {people.map((one) => (
        <Tile
          key={one.view.id}
          label={
            <>
              <DeviceIcon type={one.view.device} className="size-4 shrink-0" />
              <span className="truncate">{label(one)}</span>
            </>
          }
          name={label(one)}
          onOpen={() => setOpen(one)}
        >
          <Scaled {...DEVICES[one.view.device]}>
            <DeviceContent view={one.view} />
          </Scaled>
        </Tile>
      ))}
      {open && (
        <Closer title={label(open)} onClose={() => setOpen(null)}>
          <div className="mx-auto w-full max-w-md">
            <Scaled {...DEVICES[open.view.device]}>
              <DeviceContent view={open.view} />
            </Scaled>
          </div>
        </Closer>
      )}
    </section>
  );
}

/** What a member's stage view shows: its layout, languages, colors and text size. */
function DeviceContent({ view }: { view: StageView }) {
  const { slug } = useCommunity();
  return (
    <div
      className={`${view.dark ? "dark" : "light"} flex h-full flex-col bg-background text-foreground`}
    >
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ zoom: view.textSize }}
      >
        {view.view === "musicians" ? (
          <Musicians
            slug={slug}
            languages={view.languages}
            layout={view.layout}
            canControl={false}
            profile={view.profile as Profile | undefined}
          />
        ) : (
          <Vocalists
            slug={slug}
            languages={view.languages}
            layout={view.layout as VocalistsLayout}
            canControl={false}
          />
        )}
      </div>
    </div>
  );
}

/** A preview with its label; a click opens it larger. */
function Tile({
  label,
  name,
  onOpen,
  children,
}: {
  label: React.ReactNode;
  name: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("bigScreen.open", { name })}
      className="flex min-w-0 cursor-pointer flex-col gap-1 rounded-xl p-1 text-start outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
    >
      {children}
      <span className="flex min-w-0 items-center gap-1 text-xs text-muted">
        {label}
      </span>
    </button>
  );
}

/** A preview larger, in a dialog; Esc closes it, and keys behind it still move live. */
function Closer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container className="max-w-[min(90vw,1600px)]">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3">{children}</Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function NextSongHeading({ entry }: { entry: Entry | undefined }) {
  const { t } = useTranslation();
  return (
    <h3 className="text-sm font-semibold text-muted">
      {entry ? t("bigScreen.nextSong") : t("bigScreen.noNextSong")}
    </h3>
  );
}

/** The room at a glance: the time, service or rehearsal, the end, problems, who's here. */
function RoomColumn({
  view,
  times,
  problems,
  entries,
}: {
  view: LiveView | undefined;
  times: PlaylistTimes | null | undefined;
  problems: Problem[];
  entries: Entry[];
}) {
  const { t, i18n } = useTranslation();
  const shows = useShows();
  const describe = useDescribe(entries);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <aside
      aria-label={t("bigScreen.room")}
      className="sticky top-4 flex flex-col gap-3 rounded-xl border border-separator p-3"
    >
      <p className="text-4xl font-semibold tabular-nums">
        {clock(now, i18n.language)}
      </p>
      {view && <p>{t(`live.${view.mode}`)}</p>}
      {shows("times") && <PlaylistEnd times={times} />}
      {shows("problems") && (
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-muted">
            {t("bigScreen.problems", { count: problems.length })}
          </h3>
          {/* Each with its song, in text that reads 4.5:1. */}
          <ul className="flex flex-col gap-1 text-sm">
            {problems.map((problem, i) => (
              <li key={i} className="flex gap-1.5">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                {describe(problem)}
              </li>
            ))}
          </ul>
        </section>
      )}
      {shows("presence") && (
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-muted">
            {t("bigScreen.here")}
          </h3>
          <OnlineMembers />
        </section>
      )}
    </aside>
  );
}
