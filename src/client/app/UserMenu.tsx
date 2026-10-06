import { Button, Dropdown, Header, Label, Separator } from "@heroui/react";
import {
  ChartColumn,
  CircleUser,
  Download,
  Ellipsis,
  Info,
  Lightbulb,
  LogIn,
  Shield,
  UserCog,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useRouter } from "wouter";
import { type DeviceType, deviceTypes } from "../../shared/preferences";
import { useDeviceType } from "../data/device";
import { DeviceIcon } from "../ui/icons";
import { useShows } from "../data/community";
import { useInstallPrompt } from "./Install";
import { useMe } from "../data/me";
import { avatarUrl, PersonAvatar } from "../ui/NameAvatar";
import { Tip } from "../ui/tip";

/**
 * "Log in", or the logged-in person's name with My account and the device type. With
 * `appLinks` (the laptop's header), About, Privacy and Install too: in the account menu,
 * or for visitors in a ⋯ menu beside Log in, since the app has no footer. `compact`
 * (phone bars and Classic's): the photo or initials alone, the name
 * in a tooltip.
 */
export function UserMenu({
  appLinks = false,
  compact = false,
}: {
  appLinks?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { me } = useMe();
  // Inside a community's pages, the location is relative to the community.
  const [location, navigate] = useLocation();
  const { base } = useRouter();
  const { deviceType, setDeviceType } = useDeviceType();
  const install = useInstallPrompt();
  const shows = useShows();
  const canInstall = !!install && shows("install");
  const openLink = (key: unknown) => {
    if (key === "about") navigate("~/about");
    if (key === "privacy") navigate("~/privacy");
    if (key === "install") void install?.prompt();
  };
  const links = appLinks ? (
    <Dropdown.Section>
      <Dropdown.Item id="about" textValue={t("about.title")}>
        <Info />
        <Label>{t("about.title")}</Label>
      </Dropdown.Item>
      <Dropdown.Item id="privacy" textValue={t("privacy.title")}>
        <Shield />
        <Label>{t("privacy.title")}</Label>
      </Dropdown.Item>
      {canInstall ? (
        <Dropdown.Item id="install" textValue={t("install.install")}>
          <Download />
          <Label>{t("install.install")}</Label>
        </Dropdown.Item>
      ) : null}
    </Dropdown.Section>
  ) : null;

  if (!me) return null;
  if (!me.user)
    return (
      <>
        {/* Not on the login page itself. */}
        {!(base + location).startsWith("/login") && (
          <Link
            href={`~/login?next=${encodeURIComponent(base + location)}`}
            className="link text-sm"
          >
            <LogIn />
            {t("auth.login")}
          </Link>
        )}
        {appLinks && (
          <Dropdown>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              aria-label={t("app.more")}
            >
              <Ellipsis />
            </Button>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu onAction={openLink}>{links}</Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        )}
      </>
    );

  return (
    <Dropdown>
      {compact ? (
        <Tip label={me.user.displayName}>
          <Button
            isIconOnly
            variant="ghost"
            aria-label={me.user.displayName}
            className="rounded-full"
          >
            <PersonAvatar name={me.user.displayName} avatar={me.user.avatar} />
          </Button>
        </Tip>
      ) : (
        <Button variant="ghost" size="sm">
          {me.user.avatar ? (
            <img
              src={avatarUrl(me.user.avatar)}
              alt=""
              className="size-5 rounded-full object-cover"
            />
          ) : (
            <CircleUser />
          )}
          {me.user.displayName}
        </Button>
      )}
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          onAction={(key) => {
            // Logging out, here or everywhere, and deleting the account are on that page.
            if (key === "account") navigate("~/account");
            if (key === "app-ideas") navigate("~/app-ideas");
            if (key === "app-usage") navigate("~/app-usage");
            openLink(key);
          }}
        >
          <Dropdown.Item id="account" textValue={t("account.title")}>
            <UserCog />
            <Label>{t("account.title")}</Label>
          </Dropdown.Item>
          {me.appTeam ? (
            <Dropdown.Item id="app-ideas" textValue={t("feedback.appMenu")}>
              <Lightbulb />
              <Label>{t("feedback.appMenu")}</Label>
            </Dropdown.Item>
          ) : null}
          {me.appTeam ? (
            <Dropdown.Item id="app-usage" textValue={t("usage.menu")}>
              <ChartColumn />
              <Label>{t("usage.menu")}</Label>
            </Dropdown.Item>
          ) : null}
          <Separator />
          {/* Layouts and preferences follow the device type, which can be corrected here. */}
          <Dropdown.Section
            selectionMode="single"
            selectedKeys={[deviceType]}
            onSelectionChange={(keys) => {
              const [key] = keys === "all" ? [] : keys;
              if (key !== undefined) setDeviceType(key as DeviceType);
            }}
          >
            <Header>{t("device.title")}</Header>
            {deviceTypes.map((type) => (
              <Dropdown.Item
                key={type}
                id={type}
                textValue={t(`device.${type}`)}
              >
                <Dropdown.ItemIndicator type="dot" />
                <DeviceIcon type={type} />
                <Label>{t(`device.${type}`)}</Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
          {links ? <Separator /> : null}
          {links}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
