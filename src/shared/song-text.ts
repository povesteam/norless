import type { ChordColors } from "./music/music.js";

/**
 * The Norless song text syntax, compatible with the old app:
 *
 *   R:              names the section it's in (a letter with optional digits, digits, or +)
 *   [bridge]        names it too, in any language (letters, digits, hyphens)
 *   R               a section whose whole text is a defined name repeats that section
 *   .G      C       chords for the next lyric line, placed by column (the dot is column 0);
 *                   without a lyric line after it, a line of chords only
 *   . | A  B | E |  bar lines between chords (each | counts as a space when placing them)
 *   /: … :/         lines sung twice; /:. … .:/ three times, at the start and end of lines
 *   .               an empty line inside a section
 *   ~               an invisible space that keeps its width; _ is removed from the shown text
 *   ! unison        a note for singers and musicians, never projected
 *   ! drums: rim    a note for one group of players
 *   ```abc … ```    a notation block: ABC for an intro, a riff or a groove,
 *                   kept as written and never projected
 *
 * Blank lines separate sections. Trailing * on the last line is replaced by the final mark.
 */

export type SectionType =
  "verse" | "refrain" | "bridge" | "pre-chorus" | "intro" | "ending" | "other";

export type Chord = {
  at: number;
  name: string;
  /** Its colors, set for views that color chords. */
  colors?: ChordColors;
};
export type Line = {
  text: string;
  chords: Chord[];
  /** The chord names per bar, when the chord line had bar lines. */
  bars?: string[][];
  /** Each bar's chords' beats, when the Chords mode set any. */
  beats?: number[][];
  /** A line of chords without lyrics, e.g. an intro; projectors leave it out. */
  chordsOnly?: true;
  /** Its row in the source text, 0-based: the lyric row, or the chord row of chords only. */
  row?: number;
};

/** Lines `from` to `to` of a section or slide (inclusive) are sung `times` times. */
export type Repeat = { from: number; to: number; times: 2 | 3 };

/** A note; `group` is who it's for when it starts with a word and a colon ("drums: rim"). */
export type Note = { text: string; group: string | null };

/** A notation block: its ABC, and the rows of its fences in the source text, 0-based. */
export type Block = { abc: string; start: number; end: number };

export type Section = {
  name: string | null;
  type: SectionType;
  lines: Line[];
  /** Notation blocks, which no projector shows. */
  blocks: Block[];
  /** Lines sung more than once, from closed repeat marks, which aren't in the text. */
  repeats: Repeat[];
  /** A repeat mark that doesn't close in this section; it stays in the text as written. */
  unclosedRepeat: boolean;
  notes: Note[];
  /** Index of the section this one repeats (its text is just that section's name). */
  repeatOf: number | null;
  /** First and last line of the section in the source text, 0-based, inclusive. */
  start: number;
  end: number;
};

export type Slide = Omit<Section, "repeatOf" | "start" | "end"> & {
  /** Section whose text the slide shows: for a repeat, the repeated section. */
  section: number;
  last: boolean;
};

const words: [SectionType, RegExp][] = [
  ["refrain", /^(refren|refrain|chorus|приспів)$/],
  ["bridge", /^(bridge|punte|міст)$/],
  ["pre-chorus", /^(pre-?chorus|pre-?refren)$/],
  ["intro", /^(intro|вступ)$/],
  ["ending", /^(ending|final|outro|кінцівка)$/],
  ["verse", /^(strofa|strofă|verse|куплет)$/],
];

export function sectionType(name: string | null): SectionType {
  if (name === null) return "verse";
  const n = name.toLowerCase();
  if (/^\d+$/.test(n) || /^[vs]\d*$/.test(n)) return "verse";
  if (/^[rc]\d*$/.test(n)) return "refrain";
  if (/^b\d*$/.test(n)) return "bridge";
  if (/^p\d*$/.test(n)) return "pre-chorus";
  if (/^i\d*$/.test(n)) return "intro";
  if (/^e\d*$/.test(n)) return "ending";
  const word = n.replace(/-?\d+$/, "");
  return words.find(([, re]) => re.test(word))?.[0] ?? "other";
}

export const sectionName = (line: string) =>
  /^([A-Za-z]\d*|\d+|\+):$/.exec(line)?.[1] ??
  /^\[([\p{L}\p{N}-]+)\]$/u.exec(line)?.[1] ??
  null;

/** A row that opens a notation block, and one that closes it. */
export const opensBlock = (row: string) => /^```\s*abc\s*$/i.test(row.trim());
const closesBlock = (row: string) => row.trim() === "```";

/** Which rows are in notation blocks, fences too; a block that isn't closed runs to the end. */
export function blockRows(rows: string[]): boolean[] {
  let inside = false;
  return rows.map((row) => {
    if (inside) inside = !closesBlock(row);
    else if (opensBlock(row)) return (inside = true);
    else return false;
    return true;
  });
}

type PendingChords = {
  chords: { name: string; pos: number }[];
  bars?: string[][];
  beats?: number[][];
  row?: number;
};

/**
 * A chord row's word and how many beats it lasts: a chord holds one
 * more beat for each `_` after its name, so C__ is three beats and G one.
 */
const held = (word: string) => {
  const name = word.replace(/_+$/, "");
  return { name, beats: 1 + word.length - name.length };
};

/**
 * Chords and their column after the dot, as the old chord parser counted them. A `|` is
 * a bar line, which counts as a space; the chords between bar lines make one bar.
 */
function parseChords(chordLine: string): PendingChords {
  const chords = [...chordLine.matchAll(/[^\s|]+/g)].map((m) => ({
    name: held(m[0]).name,
    pos: m.index,
  }));
  if (!chordLine.includes("|")) return { chords };
  const words = chordLine
    .split("|")
    .map((bar) => bar.split(/\s+/).filter(Boolean).map(held))
    .filter((bar) => bar.length > 0);
  const bars = words.map((bar) => bar.map((w) => w.name));
  return words.some((bar) => bar.some((w) => w.beats > 1))
    ? { chords, bars, beats: words.map((bar) => bar.map((w) => w.beats)) }
    : { chords, bars };
}

/** A chord line with no lyric line after it, kept as a line of chords. */
function chordsOnlyLine({ chords, bars, beats, row }: PendingChords): Line {
  const lastPos = chords.at(-1)?.pos ?? 0;
  return {
    text: "".padEnd(lastPos, "~"),
    chords: chords.map(({ name, pos }) => ({ name, at: pos })),
    ...(bars ? { bars } : {}),
    ...(beats ? { beats } : {}),
    chordsOnly: true,
    row,
  };
}

/** A `!` note, with the group it's for when it starts with one word and a colon. */
function parseNote(text: string): Note {
  return { text, group: /^(\p{L}+)\s*:/u.exec(text)?.[1] ?? null };
}

const OPEN = /^\/:(\.)?\s*/; // "/:" twice, "/:." three times
/** The closing mark of a repeat at the end of a line, before final-mark stars and padding. */
const closing = (text: string, times: 2 | 3) =>
  (times === 3 ? /\s*\.:\/(?=[*~]*$)/ : /\s*:\/(?=[*~]*$)/).exec(text);

/**
 * Finds the section's repeat marks and takes the closed ones out of the text, moving the
 * chords after them. A ".:/" closes three times only after "/:."; after "/:" its dot is
 * the sentence's. Marks that don't close in the section stay as written, and are flagged.
 */
function repeatMarks(lines: Line[]): {
  repeats: Repeat[];
  unclosedRepeat: boolean;
} {
  const repeats: (Repeat & { open: number })[] = [];
  let unclosedRepeat = false;
  let open: { line: number; times: 2 | 3; length: number } | null = null;
  lines.forEach((line, i) => {
    const opener = OPEN.exec(line.text);
    if (opener) {
      if (open) unclosedRepeat = true; // the earlier one never closed
      open = { line: i, times: opener[1] ? 3 : 2, length: opener[0].length };
    }
    const close = open && closing(line.text, open.times);
    if (open && close && (open.line < i || close.index >= open.length)) {
      repeats.push({
        from: open.line,
        to: i,
        times: open.times,
        open: open.length,
      });
      open = null;
    } else if (!open && /:\/[*~]*$/.test(line.text)) unclosedRepeat = true;
  });
  if (open) unclosedRepeat = true;

  const cut = (line: Line, from: number, length: number) => {
    line.text = line.text.slice(0, from) + line.text.slice(from + length);
    for (const c of line.chords)
      if (c.at > from) c.at = Math.max(from, c.at - length);
  };
  for (const { from, to, times, open: length } of repeats) {
    const last = lines[to];
    const close = last && closing(last.text, times);
    if (last && close) cut(last, close.index, close[0].length);
    const first = lines[from];
    if (first) cut(first, 0, length);
  }
  return {
    repeats: repeats.map(({ from, to, times }) => ({ from, to, times })),
    unclosedRepeat,
  };
}

/** The lines as sung, each repeated line as many times as it's sung, e.g. for time estimates. */
export function sungLines({
  lines,
  repeats,
}: Pick<Section, "lines" | "repeats">): Line[] {
  return lines.flatMap((line, i) => {
    const repeat = repeats.find((r) => r.from <= i && i <= r.to);
    if (line.chordsOnly) return [];
    if (!repeat) return [line];
    // The range is sung as a whole: emit it once per time at its last line.
    if (i !== repeat.to) return [];
    const range = lines
      .slice(repeat.from, repeat.to + 1)
      .filter((l) => !l.chordsOnly);
    return Array.from({ length: repeat.times }, () => range).flat();
  });
}

/** Places pending chords on a lyric line with the old app's rule, then removes `_`. */
function lyricLine(
  raw: string,
  line: string,
  pending: PendingChords | null,
  row: number,
): Line {
  if (!pending?.chords.length)
    return {
      text: line.replace(/_+/g, "").replace(/\s+/g, " "),
      chords: [],
      row,
    };

  const lastPos = pending.chords[pending.chords.length - 1]?.pos ?? 0;
  const padded = line.padEnd(lastPos, "~");
  const lead = raw.search(/\S/);
  // Removing `_` shifts every chord after it one character to the left.
  const underscoresBefore = (at: number) =>
    padded.slice(0, at).split("_").length - 1;
  const chords: Chord[] = [];
  for (const { name, pos } of pending.chords) {
    const at = Math.min(pos + 1 - lead, padded.length);
    if (at >= 0) chords.push({ name, at: at - underscoresBefore(at) });
  }
  return {
    text: padded.replace(/_/g, ""),
    chords,
    ...(pending.bars ? { bars: pending.bars } : {}),
    ...(pending.beats ? { beats: pending.beats } : {}),
    row,
  };
}

export function parseSong(source: string): {
  sections: Section[];
  slides: Slide[];
} {
  const rows = source.replace(/\r\n?/g, "\n").split("\n");
  if (rows[rows.length - 1] !== "") rows.push("");

  const sections: Section[] = [];
  let lines: Line[] = [];
  let notes: Note[] = [];
  let blocks: Block[] = [];
  let block: { start: number; rows: string[] } | null = null;
  let name: string | null = null;
  let pending: PendingChords | null = null;
  let start: number | null = null;
  // A chord line that no lyric line follows stays as a line of chords.
  const keepPending = () => {
    if (pending?.chords.length) lines.push(chordsOnlyLine(pending));
    pending = null;
  };

  const flush = (end: number) => {
    keepPending();
    while (lines[0]?.text === "" && !lines[0].chords.length) lines.shift();
    while (lines.at(-1)?.text === "" && !lines.at(-1)?.chords.length)
      lines.pop();
    if ((lines.length > 0 || blocks.length > 0) && start !== null) {
      sections.push({
        name,
        type: sectionType(name),
        lines,
        blocks,
        ...repeatMarks(lines),
        notes,
        repeatOf: null,
        start,
        end,
      });
      name = null; // a name without lines carries over to the next section, as before
    } else if (notes.length > 0 && sections.length > 0) {
      sections.at(-1)?.notes.push(...notes); // a block of notes only belongs to the section before it
    } else {
      lines = [];
      start = null;
      return; // notes before the first section wait for it
    }
    lines = [];
    notes = [];
    blocks = [];
    start = null;
  };
  const closeBlock = (end: number) => {
    if (block)
      blocks.push({
        abc: block.rows.join("\n").trimEnd(),
        start: block.start,
        end,
      });
    block = null;
  };

  rows.forEach((raw, i) => {
    // Inside a block, rows are kept as written, blank ones too.
    if (block) {
      if (closesBlock(raw)) closeBlock(i);
      else block.rows.push(raw);
      return;
    }
    const line = raw.trim();
    if (line === "") return flush(i - 1);
    start ??= i;
    if (opensBlock(line)) {
      keepPending();
      block = { start: i, rows: [] };
      return;
    }
    const named = sectionName(line);
    const chords = /^\.([^.].*)$/.exec(line);
    const lyric =
      named === null && !chords && line !== "." && !line.startsWith("!");
    if (!lyric) keepPending();
    if (named !== null) name = named;
    else if (chords) pending = { ...parseChords(chords[1] ?? ""), row: i };
    else if (line === ".") lines.push({ text: "", chords: [], row: i });
    else if (line.startsWith("!")) notes.push(parseNote(line.slice(1).trim()));
    else {
      lines.push(lyricLine(raw, line, pending, i));
      pending = null;
    }
  });
  if (block) {
    closeBlock(rows.length - 1);
    flush(rows.length - 1);
  }

  // A section whose whole text is a defined name repeats the last section with that name.
  const byName = new Map<string, number>();
  sections.forEach((s, i) => s.name !== null && byName.set(s.name, i));
  for (const s of sections) {
    const plain = s.lines.every((l) => !l.chords.length)
      ? s.lines.map((l) => l.text).join("\n")
      : null;
    const target = plain === null ? undefined : byName.get(plain);
    if (target !== undefined && sections[target] !== s) s.repeatOf = target;
  }

  // An unnamed part of chords only isn't a verse: before the first words it's the intro,
  // after the last the ending, and between them an instrumental part.
  const sung = sections.flatMap((s, i) =>
    s.lines.some((l) => !l.chordsOnly) ? [i] : [],
  );
  sections.forEach((s, i) => {
    if (s.name !== null || sung.includes(i)) return;
    s.type =
      i < (sung[0] ?? Infinity)
        ? "intro"
        : i > (sung.at(-1) ?? -1)
          ? "ending"
          : "other";
  });

  const slides: Slide[] = sections.map((s, i) => {
    const index = s.repeatOf ?? i;
    const shown = sections[index] ?? s;
    return {
      name: shown.name,
      type: shown.type,
      lines: shown.lines.map((l) => ({
        ...l,
        chords: l.chords.map((c) => ({ ...c })),
      })),
      repeats: shown.repeats.map((r) => ({ ...r })),
      unclosedRepeat: shown.unclosedRepeat,
      notes: shown.notes.map((n) => ({ ...n })),
      blocks: shown.blocks.map((b) => ({ ...b })),
      section: index,
      last: false,
    };
  });
  const last = slides.at(-1);
  const lastLine = last?.lines.at(-1);
  if (last && lastLine) {
    last.last = true;
    lastLine.text = lastLine.text.replace(/\s*\*+\s*$/, "");
  }

  return { sections, slides };
}

/** Labels of unnamed parts that aren't verses: those of chords only. */
const unnamedLabels: Partial<Record<SectionType, string>> = {
  intro: "I",
  ending: "E",
  other: "♪",
};

/**
 * A label per slide for part buttons: a named part's name (R, B, I…), and each unnamed
 * slide its number among the song's verses (1, 2, 3…), or I, E or ♪ for an unnamed
 * intro, ending or instrumental part. A repeat has its part's label.
 */
export function partLabels(slides: Slide[]): string[] {
  let verses = 0;
  const bySection = new Map<number, string>();
  return slides.map((slide) => {
    const known = bySection.get(slide.section);
    if (known !== undefined) return known;
    if (slide.type === "verse") verses++;
    const label =
      slide.name ??
      (slide.type === "verse"
        ? String(verses)
        : (unnamedLabels[slide.type] ?? String(verses)));
    bySection.set(slide.section, label);
    return label;
  });
}

/** A chord, in letters or solfège, either case, e.g. C, f#m7, Bb/D, Re, la7. */
const CHORD =
  /^(?:[a-h]|do|re|mi|fa|sol|la|si)[#b]?(?:m|maj|min|dim|aug|sus|add|\d|\+|°|ø|\(|\)|#|b)*(?:\/(?:[a-h]|do|re|mi|fa|sol|la|si)[#b]?)?$/i;

/**
 * The chord in a chord line's word, or null for words that aren't chords: "Intro:",
 * "sau" ("or"), melody hints like "fa-mi", links. A trailing dot goes ("C." is C).
 */
export function chordOf(word: string): string | null {
  const chord = word.replace(/[.…]+$/, "");
  return CHORD.test(chord) ? chord : null;
}

/**
 * A part's boxes for the bar grid: one per bar where its chord lines have bar lines,
 * else one per chord; words that aren't chords are left out.
 */
export function partBars(slide: Pick<Slide, "lines">): string[][] {
  return partBeats(slide)
    .flat()
    .map((bar) => bar.map((c) => c.name));
}

/**
 * The bar grid's boxes line by line, with each chord's beats: as the
 * Chords mode set them, else one each, so a bar's chords share it equally. Lines without
 * chords are left out.
 */
export function partBeats(
  slide: Pick<Slide, "lines">,
): { name: string; beats: number }[][][] {
  return slide.lines
    .map((line) =>
      (line.bars
        ? line.bars.map((bar, i) =>
            bar.map((name, j) => ({ name, beats: line.beats?.[i]?.[j] ?? 1 })),
          )
        : line.chords.map((c) => [{ name: c.name, beats: 1 }])
      )
        .map((bar) =>
          bar.flatMap((c) => {
            const name = chordOf(c.name);
            return name ? [{ name, beats: c.beats }] : [];
          }),
        )
        .filter((bar) => bar.length > 0),
    )
    .filter((line) => line.length > 0);
}
