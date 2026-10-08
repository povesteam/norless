import { Star, X } from "lucide-react";
import { Button, Label, Modal, Radio, RadioGroup } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Entry, Playlist } from "../../server/playlists/playlists";
import { useCommunity } from "../data/community";
import { send } from "../data/fetch";
import { entryTitle } from "../stage/StageMonitor";
import { ErrorNotice } from "../ui/states";
import { PersonAvatar } from "../ui/NameAvatar";

export { Star as LedByIcon };

/** Who leads an entry: the one the team chose, else the service's lead. */
export const leaderOf = (entry: Entry, leads: Playlist["leads"]) =>
  entry.ledBy?.name ?? leads?.lead?.name ?? null;

/**
 * Choosing who leads a song: the service's worship lead by default, or another of the
 * people in its slots who lead or sing. Saved as it's picked.
 */
export function LedByDialog({
  playlistId,
  entry,
  leads,
  onClose,
}: {
  playlistId: string;
  entry: Entry;
  leads: Playlist["leads"];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { slug, languages } = useCommunity();
  const [chosen, setChosen] = useState(entry.ledBy?.id ?? "");
  const [failed, setFailed] = useState(false);
  const people = [
    ...(leads?.people ?? []),
    // Someone chosen before who's no longer in the slots stays a choice.
    ...(entry.ledBy && !leads?.people.some((p) => p.id === entry.ledBy?.id)
      ? [entry.ledBy]
      : []),
  ].filter((p) => p.id !== leads?.lead?.id);
  const choose = async (id: string) => {
    setChosen(id);
    const response = await send(
      "PATCH",
      `/api/communities/${slug}/playlists/${playlistId}/entries/${entry.id}`,
      { ledBy: id || null },
    );
    setFailed(!response?.ok);
  };
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>
              {t("team.ledByTitle", {
                song: entryTitle(entry, [i18n.language, ...languages]),
              })}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <RadioGroup value={chosen} onChange={(id) => void choose(id)}>
              <Label>{t("team.ledByHelp")}</Label>
              <Radio value="">
                <Radio.Content>
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  {leads?.lead
                    ? t("team.ledByLead", { name: leads.lead.name })
                    : t("team.ledByNone")}
                </Radio.Content>
              </Radio>
              {people.map((person) => (
                <Radio key={person.id} value={person.id}>
                  <Radio.Content className="flex items-center gap-2">
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    <span aria-hidden className="flex shrink-0">
                      <PersonAvatar
                        name={person.name}
                        avatar={person.avatar}
                        className="size-6"
                      />
                    </span>
                    <span>{person.name}</span>
                  </Radio.Content>
                </Radio>
              ))}
            </RadioGroup>
            {!leads?.lead && people.length === 0 && (
              <p className="text-sm text-muted">{t("team.ledByNobody")}</p>
            )}
            {failed && <ErrorNotice message={t("states.actionFailed")} />}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
