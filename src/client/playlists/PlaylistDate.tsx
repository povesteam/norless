import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { CalendarDays, Save, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionButton, ErrorNotice, usePending } from "../ui/states";

/** The playlist's actions' icon for changing its day. */
export const DateIcon = CalendarDays;

/**
 * Moves the playlist to another day, from its actions: a rare need (a service that moved,
 * a playlist made for the wrong week), so it starts from the playlist's own day.
 */
export function PlaylistDateDialog({
  date,
  onChange,
  onClose,
}: {
  /** Its day, as YYYY-MM-DD. */
  date: string;
  onChange: (date: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [day, setDay] = useState(date);
  const [failed, setFailed] = useState(false);
  const [save, saving] = usePending(async () => {
    const ok = await onChange(day);
    setFailed(!ok);
    if (ok) onClose();
  });
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("playlist.changeDate")}</Modal.Heading>
          </Modal.Header>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (day && day !== date) void save();
            }}
          >
            <Modal.Body className="flex flex-col gap-3">
              <p className="text-sm text-muted">
                {t("playlist.changeDateHelp")}
              </p>
              {failed && <ErrorNotice message={t("states.actionFailed")} />}
              <TextField value={day} onChange={setDay} isRequired>
                <Label>{t("playlist.date")}</Label>
                <Input type="date" />
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={onClose}>
                <X />
                {t("editor.close")}
              </Button>
              <ActionButton
                type="submit"
                isPending={saving}
                isDisabled={!day || day === date}
              >
                <Save />
                {t("playlist.saveDate")}
              </ActionButton>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
