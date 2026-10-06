import { LogIn, QrCode, UserPlus, X } from "lucide-react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { useEffect, useEffectEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GuestPassState } from "../../server/auth/device-login";
import { live } from "../data/connection";
import { send, useJson } from "../data/fetch";
import { hasRole, useMe } from "../data/me";
import {
  ActionButton,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";
import { clock } from "../ui/time";
import { QrImage } from "./QrImage";

/**
 * My account, for the team: a QR that logs a guest musician's phone in. It follows the
 * pass (live-updates spec): once a phone opens it, the QR goes; once the guest logs in,
 * it says so; after 5 minutes unused, it offers a new one.
 */
export function GuestPass({ onAccepted }: { onAccepted?: () => void }) {
  const { t, i18n } = useTranslation();
  const { me } = useMe();
  const [guest, setGuest] = useState("");
  const [pass, setPass] = useState<{ code: string; expiresAt: string } | null>(
    null,
  );
  const [state, setState] = useState<GuestPassState>({ state: "waiting" });
  const [expired, setExpired] = useState(false);
  const [failed, setFailed] = useState(false);
  const community = me?.memberships.find((m) =>
    hasRole(m.roles, "team"),
  )?.community;
  const accepted = useEffectEvent(() => onAccepted?.());
  useEffect(() => {
    if (!pass) return;
    const timer = setTimeout(
      () => setExpired(true),
      Date.parse(pass.expiresAt) - Date.now(),
    );
    const stop = live.subscribe(`guest-pass:${pass.code}`, (data) => {
      const next = data as GuestPassState;
      setState(next);
      if (next.state === "accepted") accepted();
    });
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [pass]);
  const [show, showing] = usePending(async () => {
    const response = await send(
      "POST",
      `/api/communities/${community}/guest-passes`,
      { guest, language: i18n.language },
    );
    setFailed(!response?.ok);
    if (!response?.ok) return;
    setState({ state: "waiting" });
    setExpired(false);
    setPass((await response.json()) as { code: string; expiresAt: string });
  });
  if (!community || me?.user?.device) return null;
  const close = () => {
    setPass(null);
    setGuest("");
  };
  const time = (iso: string) => clock(iso, i18n.language);
  return (
    <section className="flex w-full flex-col items-start gap-2 border-t border-separator pt-4">
      <h3 className="text-lg font-semibold">{t("deviceLogin.guestTitle")}</h3>
      <p className="text-muted">{t("deviceLogin.guestHelp")}</p>
      {failed && <ErrorNotice message={t("states.actionFailed")} />}
      {pass ? (
        <>
          {state.state === "accepted" ? (
            <p role="status" className="flex items-center gap-2 font-semibold">
              <UserPlus />
              {t("deviceLogin.guestIn", {
                name: state.name,
                time: time(state.until),
              })}
            </p>
          ) : state.state === "opened" ? (
            <p role="status" className="text-muted">
              {t("deviceLogin.guestOpened", { name: guest.trim() })}
            </p>
          ) : expired ? (
            <>
              <p role="status" className="text-muted">
                {t("deviceLogin.guestExpired")}
              </p>
              <ActionButton onPress={() => void show()} isPending={showing}>
                <QrCode />
                {t("deviceLogin.guestAgain")}
              </ActionButton>
            </>
          ) : (
            <>
              <QrImage
                path={`/guest/${pass.code}`}
                label={t("deviceLogin.guestQr")}
              />
              <p className="text-sm text-muted">{t("deviceLogin.guestScan")}</p>
            </>
          )}
          <Button variant="secondary" onPress={close}>
            <X />
            {t(
              state.state === "accepted"
                ? "deviceLogin.guestDone"
                : "feedback.close",
            )}
          </Button>
        </>
      ) : (
        <form
          className="flex flex-col items-start gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (guest.trim()) void show();
          }}
        >
          <TextField value={guest} onChange={setGuest} maxLength={60}>
            <Label>{t("deviceLogin.guestName")}</Label>
            <Input />
          </TextField>
          <ActionButton
            type="submit"
            isDisabled={!guest.trim()}
            isPending={showing}
          >
            <QrCode />
            {t("deviceLogin.showGuestQr")}
          </ActionButton>
        </form>
      )}
    </section>
  );
}

/** /guest/<code>: a guest musician's phone, from the band member's QR. */
export function GuestPage({ code }: { code: string }) {
  const { t } = useTranslation();
  // The first phone to open the pass claims it; its claim opens it again after a reload.
  const kept = `norless:guest-claim:${code}`;
  const [claim] = useState(() => {
    try {
      return sessionStorage.getItem(kept) ?? "";
    } catch {
      return "";
    }
  });
  const { data, failed, retry } = useJson<{
    name: string;
    community: string;
    claim: string;
  }>(`/api/guest-passes/${code}?claim=${encodeURIComponent(claim)}`);
  useEffect(() => {
    if (!data?.claim) return;
    try {
      sessionStorage.setItem(kept, data.claim);
    } catch {
      // Kept only while the page stays open.
    }
  }, [data?.claim, kept]);
  const [problem, setProblem] = useState(false);
  const [join, joining] = usePending(async () => {
    const response = await send("POST", `/api/guest-passes/${code}`, {
      claim: data?.claim,
    });
    if (!response?.ok) return setProblem(true);
    const { community } = (await response.json()) as { community: string };
    location.assign(`/${community}/musicians`);
  });
  if (data === undefined)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={2} />
    );
  if (data === null) return <p>{t("deviceLogin.passGone")}</p>;
  return (
    <div className="flex max-w-md flex-col items-start gap-4">
      <h2 className="text-2xl font-semibold">
        {t("deviceLogin.guestJoin", { name: data.name })}
      </h2>
      {problem && <ErrorNotice message={t("states.actionFailed")} />}
      <ActionButton onPress={() => void join()} isPending={joining}>
        <LogIn />
        {t("auth.login")}
      </ActionButton>
    </div>
  );
}
