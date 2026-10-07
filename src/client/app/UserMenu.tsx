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
import type { OnlineMember } from "../../shared/live";
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
  online,
}: {
  appLinks?: boolean;
  compact?: boolean;
  /**
   * On a phone's community bar: the others online, stacked under the photo, and at the
   * top of the menu, which fills the screen.
   */
  online?: OnlineMember[];
}) {
  const { t } = useTranslation();
  const { me } = useMe();
  // Inside a community's pages, the location is relative to the community.
  const [location] = useLocation();
  const { base } = useRouter();
  const { deviceType, setDeviceType } = useDeviceType();
  const install = useInstallPrompt();
  const shows = useShows();
  const canInstall = !!install && shows("install");
  const openLink = (key: unknown) => {
    if (key === "install") void install?.prompt();
  };
  const links = appLinks ? (
    <Dropdown.Section>
      <Dropdown.Item id="about" href="/about" textValue={t("about.title")}>
        <Info />
        <Label>{t("about.title")}</Label>
      </Dropdown.Item>
      <Dropdown.Item
        id="privacy"
        href="/privacy"
        textValue={t("privacy.title")}
      >
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

  const others = online ?? [];
  const label = others.length
    ? t("presence.meAndOthers", {
        name: me.user.displayName,
        count: others.length,
      })
    : me.user.displayName;
  return (
    <Dropdown>
      {compact ? (
        <Tip label={label}>
          <Button
            isIconOnly
            variant="ghost"
            aria-label={label}
            className="relative overflow-visible rounded-full"
          >
            <PersonAvatar name={me.user.displayName} avatar={me.user.avatar} />
            {/* The others online, small, stacked under the photo. */}
            {others.length > 0 && (
              <span
                aria-hidden
                className="absolute start-1/2 -bottom-2.5 flex -translate-x-1/2 -space-x-2"
              >
                {others.slice(0, 3).map((person) => (
                  <PersonAvatar
                    key={person.userId}
                    name={person.name}
                    avatar={person.avatar}
                    className="size-5 text-[0.5rem] ring-2 ring-background"
                  />
                ))}
              </span>
            )}
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
      <Dropdown.Popover
        placement="bottom end"
        // With the others online, on a phone: a page of its own, who's online on top.
        className={
          online
            ? "max-sm:!fixed max-sm:!inset-0 max-sm:!max-h-none max-sm:!w-screen max-sm:!max-w-none max-sm:overflow-y-auto max-sm:rounded-none"
            : undefined
        }
      >
        {/* As tall as the bar: the tap that opened it lands here, not on an item. */}
        {online && (
          <p className="flex h-16 items-center gap-2 px-3 font-semibold sm:hidden">
            <PersonAvatar name={me.user.displayName} avatar={me.user.avatar} />
            {me.user.displayName}
          </p>
        )}
        {others.length > 0 && (
          <section
            aria-label={t("presence.online")}
            className="flex flex-col gap-2 border-b border-separator p-3"
          >
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
              {t("presence.online")}
            </h2>
            {others.map((person) => (
              <p key={person.userId} className="flex items-center gap-2">
                <PersonAvatar name={person.name} avatar={person.avatar} />
                <span className="min-w-0 flex-1 truncate">{person.name}</span>
                <span className="text-sm text-muted">
                  {[
                    ...person.devices.map((d) => t(`presence.${d}`)),
                    ...person.views.map((v) => t(`${v.view}.title`)),
                  ].join(", ")}
                </span>
              </p>
            ))}
          </section>
        )}
        <Dropdown.Menu
          onAction={(key) => {
            // The pages are links (href); logging out, here or everywhere, and deleting
            // the account are on My account.
            openLink(key);
          }}
        >
          <Dropdown.Item
            id="account"
            href="/account"
            textValue={t("account.title")}
          >
            <UserCog />
            <Label>{t("account.title")}</Label>
          </Dropdown.Item>
          {me.appTeam ? (
            <Dropdown.Item
              id="app-ideas"
              href="/app-ideas"
              textValue={t("feedback.appMenu")}
            >
              <Lightbulb />
              <Label>{t("feedback.appMenu")}</Label>
            </Dropdown.Item>
          ) : null}
          {me.appTeam ? (
            <Dropdown.Item
              id="app-usage"
              href="/app-usage"
              textValue={t("usage.menu")}
            >
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
