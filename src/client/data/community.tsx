import { createContext, use, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NoteNaming } from "../../shared/preferences";
import {
  allOn,
  type Feature,
  shows,
  type Switches,
  switchesOn,
} from "../../shared/features";
import { type Theme, themeCss } from "../../shared/theme";
import { useJson } from "./fetch";
import { useChanges } from "./changes";
import { useMe } from "./me";
import { ErrorNotice, Placeholder } from "../ui/states";
import { useUsageCommunity } from "./usage";

export type Community = {
  slug: string;
  name: string;
  languages: string[];
  theme?: Theme;
  /** The features owners switched on or off; one not set is off. */
  switches: Switches;
  /** The bible.com version id the owners chose per language; others use the default. */
  bibleVersions?: Record<string, number>;
  /** How chords are named for members who didn't choose. */
  noteNames?: NoteNaming;
  /** When a drift shows on stage: off by this percent for these seconds. */
  tempoCheck?: { percent: number; seconds: number };
  /** Where its services are streamed, for the chapters' offset. */
  youtubeChannel?: string | null;
};

const CommunityContext = createContext<Community | null>(null);

/** The switches on in a community. */
export const switchesOf = (community: Pick<Community, "switches">) =>
  switchesOn(community.switches ?? {});

/**
 * Whether chords are colored: the community shows the colors and the member didn't
 * choose plain chords.
 */
export function useChordColors(
  community: Pick<Community, "switches"> | null | undefined,
): boolean {
  const { me } = useMe();
  const musician = me?.user ? me.preferences.musician : undefined;
  return !!(
    !musician?.plainChords &&
    community &&
    shows(switchesOf(community), "chordColors")
  );
}

/**
 * The switches on: the community's inside its pages, and lifted to the app's frame once
 * it loads; every feature outside a community.
 */
const SwitchesContext = createContext({
  on: allOn,
  setOn: (() => {}) as (on: ReadonlySet<Feature>) => void,
});

/** Holds the switches for the parts of the app outside a community's pages. */
export function SwitchesRoot({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState<ReadonlySet<Feature>>(allOn);
  return <SwitchesContext value={{ on, setOn }}>{children}</SwitchesContext>;
}

/** Its children, when the community's switches show the feature. */
export function Shown({
  feature,
  children,
}: {
  feature: Feature;
  children: React.ReactNode;
}) {
  return useShows()(feature) ? children : null;
}

/** Whether the community's switches show a feature. */
export function useShows() {
  const { on } = use(SwitchesContext);
  return (feature: Feature) => shows(on, feature);
}
const ReloadContext = createContext<() => void>(() => {});

/** Loads the community again, e.g. after its theme changed. */
export const useReloadCommunity = () => use(ReloadContext);

/** A community's theme on the page: its colors and its font. */
export function ThemeStyle({ theme }: { theme: Theme | undefined }) {
  if (!theme) return null;
  return (
    <>
      <style>{themeCss(theme)}</style>
    </>
  );
}

/** The community this device opened last, which the start page opens. */
export const lastCommunity = () => {
  try {
    return localStorage.getItem("norless:community");
  } catch {
    return null;
  }
};

/** The community of the current URL. Only inside <CommunityProvider>. */
export function useCommunity(): Community {
  const community = use(CommunityContext);
  if (!community) throw new Error("useCommunity outside a community route");
  return community;
}

/**
 * Loads the community named in the URL, then shows its routes, or `missing`; `frame` tops
 * the page until it loads, since the community's frame depends on its switches.
 */
export function CommunityProvider({
  slug,
  missing,
  frame,
  children,
}: {
  slug: string;
  missing: React.ReactNode;
  frame?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [version, setVersion] = useState(0);
  useUsageCommunity(slug);
  // A member's roles changed here: who I am loads again, so my pages follow at once.
  const { refresh } = useMe();
  const members = useChanges(slug, "members");
  useEffect(() => {
    if (members) refresh();
  }, [members, refresh]);
  const {
    data: community,
    failed,
    retry,
  } = useJson<Community>(
    `/api/communities/${encodeURIComponent(slug)}`,
    version + useChanges(slug, "communities"),
  );
  if (community === undefined)
    return (
      <>
        {frame}
        {failed ? (
          <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
        ) : (
          // As long as a playlist's, which most often comes next.
          <Placeholder lines={8} />
        )}
      </>
    );
  if (community === null)
    return (
      <>
        {frame}
        {missing}
      </>
    );
  try {
    // The app opens here next time, e.g. from the home screen.
    localStorage.setItem("norless:community", community.slug);
  } catch {
    // The start page lists the communities instead.
  }
  return (
    <CommunityContext value={community}>
      <ReloadContext value={() => setVersion((n) => n + 1)}>
        <CommunitySwitches switches={community.switches}>
          {shows(switchesOf(community), "theme") && (
            <ThemeStyle theme={community.theme} />
          )}
          {children}
        </CommunitySwitches>
      </ReloadContext>
    </CommunityContext>
  );
}

/** The community's switches for its pages, and for the app's frame while they're open. */
function CommunitySwitches({
  switches,
  children,
}: {
  switches: Switches;
  children: React.ReactNode;
}) {
  const { setOn } = use(SwitchesContext);
  const on = useMemo(() => switchesOn(switches ?? {}), [switches]);
  useEffect(() => {
    setOn(on);
    return () => setOn(allOn);
  }, [on, setOn]);
  return <SwitchesContext value={{ on, setOn }}>{children}</SwitchesContext>;
}
