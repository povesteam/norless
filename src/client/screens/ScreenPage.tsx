import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useBarColor } from "../ui/full-screen";
import { useTranslation } from "react-i18next";
import type { ScreenView } from "../../shared/screens";
import { live } from "../data/connection";
import { useJson } from "../data/fetch";
import { ProjectorScreen } from "./Projector";
import { ReloadWhenIdle } from "../app/update";
import { lastBackground, rememberBackground } from "./background";

// The projector is in this page's code; the other layouts load when a screen shows one.
const Musicians = lazy(() =>
  import("../stage/Musicians").then((m) => ({ default: m.Musicians })),
);
const Overlay = lazy(() =>
  import("./Overlay").then((m) => ({ default: m.Overlay })),
);
const StageMonitor = lazy(() =>
  import("../stage/StageMonitor").then((m) => ({ default: m.StageMonitor })),
);
const Vocalists = lazy(() =>
  import("../stage/Vocalists").then((m) => ({ default: m.Vocalists })),
);

/**
 * /s/<secret>: one of the room's screens, without a login. A change to the screen
 * reloads it; a new secret or deleting it stops it. A paired device opens it with its
 * own token, and shows `unpaired` while it isn't paired.
 */
export function ScreenPage({
  secret,
  unpaired,
}: {
  secret: string;
  unpaired?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [version, setVersion] = useState(0);
  const [revoked, setRevoked] = useState(false);
  useEffect(
    () =>
      live.subscribe(`screen:${secret}`, (data) => {
        const revoked = !!(data as { revoked?: boolean }).revoked;
        setRevoked(revoked);
        if (!revoked) setVersion((n) => n + 1);
      }),
    [secret],
  );
  const { data: screen } = useJson<ScreenView>(
    `/api/screens/${encodeURIComponent(secret)}`,
    version,
  );
  // An overlay remembers its own; the others their background, or black.
  const type = screen?.type;
  const background = screen?.settings.background;
  useEffect(() => {
    if (type && type !== "overlay")
      rememberBackground(
        (type === "projector" || type === "stage") && background
          ? background
          : "#000",
      );
  }, [type, background]);

  if (screen === undefined) return <Loading />;
  if (screen === null || revoked)
    return unpaired ?? <Message>{t("screen.gone")}</Message>;
  return (
    <>
      <ReloadWhenIdle slug={screen.community.slug} />
      {/* As while the screen loads, while a layout's code does. */}
      <Suspense fallback={<Loading />}>
        <Screen screen={screen} />
      </Suspense>
    </>
  );
}

/** The screen of its type. */
function Screen({ screen }: { screen: ScreenView }) {
  if (screen.type === "stage")
    return (
      <StageMonitor
        slug={screen.community.slug}
        languages={screen.languages}
        fallback={screen.community.languages}
        settings={screen.settings}
      />
    );
  if (screen.type === "musicians")
    return (
      <DarkScreen>
        <Musicians
          slug={screen.community.slug}
          languages={[...screen.languages, ...screen.community.languages]}
          layout={screen.layout === "chords" ? "chords" : "bar-grid"}
          canControl={false}
        />
      </DarkScreen>
    );
  if (screen.type === "vocalists")
    return (
      <DarkScreen>
        <Vocalists
          slug={screen.community.slug}
          languages={screen.languages}
          layout={
            screen.layout === "sideways" || screen.layout === "tablet"
              ? screen.layout
              : "whole"
          }
          canControl={false}
        />
      </DarkScreen>
    );
  if (screen.type === "overlay")
    return (
      <Overlay
        slug={screen.community.slug}
        languages={screen.languages}
        settings={screen.settings}
      />
    );

  return (
    <ProjectorScreen
      slug={screen.community.slug}
      languages={screen.languages}
      fallback={screen.community.languages}
      settings={screen.settings}
    />
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black p-8 text-center text-white/70">
      {children}
    </div>
  );
}

/**
 * A musicians or vocalists screen's page: black, with the phone's bars black too, and
 * its content inside a TV's title-safe area, 5% from each edge.
 */
function DarkScreen({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useBarColor(root, "black");
  return (
    <div
      ref={root}
      className="dark fixed inset-0 flex cursor-none flex-col bg-black px-[5vw] py-[5vh] text-white"
    >
      {children}
    </div>
  );
}

/** What this device's screen showed last, while it loads. */
function Loading() {
  return (
    <div className="fixed inset-0" style={{ background: lastBackground() }} />
  );
}
