import {
  chordRow,
  isChordRow,
  isNoteRow,
  leadOf,
  type Token,
  tokensOf,
} from "./chords.js";
import { blockRows, parseSong, type SectionType } from "../song-text.js";

/**
 * A song's chords apart from its lyrics: one track for every
 * language, so lyrics carry no chords and chords added once show over every language.
 * Sections of a type share a pattern (the verses' chords); a section may have its own.
 * A chord's place is its position along the line, so it follows the words when they
 * change and spreads over another verse or language proportionally: a guide to what to
 * play and when, not notation. The views still read the old text format, which
 * `mergeText` builds from the lyrics and the track.
 */

/** The chords over a section's lines, written over `lines` lyric lines. */
export type Chords = {
  lines: number;
  rows: ChordRow[];
};
/**
 * Chords and bar lines over lyric line `line`, placed in a line `over` characters long;
 * or a row of chords only, as written, before lyric line `before`.
 */
export type ChordRow =
  | {
      line: number;
      chords: Token[];
      bars: number[];
      over: number;
    }
  | { before: number; raw: string };
/** A note or a notation block, as written, before lyric line `before`. */
export type Extra = { before: number; raw: string };

export type SectionMusic = {
  /** The pattern it follows; false for its own chords; unset for its type's when it fits. */
  follows?: string | false;
  own?: Chords;
  /** Notes and notation blocks, which belong to this section only. */
  extras?: Extra[];
};

export type Music = {
  /** Per section type, the chords its sections share. */
  patterns: Record<string, Chords>;
  /** Per section ("verse.2", the second verse), what it has of its own. */
  sections: Record<string, SectionMusic>;
  /** Parts without words (an intro, an instrumental part), as written, after a section. */
  parts: { after: string | null; text: string }[];
};

export const noMusic = (): Music => ({ patterns: {}, sections: {}, parts: [] });

const normalize = (text: string) => text.replace(/\r\n?/g, "\n");

/** A section with words, as the track knows it: by its type and its place among them. */
export type LyricSection = {
  key: string;
  type: SectionType;
  name: string | null;
  start: number;
  end: number;
  /** The source rows of its lines, in order. */
  lineRows: number[];
};

/** The sections with words of a text, repeats left out (they show the repeated one). */
export function lyricSections(text: string): LyricSection[] {
  const counts = new Map<string, number>();
  return parseSong(text).sections.flatMap((s) => {
    const lines = s.lines.filter((l) => !l.chordsOnly && l.row !== undefined);
    if (s.repeatOf !== null || lines.length === 0) return [];
    const n = (counts.get(s.type) ?? 0) + 1;
    counts.set(s.type, n);
    return [
      {
        key: `${s.type}.${n}`,
        type: s.type,
        name: s.name,
        start: s.start,
        end: s.end,
        lineRows: lines.map((l) => l.row ?? 0),
      },
    ];
  });
}

/**
 * The pattern a section follows: the one it was set to, else its type's, fitted to its
 * lines, unnamed parts too since they're mostly verses; none when it
 * has its own chords.
 */
export function followed(music: Music, s: LyricSection): string | null {
  const entry = music.sections[s.key];
  if (entry?.follows === false) return null;
  if (typeof entry?.follows === "string") return entry.follows;
  return s.type;
}

/** How many sections of these follow a pattern. */
export const followers = (
  music: Music,
  sections: LyricSection[],
  pattern: string,
) => sections.filter((s) => followed(music, s) === pattern).length;

const scaled = (at: number, over: number, length: number) =>
  over > 0 ? Math.round((at * length) / over) : at;

/**
 * Chords written over some lines, placed over lines of these lengths: line by line when
 * the counts match, by position, else spread over the whole section as if it were one
 * line.
 */
export function fit(chords: Chords, lengths: number[]): ChordRow[] {
  const m = lengths.length;
  if (chords.lines === m)
    return chords.rows.map((r) => {
      if ("raw" in r) return r;
      const length = lengths[r.line] ?? r.over;
      return {
        ...r,
        chords: r.chords.map((c) => ({
          ...c,
          at: scaled(c.at, r.over, length),
        })),
        bars: r.bars.map((at) => scaled(at, r.over, length)),
        over: length,
      };
    });
  const lines = new Map<number, { chords: Token[]; bars: number[] }>();
  const raws: ChordRow[] = [];
  // Where a place along the source's lines lands among the target's.
  const place = (line: number, at: number, over: number) => {
    const g = (line + (over > 0 ? Math.min(at / over, 1) : 0)) / chords.lines;
    const j = Math.min(Math.floor(g * m), m - 1);
    const length = lengths[j] ?? 0;
    return { j, at: Math.round((g * m - j) * length) };
  };
  const into = (j: number) => {
    const line = lines.get(j) ?? { chords: [], bars: [] };
    lines.set(j, line);
    return line;
  };
  for (const r of chords.rows) {
    if ("raw" in r) {
      raws.push({
        before: Math.round((r.before * m) / chords.lines),
        raw: r.raw,
      });
      continue;
    }
    for (const c of r.chords) {
      const { j, at } = place(r.line, c.at, r.over);
      into(j).chords.push({ ...c, at });
    }
    for (const bar of r.bars) {
      const { j, at } = place(r.line, bar, r.over);
      into(j).bars.push(at);
    }
  }
  return [
    ...raws,
    ...[...lines].map(([line, { chords: tokens, bars }]) => ({
      line,
      chords: tokens,
      bars,
      over: lengths[line] ?? 0,
    })),
  ];
}

/** The chords a section shows: its pattern's or its own, fitted to its lines. */
export function chordsFor(
  music: Music,
  s: LyricSection,
  lengths: number[],
): ChordRow[] {
  const pattern = followed(music, s);
  const chords =
    pattern === null ? music.sections[s.key]?.own : music.patterns[pattern];
  return chords ? fit(chords, lengths) : [];
}

const lengthsOf = (rows: string[], s: LyricSection) =>
  s.lineRows.map((r) => rows[r]?.trim().length ?? 0);

/**
 * The song text in the old format, chords over the words, for the views: the lyrics
 * with each section's chord rows, notes and notation blocks, and the parts without
 * words in their places.
 */
export function mergeText(lyrics: string, music: Music): string {
  const rows = normalize(lyrics).split("\n");
  const sections = lyricSections(lyrics);
  const before = new Map<number, string[]>();
  const after = new Map<number, string[]>();
  const replaced = new Map<number, string>();
  const add = (map: Map<number, string[]>, row: number, items: string[]) =>
    map.set(row, [...(map.get(row) ?? []), ...items]);
  const at = (s: LyricSection, k: number) =>
    k < s.lineRows.length
      ? { map: before, row: s.lineRows[k] ?? s.start }
      : { map: after, row: s.lineRows.at(-1) ?? s.end };

  for (const s of sections) {
    const extras = music.sections[s.key]?.extras ?? [];
    for (const e of extras) {
      const { map, row } = at(s, e.before);
      add(map, row, e.raw.split("\n"));
    }
    for (const r of chordsFor(music, s, lengthsOf(rows, s))) {
      if ("raw" in r) {
        const { map, row } = at(s, r.before);
        add(map, row, [r.raw]);
        continue;
      }
      const row = s.lineRows[r.line];
      if (row === undefined) continue;
      const words = rows[row]?.trim() ?? "";
      // A space before the words only when a chord stands before their first letter.
      const lead = [...r.chords.map((c) => c.at), ...r.bars].some(
        (at) => at < 1,
      )
        ? 1
        : 0;
      const line = chordRow(r.chords, r.bars, lead);
      if (line === ".") continue;
      // Over an empty line (".") chords stand alone.
      if (words !== ".") replaced.set(row, " ".repeat(lead) + words);
      add(before, row, [line]);
    }
  }
  const keys = new Map(sections.map((s) => [s.key, s.end]));
  const first: string[] = [];
  const last: string[] = [];
  for (const part of music.parts) {
    const end = part.after === null ? undefined : keys.get(part.after);
    if (part.after === null) first.push(...part.text.split("\n"), "");
    else if (end === undefined) last.push("", ...part.text.split("\n"));
    else add(after, end, ["", ...part.text.split("\n")]);
  }

  const out = [...first];
  rows.forEach((row, i) => {
    out.push(...(before.get(i) ?? []));
    out.push(replaced.get(i) ?? row);
    out.push(...(after.get(i) ?? []));
  });
  // Parts after a section that's gone go before the text's last blank rows.
  let end = out.length;
  while (end > 0 && out[end - 1]?.trim() === "") end--;
  out.splice(end, 0, ...last);
  return out.join("\n");
}

/** What a text in the old format holds of a section's music. */
export type Found = { chords: Chords; extras: Extra[] };

/**
 * A text in the old format taken apart: the lyrics, each section's chords, notes and
 * blocks, and the parts without words. The lyrics' rows are trimmed, as `lyricsOf` does.
 */
export function splitText(text: string): {
  lyrics: string;
  found: Map<string, Found>;
  parts: Music["parts"];
} {
  const rows = normalize(text).split("\n");
  const inBlock = blockRows(rows);
  const sections = lyricSections(text);
  const owner = new Map<number, LyricSection>();
  for (const s of sections)
    for (let i = s.start; i <= s.end; i++) owner.set(i, s);
  const found = new Map<string, Found>();
  const parts: Music["parts"] = [];
  const music = new Set<number>(); // rows that leave the lyrics

  let lastKey: string | null = null;
  let group: number[] = [];
  const endGroup = () => {
    // Rows outside sections with words: a part without words, when it holds music.
    const hasMusic = group.some(
      (i) => inBlock[i] || isChordRow(rows[i]) || isNoteRow(rows[i] ?? ""),
    );
    const hasWords = group.some(
      (i) =>
        !inBlock[i] &&
        !isChordRow(rows[i]) &&
        !isNoteRow(rows[i] ?? "") &&
        !/^([A-Za-z]\d*|\d+|\+):$|^\[[\p{L}\p{N}-]+\]$/u.test(
          rows[i]?.trim() ?? "",
        ),
    );
    if (hasMusic && !hasWords) {
      parts.push({
        after: lastKey,
        text: group.map((i) => rows[i] ?? "").join("\n"),
      });
      for (const i of group) music.add(i);
    }
    group = [];
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? "";
    const s = owner.get(i);
    if (!s) {
      if (row.trim() === "" && !inBlock[i]) endGroup();
      else group.push(i);
      continue;
    }
    endGroup();
    lastKey = s.key;
    const entry = found.get(s.key) ?? {
      chords: { lines: s.lineRows.length, rows: [] },
      extras: [],
    };
    found.set(s.key, entry);
    const k = s.lineRows.filter((r) => r < i).length;
    if (inBlock[i]) {
      let j = i;
      while (
        j + 1 <= s.end &&
        inBlock[j + 1] &&
        !/^```\s*abc/i.test(rows[j + 1]?.trim() ?? "")
      )
        j++;
      entry.extras.push({
        before: k,
        raw: rows.slice(i, j + 1).join("\n"),
      });
      for (let x = i; x <= j; x++) music.add(x);
      i = j;
      continue;
    }
    if (isChordRow(row)) {
      music.add(i);
      const next = rows[i + 1] ?? "";
      if (s.lineRows.includes(i + 1) && next.trim() !== ".") {
        const { chords, bars } = tokensOf(row, leadOf(next));
        entry.chords.rows.push({
          line: k,
          chords,
          bars,
          over: next.trim().length,
        });
      } else entry.chords.rows.push({ before: k, raw: row.trim() });
      continue;
    }
    if (isNoteRow(row)) {
      music.add(i);
      entry.extras.push({ before: k, raw: row.trim() });
    }
  }
  endGroup();

  const lyrics = rows
    .filter((_, i) => !music.has(i))
    .map((row) => row.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { lyrics, found, parts };
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Its own chords for a section, which then follows no pattern. */
function own(music: Music, key: string, chords: Chords) {
  music.sections[key] = { ...music.sections[key], follows: false, own: chords };
}

function setExtras(music: Music, key: string, extras: Extra[]) {
  const entry = { ...music.sections[key] };
  if (extras.length) entry.extras = extras;
  else delete entry.extras;
  music.sections[key] = entry;
}

/** The track without empty entries. */
function tidy(music: Music): Music {
  music.sections = Object.fromEntries(
    Object.entries(music.sections).filter(
      ([, entry]) => entry.follows !== undefined || !!entry.extras?.length,
    ),
  );
  return music;
}

/**
 * The track after an edit of the text in the old format, made over these lyrics (the
 * Chords mode, pasting a sheet, notation, a key change): each section whose chords
 * changed sets its pattern, which all its sections follow ("All verses", the default),
 * or with `only` its own chords. Within one edit, the first section to change a pattern
 * sets it; another one changed differently gets its own.
 */
export function musicFromText(
  music: Music,
  lyrics: string,
  text: string,
  only: (key: string) => boolean = () => false,
  /** Leave sections, and parts, the text has nothing for (a lyrics save with a few chord rows). */
  fill = false,
): Music {
  const was = splitText(mergeText(lyrics, music)).found;
  const now = splitText(text);
  const next: Music = structuredClone(music);
  const rows = normalize(lyrics).split("\n");
  const set = new Set<string>();
  const empty = (s: LyricSection): Found => ({
    chords: { lines: s.lineRows.length, rows: [] },
    extras: [],
  });
  for (const s of lyricSections(lyrics)) {
    const a = now.found.get(s.key) ?? empty(s);
    const b = was.get(s.key) ?? empty(s);
    if (fill && !a.chords.rows.length && !a.extras.length) continue;
    if (!same(a.extras, b.extras)) setExtras(next, s.key, a.extras);
    if (same(a.chords.rows, b.chords.rows)) continue;
    const pattern = followed(next, s);
    if (pattern !== null && !only(s.key)) {
      if (!set.has(pattern)) {
        next.patterns[pattern] = a.chords;
        set.add(pattern);
        continue;
      }
      const pat = next.patterns[pattern];
      if (pat && same(fit(pat, lengthsOf(rows, s)), a.chords.rows)) continue;
    }
    own(next, s.key, a.chords);
  }
  if (!fill || now.parts.length) next.parts = now.parts;
  return tidy(next);
}

/**
 * The track of texts in the old format, in the community's language order (the import,
 * and songs saved before the track): each type's first section with chords sets its
 * pattern; another section keeps its own chords unless they're the pattern's, and one
 * without chords follows its type's. A section's chords come from the first language
 * that has them.
 */
export function musicOfTexts(texts: string[]): Music {
  const music = noMusic();
  const done = new Set<string>();
  for (const text of texts) {
    const { lyrics, found, parts } = splitText(text);
    if (!music.parts.length) music.parts = parts;
    const rows = normalize(lyrics).split("\n");
    for (const s of lyricSections(lyrics)) {
      const f = found.get(s.key);
      if (!f || done.has(s.key)) continue;
      if (!f.chords.rows.length && !f.extras.length) continue;
      done.add(s.key);
      if (f.extras.length) setExtras(music, s.key, f.extras);
      if (!f.chords.rows.length) continue;
      const pattern = followed(music, s);
      const pat = pattern === null ? undefined : music.patterns[pattern];
      if (pattern !== null && !pat) music.patterns[pattern] = f.chords;
      else if (!pat || !same(fit(pat, lengthsOf(rows, s)), f.chords.rows))
        own(music, s.key, f.chords);
    }
  }
  return tidy(music);
}

/** Whether a text in the old format holds anything for the track. */
export const hasMusic = (text: string) => {
  const rows = normalize(text).split("\n");
  const inBlock = blockRows(rows);
  return rows.some((r, i) => inBlock[i] || isChordRow(r) || isNoteRow(r));
};

/** The track with every chord name, and every row of chords only, changed by `rename`. */
export function mapChords(
  music: Music,
  rename: (name: string) => string,
  renameRow: (row: string) => string,
): Music {
  const chords = (c: Chords): Chords => ({
    lines: c.lines,
    rows: c.rows.map((r) =>
      "raw" in r
        ? { ...r, raw: renameRow(r.raw) }
        : {
            ...r,
            chords: r.chords.map((t) => ({ ...t, name: rename(t.name) })),
          },
    ),
  });
  return {
    patterns: Object.fromEntries(
      Object.entries(music.patterns).map(([k, c]) => [k, chords(c)]),
    ),
    sections: Object.fromEntries(
      Object.entries(music.sections).map(([k, s]) => [
        k,
        s.own ? { ...s, own: chords(s.own) } : s,
      ]),
    ),
    parts: music.parts.map((p) => ({
      ...p,
      text: p.text
        .split("\n")
        .map((row) => (isChordRow(row) ? renameRow(row) : row))
        .join("\n"),
    })),
  };
}

/**
 * The index among a lyrics text's sections of the section at `index` in the text built
 * from them, or null for a part without words, which has no lyrics.
 */
export function lyricsIndexOf(
  merged: string,
  lyrics: string,
  index: number,
): number | null {
  const section = parseSong(merged).sections[index];
  const key = lyricSections(merged).find(
    (s) => s.start === section?.start,
  )?.key;
  const target = lyricSections(lyrics).find((s) => s.key === key);
  if (!target) return null;
  const at = parseSong(lyrics).sections.findIndex(
    (s) => s.start === target.start,
  );
  return at < 0 ? null : at;
}
