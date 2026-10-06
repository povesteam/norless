import { ChevronDown, Circle, X } from "lucide-react";
import {
  Button,
  ButtonGroup,
  Label,
  ListBox,
  Modal,
  Select,
} from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionButton, ErrorNotice } from "../ui/states";
import { Tip } from "../ui/tip";

/** What an input is chosen for on this device. */
type InputUse = "record" | "tempo" | "chords";

/** The input chosen on this device: an id, null for the default, undefined before the first choice. */
function rememberedInput(use: InputUse) {
  try {
    const id = localStorage.getItem(`norless:input:${use}`);
    return id === null ? undefined : id || null;
  } catch {
    return undefined;
  }
}

/**
 * Starting with an input: asked the first time on this device, then remembered; the
 * arrow beside the button asks again. A remembered input that's gone asks again too.
 */
export function useInputChoice(
  use: InputUse,
  start: (deviceId: string | null) => Promise<boolean>,
) {
  const [choosing, setChoosing] = useState(false);
  const [failed, setFailed] = useState(false);
  const begin = async () => {
    const known = rememberedInput(use);
    if (known === undefined) return setChoosing(true);
    if (await start(known)) return;
    setFailed(true);
    setChoosing(true);
  };
  const chosen = async (deviceId: string | null) => {
    if (!(await start(deviceId))) return setFailed(true);
    try {
      localStorage.setItem(`norless:input:${use}`, deviceId ?? "");
    } catch {
      // Asked again next time.
    }
    setFailed(false);
    setChoosing(false);
  };
  return {
    begin,
    remembered: rememberedInput(use),
    choose: () => setChoosing(true),
    choosing,
    failed,
    chosen,
    close: () => {
      setFailed(false);
      setChoosing(false);
    },
  };
}

/**
 * A start button with the arrow that chooses the input again; as an icon (the stage
 * views' row), one button that opens the choice, with Start in it (the arrow
 * beside an icon looked broken).
 */
export function StartWithInput({
  big = false,
  chooseLabel,
  label,
  onStart,
  onChoose,
  children,
}: {
  big?: boolean;
  /** The arrow's label, naming what the input is for. */
  chooseLabel: string;
  /** Given, the button is its icon (`children`), with this in a tooltip, and opens the choice. */
  label?: string;
  onStart: () => void;
  onChoose: () => void;
  children: React.ReactNode;
}) {
  if (label)
    return (
      <Tip label={label}>
        <Button
          isIconOnly
          size={big ? "lg" : "sm"}
          variant="secondary"
          aria-label={label}
          onPress={onChoose}
        >
          {children}
        </Button>
      </Tip>
    );
  return (
    <ButtonGroup size={big ? "lg" : "sm"} variant="secondary">
      <Button onPress={onStart}>{children}</Button>
      <ButtonGroup.Separator />
      <Button isIconOnly aria-label={chooseLabel} onPress={onChoose}>
        <ChevronDown />
      </Button>
    </ButtonGroup>
  );
}

/** Which input to use: the microphone, or another one such as the mixer. */
export function InputDialog({
  initial = null,
  failed,
  onStart,
  onClose,
  title,
  help,
  startLabel,
  startIcon = <Circle />,
}: {
  /** The input chosen last time on this device. */
  initial?: string | null;
  failed: boolean;
  onStart: (deviceId: string | null) => Promise<void>;
  onClose: () => void;
  title?: string;
  help?: string;
  startLabel?: string;
  startIcon?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [chosen, setChosen] = useState<string | null>(initial);
  const [denied, setDenied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  useEffect(() => {
    // The chosen input's level, so it's clear it hears something; the inputs' names
    // come once the browser may use the microphone.
    let stopped = false;
    let context: AudioContext | null = null;
    let stream: MediaStream | null = null;
    void navigator.mediaDevices
      .getUserMedia({
        audio: chosen ? { deviceId: { exact: chosen } } : true,
      })
      .then(async (opened) => {
        stream = opened;
        if (stopped) return opened.getTracks().forEach((t) => t.stop());
        const all = await navigator.mediaDevices.enumerateDevices();
        setInputs(all.filter((d) => d.kind === "audioinput" && d.deviceId));
        context = new AudioContext();
        const node = context.createAnalyser();
        context.createMediaStreamSource(opened).connect(node);
        void context.resume();
        setAnalyser(node);
      })
      .catch(() => setDenied(true));
    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
  }, [chosen]);
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{title ?? t("recordings.record")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <p className="text-sm text-muted">{help ?? t("recordings.help")}</p>
            {denied && <ErrorNotice message={t("recordings.noMicrophone")} />}
            {failed && <ErrorNotice message={t("states.actionFailed")} />}
            {inputs.length > 1 && (
              <Select
                value={chosen ?? inputs[0]?.deviceId ?? null}
                onChange={(id) => setChosen(String(id))}
              >
                <Label>{t("recordings.input")}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {inputs.map((input, i) => (
                      <ListBox.Item
                        key={input.deviceId}
                        id={input.deviceId}
                        textValue={
                          input.label || t("recordings.inputN", { n: i + 1 })
                        }
                      >
                        {input.label || t("recordings.inputN", { n: i + 1 })}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            )}
            {analyser && (
              <p className="flex items-center gap-2 text-sm text-muted">
                {t("recordings.hears")} <Level analyser={analyser} />
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            <ActionButton
              variant={startLabel ? "primary" : "danger"}
              isPending={starting}
              isDisabled={denied}
              onPress={() => {
                setStarting(true);
                void onStart(chosen).finally(() => setStarting(false));
              }}
            >
              {startIcon}
              {startLabel ?? t("recordings.start")}
            </ActionButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** A tiny bar of how loud the input is, redrawn about 15 times a second, not re-rendered. */
export function Level({ analyser }: { analyser: AnalyserNode }) {
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const samples = new Float32Array(analyser.fftSize);
    let frame = 0;
    let drawn = 0;
    let shown = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - drawn < 66) return;
      drawn = now;
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const rms = Math.sqrt(sum / samples.length);
      // -60 dB (quiet) to 0 dB (full).
      const level = Math.min(
        1,
        Math.max(0, (20 * Math.log10(rms || 1e-6) + 60) / 60),
      );
      // Falls back gently, so a kick drum's hit stays visible for a moment.
      shown = Math.max(level, shown * 0.8);
      if (bar.current) bar.current.style.transform = `scaleX(${shown})`;
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analyser]);
  return (
    <span
      aria-hidden
      data-level
      className="relative h-1.5 w-8 overflow-hidden rounded-full bg-current/20"
    >
      <span
        ref={bar}
        className="absolute inset-0 origin-left bg-current"
        style={{ transform: "scaleX(0)" }}
      />
    </span>
  );
}
