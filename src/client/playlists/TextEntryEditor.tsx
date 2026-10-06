import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  TextArea,
  TextField,
} from "@heroui/react";
import { Save, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Entry } from "../../server/playlists/playlists";
import { parseMinutes } from "../../shared/minutes";
import { useShows } from "../data/community";
import { ActionButton, usePending } from "../ui/states";

/** Planned minutes as people say them: 45 min, 1 h, 1 h 30 min. */
export function useDuration() {
  const { t } = useTranslation();
  return (total: number) => {
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return hours === 0
      ? t("playlist.minutes", { count: minutes })
      : minutes === 0
        ? t("playlist.hours", { hours })
        : t("playlist.duration", { hours, minutes });
  };
}

/** Edits a text slide's Markdown or a divider's heading, and its planned minutes. */
export function TextEntryEditor({
  entry,
  kind = "text",
  onSave,
  onClose,
}: {
  /** null for a new entry of `kind`. */
  entry: Entry | null;
  kind?: "text" | "divider";
  onSave: (text: string, plannedMinutes: number | null) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const shows = useShows();
  // A slides entry's title is one line, like a divider's.
  const slides = entry?.kind === "slides";
  const divider = (entry?.kind ?? kind) === "divider" || slides;
  const [text, setText] = useState(entry?.text ?? "");
  const duration = useDuration();
  // Typed as people write it: 45, 1h30, 1:30; empty for none.
  const [planned, setPlanned] = useState(
    entry?.plannedMinutes ? duration(entry.plannedMinutes) : "",
  );
  const minutes = planned.trim() ? parseMinutes(planned) : null;
  const badMinutes = !!planned.trim() && minutes === null;
  const [save, saving] = usePending(async () => {
    if (await onSave(text, minutes)) onClose();
  });

  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>
              {t(
                slides
                  ? "slides.rename"
                  : !entry && divider
                    ? "playlist.addDivider"
                    : divider
                      ? "playlist.editDivider"
                      : "playlist.editText",
              )}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <TextField value={text} onChange={setText} isRequired>
              <Label>
                {t(
                  slides
                    ? "slides.title"
                    : divider
                      ? "playlist.heading"
                      : "playlist.markdown",
                )}
              </Label>
              {divider ? (
                <Input autoFocus />
              ) : (
                <TextArea rows={5} className="field-sizing-content" autoFocus />
              )}
            </TextField>
            {shows("times") && (
              <TextField
                value={planned}
                onChange={setPlanned}
                isInvalid={badMinutes}
              >
                <Label>{t("playlist.plannedTime")}</Label>
                <Input inputMode="numeric" />
                <Description>{t("playlist.plannedTimeHelp")}</Description>
                <FieldError>{t("playlist.plannedTimeInvalid")}</FieldError>
              </TextField>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            <ActionButton
              isPending={saving}
              isDisabled={!text.trim() || badMinutes}
              onPress={() => void save()}
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
