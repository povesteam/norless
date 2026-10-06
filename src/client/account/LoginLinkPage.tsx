import { LogIn, Mail } from "lucide-react";
import { Alert } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { send } from "../data/fetch";
import { useMe } from "../data/me";
import { ActionButton, ErrorNotice, usePending } from "../ui/states";

/**
 * /login/link/<token>: where a login link leads. A button logs in, so mail scanners
 * that open links don't use the link up before the person does.
 */
export function LoginLinkPage({ token }: { token: string }) {
  const { t } = useTranslation();
  const { refresh } = useMe();
  const [, navigate] = useLocation();
  const [outcome, setOutcome] = useState<
    "expired" | "refused" | "failed" | null
  >(null);
  const [logIn, loggingIn] = usePending(async () => {
    const response = await send("POST", "/api/auth/email-link/use", { token });
    if (response?.status === 410) return setOutcome("expired");
    if (response?.status === 403) return setOutcome("refused");
    if (!response?.ok) return setOutcome("failed");
    const { next } = (await response.json()) as { next: string };
    refresh();
    navigate(next, { replace: true });
  });
  return (
    <div className="flex max-w-90 flex-col gap-4">
      <h2 className="text-2xl font-semibold">{t("auth.login")}</h2>
      {outcome === "expired" ? (
        <>
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t("auth.linkExpired")}</Alert.Title>
            </Alert.Content>
          </Alert>
          <Link href="/login" className="link">
            <Mail />
            {t("auth.newLink")}
          </Link>
        </>
      ) : outcome === "refused" ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t("auth.notInvited")}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : (
        <>
          <p>{t("auth.linkHere")}</p>
          {outcome === "failed" && (
            <ErrorNotice message={t("states.actionFailed")} />
          )}
          <ActionButton isPending={loggingIn} onPress={() => void logIn()}>
            <LogIn />
            {t("auth.login")}
          </ActionButton>
        </>
      )}
    </div>
  );
}
