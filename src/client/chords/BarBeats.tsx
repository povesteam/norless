import { Slider } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChordColors } from "../../shared/music/music";
import type { Line } from "../../shared/song-text";
import { ChordName } from "../songs/SongText";

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * A line's bars of two chords or more: each chord as wide as its beats,
 * and a slider whose thumbs are where each chord ends, dragged or moved with the arrow
 * keys; it saves when let go. Equal lengths are stored as none.
 */
export function BarBeats({
  line,
  color,
  perBar,
  onChange,
}: {
  line: Line;
  color?: (chord: string) => ChordColors | undefined;
  perBar: number;
  onChange: (bar: number, beats: number[]) => void;
}) {
  const { t } = useTranslation();
  const bars = (line.bars ?? []).flatMap((names, i) =>
    names.length > 1 ? [{ names, i }] : [],
  );
  if (!bars.length) return null;
  return (
    <div className="flex flex-wrap gap-4">
      {bars.map(({ names, i }) => (
        <BarBeat
          key={i}
          names={names}
          color={color}
          beats={names.map((_, j) => line.beats?.[i]?.[j] ?? 1)}
          perBar={perBar}
          label={t("chords.beatsOf", { chords: names.join(" ") })}
          endLabel={(name) => t("chords.beatEnd", { chord: name })}
          onChange={(beats) => onChange(i, beats)}
        />
      ))}
    </div>
  );
}

function BarBeat({
  names,
  color,
  beats,
  perBar,
  label,
  endLabel,
  onChange,
}: {
  names: string[];
  color?: (chord: string) => ChordColors | undefined;
  beats: number[];
  perBar: number;
  label: string;
  endLabel: (name: string) => string;
  onChange: (beats: number[]) => void;
}) {
  const total = Math.max(perBar, names.length, sum(beats));
  // Where each chord ends, in beats of the bar: equal lengths as evenly as it allows.
  const ends = beats
    .slice(0, -1)
    .map((_, k) =>
      Math.round((sum(beats.slice(0, k + 1)) * total) / sum(beats)),
    );
  const [dragged, setDragged] = useState<number[] | null>(null);
  const shown = dragged ?? ends;
  const lengths = [...shown, total].map((end, k) => end - (shown[k - 1] ?? 0));
  /** Each end at least a beat after the one before, and a beat before the bar's end. */
  const tidy = (values: number[]) =>
    values.map((v, k) =>
      Math.min(Math.max(v, k + 1), total - (values.length - k)),
    );
  return (
    <div className="flex w-52 flex-col gap-1">
      <span className="flex rounded-md border border-separator font-bold">
        {names.map((name, k) => (
          <span
            key={k}
            className={`min-w-0 basis-0 text-center text-sm text-chord ${
              k > 0 ? "border-s border-dashed border-separator" : ""
            }`}
            style={{ flexGrow: lengths[k] ?? 1 }}
          >
            <ChordName name={name} colors={color?.(name)} />
          </span>
        ))}
      </span>
      <Slider
        aria-label={label}
        minValue={0}
        maxValue={total}
        step={1}
        value={shown}
        onChange={(values) => setDragged(tidy(values as number[]))}
        onChangeEnd={(values) => {
          setDragged(null);
          const next = [...tidy(values as number[]), total].map(
            (end, k, all) => end - (all[k - 1] ?? 0),
          );
          const common = next.reduce(gcd);
          onChange(next.map((b) => b / common));
        }}
      >
        <Slider.Track>
          {shown.map((_, k) => (
            <Slider.Thumb
              key={k}
              index={k}
              aria-label={endLabel(names[k] ?? "")}
            />
          ))}
        </Slider.Track>
      </Slider>
    </div>
  );
}
