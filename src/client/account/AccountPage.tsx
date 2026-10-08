import {
  Button,
  Description,
  Label,
  Switch,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import {
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  CircleUser,
  Download,
  Guitar,
  ImageUp,
  Info,
  KeyRound,
  Lightbulb,
  LogIn,
  MonitorSmartphone,
  RefreshCw,
  Shield,
  UserX,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { LoginsTab } from "./Logins";
import { send, useJson } from "../data/fetch";
import {
  type Community,
  lastCommunity,
  switchesOf,
  useShows,
} from "../data/community";
import { useDeviceType } from "../data/device";
import { shows } from "../../shared/features";
import { type DeviceType, deviceTypes } from "../../shared/preferences";
import { OfflineSwitch } from "../app/Offline";
import { useInstallPrompt } from "../app/Install";
import { DeviceIcon } from "../ui/icons";
import { useMe } from "../data/me";
import { MusicianProfile } from "./MusicianProfile";
import { PersonAvatar } from "../ui/NameAvatar";
import {
  ActionButton,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";

/** My account's tabs, each with its own URL; a laptop's or a guest's login has two. */
const tabs = [
  { id: "profile", title: "account.tabs.profile", Icon: CircleUser },
  { id: "music", title: "account.tabs.music", Icon: Guitar },
  { id: "logins", title: "account.tabs.logins", Icon: KeyRound, device: true },
  {
    id: "device",
    title: "live.thisDevice",
    Icon: MonitorSmartphone,
    device: true,
  },
  { id: "about", title: "account.tabs.about", Icon: Info },
] as const;
type Tab = (typeof tabs)[number]["id"];

/**
 * /account/<tab>, which the person's photo opens, in tabs as Settings: Profile (who is
 * logged in, the photo, counting usage, deleting the account), Music, Logins, This device,
 * and About (the app team's pages, About, Privacy and Install). On a phone, a list whose
 * sections open on their own pages.
 */
export function AccountPage({ tab }: { tab?: string }) {
  const { t } = useTranslation();
  const { me } = useMe();
  const [, navigate] = useLocation();
  const phone = useDeviceType().deviceType === "phone";
  if (!me) return <Placeholder lines={3} />;
  if (!me.user)
    return (
      <Link href="/login?next=%2Faccount" className="link">
        <LogIn />
        {t("auth.login")}
      </Link>
    );
  const shown = tabs.filter((s) => !me.user?.device || "device" in s);
  const current = shown.find((s) => s.id === tab) ?? shown[0];
  const content = (id: Tab) =>
    id === "profile" ? (
      <Profile />
    ) : id === "music" ? (
      <MusicianProfile />
    ) : id === "logins" ? (
      <LoginsTab />
    ) : id === "device" ? (
      <ThisDevice />
    ) : (
      <div className="flex flex-col items-start gap-4">
        {me.appTeam && <AppTeamLinks />}
        <AppLinks />
      </div>
    );
  // Who is logged in, above every tab.
  const title = (
    <>
      <h2 className="text-2xl font-semibold">{t("account.title")}</h2>
      <p>
        {me.user.displayName}
        {me.user.email && (
          <span className="text-muted"> · {me.user.email}</span>
        )}
      </p>
    </>
  );
  if (phone) {
    // The list, each section on its own page with a way back to it.
    if (!tab || !current || current.id !== tab)
      return (
        <article className="flex flex-col gap-4">
          {title}
          <nav aria-label={t("account.title")}>
            <ul className="divide-y divide-separator">
              {shown.map(({ id, title, Icon }) => (
                <li key={id}>
                  <Link
                    href={`/account/${id}`}
                    className="flex items-center gap-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
                  >
                    <Icon className="size-5 text-muted" />
                    <span className="flex-1">{t(title)}</span>
                    <ChevronRight className="size-5 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </article>
      );
    return (
      <article className="flex flex-col items-start gap-4">
        <Link href="/account" className="link">
          <ChevronLeft />
          {t("account.title")}
        </Link>
        <h2 className="text-2xl font-semibold">{t(current.title)}</h2>
        {content(current.id)}
      </article>
    );
  }
  return (
    <article className="flex flex-col gap-4">
      {title}
      <Tabs
        orientation="vertical"
        className="items-start gap-6"
        selectedKey={current?.id}
        onSelectionChange={(key) => navigate(`/account/${String(key)}`)}
      >
        <Tabs.ListContainer className="sticky top-4 shrink-0">
          <Tabs.List aria-label={t("account.title")}>
            {shown.map(({ id, title, Icon }) => (
              <Tabs.Tab
                key={id}
                id={id}
                className="justify-start gap-1.5 whitespace-nowrap"
              >
                <Icon />
                {t(title)}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {shown.map(({ id }) => (
          <Tabs.Panel key={id} id={id} className="max-w-2xl min-w-0 flex-1">
            {content(id)}
          </Tabs.Panel>
        ))}
      </Tabs>
    </article>
  );
}

/** Their photo, counting how they use Norless, and deleting the account. */
function Profile() {
  const { t } = useTranslation();
  const { me, refresh, savePreferences } = useMe();
  const [failed, setFailed] = useState(false);
  if (!me?.user) return null;
  return (
    <div className="flex flex-col items-start gap-4">
      <Photo />
      {failed && <ErrorNotice message={t("states.actionFailed")} />}
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
      <section className="flex flex-col items-start gap-2 border-t border-separator pt-4">
        <p className="text-muted">{t("account.deleteHelp")}</p>
        <Button
          variant="danger-soft"
          onPress={() => {
            if (!window.confirm(t("auth.confirmDelete"))) return;
            void send("DELETE", "/api/me").then((response) => {
              if (response?.status === 409) window.alert(t("auth.lastOwner"));
              else if (response?.ok) refresh();
              else setFailed(true);
            });
          }}
        >
          <UserX />
          {t("auth.deleteAccount")}
        </Button>
      </section>
    </div>
  );
}

/**
 * What concerns only this device: its type, which picks layouts and preferences, and
 * keeping the songs of the community it opened last for offline.
 */
function ThisDevice() {
  const { t } = useTranslation();
  const { deviceType, setDeviceType } = useDeviceType();
  const last = lastCommunity();
  const community = useJson<Community>(
    last ? `/api/communities/${last}` : null,
  ).data;
  return (
    <section
      aria-label={t("live.thisDevice")}
      className="flex flex-col items-start gap-3 border-t border-separator pt-4"
    >
      <h3 className="text-lg font-semibold">{t("live.thisDevice")}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <span>{t("device.title")}</span>
        <ToggleButtonGroup
          aria-label={t("device.title")}
          selectionMode="single"
          disallowEmptySelection
          size="sm"
          selectedKeys={[deviceType]}
          onSelectionChange={(keys) => {
            const [key] = keys;
            if (key !== undefined) setDeviceType(key as DeviceType);
          }}
        >
          {deviceTypes.map((type, i) => (
            <ToggleButton key={type} id={type}>
              {i > 0 && <ToggleButtonGroup.Separator />}
              <DeviceIcon type={type} />
              {t(`device.${type}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      {community && shows(switchesOf(community), "offline") && (
        <OfflineSwitch slug={community.slug} name={community.name} />
      )}
    </section>
  );
}

/** The app team's pages: the ideas sent to them and how Norless is used. */
function AppTeamLinks() {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("account.appTeam")}
      className="flex flex-col items-start gap-2 border-t border-separator pt-4"
    >
      <Link href="/app-ideas" className="link">
        <Lightbulb />
        {t("feedback.appMenu")}
      </Link>
      <Link href="/app-usage" className="link">
        <ChartColumn />
        {t("usage.menu")}
      </Link>
    </nav>
  );
}

/** About, Privacy and Install, at the bottom, since the app has no footer. */
function AppLinks() {
  const { t } = useTranslation();
  const install = useInstallPrompt();
  const shown = useShows();
  return (
    <nav
      aria-label={t("app.more")}
      className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-separator pt-4"
    >
      <Link href="/about" className="link">
        <Info />
        {t("about.title")}
      </Link>
      <Link href="/privacy" className="link">
        <Shield />
        {t("privacy.title")}
      </Link>
      {install && shown("install") && (
        <Button variant="ghost" size="sm" onPress={() => void install.prompt()}>
          <Download />
          {t("install.install")}
        </Button>
      )}
    </nav>
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
