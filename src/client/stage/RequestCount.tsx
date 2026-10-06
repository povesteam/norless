import { Chip } from "@heroui/react";
import { useTranslation } from "react-i18next";
import type { Recording } from "../../server/live/recording-view";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";

/** How many ask for access to the member's recordings, beside Recordings in the menu. */
export function RequestCount({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const data = useJson<Recording[]>(
    `/api/communities/${slug}/recordings`,
    useChanges(slug, "recordings", "recording_access"),
  ).data;
  const count = (data ?? [])
    .flatMap((r) => r.requests ?? [])
    .filter((q) => q.status === "asked").length;
  // Kept in place even at 0, so the menu doesn't move when one comes.
  return (
    <Chip
      size="sm"
      color="warning"
      variant="soft"
      aria-label={t("recordings.asking", { count })}
      className={count ? undefined : "invisible"}
    >
      {count}
    </Chip>
  );
}
