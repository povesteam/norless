import { ArrowLeft, ArrowRight, Mic, Plus, Trash2, X } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Modal,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  chordsAt,
  chordsUsed,
  inLetters,
  type Key,
} from "../../shared/music/chords";
import { keyChords } from "../../shared/music/chord-sheet";
import { chordOf } from "../../shared/song-text";

export type Target = {
  row: number;
  /** The chord's place in the row's chords, when one is there already. */
  index: number | null;
  /** Where a new chord goes, as an index in the row without its leading spaces. */
  at: number;
  word: string;
};

/** The chords to pick from: the song's, then the key's six, then any other. */
export function ChordPicker({
  target,
  text,
  songKey,
  scope,
  onMove,
  heard,
  onPick,
  onClose,
}: {
  target: Target;
  text: string;
  songKey: Key | null;
  /** For a part whose chords others share: every such part, or only this one. */
  scope: {
    type: string;
    only: boolean;
    onChange: (only: boolean) => void;
  } | null;
  /** Moves the chord a letter left or right, for keyboards. */
  onMove?: (step: number) => void;
  /** The chord a microphone or the mixer hears now, to use with a tap; undefined while not listening. */
  heard: string | null | undefined;
  onPick: (name: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const used = chordsUsed(text);
  const offered = [
    ...used,
    ...(songKey ? keyChords(songKey) : []).filter((c) => !used.includes(c)),
  ];
  const [other, setOther] = useState("");
  const typed = other.trim() ? chordOf(inLetters(other.trim())) : null;
  const current =
    target.index === null ? null : chordsAt(text, target.row)[target.index];
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>
              {current
                ? t("chords.change", { chord: current.name })
                : t("chords.over", { word: target.word })}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            {scope && (
              <ToggleButtonGroup
                aria-label={t("chords.scope.label")}
                selectionMode="single"
                disallowEmptySelection
                size="sm"
                selectedKeys={[scope.only ? "only" : "all"]}
                onSelectionChange={(keys) =>
                  scope.onChange([...keys][0] === "only")
                }
              >
                <ToggleButton id="all">
                  {t(`chords.scope.all.${scope.type}`, {
                    defaultValue: t("chords.scope.all.other"),
                  })}
                </ToggleButton>
                <ToggleButton id="only">
                  <ToggleButtonGroup.Separator />
                  {t("chords.scope.only")}
                </ToggleButton>
              </ToggleButtonGroup>
            )}
            {/* While listening, a row: nothing moves when a chord is heard or stops. */}
            {heard !== undefined && (
              <div className="flex min-h-10 items-center">
                {heard && (
                  <Button onPress={() => onPick(heard)}>
                    <Mic />
                    {t("detect.useHeard", { chord: heard })}
                  </Button>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {offered.map((chord) => (
                <Button
                  key={chord}
                  variant={chord === current?.name ? "primary" : "secondary"}
                  onPress={() => onPick(chord)}
                >
                  {chord}
                </Button>
              ))}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (typed) onPick(inLetters(other.trim()));
              }}
            >
              <TextField
                value={other}
                onChange={setOther}
                isInvalid={other.trim() !== "" && !typed}
                className="w-40"
              >
                <Label>{t("chords.other")}</Label>
                <Input
                  autoFocus={offered.length === 0}
                  placeholder={t("chords.otherHint")}
                />
              </TextField>
              <Button type="submit" variant="secondary" isDisabled={!typed}>
                <Plus />
                {t("chords.add")}
              </Button>
            </form>
          </Modal.Body>
          <Modal.Footer>
            {current && onMove && (
              <>
                <Button
                  variant="secondary"
                  aria-label={t("chords.moveLeft")}
                  isIconOnly
                  onPress={() => onMove(-1)}
                >
                  <ArrowLeft />
                </Button>
                <Button
                  variant="secondary"
                  aria-label={t("chords.moveRight")}
                  isIconOnly
                  onPress={() => onMove(1)}
                >
                  <ArrowRight />
                </Button>
              </>
            )}
            {current && (
              <Button variant="danger-soft" onPress={() => onPick(null)}>
                <Trash2 />
                {t("chords.remove")}
              </Button>
            )}
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
