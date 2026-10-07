import { Minus, Plus } from "lucide-react";
import { Button, Label, Switch } from "@heroui/react";
import { useTranslation } from "react-i18next";
import type { Song } from "../../server/songs/songs";
import type { Key } from "../../shared/music/chords";

/**
 * Above an instrument's layout: the key it's played in, the time signature and tempo,
 * the capo for guitar and the numbers switch for keys.
 */
export function InstrumentHeader({
  song,
  keyMark,
  capo,
  onCapo,
  shapeKey,
  numbers,
  onNumbers,
}: {
  song: Song;
  /** The key it's played in, with its icon (SongKey); null without one. */
  keyMark: React.ReactNode;
  capo: number;
  onCapo: (capo: number) => void;
  /** The key of the shapes played, null when the capo doesn't show. */
  shapeKey: Key | null;
  /** Whether keys show numbers, null when the switch doesn't show. */
  numbers: boolean | null;
  onNumbers: (numbers: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {keyMark}
      {song.timeSignature && (
        <span className="text-lg font-semibold whitespace-nowrap">
          {t("song.time", { time: song.timeSignature })}
        </span>
      )}
      {song.bpm !== null && (
        <span className="text-lg font-semibold whitespace-nowrap">
          {t("song.tempo", { bpm: song.bpm })}
        </span>
      )}
      {shapeKey && (
        <span className="flex items-center gap-1">
          <Button
            isIconOnly
            size="sm"
            variant="secondary"
            aria-label={t("instruments.capoDown")}
            isDisabled={capo === 0}
            onPress={() => onCapo(capo - 1)}
          >
            <Minus />
          </Button>
          <span className="min-w-28 text-center text-lg font-bold">
            {capo === 0
              ? t("instruments.noCapo")
              : t("instruments.capo", { fret: capo })}
          </span>
          <Button
            isIconOnly
            size="sm"
            variant="secondary"
            aria-label={t("instruments.capoUp")}
            isDisabled={capo === 7}
            onPress={() => onCapo(capo + 1)}
          >
            <Plus />
          </Button>
          <span className="text-muted">
            {t("instruments.shapes", {
              key: `${shapeKey.tonic}${shapeKey.minor ? "m" : ""}`,
            })}
          </span>
        </span>
      )}
      {numbers !== null && (
        <Switch isSelected={numbers} onChange={onNumbers}>
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Label>{t("instruments.numbers")}</Label>
          </Switch.Content>
        </Switch>
      )}
    </div>
  );
}
