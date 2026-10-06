import { AppWindow, Cast, CircleStop } from "lucide-react";
import { Button } from "@heroui/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useCommunity, useShows } from "../data/community";
import { useDeviceType } from "../data/device";
import {
  dismissWindowClosed,
  openLocalProjector,
  projectInPage,
  stopLocal,
  useLocal,
  useWindowClosed,
} from "../data/room";

/** What a page projects here, and how it starts. */
export type ProjectHere = { projecting: boolean; start: () => void };

/**
 * Projecting on a screen connected to this device (live-control spec): Project here, and
 * while this tab projects, the projector window again and Stop projecting. A closed
 * window stops it, and this says so for a few seconds, above the bar.
 */
export function LocalProjection({
  projecting,
  start,
  narrow = false,
}: ProjectHere & {
  /** In a full live bar: on a phone, only the icons. */
  narrow?: boolean;
}) {
  const { t } = useTranslation();
  const narrowLabel = narrow ? "max-[749px]:sr-only" : undefined;
  const phone = useDeviceType().deviceType === "phone";
  const { slug } = useCommunity();
  const shows = useShows();
  const local = useLocal()?.slug === slug;
  const closed = useWindowClosed();
  useEffect(() => {
    if (!closed) return;
    const timer = setTimeout(dismissWindowClosed, 8000);
    return () => clearTimeout(timer);
  }, [closed]);
  if (!shows("projectHere") && !local) return null;
  return (
    <>
      {!projecting && (
        <Button
          size="sm"
          variant="secondary"
          aria-describedby="project-here"
          onPress={() => {
            projectInPage(phone);
            start();
          }}
        >
          <Cast />
          <span className={narrowLabel}>{t("local.start")}</span>
        </Button>
      )}
      <span id="project-here" hidden>
        {t("local.hint")}
      </span>
      {local && (
        <>
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => {
              projectInPage(phone);
              void openLocalProjector();
            }}
          >
            <AppWindow />
            <span className={narrowLabel}>{t("local.window")}</span>
          </Button>
          <Button size="sm" variant="ghost" onPress={stopLocal}>
            <CircleStop />
            <span className={narrowLabel}>{t("local.stop")}</span>
          </Button>
        </>
      )}
      {closed && (
        <div
          role="alert"
          className="fixed inset-x-0 bottom-24 z-30 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-xl bg-foreground px-4 py-2 text-background shadow-lg"
        >
          {t("local.closed")}
        </div>
      )}
    </>
  );
}

/**
 * The bar at the bottom with Project here alone, where the page has no live bar for this
 * person (a visitor's playlist, a song's page), so it sits where the live bar's would.
 */
export function ProjectBar(project: ProjectHere) {
  const shows = useShows();
  if (!shows("projectHere")) return null;
  return (
    <div
      data-bottom-bar
      className="sticky bottom-0 z-10 -mx-4 mt-auto flex flex-wrap items-center gap-2 border-t border-separator bg-background px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <LocalProjection {...project} />
    </div>
  );
}
