import { Check, Laptop, LogIn, UserPlus } from "lucide-react";
import {
  Alert,
  Button,
  Description,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { send, useJson } from "../data/fetch";
import { hasRole, useMe } from "../data/me";
import {
  ActionButton,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";

type How = "me" | "laptop" | "guest";

/**
 * /login/device/<code>: where the QR code leads, on the phone of someone logged in: the
 * number to compare with the device's, and how to log it in.
 */
export function ApproveDevicePage({ code }: { code: string }) {
  const { t, i18n } = useTranslation();
  const { me } = useMe();
  const pending = useJson<{ number: number; community: string | null }>(
    me?.user && !me.user.device ? `/api/device-login/${code}` : null,
  );
  // The device's community when they're on its team, or else the first where they are.
  const teams = (me?.memberships ?? []).filter((m) => hasRole(m.roles, "team"));
  const community = (
    teams.find((m) => m.community === pending.data?.community) ?? teams[0]
  )?.community;
  const [guest, setGuest] = useState("");
  const [outcome, setOutcome] = useState<"done" | "failed" | null>(null);
  const [approve, approving] = usePending(async (how: How) => {
    if (!pending.data) return;
    const response = await send("POST", `/api/device-login/${code}/approve`, {
      number: pending.data.number,
      as: how,
      ...(how !== "me" && { community }),
      ...(how === "guest" && { guest }),
      language: i18n.language,
    });
    setOutcome(response?.ok ? "done" : "failed");
  });
  if (me === undefined) return <Placeholder lines={3} />;
  if (!me.user || me.user.device)
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/login/device/${code}`)}`}
        className="link"
      >
        <LogIn />
        {t("deviceLogin.logInFirst")}
      </Link>
    );
  return (
    <div className="flex max-w-md flex-col items-start gap-4">
      <h2 className="text-2xl font-semibold">{t("deviceLogin.title")}</h2>
      {outcome === "done" ? (
        <Alert status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t("deviceLogin.done")}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : pending.data === undefined ? (
        pending.failed ? (
          <ErrorNotice
            message={t("states.loadFailed")}
            onRetry={pending.retry}
          />
        ) : (
          <Placeholder lines={4} />
        )
      ) : pending.data === null ? (
        <p>{t("deviceLogin.gone")}</p>
      ) : (
        <>
          <p>{t("deviceLogin.checkNumber")}</p>
          <p className="font-mono text-6xl font-semibold tabular-nums">
            {pending.data.number}
          </p>
          {outcome === "failed" && (
            <ErrorNotice message={t("states.actionFailed")} />
          )}
          {/* On the team, the community's laptop is the main choice: a shared laptop needs it. */}
          <Choice
            help={t("deviceLogin.asMeHelp")}
            onPress={() => void approve("me")}
            isPending={approving}
            secondary={!!community}
          >
            <LogIn />
            {t("deviceLogin.asMe")}
          </Choice>
          {community && (
            <>
              <Choice
                help={t("deviceLogin.asLaptopHelp", {
                  name: me.user.displayName,
                })}
                onPress={() => void approve("laptop")}
                isPending={approving}
              >
                <Laptop />
                {t("deviceLogin.asLaptop")}
              </Choice>
              <form
                className="flex w-full flex-col items-start gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (guest.trim()) void approve("guest");
                }}
              >
                <TextField
                  className="w-full"
                  value={guest}
                  onChange={setGuest}
                  maxLength={60}
                >
                  <Label>{t("deviceLogin.guestName")}</Label>
                  <Input />
                  <Description>
                    {t("deviceLogin.asGuestHelp", {
                      name: me.user.displayName,
                    })}
                  </Description>
                </TextField>
                <ActionButton
                  type="submit"
                  variant="secondary"
                  isDisabled={!guest.trim()}
                  isPending={approving}
                >
                  <UserPlus />
                  {t("deviceLogin.asGuest")}
                </ActionButton>
              </form>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Choice({
  help,
  children,
  onPress,
  isPending,
  secondary = false,
}: {
  help: string;
  children: React.ReactNode;
  onPress: () => void;
  isPending: boolean;
  secondary?: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <ActionButton
        variant={secondary ? "secondary" : "primary"}
        onPress={onPress}
        isPending={isPending}
      >
        {children}
      </ActionButton>
      <p className="text-sm text-muted">{help}</p>
    </div>
  );
}

/** /login/device: typing the code a device's login page shows, for a phone without a camera. */
export function EnterCodePage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [code, setCode] = useState("");
  const digits = code.replace(/\D/g, "");
  return (
    <form
      className="flex max-w-md flex-col items-start gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (digits.length === 6) navigate(`/login/device/${digits}`);
      }}
    >
      <h2 className="text-2xl font-semibold">{t("deviceLogin.another")}</h2>
      <TextField value={code} onChange={setCode} inputMode="numeric">
        <Label>{t("deviceLogin.code")}</Label>
        <Input className="font-mono" />
        <Description>{t("deviceLogin.codeHelp")}</Description>
      </TextField>
      <Button type="submit" isDisabled={digits.length !== 6}>
        <Check />
        {t("deviceLogin.continue")}
      </Button>
    </form>
  );
}
