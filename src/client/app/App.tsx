import { Alert, buttonVariants } from "@heroui/react";
import { MyNextLine } from "../team/MyNextLine";
import { Suspense, useEffect } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PlaylistSummary } from "../../server/playlists/playlists";
import {
  Link,
  Redirect,
  Route,
  Switch,
  useLocation,
  useSearchParams,
} from "wouter";
import { ClassicBar } from "../live/Classic";
import {
  CommunityProvider,
  lastCommunity,
  Shown,
  useCommunity,
  useShows,
} from "../data/community";
import { OfflineKeeper } from "./Offline";
import { ConnectionStatus } from "./ConnectionStatus";
import { useDeviceType } from "../data/device";
import { InstallSuggestion } from "./Install";
import { LanguagePicker } from "./LanguagePicker";
import { hasRole, useIsMember, useMe, useRoles } from "../data/me";
import { NotFound } from "./NotFound";
import { SearchBox } from "../playlists/SearchBox";
import { Shortcuts } from "./Shortcuts";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { InPageProjector } from "../screens/Projector";
import { NearbyLogins } from "../account/NearbyLogins";
import { NoPlaylists } from "../playlists/NewPlaylist";
import { Empty, ErrorNotice, Placeholder } from "../ui/states";
import { useFollowView } from "../screens/Follow";
import { UserMenu } from "./UserMenu";
import { WhatsNew } from "./WhatsNew";
import { PhoneBar, CommunityNav } from "./CommunityNav";
import {
  RecordingPage,
  RecordingsPage,
  StatisticsPage,
  ChangesPage,
  FeaturesPage,
  MySchedulePage,
  TeamSchedulePage,
  HostPage,
  AboutPage,
  AccountPage,
  LoginLinkPage,
  DevGooglePage,
  LoginPage,
  AppIdeasPage,
  IdeasPage,
  UsagePage,
  SettingsPage,
  PlaylistPage,
  PrivacyPage,
  PairCodePage,
  ApproveDevicePage,
  EnterCodePage,
  GuestPage,
  PlaylistsPage,
  ChordsPage,
  SongEditor,
  SongEditPage,
  SongPage,
} from "./pages";

/**
 * The app with its frame: the start page, the top-level pages and the community's pages.
 * Screens and the follow-along page don't need it (Root.tsx).
 */
export function App() {
  // On a phone, a community's pages have one bar with a burger menu instead.
  const phone = useDeviceType().deviceType === "phone";
  const [location] = useLocation();
  // Community pages bring their own frame, by the community's switches.
  const top = location.split("/")[1] ?? "";
  const inCommunity = ![
    "",
    "login",
    "about",
    "privacy",
    "account",
    "app-ideas",
    "app-usage",
    "pair",
    "guest",
  ].includes(top);
  // Live views (a playlist, the host's) use the whole window; pages to read stay
  // 1280 pixels wide at most, so their lines stay short.
  const live =
    inCommunity && /^\/[^/]+(\/playlists\/[^/]+|\/host)?\/?$/.test(location);
  return (
    <>
      <div
        className={`mx-auto flex w-full flex-col gap-4 px-4 ${
          live ? "" : "max-w-7xl"
        } ${phone ? "pb-4" : "py-8"}`}
      >
        <Shown feature="install">
          <InstallSuggestion />
        </Shown>
        <NearbyLogins />
        {/* Not while the start page opens the last community: the
          installed app would flash this header first. */}
        {!inCommunity && !(top === "" && lastCommunity()) && <AppHeader />}
        <Suspense fallback={<Placeholder />}>
          <Switch>
            <Route path="/">
              <StartPage />
            </Route>
            {/* Top-level pages are names community slugs can't take. */}
            <Route path="/login">
              <LoginPage />
            </Route>
            <Route path="/dev/google">
              <DevGooglePage />
            </Route>
            <Route path="/login/link/:token">
              {({ token }) => <LoginLinkPage token={token} />}
            </Route>
            <Route path="/login/device">
              <EnterCodePage />
            </Route>
            <Route path="/login/device/:code">
              {({ code }) => <ApproveDevicePage code={code} />}
            </Route>
            <Route path="/guest/:code">
              {({ code }) => <GuestPage code={code} />}
            </Route>
            <Route path="/about">
              <AboutPage />
            </Route>
            <Route path="/privacy">
              <PrivacyPage />
            </Route>
            <Route path="/account">
              <AccountPage />
            </Route>
            <Route path="/app-ideas">
              <AppIdeasPage />
            </Route>
            <Route path="/app-usage">
              <UsagePage />
            </Route>
            <Route path="/pair/:code">
              {({ code }) => <PairCodePage code={code} />}
            </Route>
            <Route path="/:community" nest>
              {({ community }) => (
                <CommunityProvider
                  key={community}
                  slug={community}
                  missing={<NotFound />}
                  // The community's bar's place, empty until it loads.
                  frame={phone ? <PhoneBar /> : <div className="h-10" />}
                >
                  <CommunityFrame />
                  <Suspense fallback={<Placeholder />}>
                    <Switch>
                      <Route path="/">
                        <CommunityHome />
                      </Route>
                      <Route path="/playlists">
                        <PlaylistsPage />
                      </Route>
                      <Route path="/playlists/:id">
                        {({ id }) => <PlaylistPage key={id} id={id} />}
                      </Route>
                      <Route path="/settings/:tab?">
                        {({ tab }) => <SettingsPage tab={tab} />}
                      </Route>
                      {/* The members moved into the settings. */}
                      <Route path="/members">
                        <Redirect to="/settings/members" replace />
                      </Route>
                      <Route path="/ideas">
                        <IdeasPage />
                      </Route>
                      <Route path="/songs/new">
                        <NewSong />
                      </Route>
                      <Route path="/recordings">
                        <RecordingsPage />
                      </Route>
                      <Route path="/statistics">
                        <StatisticsPage />
                      </Route>
                      <Route path="/changes">
                        <ChangesPage />
                      </Route>
                      <Route path="/features">
                        <FeaturesPage />
                      </Route>
                      <Route path="/team-schedule">
                        <TeamSchedulePage />
                      </Route>
                      <Route path="/my-schedule">
                        <MySchedulePage />
                      </Route>
                      <Route path="/host">
                        <HostPage />
                      </Route>
                      <Route path="/recordings/:id">
                        {({ id }) => <RecordingPage key={id} id={id} />}
                      </Route>
                      <Route path="/songs/:id/chords">
                        {({ id }) => <ChordsPage key={id} id={id} />}
                      </Route>
                      <Route path="/songs/:id/edit">
                        {({ id }) => <SongEditPage key={id} id={id} />}
                      </Route>
                      <Route path="/songs/:id">
                        {({ id }) => <SongPage key={id} id={id} />}
                      </Route>
                      <Route>
                        <NotFound />
                      </Route>
                    </Switch>
                  </Suspense>
                </CommunityProvider>
              )}
            </Route>
          </Switch>
        </Suspense>
      </div>
      <ConnectionStatus />
      <InPageProjector />
      <Shown feature="shortcuts">
        <Shortcuts />
      </Shown>
    </>
  );
}

/** "Norless", the interface language and the account. */
function AppHeader() {
  const { t } = useTranslation();
  const phone = useDeviceType().deviceType === "phone";
  // The way back to the community this device opened last, its line kept while its
  // name loads.
  const last = lastCommunity();
  const back = useJson<{ name: string }>(
    last ? `/api/communities/${last}` : null,
  ).data;
  return (
    <header
      className={`flex items-center justify-between gap-2 ${phone ? "pt-4" : ""}`}
    >
      <div className="flex flex-col items-start gap-1">
        {last && (
          <p className="min-h-6">
            {back && (
              <Link href={`~/${last}`} className="link text-sm">
                <ArrowLeft />
                {t("app.backTo", { name: back.name })}
              </Link>
            )}
          </p>
        )}
        {/* Home, like the community's name: the last community's newest playlist. */}
        <h1 className="text-3xl font-bold">
          <Link href="~/">Norless</Link>
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <LanguagePicker />
        {/* On a phone the photo alone, as on every phone bar. */}
        <UserMenu appLinks compact={phone} />
      </div>
    </header>
  );
}

/**
 * The top of a community's pages: while the app frame is off, a bar with the menu like the old
 * Norless; while it's on, the community's bar, which on a phone is a burger menu.
 */
function CommunityFrame() {
  const shows = useShows();
  if (!shows("appFrame"))
    return (
      <>
        <ClassicBar />
        <MembershipNote />
        <WhatsNew />
      </>
    );
  return (
    <>
      <CommunityNav />
      <MembershipNote />
      <WhatsNew />
      <MyLine />
      <Shown feature="offline">
        <OfflineKeeper />
      </Shown>
    </>
  );
}

/**
 * For members with the team schedule: their next slot, and what's new for them; not on
 * My schedule, which shows the same with its own Accept.
 */
function MyLine() {
  const shows = useShows();
  const { slug } = useCommunity();
  const [location] = useLocation();
  return useIsMember(slug) &&
    shows("mySchedule") &&
    location !== "/my-schedule" ? (
    <MyNextLine />
  ) : null;
}

/**
 * Opens the next service's playlist, else the newest; without one, the search box and
 * how to start.
 */
function CommunityHome() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { slug } = useCommunity();
  const roles = useRoles(slug);
  const newest = useJson<{ playlists: PlaylistSummary[]; next: string | null }>(
    `/api/communities/${slug}/playlists?limit=1`,
    useChanges(slug, "playlists"),
  );
  // Loaded again on each visit, so the first song added shows up.
  const songs = useJson<{ songCount: number }>(
    `/api/communities/${encodeURIComponent(slug)}`,
    useChanges(slug, "songs"),
  ).data;
  const first = newest.data?.next ?? newest.data?.playlists[0]?.id;
  // Visitors follow along while something is live, else see that playlist.
  const member = useIsMember(slug);
  const shows = useShows();
  // Only once it's known who this is: an owner isn't a visitor while that loads.
  const { me } = useMe();
  const visitor = !!me && !member && shows("followAlong");
  const following = useFollowView(visitor ? slug : null);
  const waiting = visitor && following === undefined;
  useEffect(() => {
    if (visitor && following?.entryId)
      navigate(`~/${slug}/follow`, { replace: true });
    // The permalink replaces the home URL, so the address bar can be shared.
    else if (first && !waiting)
      navigate(`/playlists/${first}`, { replace: true });
  }, [first, navigate, visitor, following, waiting, slug]);

  if (newest.data === undefined)
    return newest.failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={newest.retry} />
    ) : (
      // The playlist's own, which comes next.
      <Placeholder lines={8} />
    );
  if (first) return null;
  return (
    <div className="flex flex-col gap-4">
      <SearchBox
        onPick={(result) =>
          result.type === "song" && navigate(`/songs/${result.id}`)
        }
      />
      <NoPlaylists />
      {songs?.songCount === 0 && (
        <Empty title={t("home.empty")} description={t("home.emptyHelp")}>
          {hasRole(roles, "editor") && (
            <Link href="/songs/new" className={buttonVariants()}>
              <Plus />
              {t("home.addFirst")}
            </Link>
          )}
        </Empty>
      )}
    </div>
  );
}

/** For people who logged in but aren't members of this community. */
function MembershipNote() {
  const { t } = useTranslation();
  const { me } = useMe();
  const { slug } = useCommunity();
  const isMember = useIsMember(slug);
  if (!me?.user || isMember) return null;
  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t("auth.notInvited")}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}

/**
 * /: the community this device opened last, or the only one, which opens its newest
 * playlist; otherwise the list of communities. The installed app starts here.
 */
function StartPage() {
  const { t } = useTranslation();
  const last = lastCommunity();
  const communities = useJson<{ slug: string; name: string }[]>(
    last ? null : "/api/communities",
  ).data;
  const only = communities?.length === 1 ? communities[0]?.slug : undefined;
  const target = last ?? only;
  if (target) return <Redirect to={`/${target}`} replace />;
  if (!communities) return null;
  return (
    <nav aria-label={t("start.communities")} className="flex flex-col gap-2">
      {communities.map((c) => (
        <Link key={c.slug} href={`/${c.slug}`} className="link text-lg">
          {c.name}
        </Link>
      ))}
    </nav>
  );
}

/** /songs/new, with a title from where it was started, e.g. a search that found nothing. */
function NewSong() {
  const [params] = useSearchParams();
  const { languages } = useCommunity();
  const title = params.get("title");
  return (
    <SongEditor
      song={null}
      title={
        title && languages[0]
          ? { language: languages[0], text: title }
          : undefined
      }
    />
  );
}
