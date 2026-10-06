import { Key as Keys, Note } from "tonal";
import { transposeChord, transposeText } from "./chord-sheet.js";
import { keyOf, type Key } from "./chords.js";
import type { Slide, Note as SongNote } from "../song-text.js";

/**
 * What instrument layouts need from chords: note names, a
 * guitarist's capo and shapes, bass roots, the notes for each player and key changes.
 * Used in the browser only.
 */

export {
  guitarShapes,
  instruments,
  noteNamings,
  type Instrument,
  type NoteNaming,
} from "../preferences.js";
import {
  guitarShapes,
  type Instrument,
  type NoteNaming,
} from "../preferences.js";

const ROOT = /^([A-Ga-g])([#b]?)(.*)$/;
const SOLFEGE: Record<string, string> = {
  C: "Do",
  D: "Re",
  E: "Mi",
  F: "Fa",
  G: "Sol",
  A: "La",
  B: "Si",
};
const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const MAJOR_DEGREES = [
  "1",
  "b2",
  "2",
  "b3",
  "3",
  "4",
  "#4",
  "5",
  "b6",
  "6",
  "b7",
  "7",
];
const MINOR_DEGREES = [
  "1",
  "b2",
  "2",
  "3",
  "#3",
  "4",
  "#4",
  "5",
  "6",
  "#6",
  "7",
  "#7",
];

/** A chord's root, its suffix and its bass note; a lowercase root is a minor chord. */
function parts(chord: string) {
  const [main = "", bass] = chord.split("/");
  const m = ROOT.exec(main);
  if (!m?.[1]) return null;
  const minorByCase = m[1] === m[1].toLowerCase();
  const suffix = (m[3] ?? "").trim();
  return {
    root: m[1].toUpperCase() + (m[2] ?? ""),
    suffix: minorByCase && !/^m(?!aj)/.test(suffix) ? `m${suffix}` : suffix,
    bass:
      bass && ROOT.test(bass) ? bass[0]?.toUpperCase() + bass.slice(1) : null,
  };
}

const degree = (note: string, key: Key) => {
  const semis =
    ((Note.chroma(note) ?? 0) - (Note.chroma(key.tonic) ?? 0) + 12) % 12;
  return (key.minor ? MINOR_DEGREES : MAJOR_DEGREES)[semis] ?? "?";
};

/**
 * A chord in a member's note names: letters as stored, Do-Re-Mi ("C#m/G#" is
 * "Do#m/Sol#"), or numbers relative to the key (B/D# in E is "5/7", E7 is "1⁷").
 * Words that aren't chords stay as they are.
 */
export function chordName(
  chord: string,
  naming: NoteNaming,
  key: Key | null,
): string {
  const p = parts(chord);
  if (!p) return chord;
  if (naming === "letters") return chord;
  const name =
    naming === "solfege"
      ? (n: string) => (SOLFEGE[n[0] ?? ""] ?? n[0] ?? "") + n.slice(1)
      : key
        ? (n: string) => degree(n, key)
        : (n: string) => n;
  const suffix =
    naming === "numbers" && key && /^\d/.test(p.suffix)
      ? p.suffix.replace(/^\d+/, (d) =>
          d.replace(/\d/g, (x) => SUPERSCRIPT[Number(x)] ?? x),
        )
      : p.suffix;
  return name(p.root) + suffix + (p.bass ? `/${name(p.bass)}` : "");
}

/**
 * A chord's degree in the key, 1 to 7, by its root: G in D and Bb in F
 * are both 4, Am in A minor is 1. Null without a key, for what isn't a chord, and for a
 * root outside the key's scale (Bb in C).
 */
export function scaleDegree(chord: string, key: Key | null): number | null {
  const p = parts(chord);
  if (!p || !key) return null;
  const d = degree(p.root, key);
  return /^\d$/.test(d) ? Number(d) : null;
}

/**
 * A chord's colors as CSS colors: its letter's, its suffix's (the last `suffixLength`
 * characters before a slash, whatever the note names) and its bass's after the slash.
 */
export type ChordColors = {
  root: string;
  degree: number;
  suffix?: string;
  suffixLength?: number;
  bass?: string;
  bassDegree?: number;
};

const TEXT = "var(--foreground)";

/**
 * A quarter toward the text color, at today's lightness, so every color reaches 4.5:1
 * in light and dark; only hue and chroma change.
 */
const mix = (chroma: number, hue: number) =>
  `color-mix(in oklab, oklch(0.62 ${chroma.toFixed(3)} ${Math.round(hue)}) 75%, var(--foreground))`;

/** A root or bass outside the key's scale. */
const OUTSIDE = mix(0.2, 350);

/**
 * Relative pairs: each of 1, 4
 * and 5 shares its hue with its relative (6, 2 and 3 in major; 3, 6 and 7 in minor),
 * which is softer; the tonic is plain, its relative a faint tint, and the degree left
 * over (7 in major, 2 in minor) on its own. Degree 1 to 7 to [hue, chroma].
 */
const PAIRS: Record<"major" | "minor", [number, number][]> = {
  major: [
    [0, 0],
    [250, 0.09],
    [150, 0.08],
    [250, 0.17],
    [150, 0.16],
    [290, 0.06],
    [205, 0.12],
  ],
  minor: [
    [0, 0],
    [205, 0.12],
    [290, 0.06],
    [250, 0.17],
    [150, 0.16],
    [250, 0.09],
    [150, 0.08],
  ],
};

/**
 * A chord's suffix after a minor's "m", on a ramp by tension:
 * maj7, add and sixths grey, sus yellow, sevenths and extensions orange, diminished,
 * augmented and altered red.
 */
function suffixColor(suffix: string) {
  if (!suffix) return undefined;
  if (/dim|°|ø|aug|\+|[b#-]5|alt/.test(suffix)) return mix(0.2, 25);
  if (/maj|add|^6/.test(suffix)) return mix(0, 0);
  if (/7|9|11|13/.test(suffix)) return mix(0.17, 55);
  return mix(0.14, 95);
}

/** Each degree's triad, 1 to 7: major, minor or diminished; in minor, 5 either way. */
const TRIADS = { major: "MmmMMmd", minor: "mdMmxMM" };

/**
 * Whether a chord on a degree of the scale is the key's own: D or
 * D7 in C isn't (a secondary dominant), Dm7 is. A sus or power chord fits any degree.
 */
function inKey(suffix: string, degree: number, minor: boolean) {
  const triad = TRIADS[minor ? "minor" : "major"][degree - 1];
  if (/^(sus|5)/.test(suffix) || triad === "x") return true;
  const quality = /dim|°|ø|m7?b5/.test(suffix)
    ? "d"
    : /aug|\+/.test(suffix)
      ? "a"
      : /^m(?!aj)/.test(suffix)
        ? "m"
        : "M";
  return quality === triad;
}

function degreeColor(degree: number, minor: boolean) {
  if (!degree) return OUTSIDE;
  if (degree === 1) return TEXT;
  const [hue, chroma] = PAIRS[minor ? "minor" : "major"][degree - 1] ?? [0, 0];
  return mix(chroma, hue);
}

/**
 * A suffix's ramp color mixed halfway with its letter's, so it stands apart yet belongs
 * to its chord (the maintainer: "a little more muted, blend with the chord
 * color").
 */
const blend = (suffix: string, letter: string) =>
  `color-mix(in oklab, ${suffix} 50%, ${letter})`;

/**
 * A chord's colors: its letter by its root's degree, its suffix by its
 * tension, a slash chord's bass by the bass's own degree; outside the key (by its root,
 * or a chord that isn't the key's own on its degree), the outside color, degree 0. None
 * without a key, or for what isn't a chord.
 */
export function chordColors(
  chord: string,
  key: Key | null,
): ChordColors | undefined {
  const p = parts(chord);
  if (!p || !key) return undefined;
  const onScale = scaleDegree(chord, key) ?? 0;
  const root = onScale && inKey(p.suffix, onScale, key.minor) ? onScale : 0;
  const bass = p.bass ? (scaleDegree(p.bass, key) ?? 0) : undefined;
  const suffix = p.suffix.replace(/^m(?!aj)/, "");
  const tint = suffixColor(suffix);
  const letter = degreeColor(root, key.minor);
  return {
    root: letter,
    degree: root,
    ...(tint && { suffix: blend(tint, letter), suffixLength: suffix.length }),
    ...(bass !== undefined && {
      bass: degreeColor(bass, key.minor),
      bassDegree: bass,
    }),
  };
}

/** A degree's color, for the legend. */
export const legendColor = (degree: number) => degreeColor(degree, false);

/** The suffixes' ramp, as on the tonic, for the legend. */
export const legendSuffixes = ["maj7", "sus4", "7", "dim"].map((suffix) => ({
  suffix,
  color: blend(suffixColor(suffix) ?? TEXT, TEXT),
}));

/** A slide with each chord's colors, for views that color chords. */
export const withColors = (slide: Slide, key: Key | null): Slide =>
  key
    ? {
        ...slide,
        lines: slide.lines.map((line) => ({
          ...line,
          chords: line.chords.map((c) => ({
            ...c,
            colors: chordColors(c.name, key),
          })),
        })),
      }
    : slide;

/** A key in a member's note names: letters, Do-Re-Mi; numbers show letters, as 1 says nothing. */
export const keyName = (key: Key, naming: NoteNaming) =>
  chordName(
    `${key.tonic}${key.minor ? "m" : ""}`,
    naming === "numbers" ? "letters" : naming,
    key,
  );

/** The major key whose shapes a key uses: itself, or a minor key's relative major. */
const majorOf = (key: Key) =>
  key.minor ? Keys.minorKey(key.tonic).relativeMajor : key.tonic;

/**
 * The capo and the shape key for a guitarist: the lowest fret from 0 to 7 at which one
 * of their shapes fits the key, ties going to the first in their order. A minor key
 * uses its relative major's shape (A minor is played with C's).
 */
export function capoFor(
  key: Key,
  shapes: readonly string[],
): { capo: number; shapeKey: Key } {
  const tonic = Note.chroma(majorOf(key)) ?? 0;
  const options = (shapes.length ? shapes : guitarShapes).map((shape) => ({
    shape,
    capo: (tonic - (Note.chroma(shape) ?? 0) + 12) % 12,
  }));
  const fitting = options.filter((o) => o.capo <= 7);
  const best = (fitting.length ? fitting : options).reduce((a, b) =>
    b.capo < a.capo ? b : a,
  );
  const shapeKey = key.minor
    ? { tonic: Keys.majorKey(best.shape).minorRelative, minor: true }
    : { tonic: best.shape, minor: false };
  return { capo: best.capo, shapeKey };
}

/** The key a guitarist's shapes are in with a capo, e.g. C for E with capo 4. */
export function shapeKeyAt(key: Key, capo: number): Key {
  const major = transposeChord(majorOf(key), -capo, {
    tonic: "C",
    minor: false,
  });
  return key.minor
    ? { tonic: Keys.majorKey(major).minorRelative, minor: true }
    : { tonic: major, minor: false };
}

/** The shape a guitarist plays for a chord with this capo. */
export const shapeOf = (chord: string, capo: number, shapeKey: Key) =>
  transposeChord(chord, -capo, shapeKey);

/** The note a bass player plays for a chord: its bass note, or its root. */
export function rootOf(chord: string): string | null {
  const p = parts(chord);
  return p ? (p.bass ?? p.root) : null;
}

const PLAYER_WORDS: Record<string, Instrument> = {
  drums: "drums",
  tobe: "drums",
  baterie: "drums",
  барабани: "drums",
  ударні: "drums",
  "🥁": "drums",
  keys: "keys",
  clape: "keys",
  pian: "keys",
  клавішні: "keys",
  піаніно: "keys",
  "🎹": "keys",
  bass: "bass",
  bas: "bass",
  бас: "bass",
  "🎻": "bass",
  guitar: "guitar",
  chitară: "guitar",
  chitara: "guitar",
  гітара: "guitar",
  "🎸": "guitar",
};

/** Who a note is for and what it says without its prefix; null is everyone. */
export function noteFor(note: Pick<SongNote, "text">): {
  player: Instrument | null;
  text: string;
} {
  const m =
    /^(\S+?)\s*:\s*(.*)$/su.exec(note.text) ??
    /^(\p{Extended_Pictographic})\s*(.*)$/su.exec(note.text);
  const player = m?.[1] ? PLAYER_WORDS[m[1].toLowerCase()] : undefined;
  if (player) return { player, text: m?.[2] ?? "" };
  // "all: softer" is for everyone; other words before a colon are part of the note.
  if (m?.[1]?.toLowerCase() === "all" || m?.[1]?.toLowerCase() === "toți")
    return { player: null, text: m[2] ?? "" };
  return { player: null, text: note.text };
}

/** The notes a player sees: those for everyone, and those for one of their instruments. */
export function notesFor(
  notes: Pick<SongNote, "text">[],
  plays: readonly Instrument[],
): string[] {
  return notes.flatMap((note) => {
    const { player, text } = noteFor(note);
    return player === null || plays.includes(player) ? [text] : [];
  });
}

/**
 * The half steps from one key's tonic to another's, between -5 and 6: A to C is 3 (up),
 * A to G is -2 (down). Transposing to a service key moves chords by as much.
 */
export function halfSteps(from: Key, to: Key): number {
  const up =
    ((Note.chroma(to.tonic) ?? 0) - (Note.chroma(from.tonic) ?? 0) + 12) % 12;
  return up > 6 ? up - 12 : up;
}

/**
 * The key an entry's song is played in (its service key, else the song's), and how far
 * its chords move from the song's key; keys that don't parse move nothing.
 */
export function playedKey(songKey: string, serviceKey?: string | null) {
  const shown = serviceKey?.trim() || songKey;
  const from = keyOf(songKey);
  const key = keyOf(shown);
  const semitones =
    from && key && from.minor === key.minor ? halfSteps(from, key) : 0;
  return { shown, key, semitones };
}

/** A song text with its chords in the key it's played in. */
export function playedText(
  text: string,
  songKey: string,
  serviceKey?: string | null,
): string {
  const { key, semitones } = playedKey(songKey, serviceKey);
  return key ? transposeText(text, semitones, key) : text;
}
