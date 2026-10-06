import { Keyboard } from "lucide-react";
import { Button } from "@heroui/react";
import { useEffect, useEffectEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LiveView } from "../../server/live/live-view";
import type { LiveAction } from "../../shared/live";
import { useCommunity, useShows } from "../data/community";
import { useLiveTitle } from "./LiveBar";
import { sendLive } from "../data/room";

const SWITCH = "norless:media-keys";
const actions = ["nexttrack", "previoustrack", "play", "pause"] as const;

/** Ten seconds of silence as a WAV, made once: Chrome ignores media under five seconds. */
let silence: string | null = null;
function silentSound() {
  if (silence) return silence;
  const rate = 8000;
  const size = rate * 10;
  const wav = new DataView(new ArrayBuffer(44 + size));
  const text = (at: number, value: string) =>
    [...value].forEach((c, i) => wav.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  wav.setUint32(4, 36 + size, true);
  text(8, "WAVEfmt ");
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true); // PCM
  wav.setUint16(22, 1, true); // mono
  wav.setUint32(24, rate, true);
  wav.setUint32(28, rate, true);
  wav.setUint16(32, 1, true);
  wav.setUint16(34, 8, true);
  text(36, "data");
  wav.setUint32(40, size, true);
  // 8-bit samples are silent at 128.
  new Uint8Array(wav.buffer, 44).fill(128);
  silence = URL.createObjectURL(new Blob([wav.buffer], { type: "audio/wav" }));
  return silence;
}

/**
 * The media keys switch: while it's on, this device's next and previous
 * track move the slides and play/pause blanks, also from a Bluetooth remote, a phone's
 * lock screen, or while another window has the focus. Browsers give media keys only to a
 * page that plays sound, so a silent one loops; the switch is remembered on the device.
 */
export function MediaKeys({
  view,
  narrow = false,
}: {
  view: LiveView | undefined;
  /** In a full live bar: on a phone, only the icon. */
  narrow?: boolean;
}) {
  const { t } = useTranslation();
  const community = useCommunity();
  const shows = useShows();
  const { live, title, where } = useLiveTitle(view);
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(SWITCH) === "1";
    } catch {
      return false;
    }
  });
  const act = useEffectEvent((action: LiveAction) => {
    void sendLive(community.slug, action, "media-key");
  });
  const supported = "mediaSession" in navigator;

  useEffect(() => {
    if (!on || !supported) return;
    const sound = new Audio(silentSound());
    sound.loop = true;
    const play = () => void sound.play().catch(() => {});
    play();
    // After a reload, browsers play sound only after a tap or a key.
    window.addEventListener("pointerdown", play, { once: true });
    window.addEventListener("keydown", play, { once: true });
    const session = navigator.mediaSession;
    session.setActionHandler("nexttrack", () => act({ type: "next" }));
    session.setActionHandler("previoustrack", () => act({ type: "previous" }));
    session.setActionHandler("pause", () =>
      act({ type: "blank", blank: true }),
    );
    session.setActionHandler("play", () =>
      act({ type: "blank", blank: false }),
    );
    return () => {
      for (const action of actions) session.setActionHandler(action, null);
      window.removeEventListener("pointerdown", play);
      window.removeEventListener("keydown", play);
      sound.pause();
      session.metadata = null;
    };
  }, [on, supported]);

  // The lock screen shows what's live; blank shows as paused, so play/pause shows it again.
  const blank = !!view?.blank;
  useEffect(() => {
    if (!on || !supported) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: live ? title : "Norless",
      artist: live && where !== title ? where : "",
      album: community.name,
    });
    navigator.mediaSession.playbackState = blank ? "paused" : "playing";
  }, [on, supported, live, title, where, blank, community.name]);

  if (!shows("mediaKeys") || !supported) return null;
  return (
    <Button
      size="sm"
      variant={on ? "secondary" : "tertiary"}
      aria-pressed={on}
      onPress={() => {
        setOn(!on);
        try {
          localStorage.setItem(SWITCH, on ? "0" : "1");
        } catch {
          // On until the page reloads.
        }
      }}
    >
      <Keyboard />
      <span className={narrow ? "max-[749px]:sr-only" : undefined}>
        {t("live.mediaKeys")}
      </span>
    </Button>
  );
}
