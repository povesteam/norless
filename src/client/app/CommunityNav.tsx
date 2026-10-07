import { Button, buttonVariants, Dropdown, Label } from "@heroui/react";
import { useOthersOnline } from "../live/OnlineMembers";
import { RequestCount } from "../stage/RequestCount";
import { useRef, useState } from "react";
import {
  Guitar,
  Info,
  Lightbulb,
  ListMusic,
  ListTree,
  ClipboardList,
  CalendarDays,
  Menu,
  MicVocal,
  Plus,
  Settings,
  Shield,
  AudioLines,
  ChartColumn,
  ChevronDown,
  Ellipsis,
  FileClock,
  Theater,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { BarPlace, besideTitle, useNameAbove } from "./BarPlace";
import { useCommunity, useShows } from "../data/community";
import { useDeviceType } from "../data/device";
import { InstallLink } from "./Install";
import { LanguagePicker } from "./LanguagePicker";
import { hasRole, useIsMember, useMe, useRoles } from "../data/me";
import { FeedbackDialog } from "./FeedbackDialog";
import { UserMenu } from "./UserMenu";
import { HostIcon, ScreenIcon } from "../ui/icons";
import { useBackCloses } from "../ui/back";
import { Tip } from "../ui/tip";
import { usePageHeld } from "../ui/full-screen";

/** About, Privacy and Install, in a phone's menu (on a laptop, the account menu has them). */
function AppLinks() {
  const { t } = useTranslation();
  return (
    <>
      <Link href="~/about" className="link">
        <Info />
        {t("about.title")}
      </Link>
      <Link href="~/privacy" className="link">
        <Shield />
        {t("privacy.title")}
      </Link>
      <InstallLink />
    </>
  );
}

/**
 * On a phone's bar, one tap to the stage view of what the person plays (Vocals for
 * singers, Instruments for the others); the view's toolbar leads back.
 */
function MyStageView() {
  const { t } = useTranslation();
  const shows = useShows();
  const main = useMe().me?.preferences.musician?.main;
  if (!main || !shows("stageViews")) return null;
  const view = main === "vocals" ? "vocalists" : "musicians";
  const label = t(`${view}.title`);
  return (
    <Tip label={label}>
      <Link
        href={`/${view}`}
        aria-label={label}
        className={buttonVariants({ isIconOnly: true, variant: "ghost" })}
      >
        <ScreenIcon type={view} className="size-5" />
      </Link>
    </Tip>
  );
}

/** The phone's bar at the top of a community's pages. */
export function PhoneBar({ children }: { children?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 flex min-h-[61px] flex-col gap-3 border-b border-separator bg-background px-4 py-2">
      {children}
    </div>
  );
}

/** A page of the community's bar: a link, or the dialog to send an idea. */
type BarItem = {
  id: string;
  icon: React.ReactNode;
  label: string;
  /** Beside the label, e.g. how many ask for a recording. */
  badge?: React.ReactNode;
};
type BarGroup = { id: string; icon: React.ReactNode; items: BarItem[] };

/** "/statistics": a page; "feedback": the dialog for an idea. */
const FEEDBACK = "feedback";

/**
 * The community's pages beyond Playlists, grouped as the bar shows them (app-shell spec,
 * Community bar): only those this person may open at the community's step.
 */
function useBarGroups(): BarGroup[] {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const roles = useRoles(slug);
  const shows = useShows();
  const isMember = useIsMember(slug);
  const owner = hasRole(roles, "owner");
  const item = (
    on: boolean,
    id: string,
    icon: React.ReactNode,
    label: string,
    badge?: React.ReactNode,
  ): BarItem[] => (on ? [{ id, icon, label, badge }] : []);
  return [
    {
      id: "stage",
      icon: <Theater />,
      items: [
        ...item(
          shows("stageViews"),
          "/musicians",
          <Guitar />,
          t("musicians.title"),
        ),
        ...item(
          shows("stageViews"),
          "/vocalists",
          <MicVocal />,
          t("vocalists.title"),
        ),
        ...item(
          shows("stageViews"),
          "/stage",
          <ScreenIcon type="stage" />,
          t("screens.types.stage"),
        ),
        ...item(
          isMember && shows("host"),
          "/host",
          <HostIcon />,
          t("host.title"),
        ),
      ],
    },
    {
      id: "team",
      icon: <Users />,
      items: [
        ...item(
          isMember && shows("serviceRoles"),
          "/team-schedule",
          <ClipboardList />,
          t("team.title"),
        ),
        ...item(
          isMember && shows("serviceRoles"),
          "/my-schedule",
          <CalendarDays />,
          t("team.mine"),
        ),
      ],
    },
    {
      id: "more",
      icon: <Ellipsis />,
      items: [
        ...item(
          isMember && shows("statistics"),
          "/statistics",
          <ChartColumn />,
          t("statistics.title"),
        ),
        ...item(
          hasRole(roles, "team") && shows("recordings"),
          "/recordings",
          <AudioLines />,
          t("recordings.title"),
          <RequestCount slug={slug} />,
        ),
        ...item(isMember, "/features", <ListTree />, t("featureTree.title")),
        ...item(
          hasRole(roles, "editor"),
          "/songs/new",
          <Plus />,
          t("editor.newSong"),
        ),
        // Owners read the ideas on their page, and send theirs from there.
        ...item(
          isMember && shows("feedback"),
          owner ? "/ideas" : FEEDBACK,
          <Lightbulb />,
          t(owner ? "feedback.title" : "feedback.open"),
        ),
        ...item(
          owner && shows("changes"),
          "/changes",
          <FileClock />,
          t("changes.title"),
        ),
        ...item(owner, "/settings", <Settings />, t("settings.title")),
      ],
    },
  ].filter((group) => group.items.length > 0);
}

/**
 * The community's bar, on every page of the community while the app frame is on: its name,
 * Playlists, the other pages in menus, the language and the account. On a phone, the name
 * and a burger menu that holds the rest.
 */
export function CommunityNav() {
  const { t } = useTranslation();
  const { name, theme, slug } = useCommunity();
  const shows = useShows();
  const groups = useBarGroups();
  const phone = useDeviceType().deviceType === "phone";
  const above = useNameAbove(phone);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [location] = useLocation();
  // Going to another page closes the menu.
  const [seen, setSeen] = useState(location);
  if (location !== seen) {
    setSeen(location);
    setOpen(false);
  }
  // Who's online, stacked under the photo on a phone.
  const others = useOthersOnline();
  // Back closes the phone's menu, a page of its own under the bar.
  useBackCloses(open, () => setOpen(false));
  usePageHeld(open);
  const row = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const home = (
    <Link
      href="/"
      // On a phone it gives way first to a playlist's title, muted after it.
      className={`flex items-center gap-2 text-lg font-semibold ${
        phone ? `min-w-0 shrink-[100] ${besideTitle}` : "shrink-0"
      }`}
    >
      {shows("theme") && theme?.logo && (
        <img src={theme.logo} alt="" className="h-8 w-auto" />
      )}
      <span className="truncate">{name}</span>
    </Link>
  );
  const playlists = (
    <Link href="/playlists" className="link">
      <ListMusic />
      {t("playlists.title")}
    </Link>
  );
  const link = (item: BarItem) =>
    item.id === FEEDBACK ? (
      <Button
        key={item.id}
        variant="ghost"
        className="h-auto min-w-0 justify-start p-0"
        onPress={() => setFeedback(true)}
      >
        {item.icon}
        {item.label}
      </Button>
    ) : (
      <Link key={item.id} href={item.id} className="link">
        {item.icon}
        {item.label}
        {item.badge}
      </Link>
    );
  const dialog = feedback && (
    <FeedbackDialog onClose={() => setFeedback(false)} />
  );
  if (!phone)
    return (
      <header className="flex items-center gap-4">
        <nav
          aria-label={name}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1"
        >
          {home}
          <BarPlace place="title" />
          {playlists}
          {groups.map((group) => {
            const [only] = group.items;
            if (only && group.items.length === 1) return link(only);
            return (
              <Dropdown key={group.id}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative font-medium"
                >
                  {group.icon}
                  {t(`app.${group.id}`)}
                  <ChevronDown />
                  {/* On the corner, so the button keeps its width while it's empty. */}
                  <span className="absolute -end-2 -top-1">
                    {group.items.map((i) => i.badge)}
                  </span>
                </Button>
                <Dropdown.Popover placement="bottom start">
                  <Dropdown.Menu
                    aria-label={t(`app.${group.id}`)}
                    // Pages are links (href); the idea's dialog opens here.
                    onAction={(key) => key === FEEDBACK && setFeedback(true)}
                  >
                    {group.items.map((item) => (
                      <Dropdown.Item
                        key={item.id}
                        id={item.id}
                        href={
                          item.id === FEEDBACK
                            ? undefined
                            : `/${slug}${item.id}`
                        }
                        textValue={item.label}
                      >
                        {item.icon}
                        <Label>{item.label}</Label>
                        {item.badge}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <LanguagePicker />
          <UserMenu appLinks />
        </div>
        {dialog}
      </header>
    );
  return (
    <PhoneBar>
      {/* With a playlist open, the community's name above, centered. */}
      {above && (
        <Link
          href="/"
          className="-mb-2 truncate text-center text-xs text-muted"
        >
          {name}
        </Link>
      )}
      {/* ☰ first, the photo last, as in Classic's bar. */}
      <div ref={row} className="group/bar flex items-center gap-2">
        <Button
          isIconOnly
          variant="ghost"
          aria-label={t("app.menu")}
          aria-expanded={open}
          aria-controls="phone-menu"
          onPress={() => {
            setTop((row.current?.getBoundingClientRect().bottom ?? 0) + 8);
            setOpen(!open);
          }}
        >
          <Menu className="size-6" />
        </Button>
        <BarPlace place="title" />
        {!above && home}
        <div className="ms-auto flex shrink-0 items-center gap-2">
          <MyStageView />
          <UserMenu compact online={others} />
        </div>
      </div>
      {open && (
        <div
          id="phone-menu"
          // The rest of the screen, scrolling on its own.
          className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-4 overflow-y-auto overscroll-contain bg-background px-4 pb-4"
          style={{ top }}
        >
          <nav
            aria-label={name}
            className="menu-rows flex flex-col gap-1 text-lg"
          >
            {playlists}
            {groups.map((group) => (
              <section
                key={group.id}
                aria-label={t(`app.${group.id}`)}
                className="menu-rows flex flex-col"
              >
                <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {t(`app.${group.id}`)}
                </h2>
                {group.items.map(link)}
              </section>
            ))}
          </nav>
          <LanguagePicker />
          <nav
            aria-label={t("app.more")}
            className="menu-rows flex flex-col text-muted"
          >
            <AppLinks />
          </nav>
        </div>
      )}
      {dialog}
    </PhoneBar>
  );
}
