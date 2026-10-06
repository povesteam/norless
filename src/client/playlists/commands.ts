import { useTranslation } from "react-i18next";
import type { LiveView } from "../../server/live/live-view";
import type { Page } from "../../server/playlists/pages";
import type { Screen } from "../../shared/screens";
import { partLabels } from "../../shared/song-text";
import { useCommunity } from "../data/community";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { usePartName } from "../stage/parts";
import { liveSlides, sendLive } from "../data/room";
import { openScreen } from "../live/windows";
import type { Command } from "./SearchBox";

/**
 * What the team can type in the search box: blank, next and previous, a part of the
 * live song by name or number ("refrain", "verse 2", "bridge"), a page, or opening a
 * screen.
 */
export function useLiveCommands(
  view: LiveView | undefined,
  enabled: boolean,
): Command[] {
  const { t } = useTranslation();
  const community = useCommunity();
  const partName = usePartName();
  const base = `/api/communities/${community.slug}`;
  const pages = useJson<Page[]>(
    enabled ? `${base}/pages` : null,
    useChanges(community.slug, "pages"),
  ).data;
  const screens = useJson<Screen[]>(
    enabled ? `${base}/screens` : null,
    useChanges(community.slug, "screens"),
  ).data;
  const act = (action: Parameters<typeof sendLive>[1]) =>
    void sendLive(community.slug, action);

  if (!enabled) return [];
  const commands: Command[] = [
    {
      id: "blank",
      label: t("commands.blank"),
      words: ["blank", t("live.blank")],
      run: () => act({ type: "blank", blank: true }),
    },
    {
      id: "next",
      label: t("commands.next"),
      words: ["next", t("live.next")],
      run: () => act({ type: "next" }),
    },
    {
      id: "previous",
      label: t("commands.previous"),
      words: ["previous", t("live.previous")],
      run: () => act({ type: "previous" }),
    },
  ];

  // Each part of the live song once: the next place it's sung, else the first.
  const slides = view?.song ? liveSlides(view.song, community.languages) : [];
  const labels = partLabels(slides);
  const after = view?.slide ?? 0;
  for (const label of new Set(labels)) {
    const places = labels.flatMap((l, i) => (l === label ? [i] : []));
    const target = places.find((i) => i > after) ?? places[0] ?? 0;
    const slide = slides[target];
    const name = partName(slide, label);
    commands.push({
      id: `part:${label}`,
      label: t("commands.part", { part: name }),
      words: [
        name,
        label,
        ...(slide?.type === "refrain" ? ["refrain", "chorus"] : []),
        ...(slide?.type === "verse" ? [`verse ${label}`] : []),
        ...(slide?.type && slide.type !== "verse" && slide.type !== "other"
          ? [slide.type]
          : []),
      ],
      run: () =>
        view?.entryId &&
        act({ type: "go", entryId: view.entryId, slide: target }),
    });
  }
  for (const page of pages ?? [])
    commands.push({
      id: `page:${page.id}`,
      label: t("commands.page", { name: page.name }),
      words: [page.name, `page ${page.name}`],
      run: () => act({ type: "page", pageId: page.id }),
    });
  for (const screen of screens ?? [])
    commands.push({
      id: `screen:${screen.id}`,
      label: t("commands.screen", { name: screen.name }),
      words: [screen.name, `screen ${screen.name}`],
      run: () => void openScreen(screen),
    });
  return commands;
}
