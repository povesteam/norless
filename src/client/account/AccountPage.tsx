import {
  Button,
  Checkbox,
  Description,
  Label,
  Modal,
  Switch,
} from "@heroui/react";
import {
  CircleUser,
  ImageUp,
  LogIn,
  LogOut,
  RefreshCw,
  Smartphone,
  UserX,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { ApprovedDevices } from "./DeviceLogin";
import { GuestPass } from "./GuestPass";
import { send } from "../data/fetch";
import { useMe } from "../data/me";
import { MusicianProfile } from "./MusicianProfile";
import { PersonAvatar } from "../ui/NameAvatar";
import {
  ActionButton,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";

/**
 * /account: who is logged in, logging out (here or everywhere), logging in other devices
 * and guests, counting how they use Norless, and deleting the account.
 */
export function AccountPage() {
  const { t } = useTranslation();
  const { me, refresh, savePreferences } = useMe();
  const [failed, setFailed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  // A guest who logs in shows among the devices at once.
  const [devicesLoads, setDevicesLoads] = useState(0);
  if (!me) return <Placeholder lines={3} />;
  if (!me.user)
    return (
      <Link href="/login?next=%2Faccount" className="link">
        <LogIn />
        {t("auth.login")}
      </Link>
    );
  // At the bottom, set apart from the page's settings.
  const logOut = (
    <section className="flex flex-col items-start gap-2 border-t border-separator pt-4">
      <Button variant="secondary" onPress={() => setLoggingOut(true)}>
        <LogOut />
        {t("auth.logout")}
      </Button>
      {loggingOut && <LogOutDialog onClose={() => setLoggingOut(false)} />}
    </section>
  );
  return (
    <article className="flex max-w-2xl flex-col items-start gap-4">
      <h2 className="text-2xl font-semibold">{t("account.title")}</h2>
      <p>
        {me.user.displayName}
        {me.user.email && (
          <span className="text-muted"> · {me.user.email}</span>
        )}
      </p>
      {!me.user.device && <Photo />}
      {failed && <ErrorNotice message={t("states.actionFailed")} />}
      {me.user.device ? (
        // A laptop or a guest's phone: its session ends by itself.
        <>
          <p className="text-muted">{t("deviceLogin.thisDevice")}</p>
          {logOut}
        </>
      ) : (
        <>
          <Link href="/login/device" className="link">
            <Smartphone />
            {t("deviceLogin.another")}
          </Link>
          <ApprovedDevices loads={devicesLoads} />
          <GuestPass onAccepted={() => setDevicesLoads((n) => n + 1)} />
          <MusicianProfile />
          <Switch
            className="border-t border-separator pt-4"
            isSelected={me.preferences.countUsage ?? true}
            onChange={(countUsage) =>
              savePreferences({ ...me.preferences, countUsage })
            }
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label>{t("account.countUsage")}</Label>
            </Switch.Content>
            <Description>{t("account.countUsageHelp")}</Description>
          </Switch>
          {logOut}
          <section className="flex flex-col items-start gap-2 border-t border-separator pt-4">
            <p className="text-muted">{t("account.deleteHelp")}</p>
            <Button
              variant="danger-soft"
              onPress={() => {
                if (!window.confirm(t("auth.confirmDelete"))) return;
                void send("DELETE", "/api/me").then((response) => {
                  if (response?.status === 409)
                    window.alert(t("auth.lastOwner"));
                  else if (response?.ok) refresh();
                  else setFailed(true);
                });
              }}
            >
              <UserX />
              {t("auth.deleteAccount")}
            </Button>
          </section>
        </>
      )}
    </article>
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

/**
 * My account's photo: Google's, updated at each Google login, one
 * uploaded here, or initials. The browser makes an upload small before sending it.
 */
function Photo() {
  const { t } = useTranslation();
  const { me, refresh } = useMe();
  const input = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  const [save, saving] = usePending(async (body: object) => {
    const response = await send("PUT", "/api/me/avatar", body);
    setFailed(!response?.ok);
    if (response?.ok) await refresh();
  });
  if (!me?.user) return null;
  const { avatar, avatarSource, displayName } = me.user;
  return (
    <section className="flex flex-col items-start gap-3">
      <div className="flex items-center gap-3">
        <PersonAvatar name={displayName} avatar={avatar} size="lg" />
        <p className="text-sm text-muted">
          {/* Google's photo comes at the next Google login. */}
          {t(
            `account.photo.${avatarSource === "google" && !avatar ? "none" : (avatarSource ?? "none")}`,
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <ActionButton
          variant="secondary"
          size="sm"
          isPending={saving}
          onPress={() => input.current?.click()}
        >
          <ImageUp />
          {t("account.photo.upload")}
        </ActionButton>
        {/* Only the choices that change something. */}
        {avatarSource !== "initials" && (
          <Button
            variant="secondary"
            size="sm"
            isDisabled={saving}
            onPress={() => void save({ use: "initials" })}
          >
            <CircleUser />
            {t("account.photo.useInitials")}
          </Button>
        )}
        {(avatarSource === "own" || avatarSource === "initials") && (
          <Button
            variant="secondary"
            size="sm"
            isDisabled={saving}
            onPress={() => void save({ use: "google" })}
          >
            <RefreshCw />
            {t("account.photo.useGoogle")}
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        aria-label={t("account.photo.upload")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file)
            void smaller(file).then((photo) =>
              photo ? save({ photo }) : setFailed(true),
            );
        }}
      />
      {failed && <ErrorNotice message={t("account.photo.failed")} />}
    </section>
  );
}

/** A picture at most 512 pixels on its longer side, as a JPEG data URL. */
async function smaller(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return null;
  }
}
