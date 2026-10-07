import { FollowQr } from "./Follow";
import { useBackCloses } from "../ui/back";
import { FullScreenButton, useBarColor, useStill } from "../ui/full-screen";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LiveView } from "../../server/live/live-view";
import { formatReference } from "../../shared/bible";
import { formatLines, titleFor } from "../../shared/song-render";
import type { ScreenSettings } from "../../shared/screens";

type SectionStyles = NonNullable<ScreenSettings["sectionStyles"]>;
import { parseSong, type Slide } from "../../shared/song-text";
import type { Community } from "../data/community";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { Markdown } from "../ui/markdown";
import {
  hideInPage,
  sendLive,
  useLiveView,
  useLocal,
  useLocalProjection,
  useShownInPage,
} from "../data/room";
import { usePassKeysToOpener } from "../live/windows";
import { Segments } from "../songs/SongText";
import { clock } from "../ui/time";
import { ReloadWhenIdle } from "../app/update";
import { SlidePage } from "./SlidePage";
import { WelcomePage } from "./WelcomePage";

/**
 * /<community>/projector/<language>: a quick projector in one language, without a
 * screen. With `local`, /<community>/local/<language>: the window a tab projects to
 * locally.
 */
export function Projector({
  slug,
  language,
  local = false,
}: {
  slug: string;
  language: string;
  local?: boolean;
}) {
  const community = useJson<Community>(
    `/api/communities/${encodeURIComponent(slug)}`,
    useChanges(slug, "communities"),
  ).data;
  return (
    <>
      <ReloadWhenIdle slug={slug} local={local} />
      <ProjectorScreen
        slug={slug}
        languages={[language]}
        fallback={community?.languages ?? []}
        settings={{}}
        local={local}
      />
    </>
  );
}

/**
 * On a phone, the local projector filling the page, full screen, for a phone mirrored to
 * a TV (live-control spec): a tap on the right half goes next, on the left half back;
 * Back, or leaving full screen, returns to the page, still projecting.
 */
export function InPageProjector() {
  const { t } = useTranslation();
  const local = useLocal();
  const shown = useShownInPage() && !!local;
  const frame = useRef<HTMLDivElement>(null);
  // Back hides it, rather than leaving the page.
  useBackCloses(shown, hideInPage);
  useEffect(() => {
    if (!shown) return;
    void frame.current?.requestFullscreen().catch(() => {});
    const leftFullScreen = () => {
      if (!document.fullscreenElement) hideInPage();
    };
    document.addEventListener("fullscreenchange", leftFullScreen);
    return () => {
      document.removeEventListener("fullscreenchange", leftFullScreen);
      if (document.fullscreenElement) void document.exitFullscreen();
    };
  }, [shown]);
  if (!shown) return null;
  return (
    <div
      ref={frame}
      role="dialog"
      aria-modal
      aria-label={t("screens.types.projector")}
      className="fixed inset-0 z-50 bg-black"
      onClick={(event) => {
        if ((event.target as Element).closest("button")) return;
        const next = event.clientX > window.innerWidth / 2;
        void sendLive(local.slug, { type: next ? "next" : "previous" });
      }}
    >
      {/* As a preview, filling this frame, which is full screen already. */}
      <ProjectorScreen
        slug={local.slug}
        languages={local.languages.slice(0, 1)}
        fallback={local.languages}
        settings={{}}
        preview
        local
      />
    </div>
  );
}

/**
 * A projector: what's live in its one or two languages, filling the screen, in its
 * display settings. No login: what's live is public. It keeps the last content while
 * reconnecting, and hides the pointer and the fullscreen button after 3 seconds still.
 */
export function ProjectorScreen({
  slug,
  languages,
  fallback,
  settings,
  preview = false,
  local = false,
}: {
  slug: string;
  languages: string[];
  /** The community's languages, for a song without a version in the screen's. */
  fallback: string[];
  settings: ScreenSettings;
  /** Inside a box on a controller's page, instead of filling the display. */
  preview?: boolean;
  /** What the tab that opened this window projects, instead of the room. */
  local?: boolean;
}) {
  const room = useLiveView(local ? null : slug);
  const own = useLocalProjection(local ? slug : null);
  const view = local ? own : room;
  usePassKeysToOpener(!preview);
  const still = useStill();
  const root = useRef<HTMLDivElement>(null);
  useBarColor(preview ? null : root, settings.background ?? "");
  // A slides page fills the screen, letterboxed on its background.
  const slides =
    view && !view.blank && !view.page && !view.verse
      ? view.entry?.kind === "slides"
        ? (view.entry.slides?.files ?? [])
        : null
      : null;

  return (
    <div
      ref={root}
      // Sizes are in container units, so a preview is the screen made small. The text
      // stays inside a TV's title-safe area, 5% from each edge: TVs crop the picture's edges.
      className={`dark isolate ${preview ? "absolute" : "fixed"} inset-0 flex flex-col overflow-hidden px-[5cqw] py-[5cqh] select-none ${
        still && !preview ? "cursor-none" : ""
      }`}
      style={{
        containerType: "size",
        background: settings.background ?? "#000",
        color: settings.textColor ?? "#fff",
        fontFamily: settings.font,
      }}
      lang={languages[0]}
    >
      {settings.backgroundImage && !slides && (
        // Darkened by its opacity over the background, so the text stays readable.
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{
            backgroundImage: `url("${settings.backgroundImage.replace(/"/g, "%22")}")`,
            opacity: settings.imageOpacity ?? 0.4,
          }}
        />
      )}
      {settings.clock && !preview && <Clock />}
      {view?.page?.welcome && !view.blank && (
        <WelcomePage slug={slug} welcome={view.page.welcome} />
      )}
      {view?.page && !view.page.welcome && !view.blank && (
        // A start or end page, full screen.
        <iframe
          title={view.page.name}
          src={view.page.url}
          className="absolute inset-0 h-full w-full border-0"
        />
      )}
      {view?.page?.qr && !view.blank && <FollowQr slug={slug} />}
      {slides && view && (
        <SlidePage
          files={slides}
          languages={languages}
          slide={view.slide}
          sizes={preview ? "33vw" : "100vw"}
          className="absolute inset-0 h-full w-full"
        />
      )}
      {view && !view.blank && !view.page && !slides && (
        <Languages
          view={view}
          languages={languages}
          fallback={fallback}
          split={settings.split ?? "rows"}
          styles={settings.sectionStyles ?? {}}
        />
      )}
      {!preview && <FullScreenButton />}
    </div>
  );
}

/**
 * Each of the screen's languages in its half, one above the other or side by side. A
 * song without a version in one of them gives the whole screen to the other.
 */
function Languages({
  view,
  languages,
  fallback,
  split,
  styles,
}: {
  view: LiveView;
  languages: string[];
  fallback: string[];
  split: "rows" | "columns";
  styles: SectionStyles;
}) {
  const { song, entry, verse } = view;
  const shown = verse
    ? languages.filter((l) => verse[l])
    : entry?.kind === "text"
      ? languages.slice(0, 1)
      : song
        ? languages.filter((l) => song.versions.some((v) => v.language === l))
        : languages;
  const halves = shown.length > 0 ? shown : languages.slice(0, 1);
  if (halves.length === 1)
    return (
      <Live
        view={view}
        languages={[halves[0] ?? "ro", ...fallback]}
        styles={styles}
      />
    );
  return (
    <div
      className={`grid min-h-0 flex-1 gap-[3cqmin] ${
        split === "columns" ? "grid-cols-2" : "grid-rows-2"
      }`}
    >
      {halves.map((language) => (
        <div
          key={language}
          lang={language}
          className="flex min-h-0 min-w-0 flex-col"
        >
          <Live view={view} languages={[language]} styles={styles} />
        </div>
      ))}
    </div>
  );
}

function Live({
  view,
  languages,
  styles = {},
}: {
  view: LiveView;
  languages: string[];
  styles?: SectionStyles;
}) {
  const { entry, song, verse } = view;
  const [language = "ro"] = languages;
  // A verse projected from bible.com, in the screen's language when it came in it.
  if (verse) {
    const shown =
      languages.map((l) => verse[l]).find(Boolean) ?? Object.values(verse)[0];
    return shown ? (
      <>
        <header className="truncate text-[2.2cqmin] opacity-60">
          {shown.reference}
        </header>
        <Fit wrap>
          <p className="whitespace-pre-line">{shown.text}</p>
        </Fit>
      </>
    ) : null;
  }
  if (!entry) return null;
  if (entry.bible)
    return (
      <Fit wrap>
        <p className="text-center font-semibold">
          {formatReference(entry.bible, language)}
        </p>
      </Fit>
    );
  if (entry.kind === "text")
    return (
      <Fit wrap>
        <div className="flex flex-col gap-[0.5em]">
          <Markdown text={entry.text ?? ""} />
        </div>
      </Fit>
    );
  if (!song) return null;

  const version =
    languages
      .map((l) => song.versions.find((v) => v.language === l))
      .find(Boolean) ?? song.versions[0];
  const slides = version ? parseSong(version.text).slides : [];
  // A translation with fewer slides shows its last one.
  const index = Math.min(view.slide, slides.length - 1);
  const slide = slides[index];
  const next = slides[index + 1];
  if (!slide) return null;
  const title = titleFor(
    Object.fromEntries(song.versions.map((v) => [v.language, v.title])),
    languages,
  );

  return (
    <>
      <header className="flex gap-[1em] text-[2.2cqmin] opacity-60">
        <span>
          #{index + 1}/{slides.length}
        </span>
        {/* The key for this service, else the song's. */}
        {(entry.keySignature || song.keySignature) && (
          <span>{entry.keySignature || song.keySignature}</span>
        )}
        <span className="truncate">{title}</span>
      </header>
      <Fit>
        <SlideText slide={slide} styles={styles} />
      </Fit>
      <footer className="h-[4cqmin] truncate text-[3cqmin] opacity-50">
        {next && (
          <Segments segments={formatLines(lyrics(next).slice(0, 1))[0] ?? []} />
        )}
      </footer>
    </>
  );
}

/** A slide's lyric lines, without chords. */
const lyrics = (slide: Slide) =>
  slide.lines.filter((l) => !l.chordsOnly).map((l) => l.text);

/** The slide's lines, formatted; refrains in italics, ×2 after repeated lines, a light grey * at the end. */
export function SlideText({
  slide,
  styles = {},
  wrap = false,
}: {
  slide: Slide;
  /** Italic or bold per section type; refrains are italic unless set. */
  styles?: SectionStyles;
  /** Long lines wrap, as in a narrow column; screens keep each line whole. */
  wrap?: boolean;
}) {
  // With each line's place in the slide, for the repeat ranges.
  const shown = slide.lines
    .map((line, at) => ({ line, at }))
    .filter(({ line }) => !line.chordsOnly);
  const formatted = formatLines(shown.map(({ line }) => line.text));
  return (
    <div
      className={`${
        (styles[slide.type]?.italic ?? slide.type === "refrain") ? "italic" : ""
      } ${styles[slide.type]?.bold ? "font-bold" : ""}`}
    >
      {formatted.map((segments, i) => {
        const repeat = slide.repeats.find((r) => r.to === shown[i]?.at);
        return (
          <div
            key={i}
            className={`min-h-[1.2em] leading-tight ${
              wrap ? "break-words whitespace-pre-wrap" : "whitespace-pre"
            }`}
          >
            <Segments segments={segments} />
            {repeat && (
              <span className="ms-[0.5em] text-[0.6em] opacity-60 not-italic">
                ×{repeat.times}
              </span>
            )}
            {slide.last && i === formatted.length - 1 && (
              // The final mark is a sign, the same in every language.
              // i18next-instrument-ignore-next-line
              <span className="opacity-50"> *</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Shows its content at the largest font size that fits the space left. Song lines don't
 * wrap, so a long line makes the whole slide smaller; with `wrap`, text wraps instead.
 */
export function Fit({
  children,
  wrap = false,
  top = false,
}: {
  children: React.ReactNode;
  wrap?: boolean;
  /** At the top-left, under a label, instead of in the middle. */
  top?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fit = () => {
      const b = box.current;
      const c = content.current;
      if (!b || !c) return;
      const fits = () =>
        c.offsetWidth <= b.clientWidth && c.offsetHeight <= b.clientHeight;
      let low = 6;
      let high = 600;
      while (high - low > 0.5) {
        const size = (low + high) / 2;
        c.style.fontSize = `${size}px`;
        if (fits()) low = size;
        else high = size;
      }
      c.style.fontSize = `${low}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  });
  return (
    <div
      ref={box}
      className={`flex min-h-0 w-full min-w-0 flex-1 overflow-hidden ${
        top ? "items-start justify-start" : "items-center justify-center"
      }`}
    >
      <div ref={content} data-fit className={wrap ? "max-w-full" : "w-max"}>
        {children}
      </div>
    </div>
  );
}

/** The time, small in a corner, when the screen's settings ask for it. */
function Clock() {
  const { i18n } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="absolute end-[3cqmin] bottom-[2cqmin] text-[3cqmin] tabular-nums opacity-70">
      {clock(now, i18n.language)}
    </span>
  );
}
