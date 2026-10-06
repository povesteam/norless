import { Check, Lock, Undo2 } from "lucide-react";
import { Alert, Button } from "@heroui/react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EDIT_LOCK_MS, type SectionEdit } from "../../shared/live";
import { live } from "./connection";
import { useMe } from "./me";
import { slideScale } from "../../shared/song-render";
import { parseSong } from "../../shared/song-text";

/** Ctrl+S or Cmd+S runs `save` instead of the browser's "save page". */
export function useSaveShortcut(save: () => void) {
  // Listening once, so a key between two renders isn't missed, and the browser's
  // "save page" never opens.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s")
      return;
    event.preventDefault();
    save();
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
}

/** Asks before the tab closes or reloads while there are unsaved changes. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}

/** Someone else saved the same text meanwhile: both versions, and a choice. */
export function ConflictView({
  theirs,
  mine,
  onKeepMine,
  onUseTheirs,
}: {
  theirs: string | null;
  mine: string;
  onKeepMine: () => void;
  onUseTheirs: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t("editor.conflict")}</Alert.Title>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="font-bold">{t("editor.theirs")}</p>
            <pre className={codeBlock}>{theirs ?? t("editor.removed")}</pre>
            <Button variant="secondary" onPress={onUseTheirs}>
              <Undo2 />
              {t("editor.useTheirs")}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-bold">{t("editor.mine")}</p>
            <pre className={codeBlock}>{mine}</pre>
            <Button onPress={onKeepMine}>
              <Check />
              {t("editor.keepMine")}
            </Button>
          </div>
        </div>
      </Alert.Content>
    </Alert>
  );
}

const codeBlock =
  "rounded-lg bg-surface-secondary p-2 font-mono text-sm whitespace-pre-wrap [overflow-wrap:anywhere]";

/** Names the sections of `text` with a repeat mark that doesn't close in them. */
export function UnclosedRepeats({ text }: { text: string }) {
  const { t } = useTranslation();
  const sections = useMemo(
    () =>
      parseSong(text)
        .sections.map((s, i) =>
          s.unclosedRepeat ? (s.name ?? `${i + 1}`) : null,
        )
        .filter((name) => name !== null),
    [text],
  );
  if (sections.length === 0) return null;
  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>
          {t("editor.unclosedRepeat", { sections: sections.join(", ") })}
        </Alert.Title>
      </Alert.Content>
    </Alert>
  );
}

/** Names the slides of `text` too long to read on a projector. */
export function SmallSlides({ text }: { text: string }) {
  const { t } = useTranslation();
  const slides = useMemo(
    () =>
      parseSong(text)
        .slides.map((slide, i) =>
          slideScale(
            slide.lines.filter((l) => !l.chordsOnly).map((l) => l.text),
          ) < 0.7
            ? i + 1
            : null,
        )
        .filter((n) => n !== null),
    [text],
  );
  if (slides.length === 0) return null;
  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>
          {t("problems.smallInEditor", { slides: slides.join(", ") })}
        </Alert.Title>
      </Alert.Content>
    </Alert>
  );
}

/**
 * Others editing the song now, on `editing:<song id>`: their edits,
 * kept while they type, with the time to re-render when the last one runs out.
 */
export function useSongEdits(songId: string | null, follow = true) {
  const [edits, setEdits] = useState<SectionEdit[]>([]);
  useEffect(
    () =>
      songId && follow
        ? live.subscribe(`editing:${songId}`, (data) =>
            setEdits(data as SectionEdit[]),
          )
        : undefined,
    [songId, follow],
  );
  // Re-render when the next lock runs out, so the song can be taken over.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const ends = edits.map((e) => Date.parse(e.typedAt) + EDIT_LOCK_MS);
    if (ends.length === 0) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(Math.min(...ends) - now, 0) + 100,
    );
    return () => clearTimeout(timer);
  }, [edits, now]);
  return { edits, now };
}

/**
 * One editor per song: while the song editor or the Chords mode is open,
 * it holds the song; `typed` keeps the hold while typing. Someone else's hold, while
 * they type, is `holder`: then this editor is read-only.
 */
export function useSongLock(
  songId: string | null,
  /** What's typed: each change keeps the hold. */
  typing?: unknown,
) {
  const me = useMe().me?.user?.id;
  const { edits, now } = useSongEdits(songId);
  const holder =
    edits.find(
      (e) => e.userId !== me && now - Date.parse(e.typedAt) < EDIT_LOCK_MS,
    ) ?? null;
  const hold = useEffectEvent(() => {
    if (songId)
      live.send({
        type: "editing",
        song: songId,
        language: "*",
        section: -1,
        draft: "",
      });
  });
  // Hold it when it's free (again), let it go when the editor closes.
  const free = !holder;
  useEffect(() => {
    if (songId && free) hold();
  }, [songId, free]);
  useEffect(
    () => () => {
      if (songId)
        live.send({
          type: "editing",
          song: songId,
          language: "*",
          section: -1,
          draft: null,
        });
    },
    [songId],
  );
  // Typing keeps the hold, at most once every 30 seconds.
  const last = useRef(0);
  const typed = useEffectEvent(() => {
    if (holder || Date.now() - last.current < 30_000) return;
    last.current = Date.now();
    hold();
  });
  const key = JSON.stringify(typing ?? null);
  const opened = useRef(key);
  useEffect(() => {
    if (key !== opened.current) typed();
  }, [key]);
  return { holder };
}

/** Someone else edits the song: this editor is read-only until they're done. */
export function HeldBy({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <Alert status="warning">
      <Alert.Indicator>
        <Lock />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{t("editor.heldBy", { name })}</Alert.Title>
        <Alert.Description>{t("editor.heldByHelp")}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
