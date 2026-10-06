import { Save } from "lucide-react";
import { Description, Label, TextArea, TextField } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Welcome } from "../../server/community/welcome";
import { useCommunity } from "../data/community";
import { send, useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { WelcomeIcon } from "../ui/icons";
import { ActionButton, ErrorNotice, usePending } from "../ui/states";

/**
 * The welcome page's announcements: short Markdown texts, one after
 * another on the projectors, separated here by a blank line.
 */
export function WelcomeSettings() {
  const { slug } = useCommunity();
  const welcome = useJson<Welcome>(
    `/api/communities/${slug}/welcome`,
    useChanges(slug, "communities"),
  ).data;
  // The form starts from what's saved once, and keeps what's typed.
  return welcome ? <Form announcements={welcome.announcements} /> : null;
}

function Form({ announcements }: { announcements: string[] }) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const [text, setText] = useState(announcements.join("\n\n"));
  const [failed, setFailed] = useState(false);
  const [save, saving] = usePending(async () => {
    const response = await send("PUT", `/api/communities/${slug}/welcome`, {
      announcements: text.split(/\n\s*\n/),
    });
    setFailed(!response?.ok);
  });
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-xl font-semibold">
        <WelcomeIcon />
        {t("welcome.settings")}
      </h3>
      <p className="text-sm text-muted">{t("welcome.settingsHelp")}</p>
      {failed && <ErrorNotice message={t("states.actionFailed")} />}
      <TextField value={text} onChange={setText}>
        <Label>{t("welcome.announcements")}</Label>
        <TextArea rows={6} className="field-sizing-content" />
        <Description>{t("welcome.announcementsHelp")}</Description>
      </TextField>
      <ActionButton
        className="self-start"
        isPending={saving}
        onPress={() => void save()}
      >
        <Save />
        {t("editor.save")}
      </ActionButton>
    </section>
  );
}
