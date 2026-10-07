import { I18nProvider } from "@heroui/react";
import { LucideProvider } from "lucide-react";
import { lazy, Suspense, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { RouterProvider } from "react-aria-components";
import { Route, Switch, useLocation } from "wouter";
import { SwitchesRoot } from "../data/community";
import { FollowPage } from "../screens/Follow";
import { MeProvider } from "../data/me";
import { NewVersionNotice } from "./NewVersion";
import { ServiceWorker } from "./update";
import { removeShell } from "../ui/states";

// Each screen loads its own code, and the app's frame loads only where it shows, so a
// phone following along or a stage TV downloads and parses a fraction of the app.
const App = lazy(() => import("./App").then((m) => ({ default: m.App })));
const JoinRoomPage = lazy(() =>
  import("../live/PracticeRooms").then((m) => ({ default: m.JoinRoomPage })),
);
const MusiciansPage = lazy(() =>
  import("../stage/MusiciansPage").then((m) => ({ default: m.MusiciansPage })),
);
const OfflinePage = lazy(() =>
  import("./Offline").then((m) => ({ default: m.OfflinePage })),
);
const PairPage = lazy(() =>
  import("../account/Pairing").then((m) => ({ default: m.PairPage })),
);
const Projector = lazy(() =>
  import("../screens/Projector").then((m) => ({ default: m.Projector })),
);
const ScreenPage = lazy(() =>
  import("../screens/ScreenPage").then((m) => ({ default: m.ScreenPage })),
);
const StagePage = lazy(() =>
  import("../stage/StageMonitor").then((m) => ({ default: m.StagePage })),
);
const VocalistsPage = lazy(() =>
  import("../stage/Vocalists").then((m) => ({ default: m.VocalistsPage })),
);

/** The providers, and the routes of the screens that fill the display without the app's frame. */
export function Root() {
  const { i18n } = useTranslation();
  // Menu items with an href are links, which open pages through the router: right-click
  // and Cmd-click work on them as on any link.
  const [, navigate] = useLocation();
  return (
    // React Aria's own strings and formats follow the interface language.
    <RouterProvider navigate={(to) => navigate(to)}>
      <I18nProvider locale={i18n.language}>
        <LucideProvider size={16} className="shrink-0">
          <MeProvider>
            <SwitchesRoot>
              <ServiceWorker />
              <NewVersionNotice />
              {/* While a page's code loads: nothing on screens (no spinners there), a
                placeholder after 300 ms in the app's frame; on opening, index.html's
                until the first page or screen commits. */}
              <Suspense fallback={null}>
                <ShellGone />
                <Switch>
                  {/* Screens fill the display, without the app's frame. */}
                  <Route path="/pair">
                    <PairPage />
                  </Route>
                  <Route path="/s/:secret">
                    {({ secret }) => (
                      <ScreenPage key={secret} secret={secret} />
                    )}
                  </Route>
                  <Route path="/:community/follow">
                    {({ community }) => <FollowPage slug={community} />}
                  </Route>
                  <Route path="/:community/join/:room">
                    {({ community, room }) => (
                      <JoinRoomPage slug={community} roomId={room} />
                    )}
                  </Route>
                  <Route path="/:community/musicians">
                    {({ community }) => <MusiciansPage slug={community} />}
                  </Route>
                  <Route path="/:community/vocalists">
                    {({ community }) => <VocalistsPage slug={community} />}
                  </Route>
                  <Route path="/:community/stage">
                    {({ community }) => <StagePage slug={community} />}
                  </Route>
                  {/* Without internet, from what this device kept. */}
                  <Route path="/:community/offline">
                    {({ community }) => <OfflinePage slug={community} />}
                  </Route>
                  <Route path="/:community/local/:language">
                    {({ community, language }) => (
                      <Projector slug={community} language={language} local />
                    )}
                  </Route>
                  <Route path="/:community/projector/:language">
                    {({ community, language }) => (
                      <Projector slug={community} language={language} />
                    )}
                  </Route>
                  <Route>
                    <App />
                  </Route>
                </Switch>
              </Suspense>
            </SwitchesRoot>
          </MeProvider>
        </LucideProvider>
      </I18nProvider>
    </RouterProvider>
  );
}

/** Commits with the first page or screen, which then replaces index.html's placeholder. */
function ShellGone() {
  useLayoutEffect(removeShell, []);
  return null;
}
