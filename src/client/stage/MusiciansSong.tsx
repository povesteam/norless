import { FileMusic } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { LiveChordView } from "../chords/PlayChords";
import type { LiveView } from "../../server/live/live-view";
import type { Song } from "../../server/songs/songs";
import { titleFor } from "../../shared/song-render";
import {
  parseSong,
  partBars,
  partLabels,
  type Slide,
} from "../../shared/song-text";
import { InstrumentLayout } from "./Instruments";
import { isInstrumentLayout, type Profile } from "./instrument-layouts";
import { PartBox, PartMark, usePartName } from "./parts";
import { SongKey } from "./SongKey";
import { RecordingsMark } from "../songs/RecordingsMark";
import {
  chordColors,
  playedKey,
  playedText,
  withColors,
} from "../../shared/music/music";
import { BarGrid, gridLines, SlideView } from "../songs/SongText";
import { LedByIcon } from "../playlists/LedBy";

/** The version musicians read: the first in `languages` with chords, else the first there is. */
function musiciansVersion(song: Song, languages: string[]) {
  const versions = languages
    .map((l) => song.versions.find((v) => v.language === l))
    .filter((v) => v !== undefined);
  return (
    versions.find((v) => /^\s*\.[^.]/m.test(v.text)) ??
    versions[0] ??
    song.versions[0]
  );
}

export function Song({
  slug,
  leader: showsLeader = false,
  recordings = false,
  profile,
  view,
  song,
  languages,
  layout,
  onPart,
  chordsLink,
}: {
  slug: string;
  leader?: boolean;
  /** For the team, with the recordings on: the song's recordings marked. */
  recordings?: boolean;
  profile: Profile;
  view: LiveView;
  song: Song;
  languages: string[];
  layout: string;
  onPart?: (slide: number) => void;
  /** The Chords mode in a language, for members who may add chords. */
  chordsLink?: (language: string) => string;
}) {
  const { t } = useTranslation();
  const partName = usePartName();
  const version = musiciansVersion(song, languages);
  // In the key for this service, when the team set one.
  const serviceKey = view.entry?.keySignature ?? null;
  const slides = version
    ? parseSong(playedText(version.text, song.keySignature, serviceKey)).slides
    : [];
  // Chords colored in the played key, for members who chose it.
  const key = playedKey(song.keySignature, serviceKey).key;
  const colored = profile.colors
    ? slides.map((s) => withColors(s, key))
    : slides;
  const labels = partLabels(slides);
  const live = view.blank ? -1 : Math.min(view.slide, slides.length - 1);
  const hasChords = slides.some((s) => s.lines.some((l) => l.chords.length));
  const title = titleFor(
    Object.fromEntries(song.versions.map((v) => [v.language, v.title])),
    languages,
  );
  const part = (i: number) => partName(slides[i], labels[i] ?? "");
  // The key with its icon; the team changes it for this service from here.
  // With the song's recordings marked beside it, for the team.
  const keyMark = (shown: string) => (
    <>
      {shown && (
        <SongKey slug={slug} view={view} shown={shown} canChange={!!onPart} />
      )}
      {recordings && (
        <RecordingsMark
          slug={slug}
          songId={song.id}
          count={view.entry?.song?.recordings}
        />
      )}
    </>
  );
  const shownKey = serviceKey || song.keySignature;
  const hasBlocks = slides.some((s) => s.blocks.length > 0);
  // Drums need no chords, nor keys with notation; the other instruments fall back to
  // the words and structure.
  const instrument =
    isInstrumentLayout(layout) &&
    (hasChords ||
      layout.startsWith("drums") ||
      (layout.startsWith("keys") && hasBlocks))
      ? layout
      : null;

  if (layout === "live-chord")
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <LiveChordView slug={slug} songKey={key} />
      </div>
    );

  // Who leads the song, beside its title.
  const leader = view.ledBy && showsLeader && (
    <span className="flex items-center gap-1 text-lg">
      <LedByIcon aria-hidden className="size-4" />
      {t("team.ledBy", { name: view.ledBy })}
    </span>
  );

  if (instrument && version)
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="text-2xl font-semibold">{title}</h2>
          {leader}
        </div>
        <InstrumentLayout
          slug={slug}
          layout={instrument}
          song={song}
          serviceKey={serviceKey}
          version={version}
          live={live}
          labels={labels}
          partName={partName}
          next={view.next}
          languages={languages}
          profile={profile}
          onPart={onPart}
          keyMark={keyMark}
        />
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {keyMark(shownKey)}
        {song.timeSignature && (
          <span className="text-lg font-semibold whitespace-nowrap">
            {t("song.time", { time: song.timeSignature })}
          </span>
        )}
        {song.bpm !== null && (
          <span className="text-lg font-semibold whitespace-nowrap">
            {t("song.tempo", { bpm: song.bpm })}
          </span>
        )}
        {leader}
      </div>

      {!hasChords ? (
        <>
          <p className="text-muted">
            {t("musicians.noChords")}{" "}
            {chordsLink && version && (
              <Link href={chordsLink(version.language)} className="link">
                <FileMusic />
                {t("musicians.addChords")}
              </Link>
            )}
          </p>
          <p
            aria-label={t("musicians.structure")}
            className="text-lg font-semibold"
          >
            {labels.join(" · ")}
          </p>
          <div
            role="list"
            aria-label={t("vocalists.parts")}
            className="flex flex-col gap-2"
          >
            {slides.map((slide, i) => (
              <PartBox
                key={i}
                active={i === live}
                onPress={onPart && (() => onPart(i))}
              >
                <PartMark mark={labels[i] ?? ""} name={part(i)} />
                <SlideView slide={{ ...slide, name: null }} />
              </PartBox>
            ))}
          </div>
        </>
      ) : layout === "bar-grid" ? (
        <div
          role="list"
          aria-label={t("musicians.layouts.bar-grid")}
          className="flex flex-col gap-2"
        >
          {slides.map((slide, i) => (
            <PartBox
              key={i}
              active={i === live}
              onPress={onPart && (() => onPart(i))}
            >
              {/* The part's mark in the corner, so its bars have the width. */}
              <PartMark mark={labels[i] ?? ""} name={part(i)} />
              <div className="flex flex-col gap-1">
                <div className="min-w-0 flex-1">
                  <BarGrid
                    lines={gridLines(
                      slide,
                      undefined,
                      profile.colors ? (c) => chordColors(c, key) : undefined,
                    )}
                  />
                </div>
              </div>
              {slide.notes.map((note, j) => (
                <p key={j} className="mt-1 text-sm italic text-muted">
                  {note.text}
                </p>
              ))}
            </PartBox>
          ))}
        </div>
      ) : (
        <>
          {colored[live] && (
            <PartBox active standalone>
              <PartMark mark={labels[live] ?? ""} name={part(live)} />
              <SlideView slide={{ ...colored[live], name: null }} />
            </PartBox>
          )}
          {slides[live + 1] && (
            <PartBox
              active={false}
              standalone
              onPress={onPart && (() => onPart(live + 1))}
            >
              <p className="font-semibold">
                {t("stage.next", { part: part(live + 1) })}
              </p>
              <p className="text-lg font-bold">
                {partBars(slides[live + 1] as Slide)
                  .map((bar) => bar.join(" "))
                  .join(" | ")}
              </p>
            </PartBox>
          )}
        </>
      )}
    </div>
  );
}
