import { Save, X } from "lucide-react";
import { Button, Modal, TextArea, TextField } from "@heroui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Conflict, Song } from "../../server/songs/songs";
import { lyricsIndexOf } from "../../shared/music/chord-track";
import { sectionSource } from "../../shared/song-edit";
import {
  ConflictView,
  SmallSlides,
  UnclosedRepeats,
  useSaveShortcut,
  useUnsavedGuard,
} from "../data/editing";
import { live } from "../data/connection";
import { send } from "../data/fetch";
import { ActionButton, ErrorNotice, usePending } from "../ui/states";

/**
 * Edits one section of a version. Save closes it, Ctrl/Cmd+S saves and keeps it open,
 * and closing with unsaved changes asks first.
 */
export function SectionEditor({
  slug,
  song,
  language,
  index,
  onSaved,
  onClose,
}: {
  slug: string;
  song: Song;
  language: string;
  index: number;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // The section's words: its index among the lyrics' sections, which leave out parts
  // without words.
  const version = song.versions.find((v) => v.language === language);
  const at = version
    ? lyricsIndexOf(version.text, version.lyrics, index)
    : null;
  const [base, setBase] = useState(
    () => (version && at !== null && sectionSource(version.lyrics, at)) || "",
  );
  const [text, setText] = useState(base);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const dirty = text !== base;
  useUnsavedGuard(dirty);

  // Members viewing the song see this section's draft as it's typed.
  // ponytail: after a reconnect, the draft shows again on the next keystroke.
  useEffect(() => {
    live.send({
      type: "editing",
      song: song.id,
      language,
      section: index,
      draft: text,
    });
  }, [song.id, language, index, text]);
  useEffect(
    () => () =>
      live.send({
        type: "editing",
        song: song.id,
        language,
        section: index,
        draft: null,
      }),
    [song.id, language, index],
  );

  const [notSaved, setNotSaved] = useState(false);
  const [save, saving] = usePending(async (baseText = base) => {
    const response = await send(
      "PUT",
      `/api/communities/${slug}/songs/${song.id}/versions/${language}/sections/${at ?? index}`,
      { baseText, text },
    );
    setNotSaved(!response?.ok && response?.status !== 409);
    if (response?.status === 409) {
      setConflict(((await response.json()) as { conflict: Conflict }).conflict);
      return false;
    }
    if (!response?.ok) return false;
    onSaved();
    setConflict(null);
    setBase(text);
    return true;
  });
  useSaveShortcut(() => void save());

  const close = () => {
    if (dirty && !window.confirm(t("editor.discard"))) return;
    onClose();
  };

  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && close()}>
      <Modal.Container size="lg">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("editor.editSection")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            {notSaved && (
              <ErrorNotice
                message={t("editor.notSaved")}
                onRetry={() => void save().then((ok) => ok && onClose())}
              />
            )}
            {conflict && (
              <ConflictView
                theirs={conflict.theirs}
                mine={conflict.mine}
                onKeepMine={() =>
                  void save(conflict.theirs ?? "").then((ok) => ok && onClose())
                }
                onUseTheirs={() => {
                  setBase(conflict.theirs ?? "");
                  setText(conflict.theirs ?? "");
                  setConflict(null);
                }}
              />
            )}
            <TextField
              aria-label={t("editor.text")}
              value={text}
              onChange={setText}
            >
              {/* Chords sit over lyrics by column, so the text is monospace. */}
              <TextArea
                className="min-h-[7lh] field-sizing-content font-mono"
                autoFocus
              />
            </TextField>
            <UnclosedRepeats text={text} />
            <SmallSlides text={text} />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={close}>
              <X />
              {t("editor.close")}
            </Button>
            <ActionButton
              isPending={saving}
              onPress={() => void save().then((ok) => ok && onClose())}
            >
              <Save />
              {t("editor.save")}
            </ActionButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
