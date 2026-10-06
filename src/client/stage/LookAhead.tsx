import { ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LiveView } from "../../server/live/live-view";
import type { Playlist } from "../../server/playlists/playlists";
import type { Song } from "../../server/songs/songs";
import { titleFor } from "../../shared/song-render";
import { useChanges } from "../data/changes";
import { useJson } from "../data/fetch";

const HINT_SEEN = "norless:look-ahead-hint";

/**
 * A musician's or singer's own look at another song of the live playlist, on their
 * device only: earlier and later songs, and back to live, by hand or
 * by itself when the live song changes. `shown` is what the view shows: the live view,
 * or the song looked at with nothing live in it.
 */
export function useLookAhead(
  slug: string,
  /** The live view; undefined where looking ahead isn't offered (a screen). */
  view: LiveView | undefined,
  languages: string[],
) {
  const { t, i18n } = useTranslation();
  const playlist = useJson<Playlist>(
    view?.playlistId
      ? `/api/communities/${slug}/playlists/${view.playlistId}`
      : null,
    useChanges(slug, "entries", "playlists"),
  ).data;
  const songs =
    playlist?.entries.filter((e) => e.song && !e.song.deleted) ?? [];
  const [at, setAt] = useState<{ entryId: string; live: string | null }>();
  // The live song changed: back to it.
  if (at && at.live !== (view?.entryId ?? null)) setAt(undefined);
  const entry = at && songs.find((e) => e.id === at.entryId);
  const song = useJson<Song>(
    entry?.song ? `/api/communities/${slug}/songs/${entry.song.id}` : null,
  ).data;
  const index = songs.findIndex((e) => e.id === (at?.entryId ?? view?.entryId));
  const step = (by: number) => {
    const next = songs[index + by];
    if (!next) return;
    setAt(
      next.id === view?.entryId
        ? undefined
        : { entryId: next.id, live: view?.entryId ?? null },
    );
  };
  const looking = !!(view && entry && song?.id === entry.song?.id);
  // The hint shows on this device's first look at a playlist, then the arrows alone
  //.
  const [hint] = useState(() => {
    try {
      return !localStorage.getItem(HINT_SEEN);
    } catch {
      return true;
    }
  });
  const shownPlaylist = !!view?.playlistId;
  useEffect(() => {
    if (!shownPlaylist) return;
    try {
      localStorage.setItem(HINT_SEEN, "1");
    } catch {
      // Shown again next time.
    }
  }, [shownPlaylist]);
  const shown: LiveView | undefined =
    looking && view && entry && song
      ? { ...view, entry, entryId: entry.id, song, slide: -1, blank: true }
      : view;

  const bar = view?.playlistId ? (
    // One row of a fixed height, whether looking ahead or not, so nothing moves.
    <div className="flex h-12 items-center gap-2 border-b border-separator px-3">
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={t("lookAhead.earlier")}
        isDisabled={index <= 0}
        onPress={() => step(-1)}
      >
        <ChevronLeft />
      </Button>
      {/* Two lines fit the row's height, so a phone shows the whole hint. */}
      <span className="line-clamp-2 min-w-0 flex-1 text-sm leading-tight">
        {looking && entry?.song
          ? t("lookAhead.looking", {
              title: titleFor(entry.song.titles, [i18n.language, ...languages]),
            })
          : hint && t("lookAhead.hint")}
      </span>
      {looking && (
        <Button size="sm" onPress={() => setAt(undefined)}>
          <Radio />
          {t("lookAhead.back")}
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={t("lookAhead.later")}
        isDisabled={index < 0 || index >= songs.length - 1}
        onPress={() => step(1)}
      >
        <ChevronRight />
      </Button>
    </div>
  ) : null;

  return { shown, looking, bar };
}
