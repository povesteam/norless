import { Mic } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useCommunity, useShows } from "../data/community";
import { hasRole, useRoles } from "../data/me";

/**
 * A song's recordings, as a mic with how many: a link to them on its page, or `plain`
 * where it can't be one (a search result). Callers show it to the team, with the
 * recordings switched on.
 */
export function RecordingsMark({
  slug,
  songId,
  count,
  plain = false,
}: {
  slug: string;
  songId: string;
  count: number | undefined;
  plain?: boolean;
}) {
  const { t } = useTranslation();
  if (!count) return null;
  const content = (
    <>
      <span className="sr-only">{t("recordings.count", { count })}</span>
      <Mic aria-hidden className="size-3.5" />
      <span aria-hidden>{count}</span>
    </>
  );
  const look = "inline-flex items-center gap-0.5 text-xs";
  return plain ? (
    <span className={`${look} text-muted`}>{content}</span>
  ) : (
    <Link
      href={`~/${slug}/songs/${songId}#recordings`}
      className={`link ${look}`}
      // Not the row's own press, which would select it.
      onClick={(event) => event.stopPropagation()}
    >
      {content}
    </Link>
  );
}

/** In a community's pages: the mark, for the team, while the recordings are switched on. */
export function TeamRecordingsMark({
  songId,
  count,
  plain = false,
}: {
  songId: string;
  count: number | undefined;
  plain?: boolean;
}) {
  const { slug } = useCommunity();
  const team = hasRole(useRoles(slug), "team");
  const shows = useShows();
  if (!team || !shows("recordings")) return null;
  return (
    <RecordingsMark slug={slug} songId={songId} count={count} plain={plain} />
  );
}
