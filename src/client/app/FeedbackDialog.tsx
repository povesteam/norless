import { Check, Lightbulb, Send, X } from "lucide-react";
import {
  Button,
  Label,
  Modal,
  Radio,
  RadioGroup,
  TextArea,
  TextField,
} from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useRouter } from "wouter";
import { useCommunity } from "../data/community";
import { useDeviceType } from "../data/device";
import { send } from "../data/fetch";
import { ActionButton, ErrorNotice, usePending } from "../ui/states";

/**
 * "Ideas and feedback" in the menu, or "Send an idea" on the owners' Ideas page: a button
 * that opens a box whose text reaches the owners.
 */
export function FeedbackButton({
  className,
  onIdeasPage = false,
}: {
  className?: string;
  onIdeasPage?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={onIdeasPage ? "secondary" : "ghost"}
        className={className}
        onPress={() => setOpen(true)}
      >
        {onIdeasPage ? <Send /> : <Lightbulb />}
        {t(onIdeasPage ? "feedback.new" : "feedback.open")}
      </Button>
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { slug } = useCommunity();
  const [location] = useLocation();
  const { base } = useRouter();
  const { deviceType } = useDeviceType();
  const [text, setText] = useState("");
  // The community's owners, or the people who make Norless.
  const [to, setTo] = useState<"owners" | "app">("owners");
  const [state, setState] = useState<"sent" | "failed" | null>(null);
  const [submit, sending] = usePending(async () => {
    const response = await send("POST", `/api/communities/${slug}/feedback`, {
      text,
      page: base + location,
      deviceType,
      language: i18n.language,
      to,
    });
    setState(response?.ok ? "sent" : "failed");
  });
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("feedback.open")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            {state === "sent" ? (
              <p>
                {t(to === "app" ? "feedback.thanksApp" : "feedback.thanks")}
              </p>
            ) : (
              <>
                <RadioGroup
                  value={to}
                  onChange={(value) =>
                    setTo(value === "app" ? "app" : "owners")
                  }
                >
                  <Label>{t("feedback.to")}</Label>
                  {(["owners", "app"] as const).map((id) => (
                    <Radio key={id} value={id}>
                      <Radio.Content>
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        {t(
                          id === "app" ? "feedback.toApp" : "feedback.toOwners",
                        )}
                      </Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
                <TextField value={text} onChange={setText} isRequired>
                  <Label>{t("feedback.label")}</Label>
                  <TextArea
                    rows={5}
                    maxLength={5000}
                    className="field-sizing-content"
                    autoFocus
                  />
                </TextField>
                {state === "failed" && (
                  <ErrorNotice message={t("states.actionFailed")} />
                )}
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            {state === "sent" ? (
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
                <ActionButton
                  isPending={sending}
                  isDisabled={!text.trim()}
                  onPress={() => void submit()}
                >
                  <Send />
                  {t("feedback.send")}
                </ActionButton>
              </>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
