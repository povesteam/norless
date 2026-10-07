import { X } from "lucide-react";
import { Button, Chip } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCommunity } from "../data/community";
import { sendLive } from "../data/room";

/** A message to the stage monitors, a short text; it stays until cleared. */
export function StageMessage({ message }: { message: string | null }) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const [text, setText] = useState("");
  const say = (value: string | null) =>
    void sendLive(slug, { type: "message", text: value });
  return (
    <div
      role="group"
      aria-label={t("stage.toStage")}
      className="flex flex-wrap items-center gap-1"
    >
      <span className="text-xs text-muted">{t("stage.toStage")}</span>
      <form
        className="flex gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim()) return;
          say(text);
          setText("");
        }}
      >
        <input
          aria-label={t("stage.message")}
          placeholder={t("stage.message")}
          value={text}
          maxLength={200}
          onChange={(event) => setText(event.currentTarget.value)}
          className="w-44 rounded-lg bg-field px-2 py-1 text-sm text-field-foreground"
        />
      </form>
      {message && (
        <>
          <Chip size="sm" color="warning" variant="soft">
            {message}
          </Chip>
          <Button size="sm" variant="ghost" onPress={() => say(null)}>
            <X />
            {t("stage.clear")}
          </Button>
        </>
      )}
    </div>
  );
}
