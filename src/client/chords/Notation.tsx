import { Play, Save, Square, Trash2, X } from "lucide-react";
import {
  Button,
  Description,
  Label,
  Modal,
  Switch,
  Tabs,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TuneObject } from "abcjs";
import {
  abcToGrid,
  BASIC_DRUMS,
  DRUMS,
  gridToAbc,
  isDrumBlock,
  stepsPerBar,
  toggleHit,
  type DrumGrid,
  type Meter,
} from "../../shared/music/notation";
import type { Block } from "../../shared/song-text";
import { loadAbc } from "./abc";
import { ErrorNotice } from "../ui/states";

/**
 * A problem abcjs found, as "Music Line:2:7: Unknown character…: <the line>": where it
 * is and what, else the warning without its markup.
 */
const warningPlace = (warning: string) => {
  const m = /^Music Line:(\d+):(\d+): (.*?):\s\s/.exec(warning);
  return m
    ? { line: m[1], column: m[2], message: m[3] }
    : { message: warning.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&") };
};

/**
 * A notation block drawn with abcjs, with what can't be read and a play button. It's
 * drawn and played `transpose` half steps away, unless it's for drums.
 */
export function NotationView({
  abc,
  transpose = 0,
  bpm = null,
  label,
  onNote,
}: {
  abc: string;
  transpose?: number;
  bpm?: number | null;
  label: string;
  /** A click on a note: its place in the ABC. */
  onNote?: (at: number) => void;
}) {
  const { t } = useTranslation();
  const paper = useRef<HTMLDivElement>(null);
  const [tune, setTune] = useState<TuneObject | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const player = useRef<{ stop: () => void } | null>(null);
  const shift = isDrumBlock(abc) ? 0 : transpose;
  const clicked = useEffectEvent((at: number) => onNote?.(at));
  const clickable = !!onNote;

  useEffect(() => {
    let cancelled = false;
    void loadAbc()
      .then((abcjs) => {
        if (cancelled || !paper.current) return;
        const [drawn] = abcjs.renderAbc(paper.current, abc, {
          responsive: "resize",
          add_classes: true,
          visualTranspose: shift,
          ariaLabel: label,
          paddingtop: 0,
          paddingbottom: 0,
          paddingleft: 0,
          paddingright: 0,
          ...(clickable
            ? {
                clickListener: (element) =>
                  element.startChar !== undefined && clicked(element.startChar),
              }
            : {}),
        });
        setTune(drawn);
        setWarnings(drawn.warnings ?? []);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [abc, shift, label, clickable]);

  // Leaving stops the sound.
  useEffect(() => () => player.current?.stop(), []);

  const play = async () => {
    if (!tune) return;
    // Made on the press, so browsers let it sound.
    const audioContext = new AudioContext();
    setPlaying(true);
    try {
      const abcjs = await loadAbc();
      const synth = new abcjs.synth.CreateSynth();
      await synth.init({
        audioContext,
        visualObj: tune,
        options: {
          soundFontUrl: "/soundfont/FluidR3_GM/",
          ...(bpm ? { qpm: bpm } : {}),
          midiTranspose: shift,
        },
        onEnded: () => {
          player.current = null;
          setPlaying(false);
          void audioContext.close();
        },
      });
      await synth.prime();
      player.current = {
        stop: () => {
          synth.stop();
          void audioContext.close();
        },
      };
      synth.start();
    } catch {
      setPlaying(false);
      void audioContext.close();
    }
  };
  const stop = () => {
    player.current?.stop();
    player.current = null;
    setPlaying(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Room for a staff while abcjs loads, so nothing below jumps. */}
      <div ref={paper} className="min-h-20 w-full" />
      {failed && <ErrorNotice message={t("states.loadFailed")} />}
      {warnings.length > 0 && (
        <ul className="text-sm text-danger">
          {warnings.map(warningPlace).map(({ line, column, message }, i) => (
            <li key={i}>
              {line ? t("notation.error", { line, column, message }) : message}
            </li>
          ))}
        </ul>
      )}
      <Button
        size="sm"
        variant="secondary"
        className="self-start"
        isDisabled={!tune}
        onPress={() => (playing ? stop() : void play())}
      >
        {playing ? <Square /> : <Play />}
        {playing ? t("notation.stop") : t("notation.play")}
      </Button>
    </div>
  );
}

/** A part's blocks on a stage layout: drum blocks for drums, the others for keys. */
export function PartBlocks({
  blocks,
  drums,
  transpose,
  bpm,
  part,
}: {
  blocks: Block[];
  drums: boolean;
  transpose: number;
  bpm: number | null;
  part: string;
}) {
  const { t } = useTranslation();
  const shown = blocks.filter((b) => isDrumBlock(b.abc) === drums);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {shown.map((block) => (
        <NotationView
          key={block.start}
          abc={block.abc}
          transpose={transpose}
          bpm={bpm}
          label={t("notation.of", { part })}
        />
      ))}
    </div>
  );
}

/** A new block's text: a grand staff in the song's key and time. */
export function pianoTemplate(key: string | null, time: string): string {
  return [
    "X:1",
    `M:${/^\d+\/\d+$/.test(time) ? time : "4/4"}`,
    "L:1/8",
    `K:${key ?? "C"}`,
    "%%score {RH LH}",
    "V:RH clef=treble",
    "z8|",
    "V:LH clef=bass",
    "z8|",
  ].join("\n");
}

/**
 * Writes one block: ABC with its preview, or the drum grid. A block the grid wrote opens
 * in the grid. `abc` is null for a new block.
 */
export function NotationDialog({
  abc,
  template,
  meter,
  bpm,
  part,
  onApply,
  onRemove,
  onClose,
}: {
  abc: string | null;
  template: string;
  meter: Meter;
  bpm: number | null;
  part: string;
  onApply: (abc: string) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const opened = abc === null ? null : abcToGrid(abc);
  const [mode, setMode] = useState<"notes" | "grid">(opened ? "grid" : "notes");
  const [text, setText] = useState(abc ?? template);
  const [grid, setGrid] = useState<DrumGrid>(
    opened ?? { meter, bars: 1, hits: {} },
  );
  const textArea = useRef<HTMLTextAreaElement>(null);
  const written = mode === "grid" ? gridToAbc(grid) : text;

  const switchTo = (next: "notes" | "grid") => {
    if (next === "notes" && mode === "grid") setText(gridToAbc(grid));
    if (next === "grid") {
      const read = abcToGrid(text);
      if (read) setGrid(read);
    }
    setMode(next);
  };

  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container size="lg" scroll="outside">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("notation.of", { part })}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <Tabs
              selectedKey={mode}
              onSelectionChange={(key) => switchTo(key as "notes" | "grid")}
            >
              <Tabs.ListContainer>
                <Tabs.List aria-label={t("notation.title")}>
                  <Tabs.Tab id="notes">
                    {t("notation.notes")}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="grid">
                    {t("notation.grid")}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
              <Tabs.Panel id="notes" className="flex flex-col gap-4 pt-4">
                <TextField value={text} onChange={setText}>
                  <Label>{t("notation.text")}</Label>
                  <TextArea
                    ref={textArea}
                    className="min-h-[8lh] field-sizing-content font-mono"
                  />
                  <Description>{t("notation.textHint")}</Description>
                </TextField>
              </Tabs.Panel>
              <Tabs.Panel id="grid" className="flex flex-col gap-4 pt-4">
                <GridEditor grid={grid} onChange={setGrid} />
              </Tabs.Panel>
            </Tabs>
            <NotationView
              abc={written}
              bpm={bpm}
              label={t("notation.preview")}
              onNote={
                mode === "notes"
                  ? (at) => {
                      textArea.current?.focus();
                      textArea.current?.setSelectionRange(at, at);
                    }
                  : undefined
              }
            />
          </Modal.Body>
          <Modal.Footer>
            {onRemove && (
              <Button variant="danger-soft" onPress={onRemove}>
                <Trash2 />
                {t("notation.remove")}
              </Button>
            )}
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            <Button onPress={() => onApply(written)}>
              <Save />
              {t("notation.apply")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Tap cells to put hits on the steps; the time, the bars and more drums above. */
function GridEditor({
  grid,
  onChange,
}: {
  grid: DrumGrid;
  onChange: (grid: DrumGrid) => void;
}) {
  const { t } = useTranslation();
  const used = DRUMS.filter((d) => (grid.hits[d]?.length ?? 0) > 0);
  const [more, setMore] = useState(used.some((d) => !BASIC_DRUMS.includes(d)));
  const rows = DRUMS.filter(
    (d) => more || BASIC_DRUMS.includes(d) || used.includes(d),
  );
  const perBar = stepsPerBar(grid.meter);
  const steps = perBar * grid.bars;
  // Hits past the grid's end go when it gets shorter.
  const resized = (next: Pick<DrumGrid, "meter" | "bars">): DrumGrid => {
    const end = stepsPerBar(next.meter) * next.bars;
    return {
      ...next,
      hits: Object.fromEntries(
        Object.entries(grid.hits).map(([d, s]) => [
          d,
          s.filter((step) => step < end),
        ]),
      ),
    };
  };
  const choice = (
    label: string,
    value: string,
    options: string[],
    set: (value: string) => void,
  ) => (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const [next] = keys;
        if (next !== undefined) set(String(next));
      }}
    >
      {options.map((option, i) => (
        <ToggleButton key={option} id={option}>
          {i > 0 && <ToggleButtonGroup.Separator />}
          {option}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-2">
          <span className="text-sm">{t("notation.meter")}</span>
          {choice(t("notation.meter"), grid.meter, ["4/4", "3/4"], (m) =>
            onChange(resized({ meter: m as Meter, bars: grid.bars })),
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-sm">{t("notation.bars")}</span>
          {choice(
            t("notation.bars"),
            String(grid.bars),
            ["1", "2", "3", "4"],
            (b) => onChange(resized({ meter: grid.meter, bars: Number(b) })),
          )}
        </span>
        <Switch isSelected={more} onChange={setMore}>
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Label>{t("notation.moreDrums")}</Label>
          </Switch.Content>
        </Switch>
      </div>
      <div className="overflow-x-auto pb-1">
        <div
          className="grid w-max gap-px"
          style={{ gridTemplateColumns: `6rem repeat(${steps}, 1.75rem)` }}
        >
          {rows.map((drum) => (
            <div
              key={drum}
              role="group"
              aria-label={t(`notation.drums.${drum}`)}
              className="contents"
            >
              <span className="self-center pe-2 text-sm">
                {t(`notation.drums.${drum}`)}
              </span>
              {Array.from({ length: steps }, (_, step) => {
                const hit = grid.hits[drum]?.includes(step) ?? false;
                const beat = Math.floor((step % perBar) / 4) + 1;
                return (
                  <button
                    key={step}
                    type="button"
                    aria-pressed={hit}
                    aria-label={t("notation.cell", {
                      bar: Math.floor(step / perBar) + 1,
                      beat,
                      step: (step % 4) + 1,
                    })}
                    onClick={() => onChange(toggleHit(grid, drum, step))}
                    className={`h-7 rounded-sm border outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                      step % 4 === 0 ? "border-muted" : "border-separator"
                    } ${hit ? "bg-accent" : beat % 2 === 0 ? "bg-surface-secondary" : "bg-surface"}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
