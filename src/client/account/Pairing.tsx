import { Link2, Unlink, X } from "lucide-react";
import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { generate } from "lean-qr";
import { toSvgDataURL } from "lean-qr/extras/svg";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import type { PairedDevice } from "../../server/live/screens";
import type { Screen } from "../../shared/screens";
import { CommunityProvider, useCommunity } from "../data/community";
import { send, useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { hasRole, useMe } from "../data/me";
import { NotFound } from "../app/NotFound";
import { ScreenPage } from "../screens/ScreenPage";
import { Choice } from "../ui/choice";
import {
  ActionButton,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";

/** This device's own token, kept for good, so it stays paired after a restart. */
function deviceToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const fresh = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  try {
    const kept = localStorage.getItem("norless:device");
    if (kept) return kept;
    localStorage.setItem("norless:device", fresh);
  } catch {
    // Paired until the page reloads.
  }
  return fresh;
}

/**
 * /pair: a device such as a TV box shows a code until someone on the team pairs it as
 * one of the room's screens. Then it shows that screen, also after a restart, until
 * it's unpaired.
 */
export function PairPage() {
  const [token] = useState(deviceToken);
  return <ScreenPage secret={token} unpaired={<PairingCode token={token} />} />;
}

function PairingCode({ token }: { token: string }) {
  const { t } = useTranslation();
  const [code, setCode] = useState<string>();
  const [round, setRound] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    void send("POST", "/api/pairing", { token }).then(async (response) => {
      if (stopped) return;
      const next = response?.ok
        ? ((await response.json()) as { code: string }).code
        : undefined;
      setCode(next);
      // A new code before this one runs out, judged by this device's own clock;
      // without an answer, another try soon.
      timer = setTimeout(
        () => setRound((n) => n + 1),
        next ? 4.5 * 60_000 : 10_000,
      );
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [token, round]);
  return (
    <div className="dark fixed inset-0 flex flex-col items-center justify-center gap-8 bg-black p-8 text-center text-white">
      <p className="text-2xl text-white/70">{t("pair.instructions")}</p>
      <p
        className="font-mono text-8xl font-semibold tracking-widest tabular-nums"
        aria-label={t("pair.code")}
      >
        {code ? `${code.slice(0, 3)} ${code.slice(3)}` : "··· ···"}
      </p>
      {code && (
        <>
          {/* A phone's camera opens Norless with the code filled in. */}
          <img
            src={toSvgDataURL(generate(`${location.origin}/pair/${code}`), {
              on: "black",
              off: "white",
              pad: 2,
            })}
            alt={t("pair.qr")}
            className="size-56 rounded-xl"
          />
          <p className="text-lg text-white/70">{t("pair.scan")}</p>
        </>
      )}
    </div>
  );
}

/**
 * /pair/<code>: where the QR code on a device leads, on a phone of someone on the team:
 * the pairing dialog, with the code filled in.
 */
export function PairCodePage({ code }: { code: string }) {
  const { t } = useTranslation();
  const { me } = useMe();
  if (me === undefined) return <Placeholder lines={3} />;
  if (!me.user)
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/pair/${code}`)}`}
        className="link"
      >
        {t("pair.logIn")}
      </Link>
    );
  // ponytail: the first community where they're on the team; a choice once people are in several.
  const community = me.memberships.find((m) => hasRole(m.roles, "team"));
  if (!community) return <p>{t("pair.onlyTeam")}</p>;
  return (
    <CommunityProvider slug={community.community} missing={<NotFound />}>
      <PairFromLink code={code} />
    </CommunityProvider>
  );
}

function PairFromLink({ code }: { code: string }) {
  const { slug } = useCommunity();
  const [, navigate] = useLocation();
  const screens = useJson<Screen[]>(
    `/api/communities/${slug}/screens`,
    useChanges(slug, "screens"),
  ).data;
  if (!screens) return <Placeholder lines={3} />;
  return (
    <PairDevices
      screens={screens}
      initialCode={code}
      onClose={() => navigate(`/${slug}`)}
    />
  );
}

/** For the team: pair the device that shows a code as a screen, and unpair devices. */
export function PairDevices({
  screens,
  initialCode = "",
  onClose,
}: {
  screens: Screen[];
  initialCode?: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { slug } = useCommunity();
  const [code, setCode] = useState(initialCode);
  const [screenId, setScreenId] = useState(screens[0]?.id ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [loads, setLoads] = useState(0);
  const devices = useJson<PairedDevice[]>(
    `/api/communities/${slug}/devices`,
    loads + useChanges(slug, "screen_devices"),
  ).data;
  const digits = code.replace(/\D/g, "");
  const [pair, pairing] = usePending(async () => {
    const response = await send(
      "POST",
      `/api/communities/${slug}/screens/${screenId}/devices`,
      { code: digits },
    );
    setProblem(
      response?.ok
        ? null
        : t(
            response?.status === 400
              ? "pair.unknownCode"
              : "states.actionFailed",
          ),
    );
    if (response?.ok) {
      setCode("");
      setLoads((n) => n + 1);
    }
  });
  const unpair = async (id: string) => {
    const response = await send(
      "DELETE",
      `/api/communities/${slug}/devices/${id}`,
    );
    setProblem(response?.ok ? null : t("states.actionFailed"));
    setLoads((n) => n + 1);
  };

  const formId = useId();
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("pair.title")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              {t("pair.howTo", { host: location.host })}
            </p>
            <form
              id={formId}
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (digits.length === 6) void pair();
              }}
            >
              <TextField value={code} onChange={setCode} autoFocus>
                <Label>{t("pair.code")}</Label>
                <Input inputMode="numeric" autoComplete="off" maxLength={7} />
              </TextField>
              <Choice
                label={t("pair.screen")}
                value={screenId}
                onChange={setScreenId}
                options={screens}
              />
            </form>
            {problem && <ErrorNotice message={problem} />}
            {devices && devices.length > 0 && (
              <section
                aria-label={t("pair.paired")}
                className="flex flex-col gap-2"
              >
                <h3 className="font-semibold">{t("pair.paired")}</h3>
                <ul className="flex flex-col gap-2">
                  {devices.map((device) => {
                    const screen = screens.find(
                      (s) => s.id === device.screenId,
                    );
                    return (
                      <li
                        key={device.id}
                        aria-label={screen?.name}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-sm">
                          <span className="font-medium">{screen?.name}</span>{" "}
                          <span className="text-muted">
                            {t("pair.pairedBy", {
                              name: device.pairedBy ?? "",
                              date: new Date(
                                device.pairedAt,
                              ).toLocaleDateString(i18n.language),
                            })}
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => void unpair(device.id)}
                        >
                          <Unlink />
                          {t("pair.unpair")}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </Modal.Body>
          {/* Close, then the main action, as in the other dialogs. */}
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            <ActionButton
              type="submit"
              form={formId}
              isPending={pairing}
              isDisabled={digits.length !== 6}
            >
              <Link2 />
              {t("pair.pair")}
            </ActionButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
