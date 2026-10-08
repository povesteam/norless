import {
  BookOpen,
  ChevronRight,
  Guitar,
  CalendarClock,
  ClipboardList,
  type LucideIcon,
  MonitorPlay,
  Palette,
  PanelTop,
  Save,
  Shield,
  ThumbsDown,
  Users,
} from "lucide-react";
import { Description, Input, Label, Tabs, TextField } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useDeviceType } from "../data/device";
import type { PrivacyContact } from "../../server/community/privacy";
import { bibleVersions } from "../../shared/bible";
import {
  Shown,
  useCommunity,
  useReloadCommunity,
  useShows,
} from "../data/community";
import { send, useJson } from "../data/fetch";
import { hasRole, useRoles } from "../data/me";
import { MembersPage } from "./MembersPage";
import { RolesSettings } from "../team/RolesSettings";
import { SongFeedbackSettings } from "../songs/SongFeedback";
import { MusicSettings } from "../account/MusicianProfile";
import { YouTubeChannelSettings } from "../playlists/Chapters";
import { CalendarSettings } from "../team/ChurchCalendar";
import { ActionButton, ErrorNotice, usePending } from "../ui/states";
import { Choice } from "../ui/choice";
import { Schedule } from "./ScheduleSettings";
import { Screens } from "./ScreenSettings";
import { Pages } from "./PageSettings";
import { WelcomeSettings } from "./WelcomeSettings";
import { ThemeSettings } from "./ThemeSettings";

/** The settings' tabs, each with its own URL: its title, icon and content. */
const tabs: Record<
  string,
  { title: string; Icon: LucideIcon; Content: () => React.ReactNode }
> = {
  members: { title: "members.title", Icon: Users, Content: MembersPage },
  theme: { title: "theme.title", Icon: Palette, Content: ThemeSettings },
  privacy: { title: "privacy.title", Icon: Shield, Content: PrivacySettings },
  schedule: {
    title: "schedule.title",
    Icon: CalendarClock,
    Content: () => (
      <div className="flex flex-col gap-8">
        <Schedule />
        <YouTubeChannelSettings />
        <Shown feature="churchCalendar">
          <CalendarSettings />
        </Shown>
      </div>
    ),
  },
  screens: { title: "screens.title", Icon: MonitorPlay, Content: Screens },
  pages: {
    title: "pages.title",
    Icon: PanelTop,
    Content: () => (
      <div className="flex flex-col gap-8">
        <Shown feature="welcome">
          <WelcomeSettings />
        </Shown>
        <Pages />
      </div>
    ),
  },
  bible: { title: "bible.title", Icon: BookOpen, Content: BibleSettings },
  music: {
    title: "instruments.settingsTitle",
    Icon: Guitar,
    Content: MusicSettings,
  },
  songs: {
    title: "opinions.title",
    Icon: ThumbsDown,
    Content: SongFeedbackSettings,
  },
  // The team schedule's roles.
  roles: { title: "team.roles", Icon: ClipboardList, Content: RolesSettings },
};

/**
 * /settings/<tab>, for owners: members, theme, privacy contact, schedule, screens and
 * pages, one tab each; the members first. Features are switched in
 * the feature graph, where the old interface tab leads.
 */
export function SettingsPage({ tab }: { tab?: string }) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const [, navigate] = useLocation();
  const shows = useShows();
  const roles = useRoles(slug);
  const phone = useDeviceType().deviceType === "phone";
  if (!hasRole(roles, "owner")) return <p>{t("settings.ownersOnly")}</p>;
  const shown = Object.entries(tabs).filter(
    ([id]) =>
      (id !== "songs" || shows("songFeedback")) &&
      (id !== "roles" || shows("serviceRoles")),
  );
  const current = tab && shown.some(([id]) => id === tab) ? tab : "members";
  // On a phone, the sections as a list, each opening on its own page, which the bar's
  // back button leaves;
  // elsewhere, a list at the side.
  if (phone) {
    const section = tab && tabs[current];
    if (!section)
      return (
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">{t("settings.title")}</h2>
          <nav aria-label={t("settings.title")}>
            <ul className="divide-y divide-separator">
              {shown.map(([id, { title, Icon }]) => (
                <li key={id}>
                  <Link
                    href={`/settings/${id}`}
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
        </div>
      );
    // The bar's back button leads to the list.
    const { title, Content } = section;
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">{t(title)}</h2>
        <Content />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">{t("settings.title")}</h2>
      <Tabs
        orientation="vertical"
        className="items-start gap-6"
        selectedKey={current}
        onSelectionChange={(key) => navigate(`/settings/${String(key)}`)}
      >
        <Tabs.ListContainer className="sticky top-4 shrink-0">
          <Tabs.List aria-label={t("settings.title")}>
            {shown.map(([id, { title, Icon }]) => (
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
        {shown.map(([id, { Content }]) => (
          <Tabs.Panel key={id} id={id} className="min-w-0 flex-1">
            <Content />
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}

/** Who answers for the community's personal data, for the privacy notice. */
function PrivacySettings() {
  const { slug } = useCommunity();
  const privacy = useJson<{
    communities: { slug: string; contact: PrivacyContact }[];
  }>("/api/privacy").data;
  const saved = privacy?.communities.find((c) => c.slug === slug)?.contact;
  if (!saved) return null;
  return <PrivacyForm key={JSON.stringify(saved)} saved={saved} />;
}

function PrivacyForm({ saved }: { saved: PrivacyContact }) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const [contact, setContact] = useState(saved);
  const [state, setState] = useState<"saved" | "failed" | null>(null);
  const [save, saving] = usePending(async () => {
    const response = await send("PUT", `/api/communities/${slug}/privacy`, {
      name: contact.name ?? "",
      address: contact.address ?? "",
      email: contact.email ?? "",
    });
    setState(response?.ok ? "saved" : "failed");
  });
  const field = (key: keyof PrivacyContact, type = "text") => (
    <TextField
      type={type}
      value={contact[key] ?? ""}
      onChange={(value) => {
        setContact({ ...contact, [key]: value });
        setState(null);
      }}
    >
      <Label>{t(`settings.privacy.${key}`)}</Label>
      <Input />
    </TextField>
  );
  return (
    <section aria-labelledby="privacy-title" className="flex flex-col gap-4">
      <h3 id="privacy-title" className="text-xl font-semibold">
        {t("settings.privacy.title")}
      </h3>
      <p className="text-sm text-muted">{t("settings.privacy.help")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name")}
        {field("address")}
        {field("email", "email")}
      </div>
      {state === "failed" && <ErrorNotice message={t("states.actionFailed")} />}
      <div className="flex items-center gap-3">
        <ActionButton isPending={saving} onPress={() => void save()}>
          <Save />
          {t("settings.privacy.save")}
        </ActionButton>
        <span className="text-sm text-muted" aria-live="polite">
          {state === "saved" ? t("editor.saved") : ""}
        </span>
      </div>
    </section>
  );
}

/**
 * The bible.com version the playlist's Bible links open, per community language: one
 * of the common ones, or any other by its id on bible.com.
 */
function BibleSettings() {
  const { t, i18n } = useTranslation();
  const { slug, languages, bibleVersions: saved = {} } = useCommunity();
  const reload = useReloadCommunity();
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  const [chosen, setChosen] = useState<Record<string, string>>(
    Object.fromEntries(
      languages.map((l) => [
        l,
        String(saved[l] ?? bibleVersions[l]?.[0]?.id ?? ""),
      ]),
    ),
  );
  // "other" until an id is typed, then the id.
  const [other, setOther] = useState<Record<string, boolean>>(
    Object.fromEntries(
      languages.map((l) => [
        l,
        !!saved[l] && !bibleVersions[l]?.some((v) => v.id === saved[l]),
      ]),
    ),
  );
  const [state, setState] = useState<"saved" | "failed" | null>(null);
  const ids = Object.fromEntries(
    languages.map((l) => [l, Number(chosen[l])] as const),
  );
  const invalid = languages.some(
    (l) => !Number.isInteger(ids[l]) || (ids[l] ?? 0) < 1,
  );
  const [save, saving] = usePending(async () => {
    const response = await send(
      "PUT",
      `/api/communities/${slug}/bible-versions`,
      { versions: ids },
    );
    setState(response?.ok ? "saved" : "failed");
    if (response?.ok) reload();
  });
  return (
    <section aria-labelledby="bible-title" className="flex flex-col gap-4">
      <h3 id="bible-title" className="text-xl font-semibold">
        {t("bible.title")}
      </h3>
      <p className="text-sm text-muted">{t("bible.help")}</p>
      {languages.map((language) => (
        <div key={language} className="grid gap-4 sm:grid-cols-2">
          <Choice
            label={names.of(language) ?? language}
            value={other[language] ? "other" : (chosen[language] ?? "")}
            onChange={(value) => {
              setState(null);
              setOther({ ...other, [language]: value === "other" });
              setChosen({
                ...chosen,
                [language]: value === "other" ? "" : value,
              });
            }}
            options={[
              ...(bibleVersions[language] ?? []).map((v) => ({
                id: String(v.id),
                name: `${v.abbreviation}, ${v.name}`,
              })),
              { id: "other", name: t("bible.other") },
            ]}
          />
          {other[language] && (
            <TextField
              value={chosen[language] ?? ""}
              onChange={(value) => {
                setState(null);
                setChosen({ ...chosen, [language]: value.trim() });
              }}
            >
              <Label>{t("bible.id")}</Label>
              <Input inputMode="numeric" />
              <Description>{t("bible.idHelp")}</Description>
            </TextField>
          )}
        </div>
      ))}
      {state === "failed" && <ErrorNotice message={t("states.actionFailed")} />}
      <div className="flex items-center gap-3">
        <ActionButton
          isPending={saving}
          isDisabled={invalid}
          onPress={() => void save()}
        >
          <Save />
          {t("bible.save")}
        </ActionButton>
        <span className="text-sm text-muted" aria-live="polite">
          {state === "saved" ? t("editor.saved") : ""}
        </span>
      </div>
    </section>
  );
}
