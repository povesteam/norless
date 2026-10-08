import { ListMusic, MonitorPlay, Music } from "lucide-react";
import { Button } from "@heroui/react";
import { Scaled } from "../ui/scaled";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LiveView } from "../../server/live/live-view";
import type { Entry } from "../../server/playlists/playlists";
import { formatReference } from "../../shared/bible";
import { titleFor } from "../../shared/song-render";
import { partLabels } from "../../shared/song-text";
import { useCommunity } from "../data/community";
import { LanguageMark, languageCode } from "../ui/icons";
import { usePartName } from "../stage/parts";
import { ProjectorScreen, SlideText } from "../screens/Projector";
import { sendLive } from "../data/room";
import { useBackCloses } from "../ui/back";
import { PageThumbs } from "./PageThumbs";
import { SlidePage } from "../screens/SlidePage";
import { EntryParts, useSongSlides } from "./EntryParts";

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
          className="relative"
          aria-label={t("controller.preview", {
            language: languageCode(language),
          })}
        >
          {/* Drawn at a projector's size and made small, so its text fits as it does
              there: fitted to a small card, it stayed too big and was cut off. */}
          <Scaled width={1920} height={1080}>
            <ProjectorScreen
              slug={community.slug}
              languages={[language]}
              fallback={community.languages}
              settings={{}}
              preview
            />
          </Scaled>
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
            <div className="flex flex-col gap-1 rounded-xl border border-separator p-3">
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
        <div className="rounded-xl border border-separator p-3 text-lg">
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
  // Which view is in the strip; back from Song or Screens goes to Order.
  const [at, setAt] = useState(0);
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
  useBackCloses(at > 0, () => show(0));
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
        onScroll={(event) =>
          setAt(
            Math.round(
              event.currentTarget.scrollLeft / event.currentTarget.clientWidth,
            ),
          )
        }
        // Relative, so what's placed absolutely in its views (the names read out beside
        // the parts' marks) is clipped with them instead of widening the page.
        className="relative flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
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
