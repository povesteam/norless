import { parseSong } from "../song-text.js";

/**
 * Notation blocks: putting a part's blocks in the song text, and the
 * drum grid, which writes plain ABC and reads back what it wrote.
 */

const normalize = (text: string) => text.replace(/\r\n?/g, "\n");

/**
 * The text with a part's block changed (`block` is its index), added after the part's
 * last row (`block` null), or removed (`abc` null). Blank rows and fences inside the
 * ABC go, since they would end the block.
 */
export function setBlock(
  text: string,
  section: number,
  block: number | null,
  abc: string | null,
): string {
  const rows = normalize(text).split("\n");
  const part = parseSong(text).sections[section];
  if (!part) return text;
  const fenced =
    abc === null
      ? []
      : [
          "```abc",
          ...normalize(abc)
            .split("\n")
            .map((row) => row.trimEnd())
            .filter(
              (row) => row.trim() !== "" && !row.trim().startsWith("```"),
            ),
          "```",
        ];
  const old = block === null ? undefined : part.blocks[block];
  if (old) rows.splice(old.start, old.end - old.start + 1, ...fenced);
  else rows.splice(part.end + 1, 0, ...fenced);
  return rows.join("\n");
}

/** Whether a block is for drums: a percussion clef. */
export const isDrumBlock = (abc: string) => /^[KV]:.*\bperc\b/m.test(abc);

/** The grid's drums, top to bottom as on the staff. */
export const DRUMS = [
  "crash",
  "hihat",
  "ride",
  "highTom",
  "midTom",
  "snare",
  "floorTom",
  "kick",
] as const;
export type Drum = (typeof DRUMS)[number];

/** Each drum's note on the staff, its General MIDI sound and its note head. */
const KIT: Record<Drum, { note: string; sound: string; head?: "x" }> = {
  crash: { note: "a", sound: "crash-cymbal-1", head: "x" },
  hihat: { note: "g", sound: "closed-hi-hat", head: "x" },
  ride: { note: "f", sound: "ride-cymbal-1", head: "x" },
  highTom: { note: "e", sound: "high-tom" },
  midTom: { note: "d", sound: "hi-mid-tom" },
  snare: { note: "c", sound: "acoustic-snare" },
  floorTom: { note: "A", sound: "high-floor-tom" },
  kick: { note: "F", sound: "bass-drum-1" },
};

/** Always in the grid; the others show when asked for or used. */
export const BASIC_DRUMS: readonly Drum[] = ["hihat", "snare", "kick"];

export type Meter = "4/4" | "3/4";
/** A groove: the steps (sixteenth notes from the start) each drum is hit on. */
export type DrumGrid = {
  meter: Meter;
  bars: number;
  hits: Partial<Record<Drum, number[]>>;
};

export const stepsPerBar = (meter: Meter) => (meter === "4/4" ? 16 : 12);
const BEAT = 4;

/** The grid with a hit added or removed. */
export function toggleHit(grid: DrumGrid, drum: Drum, step: number): DrumGrid {
  const steps = grid.hits[drum] ?? [];
  const next = steps.includes(step)
    ? steps.filter((s) => s !== step)
    : [...steps, step].sort((a, b) => a - b);
  return { ...grid, hits: { ...grid.hits, [drum]: next } };
}

/**
 * The grid as ABC on a drum staff: each hit lasts until the next hit in its beat, and
 * beats are spaced so the beams follow them.
 */
export function gridToAbc(grid: DrumGrid): string {
  const perBar = stepsPerBar(grid.meter);
  const at = (step: number) =>
    DRUMS.filter((d) => grid.hits[d]?.includes(step)).map((d) => KIT[d].note);
  const length = (n: number) => (n === 1 ? "" : String(n));
  const beat = (from: number) => {
    const onsets = Array.from({ length: BEAT }, (_, i) => from + i).filter(
      (step) => at(step).length > 0,
    );
    const first = onsets[0];
    if (first === undefined) return `z${BEAT}`;
    const rest = first > from ? `z${length(first - from)}` : "";
    return (
      rest +
      onsets
        .map((step, i) => {
          const notes = at(step);
          const until = onsets[i + 1] ?? from + BEAT;
          const sound = notes.length > 1 ? `[${notes.join("")}]` : notes[0];
          return `${sound}${length(until - step)}`;
        })
        .join("")
    );
  };
  const bars = Array.from({ length: grid.bars }, (_, bar) =>
    Array.from({ length: perBar / BEAT }, (_, b) =>
      beat(bar * perBar + b * BEAT),
    ).join(" "),
  );
  return [
    "X:1",
    `M:${grid.meter}`,
    "L:1/16",
    ...DRUMS.map((d) =>
      [`%%percmap ${KIT[d].note} ${KIT[d].sound}`, KIT[d].head]
        .filter(Boolean)
        .join(" "),
    ),
    "K:C clef=perc",
    `${bars.join(" | ")} |]`,
  ].join("\n");
}

/**
 * The grid of a drum block, or null when it can't be one: not 4/4 or 3/4 in sixteenths,
 * a note that isn't one of the grid's drums, or something besides notes, rests and bars.
 */
export function abcToGrid(abc: string): DrumGrid | null {
  const rows = normalize(abc).split("\n");
  const field = (name: string) =>
    rows
      .find((row) => row.startsWith(`${name}:`))
      ?.slice(2)
      .trim();
  const meter = field("M") === "C" ? "4/4" : field("M");
  if ((meter !== "4/4" && meter !== "3/4") || field("L") !== "1/16")
    return null;
  if (!/\bperc\b/.test(field("K") ?? "")) return null;

  const drumOf = new Map<string, Drum>();
  for (const row of rows) {
    const m = /^%%percmap\s+(\S+)\s+(\S+)/.exec(row);
    const drum = m && DRUMS.find((d) => KIT[d].sound === m[2]);
    if (m?.[1] && drum) drumOf.set(m[1], drum);
  }

  const body = rows
    .filter((row) => !/^[A-Za-z]:/.test(row) && !row.startsWith("%"))
    .join(" ");
  const token =
    /\s+|\|\]?|z(\d*)|\[((?:[A-Ga-g][,']*)+)\](\d*)|([A-Ga-g][,']*)(\d*)/y;
  const hits: Partial<Record<Drum, number[]>> = {};
  let step = 0;
  let index = 0;
  while (index < body.length) {
    token.lastIndex = index;
    const m = token.exec(body);
    if (!m) return null;
    index = token.lastIndex;
    const notes = m[2] ?? m[4];
    const length = Number(m[1] || m[3] || m[5] || 1);
    if (m[0].startsWith("z")) step += length;
    else if (notes) {
      for (const note of notes.match(/[A-Ga-g][,']*/g) ?? []) {
        const drum = drumOf.get(note);
        if (!drum) return null;
        (hits[drum] ??= []).push(step);
      }
      step += length;
    }
  }
  const perBar = stepsPerBar(meter);
  const bars = step / perBar;
  if (!Number.isInteger(bars) || bars < 1 || bars > 4) return null;
  return { meter, bars, hits };
}
