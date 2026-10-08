import { Button, Checkbox, Modal } from "@heroui/react";
import { Laptop, LogOut, Smartphone, Tablet, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type { SessionInfo } from "../../server/auth/sessions";
import { send, useJson } from "../data/fetch";
import { useMe } from "../data/me";
import {
  ActionButton,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";
import { relativeTime } from "../ui/time";
import { ApprovedDevices } from "./DeviceLogin";
import { GuestPass } from "./GuestPass";

/**
 * My account's Logins: where the person is logged in, each other place with Log out;
 * the laptops and guests they logged in, logging in another device or a guest; and
 * logging out here, or everywhere.
 */
export function LoginsTab() {
  const { t } = useTranslation();
  const { me } = useMe();
  const [loggingOut, setLoggingOut] = useState(false);
  // A guest who logs in shows among the devices at once.
  const [devicesLoads, setDevicesLoads] = useState(0);
  if (!me?.user) return null;
  return (
    <div className="flex flex-col items-start gap-4">
      <Sessions />
      {!me.user.device && (
        <>
          <ApprovedDevices loads={devicesLoads} />
          <Link href="/login/device" className="link">
            <Smartphone />
            {t("deviceLogin.another")}
          </Link>
          <GuestPass onAccepted={() => setDevicesLoads((n) => n + 1)} />
        </>
      )}
      {/* Last, set apart. */}
      <section className="flex w-full flex-col items-start gap-2 border-t border-separator pt-4">
        <Button variant="secondary" onPress={() => setLoggingOut(true)}>
          <LogOut />
          {t("auth.logout")}
        </Button>
      </section>
      {loggingOut && <LogOutDialog onClose={() => setLoggingOut(false)} />}
    </div>
  );
}

/** A device's icon by its system: a phone, a tablet, else a computer. */
function SystemIcon({ system }: { system: string | null }) {
  if (system === "iPhone" || system === "Android") return <Smartphone />;
  if (system === "iPad") return <Tablet />;
  return <Laptop />;
}

/** Where the person is logged in: this device first, then by last use. */
function Sessions() {
  const { t, i18n } = useTranslation();
  const [version, setVersion] = useState(0);
  const { data, failed, retry } = useJson<SessionInfo[]>(
    "/api/me/sessions",
    version,
  );
  const [outFailed, setOutFailed] = useState(false);
  const [logOut, pending] = usePending(async (id: string) => {
    const response = await send("DELETE", `/api/me/sessions/${id}`);
    setOutFailed(!response?.ok);
    setVersion((n) => n + 1);
  });
  if (data === undefined)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={2} />
    );
  if (!data) return null;
  const name = (s: SessionInfo) =>
    s.browser && s.system
      ? t("account.sessions.on", { browser: s.browser, system: s.system })
      : (s.browser ?? s.system ?? t("account.sessions.unknown"));
  const sessions = [
    ...data.filter((s) => s.current),
    ...data.filter((s) => !s.current),
  ];
  return (
    <section
      aria-labelledby="sessions-title"
      className="flex w-full flex-col gap-2"
    >
      <h3 id="sessions-title" className="text-lg font-semibold">
        {t("account.sessions.title")}
      </h3>
      <ul className="flex w-full flex-col gap-2">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2">
            <SystemIcon system={s.system} />
            <span className="min-w-0 flex-1">
              {name(s)}
              <span className="text-muted">
                {" · "}
                {s.current
                  ? t("account.sessions.here")
                  : t("account.sessions.seen", {
                      when: relativeTime(s.seenAt, new Date(), i18n.language),
                    })}
              </span>
            </span>
            {!s.current && (
              <Button
                size="sm"
                variant="secondary"
                isDisabled={pending}
                aria-label={t("account.sessions.logOutOf", { name: name(s) })}
                onPress={() => void logOut(s.id)}
              >
                <LogOut />
                {t("account.sessions.logOut")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {outFailed && <ErrorNotice message={t("states.actionFailed")} />}
    </section>
  );
}

/** Asks before logging out, and offers to log out on the other devices too. */
function LogOutDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { refresh } = useMe();
  const [everywhere, setEverywhere] = useState(false);
  const [failed, setFailed] = useState(false);
  const [logOut, pending] = usePending(async () => {
    const others = everywhere
      ? await send("POST", "/api/auth/logout-everywhere")
      : null;
    const here = await send("POST", "/api/auth/logout");
    if ((everywhere && !others?.ok) || !here?.ok) return setFailed(true);
    refresh();
  });
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("account.logoutTitle")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <Checkbox isSelected={everywhere} onChange={setEverywhere}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                {t("account.everywhere")}
              </Checkbox.Content>
            </Checkbox>
            {failed && <ErrorNotice message={t("states.actionFailed")} />}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("feedback.cancel")}
            </Button>
            <ActionButton isPending={pending} onPress={() => void logOut()}>
              <LogOut />
              {t("auth.logout")}
            </ActionButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
