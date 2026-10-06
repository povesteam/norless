import { useEffect, useRef, useState } from "react";
import { FullScreenButton, useBarColor } from "../ui/full-screen";
import { TempoHint } from "./TempoListener";
import { RecordingMark } from "./Recorder";
import { useTranslation } from "react-i18next";
import type { LiveView } from "../../server/live/live-view";
import type { Entry } from "../../server/playlists/playlists";
import { formatReference } from "../../shared/bible";
import type { ScreenSettings } from "../../shared/screens";
import { titleFor } from "../../shared/song-render";
import { parseSong, partLabels, type Slide } from "../../shared/song-text";
import type { Community } from "../data/community";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { usePartName } from "./parts";
import { Markdown } from "../ui/markdown";
import { Fit, SlideText } from "../screens/Projector";
import { useLiveView } from "../data/room";
import { ReloadWhenIdle } from "../app/update";
import { usePassKeysToOpener } from "../live/windows";
import { clock } from "../ui/time";
import { SlidePage } from "../screens/SlidePage";

/** The time now, updated every `ms`. */
function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

/**
 * A stage monitor: what the singers and musicians need and the audience doesn't. The
 * current part and the next one whole, with their notes, the key, the title, the next
 * song, a clock and the message to the stage; a countdown while a timed entry is live.
 */
export function StageMonitor({
  slug,
  languages,
  fallback,
  settings,
  preview = false,
}: {
  slug: string;
  languages: string[];
  fallback: string[];
  settings: ScreenSettings;
  /** Drawn in a tile of the Big screen: no keys, browser bar or full screen button. */
  preview?: boolean;
}) {
  const { i18n } = useTranslation();
  const view = useLiveView(slug);
  usePassKeysToOpener(!preview);
  const now = useNow(1000);
  const order = [...languages, ...fallback];
  const time = clock(now, i18n.language);
  const root = useRef<HTMLDivElement>(null);
  useBarColor(preview ? null : root, settings.background ?? "");

  return (
    <div
      ref={root}
      className="dark fixed inset-0 cursor-none overflow-hidden select-none"
      style={{
        // Sizes are in container units: a preview is the screen made small.
        containerType: "size",
        background: settings.background ?? "#000",
        color: settings.textColor ?? "#fff",
        fontFamily: settings.font,
      }}
      lang={languages[0]}
    >
      {/* The padding inside the box the sizes measure, so they're the screen's: a TV's
          title-safe area, 5% from each edge, since TVs crop the picture's edges. */}
      <div className="flex h-full flex-col gap-[2cqmin] px-[5cqw] py-[5cqh]">
        <header className="flex items-start gap-[3cqmin]">
          <span className="text-[6cqmin] font-semibold tabular-nums">
            {time}
          </span>
          {view?.message && (
            <span
              role="status"
              className="flex-1 rounded-[1cqmin] bg-warning px-[2cqmin] text-[6cqmin] font-bold text-black"
            >
              {view.message}
            </span>
          )}
          <span className="ms-auto flex flex-col items-end text-[3cqmin]">
            <TempoHint view={view} />
            <RecordingMark view={view} />
          </span>
        </header>
        {view?.entry && <Now view={view} languages={order} now={now} />}
      </div>
      {!preview && <FullScreenButton />}
    </div>
  );
}

function Now({
  view,
  languages,
  now,
}: {
  view: LiveView;
  languages: string[];
  now: number;
}) {
  const { t } = useTranslation();
  const partName = usePartName();
  const { entry, song } = view;
  const [language = "ro"] = languages;
  // A verse from bible.com on the screens; during a timed entry the countdown stays.
  const verse =
    view.verse &&
    (languages.map((l) => view.verse?.[l]).find(Boolean) ??
      Object.values(view.verse)[0]);
  if (verse && !(entry?.plannedMinutes && view.since))
    return (
      <>
        <p className="text-[5cqmin] opacity-70">{verse.reference}</p>
        <Fit wrap>
          <p className="whitespace-pre-line">{verse.text}</p>
        </Fit>
      </>
    );
  if (!entry) return null;
  const nextTitle = view.next && entryTitle(view.next, languages);

  // Slides from a file: this page and the next.
  if (entry.kind === "slides") {
    const files = entry.slides?.files ?? [];
    const following = view.slide + 1 < view.slides;
    return (
      <>
        <p className="flex gap-[2cqmin] text-[3.5cqmin] opacity-70">
          <span>{entryTitle(entry, languages)}</span>
          <span>
            {t("slides.page", { page: view.slide + 1, total: view.slides })}
          </span>
        </p>
        <div className="grid min-h-0 flex-1 grid-cols-[2fr_1fr] gap-[3cqmin] portrait:grid-cols-1 portrait:grid-rows-[2fr_1fr]">
          <SlidePage
            files={files}
            languages={languages}
            slide={view.slide}
            sizes="66vw"
            className="h-full min-h-0 w-full"
          />
          {following ? (
            <div className="flex min-h-0 min-w-0 flex-col gap-[1cqmin] opacity-50">
              <p className="text-[3.5cqmin] font-semibold text-[color-mix(in_oklab,var(--accent)_55%,white)]">
                {t("slides.nextPage")}
              </p>
              <SlidePage
                files={files}
                languages={languages}
                slide={view.slide + 1}
                sizes="33vw"
                className="min-h-0 w-full flex-1"
              />
            </div>
          ) : (
            nextTitle && (
              <p className="self-center text-[4cqmin] opacity-60">
                {t("stage.nextSong", { title: nextTitle })}
              </p>
            )
          )}
        </div>
      </>
    );
  }

  // A timed entry, like the sermon: the minutes left, large.
  if (entry.plannedMinutes && view.since) {
    const left = Math.max(
      0,
      Date.parse(view.since) + entry.plannedMinutes * 60_000 - now,
    );
    const minutes = Math.floor(left / 60_000);
    const seconds = Math.floor((left % 60_000) / 1000);
    return (
      <>
        <p className="text-[5cqmin] opacity-70">
          {entryTitle(entry, languages)}
        </p>
        <p
          aria-label={t("stage.left")}
          className="flex flex-1 items-center justify-center text-[30cqmin] font-bold tabular-nums"
        >
          {minutes}:{String(seconds).padStart(2, "0")}
        </p>
        {nextTitle && <Next>{t("stage.nextSong", { title: nextTitle })}</Next>}
      </>
    );
  }

  if (!song)
    return (
      <>
        <Fit wrap>
          {entry.bible ? (
            <p className="text-center font-semibold">
              {formatReference(entry.bible, language)}
            </p>
          ) : (
            <div className="flex flex-col gap-[0.5em]">
              <Markdown text={entry.text ?? ""} />
            </div>
          )}
        </Fit>
        {nextTitle && <Next>{t("stage.nextSong", { title: nextTitle })}</Next>}
      </>
    );

  const version =
    languages
      .map((l) => song.versions.find((v) => v.language === l))
      .find(Boolean) ?? song.versions[0];
  const slides = version ? parseSong(version.text).slides : [];
  const labels = partLabels(slides);
  const index = Math.min(view.slide, slides.length - 1);
  const current = slides[index];
  const next = slides[index + 1];
  if (!current) return null;
  const label = (slide: Slide | undefined, i: number) =>
    partName(slide, labels[i] ?? "");

  return (
    <>
      <p className="flex gap-[2cqmin] text-[3.5cqmin] opacity-70">
        <span>{entryTitle(entry, languages)}</span>
        {(entry.keySignature || song.keySignature) && (
          <span>
            {t("song.key", { key: entry.keySignature || song.keySignature })}
          </span>
        )}
      </p>
      <div className="grid min-h-0 flex-1 grid-cols-[2fr_1fr] gap-[3cqmin] portrait:grid-cols-1 portrait:grid-rows-[2fr_1fr]">
        <Part label={label(current, index)} slide={current} />
        {next ? (
          // Dimmer than the live part, still 4.5:1 on black.
          <div className="flex min-h-0 min-w-0 flex-col opacity-75">
            <Part
              label={t("stage.next", { part: label(next, index + 1) })}
              slide={next}
            />
          </div>
        ) : (
          nextTitle && (
            <p className="self-center text-[4cqmin] opacity-60">
              {t("stage.nextSong", { title: nextTitle })}
            </p>
          )
        )}
      </div>
    </>
  );
}

/** A whole part: its name, its notes, and its lines. */
function Part({ label, slide }: { label: string; slide: Slide }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-[1cqmin]">
      <p className="text-[3.5cqmin] font-semibold text-[color-mix(in_oklab,var(--accent)_55%,white)]">
        {label}
      </p>
      {slide.notes.map((note, i) => (
        <p key={i} className="text-[3cqmin] italic opacity-80">
          {note.text}
        </p>
      ))}
      {/* Right under its name, not in the middle of the space left. */}
      <Fit top>
        <SlideText slide={slide} />
      </Fit>
    </div>
  );
}

function Next({ children }: { children: React.ReactNode }) {
  return <p className="text-[4cqmin] opacity-60">{children}</p>;
}

/** An entry's title: a song's, a reading's reference, or a text's first line. */
export const entryTitle = (entry: Entry, languages: string[]) =>
  entry.song
    ? titleFor(entry.song.titles, languages)
    : entry.bible
      ? formatReference(entry.bible, languages[0] ?? "ro")
      : (entry.text?.split("\n")[0]?.replace(/^#+\s*/, "") ?? "");

/**
 * /<community>/stage: the stage monitor on any device (a TV's browser, a tablet), in the
 * community's languages, without setting up a screen first.
 */
export function StagePage({ slug }: { slug: string }) {
  const community = useJson<Community>(
    `/api/communities/${encodeURIComponent(slug)}`,
    useChanges(slug, "communities"),
  ).data;
  if (!community) return <div className="fixed inset-0 bg-black" />;
  return (
    <>
      <ReloadWhenIdle slug={slug} />
      <StageMonitor
        slug={slug}
        languages={community.languages}
        fallback={community.languages}
        settings={{}}
      />
    </>
  );
}
