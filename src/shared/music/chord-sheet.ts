import { diffChars } from "diff";
import { Interval, Key as Keys, Note } from "tonal";
import { inLetters, isChordRow, type Key } from "./chords.js";
import { blockRows, chordOf, type Chord } from "../song-text.js";

/*
 * Chords over letters, and chords moved between keys: placing a chord over the same
 * letters of another line (the Chords mode's taps and drags), spelling notes for a key,
 * transposing, and the import's Do-Re-Mi chords in letters.
 */

/** Folds case and diacritics one character at a time, so indexes stay the same. */
const folded = (s: string) =>
  s
    .split("")
    .map((c) => (c.normalize("NFD")[0] ?? c).toLowerCase()[0] ?? c)
    .join("");

/** Maps an index in `from` to the same character in `to`, through their common letters. */
function alignment(from: string, to: string): (at: number) => number {
  const map: number[] = [];
  let j = 0;
  for (const part of diffChars(folded(from), folded(to))) {
    if (part.added) j += part.value.length;
    else
      for (let k = 0; k < part.value.length; k++)
        map.push(part.removed ? j : j++);
  }
  return (at) => (at < map.length ? (map[at] ?? j) : j + at - map.length);
}

/** The pasted chords of a line, moved over the same letters of the song's line. */
export function placeOver(
  pasted: string,
  chords: Chord[],
  songRow: string,
): Chord[] {
  const to = alignment(pasted, songRow.trim());
  return chords.map((c) => ({ ...c, at: to(c.at) }));
}

const ROOT = /^([A-Ga-g])([#b]?)(.*)$/;

/**
 * A note spelled as in the key's scale; a note outside it as the flat of the next degree
 * (Bb in D, Eb in C), except the raised fourth (F# in C, D# in A).
 */
export function spell(note: string, key: Key): string {
  const chroma = Note.chroma(note);
  if (chroma === undefined) return note;
  const major = key.minor ? Keys.minorKey(key.tonic).relativeMajor : key.tonic;
  const scale = Keys.majorKey(major).scale;
  const degree = (c: number) => scale.find((n) => Note.chroma(n) === c % 12);
  const own = degree(chroma);
  if (own) return own;
  const raisedFourth = (chroma - (Note.chroma(major) ?? 0) + 12) % 12 === 6;
  const spelled = raisedFourth
    ? Note.transpose(scale[3] ?? "", "1A")
    : Note.transpose(degree(chroma + 1) ?? "", "-1A");
  return Note.simplify(spelled);
}

/** A chord moved by some half steps, its notes spelled for the key it lands in. */
export function transposeChord(
  chord: string,
  semitones: number,
  key: Key,
): string {
  if (semitones % 12 === 0) return chord;
  const interval = Interval.fromSemitones(semitones);
  const move = (name: string) => {
    const m = ROOT.exec(name);
    if (!m?.[1]) return name;
    const lower = m[1] === m[1].toLowerCase();
    const note = spell(
      Note.transpose(m[1].toUpperCase() + (m[2] ?? ""), interval),
      key,
    );
    return (lower ? note.toLowerCase() : note) + (m[3] ?? "");
  };
  return chord.split("/").map(move).join("/");
}

/** The key's six chords: I, ii, iii, IV, V, vi, from the tonic chord of a minor key. */
export function keyChords(key: Key): string[] {
  const major = key.minor ? Keys.minorKey(key.tonic).relativeMajor : key.tonic;
  const six = Keys.majorKey(major).triads.slice(0, 6);
  return key.minor ? [...six.slice(5), ...six.slice(0, 5)] : six;
}

/** A chord line's words moved by `semitones`, keeping their columns where there's room. */
function transposeRow(row: string, semitones: number, key: Key): string {
  const lead = /^\s*/.exec(row)?.[0] ?? "";
  const line = row.slice(lead.length);
  let out = "";
  for (const m of line.matchAll(/\S+|\s+/g)) {
    const token = m[0];
    if (/^\s/.test(token)) {
      // Spaces realign what follows, one at least.
      out += " ".repeat(Math.max(1, m.index + token.length - out.length));
      continue;
    }
    out += token.replace(/[^|.]+/g, (word) =>
      chordOf(word) ? transposeChord(inLetters(word), semitones, key) : word,
    );
  }
  return lead + out;
}

/** A song text with its chord lines in letters: Do-Re-Mi chords ("Re", "Sol7") become D, G7. */
export function textInLetters(text: string): string {
  const rows = text.replace(/\r\n?/g, "\n").split("\n");
  const inBlock = blockRows(rows);
  const any: Key = { tonic: "C", minor: false };
  return rows
    .map((row, i) =>
      !inBlock[i] && isChordRow(row) ? transposeRow(row, 0, any) : row,
    )
    .join("\n");
}

/** A song text with every chord line moved by `semitones` and spelled for `key`. */
export function transposeText(
  text: string,
  semitones: number,
  key: Key,
): string {
  if (semitones % 12 === 0) return text;
  const rows = text.replace(/\r\n?/g, "\n").split("\n");
  const inBlock = blockRows(rows);
  return rows
    .map((row, i) =>
      !inBlock[i] && isChordRow(row) ? transposeRow(row, semitones, key) : row,
    )
    .join("\n");
}
