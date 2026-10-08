import { ArrowUpDown, Pin, Save, Undo2, X } from "lucide-react";
import { Alert, Button, Modal } from "@heroui/react";
import { useLayoutEffect, useRef, useState } from "react";
import { Label as AriaLabel, Radio, RadioGroup } from "react-aria-components";
import { useTranslation } from "react-i18next";
import type { Entry } from "../../server/playlists/playlists";
import type { Song } from "../../server/songs/songs";
import { mapChords } from "../../shared/music/chord-track";
import { keyOf, type Key } from "../../shared/music/chords";
import { halfSteps, playedKey, playedText } from "../../shared/music/music";
import { transposeBlocks } from "../chords/abc";
import { send } from "../data/fetch";
import { ActionButton, usePending } from "../ui/states";

const MAJOR = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
const name = (key: Key) => `${key.tonic}${key.minor ? "m" : ""}`;

/** The keys a song can move to: the 12 of its mode, or all 24 when its key doesn't parse. */
function keysFor(songKey: Key | null): Key[] {
  const major = MAJOR.map((tonic) => ({ tonic, minor: false }));
  const minor = MINOR.map((tonic) => ({ tonic, minor: true }));
  if (!songKey) return [...major, ...minor];
  return songKey.minor ? minor : major;
}

/** Whether two written keys are the same key, e.g. "Re" and "D". */
function sameKey(a: string, b: string) {
  const x = keyOf(a);
  const y = keyOf(b);
  return !!x && !!y && x.minor === y.minor && halfSteps(x, y) === 0;
}

/** "up 3 half steps", "down 2 half steps" or "the song's key". */
export function useKeyChange() {
  const { t } = useTranslation();
  return (from: Key | null, to: Key | null) => {
    if (!from || !to) return "";
    const steps = halfSteps(from, to);
    return steps === 0
      ? t("keys.same")
      : t(steps > 0 ? "keys.up" : "keys.down", { count: Math.abs(steps) });
  };
}

/**
 * Changes a song's key for good: its chords move, in the track every language shares,
 * then the key. The track it started from goes along, so someone else's change in
 * between isn't lost.
 */
export async function changeSongKey(
  slug: string,
  songId: string,
  key: string,
): Promise<boolean> {
  const response = await fetch(
    `/api/communities/${slug}/songs/${songId}`,
  ).catch(() => null);
  if (!response?.ok) return false;
  const song = (await response.json()) as Song;
  const { semitones } = playedKey(song.keySignature, key);
  const moveRow = (row: string) => playedText(row, song.keySignature, key);
  const chords = mapChords(
    song.music,
    (name) => moveRow(`.${name}`).slice(1).trim() || name,
    moveRow,
  );
  // Notation blocks move with the chords.
  const blocks = (raw: string) => transposeBlocks(raw, semitones);
  const music = await Promise.all([
    Promise.all(
      Object.entries(chords.sections).map(async ([k, section]) => [
        k,
        section.extras
          ? {
              ...section,
              extras: await Promise.all(
                section.extras.map(async (e) => ({
                  ...e,
                  raw: await blocks(e.raw),
                })),
              ),
            }
          : section,
      ]),
    ),
    Promise.all(
      chords.parts.map(async (p) => ({ ...p, text: await blocks(p.text) })),
    ),
  ])
    .then(([sections, parts]) => ({
      ...chords,
      sections: Object.fromEntries(sections) as typeof chords.sections,
      parts,
    }))
    .catch(() => null);
  if (!music) return false;
  const saved = await send(
    "PUT",
    `/api/communities/${slug}/songs/${songId}/key`,
    { keySignature: key, base: song.music, music },
  );
  return !!saved?.ok;
}

/**
 * The keys on a wheel: a strip that scrolls sideways and snaps the key under its middle,
 * the song's key in the middle and each key with how far it moves (+2, −3). A tap, the
 * arrow keys, a swipe or a drag with the mouse chooses; the chosen key glides to the
 * middle. Only the strip moves, never the dialog or the page.
 */
function KeyWheel({
  songKey,
  value,
  onChange,
  label,
}: {
  songKey: string;
  value: string;
  onChange: (key: string) => void;
  label: string;
}) {
  const from = keyOf(songKey);
  const keys = from
    ? keysFor(from).sort((a, b) => halfSteps(from, a) - halfSteps(from, b))
    : keysFor(null);
  const strip = useRef<HTMLDivElement>(null);
  // Where the strip's middle is on the chosen key.
  const centered = () => {
    const box = strip.current;
    const item = box?.querySelector<HTMLElement>("[data-selected]");
    return box && item
      ? item.offsetLeft + item.offsetWidth / 2 - box.clientWidth / 2
      : 0;
  };
  // Opened on the chosen key at once; later choices glide there.
  const opened = useRef(false);
  useLayoutEffect(() => {
    strip.current?.scrollTo({
      left: centered(),
      behavior: opened.current ? "smooth" : "instant",
    });
    opened.current = true;
  }, [value]);
  // A swipe or a drag that stops chooses the key under the middle.
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onScroll = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const box = strip.current;
      if (!box || drag.current) return;
      const middle = box.getBoundingClientRect().left + box.clientWidth / 2;
      let nearest: HTMLElement | undefined;
      let distance = Infinity;
      for (const item of box.querySelectorAll<HTMLElement>("[data-key]")) {
        const rect = item.getBoundingClientRect();
        const off = Math.abs(rect.left + rect.width / 2 - middle);
        if (off < distance) [nearest, distance] = [item, off];
      }
      const key = nearest?.dataset.key;
      if (key && key !== value) onChange(key);
      // Already chosen: back to its middle.
      else box.scrollTo({ left: centered(), behavior: "smooth" });
    }, 150);
  };
  // A mouse drags the strip as a finger does; a drag isn't a tap on the key under it.
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragged = useRef(false);
  return (
    <RadioGroup
      value={value}
      // The release of a drag isn't a tap on the key under it.
      onChange={(key) => dragged.current || onChange(key)}
      orientation="horizontal"
      className="flex flex-col gap-2"
    >
      <AriaLabel className="text-sm font-medium">{label}</AriaLabel>
      <div className="relative">
        {/* The marker the chosen key sits under. */}
        <span
          aria-hidden
          className="absolute start-1/2 -top-1 size-2 -translate-x-1/2 rotate-45 bg-accent"
        />
        <div
          ref={strip}
          onScroll={onScroll}
          // In the capture phase: the keys' presses stop their pointer events.
          onPointerDownCapture={(event) => {
            if (event.pointerType !== "mouse" || event.button !== 0) return;
            drag.current = {
              x: event.clientX,
              left: strip.current?.scrollLeft ?? 0,
              moved: false,
            };
          }}
          onPointerMoveCapture={(event) => {
            const start = drag.current;
            if (!start || !strip.current) return;
            const dx = event.clientX - start.x;
            if (!start.moved && Math.abs(dx) < 5) return;
            if (!start.moved) {
              start.moved = true;
              setDragging(true);
              strip.current.setPointerCapture(event.pointerId);
            }
            strip.current.scrollLeft = start.left - dx;
          }}
          onPointerUpCapture={() => {
            const start = drag.current;
            drag.current = null;
            if (!start?.moved) return;
            // The nearest key is chosen once the strip stops.
            dragged.current = true;
            setTimeout(() => (dragged.current = false));
            setDragging(false);
            onScroll();
          }}
          className={`relative flex gap-2 overflow-x-auto px-[calc(50%-2rem)] py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            dragging ? "cursor-grabbing select-none" : "snap-x snap-mandatory"
          }`}
        >
          {keys.map((key) => {
            const steps = from ? halfSteps(from, key) : 0;
            return (
              <Radio
                key={name(key)}
                value={name(key)}
                data-key={name(key)}
                className="flex w-16 shrink-0 cursor-pointer snap-center flex-col items-center rounded-xl border-2 border-separator py-2 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus data-[selected]:border-accent data-[selected]:bg-accent-soft"
              >
                <span className="text-xl font-semibold">{name(key)}</span>
                {from && (
                  <span className="text-xs text-muted tabular-nums">
                    {steps > 0 ? `+${steps}` : steps < 0 ? `−${-steps}` : "0"}
                  </span>
                )}
              </Radio>
            );
          })}
        </div>
      </div>
    </RadioGroup>
  );
}

/** The key of a song for one service, on its playlist entry, or made the song's key. */
export function ServiceKeyDialog({
  slug,
  playlistId,
  entry,
  onClose,
}: {
  slug: string;
  playlistId: string;
  entry: Entry & { song: NonNullable<Entry["song"]> };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const songKey = entry.song.keySignature;
  const [key, setKey] = useState(
    entry.keySignature ||
      (keyOf(songKey) ? name(keyOf(songKey) as Key) : (MAJOR[0] ?? "C")),
  );
  const [failed, setFailed] = useState(false);
  const patch = (keySignature: string | null) =>
    send(
      "PATCH",
      `/api/communities/${slug}/playlists/${playlistId}/entries/${entry.id}`,
      { keySignature },
    );
  const sameAsSong = sameKey(songKey, key);
  const [save, saving] = usePending(async (keySignature: string | null) => {
    const response = await patch(keySignature);
    setFailed(!response?.ok);
    if (response?.ok) onClose();
  });
  const [makeSongKey, making] = usePending(async () => {
    const ok = await changeSongKey(slug, entry.song.id, key);
    const cleared = ok && (await patch(null));
    setFailed(!ok || !cleared || !cleared.ok);
    if (ok && cleared && cleared.ok) onClose();
  });

  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("keys.forService")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              {songKey
                ? t("keys.songIn", { key: songKey })
                : t("keys.songWithout")}
            </p>
            {failed && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t("keys.notSaved")}</Alert.Title>
                </Alert.Content>
              </Alert>
            )}
            <KeyWheel
              songKey={songKey}
              value={key}
              onChange={setKey}
              label={t("keys.forThisService")}
            />
          </Modal.Body>
          <Modal.Footer className="flex-wrap">
            {entry.keySignature && (
              <Button variant="secondary" onPress={() => void save(null)}>
                <Undo2 />
                {t("keys.useSongKey")}
              </Button>
            )}
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            {/* The two ways to save, alike: for this service, or for good. */}
            <ActionButton
              isPending={saving}
              onPress={() => void save(sameAsSong ? null : key)}
            >
              <Save />
              {t("keys.saveForService")}
            </ActionButton>
            {/* Always there, so the dialog keeps its height as keys are tried. */}
            <ActionButton
              isPending={making}
              isDisabled={sameAsSong}
              onPress={() => void makeSongKey()}
            >
              <Pin />
              {t("keys.makePermanent")}
            </ActionButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Changes a song's key for good, from its page; its chords move along. */
export function SongKeyDialog({
  slug,
  song,
  onChanged,
  onClose,
}: {
  slug: string;
  song: Song;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const from = keyOf(song.keySignature);
  const [key, setKey] = useState(from ? name(from) : "C");
  const [failed, setFailed] = useState(false);
  const [save, saving] = usePending(async () => {
    const ok = await changeSongKey(slug, song.id, key);
    setFailed(!ok);
    if (ok) {
      onChanged();
      onClose();
    }
  });
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("keys.change")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t("keys.changeHelp")}</p>
            {failed && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t("keys.notSaved")}</Alert.Title>
                </Alert.Content>
              </Alert>
            )}
            <KeyWheel
              songKey={song.keySignature}
              value={key}
              onChange={setKey}
              label={t("keys.newKey")}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            <ActionButton isPending={saving} onPress={() => void save()}>
              <ArrowUpDown />
              {t("keys.change")}
            </ActionButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
