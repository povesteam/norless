import { Activity, Square } from "lucide-react";
import { Button } from "@heroui/react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LiveView } from "../../server/live/live-view";
import {
  calm,
  driftStep,
  foldToTarget,
  median,
  type DriftState,
} from "../../shared/music/tempo";
import { send } from "../data/fetch";
import { useJoinedRoom } from "../data/room";
import { useMe } from "../data/me";
import {
  InputDialog,
  Level,
  StartWithInput,
  useInputChoice,
} from "./InputChoice";

type Listening = {
  context: AudioContext;
  stream: MediaStream;
};

/**
 * This device listens for the band's tempo: the beat detector runs
 * here, and only the hint and the measured tempo go to the server, which shows them on
 * stage. Each song's median goes in as a tempo check when it ends.
 */
function useTempoListener(
  slug: string,
  view: LiveView | undefined,
  settings: { percent: number; seconds: number },
) {
  const me = useMe().me?.user?.id;
  const [listening, setListening] = useState(false);
  const [measured, setMeasured] = useState<number | null>(null);
  // What the input hears, for the level beside the tempo.
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const session = useRef<Listening | null>(null);
  const latest = useRef<number | null>(null);
  const state = useRef<DriftState>(calm);
  const readings = useRef<{ songId: string; bpm: number[] }>({
    songId: "",
    bpm: [],
  });
  const sent = useRef<{ drift: string | null; at: number }>({
    drift: null,
    at: 0,
  });
  const url = `/api/communities/${slug}/live/tempo`;
  // The room this device follows: a practice room's tempo is its own.
  const room = useJoinedRoom(slug);
  const inRoom = room ? { room } : {};

  const release = () => {
    const s = session.current;
    s?.stream.getTracks().forEach((track) => track.stop());
    void s?.context.close();
    session.current = null;
  };
  const stopLocally = () => {
    release();
    setListening(false);
    setMeasured(null);
    setAnalyser(null);
  };

  // Another device took over: this one stops listening.
  const listener = view?.tempo?.listenerId;
  const takenOver = listening && !!listener && listener !== me;
  useEffect(() => {
    if (takenOver) release();
  }, [takenOver]);
  const active = listening && !takenOver;

  const songId = view?.song?.id ?? "";
  const target = view?.song?.bpm ?? null;

  // A song ended: its median goes in as a check, with 10 readings at least.
  const report = useEffectEvent(() => {
    const done = readings.current;
    const bpm = median(done.bpm);
    if (done.songId && done.bpm.length >= 10 && bpm !== null)
      void send(
        "POST",
        `/api/communities/${slug}/songs/${done.songId}/tempo-checks`,
        { bpm },
      );
    readings.current = { songId, bpm: [] };
    state.current = calm;
  });
  useEffect(() => {
    if (active) report();
  }, [songId, active]);

  // Once a second: the drift rule over the latest reading, sent when it changes.
  const tick = useEffectEvent(() => {
    const reading = latest.current;
    latest.current = null;
    const at = Date.now();
    // What it hears, as heard; with a target, folded to it as the stage hint uses it.
    if (reading !== null)
      setMeasured(
        Math.round(target === null ? reading : foldToTarget(reading, target)),
      );
    if (reading !== null && target !== null)
      readings.current.bpm.push(foldToTarget(reading, target));
    state.current =
      target === null
        ? calm
        : driftStep(state.current, at, reading, target, settings);
    const drift = state.current.shown;
    const due = drift !== null && at - sent.current.at >= 2000;
    if (drift !== sent.current.drift || due) {
      sent.current = { drift, at };
      void send("POST", url, {
        ...inRoom,
        listening: true,
        drift,
        measured: drift ? (readings.current.bpm.at(-1) ?? null) : null,
      });
    }
  });
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [active]);

  const start = async (deviceId: string | null) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId
        ? { deviceId: { exact: deviceId }, echoCancellation: false }
        : { echoCancellation: false },
    });
    const context = new AudioContext();
    // Created after the microphone's prompt, it may start suspended, hearing nothing.
    await context.resume();
    // Loaded only when a device listens.
    const { createRealtimeBpmAnalyzer } = await import("realtime-bpm-analyzer");
    const analyzer = await createRealtimeBpmAnalyzer(context, {
      continuousAnalysis: true,
      stabilizationTime: 10_000,
    });
    const source = context.createMediaStreamSource(stream);
    source.connect(analyzer.node);
    const meter = context.createAnalyser();
    meter.fftSize = 512;
    source.connect(meter);
    setAnalyser(meter);
    analyzer.on("bpm", (data) => {
      const tempo = data.bpm[0]?.tempo;
      if (tempo) latest.current = tempo;
    });
    session.current = { context, stream };
    readings.current = { songId, bpm: [] };
    state.current = calm;
    sent.current = { drift: null, at: 0 };
    await send("POST", url, { ...inRoom, listening: true });
    setListening(true);
  };
  const stop = async () => {
    stopLocally();
    await send("POST", url, { ...inRoom, listening: false });
  };
  // Leaving the page lets go of the input.
  useEffect(
    () => () => {
      const s = session.current;
      s?.stream.getTracks().forEach((track) => track.stop());
      void s?.context.close();
    },
    [],
  );
  return { listening: active, measured, analyser, start, stop };
}

/** Listen for tempo, choosing the input; while listening, what it hears and Stop. */
export function TempoButton({
  slug,
  view,
  settings = { percent: 4, seconds: 8 },
  compact = false,
}: {
  slug: string;
  view: LiveView | undefined;
  settings?: { percent: number; seconds: number };
  /** An icon until it listens. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { listening, measured, analyser, start, stop } = useTempoListener(
    slug,
    view,
    settings,
  );
  const me = useMe().me?.user?.id;
  const input = useInputChoice("tempo", (deviceId) =>
    start(deviceId).then(
      () => true,
      () => false,
    ),
  );
  // Someone else listens; not this member, whose stop the room hasn't heard yet.
  const other =
    !listening && view?.tempo?.listenerId !== me && view?.tempo?.listener;
  const label = other
    ? t("tempo.listenInstead", { name: other })
    : t("tempo.listen");
  if (listening)
    return (
      <Button size="sm" variant="secondary" onPress={() => void stop()}>
        <Square />
        {analyser && <Level analyser={analyser} />}
        <span className="tabular-nums">
          {t("tempo.listeningAt", { bpm: measured ?? "––" })}
        </span>
      </Button>
    );
  return (
    <>
      <StartWithInput
        chooseLabel={t("tempo.chooseInput")}
        label={compact ? label : undefined}
        onStart={() => void input.begin()}
        onChoose={input.choose}
      >
        <Activity />
        {!compact && label}
      </StartWithInput>
      {input.choosing && (
        <InputDialog
          initial={input.remembered}
          title={t("tempo.listen")}
          help={t("tempo.help")}
          startLabel={t("tempo.start")}
          startIcon={<Activity />}
          failed={input.failed}
          onStart={input.chosen}
          onClose={input.close}
        />
      )}
    </>
  );
}

/**
 * On stage: the band drifts from the song's tempo, with what's measured and the target.
 * Its line is kept while all is well, so nothing moves.
 */
export function TempoHint({ view }: { view: LiveView | undefined }) {
  const { t } = useTranslation();
  const drift = view?.tempo?.drift;
  const target = view?.song?.bpm;
  const shown = drift && target;
  return (
    <p
      role="status"
      className={`flex min-h-[1.5em] items-center font-bold ${shown ? "" : "invisible"}`}
    >
      {shown &&
        t(drift === "fast" ? "tempo.fast" : "tempo.slow", {
          measured: view?.tempo?.measured ?? "?",
          target,
        })}
    </p>
  );
}
