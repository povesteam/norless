import {
  Button,
  Checkbox,
  Description,
  NumberField,
  CheckboxGroup,
  Label,
  ListBox,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Switch,
} from "@heroui/react";
import { Check, Save } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { legendColor, legendSuffixes } from "../../shared/music/music";
import {
  guitarShapes,
  instruments,
  noteNamings,
  type Instrument,
  type Musician,
  type NoteNaming,
} from "../../shared/preferences";
import { Shown, useCommunity, useReloadCommunity } from "../data/community";
import { send } from "../data/fetch";
import { useMe } from "../data/me";
import { ActionButton, ErrorNotice, usePending } from "../ui/states";

/**
 * My account's Musician section: what the member plays, their
 * main instrument, the guitar shapes they like and how chords are named for them.
 */
export function MusicianProfile({
  bare = false,
}: {
  /** Without the section's heading and line, in the dialog that asks. */
  bare?: boolean;
}) {
  const { t } = useTranslation();
  const { me, savePreferences } = useMe();
  if (!me?.user) return null;
  const musician = me.preferences.musician ?? {};
  const plays = musician.instruments ?? [];
  const save = (change: Musician) =>
    savePreferences({
      ...me.preferences,
      musician: { ...musician, ...change },
    });

  return (
    <section
      id={bare ? undefined : "musician"}
      className={`flex w-full flex-col items-start gap-4 ${bare ? "" : "border-t border-separator pt-4"}`}
    >
      {!bare && (
        <h3 className="text-lg font-semibold">{t("instruments.profile")}</h3>
      )}
      <p className="text-muted">{t("instruments.profileHelp")}</p>
      <CheckboxGroup
        value={plays}
        onChange={(value) => {
          const chosen = value as Instrument[];
          save({
            instruments: chosen,
            // The main one stays one of them.
            main:
              musician.main && chosen.includes(musician.main)
                ? musician.main
                : (chosen[0] ?? null),
          });
        }}
      >
        <Label>{t("instruments.play")}</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {instruments.map((instrument) => (
            <Checkbox key={instrument} value={instrument}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                {t(`instruments.names.${instrument}`)}
              </Checkbox.Content>
            </Checkbox>
          ))}
        </div>
      </CheckboxGroup>
      {plays.length > 1 && (
        <Select
          value={musician.main ?? plays[0] ?? null}
          onChange={(main) => save({ main: main as Instrument })}
          className="w-56"
        >
          <Label>{t("instruments.main")}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {plays.map((instrument) => (
                <ListBox.Item
                  key={instrument}
                  id={instrument}
                  textValue={t(`instruments.names.${instrument}`)}
                >
                  {t(`instruments.names.${instrument}`)}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      )}
      {plays.includes("guitar") && (
        <CheckboxGroup
          value={musician.shapes?.length ? musician.shapes : [...guitarShapes]}
          onChange={(shapes) =>
            save({
              // In the order offered, which breaks ties between capos.
              shapes: guitarShapes.filter((s) => shapes.includes(s)),
            })
          }
        >
          <Label>{t("instruments.guitarShapes")}</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {guitarShapes.map((shape) => (
              <Checkbox key={shape} value={shape}>
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  {shape}
                </Checkbox.Content>
              </Checkbox>
            ))}
          </div>
        </CheckboxGroup>
      )}
      <RadioGroup
        value={musician.noteNames ?? "community"}
        onChange={(value) =>
          save({
            noteNames: value === "community" ? null : (value as NoteNaming),
          })
        }
      >
        <Label>{t("instruments.noteNames")}</Label>
        {["community", ...noteNamings].map((naming) => (
          <Radio key={naming} value={naming}>
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              {t(`instruments.naming.${naming}`)}
            </Radio.Content>
          </Radio>
        ))}
      </RadioGroup>
      <Shown feature="chordColors">
        <Switch
          isSelected={musician.chordColors ?? false}
          onChange={(chordColors) => save({ chordColors })}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Label>{t("instruments.chordColors")}</Label>
          </Switch.Content>
          <Description>{t("instruments.chordColorsHelp")}</Description>
        </Switch>
        {/* Each degree and suffix in its color, so the colors can be learned. */}
        {musician.chordColors && (
          <div aria-hidden className="flex flex-col gap-1 text-sm text-muted">
            <span>
              {t("instruments.degrees")}{" "}
              <span className="font-bold whitespace-nowrap">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <span
                    key={d}
                    className="me-1.5"
                    style={{ color: legendColor(d) }}
                  >
                    {d}
                  </span>
                ))}
              </span>
            </span>
            <span>
              {t("instruments.suffixes")}{" "}
              <span className="font-bold whitespace-nowrap">
                {legendSuffixes.map(({ suffix, color }) => (
                  <span key={suffix} className="me-1.5" style={{ color }}>
                    {suffix}
                  </span>
                ))}
              </span>
            </span>
          </div>
        )}
      </Shown>
    </section>
  );
}

/**
 * What the member plays, in a dialog: opened by the musicians view the first time and
 * from its Display menu. Saved as it's picked.
 */
export function MusicianDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container scroll="outside">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("instruments.ask")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <MusicianProfile bare />
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onClose}>
              <Check />
              {t("instruments.done")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Settings, for owners: how chords are named for members who didn't choose. */
export function NoteNamesSettings() {
  const { t } = useTranslation();
  const { slug, noteNames = "letters" } = useCommunity();
  const reload = useReloadCommunity();
  const [failed, setFailed] = useState(false);
  return (
    <section aria-labelledby="music-title" className="flex flex-col gap-4">
      <h3 id="music-title" className="text-xl font-semibold">
        {t("instruments.settingsTitle")}
      </h3>
      <p className="text-muted">{t("instruments.settingsHelp")}</p>
      {failed && <ErrorNotice message={t("states.actionFailed")} />}
      <RadioGroup
        value={noteNames}
        onChange={async (value) => {
          const response = await send(
            "PUT",
            `/api/communities/${slug}/note-names`,
            { noteNames: value },
          );
          setFailed(!response?.ok);
          if (response?.ok) reload();
        }}
      >
        <Label>{t("instruments.noteNames")}</Label>
        {noteNamings.map((naming) => (
          <Radio key={naming} value={naming}>
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              {t(`instruments.naming.${naming}`)}
            </Radio.Content>
          </Radio>
        ))}
      </RadioGroup>
    </section>
  );
}

/** Settings, for owners: when a tempo drift shows on stage. */
export function TempoSettings() {
  const { t } = useTranslation();
  const { slug, tempoCheck = { percent: 4, seconds: 8 } } = useCommunity();
  const reload = useReloadCommunity();
  const [percent, setPercent] = useState(tempoCheck.percent);
  const [seconds, setSeconds] = useState(tempoCheck.seconds);
  const [state, setState] = useState<"saved" | "failed" | null>(null);
  const [save, saving] = usePending(async () => {
    const response = await send("PUT", `/api/communities/${slug}/tempo-check`, {
      percent,
      seconds,
    });
    setState(response?.ok ? "saved" : "failed");
    if (response?.ok) reload();
  });
  return (
    <section aria-labelledby="tempo-title" className="flex flex-col gap-4">
      <h3 id="tempo-title" className="text-xl font-semibold">
        {t("tempo.settingsTitle")}
      </h3>
      <p className="text-muted">{t("tempo.settingsHelp")}</p>
      {state === "failed" && <ErrorNotice message={t("states.actionFailed")} />}
      <div className="flex flex-wrap items-end gap-4">
        <NumberField
          value={percent}
          onChange={(value) => setPercent(value)}
          minValue={1}
          maxValue={20}
          className="w-40"
        >
          <Label>{t("tempo.percent")}</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>
        <NumberField
          value={seconds}
          onChange={(value) => setSeconds(Math.round(value))}
          minValue={2}
          maxValue={60}
          className="w-40"
        >
          <Label>{t("tempo.seconds")}</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>
        <ActionButton isPending={saving} onPress={() => void save()}>
          <Save />
          {t("editor.save")}
        </ActionButton>
        {state === "saved" && (
          <span className="text-sm text-muted">{t("editor.saved")}</span>
        )}
      </div>
    </section>
  );
}

/** The Music tab: note names, and the tempo check. */
export function MusicSettings() {
  return (
    <div className="flex flex-col gap-8">
      <NoteNamesSettings />
      <TempoSettings />
    </div>
  );
}
