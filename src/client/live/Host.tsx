import { Megaphone, Save, X } from "lucide-react";
import {
  Label,
  Modal,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Button,
} from "@heroui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Entry, Playlist } from "../../server/playlists/playlists";
import { useCommunity } from "../data/community";
import { live } from "../data/connection";
import { send, useJson } from "../data/fetch";
import { useIsMember } from "../data/me";
import { useLiveView } from "../data/room";
import { entryTitle } from "../stage/StageMonitor";
import { ActionButton, Empty, ErrorNotice, usePending } from "../ui/states";

/** The host's words of an entry, one text per community language. */
export function HostWordsDialog({
  playlistId,
  entry,
  onClose,
}: {
  playlistId: string;
  entry: Entry;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { slug, languages } = useCommunity();
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  const [words, setWords] = useState<Record<string, string>>(
    entry.hostWords ?? {},
  );
  const [failed, setFailed] = useState(false);
  const [save, saving] = usePending(async () => {
    const response = await send(
      "PATCH",
      `/api/communities/${slug}/playlists/${playlistId}/entries/${entry.id}`,
      { hostWords: words },
    );
    setFailed(!response?.ok);
    if (response?.ok) onClose();
  });
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>
              {t("host.wordsFor", {
                title: entryTitle(entry, [i18n.language, ...languages]),
              })}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t("host.wordsHelp")}</p>
            {languages.map((language, i) => (
              <TextField
                key={language}
                value={words[language] ?? ""}
                onChange={(text) => setWords({ ...words, [language]: text })}
              >
                <Label>
                  {t("host.wordsIn", {
                    language: names.of(language) ?? language,
                  })}
                </Label>
                <TextArea
                  rows={3}
                  maxLength={2000}
                  className="field-sizing-content"
                  autoFocus={i === 0}
                />
              </TextField>
            ))}
            {failed && <ErrorNotice message={t("states.actionFailed")} />}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            <ActionButton isPending={saving} onPress={() => void save()}>
              <Save />
              {t("editor.save")}
            </ActionButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * /<community>/host, for members: what's live with its host's words in large text, and
 * what's next with its words, following the live entry.
 */
export function HostPage() {
  const { t, i18n } = useTranslation();
  const { slug, languages } = useCommunity();
  const member = useIsMember(slug);
  const view = useLiveView(slug);
  const playlistId = view?.playlistId ?? null;
  // The words come with the playlist, for members; saved ones arrive as it changes.
  const [version, setVersion] = useState(0);
  useEffect(
    () =>
      playlistId
        ? live.subscribe(`playlist:${playlistId}`, () =>
            setVersion((n) => n + 1),
          )
        : undefined,
    [playlistId],
  );
  const playlist = useJson<Playlist>(
    member && playlistId
      ? `/api/communities/${slug}/playlists/${playlistId}`
      : null,
    version,
  ).data;
  const [choice, setChoice] = useState(
    languages.includes(i18n.language) ? i18n.language : (languages[0] ?? ""),
  );
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  const nameOf = (l: string) => names.of(l) ?? l;
  if (!member) return <p>{t("host.membersOnly")}</p>;

  const find = (id: string | undefined) =>
    playlist?.entries.find((e) => e.id === id);
  const current = find(view?.entryId ?? undefined);
  const next = find(view?.next?.id);
  const shown = choice === "all" ? languages : [choice];
  const title = (entry: Entry) =>
    entryTitle(entry, [
      ...(choice === "all" ? [] : [choice]),
      i18n.language,
      ...languages,
    ]);
  const words = (entry: Entry, className: string) =>
    shown.map((language) => {
      const text = entry.hostWords?.[language];
      return (
        text && (
          <p key={language} className={`whitespace-pre-wrap ${className}`}>
            {choice === "all" && (
              <span className="me-2 align-middle text-sm font-medium text-muted uppercase">
                {language}
              </span>
            )}
            {text}
          </p>
        )
      );
    });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-2xl font-semibold">
          <Megaphone />
          {t("host.title")}
        </h2>
        {languages.length > 1 && (
          <ToggleButtonGroup
            aria-label={t("song.language")}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[choice]}
            onSelectionChange={(keys) => {
              const [key] = keys;
              if (key !== undefined) setChoice(String(key));
            }}
          >
            {[...languages, "all"].map((l, i) => (
              <ToggleButton key={l} id={l}>
                {i > 0 && <ToggleButtonGroup.Separator />}
                {l === "all" ? t("host.allLanguages") : nameOf(l)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
      </header>
      {current ? (
        <section aria-label={t("host.now")} className="flex flex-col gap-3">
          <p className="text-lg font-semibold">{title(current)}</p>
          {words(current, "text-3xl leading-snug")}
        </section>
      ) : (
        <Empty
          title={t("host.nothingLive")}
          description={t("host.nothingLiveHelp")}
        />
      )}
      {next && (
        <section
          aria-label={t("host.next")}
          className="flex flex-col gap-2 border-t border-separator pt-4 text-muted"
        >
          <p className="font-semibold">
            {t("stage.nextSong", { title: title(next) })}
          </p>
          {words(next, "text-xl")}
        </section>
      )}
    </div>
  );
}
