import { Button } from "@heroui/react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CountedSong } from "../../server/songs/statistics";
import { titleFor } from "../../shared/song-render";
import { useCommunity } from "../data/community";
import { useJson } from "../data/fetch";

/**
 * Beside an empty playlist: songs sung in many services but not in the last 6 months,
 * the Statistics page's list, each added with a click.
 */
export function NotLately({ onAdd }: { onAdd: (songId: string) => void }) {
  const { t, i18n } = useTranslation();
  const { slug, languages } = useCommunity();
  const songs = useJson<{ notLately: CountedSong[] }>(
    `/api/communities/${slug}/statistics`,
  ).data?.notLately;
  if (!songs?.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-lg font-semibold">{t("statistics.notLately")}</h3>
      <p className="text-sm text-muted">{t("statistics.notLatelyHelp")}</p>
      <ul aria-label={t("statistics.notLately")} className="flex flex-col">
        {songs.slice(0, 8).map((song) => (
          <li key={song.id}>
            <Button
              variant="ghost"
              fullWidth
              className="justify-start"
              onPress={() => onAdd(song.id)}
            >
              <Plus />
              <span className="min-w-0 flex-1 truncate text-start">
                {titleFor(song.titles, [i18n.language, ...languages])}
              </span>
              <span className="text-sm text-muted tabular-nums">
                {t("statistics.services", { count: song.services })}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
