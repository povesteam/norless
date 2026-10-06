import {
  blockRows,
  chordOf,
  parseSong,
  sectionName,
  type Chord,
} from "../song-text.js";

/**
 * Chords in the song text: what the team may change, and reading
 * and writing the chords of one row. Positions (`at`) are indexes in the row without
 * its leading spaces, as the parser places them, before `_` and repeat marks go.
 */

const normalize = (text: string) => text.replace(/\r\n?/g, "\n");
const isChordRow = (row: string | undefined) =>
  /^\.[^.]/.test(row?.trim() ?? "");
export const isNoteRow = (row: string) => row.trim().startsWith("!");
export const leadOf = (row: string) => Math.max(row.search(/\S/), 0);

/**
 * The text without its chord lines, `!` notes and notation blocks, the rest trimmed and
 * blank rows collapsed: what stays the same when only chords, bar lines and notes change.
 */
export function lyricsOf(text: string): string {
  const rows = normalize(text).split("\n");
  const inBlock = blockRows(rows);
  return rows
    .filter((row, i) => !inBlock[i] && !isChordRow(row) && !isNoteRow(row))
    .map((row) => row.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type Token = { at: number; name: string };

/** The chords and bar lines of a chord row, at their place over a row with `lead` spaces. */
export function tokensOf(
  chordRow: string,
  lead: number,
): { chords: Token[]; bars: number[] } {
  const line = chordRow.trim(); // its dot is column 0
  const chords = [...line.slice(1).matchAll(/[^\s|]+/g)].map((m) => ({
    name: m[0],
    at: m.index + 1 - lead,
  }));
  const bars = [...line.matchAll(/\|/g)].map((m) => m.index - lead);
  return { chords, bars };
}

/** A chord row with the chords and bar lines at their place over a row with `lead` spaces. */
export function chordRow(
  chords: Token[],
  bars: number[],
  lead: number,
): string {
  const tokens = [
    ...chords.map((c) => ({ col: c.at + lead, text: c.name })),
    ...bars.map((at) => ({ col: at + lead, text: "|" })),
  ].sort((a, b) => a.col - b.col);
  let row = ".";
  for (const { col, text } of tokens) {
    // A token stays after the dot and a space after the one before it.
    const from = Math.max(col, row.length === 1 ? 1 : row.length + 1);
    row = row.padEnd(from, " ") + text;
  }
  return row;
}

/** A row of chords only, for a part without words (an intro, an instrumental part). */
export const chordsOnlyRow = (chords: Chord[]) => chordRow(chords, [], 1);

/** Whether a source row is a lyric row, which a chord row above gives its chords. */
export const isLyricRow = (row: string | undefined) => {
  const line = row?.trim() ?? "";
  return (
    line !== "" &&
    line !== "." &&
    !isChordRow(line) &&
    !isNoteRow(line) &&
    sectionName(line) === null
  );
};

/** Whether a source row is a chord row: over a lyric row, or of chords only. */
export { isChordRow };

/** The chords over a row: a lyric row's, or those of a chord row of chords only. */
export function chordsAt(text: string, row: number): Chord[] {
  const rows = normalize(text).split("\n");
  const own = rows[row] ?? "";
  if (isChordRow(own)) return tokensOf(own, 1).chords;
  const above = rows[row - 1];
  return isChordRow(above) ? tokensOf(above ?? "", leadOf(own)).chords : [];
}

/**
 * The text with these chords over a row, keeping its bar lines. A lyric row gets a
 * leading space when it had none, so a chord can stand over its first letter. Without
 * chords, the row's chord line goes, and a row of chords only goes with it.
 */
export function setChords(text: string, row: number, chords: Chord[]): string {
  const rows = normalize(text).split("\n");
  const own = rows[row];
  if (own === undefined) return text;
  const sorted = [...chords].sort((a, b) => a.at - b.at);
  if (isChordRow(own)) {
    if (sorted.length === 0) rows.splice(row, 1);
    else rows[row] = chordRow(sorted, tokensOf(own, 1).bars, 1);
    return rows.join("\n");
  }
  const above = rows[row - 1];
  const hasLine = isChordRow(above);
  if (sorted.length === 0) {
    if (hasLine) rows.splice(row - 1, 1);
    return rows.join("\n");
  }
  const lead = leadOf(own);
  const bars = hasLine ? tokensOf(above ?? "", lead).bars : [];
  const newLead = Math.max(lead, 1);
  rows[row] = " ".repeat(newLead) + own.trimStart();
  const line = chordRow(sorted, bars, newLead);
  if (hasLine) rows[row - 1] = line;
  else rows.splice(row, 0, line);
  return rows.join("\n");
}

/**
 * The text with a bar's chords lasting `beats` each, as holds after their
 * names (C__ is three beats): `row` is the line's row, a lyric row or a row of chords
 * only, and `bar` its bar among those with chords.
 */
export function setBeats(
  text: string,
  row: number,
  bar: number,
  beats: number[],
): string {
  const rows = normalize(text).split("\n");
  const own = rows[row] ?? "";
  const at = isChordRow(own) ? row : row - 1;
  const line = rows[at];
  if (!isChordRow(line)) return text;
  const lead = at === row ? 1 : leadOf(own);
  const { chords, bars } = tokensOf(line ?? "", lead);
  const segment = (c: Token) => bars.filter((b) => b < c.at).length;
  const filled = [...new Set(chords.map(segment))].sort((a, b) => a - b);
  const target = filled[bar];
  if (target === undefined) return text;
  let i = 0;
  const next = chords.map((c) =>
    segment(c) === target
      ? {
          ...c,
          name:
            c.name.replace(/_+$/, "") +
            "_".repeat(Math.max(0, (beats[i++] ?? 1) - 1)),
        }
      : c,
  );
  rows[at] = chordRow(next, bars, lead);
  return rows.join("\n");
}

/** The chords a text uses, in the order they first appear, without words that aren't chords. */
export function chordsUsed(text: string): string[] {
  const names = parseSong(text).sections.flatMap((s) =>
    s.lines.flatMap((l) => l.chords.flatMap((c) => chordOf(c.name) ?? [])),
  );
  return [...new Set(names)];
}

const SOLFEGE: Record<string, string> = {
  do: "C",
  re: "D",
  mi: "E",
  fa: "F",
  sol: "G",
  la: "A",
  si: "B",
};
const NOTE = /^(do|re|mi|fa|sol|la|si|[a-g])\s*([#b]?)/i;

/** A note name as a letter: "Re" is D, "sib" is Bb, "f#" is F#. */
function letterOf(note: string): string | null {
  const m = NOTE.exec(note);
  if (!m?.[1]) return null;
  const name = m[1].toLowerCase();
  return (SOLFEGE[name] ?? name.toUpperCase()) + (m[2] ?? "");
}

/**
 * A chord with letters (C D E … B), as songs store them: "Re m" is Dm, "la7" is A7,
 * "Sol/si" is G/B. Lowercase letters, an old way of writing minor chords, stay as they are.
 */
export function inLetters(chord: string): string {
  const [main = "", bass] = chord.split("/");
  const solfege = /^(do|re|mi|fa|sol|la|si)/i.test(main);
  if (!solfege) return chord;
  const m = NOTE.exec(main);
  const root = letterOf(main) ?? main;
  const rest = main.slice(m?.[0].length ?? 0).replace(/^\s+/, "");
  const bassLetter = bass === undefined ? null : (letterOf(bass) ?? bass);
  return root + rest + (bassLetter ? `/${bassLetter}` : "");
}

export type Key = { tonic: string; minor: boolean };

/**
 * A song's key as written in its key field, in letters or Do-Re-Mi: "Re", "Si b", "La m",
 * "Sol Major", "F#m". Null for anything else ("Sol + La", "0:30").
 */
export function keyOf(key: string): Key | null {
  const m =
    /^\s*(do|re|mi|fa|sol|la|si|[a-g])\s*([#b])?\s*(m|min|minor|M|maj|major)?\s*\.?\s*$/i.exec(
      key,
    );
  if (!m?.[1]) return null;
  const tonic = letterOf(m[1] + (m[2] ?? ""));
  if (!tonic) return null;
  const mode = m[3] ?? "";
  const minor = mode !== "M" && /^m(in(or)?)?$/i.test(mode);
  return { tonic, minor };
}

/** A key field in letters ("Si b" is "Bb", "La m" is "Am"); anything else as written. */
export function keyInLetters(key: string): string {
  const parsed = keyOf(key);
  return parsed ? `${parsed.tonic}${parsed.minor ? "m" : ""}` : key;
}

/** The tempo of taps (times in ms): their average beat over the last 8, in 30–300 BPM. */
export function tempoOf(taps: number[]): number | null {
  const last = taps.slice(-8);
  const first = last[0];
  const latest = last.at(-1);
  if (first === undefined || latest === undefined || last.length < 2)
    return null;
  const beat = (latest - first) / (last.length - 1);
  return Math.min(300, Math.max(30, Math.round(60_000 / beat)));
}
