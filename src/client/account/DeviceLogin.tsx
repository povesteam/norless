import {
  Keyboard,
  Laptop,
  LogOut,
  QrCode,
  Smartphone,
  UserPlus,
} from "lucide-react";
import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ApprovedDevice } from "../../server/auth/device-login";
import { send, useJson } from "../data/fetch";
import { ErrorNotice } from "../ui/states";
import { QrImage } from "./QrImage";

const spaced = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

/**
 * On the login page: log this device in from a phone where someone is logged in. It
 * shows a QR code and waits; the code to type hides under "Can't scan?", and the number
 * to compare shows once a phone opened the code. Once approved, it
 * opens `target` logged in. A new code comes when one runs out.
 */
export function PhoneLogin({
  target,
  big = false,
}: {
  target: string;
  /** The page's main way in, on a laptop. */
  big?: boolean;
}) {
  const { t } = useTranslation();
  const [login, setLogin] = useState<{
    code: string;
    number: number;
    token: string;
  }>();
  const [opened, setOpened] = useState(false);
  const [typing, setTyping] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    // The community the page came from, for the team's phones nearby.
    let community = target.split("/")[1] || null;
    try {
      community ??= localStorage.getItem("norless:community");
    } catch {
      // No nearby offer; the QR code still works.
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const retry = () => {
      if (!stopped) timer = setTimeout(() => setRound((n) => n + 1), 10_000);
    };
    void send("POST", "/api/device-login", community ? { community } : {}).then(
      async (response) => {
        if (stopped) return;
        if (!response?.ok) return retry();
        const next = (await response.json()) as NonNullable<typeof login>;
        setLogin(next);
        setOpened(false);
        const wait = async () => {
          if (stopped) return;
          const answer = await send("POST", "/api/device-login/wait", {
            token: next.token,
          });
          if (stopped) return;
          // A whole page load, so the live connection knows who logged in.
          if (answer?.status === 204) return location.assign(target);
          if (answer?.status === 410) return setRound((n) => n + 1);
          if (answer?.status === 202)
            setOpened(
              ((await answer.json()) as { opened?: boolean }).opened === true,
            );
          timer = setTimeout(() => void wait(), 2000);
        };
        void wait();
      },
    );
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [target, round]);

  return (
    <section
      className={`flex flex-col items-start gap-3 ${big ? "" : "border-t border-separator pt-4"}`}
    >
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Smartphone />
        {t(big ? "deviceLogin.scan" : "deviceLogin.withPhone")}
      </h3>
      <p className="text-muted">{t("deviceLogin.withPhoneHelp")}</p>
      {/* The QR's place is kept while a code comes, so nothing moves; centered under
          the text when it's the page's main way in (fix-classic-review). */}
      <div
        className={`flex items-center justify-center ${big ? "size-72 self-center" : "size-48"}`}
      >
        {login ? (
          <QrImage
            path={`/login/device/${login.code}`}
            label={t("deviceLogin.qr")}
            big={big}
          />
        ) : (
          <QrCode className="size-12 text-muted" />
        )}
      </div>
      {/* One line, kept: "Can't scan?" or the code to type, and the number to compare
          in its place once a phone opened the code. */}
      <div
        className={`grid min-h-10 items-center ${big ? "self-center" : ""}`}
        aria-live="polite"
      >
        {opened && login ? (
          <p>
            {t("deviceLogin.number")}{" "}
            <span
              className="font-mono text-3xl font-semibold tabular-nums"
              data-testid="device-number"
            >
              {login.number}
            </span>
          </p>
        ) : typing ? (
          <p>
            {t("deviceLogin.typeCode")}{" "}
            <span className="font-mono text-lg font-semibold tabular-nums">
              {login ? spaced(login.code) : "··· ···"}
            </span>
          </p>
        ) : (
          <button
            type="button"
            // Underlined, so it reads as a link beside the QR.
            className="link underline"
            onClick={() => setTyping(true)}
          >
            <Keyboard />
            {t("deviceLogin.cantScan")}
          </button>
        )}
      </div>
    </section>
  );
}

/** My account: the laptops and guests this member logged in, to end one. */
export function ApprovedDevices({ loads = 0 }: { loads?: number }) {
  const { t, i18n } = useTranslation();
  const [version, setVersion] = useState(0);
  const { data } = useJson<ApprovedDevice[]>(
    "/api/me/devices",
    version + loads,
  );
  const [failed, setFailed] = useState(false);
  if (!data?.length) return null;
  const time = new Intl.DateTimeFormat(i18n.language, {
    timeStyle: "short",
    hourCycle: "h23",
  });
  return (
    <section className="flex w-full flex-col items-start gap-2 border-t border-separator pt-4">
      <h3 className="text-lg font-semibold">{t("deviceLogin.devicesTitle")}</h3>
      {failed && <ErrorNotice message={t("states.actionFailed")} />}
      <ul className="flex w-full flex-col gap-2">
        {data.map((device) => (
          <li key={device.id} className="flex flex-wrap items-center gap-2">
            {device.kind === "laptop" ? <Laptop /> : <UserPlus />}
            <span className="min-w-0 flex-1">
              {device.name}
              <span className="text-muted">
                {" · "}
                {t("deviceLogin.until", {
                  time: time.format(new Date(device.expiresAt)),
                })}
              </span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              onPress={() =>
                void send("DELETE", `/api/me/devices/${device.id}`).then(
                  (response) => {
                    setFailed(!response?.ok);
                    setVersion((n) => n + 1);
                  },
                )
              }
            >
              <LogOut />
              {t("deviceLogin.end")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
