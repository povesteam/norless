import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { useTranslation } from "react-i18next";
import type { LiveView } from "../../server/live/live-view";
import type { Song } from "../../server/songs/songs";
import { titleFor } from "../../shared/song-render";
import { parseSong, partLabels, type Slide } from "../../shared/song-text";
import { useChanges } from "../data/changes";
import { useJson } from "../data/fetch";
import { Fit, SlideText } from "../screens/Projector";
import { PartMark, usePartName } from "./parts";
import type { VocalistsLayout } from "./Vocalists";

/** The song's slides in each language, by slide number. */
export function slidesIn(song: Song, languages: string[]) {
  const versions = languages
    .map((l) => song.versions.find((v) => v.language === l))
    .filter((v) => v !== undefined);
  const chosen = versions.length > 0 ? versions : song.versions.slice(0, 1);
  return chosen.map((v) => ({
    language: v.language,
    slides: parseSong(v.text).slides,
  }));
}

export function Parts({
  view,
  song,
  languages,
  layout,
  onPart,
  onMap,
  slug,
}: {
  view: LiveView;
  song: Song;
  languages: string[];
  layout: VocalistsLayout;
  onPart?: (slide: number) => void;
  /** For the team: a part tapped or dragged over on the map goes live. */
  onMap?: (slide: number) => void;
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
    <PartText
      versions={versions}
      index={i}
      label={label(i)}
      mark={labels[i] ?? ""}
      big={big}
    />
  );

  // Whole song: keep the live part in view.
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [live, song.id]);

  // A tap or a drag over the map moves to a part: live for the team, into view for others.
  const mapped = useRef(-1);
  const mapAt = (x: number, y: number) => {
    const at = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-part]");
    const i = Number(at?.dataset.part ?? -1);
    if (i < 0 || i === mapped.current) return;
    mapped.current = i;
    if (onMap) onMap(i);
    else
      list.current?.children[i]?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
  };

  if (layout === "sideways")
    return (
      <div className="grid min-h-0 flex-1 grid-cols-[3fr_2fr] gap-4 p-4 portrait:grid-cols-1 portrait:grid-rows-[3fr_2fr]">
        <div className="flex min-h-0 min-w-0 flex-col">
          {/* Its mark in the corner, as on the parts' boxes; the part keeps the room. */}
          <p className="relative min-h-8">
            <PartMark mark={labels[live] ?? ""} name={label(live)} />
          </p>
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
          className="flex touch-none flex-col gap-1 overflow-y-auto border-s border-separator p-1 select-none"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            mapped.current = -1;
            mapAt(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            if (event.buttons) mapAt(event.clientX, event.clientY);
          }}
        >
          {labels.map((l, i) => (
            <span
              key={i}
              data-part={i}
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
  mark,
  big,
}: {
  versions: { language: string; slides: Slide[] }[];
  index: number;
  label: string;
  /** As the song map writes it (1, 2, R). */
  mark: string;
  big: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <PartMark mark={mark} name={label} />
      {versions.map(({ language, slides }, i) => {
        // A version with fewer slides shows only the ones it has.
        const slide = slides[index];
        return (
          slide &&
          (big ? (
            <FitLines
              key={language}
              lang={language}
              className={i > 0 ? "opacity-60" : ""}
              render={(wrap) => <SlideText slide={slide} wrap={wrap} />}
            />
          ) : (
            <div
              key={language}
              lang={language}
              className={`text-lg ${i > 0 ? "opacity-60" : ""}`}
            >
              <SlideText slide={slide} wrap />
            </div>
          ))
        );
      })}
    </div>
  );
}

/**
 * The live part enlarged, up to text-2xl, without wrapping its lines: as big as its longest
 * line lets it, and at text-lg size lines wrap after all, never cut off.
 */
function FitLines({
  lang,
  className,
  render,
}: {
  lang: string;
  className: string;
  render: (wrap: boolean) => React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [wrap, setWrap] = useState(false);
  // The width it was measured at: wrapped, it's measured again only at another width.
  const width = useRef(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      // Measured unwrapped; wrapped only when nothing smaller fit.
      if (wrap) return;
      const rem = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      const fits = () => el.scrollWidth <= el.clientWidth;
      // text-2xl down to text-lg, in steps of a pixel.
      let size = 1.5 * rem;
      el.style.fontSize = `${size}px`;
      while (size > 1.125 * rem && !fits()) el.style.fontSize = `${--size}px`;
      width.current = el.clientWidth;
      if (!fits()) setWrap(true);
    };
    fit();
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width.current) return;
      if (wrap) setWrap(false);
      else fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [render, wrap]);
  return (
    <div ref={box} lang={lang} className={`min-w-0 ${className}`}>
      {render(wrap)}
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
    <div className="col-span-2 rounded-xl border border-separator p-3">
      <p className="font-semibold">
        {t("stage.nextSong", { title: titleFor(next.song.titles, languages) })}
      </p>
      {firstLine && <p className="text-muted">{firstLine}</p>}
    </div>
  );
}

function PartBox({
  active,
  onPress,
  children,
}: {
  active: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  // Live in the live color, the others alike; one border width for all, so nothing
  // moves on.
  // Room on the right for its mark (PartMark).
  const look = `relative block w-full rounded-xl border-2 p-3 pe-10 text-start ${
    active ? "border-live bg-live/10" : "border-separator"
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
