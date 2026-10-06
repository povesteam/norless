import {
  Bluetooth,
  Mic,
  Piano,
  Share2,
  SlidersVertical,
  Square,
} from "lucide-react";
import { Button, Dropdown, Label } from "@heroui/react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LiveChord } from "../../server/live/live-chord";
import type { Heard } from "../../shared/music/chord-detect";
import type { Key } from "../../shared/music/chords";
import { chordColors } from "../../shared/music/music";
import {
  useBluetoothMidi,
  useHeardChord,
  useHeldChord,
  useMidi,
} from "./chord-input";
import { ChordWheel } from "./ChordWheel";
import { live } from "../data/connection";
import { send } from "../data/fetch";
import {
  InputDialog,
  StartWithInput,
  useInputChoice,
} from "../stage/InputChoice";
import { useJoinedRoom } from "../data/room";
import { ChordName } from "../songs/SongText";
import { Tip } from "../ui/tip";

/** Remembered per device: the piano is used here, so it connects with the Chords mode. */
const PIANO = "norless:piano";
const remembered = () => {
  try {
    return localStorage.getItem(PIANO) === "1";
  } catch {
    return false;
  }
};
const remember = (on: boolean) => {
  try {
    if (on) localStorage.setItem(PIANO, "1");
    else localStorage.removeItem(PIANO);
  } catch {
    // Asked again next time.
  }
};

/** A MIDI piano by cable or Bluetooth, while `on`: the chord held, and each one played. */
export function usePiano(
  on: boolean,
  key: Key | null,
  onPlayed?: (chord: string) => void,
) {
  const held = useHeldChord(key, onPlayed);
  const cable = useMidi(on, held.feed);
  const wireless = useBluetoothMidi(on, held.feed);
  return { chord: on ? held.chord : null, cable, wireless, take: held.take };
}

/** What a piano's or Bluetooth piano's state says, for the line under the buttons. */
function useInputLine() {
  const { t } = useTranslation();
  return (piano: ReturnType<typeof usePiano>, listening: boolean): string => {
    const { cable, wireless } = piano;
    if (wireless.state === "ready")
      return t("detect.bluetoothOn", { name: wireless.name ?? "" });
    if (cable.state === "ready")
      return t("detect.pianoOn", { name: cable.inputs.join(", ") });
    if (cable.state === "unsupported")
      return listening ? "" : t("detect.noMidi");
    if (cable.state === "denied") return t("detect.denied");
    if (cable.state === "waiting") return t("detect.plugIn");
    return "";
  };
}

/**
 * The Chords mode's way to play chords in: a piano by cable or
 * Bluetooth, which connects when the Chords mode opens once it was used on the device,
 * and listening through a microphone or the mixer. A chord played on the piano goes over
 * the letter tapped when the keys are let go; a chord heard is offered in the picker.
 */
export function PlayPanel({
  songKey,
  piano: canPiano,
  listen: canListen,
  onPlayed,
  onHeard,
  onTake,
}: {
  songKey: Key | null;
  piano: boolean;
  listen: boolean;
  onPlayed: (chord: string) => void;
  /** Gets a way to take the chord held on the piano now, which then isn't played on letting go. */
  onTake?: (take: (() => string | null) | null) => void;
  /** What's heard, null in silence; undefined while not listening. */
  onHeard: (heard: Heard | null | undefined) => void;
}) {
  const { t } = useTranslation();
  const [pianoOn, setPianoOn] = useState(() => canPiano && remembered());
  const piano = usePiano(pianoOn, songKey, onPlayed);
  const offer = useEffectEvent(() => onTake?.(pianoOn ? piano.take : null));
  useEffect(() => offer(), [pianoOn]);
  const [input, setInput] = useState<{ deviceId: string | null } | null>(null);
  const { heard, state: heardState } = useHeardChord(
    !!input,
    input?.deviceId ?? null,
    songKey,
  );
  const report = useEffectEvent(onHeard);
  useEffect(() => report(input ? heard : undefined), [heard, input]);
  const choice = useInputChoice("chords", async (deviceId) => {
    setInput({ deviceId });
    return true;
  });
  const line = useInputLine()(piano, !!input);
  const chord = piano.chord ?? heard?.name ?? null;
  const togglePiano = () => {
    remember(!pianoOn);
    setPianoOn(!pianoOn);
  };
  return (
    <section
      aria-label={t("detect.title")}
      className="flex flex-wrap items-start gap-4 rounded-xl border border-separator p-3"
    >
      <div className="flex min-w-60 flex-1 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {canPiano && (
            <Button
              size="sm"
              variant={pianoOn ? "primary" : "secondary"}
              onPress={togglePiano}
            >
              <Piano />
              {pianoOn ? t("detect.pianoStop") : t("detect.piano")}
            </Button>
          )}
          {canPiano && pianoOn && piano.wireless.state !== "unsupported" && (
            <Button
              size="sm"
              variant="secondary"
              onPress={() => void piano.wireless.connect()}
            >
              <Bluetooth />
              {t("detect.bluetooth")}
            </Button>
          )}
          {canListen &&
            (input ? (
              <Button
                size="sm"
                variant="primary"
                onPress={() => setInput(null)}
              >
                <Square />
                {t("detect.listenStop")}
              </Button>
            ) : (
              <StartWithInput
                chooseLabel={t("detect.chooseInput")}
                onStart={() => void choice.begin()}
                onChoose={choice.choose}
              >
                <Mic />
                {t("detect.listen")}
              </StartWithInput>
            ))}
        </div>
        {/* Always one line: nothing moves when a piano comes or goes. */}
        <p className="min-h-5 text-sm text-muted" aria-live="polite">
          {heardState === "denied" ? t("detect.denied") : line}
        </p>
        <p className="text-sm text-muted">{t("detect.how")}</p>
        <p
          aria-label={t("detect.playing")}
          className={`min-h-10 text-3xl font-bold ${chord ? "" : "text-muted"}`}
        >
          {chord ?? "–"}
        </p>
      </div>
      <ChordWheel
        songKey={songKey}
        chord={chord}
        scores={piano.chord ? undefined : heard?.scores}
        className="w-48"
      />
      {choice.choosing && (
        <InputDialog
          initial={choice.remembered}
          failed={choice.failed}
          title={t("detect.chooseInput")}
          help={t("detect.inputHelp")}
          startLabel={t("detect.listen")}
          startIcon={<Mic />}
          onStart={choice.chosen}
          onClose={choice.close}
        />
      )}
    </section>
  );
}

/** The chord played live in the community, or its practice room: the best source's. */
export function useLiveChord(slug: string) {
  const room = useJoinedRoom(slug);
  const [chord, setChord] = useState<LiveChord | null>(null);
  useEffect(
    () =>
      live.subscribe(`live-chord:${room ? `${slug}/${room}` : slug}`, (data) =>
        setChord(data as LiveChord | null),
      ),
    [slug, room],
  );
  return chord;
}

type Source = "midi" | "mixer" | "mic";

/**
 * For the team in the musicians view: sharing the chords played here with the other
 * musicians, from a MIDI piano, the mixer or a microphone. The best
 * source of all the devices sharing is shown: MIDI, then the mixer, then a microphone.
 */
export function ShareChords({
  slug,
  songKey,
}: {
  slug: string;
  songKey: Key | null;
}) {
  const { t } = useTranslation();
  const room = useJoinedRoom(slug);
  const [source, setSource] = useState<Source | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<Source | null>(null);
  const piano = usePiano(source === "midi", songKey);
  const { heard } = useHeardChord(
    source === "mixer" || source === "mic",
    deviceId,
    songKey,
  );
  const chord = source === "midi" ? piano.chord : (heard?.name ?? null);
  const url = `/api/communities/${slug}/live/chord`;
  const post = (body: object) =>
    void send("POST", url, { ...(room ? { room } : {}), ...body });

  // Each change goes at once; the same chord every 5 seconds says this device still shares.
  const last = useRef<{ chord: string | null; at: number }>({
    chord: null,
    at: 0,
  });
  const share = useEffectEvent(() => {
    if (!source) return;
    const now = Date.now();
    if (chord === last.current.chord && now - last.current.at < 5000) return;
    last.current = { chord, at: now };
    post({ sharing: true, source, chord });
  });
  useEffect(() => {
    if (!source) return;
    share();
    const timer = setInterval(share, 1000);
    return () => clearInterval(timer);
  }, [source, chord]);

  const stop = () => {
    setSource(null);
    post({ sharing: false });
  };
  // Leaving the page stops sharing.
  const leave = useEffectEvent(() => {
    if (source) post({ sharing: false });
  });
  useEffect(
    () => () => {
      leave();
    },
    [],
  );

  if (source)
    return (
      <Button size="sm" variant="primary" onPress={stop}>
        <Square />
        {t("detect.shareStop", { chord: chord ?? "–" })}
      </Button>
    );
  return (
    <>
      <Dropdown>
        <Tip label={t("detect.share")}>
          <Button
            size="sm"
            variant="secondary"
            isIconOnly
            aria-label={t("detect.share")}
          >
            {/* Not the live chord layout's icon, beside it. */}
            <Share2 />
          </Button>
        </Tip>
        <Dropdown.Popover>
          <Dropdown.Menu
            aria-label={t("detect.share")}
            onAction={(key) => {
              const chosen = key as Source;
              if (chosen === "midi") setSource("midi");
              else setChoosing(chosen);
            }}
          >
            <Dropdown.Item id="midi" textValue={t("detect.fromPiano")}>
              <Piano />
              <Label>{t("detect.fromPiano")}</Label>
            </Dropdown.Item>
            <Dropdown.Item id="mixer" textValue={t("detect.fromMixer")}>
              <SlidersVertical />
              <Label>{t("detect.fromMixer")}</Label>
            </Dropdown.Item>
            <Dropdown.Item id="mic" textValue={t("detect.fromMic")}>
              <Mic />
              <Label>{t("detect.fromMic")}</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      {choosing && (
        <InputDialog
          failed={false}
          title={t(
            choosing === "mixer" ? "detect.fromMixer" : "detect.fromMic",
          )}
          help={t("detect.inputHelp")}
          startLabel={t("detect.share")}
          startIcon={<Share2 />}
          onStart={async (id) => {
            setDeviceId(id);
            setSource(choosing);
            setChoosing(null);
          }}
          onClose={() => setChoosing(null)}
        />
      )}
    </>
  );
}

/**
 * The musicians view's Live chord layout: the chord played now, big, in the member's
 * chord colors, with where it came from and the wheel.
 */
export function LiveChordView({
  slug,
  songKey,
}: {
  slug: string;
  songKey: Key | null;
}) {
  const { t } = useTranslation();
  const chord = useLiveChord(slug);
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {chord ? (
        <>
          <p
            aria-label={t("detect.playing")}
            className="min-h-[1.2em] text-8xl font-bold"
          >
            {chord.chord ? (
              <ChordName
                name={chord.chord}
                colors={chordColors(chord.chord, songKey)}
              />
            ) : (
              "–"
            )}
          </p>
          <p className="text-sm text-muted">
            {t(`detect.from.${chord.source}`, { name: chord.name })}
          </p>
        </>
      ) : (
        <p className="max-w-md text-center text-muted">{t("detect.nobody")}</p>
      )}
      <ChordWheel
        songKey={songKey}
        chord={chord?.chord ?? null}
        className="w-72 max-w-full"
      />
    </div>
  );
}
