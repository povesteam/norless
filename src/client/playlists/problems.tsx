import { TriangleAlert } from "lucide-react";
import { Button, Chip, Popover } from "@heroui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Problem } from "../../server/playlists/problems";
import type { Entry } from "../../server/playlists/playlists";
import { entryTitle } from "./EntryRow";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { useCommunity } from "../data/community";
import { useDeviceType } from "../data/device";

/** A playlist's problems, for the team, checked again with each change and every 30 seconds. */
export function useProblems(url: string | null, key: string) {
  const { slug } = useCommunity();
  const changes = useChanges(
    slug,
    "screens",
    "screen_connections",
    "songs",
    "song_versions",
    "slide_files",
  );
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    const timer = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, [url]);
  return (
    useJson<Problem[]>(
      url ? `${url}/problems?at=${key}-${tick}` : null,
      changes,
    ).data ?? []
  );
}

/**
 * One problem in words; with the playlist's `entries`, after its entry's title, so a list
 * of them says which song each is about.
 */
export function useDescribe(entries?: Entry[]) {
  const { t, i18n } = useTranslation();
  const { languages } = useCommunity();
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  const entry = (problem: Problem) =>
    "entryId" in problem
      ? entries?.find((e) => e.id === problem.entryId)
      : undefined;
  const words = (problem: Problem) =>
    problem.kind === "screen"
      ? t("problems.screen", { name: problem.name })
      : problem.kind === "translation"
        ? t("problems.translation", {
            language: names.of(problem.language) ?? problem.language,
          })
        : problem.kind === "small"
          ? t("problems.small", {
              slides: problem.slides.map((i) => i + 1).join(", "),
              language: names.of(problem.language) ?? problem.language,
            })
          : problem.kind === "excluded"
            ? t("problems.excluded", { reason: problem.reason })
            : problem.kind === "slides"
              ? t(`problems.slides.${problem.state}`)
              : t("problems.key");
  return (problem: Problem) => {
    const about = entry(problem);
    return about
      ? `${entryTitle(about, [i18n.language, ...languages])}: ${words(problem)}`
      : words(problem);
  };
}

/**
 * Shown only while there's a problem; opens to list them over the page, so nothing moves.
 * Amber, like the marks on entries; red while a usual screen is missing, since then
 * something isn't projected.
 */
export function ProblemsIndicator({
  problems,
  entries,
}: {
  problems: Problem[];
  entries: Entry[];
}) {
  const { t } = useTranslation();
  const describe = useDescribe(entries);
  // The number alone on a phone, its words in the name.
  const phone = useDeviceType().deviceType === "phone";
  if (problems.length === 0) return null;
  const blocking = problems.some((p) => p.kind === "screen");
  const count = t("problems.count", { count: problems.length });
  return (
    <Popover>
      <Button
        size="sm"
        variant={blocking ? "danger-soft" : "secondary"}
        className={
          blocking ? undefined : "bg-warning-soft text-warning-soft-foreground"
        }
        aria-label={count}
      >
        <TriangleAlert />
        {phone ? problems.length : count}
      </Button>
      <Popover.Content placement="bottom start" className="max-w-md">
        <Popover.Dialog
          aria-label={t("problems.count", { count: problems.length })}
        >
          <ul className="list-disc ps-4 text-sm">
            {problems.map((p, i) => (
              <li key={i}>{describe(p)}</li>
            ))}
          </ul>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/** The mark on an entry with problems; ProblemsIndicator lists their reasons. */
export function EntryProblems({ problems }: { problems: Problem[] }) {
  const describe = useDescribe();
  if (problems.length === 0) return null;
  return (
    <Chip
      size="sm"
      color="warning"
      variant="soft"
      className="shrink-0"
      aria-label={problems.map(describe).join(" · ")}
    >
      <TriangleAlert className="size-3.5" />
    </Chip>
  );
}
