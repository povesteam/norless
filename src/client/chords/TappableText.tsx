import { Music, Plus } from "lucide-react";
import { Button } from "@heroui/react";
import { Fragment, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePartName } from "../stage/parts";
import { placeOver } from "../../shared/music/chord-sheet";
import type { ChordColors } from "../../shared/music/music";
import { lettersOnly } from "../../shared/song-render";
import { parseSong, type Line } from "../../shared/song-text";
import { NotationView } from "./Notation";
import { ChordName } from "../songs/SongText";
import type { Target } from "./ChordPicker";
import { BarBeats } from "./BarBeats";

/**
 * The text as musicians read it, each word a button: tapping a letter puts a chord over
 * it, or changes the one there. Keyboard users get the word's first letter.
 */
export function TappableText({
  text,
  color,
  onTap,
  onMove,
  perBar,
  onBeats,
  notation,
}: {
  text: string;
  /** A chord's colors, when the member colors chords. */
  color?: (chord: string) => ChordColors | undefined;
  onTap: (target: Target) => void;
  /** A chord dragged to another letter: its row, its place in the row's chords, and where it goes. */
  onMove: (row: number, index: number, at: number) => void;
  /** Beats in a bar, from the time signature (4 without one). */
  perBar: number;
  /** A bar's chords given their beats: the line's row, the bar, a length per chord. */
  onBeats: (row: number, bar: number, beats: number[]) => void;
  /** Notation blocks to see, change and add. */
  notation: {
    bpm: number | null;
    onEdit: (section: number, block: number | null) => void;
  };
}) {
  const { t } = useTranslation();
  const partName = usePartName();
  const { sections } = useMemo(() => parseSong(text), [text]);
  const rows = text.replace(/\r\n?/g, "\n").split("\n");
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section, i) => (
        <div key={i} className="flex flex-col items-start gap-1">
          {section.name !== null && (
            // Named as the live view names it: "Verse 1", not "1".
            <span className="rounded-md bg-accent-soft px-2 text-sm font-semibold text-accent-soft-foreground">
              {partName(section, section.name)}
            </span>
          )}
          {section.notes.map((note, j) => (
            <p key={j} className="text-sm text-muted">
              {note.text}
            </p>
          ))}
          {section.repeatOf !== null ? (
            <p className="text-sm text-muted">{t("chords.repeat")}</p>
          ) : (
            section.lines.map((line, j) =>
              line.row === undefined ? null : (
                <Fragment key={j}>
                  {line.chordsOnly ? (
                    <ChordsOnly
                      line={line}
                      color={color}
                      onTap={(index) =>
                        onTap({
                          row: line.row ?? 0,
                          index,
                          at: line.chords[index]?.at ?? 0,
                          word: line.chords[index]?.name ?? "",
                        })
                      }
                    />
                  ) : (
                    <Words
                      line={line}
                      color={color}
                      onMove={(index, at) => {
                        const [placed] = placeOver(
                          line.text,
                          [{ at, name: "" }],
                          rows[line.row ?? 0] ?? "",
                        );
                        onMove(line.row ?? 0, index, placed?.at ?? 0);
                      }}
                      onTap={(at, word) => {
                        const existing = line.chords.findIndex(
                          (c) => c.at === at,
                        );
                        const [placed] = placeOver(
                          line.text,
                          [{ at, name: "" }],
                          rows[line.row ?? 0] ?? "",
                        );
                        onTap({
                          row: line.row ?? 0,
                          index: existing < 0 ? null : existing,
                          at: placed?.at ?? 0,
                          word,
                        });
                      }}
                    />
                  )}
                  <BarBeats
                    line={line}
                    color={color}
                    perBar={perBar}
                    onChange={(bar, beats) =>
                      onBeats(line.row ?? 0, bar, beats)
                    }
                  />
                </Fragment>
              ),
            )
          )}
          {section.repeatOf === null && (
            <>
              {section.blocks.map((block, j) => (
                <div
                  key={block.start}
                  className="flex w-full flex-col gap-2 rounded-xl border border-separator p-3"
                >
                  <NotationView
                    abc={block.abc}
                    bpm={notation.bpm}
                    label={t("notation.of", {
                      part: section.name ?? String(i + 1),
                    })}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="self-start"
                    onPress={() => notation.onEdit(i, j)}
                  >
                    <Music />
                    {t("notation.edit")}
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onPress={() => notation.onEdit(i, null)}
              >
                <Plus />
                {t("notation.add")}
              </Button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/** A line of chords without words: each chord can be changed or removed. */
function ChordsOnly({
  line,
  color,
  onTap,
}: {
  line: Line;
  color?: (chord: string) => ChordColors | undefined;
  onTap: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {line.chords.map((chord, i) => (
        <Button key={i} size="sm" variant="ghost" onPress={() => onTap(i)}>
          <span className="font-bold text-chord">
            <ChordName name={chord.name} colors={color?.(chord.name)} />
          </span>
        </Button>
      ))}
    </div>
  );
}

/** A lyric line: its letters, with their chords above them, grouped in word buttons. */
function Words({
  line,
  color,
  onTap,
  onMove,
}: {
  line: Line;
  color?: (chord: string) => ChordColors | undefined;
  onTap: (at: number, word: string) => void;
  /** A chord dragged to the letter at `at`: precision over the spread. */
  onMove: (index: number, at: number) => void;
}) {
  // The chord being dragged, and the letter under the pointer.
  const [drag, setDrag] = useState<{ index: number; at: number } | null>(null);
  // A drag that moved the chord isn't also a tap on the word.
  const moved = useRef(false);
  const shown = line.chords.map((c, i) =>
    drag?.index === i ? { ...c, at: drag.at } : c,
  );
  const chordAt = new Map(shown.map((c) => [c.at, c.name]));
  const indexAt = new Map(shown.map((c, i) => [c.at, i]));
  const letterAt = (x: number, y: number) => {
    const letter = document.elementFromPoint(x, y)?.closest("[data-at]");
    return letter ? Number(letter.getAttribute("data-at")) : null;
  };
  // Words and the spaces between them, with their index in the line.
  const words = [...lettersOnly(line.text).matchAll(/\S+|\s+/g)];
  // The line follows the drag: the chord moves from letter to letter, so it can't.
  return (
    <div
      className="flex flex-wrap items-end pt-[1.4em] whitespace-pre"
      onPointerMove={(e) => {
        if (!drag) return;
        const next = letterAt(e.clientX, e.clientY);
        if (next !== null && next !== drag.at) {
          moved.current = true;
          setDrag({ ...drag, at: next });
        }
      }}
      onPointerUp={(e) => {
        if (!drag) return;
        // Where it's let go, which the last move may not have rendered yet.
        const to = letterAt(e.clientX, e.clientY) ?? drag.at;
        if (to !== drag.at) moved.current = true;
        if (to !== line.chords[drag.index]?.at) onMove(drag.index, to);
        setDrag(null);
      }}
      onPointerCancel={() => setDrag(null)}
    >
      {words.map((m) => {
        const letters = m[0].split("").map((letter, k) => {
          const at = m.index + k;
          const chord = chordAt.get(at);
          return (
            <span key={k} data-at={at} className="relative">
              {chord && (
                // Dragged to another letter; a tap on the letter changes it.
                <span
                  className="absolute bottom-full left-0 cursor-grab touch-none font-bold text-chord select-none"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    moved.current = false;
                    setDrag({ index: indexAt.get(at) ?? 0, at });
                  }}
                >
                  <ChordName name={chord} colors={color?.(chord)} />
                </span>
              )}
              <span className={letter === "~" ? "invisible" : undefined}>
                {letter}
              </span>
            </span>
          );
        });
        if (
          /^\s+$/.test(m[0]) &&
          ![...m[0]].some((_, k) => chordAt.has(m.index + k))
        )
          return <span key={m.index}>{letters}</span>;
        return (
          // A plain button: a tap gives the letter under the finger, which React Aria's
          // press events don't.
          <button
            key={m.index}
            type="button"
            // The word, after the chords over it: "C Domnului".
            aria-label={[
              ...m[0]
                .split("")
                .flatMap((_, k) => chordAt.get(m.index + k) ?? []),
              m[0].replace(/~/g, " ").trim(),
            ]
              .filter(Boolean)
              .join(" ")}
            className="cursor-pointer rounded-sm hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
            onClick={(e) => {
              // The end of a drag that moved a chord isn't a tap on the word.
              if (moved.current) {
                moved.current = false;
                return;
              }
              const letter = (e.target as HTMLElement).closest("[data-at]");
              const at = letter
                ? Number(letter.getAttribute("data-at"))
                : m.index;
              onTap(at, m[0].replace(/~/g, " ").trim() || m[0]);
            }}
          >
            {letters}
          </button>
        );
      })}
    </div>
  );
}
