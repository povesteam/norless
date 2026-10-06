import type { ChordColors } from "./music/music.js";
import type { Line } from "./song-text.js";

/** Romanian typography for screens: comma-below ș ț, and hyphens that don't break lines. */
export function typography(text: string): string {
  return lettersOnly(text).replace(/-/g, "‑");
}

/** Comma-below ș ț instead of cedilla ş ţ, keeping ordinary hyphens (for print and copy). */
export function lettersOnly(text: string): string {
  return text
    .replace(/ş/g, "ș")
    .replace(/Ş/g, "Ș")
    .replace(/ţ/g, "ț")
    .replace(/Ţ/g, "Ț");
}

/**
 * A song's title in the first of `languages` it has (the viewer's language first, then
 * the community's), or in any language it has.
 */
export function titleFor(
  titles: Record<string, string>,
  languages: string[],
): string {
  const title =
    languages.map((l) => titles[l]).find(Boolean) ??
    Object.values(titles)[0] ??
    "";
  return lettersOnly(title);
}

/** A run of text with one style. Everything is plain text; React and exports escape it. */
export type Segment = {
  text: string;
  italic: boolean;
  bold: boolean;
  underline: boolean;
  color: string | null;
};

const COLOR = String.raw`[a-z]{3,20}|#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)`;
const TAG = new RegExp(
  String.raw`<(/?)([ibu])>|<span\s+style\s*=\s*(["'])\s*color\s*:\s*(${COLOR})\s*;?\s*\3\s*>|</span>`,
  "gi",
);

/**
 * Splits lines into styled segments. Only <i>, <b>, <u> and <span style="color: X">
 * are formatting; any other markup stays literal text. Styles carry across lines,
 * as they did in the old app's HTML.
 */
export function formatLines(lines: string[]): Segment[][] {
  const style = { italic: 0, bold: 0, underline: 0 };
  const colors: string[] = [];
  const current = () => ({
    italic: style.italic > 0,
    bold: style.bold > 0,
    underline: style.underline > 0,
    color: colors.at(-1) ?? null,
  });

  return lines.map((line) => {
    const segments: Segment[] = [];
    const push = (text: string) => {
      if (!text) return;
      const last = segments.at(-1);
      const next = { text, ...current() };
      if (
        last &&
        last.italic === next.italic &&
        last.bold === next.bold &&
        last.underline === next.underline &&
        last.color === next.color
      ) {
        last.text += text;
      } else {
        segments.push(next);
      }
    };
    let pos = 0;
    for (const m of line.matchAll(TAG)) {
      push(line.slice(pos, m.index));
      pos = m.index + m[0].length;
      const [, closing, tag, , color] = m;
      if (tag) {
        const key = ({ i: "italic", b: "bold", u: "underline" } as const)[
          tag.toLowerCase() as "i" | "b" | "u"
        ];
        style[key] = Math.max(0, style[key] + (closing ? -1 : 1));
      } else if (color) {
        colors.push(color.toLowerCase());
      } else if (colors.length > 0) {
        colors.pop();
      } else {
        push(m[0]); // a </span> with nothing to close is just text
      }
    }
    push(line.slice(pos));
    return segments;
  });
}

/** Removes the allowed formatting tags, keeping everything else as it is. */
export function stripFormatting(text: string): string {
  return formatLines([text])
    .flat()
    .map((s) => s.text)
    .join("");
}

/**
 * Plain lyrics of some lines, for search and for print and copy: no formatting tags,
 * `~` padding turned into spaces and trimmed, comma-below letters, ordinary hyphens.
 */
export function plainLyrics(lines: { text: string }[]): string {
  return lines
    .map((l) =>
      lettersOnly(stripFormatting(l.text)).replace(/~+/g, " ").trimEnd(),
    )
    .join("\n");
}

/**
 * Splits a lyric line at its chords, for showing each chord above the text it starts.
 * The first chunk has no chord when the line doesn't start with one.
 */
export function chordChunks(
  line: Line,
): { chord: string | null; colors?: ChordColors; text: string }[] {
  const chunks: {
    chord: string | null;
    colors?: ChordColors;
    text: string;
  }[] = [];
  const first = line.chords[0]?.at ?? line.text.length;
  if (first > 0) chunks.push({ chord: null, text: line.text.slice(0, first) });
  line.chords.forEach(({ at, name, colors }, i) => {
    const end = line.chords[i + 1]?.at ?? line.text.length;
    chunks.push({ chord: name, colors, text: line.text.slice(at, end) });
  });
  return chunks;
}

/** A broadcast overlay's at most two rows: longer slides join their lines in pairs with " / ". */
export function overlayRows(lines: string[]): string[] {
  if (lines.length <= 2) return lines;
  const half = Math.ceil(lines.length / 2);
  return [lines.slice(0, half).join(" / "), lines.slice(half).join(" / ")];
}

/** About how wide a character is, in font sizes: narrow letters and spaces, wide ones, capitals, the rest. */
const charWidth = (c: string) =>
  /[\s.,;:!?'’"«»\-–—|iljIțţ]/.test(c)
    ? 0.22
    : /[mwMWшщюЮШЩ]/.test(c)
      ? 0.75
      : /[A-ZĂÂÎȘȚА-ЯІЇЄҐ]/.test(c)
        ? 0.6
        : 0.58;
const widthOf = (line: string) =>
  [...line].reduce((sum, c) => sum + charWidth(c), 0);

/** The largest font for these lines, in screen widths: lines don't wrap. */
const fitOf = (lines: string[]) =>
  Math.min(0.37 / lines.length, 1 / Math.max(...lines.map(widthOf), 1));
/** A four-line slide of 32-character lines. */
const REFERENCE = fitOf(Array(4).fill("Aaaa bbbb cccc dddd eeee ffff gg"));

/**
 * How large a slide's text can be on a 16:9 projector, compared with a four-line slide
 * of 32-character lines: below 0.7 it's too small to read. The number of lines and the
 * widest line decide, with each character's width by its kind. Fitted to the sizes the
 * projector actually gave 730 imported slides: it finds every slide under 0.7, and
 * warns about 2% of the others.
 */
export function slideScale(lines: string[]): number {
  const shown = lines.map((l) => l.replace(/<[^>]*>/g, ""));
  return fitOf(shown.length ? shown : [""]) / REFERENCE;
}
