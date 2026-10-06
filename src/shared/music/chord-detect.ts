import { Chord, Note } from "tonal";
import { spell } from "./chord-sheet.js";
import type { Key } from "./chords.js";

/**
 * Naming chords from what's played: from the notes a MIDI piano
 * holds, or from the sound a microphone or the mixer gives. And where a chord sits on the
 * circle of fifths, for the wheel.
 */

/** The chord types worth naming, and how Norless writes them. */
const symbols: Record<string, string> = {
  major: "",
  minor: "m",
  "dominant seventh": "7",
  "minor seventh": "m7",
  "major seventh": "maj7",
  "suspended fourth": "sus4",
  "suspended second": "sus2",
  diminished: "dim",
  augmented: "aug",
  sixth: "6",
  "minor sixth": "m6",
  "dominant ninth": "9",
  "half-diminished": "m7b5",
  "diminished seventh": "dim7",
  fifth: "5",
};

const named = (pitchClass: string, key: Key | null) =>
  key ? spell(pitchClass, key) : pitchClass;

/**
 * One or two notes as a shorthand (decision review): the interval from the
 * lower to the upper note gives whose chord it is and which (one note is its major
 * chord), as a keyboard's one-finger chords do.
 */
const shorthand: Record<number, { upper: boolean; symbol: string }> = {
  0: { upper: false, symbol: "" },
  3: { upper: false, symbol: "m" },
  4: { upper: false, symbol: "" },
  5: { upper: true, symbol: "" },
  7: { upper: false, symbol: "" },
  8: { upper: true, symbol: "" },
  9: { upper: true, symbol: "m" },
  10: { upper: false, symbol: "7" },
};

/**
 * The chord some held MIDI notes make, spelled for the key, the lowest note as its bass
 * ("E/G#"); one or two different notes are a shorthand; null for nothing to name.
 */
export function chordOfNotes(midi: number[], key: Key | null): string | null {
  const sorted = [...midi].sort((a, b) => a - b);
  const pcs = [
    ...new Set(
      sorted.map((m) => named(Note.pitchClass(Note.fromMidiSharps(m)), key)),
    ),
  ];
  if (pcs.length === 0) return null;
  if (pcs.length <= 2) {
    const [low = 0] = sorted;
    const high = sorted.find((m) => (m - low) % 12 !== 0) ?? low;
    const short = shorthand[(high - low) % 12];
    if (!short) return null;
    const root = short.upper ? pcs[pcs.length - 1] : pcs[0];
    return `${root}${short.symbol}`;
  }
  for (const candidate of Chord.detect(pcs, { assumePerfectFifth: true })) {
    const chord = Chord.get(candidate);
    const symbol = symbols[chord.type];
    if (symbol === undefined || !chord.tonic) continue;
    const bass =
      chord.bass && chord.bass !== chord.tonic ? `/${chord.bass}` : "";
    return `${chord.tonic}${symbol}${bass}`;
  }
  return null;
}

/** Energy per pitch class (C first) in a spectrum in decibels, the loudest 1. */
export function chromaOf(decibels: Float32Array, sampleRate: number): number[] {
  const chroma = Array.from({ length: 12 }, () => 0);
  const binHz = sampleRate / (decibels.length * 2);
  for (let i = 1; i < decibels.length; i++) {
    const hz = i * binHz;
    // From the bass guitar's low A to well above the melody.
    if (hz < 55 || hz > 2000) continue;
    const midi = 69 + 12 * Math.log2(hz / 440);
    const nearest = Math.round(midi);
    // Closer to a note's pitch counts more; between two notes, little.
    const weight = Math.max(0, 1 - 2 * Math.abs(midi - nearest));
    const amplitude = 10 ** ((decibels[i] ?? -200) / 20);
    const pc = ((nearest % 12) + 12) % 12;
    chroma[pc] = (chroma[pc] ?? 0) + amplitude * weight;
  }
  const top = Math.max(...chroma);
  return top > 0 ? chroma.map((c) => c / top) : chroma;
}

/** What a sound was heard as: the best chord, how sure, and how much each chord fits. */
export type Heard = {
  name: string;
  /** 0 (unsure) to 1 (clearly this chord). */
  confidence: number;
  /** Every major and minor chord's fit, 0 to 1, for the wheel. */
  scores: { name: string; score: number }[];
};

const PITCHES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/**
 * The major or minor chord a chroma fits best (its notes' weights against the pitch
 * classes heard, as cosines), spelled for the key; null in silence.
 */
export function chordOfChroma(chroma: number[], key: Key | null): Heard | null {
  const norm = Math.hypot(...chroma);
  if (norm === 0) return null;
  const scores: { name: string; score: number }[] = [];
  for (let root = 0; root < 12; root++)
    for (const [third, suffix] of [
      [4, ""],
      [3, "m"],
    ] as const) {
      const weights = new Map([
        [root, 1],
        [(root + third) % 12, 0.9],
        [(root + 7) % 12, 0.8],
      ]);
      let dot = 0;
      for (const [pc, w] of weights) dot += (chroma[pc] ?? 0) * w;
      const score = dot / (norm * Math.hypot(...weights.values()));
      scores.push({
        name: named(PITCHES[root] ?? "C", key) + suffix,
        score,
      });
    }
  const [best, second] = [...scores].sort((a, b) => b.score - a.score);
  if (!best) return null;
  const confidence = Math.max(
    0,
    Math.min(1, ((best.score - (second?.score ?? 0)) / best.score) * 4),
  );
  return { name: best.name, confidence, scores };
}

/** The major keys around the circle of fifths, by pitch class, from C. */
const FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

const majorPlace = (pitchClass: number) => FIFTHS.indexOf(pitchClass);
const chroma = (note: string) => Note.chroma(note) ?? 0;

/** The step of the key's major (or a minor key's relative major) on the circle, C at 0. */
export const keyStep = (key: Key | null) =>
  key ? majorPlace((chroma(key.tonic) + (key.minor ? 3 : 0)) % 12) : 0;

/**
 * Where a chord sits on the wheel: its step clockwise from the key at the top, outside
 * for major chords and inside for minor ones (a minor chord beside its relative major).
 */
export function wheelPlace(
  chord: string,
  key: Key | null,
): { step: number; minor: boolean } | null {
  const parsed = Chord.get(chord.replace(/\/.*$/, ""));
  if (!parsed.tonic) return null;
  const minor = /^(m(?!aj)|dim|m7b5)/.test(chord.slice(parsed.tonic.length));
  const major = (chroma(parsed.tonic) + (minor ? 3 : 0)) % 12;
  return { step: (majorPlace(major) - keyStep(key) + 12) % 12, minor };
}

/**
 * The wheel's labels clockwise from `start` (the key's step by default): each step's
 * major chord and its relative minor, spelled for the key (C's without one).
 */
export function wheelLabels(key: Key | null, start = keyStep(key)) {
  key ??= { tonic: "C", minor: false };
  return Array.from({ length: 12 }, (_, step) => {
    const pc = FIFTHS[(start + step) % 12] ?? 0;
    return {
      major: named(PITCHES[pc] ?? "C", key),
      minor: `${named(PITCHES[(pc + 9) % 12] ?? "A", key)}m`,
    };
  });
}

/** Radii of the wheel's rings, as a part of its radius. */
export const RINGS = { major: 0.82, minor: 0.52 };

/** A place on the wheel as x and y from its center, -1 to 1, y down. */
export const wheelPoint = (step: number, minor: boolean) => {
  const angle = (step * Math.PI) / 6;
  const r = minor ? RINGS.minor : RINGS.major;
  return { x: r * Math.sin(angle), y: -r * Math.cos(angle) };
};

/**
 * Where the dot sits: pulled toward each chord by how well it fits, so it's on a chord
 * that clearly fits, and near the middle when several fit about as well.
 */
export function wheelDot(
  scores: { name: string; score: number }[],
  key: Key | null,
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let total = 0;
  for (const { name, score } of scores) {
    const place = wheelPlace(name, key);
    if (!place) continue;
    // Sharpened, so a close second pulls less than the best.
    const weight = score ** 8;
    const point = wheelPoint(place.step, place.minor);
    x += point.x * weight;
    y += point.y * weight;
    total += weight;
  }
  return total > 0 ? { x: x / total, y: y / total } : { x: 0, y: 0 };
}

/** The status and data bytes of a MIDI message's data, by its status byte. */
const dataLength = (status: number) =>
  status >= 0xc0 && status < 0xe0 ? 1 : status >= 0x80 && status < 0xf0 ? 2 : 0;

/**
 * The MIDI messages in a Bluetooth LE MIDI packet: a header, then each message after a
 * timestamp byte, a message without its status byte repeating the last one (running
 * status). System messages are left out.
 */
export function bleMidiMessages(packet: Uint8Array): number[][] {
  const messages: number[][] = [];
  let status = 0;
  let i = 1;
  while (i < packet.length) {
    const byte = packet[i] ?? 0;
    if (byte & 0x80) {
      // A timestamp, then maybe a status byte.
      i++;
      const next = packet[i];
      if (next === undefined) break;
      if (next & 0x80) {
        status = next;
        i++;
      }
    }
    const length = dataLength(status);
    if (length === 0) {
      // A system message or no status yet: skip to the next timestamp.
      while (i < packet.length && !((packet[i] ?? 0) & 0x80)) i++;
      continue;
    }
    const data = Array.from(packet.slice(i, i + length));
    if (data.length < length || data.some((d) => d & 0x80)) break;
    messages.push([status, ...data]);
    i += length;
  }
  return messages;
}
