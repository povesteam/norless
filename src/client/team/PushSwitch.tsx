import { Bell } from "lucide-react";
import { Alert } from "@heroui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { send, useJson } from "../data/fetch";
import { ActionButton, ErrorNotice, usePending } from "../ui/states";

const pushSupported = () =>
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/** The key push subscriptions are made with, as the browser wants it. */
const keyBytes = (base64: string) => {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

/**
 * Notifications on this device, by push: on, or how to get them where the browser
 * can't (an iPhone without Norless installed), or when the server has no push.
 */
export function PushSwitch() {
  const { t } = useTranslation();
  const key =
    useJson<{ key: string | null }>("/api/push/key").data?.key ?? null;
  const [state, setState] = useState<"off" | "on" | "denied" | "failed">(() =>
    pushSupported() && Notification.permission === "denied" ? "denied" : "off",
  );
  useEffect(() => {
    if (!pushSupported()) return;
    void navigator.serviceWorker
      .getRegistration()
      .then(async (registration) => {
        if (await registration?.pushManager.getSubscription()) setState("on");
      });
  }, []);
  const [turnOn, turning] = usePending(async () => {
    if (!key) return;
    try {
      if ((await Notification.requestPermission()) !== "granted")
        return setState("denied");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key),
      });
      const response = await send(
        "POST",
        "/api/push/subscriptions",
        subscription.toJSON(),
      );
      setState(response?.ok ? "on" : "failed");
    } catch {
      setState("failed");
    }
  });
  return (
    <section aria-labelledby="push-title" className="flex flex-col gap-2">
      <h3 id="push-title" className="text-xl font-semibold">
        {t("team.push")}
      </h3>
      {!pushSupported() ? (
        <Alert status="accent">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t("team.pushInstall")}</Alert.Title>
            <Alert.Description>{t("team.pushInstallHow")}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : !key ? (
        <p className="text-sm text-muted">{t("team.pushOff")}</p>
      ) : state === "on" ? (
        <p className="flex items-center gap-2 text-sm">
          <Bell className="size-4" />
          {t("team.pushOn")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <ActionButton
            className="self-start"
            variant="secondary"
            isPending={turning}
            onPress={() => void turnOn()}
          >
            <Bell />
            {t("team.pushTurnOn")}
          </ActionButton>
          {state === "denied" && (
            <p className="text-sm text-muted">{t("team.pushDenied")}</p>
          )}
          {state === "failed" && (
            <ErrorNotice message={t("states.actionFailed")} />
          )}
        </div>
      )}
    </section>
  );
}
