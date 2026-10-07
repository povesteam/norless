import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Entry } from "../../server/playlists/playlists";
import type { Song } from "../../server/songs/songs";
import {
  capoFor,
  chordName,
  notesFor,
  playedKey,
  playedText,
  rootOf,
  chordColors,
  shapeKeyAt,
  shapeOf,
  withColors,
  type NoteNaming,
} from "../../shared/music/music";
import { parseSong, partBars, type Slide } from "../../shared/song-text";
import { useShows } from "../data/community";
import { PartBlocks } from "../chords/Notation";
import { BarGrid, gridLines, SlideView } from "../songs/SongText";
import { PartBox, PartMark } from "./parts";
import { ChordDiagrams } from "./ChordDiagrams";
import { Changes } from "./Changes";
import { InstrumentHeader } from "./InstrumentHeader";
import {
  type InstrumentLayoutId,
  layoutInstrument,
  type Profile,
} from "./instrument-layouts";

type Rename = (chord: string) => string;

/** A slide with its chords renamed: shapes, Do-Re-Mi or numbers. */
const renamed = (slide: Slide, rename: Rename): Slide => ({
  ...slide,
  lines: slide.lines.map((line) => ({
    ...line,
    chords: line.chords.map((c) => ({ ...c, name: rename(c.name) })),
    ...(line.bars ? { bars: line.bars.map((bar) => bar.map(rename)) } : {}),
  })),
});

/** The number of bars of a part with bar lines; none without them. */
const barCount = (slide: Slide) =>
  slide.lines.some((l) => l.bars) ? partBars(slide).length : null;

/** A guitarist's capo for a song, changed on this device. */
function useCapo(songId: string, computed: number) {
  const storage = `norless:capo:${songId}`;
  const [own, setOwn] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem(storage);
      return stored === null ? null : Number(stored);
    } catch {
      return null;
    }
  });
  const set = (capo: number) => {
    setOwn(capo);
    try {
      localStorage.setItem(storage, String(capo));
    } catch {
      // Kept for this page only.
    }
  };
  return [own ?? computed, set] as const;
}

/**
 * The live song in an instrument's layout: chords in the key it's played in, in the
 * member's note names, with the notes for their instruments and what comes next.
 */
export function InstrumentLayout({
  slug,
  layout,
  song,
  serviceKey,
  version,
  live,
  labels,
  partName,
  next,
  languages,
  profile,
  onPart,
  keyMark,
}: {
  slug: string;
  layout: InstrumentLayoutId;
  song: Song;
  serviceKey: string | null;
  version: { text: string };
  live: number;
  labels: string[];
  partName: (slide: Slide | undefined, label: string) => string;
  next: Entry | null;
  languages: string[];
  profile: Profile;
  onPart?: (slide: number) => void;
  /** Makes the key it's played in (SongKey) from that key. */
  keyMark: (shown: string) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const played = playedKey(song.keySignature, serviceKey);
  const key = played.key;
  const slides = parseSong(
    playedText(version.text, song.keySignature, serviceKey),
  ).slides;
  const instrument = layoutInstrument[layout];
  const plays = [...new Set([instrument, ...profile.plays])];
  const computed = key ? capoFor(key, profile.shapes) : null;
  const [capo, setCapo] = useCapo(song.id, computed?.capo ?? 0);
  const shapeKey = key ? shapeKeyAt(key, capo) : null;

  const guitar = instrument === "guitar";
  const [numbers, setNumbers] = useState(true);
  const naming: NoteNaming =
    layout === "keys-numbers"
      ? numbers
        ? "numbers"
        : profile.naming === "numbers"
          ? "letters"
          : profile.naming
      : profile.naming;
  const rename: Rename = guitar
    ? (c) =>
        shapeKey ? chordName(shapeOf(c, capo, shapeKey), naming, shapeKey) : c
    : (c) => chordName(c, naming, key);
  // Colors from the chords in letters, before renaming: "5/7" isn't a chord to place.
  const shown = slides.map((s) =>
    renamed(profile.colors ? withColors(s, key) : s, rename),
  );
  const part = (i: number) => partName(slides[i], labels[i] ?? "");
  const notes = (slide: Slide) => notesFor(slide.notes, plays);
  const current = shown[live];
  const upcoming = shown[live + 1];

  // Notation blocks of the live and next parts, for keys and drums.
  const shows = useShows();
  const notating =
    (instrument === "keys" || instrument === "drums") && shows("chords");
  const blocks = (i: number) =>
    notating && (i === live || i === live + 1) ? (
      <PartBlocks
        blocks={slides[i]?.blocks ?? []}
        drums={instrument === "drums"}
        transpose={played.semitones}
        bpm={song.bpm}
        part={part(i)}
      />
    ) : null;

  // Bars from the chords in letters, renamed after: "5/7" isn't a chord to group.
  const barsAt = (i: number) =>
    slides[i] ? partBars(slides[i]).map((bar) => bar.map(rename)) : [];
  const changes = (
    <Changes
      slug={slug}
      count={slides.length}
      barsAt={barsAt}
      live={live}
      part={part}
      next={next}
      songKey={key}
      languages={languages}
      naming={profile.naming}
    />
  );

  const header = (
    <InstrumentHeader
      song={song}
      keyMark={keyMark(played.shown)}
      capo={capo}
      onCapo={setCapo}
      shapeKey={guitar ? shapeKey : null}
      numbers={layout === "keys-numbers" ? numbers : null}
      onNumbers={setNumbers}
    />
  );

  const bars = (i: number) => (
    <BarGrid
      lines={gridLines(
        slides[i] ?? { lines: [] },
        rename,
        profile.colors ? (c) => chordColors(c, key) : undefined,
      )}
    />
  );
  const notesOf = (slide: Slide) =>
    notes(slide).map((note, j) => (
      <p key={j} className="mt-1 text-sm text-muted italic">
        {note}
      </p>
    ));
  const withNotes = (slide: Slide): Slide => ({ ...slide, notes: [] });

  // The live part with its chords over the words, the next one as chords: guitar on a
  // phone, keys in concert pitch.
  if (layout === "guitar-words" || layout === "keys-concert")
    return (
      <div className="flex flex-col gap-4">
        {header}
        {current && (
          <PartBox active standalone>
            <PartMark mark={labels[live] ?? ""} name={part(live)} />
            <SlideView slide={{ ...withNotes(current), name: null }} />
            {notesOf(current)}
            {layout === "keys-concert" && (
              <p className="mt-2 text-lg">
                <span className="text-muted">{t("instruments.bass")}: </span>
                <span className="font-bold">
                  {partBars(slides[live] as Slide)
                    .map((bar) => rename(rootOf(bar.at(-1) ?? "") ?? ""))
                    .join(" · ")}
                </span>
              </p>
            )}
            {blocks(live)}
          </PartBox>
        )}
        {changes}
        {upcoming && (
          <PartBox
            active={false}
            standalone
            onPress={onPart && (() => onPart(live + 1))}
            after={blocks(live + 1)}
          >
            <p className="font-semibold">
              {t("stage.next", { part: part(live + 1) })}
            </p>
            {bars(live + 1)}
          </PartBox>
        )}
        {layout === "keys-concert" && (
          <section
            aria-label={t("instruments.map")}
            className="flex flex-col gap-1"
          >
            <p className="text-sm font-semibold text-muted">
              {t("instruments.map")}
            </p>
            {shown.map((slide, i) => (
              <div key={i} className="flex items-baseline gap-2 text-sm">
                <span
                  className={`w-20 shrink-0 font-semibold ${i === live ? "text-live" : ""}`}
                >
                  {part(i)}
                </span>
                <span>
                  {barsAt(i)
                    .map((bar) => bar.join(" "))
                    .join(" | ")}
                </span>
              </div>
            ))}
          </section>
        )}
      </div>
    );

  // Every part as bars: guitar shapes on a phone, numbers for keys.
  if (layout === "guitar-bars" || layout === "keys-numbers")
    return (
      <div className="flex flex-col gap-4">
        {header}
        {changes}
        <div role="list" className="flex flex-col gap-2">
          {shown.map((slide, i) => (
            <PartBox
              key={i}
              active={i === live}
              onPress={onPart && (() => onPart(i))}
              after={blocks(i)}
            >
              {/* The part's mark in the corner, so its bars have the width. */}
              <PartMark mark={labels[i] ?? ""} name={part(i)} />
              <div className="flex flex-col gap-1">
                <div className="min-w-0 flex-1">{bars(i)}</div>
              </div>
              {notesOf(slide)}
            </PartBox>
          ))}
        </div>
      </div>
    );

  if (layout === "guitar-chart")
    return (
      <div className="flex flex-col gap-4">
        {header}
        {changes}
        <ChordDiagrams
          shapes={[
            ...new Set(
              shown.flatMap((s) =>
                s.lines.flatMap((l) => l.chords.map((c) => c.name)),
              ),
            ),
          ]}
        />
        <div role="list" className="grid gap-2 lg:grid-cols-2">
          {shown.map((slide, i) => (
            <PartBox
              key={i}
              active={i === live}
              onPress={onPart && (() => onPart(i))}
            >
              <PartMark mark={labels[i] ?? ""} name={part(i)} />
              <SlideView slide={{ ...withNotes(slide), name: null }} />
              {notesOf(slide)}
            </PartBox>
          ))}
        </div>
      </div>
    );

  if (layout === "drums-parts")
    return (
      <div className="flex flex-col gap-4">
        {header}
        {changes}
        <div role="list" className="flex flex-col gap-2">
          {shown.map((slide, i) => {
            const count = barCount(slides[i] as Slide);
            return (
              <PartBox
                key={i}
                active={i === live}
                onPress={onPart && (() => onPart(i))}
                after={blocks(i)}
              >
                {/* Sized by its bars, so a long part looks long. */}
                <div
                  className="flex flex-wrap items-baseline gap-x-4"
                  style={{ minHeight: `${2 + (count ?? 0) * 0.4}rem` }}
                >
                  <span className="text-2xl font-bold">{part(i)}</span>
                  {count !== null && (
                    <span className="text-lg">
                      {t("instruments.bars", { count })}
                    </span>
                  )}
                  <span className="text-muted">
                    {t(`instruments.energy.${energyOf(slide)}`)}
                  </span>
                </div>
                {notesOf(slide)}
              </PartBox>
            );
          })}
        </div>
      </div>
    );

  if (layout === "drums-cue") {
    const liveSlide = slides[live];
    const count = liveSlide ? barCount(liveSlide) : null;
    const after = slides[live + 1];
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        {header}
        <p
          aria-live="polite"
          className="text-[min(40vw,40vh)] leading-none font-black"
        >
          {/* The short label, R or 2, fills the screen. */}
          {current ? (labels[live] ?? part(live)) : "–"}
        </p>
        {count !== null && (
          <p className="text-3xl font-bold">
            {t("instruments.bars", { count })}
          </p>
        )}
        {current && notesOf(current)}
        {blocks(live)}
        {changes}
        {upcoming && (
          <p className="text-2xl">
            {t("stage.next", { part: part(live + 1) })}
            {after &&
              barCount(after) !== null &&
              ` · ${t("instruments.bars", { count: barCount(after) ?? 0 })}`}
          </p>
        )}
        {blocks(live + 1)}
      </div>
    );
  }

  // Bass: the live part's root notes, large, the chords smaller below.
  return (
    <div className="flex flex-col gap-4">
      {header}
      {current && (
        <PartBox active standalone>
          <p className="font-semibold">{part(live)}</p>
          <div className="flex flex-wrap gap-3">
            {partBars(slides[live] as Slide).map((bar, j) => (
              <div
                key={j}
                className="flex min-w-16 flex-col items-center rounded-lg border border-separator px-3 py-2"
              >
                <span className="text-4xl font-black">
                  {bar
                    .map((c) => chordName(rootOf(c) ?? c, naming, key))
                    .join(" ")}
                </span>
                <span className="text-sm text-muted">
                  {bar.map(rename).join(" ")}
                </span>
              </div>
            ))}
          </div>
          {notesOf(current)}
        </PartBox>
      )}
      {changes}
      {upcoming && (
        <PartBox
          active={false}
          standalone
          onPress={onPart && (() => onPart(live + 1))}
        >
          <p className="font-semibold">
            {t("stage.next", { part: part(live + 1) })}
          </p>
          <p className="text-2xl font-bold">
            {partBars(slides[live + 1] as Slide)
              .map((bar) =>
                bar
                  .map((c) => chordName(rootOf(c) ?? c, naming, key))
                  .join(" "),
              )
              .join(" · ")}
          </p>
        </PartBox>
      )}
    </div>
  );
}

/** How hard the drums play a part: a `! drums:` note wins, else its type says. */
function energyOf(slide: Slide): "calm" | "full" | "building" {
  const note = notesFor(slide.notes, ["drums"]).join(" ").toLowerCase();
  if (/full|plin|tare|повн|сильн/.test(note)) return "full";
  if (/build|cresc|crește|наро/.test(note)) return "building";
  if (/calm|soft|încet|liniștit|тих|спокій/.test(note)) return "calm";
  return slide.type === "refrain"
    ? "full"
    : slide.type === "bridge" || slide.type === "pre-chorus"
      ? "building"
      : "calm";
}
