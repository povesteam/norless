import { CirclePlay, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useChanges } from "../data/changes";
import { useCommunity } from "../data/community";
import { useJson } from "../data/fetch";

/** A moment in a service's stream: when, and the link to its second. */
type Replay = { at: string; url: string };

/** A playlist's entries, each at the moment it went live in the service's stream. */
export const usePlaylistReplays = (playlistId: string, on: boolean) => {
  const { slug } = useCommunity();
  return (
    useJson<Record<string, string>>(
      on ? `/api/communities/${slug}/playlists/${playlistId}/replays` : null,
      useChanges(slug, "live_log", "streams"),
    ).data ?? {}
  );
};

/**
 * Watch again: the services where the song was played inside their streams, newest first,
 * each opening the stream where the song began. Nothing when there are none.
 */
export function WatchAgain({ songId }: { songId: string }) {
  const { t, i18n } = useTranslation();
  const { slug } = useCommunity();
  const replays = useJson<Replay[]>(
    `/api/communities/${slug}/songs/${encodeURIComponent(songId)}/replays`,
    useChanges(slug, "plays", "streams"),
  ).data;
  if (!replays?.length) return null;
  return (
    <section aria-labelledby="replays-title" className="flex flex-col gap-2">
      <h3
        id="replays-title"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <CirclePlay />
        {t("replays.title")}
      </h3>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {replays.map((r) => (
          <li key={r.at}>
            <a className="link" href={r.url} target="_blank" rel="noreferrer">
              <ExternalLink />
              {new Date(r.at).toLocaleDateString(i18n.language, {
                dateStyle: "long",
              })}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
