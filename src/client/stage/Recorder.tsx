import { ArrowRight, Circle, Mic, Square, X } from "lucide-react";
import { Button, Modal } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LiveView } from "../../server/live/live-view";
import { send } from "../data/fetch";
import { InputDialog, StartWithInput, useInputChoice } from "./InputChoice";

/** The formats browsers record, best first: Opus in WebM, AAC in MP4 (Safari). */
const FORMATS = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Session = {
  id: string;
  recorder: MediaRecorder;
  stream: MediaStream;
  queue: Blob[];
  next: number;
  pumping: boolean;
  wakeLock: WakeLockSentinel | null;
};

/**
 * Records from a microphone or another input, uploading a piece every 5 seconds in
 * order, retrying until the server has it, so a dead battery loses a few seconds at most.
 */
export function useRecorder(slug: string) {
  const [state, setState] = useState<
    "idle" | "recording" | "stopping" | "failed"
  >("idle");
  const [since, setSince] = useState<number | null>(null);
  const session = useRef<Session | null>(null);
  const base = `/api/communities/${slug}/recordings`;

  const pump = async (s: Session) => {
    if (s.pumping) return;
    s.pumping = true;
    while (s.queue.length > 0) {
      const piece = s.queue[0];
      if (!piece) break;
      const response = await fetch(`${base}/${s.id}/pieces?piece=${s.next}`, {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: piece,
      }).catch(() => null);
      if (response?.ok) {
        s.queue.shift();
        s.next++;
      } else if (response?.status === 409) {
        // The server knows best which piece it needs; a finished recording takes no more.
        const { expected, status } = (await response.json()) as {
          expected: number;
          status: string;
        };
        if (status !== "recording") s.queue.length = 0;
        else if (expected > s.next) {
          s.queue.splice(0, expected - s.next);
          s.next = expected;
        } else await wait(3000);
      } else await wait(3000);
    }
    s.pumping = false;
  };

  const start = async (deviceId: string | null) => {
    const mimeType = FORMATS.find((f) => MediaRecorder.isTypeSupported(f));
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    });
    const response = await send("POST", base, {
      mime: mimeType ?? "audio/webm",
    });
    if (!response?.ok) {
      stream.getTracks().forEach((track) => track.stop());
      setState("failed");
      return false;
    }
    const { id } = (await response.json()) as { id: string };
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    const s: Session = {
      id,
      recorder,
      stream,
      queue: [],
      next: 0,
      pumping: false,
      wakeLock: null,
    };
    // The screen stays on, so a phone keeps recording; not waited for, as some
    // browsers never answer.
    void navigator.wakeLock
      ?.request("screen")
      .then((lock) => (s.wakeLock = lock))
      .catch(() => null);
    recorder.ondataavailable = (event) => {
      if (event.data.size === 0) return;
      s.queue.push(event.data);
      void pump(s);
    };
    recorder.start(5000);
    session.current = s;
    setSince(Date.now());
    setState("recording");
    return true;
  };

  const stop = async () => {
    const s = session.current;
    if (!s) return;
    setState("stopping");
    await new Promise<void>((resolve) => {
      s.recorder.onstop = () => resolve();
      s.recorder.stop();
    });
    s.stream.getTracks().forEach((track) => track.stop());
    while (s.queue.length > 0 || s.pumping) await wait(200);
    await send("POST", `${base}/${s.id}/stop`);
    void s.wakeLock?.release();
    session.current = null;
    setSince(null);
    setState("idle");
  };

  // Leaving the page stops recording cleanly where it can.
  useEffect(
    () => () => {
      const s = session.current;
      if (s?.recorder.state === "recording") s.recorder.stop();
      s?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  return { state, since, start, stop };
}

/** Minutes and seconds since a time, ticking. */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return (
    <span className="tabular-nums">
      {h > 0 ? `${h}:${String(m).padStart(2, "0")}` : m}:{s}
    </span>
  );
}

const NOTICED = "norless:recording-notice";
/** Whether this device was told, before its first recording, that everyone is recorded. */
const noticed = () => {
  try {
    return localStorage.getItem(NOTICED) === "1";
  } catch {
    return false;
  }
};

/**
 * Before the first recording on a device: everyone in the room is recorded, so tell
 * them first. Continue goes on, and the device doesn't ask again.
 */
function RecordingNotice({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("recordings.noticeTitle")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p>{t("recordings.notice")}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            <Button
              onPress={() => {
                try {
                  localStorage.setItem(NOTICED, "1");
                } catch {
                  // Asked again next time.
                }
                onContinue();
              }}
            >
              <ArrowRight />
              {t("recordings.continue")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Record, with the input chosen once; while recording, the time and Stop. */
export function RecordButton({
  slug,
  big = false,
  compact = false,
}: {
  slug: string;
  big?: boolean;
  /** An icon until it records. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { state, since, start, stop } = useRecorder(slug);
  const input = useInputChoice("record", start);
  // What Record or the input's arrow does once the notice is acknowledged.
  const [then, setThen] = useState<(() => void) | null>(null);
  const afterNotice = (next: () => void) => () =>
    noticed() ? next() : setThen(() => next);
  if (state === "recording" || state === "stopping")
    return (
      <Button
        size={big ? "lg" : "sm"}
        variant="danger"
        isPending={state === "stopping"}
        onPress={() => void stop()}
      >
        <Square />
        {t("recordings.stop")} {since !== null && <Elapsed since={since} />}
      </Button>
    );
  return (
    <>
      <StartWithInput
        big={big}
        chooseLabel={t("recordings.chooseInput")}
        label={compact ? t("recordings.record") : undefined}
        onStart={afterNotice(() => void input.begin())}
        onChoose={afterNotice(input.choose)}
      >
        <Mic />
        {!compact && t("recordings.record")}
      </StartWithInput>
      {then && (
        <RecordingNotice
          onContinue={() => {
            setThen(null);
            then();
          }}
          onClose={() => setThen(null)}
        />
      )}
      {input.choosing && (
        <InputDialog
          initial={input.remembered}
          failed={input.failed}
          onStart={input.chosen}
          onClose={input.close}
        />
      )}
    </>
  );
}

/**
 * On stage screens: that the room is being recorded, and by whom to members. Its line is
 * kept while nothing records, so nothing moves when recording starts.
 */
export function RecordingMark({ view }: { view: LiveView | undefined }) {
  const { t } = useTranslation();
  const recording = view?.recording;
  return (
    <p
      role="status"
      className={`flex h-6 items-center gap-1 text-sm font-semibold ${
        recording ? "" : "invisible"
      }`}
    >
      <Circle className="size-3 fill-current text-danger" />
      {recording?.by
        ? t("recordings.onBy", { name: recording.by })
        : t("recordings.on")}
    </p>
  );
}
