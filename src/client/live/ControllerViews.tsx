import {
  ListMusic,
  MonitorPlay,
  Music,
  Pencil,
  Play,
  Radio,
} from "lucide-react";
import { Button } from "@heroui/react";
import { useEffect, useRef } from "react";
import { Button as AriaButton } from "react-aria-components";
import { useTranslation } from "react-i18next";
import type { LiveView } from "../../server/live/live-view";
import type { Entry } from "../../server/playlists/playlists";
import type { Song } from "../../server/songs/songs";
import { formatReference } from "../../shared/bible";
import { titleFor } from "../../shared/song-render";
import { parseSong, partLabels, type Slide } from "../../shared/song-text";
import { useCommunity } from "../data/community";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { LanguageMark, languageCode } from "../ui/icons";
import { usePartName } from "../stage/parts";
import { ProjectorScreen, SlideText } from "../screens/Projector";
import { sendLive } from "../data/room";
import { Placeholder } from "../ui/states";
import { PageThumbs } from "./PageThumbs";
import { CardLabel } from "./SlidesPanel";
import { SlidePage } from "../screens/SlidePage";

/** The ways the team can show a playlist, per device type. */
export const controllerLayouts = [
  { id: "controller", devices: ["laptop"], feature: "layouts" },
  { id: "running-order", devices: ["laptop"], feature: "layouts" },
  { id: "big", devices: ["laptop"], feature: "layouts" },
  // Full HD and larger windows: offered from 1900 CSS pixels.
  { id: "big-screen", devices: ["laptop"], feature: "bigScreen" },
  { id: "tablet", devices: ["tablet"], feature: "touchLayouts" },
  { id: "phone", devices: ["phone"], feature: "touchLayouts" },
  // Like the old Norless; the default until later steps bring the others.
  { id: "classic", devices: ["phone", "tablet", "laptop"] },
] as const;
export type ControllerLayout = (typeof controllerLayouts)[number]["id"];

/** A song's slides in each of the community's languages, by slide number. */
function useSongSlides(songId: string | null | undefined) {
  const community = useCommunity();
  const song = useJson<Song>(
    songId ? `/api/communities/${community.slug}/songs/${songId}` : null,
    useChanges(community.slug, "songs", "song_versions"),
  ).data;
  if (!song || song.id !== songId) return null;
  const versions = community.languages
    .map((l) => song.versions.find((v) => v.language === l))
    .filter((v) => v !== undefined);
  return versions.map((v) => ({
    language: v.language,
    slides: parseSong(v.text).slides,
  }));
}

/**
 * Go live, or the Live mark once it is: both in one cell, the other hidden, so going live
 * moves nothing (Classic's selected entry, and the parts of the Phone and Operator layouts).
 */
export function GoLive({
  isLive,
  onGo,
}: {
  isLive: boolean;
  onGo: () => void;
}) {
  const { t } = useTranslation();
  return (
    <span className="grid *:[grid-area:1/1]">
      <Button className={isLive ? "invisible" : undefined} onPress={onGo}>
        <Play />
        {t("classic.goLive")}
      </Button>
      {/* A status, not a button: no frame or fill. */}
      <span
        className={`inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-semibold md:h-9 ${
          isLive ? "" : "invisible"
        }`}
      >
        <Radio className="size-4 text-live" />
        {t("live.live")}
      </span>
    </span>
  );
}

/**
 * An entry's parts in full, each language side by side, the live one marked. A click
 * or tap sends a part live; `big` makes cards for touch.
 */
export function EntryParts({
  entry,
  view,
  big = false,
  onEditSong,
  canGo = false,
}: {
  entry: Entry | null;
  view: LiveView | undefined;
  big?: boolean;
  /** For editors: opens the song in the editor, in place of the parts. */
  onEditSong?: (songId: string) => void;
  /** For the team: Go live above the parts; a tap on an entry only selects it. */
  canGo?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const community = useCommunity();
  const partName = usePartName();
  const versions = useSongSlides(entry?.song?.id);
  if (!entry || (entry.kind === "divider" && entry.plannedMinutes === null))
    return null;
  const go = (slide: number) =>
    void sendLive(
      community.slug,
      { type: "go", entryId: entry.id, slide },
      "part",
    );
  const liveSlide =
    view?.entryId === entry.id && !view.blank ? view.slide : null;
  const goLive = canGo && !entry.song?.deleted && (
    <GoLive isLive={view?.entryId === entry.id} onGo={() => go(0)} />
  );
  // For members, above the parts, as Classic shows it under the title.
  const addedBy = entry.addedBy && (
    <p className="min-w-0 flex-1 truncate text-sm text-muted">
      {t("playlist.addedBy", { name: entry.addedBy })}
    </p>
  );

  if (entry.kind === "slides")
    return (
      <div className="flex flex-col gap-2">
        {(addedBy || goLive) && (
          <div className="flex items-center gap-2">
            {addedBy || <span className="flex-1" />}
            {goLive}
          </div>
        )}
        <PageThumbs entry={entry} live={liveSlide} onGo={go} />
      </div>
    );
  if (!entry.song)
    return (
      <div className="flex flex-col gap-2">
        {(addedBy || goLive) && (
          <div className="flex items-center gap-2">
            {addedBy || <span className="flex-1" />}
            {goLive}
          </div>
        )}
        <PartCard isLive={liveSlide === 0} big={big} onPress={() => go(0)}>
          <CardLabel
            label={t(entry.bible ? "live.bible" : "live.text")}
            isLive={liveSlide === 0}
          />
          <span className="whitespace-pre-line">
            {entry.bible
              ? formatReference(entry.bible, i18n.language)
              : (entry.text ?? "")}
          </span>
        </PartCard>
      </div>
    );
  if (!versions) return <Placeholder lines={6} />;
  const [main] = versions;
  const slides = main?.slides ?? [];
  const labels = partLabels(slides);

  const song = entry.song;
  return (
    <div className="flex flex-col gap-2">
      {(addedBy || onEditSong || goLive) && (
        <div className="flex items-center gap-2">
          {addedBy || <span className="flex-1" />}
          {goLive}
          {onEditSong && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => onEditSong(song.id)}
            >
              <Pencil />
              {t("editor.editSong")}
            </Button>
          )}
        </div>
      )}
      <div
        role="list"
        aria-label={t("live.slides")}
        className={big ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"}
      >
        {slides.map((slide, i) => (
          <div role="listitem" key={i}>
            <PartCard isLive={liveSlide === i} big={big} onPress={() => go(i)}>
              <CardLabel
                label={partName(slide, labels[i] ?? "")}
                isLive={liveSlide === i}
              />
              <span
                className="grid w-full gap-4"
                style={{
                  gridTemplateColumns: `repeat(${versions.length}, minmax(0, 1fr))`,
                }}
              >
                {versions.map(({ language, slides: own }) => (
                  <span key={language} lang={language} className="min-w-0">
                    {own[i] && <PartText slide={own[i] as Slide} />}
                  </span>
                ))}
              </span>
            </PartCard>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A part's words; for a part of chords only, such as an intro, its chords. */
function PartText({ slide }: { slide: Slide }) {
  if (slide.lines.some((l) => !l.chordsOnly))
    return <SlideText slide={slide} wrap />;
  return (
    <span className="font-mono text-sm text-muted">
      {slide.lines.flatMap((l) => l.chords.map((c) => c.name)).join("  ")}
    </span>
  );
}

function PartCard({
  isLive,
  big,
  onPress,
  children,
}: {
  isLive: boolean;
  big: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <AriaButton
      aria-current={isLive || undefined}
      onPress={onPress}
      className={`flex w-full cursor-pointer flex-col items-start gap-1 rounded-xl border-2 text-start outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus data-[focus-visible]:ring-inset data-[hovered]:bg-default ${
        big ? "p-4 text-lg" : "p-3"
      } ${isLive ? "border-live" : "border-separator"}`}
    >
      {children}
    </AriaButton>
  );
}

/** What each language's projector shows, small; `languages` picks some. */
export function Previews({
  big = false,
  languages,
}: {
  big?: boolean;
  languages?: string[];
}) {
  const { t } = useTranslation();
  const community = useCommunity();
  const shown = languages
    ? community.languages.filter((l) => languages.includes(l))
    : community.languages;
  return (
    <div
      role="group"
      aria-label={t("controller.previews")}
      className={big ? "flex flex-col gap-3" : "grid grid-cols-2 gap-2"}
    >
      {shown.map((language) => (
        <div
          key={language}
          className="relative aspect-video overflow-hidden rounded-lg"
          aria-label={t("controller.preview", {
            language: languageCode(language),
          })}
        >
          <ProjectorScreen
            slug={community.slug}
            languages={[language]}
            fallback={community.languages}
            settings={{}}
            preview
          />
          <span className="absolute start-1 top-1 rounded bg-black/60 px-1 text-xs text-white">
            <LanguageMark language={language} />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * The whole playlist in one scroll: every song with its parts, and entries already done
 * collapsed into one line.
 */
export function RunningOrder({
  entries,
  view,
  onEditSong,
}: {
  entries: Entry[];
  view: LiveView | undefined;
  onEditSong?: (songId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const community = useCommunity();
  const liveIndex = entries.findIndex((e) => e.id === view?.entryId);
  const languages = [i18n.language, ...community.languages];
  const title = (entry: Entry) =>
    entry.song
      ? titleFor(entry.song.titles, languages)
      : entry.bible
        ? formatReference(entry.bible, i18n.language)
        : (entry.text?.split("\n")[0]?.replace(/^#+\s*/, "") ?? "");
  return (
    <div
      role="list"
      aria-label={t("controller.layouts.running-order")}
      className="flex flex-col gap-4"
    >
      {entries.map((entry, i) => (
        <section key={entry.id} role="listitem" aria-label={title(entry)}>
          <h3
            className={`flex gap-2 font-semibold ${
              entry.kind === "divider" ? "text-lg" : ""
            } ${i < liveIndex ? "text-muted" : ""}`}
          >
            {title(entry)}
          </h3>
          {/* Done entries stay one line. */}
          {i >= liveIndex && entry.kind !== "divider" && (
            <div className="mt-2">
              <EntryParts entry={entry} view={view} onEditSong={onEditSong} />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

/** Big now and next: what the projector shows, the next part, and the parts in a strip. */
export function BigNowNext({ view }: { view: LiveView | undefined }) {
  const { t } = useTranslation();
  const community = useCommunity();
  const partName = usePartName();
  const versions = useSongSlides(view?.song?.id);
  const slides = versions?.[0]?.slides ?? [];
  const labels = partLabels(slides);
  const next = view ? slides[view.slide + 1] : undefined;
  const go = (slide: number) =>
    view?.entryId &&
    void sendLive(
      community.slug,
      { type: "go", entryId: view.entryId, slide },
      "part",
    );
  return (
    <div className="flex flex-col gap-4">
      {/* As large as leaves the next part and the parts' strip in the window. */}
      <div
        className="relative aspect-video w-full overflow-hidden rounded-xl"
        style={{ maxWidth: "calc((100dvh - 27rem) * 16 / 9)" }}
      >
        <ProjectorScreen
          slug={community.slug}
          languages={community.languages.slice(0, 1)}
          fallback={community.languages}
          settings={{}}
          preview
        />
      </div>
      {/* Slides from a file: the next page, and the pages in a strip. */}
      {view?.entry?.kind === "slides" && (
        <>
          {view.slide + 1 < view.slides && (
            <div className="flex flex-col gap-1 rounded-xl border border-dashed border-accent p-3">
              <p className="text-sm font-semibold text-muted">
                {t("slides.nextPage")}
              </p>
              <SlidePage
                files={view.entry.slides?.files ?? []}
                languages={community.languages.slice(0, 1)}
                slide={view.slide + 1}
                sizes="33vw"
                className="max-h-48 self-start"
              />
            </div>
          )}
          <PageThumbs entry={view.entry} live={view.slide} onGo={go} strip />
        </>
      )}
      {next && view && (
        <div className="rounded-xl border border-dashed border-accent p-3 text-lg">
          <p className="text-sm font-semibold text-muted">
            {t("stage.next", {
              part: partName(next, labels[view.slide + 1] ?? ""),
            })}
          </p>
          <SlideText slide={next} />
        </div>
      )}
      {slides.length > 0 && (
        <div
          role="group"
          aria-label={t("live.parts")}
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {labels.map((label, i) => (
            <Button
              key={i}
              size="lg"
              variant={i === view?.slide ? "primary" : "secondary"}
              aria-label={partName(slides[i], label)}
              onPress={() => go(i)}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * On a phone: Order, Song and Screens, side by side in a strip that swipes, with tabs
 * above. The bar with previous, next and blank stays below every view.
 */
export function PhoneViews({
  order,
  song,
  screens,
  opened = 0,
}: {
  order: React.ReactNode;
  song: React.ReactNode;
  screens: React.ReactNode;
  /** Goes up when an entry is tapped: its parts come into view. */
  opened?: number;
}) {
  const { t } = useTranslation();
  const strip = useRef<HTMLDivElement>(null);
  const views = [
    ["order", order],
    ["song", song],
    ["screens", screens],
  ] as const;
  const show = (i: number) =>
    strip.current?.children[i]?.scrollIntoView({
      behavior: "smooth",
      inline: "start",
      block: "nearest",
    });
  useEffect(() => {
    if (!opened) return;
    // After the list keeps the tapped row in view, which would scroll back to Order.
    const timer = setTimeout(() => show(1), 100);
    return () => clearTimeout(timer);
  }, [opened]);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-1">
        {views.map(([id], i) => (
          <Button
            key={id}
            size="sm"
            variant="secondary"
            onPress={() => show(i)}
          >
            {id === "order" ? (
              <ListMusic />
            ) : id === "song" ? (
              <Music />
            ) : (
              <MonitorPlay />
            )}
            {t(`controller.phone.${id}`)}
          </Button>
        ))}
      </div>
      <div
        ref={strip}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
      >
        {views.map(([id, content]) => (
          <section
            key={id}
            aria-label={t(`controller.phone.${id}`)}
            className="w-full shrink-0 snap-start px-0.5"
          >
            {content}
          </section>
        ))}
      </div>
    </div>
  );
}
