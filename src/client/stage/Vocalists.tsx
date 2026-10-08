import { ChevronLeft, ChevronRight } from "lucide-react";
import { RecordingMark } from "./Recorder";
import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutIcon } from "../ui/icons";
import { type Community, switchesOf } from "../data/community";
import { shows } from "../../shared/features";
import { TodayBadge } from "../team/MyNextLine";
import { StageLookMenu, useStageLook } from "./StageLook";
import { useBarColor } from "../ui/full-screen";
import { useDeviceType, useLayout } from "../data/device";
import { useLayoutShown, useUsageCommunity } from "../data/usage";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import type { Playlist } from "../../server/playlists/playlists";
import type { LiveView } from "../../server/live/live-view";
import { StageNotice, StageSlides, ToPlaylist } from "./parts";
import { Parts, slidesIn } from "./VocalsParts";
import { LanguageChoice } from "./LanguageChoice";
import { useReportStageView } from "./report";
import { Tip } from "../ui/tip";
import { hasRole, useMe, useRoles } from "../data/me";
import { sendLive, useLiveView } from "../data/room";
import { LedByIcon } from "../playlists/LedBy";
import { useSwipe } from "../ui/swipe";
import { SongKey } from "./SongKey";
import { RecordingsMark } from "../songs/RecordingsMark";
import { playedKey } from "../../shared/music/music";
import { RoomChip } from "../live/PracticeRooms";

export const vocalistsLayouts = [
  { id: "whole", devices: ["phone", "tablet", "laptop"] },
  { id: "sideways", devices: ["phone"] },
  { id: "tablet", devices: ["tablet", "laptop"] },
] as const;
export type VocalistsLayout = (typeof vocalistsLayouts)[number]["id"];

/** /<community>/vocals: the vocalists view on a member's own device, in their layout. */
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
  const live = useLiveView(slug);
  const serviceRoles =
    !!community && shows(switchesOf(community), "serviceRoles");
  const recordings = !!community && shows(switchesOf(community), "recordings");
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
        <ToPlaylist slug={slug} />
        <RoomChip slug={slug} />
        {me?.user &&
          community &&
          shows(switchesOf(community), "serviceRoles") && (
            <TodayBadge slug={slug} />
          )}
        {languages.length > 1 && (
          <LanguageChoice
            languages={languages}
            choice={choice}
            onChoose={setShown}
          />
        )}
        <LiveKey slug={slug} view={live} canChange={canControl} />
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
          leader={serviceRoles}
          recordings={canControl && recordings}
          keyInToolbar
          marks={serviceRoles || recordings}
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
  leader = false,
  recordings = false,
  keyInToolbar = false,
  marks = true,
}: {
  slug: string;
  languages: string[];
  layout: VocalistsLayout;
  canControl: boolean;
  /** Who leads the song, when the service roles are switched on. */
  leader?: boolean;
  /** For the team, with the recordings on: the song's recordings marked. */
  recordings?: boolean;
  /** On a member's device, the key is in the toolbar (LiveKey). */
  keyInToolbar?: boolean;
  /**
   * Whether the line of marks under the toolbar shows: on a member's device, while the
   * features that fill it (recordings, service roles) are on, so it doesn't come and go
   * with the songs.
   */
  marks?: boolean;
}) {
  const { t } = useTranslation();
  const live = useLiveView(slug);
  // In Sideways, those who don't control live swipe through the parts on their own
  // phone, until the live part moves.
  const [own, setOwn] = useState<{ slide: number; live: string }>();
  const liveAt = `${live?.entryId}:${live?.slide}`;
  if (own && own.live !== liveAt) setOwn(undefined);
  const view = own && live ? { ...live, slide: own.slide, blank: false } : live;
  const go = (slide: number, via: "part" | "song-map") =>
    view?.entryId &&
    void sendLive(slug, { type: "go", entryId: view.entryId, slide }, via);
  const onPart =
    canControl && view?.entryId
      ? (slide: number) => go(slide, "part")
      : undefined;
  // Swipes: the next or previous part in Sideways, live for the team and on this phone
  // for the others; the team's song in Whole song.
  const playlist = useJson<Playlist>(
    canControl && layout !== "sideways" && live?.playlistId
      ? `/api/communities/${slug}/playlists/${live.playlistId}`
      : null,
    useChanges(slug, "entries", "playlists"),
  ).data;
  const songs =
    playlist?.entries.filter((e) => e.song && !e.song.deleted) ?? [];
  const root = useRef<HTMLDivElement>(null);
  useSwipe(root, (by) => {
    if (!live) return;
    if (layout === "sideways") {
      if (canControl)
        void sendLive(slug, { type: by > 0 ? "next" : "previous" }, "swipe");
      else if (live.song) {
        const count = slidesIn(live.song, languages)[0]?.slides.length ?? 0;
        const slide = Math.max(
          0,
          Math.min(count - 1, (own?.slide ?? live.slide) + by),
        );
        setOwn({ slide, live: liveAt });
      }
      return;
    }
    const next = songs[songs.findIndex((e) => e.id === live.entryId) + by];
    if (canControl && next)
      void sendLive(slug, { type: "go", entryId: next.id, slide: 0 }, "swipe");
  });
  return (
    <div ref={root} className="relative flex min-h-0 flex-1 flex-col">
      <StageNotice message={view?.message} />
      {/* A steady line: who leads the song comes and goes with the songs. */}
      {marks && (
        <div className="flex min-h-7 flex-wrap items-center gap-3 px-4 pt-2">
          <RecordingMark view={view} />
          {!keyInToolbar && (
            <LiveKey slug={slug} view={view} canChange={canControl} />
          )}
          {recordings && view?.song && (
            <RecordingsMark
              slug={slug}
              songId={view.song.id}
              count={view.entry?.song?.recordings}
            />
          )}
          {view?.ledBy && leader && (
            <span className="flex items-center gap-1 text-lg">
              <LedByIcon aria-hidden className="size-4" />
              {t("team.ledBy", { name: view.ledBy })}
            </span>
          )}
        </div>
      )}
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
          onMap={canControl ? (slide) => go(slide, "song-map") : undefined}
          slug={slug}
        />
      ) : (
        // The free height, so previous and next stay at the bottom.
        <p className="flex-1 p-4 text-muted">{t("musicians.noSong")}</p>
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

/** The key the live song is sung in; the team changes it for this service from here. */
function LiveKey({
  slug,
  view,
  canChange,
}: {
  slug: string;
  view: LiveView | undefined;
  canChange: boolean;
}) {
  const song = view?.song;
  const shown =
    song && playedKey(song.keySignature, view.entry?.keySignature).shown;
  if (!shown) return null;
  return (
    <SongKey slug={slug} view={view} shown={shown} canChange={canChange} />
  );
}
