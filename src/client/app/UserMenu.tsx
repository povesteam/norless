import { Button, buttonVariants, Dropdown, Label } from "@heroui/react";
import {
  CircleUser,
  Download,
  Ellipsis,
  Info,
  LogIn,
  Shield,
} from "lucide-react";
import { Focusable } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useRouter } from "wouter";
import type { OnlineMember } from "../../shared/live";
import { useShows } from "../data/community";
import { useInstallPrompt } from "./Install";
import { useMe } from "../data/me";
import { avatarUrl, PersonAvatar } from "../ui/NameAvatar";
import { Tip } from "../ui/tip";

/**
 * "Log in", or the logged-in person's photo (and name, on a laptop's bar), which opens My
 * account. With `appLinks` (the laptop's header), visitors get About, Privacy and Install
 * in a ⋯ menu beside Log in, since the app has no footer; members find them on My
 * account. `compact` (phone bars and Classic's): the photo or initials alone, the name in
 * a tooltip.
 */
export function UserMenu({
  appLinks = false,
  compact = false,
  online,
}: {
  appLinks?: boolean;
  compact?: boolean;
  /** On a phone's community bar: the others online, stacked under the photo. */
  online?: OnlineMember[];
}) {
  const { t } = useTranslation();
  const { me } = useMe();
  // Inside a community's pages, the location is relative to the community.
  const [location] = useLocation();
  const { base } = useRouter();

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
        {appLinks && <VisitorMenu />}
      </>
    );

  const others = online ?? [];
  const label = others.length
    ? t("presence.meAndOthers", {
        name: me.user.displayName,
        count: others.length,
      })
    : me.user.displayName;
  if (!compact)
    return (
      <Link
        href="~/account"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
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
      </Link>
    );
  return (
    <Tip label={label}>
      {/* Focusable gives the tooltip the link's place, as a button would. */}
      <Focusable>
        <Link
          href="~/account"
          aria-label={label}
          className={`${buttonVariants({ isIconOnly: true, variant: "ghost" })} relative overflow-visible rounded-full`}
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
        </Link>
      </Focusable>
    </Tip>
  );
}

/** About, Privacy and Install, in a ⋯ menu beside a visitor's Log in on a laptop. */
function VisitorMenu() {
  const { t } = useTranslation();
  const install = useInstallPrompt();
  const shows = useShows();
  return (
    <Dropdown>
      <Button isIconOnly variant="ghost" size="sm" aria-label={t("app.more")}>
        <Ellipsis />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          onAction={(key) => key === "install" && void install?.prompt()}
        >
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
          {install && shows("install") ? (
            <Dropdown.Item id="install" textValue={t("install.install")}>
              <Download />
              <Label>{t("install.install")}</Label>
            </Dropdown.Item>
          ) : null}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
