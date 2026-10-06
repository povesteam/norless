import { Metronome } from "lucide-react";
import { Button, Label, NumberField } from "@heroui/react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { tempoOf } from "../../shared/music/chords";

/** The tempo, typed or tapped: taps 2 seconds apart start a new count. */
export function Tempo({
  bpm,
  onChange,
}: {
  bpm: number | null;
  onChange: (bpm: number | null) => void;
}) {
  const { t } = useTranslation();
  const taps = useRef<number[]>([]);
  return (
    <div className="flex items-end gap-2">
      <NumberField
        value={bpm ?? Number.NaN}
        onChange={(value) =>
          onChange(Number.isNaN(value) ? null : Math.round(value))
        }
        minValue={30}
        maxValue={300}
        className="w-32"
      >
        <Label>{t("chords.tempo")}</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input />
          <NumberField.IncrementButton />
        </NumberField.Group>
      </NumberField>
      <Button
        variant="secondary"
        onPress={() => {
          const now = performance.now();
          const last = taps.current.at(-1);
          if (last !== undefined && now - last > 2000) taps.current = [];
          taps.current.push(now);
          const tempo = tempoOf(taps.current);
          if (tempo !== null) onChange(tempo);
        }}
      >
        <Metronome />
        {t("chords.tap")}
      </Button>
    </div>
  );
}
