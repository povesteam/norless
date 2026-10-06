import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { RecordingMark } from "./Recorder";
import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { LanguageMark, LayoutIcon } from "../ui/icons";
import { Link } from "wouter";
import type { LiveView } from "../../server/live/live-view";
import type { Song } from "../../server/songs/songs";
import { titleFor } from "../../shared/song-render";
import { parseSong, partLabels, type Slide } from "../../shared/song-text";
import { type Community, switchesOf } from "../data/community";
import { shows } from "../../shared/features";
import { TodayBadge } from "../team/MyNextLine";
import { StageLookMenu, useStageLook } from "./StageLook";
import { useBarColor } from "../ui/full-screen";
import { useDeviceType, useLayout } from "../data/device";
import { useLayoutShown, useUsageCommunity } from "../data/usage";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { StageNotice, StageSlides, usePartName } from "./parts";
import { useReportStageView } from "./report";
import { Tip } from "../ui/tip";
import { hasRole, useMe, useRoles } from "../data/me";
import { Fit, SlideText } from "../screens/Projector";
import { sendLive, useLiveView } from "../data/room";
import { LedByIcon } from "../playlists/LedBy";
import { useLookAhead } from "./LookAhead";
import { RoomChip } from "../live/PracticeRooms";

export const vocalistsLayouts = [
  { id: "whole", devices: ["phone", "tablet", "laptop"] },
  { id: "sideways", devices: ["phone"] },
  { id: "tablet", devices: ["tablet", "laptop"] },
] as const;
export type VocalistsLayout = (typeof vocalistsLayouts)[number]["id"];

/** /<community>/vocalists: the vocalists view on a member's own device, in their layout. */
export function VocalistsPage({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation();
  const community = useJson<Community>(
    `/api/communities/${encodeURIComponent(slug)}`,
    useChanges(slug, "communities"),
  ).data;
  const languages = community?.languages ?? [];
  const look = useStageLook();
  const { layout, setLayout } = useLayout("vocalists", vocalistsLayouts);
  const root = useRef<HTMLDivElement>(null);
  useBarColor(root, look.className);
  useUsageCommunity(slug);
  useLayoutShown("vocalists", layout?.id);
  const { deviceType } = useDeviceType();
  const offered = vocalistsLayouts.filter((l) =>
    (l.devices as readonly string[]).includes(deviceType),
  );
  const canControl = hasRole(useRoles(slug), "team");
  const { me } = useMe();
  // The member's language by default; any community language, or all of them.
  const [shown, setShown] = useState<string>();
  const own = languages.includes(i18n.language)
    ? i18n.language
    : (languages[0] ?? "ro");
  const choice = shown ?? own;
  useReportStageView(
    slug,
    me?.user
      ? {
          view: "vocalists",
          layout: layout?.id ?? "whole",
          languages: choice === "all" ? languages : [choice],
          textSize: look.textSize,
          dark: look.className === "dark",
          device: deviceType,
        }
      : null,
  );
  return (
    <div
      ref={root}
      className={`${look.className} fixed inset-0 flex flex-col bg-background text-foreground`}
    >
      {/* One row of icons, so the song has the room. */}
      <header className="flex items-center gap-2 overflow-x-auto border-b border-separator px-3 py-2">
        <Link
          href={`~/${slug}`}
          aria-label={community?.name ?? t("musicians.back")}
          className="link shrink-0"
        >
          <ArrowLeft />
        </Link>
        <RoomChip slug={slug} />
        {me?.user &&
          community &&
          shows(switchesOf(community), "serviceRoles") && (
            <TodayBadge slug={slug} />
          )}
        {languages.length > 1 && (
          <ToggleButtonGroup
            aria-label={t("vocalists.languages")}
            selectionMode="single"
            disallowEmptySelection
            size="sm"
            selectedKeys={[choice]}
            onSelectionChange={(keys) => {
              const [key] = keys;
              if (key !== undefined) setShown(String(key));
            }}
          >
            {[...languages, "all"].map((l, i) => (
              <ToggleButton key={l} id={l}>
                {i > 0 && <ToggleButtonGroup.Separator />}
                {l === "all" ? (
                  t("vocalists.all")
                ) : (
                  <LanguageMark language={l} />
                )}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
        <ToggleButtonGroup
          aria-label={t("musicians.layout")}
          selectionMode="single"
          disallowEmptySelection
          size="sm"
          selectedKeys={[layout?.id ?? "whole"]}
          onSelectionChange={(keys) => {
            const [key] = keys;
            if (key !== undefined) setLayout(String(key));
          }}
          // Round icons apart, like the row's other buttons: no divider between them.
          className="ms-auto shrink-0 gap-2"
        >
          {offered.map((l) => (
            <Tip key={l.id} label={t(`vocalists.layouts.${l.id}`)}>
              <ToggleButton
                id={l.id}
                isIconOnly
                aria-label={t(`vocalists.layouts.${l.id}`)}
              >
                <LayoutIcon id={l.id} />
              </ToggleButton>
            </Tip>
          ))}
        </ToggleButtonGroup>
        <StageLookMenu />
      </header>
      {/* The text size scales the whole layout, as reading glasses would. */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ zoom: look.textSize }}
      >
        <Vocalists
          slug={slug}
          languages={choice === "all" ? languages : [choice]}
          layout={layout?.id ?? "whole"}
          canControl={canControl}
          lookAhead
          leader={!!community && shows(switchesOf(community), "serviceRoles")}
        />
      </div>
    </div>
  );
}

/**
 * What singers need of the live song: every part whole, the live one in view and the
 * next one marked, in one or several languages. The team gets previous and next, and a
 * tap on a part sends it live; a touch that starts a scroll doesn't.
 */
export function Vocalists({
  slug,
  languages,
  layout,
  canControl,
  lookAhead = false,
  leader = false,
}: {
  slug: string;
  languages: string[];
  layout: VocalistsLayout;
  canControl: boolean;
  /** Who leads the song, when the service roles are switched on. */
  leader?: boolean;
  /** On a member's own device: earlier and later songs, privately. */
  lookAhead?: boolean;
}) {
  const { t } = useTranslation();
  const live = useLiveView(slug);
  const ahead = useLookAhead(slug, lookAhead ? live : undefined, languages);
  const view = lookAhead ? ahead.shown : live;
  // A part of a song looked at privately doesn't go live.
  const onPart =
    canControl && !ahead.looking && view?.entryId
      ? (slide: number) =>
          void sendLive(
            slug,
            { type: "go", entryId: view.entryId ?? "", slide },
            "part",
          )
      : undefined;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <StageNotice message={view?.message} />
      {lookAhead && ahead.bar}
      {/* A steady line: who leads the song comes and goes with the songs. */}
      <div className="flex min-h-7 flex-wrap items-center gap-3 px-4 pt-2">
        <RecordingMark view={view} />
        {view?.ledBy && leader && (
          <span className="flex items-center gap-1 text-lg">
            <LedByIcon aria-hidden className="size-4" />
            {t("team.ledBy", { name: view.ledBy })}
          </span>
        )}
      </div>
      {view?.entry?.kind === "slides" ? (
        <div className="p-4">
          <StageSlides view={view} languages={languages} />
        </div>
      ) : view?.song ? (
        <Parts
          view={view}
          song={view.song}
          languages={languages}
          layout={layout}
          onPart={onPart}
          slug={slug}
        />
      ) : (
        <p className="p-4 text-muted">{t("musicians.noSong")}</p>
      )}
      {canControl && (
        <div className="grid grid-cols-2 gap-2 border-t border-separator p-2">
          <Button
            size="lg"
            fullWidth
            variant="secondary"
            onPress={() => void sendLive(slug, { type: "previous" }, "button")}
          >
            <ChevronLeft />
            {t("live.previous")}
          </Button>
          <Button
            size="lg"
            fullWidth
            onPress={() => void sendLive(slug, { type: "next" }, "button")}
          >
            {t("live.next")}
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}

/** The song's slides in each language, by slide number. */
function slidesIn(song: Song, languages: string[]) {
  const versions = languages
    .map((l) => song.versions.find((v) => v.language === l))
    .filter((v) => v !== undefined);
  const chosen = versions.length > 0 ? versions : song.versions.slice(0, 1);
  return chosen.map((v) => ({
    language: v.language,
    slides: parseSong(v.text).slides,
  }));
}

function Parts({
  view,
  song,
  languages,
  layout,
  onPart,
  slug,
}: {
  view: LiveView;
  song: Song;
  languages: string[];
  layout: VocalistsLayout;
  onPart?: (slide: number) => void;
  slug: string;
}) {
  const { t } = useTranslation();
  const partName = usePartName();
  const versions = slidesIn(song, languages);
  const [main] = versions;
  const slides = main?.slides ?? [];
  const labels = partLabels(slides);
  const live = view.blank ? -1 : Math.min(view.slide, slides.length - 1);
  const label = (i: number) => partName(slides[i], labels[i] ?? "");
  const part = (i: number, big = false) => (
    <PartText versions={versions} index={i} label={label(i)} big={big} />
  );

  // Whole song: keep the live part in view.
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [live, song.id]);

  if (layout === "sideways")
    return (
      <div className="grid min-h-0 flex-1 grid-cols-[3fr_2fr] gap-4 p-4 portrait:grid-cols-1 portrait:grid-rows-[3fr_2fr]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <p className="text-lg font-semibold text-accent">{label(live)}</p>
          <Fit>{slides[live] && <SlideText slide={slides[live]} />}</Fit>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col opacity-60">
          {slides[live + 1] && (
            <>
              <p className="text-lg font-semibold">
                {t("stage.next", { part: label(live + 1) })}
              </p>
              <Fit>
                <SlideText slide={slides[live + 1] as Slide} />
              </Fit>
            </>
          )}
        </div>
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1">
      <div
        ref={list}
        role="list"
        aria-label={t("vocalists.parts")}
        className={`min-h-0 flex-1 overflow-y-auto p-4 ${
          layout === "tablet"
            ? "grid grid-cols-2 content-start gap-3"
            : "flex flex-col gap-3"
        }`}
      >
        {slides.map((_, i) => (
          <PartBox
            key={i}
            active={i === live}
            next={i === live + 1}
            onPress={onPart && (() => onPart(i))}
          >
            {part(i, layout === "whole" && i === live)}
          </PartBox>
        ))}
        {layout === "tablet" && view.next && (
          <NextSong slug={slug} view={view} languages={languages} />
        )}
      </div>
      {layout === "whole" && (
        // A map of the parts along the edge.
        <nav
          aria-label={t("vocalists.map")}
          className="flex flex-col gap-1 overflow-y-auto border-s border-separator p-1"
        >
          {labels.map((l, i) => (
            <span
              key={i}
              className={`rounded px-2 py-1 text-center text-sm font-semibold ${
                i === live ? "bg-accent text-accent-foreground" : "text-muted"
              }`}
            >
              {l}
            </span>
          ))}
        </nav>
      )}
    </div>
  );
}

/** A part in each shown language, one after the other. */
function PartText({
  versions,
  index,
  label,
  big,
}: {
  versions: { language: string; slides: Slide[] }[];
  index: number;
  label: string;
  big: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-chord">{label}</span>
      {versions.map(({ language, slides }, i) => {
        // A version with fewer slides shows only the ones it has.
        const slide = slides[index];
        return (
          slide && (
            <div
              key={language}
              lang={language}
              className={`${big ? "text-2xl" : "text-lg"} ${i > 0 ? "opacity-60" : ""}`}
            >
              <SlideText slide={slide} wrap />
            </div>
          )
        );
      })}
    </div>
  );
}

/** The next song's title and first line, at the bottom of the tablet layout. */
function NextSong({
  slug,
  view,
  languages,
}: {
  slug: string;
  view: LiveView;
  languages: string[];
}) {
  const { t } = useTranslation();
  const next = view.next;
  const song = useJson<Song>(
    next?.song ? `/api/communities/${slug}/songs/${next.song.id}` : null,
    useChanges(slug, "songs", "song_versions"),
  ).data;
  if (!next?.song) return null;
  const version =
    song &&
    (languages
      .map((l) => song.versions.find((v) => v.language === l))
      .find(Boolean) ??
      song.versions[0]);
  const firstLine = version
    ? parseSong(version.text).slides[0]?.lines.find((l) => !l.chordsOnly)?.text
    : undefined;
  return (
    <div className="col-span-2 rounded-xl border border-dashed border-separator p-3">
      <p className="font-semibold">
        {t("stage.nextSong", { title: titleFor(next.song.titles, languages) })}
      </p>
      {firstLine && <p className="text-muted">{firstLine}</p>}
    </div>
  );
}

function PartBox({
  active,
  next,
  onPress,
  children,
}: {
  active: boolean;
  next: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  // Live in the live color, next only dashed, so the two never look alike; one
  // border width for all, so nothing moves on.
  const look = `block w-full rounded-xl border-2 p-3 text-start ${
    active
      ? "border-live bg-live/10"
      : next
        ? "border-dashed border-muted"
        : "border-separator"
  }`;
  return (
    <div role="listitem" aria-current={active || undefined}>
      {onPress ? (
        <AriaButton
          className={`${look} outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus`}
          onPress={onPress}
        >
          {children}
        </AriaButton>
      ) : (
        <div className={look}>{children}</div>
      )}
    </div>
  );
}
