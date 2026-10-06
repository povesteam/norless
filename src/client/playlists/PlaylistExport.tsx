import { Check, ClipboardCopy, Download, Printer, X } from "lucide-react";
import { Button, Label, Modal, Radio, RadioGroup } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { loadLanguage } from "../app/i18n";
import type { Playlist } from "../../server/playlists/playlists";
import type { Song } from "../../server/songs/songs";
import {
  exportFileName,
  exportHtml,
  exportSong,
  exportText,
} from "../../shared/playlist-export";
import { useCommunity } from "../data/community";
import { LanguageMark } from "../ui/icons";
import { ActionButton, ErrorNotice, usePending } from "../ui/states";
import { pagesOf } from "../../shared/live";
import { playlistName } from "../../shared/playlist-name";

export type ExportKind = "print" | "html" | "copy";

const icons = { print: Printer, html: Download, copy: ClipboardCopy };

/** The export's icon, for the menu and the dialog. */
export const ExportIcon = ({ kind }: { kind: ExportKind }) => {
  const Icon = icons[kind];
  return <Icon />;
};

/** Prints a page in a hidden frame, which goes once printing is done. */
function print(html: string, title: string) {
  document.querySelector("iframe[data-export]")?.remove();
  const frame = document.createElement("iframe");
  frame.dataset.export = "";
  frame.title = title;
  frame.style.cssText = "position:fixed;width:0;height:0;border:0";
  frame.srcdoc = html;
  frame.onload = () => {
    const win = frame.contentWindow;
    win?.addEventListener("afterprint", () => frame.remove());
    win?.print();
  };
  document.body.append(frame);
}

/**
 * Print, Save as HTML or Copy as text: a playlist's songs in a language the reader
 * chooses, the interface language first (playlist-export spec).
 */
export function ExportDialog({
  kind,
  playlist,
  onClose,
}: {
  kind: ExportKind;
  playlist: Playlist;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { slug, languages } = useCommunity();
  const [language, setLanguage] = useState(
    languages.includes(i18n.language) ? i18n.language : (languages[0] ?? "ro"),
  );
  const [state, setState] = useState<"copied" | "failed" | null>(null);
  const [run, running] = usePending(async () => {
    const ids = playlist.entries.flatMap((e) => (e.song ? [e.song.id] : []));
    const songs = await Promise.all(
      ids.map(async (id) => {
        const response = await fetch(
          `/api/communities/${slug}/songs/${id}`,
        ).catch(() => null);
        return response?.ok ? ((await response.json()) as Song) : null;
      }),
    );
    if (songs.includes(null)) return setState("failed");
    const order = [language, ...languages];
    const words = i18n.getFixedT(language);
    // In the playlist's order: songs in full, slides from files by title and pages.
    const exported = playlist.entries.flatMap((entry) => {
      if (entry.kind === "slides")
        return [
          {
            title: `${entry.text ?? ""} (${words("slides.pages", {
              count: pagesOf(entry),
            })})`,
            text: "",
          },
        ];
      const song = entry.song && songs[ids.indexOf(entry.song.id)];
      const one = song && exportSong(song, order);
      return one ? [one] : [];
    });
    const heading = playlistName(playlist, language);
    await loadLanguage(language);
    if (kind === "copy") {
      const copied = await navigator.clipboard
        .writeText(exportText(exported, heading))
        .then(
          () => true,
          () => false,
        );
      return setState(copied ? "copied" : "failed");
    }
    const html = exportHtml(exported, {
      heading,
      language,
      words: {
        contents: words("export.contents"),
        top: words("export.top"),
        theme: words("export.theme"),
      },
    });
    if (kind === "print") print(html, t("export.printFrame"));
    else {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      link.download = exportFileName(playlist);
      link.click();
      URL.revokeObjectURL(link.href);
    }
    onClose();
  });

  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t(`export.${kind}`)}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            {state === "copied" ? (
              <p>{t("export.copied")}</p>
            ) : (
              <>
                <RadioGroup value={language} onChange={setLanguage}>
                  <Label>{t("export.language")}</Label>
                  {languages.map((l) => (
                    <Radio key={l} value={l}>
                      <Radio.Content>
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <LanguageMark language={l} />
                      </Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
                <p className="text-sm text-muted">{t("export.help")}</p>
                {state === "failed" && (
                  <ErrorNotice message={t("states.actionFailed")} />
                )}
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            {state === "copied" ? (
              <Button onPress={onClose}>
                <Check />
                {t("feedback.close")}
              </Button>
            ) : (
              <>
                <Button variant="secondary" onPress={onClose}>
                  <X />
                  {t("feedback.cancel")}
                </Button>
                <ActionButton isPending={running} onPress={() => void run()}>
                  <ExportIcon kind={kind} />
                  {t(`export.${kind}`)}
                </ActionButton>
              </>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
