import {
  Button,
  Chip,
  Description,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import {
  Download,
  FileImage,
  FileUp,
  Play,
  RotateCcw,
  Square,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Entry } from "../../server/playlists/playlists";
import { useCommunity } from "../data/community";
import { send } from "../data/fetch";
import { sendLive, useLiveView } from "../data/room";
import { SlidePage } from "../screens/SlidePage";
import { LanguageMark } from "../ui/icons";
import { ActionButton } from "../ui/states";
import type { EntryAction } from "./EntryActions";

/*
 * Slides from files in a playlist: adding them, how a slides entry's
 * row shows its files, and its menu's actions.
 */

/**
 * What the file picker offers: PDFs and pictures, and presentations too, so picking one
 * says how to add it, as a PDF exported from it.
 */
export const slideTypes =
  ".pdf,.png,.jpg,.jpeg,.webp,.pptx,.ppt,.ppsx,.pps,.odp,.key";
const accepted = /\.(pdf|png|jpe?g|webp)$/i;
const presentation = /\.(pptx?|ppsx?|odp|key)$/i;

/** The files of a drop or a pick that can be slides. */
export const slideFilesIn = (files: FileList | File[] | null) =>
  [...(files ?? [])].filter((f) => accepted.test(f.name));

/** How to add a presentation, shown when a drop or a pick held one. */
function usePdfHint() {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  /** Whether the files held a presentation, which shows the hint. */
  const check = (files: FileList | null) => {
    const held = [...(files ?? [])].some((f) => presentation.test(f.name));
    setShown(held);
    return held;
  };
  const hint = shown && (
    <div
      role="status"
      className="fixed inset-x-0 bottom-24 z-30 mx-auto flex w-fit max-w-[min(32rem,calc(100%-2rem))] items-start gap-3 rounded-xl bg-foreground px-4 py-3 text-background shadow-lg"
    >
      <p className="text-sm">{t("slides.asPdf")}</p>
      <Button size="sm" variant="secondary" onPress={() => setShown(false)}>
        <X />
        {t("slides.closeHint")}
      </Button>
    </div>
  );
  return [hint, check] as const;
}

const formOf = (files: File[]) => {
  const form = new FormData();
  for (const file of files) form.append("file", file, file.name);
  return form;
};

/** Uploads files as new slides entries, after `after` (a drop) or at the end. */
export async function addSlides(
  playlistUrl: string,
  files: File[],
  after?: string,
) {
  const query = after ? `?after=${encodeURIComponent(after)}` : "";
  const response = await fetch(`${playlistUrl}/slides${query}`, {
    method: "POST",
    body: formOf(files),
  }).catch(() => null);
  return response?.ok ?? false;
}

/** "Slides from a file" beside "Add text slide": the file picker. */
export function SlidesButton({
  onFiles,
}: {
  onFiles: (files: File[]) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [hint, checkForPresentations] = usePdfHint();
  return (
    <>
      {hint}
      <ActionButton
        variant="secondary"
        isPending={busy}
        onPress={() => input.current?.click()}
      >
        <FileImage />
        {t("slides.add")}
      </ActionButton>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={slideTypes}
        aria-label={t("slides.add")}
        onChange={(event) => {
          const files = slideFilesIn(event.currentTarget.files);
          checkForPresentations(event.currentTarget.files);
          event.currentTarget.value = "";
          if (!files.length) return;
          setBusy(true);
          void onFiles(files).finally(() => setBusy(false));
        }}
      />
    </>
  );
}

/** A slides entry's first page, where other entries show their icon. */
export function SlidesThumb({ entry }: { entry: Entry }) {
  return (
    <SlidePage
      files={entry.slides?.files ?? []}
      languages={[]}
      slide={0}
      sizes="48px"
      className="h-6 w-11 shrink-0 rounded-sm bg-black"
    />
  );
}

/** What a slides entry's row says: its pages, how far it is, a failure with Retry. */
export function SlidesChips({ entry }: { entry: Entry }) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const files = entry.slides?.files ?? [];
  const main = files.find((f) => f.language === null);
  return (
    <>
      {main?.state === "ready" && (
        <Chip size="sm" variant="secondary">
          {t("slides.pages", { count: main.total ?? 0 })}
        </Chip>
      )}
      {files.map(
        (file) =>
          file.state === "preparing" && (
            <Chip key={file.id} size="sm" variant="soft">
              {file.language && <LanguageMark language={file.language} />}
              {t("slides.preparing", {
                pages: file.pages,
                total: file.total ?? "…",
              })}
            </Chip>
          ),
      )}
      {files.map(
        (file) =>
          file.state === "failed" && (
            <span key={file.id} className="flex items-center gap-1">
              <Chip size="sm" color="danger" variant="soft">
                {file.language && <LanguageMark language={file.language} />}
                {file.error ?? t("slides.failed")}
              </Chip>
              <Button
                size="sm"
                variant="ghost"
                onPress={() =>
                  void send(
                    "POST",
                    `/api/communities/${slug}/slide-files/${file.id}/retry`,
                  )
                }
              >
                <RotateCcw />
                {t("states.tryAgain")}
              </Button>
            </span>
          ),
      )}
      {files.map(
        (file) =>
          file.language &&
          file.state === "ready" && (
            <Chip key={file.id} size="sm" variant="soft">
              <LanguageMark language={file.language} />
            </Chip>
          ),
      )}
    </>
  );
}

/** A slides entry's actions in its menu, and the dialogs they open. */
export function useSlideActions(playlistUrl: string) {
  const { t, i18n } = useTranslation();
  const community = useCommunity();
  const view = useLiveView(community.slug);
  const picker = useRef<HTMLInputElement>(null);
  const [language, setLanguage] = useState<{
    entry: Entry;
    language: string;
  } | null>(null);
  const [timing, setTiming] = useState<Entry | null>(null);
  const [hint, checkForPresentations] = usePdfHint();
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  const nameOf = (l: string) => names.of(l) ?? l;

  const actionsOf = (entry: Entry): EntryAction[] => {
    const files = entry.slides?.files ?? [];
    const main = files.find((f) => f.language === null);
    const running = view?.timer?.entryId === entry.id;
    // A file for each language but the first, whose screens show the main file.
    const others = community.languages.slice(1);
    return [
      ...others.flatMap((l): EntryAction[] => {
        const own = files.find((f) => f.language === l);
        return [
          {
            id: `file-${l}`,
            label: t(own ? "slides.replaceFor" : "slides.addFor", {
              language: nameOf(l),
            }),
            icon: <FileUp />,
            run: () => {
              setLanguage({ entry, language: l });
              picker.current?.click();
            },
          },
          ...(own
            ? [
                {
                  id: `remove-${l}`,
                  label: t("slides.removeFor", { language: nameOf(l) }),
                  icon: <Trash2 />,
                  run: () =>
                    void send(
                      "DELETE",
                      `${playlistUrl}/entries/${entry.id}/slides/${l}`,
                    ),
                },
              ]
            : []),
        ];
      }),
      running
        ? {
            id: "timer-stop",
            label: t("slides.stopTimer"),
            icon: <Square />,
            run: () =>
              void sendLive(community.slug, {
                type: "timer",
                entryId: entry.id,
                seconds: null,
              }),
          }
        : {
            id: "timer",
            label: t("slides.timer"),
            icon: <Timer />,
            disabled: main?.state !== "ready",
            run: () => setTiming(entry),
          },
      ...(main && main.kind !== "pictures"
        ? [
            {
              id: "download",
              label: t("slides.download"),
              icon: <Download />,
              run: () => {
                window.location.href = `/api/communities/${community.slug}/slide-files/${main.id}/original`;
              },
            },
          ]
        : []),
    ];
  };

  const element = (
    <>
      {hint}
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        accept={slideTypes}
        aria-label={t("slides.add")}
        onChange={(event) => {
          const files = slideFilesIn(event.currentTarget.files);
          checkForPresentations(event.currentTarget.files);
          event.currentTarget.value = "";
          if (!files.length || !language) return;
          void fetch(
            `${playlistUrl}/entries/${language.entry.id}/slides/${language.language}`,
            { method: "PUT", body: formOf(files) },
          ).catch(() => null);
        }}
      />
      {timing && (
        <TimerDialog
          entry={timing}
          onStart={(seconds) =>
            void sendLive(community.slug, {
              type: "timer",
              entryId: timing.id,
              seconds,
            })
          }
          onClose={() => setTiming(null)}
        />
      )}
    </>
  );
  return { actionsOf, element };
}

/** "Next page every … seconds", looping, until anything moves live. */
function TimerDialog({
  entry,
  onStart,
  onClose,
}: {
  entry: Entry;
  onStart: (seconds: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [seconds, setSeconds] = useState(String(entry.slides?.seconds ?? 8));
  const value = Number(seconds);
  const valid = Number.isInteger(value) && value >= 3 && value <= 120;
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("slides.timer")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <TextField
              value={seconds}
              onChange={setSeconds}
              isInvalid={!valid}
              autoFocus
            >
              <Label>{t("slides.seconds")}</Label>
              <Input inputMode="numeric" />
              <Description>{t("slides.timerHelp")}</Description>
            </TextField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            <Button
              isDisabled={!valid}
              onPress={() => {
                onStart(value);
                onClose();
              }}
            >
              <Play />
              {t("slides.startTimer")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * Files dropped onto the playlist become slides entries where they land, after the
 * entry under them. Caught before the sortable list, which would take the drop for a
 * reorder; a ring inside shows where, so nothing moves while files are dragged over.
 */
export function FileDrop({
  enabled,
  onFiles,
  children,
}: {
  enabled: boolean;
  onFiles: (files: File[], after?: string) => Promise<unknown>;
  children: React.ReactNode;
}) {
  const [dropping, setDropping] = useState(false);
  const [hint, checkForPresentations] = usePdfHint();
  return (
    <div
      onDragOverCapture={(event) => {
        if (!enabled || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.stopPropagation();
        setDropping(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setDropping(false);
      }}
      onDropCapture={(event) => {
        setDropping(false);
        if (!enabled) return;
        const files = slideFilesIn(event.dataTransfer.files);
        if (!checkForPresentations(event.dataTransfer.files) && !files.length)
          return;
        event.preventDefault();
        event.stopPropagation();
        if (!files.length) return;
        const after = (event.target as Element)
          .closest("[data-entry]")
          ?.getAttribute("data-entry");
        void onFiles(files, after ?? undefined);
      }}
      className={`rounded-xl ${dropping ? "ring-2 ring-accent ring-inset" : ""}`}
    >
      {hint}
      {children}
    </div>
  );
}
