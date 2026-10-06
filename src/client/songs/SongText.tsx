import { Pencil } from "lucide-react";
import { Button, Chip } from "@heroui/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  chordChunks,
  formatLines,
  lettersOnly,
  type Segment,
} from "../../shared/song-render";
import type { ChordColors } from "../../shared/music/music";
import {
  parseSong,
  partBeats,
  partLabels,
  type Slide,
} from "../../shared/song-text";
import { usePartName } from "../stage/parts";

/**
 * A song version's slides, with chords above the lyrics and the section notes.
 * With `onEdit`, each slide has a button that edits its section (for a repeat, the
 * section it repeats). Sections others are editing show their name and live draft;
 * nothing can be edited while someone else holds the song (`locked`).
 */
export function SongText({
  text,
  onEdit,
  editLabel,
  others,
  locked,
}: {
  text: string;
  onEdit?: (section: number) => void;
  editLabel?: string;
  others?: Map<number, { name: string; draft: string }>;
  locked?: boolean;
}) {
  const { t } = useTranslation();
  const partName = usePartName();
  const { slides } = useMemo(() => parseSong(text), [text]);
  // Every part named, as the live view does: "Verse 1", "Refrain".
  const labels = partLabels(slides);
  return (
    <div className="flex flex-col gap-6">
      {slides.map((slide, i) => {
        const other = others?.get(slide.section);
        const draft = other && parseSong(other.draft).slides[0];
        const name = partName(slide, labels[i] ?? "");
        return (
          <SlideView
            key={i}
            slide={
              draft ? { ...draft, last: slide.last, name } : { ...slide, name }
            }
            edit={
              (onEdit || other) && (
                <>
                  {onEdit && (
                    <Button
                      isIconOnly
                      variant="ghost"
                      size="sm"
                      aria-label={editLabel}
                      isDisabled={locked}
                      onPress={() => onEdit(slide.section)}
                    >
                      <Pencil />
                    </Button>
                  )}
                  {other && (
                    <Chip size="sm" color="warning" variant="soft">
                      {t("editor.editingBy", { name: other.name })}
                    </Chip>
                  )}
                </>
              )
            }
          />
        );
      })}
    </div>
  );
}

/**
 * A chord's name in its colors when the view colors chords: the
 * suffix and the bass after the slash in their own. The colors
 * come from the letters, so Do-Re-Mi and numbers take them too.
 */
export function ChordName({
  name,
  colors,
}: {
  name: string;
  colors?: ChordColors;
}) {
  if (!colors) return name;
  const slash = name.lastIndexOf("/");
  const main = slash > 0 ? name.slice(0, slash) : name;
  const letter = main.slice(0, main.length - (colors.suffixLength ?? 0));
  // After the slash: the bass, or the rest of the suffix (C6/9).
  const after = slash > 0 ? name.slice(slash) : "";
  const bass = colors.bass !== undefined;
  return (
    <>
      <span data-degree={colors.degree} style={{ color: colors.root }}>
        {letter}
      </span>
      {letter !== main && (
        <span style={{ color: colors.suffix }}>
          {main.slice(letter.length)}
        </span>
      )}
      {after && (
        <span
          data-degree={bass ? colors.bassDegree : undefined}
          style={{ color: bass ? colors.bass : colors.suffix }}
        >
          {after}
        </span>
      )}
    </>
  );
}

/**
 * How many bars a row of the grid holds: all of them when they fit,
 * else as few equal rows as fit, up to four; past that, as many as fit.
 */
export function barColumns(count: number, fit: number): number {
  if (count <= fit) return count;
  for (const rows of [2, 3, 4]) {
    const columns = Math.ceil(count / rows);
    if (columns <= fit) return columns;
  }
  return Math.max(1, fit);
}

/** A bar's chords with their beats and colors, for the grid. */
export type GridBar = {
  names: string[];
  beats: number[];
  colors?: (ChordColors | undefined)[];
};

/**
 * A part's bars for the grid, line by line: names as the member reads them, colors from
 * the letters.
 */
export const gridLines = (
  slide: Pick<Slide, "lines">,
  rename: (chord: string) => string = (chord) => chord,
  color?: (chord: string) => ChordColors | undefined,
): GridBar[][] =>
  partBeats(slide).map((line) =>
    line.map((bar) => ({
      names: bar.map((c) => rename(c.name)),
      beats: bar.map((c) => c.beats),
      colors: color && bar.map((c) => color(c.name)),
    })),
  );

/** About how wide a chord's name is in a bar, at the grid's size. */
const nameWidth = (name: string) => 20 + name.length * 11;
const GAP = 8;

/**
 * A part's bars as a grid: on one line when they fit; else a row per
 * chord line, its columns aligned; else in 2 to 4 equal rows. A bar's chords are as wide
 * as their beats.
 */
export function BarGrid({ lines }: { lines: GridBar[][] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  // Measured before the first paint, so the rows don't jump.
  useLayoutEffect(() => {
    setWidth(ref.current?.getBoundingClientRect().width ?? null);
  }, []);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry?.contentRect.width ?? null),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const bars = lines.flat();
  const cell = Math.max(
    56,
    ...bars.map((bar) =>
      bar.names.reduce((sum, name) => sum + nameWidth(name), 0),
    ),
  );
  const fit =
    width === null ? bars.length : Math.floor((width + GAP) / (cell + GAP));
  const longest = Math.max(...lines.map((line) => line.length));
  const byLine = bars.length > fit && lines.length > 1 && longest <= fit;
  const columns = byLine ? longest : barColumns(bars.length, fit);
  // Each line's first bar starts a row of its own.
  const starts = new Set(
    byLine ? lines.map((_, i) => lines.slice(0, i).flat().length) : [],
  );
  return (
    <div
      ref={ref}
      data-bar-grid
      className="grid gap-2"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {bars.map((bar, i) => (
        <span
          key={i}
          className="flex rounded-lg border border-separator px-1 text-lg font-bold"
          style={starts.has(i) ? { gridColumnStart: 1 } : undefined}
        >
          {/* No padding of their own, so the chords share the bar by their beats exactly. */}
          {bar.names.map((name, j) => (
            <span
              key={j}
              className={`min-w-0 basis-0 py-2 text-center ${
                j > 0 ? "border-s border-dashed border-separator" : ""
              }`}
              style={{ flexGrow: bar.beats[j] ?? 1 }}
            >
              <ChordName name={name} colors={bar.colors?.[j]} />
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

/** One slide: its name, notes, and lines with chords above the lyrics. */
export function SlideView({
  slide,
  edit,
}: {
  slide: Slide;
  edit?: React.ReactNode;
}) {
  const lines = slide.lines.map(chordChunks);
  // Formatting may span lines, so the whole slide is formatted at once.
  const formatted = formatLines(lines.flat().map((chunk) => chunk.text));
  let next = 0;
  const rows = lines.map((chunks) =>
    chunks.map((chunk) => ({ ...chunk, segments: formatted[next++] ?? [] })),
  );

  return (
    <div className="flex flex-col items-start gap-1">
      {(slide.name !== null || edit) && (
        <div className="flex items-center gap-1">
          {slide.name !== null && (
            <Chip size="sm" color="accent" variant="soft">
              {slide.name}
            </Chip>
          )}
          {edit}
        </div>
      )}
      {slide.notes.map((note, i) => (
        <p key={i} className="text-sm text-muted">
          {note.text}
        </p>
      ))}
      <div className={slide.type === "refrain" ? "italic" : undefined}>
        {rows.map((chunks, i) => {
          // Lines sung more than once are marked at the side, with ×2 or ×3 after them.
          const repeat = slide.repeats.find((r) => r.from <= i && i <= r.to);
          return (
            <div
              key={i}
              className={`min-h-[1.5em] whitespace-pre-wrap ${
                repeat ? "border-s-2 border-accent-soft ps-2" : ""
              }`}
            >
              {chunks.map((chunk, j) =>
                chunks.length === 1 && chunk.chord === null ? (
                  <Segments key={j} segments={chunk.segments} />
                ) : (
                  // Chords above the lyric text they start.
                  <span
                    key={j}
                    className="inline-flex flex-col align-bottom whitespace-pre"
                  >
                    <span
                      className={`pe-[0.4em] font-bold not-italic ${chunk.colors ? "" : "text-chord"}`}
                    >
                      <ChordName
                        name={chunk.chord ?? " "}
                        colors={chunk.colors}
                      />
                    </span>
                    <span>
                      {chunk.text ? (
                        <Segments segments={chunk.segments} />
                      ) : (
                        " "
                      )}
                    </span>
                  </span>
                ),
              )}
              {repeat?.to === i && (
                <span className="ms-2 text-sm font-semibold text-accent not-italic">
                  ×{repeat.times}
                </span>
              )}
              {slide.last && i === rows.length - 1 && (
                // The final mark, light grey as in the old app.
                // i18next-instrument-ignore-next-line
                <span className="text-muted not-italic"> *</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Formatted text runs; `~` stays as invisible space that keeps its width. */
export function Segments({ segments }: { segments: Segment[] }) {
  return segments.map((s, i) => (
    <span
      key={i}
      style={{
        fontStyle: s.italic ? "italic" : undefined,
        fontWeight: s.bold ? 700 : undefined,
        textDecoration: s.underline ? "underline" : undefined,
        color: s.color ?? undefined,
      }}
    >
      {lettersOnly(s.text)
        .split(/(~+)/)
        .map((part, j) =>
          j % 2 ? (
            // ~ is an invisible character that keeps its width.
            <span key={j} className="invisible">
              {part}
            </span>
          ) : (
            part
          ),
        )}
    </span>
  ));
}
