import { useTranslation } from "react-i18next";
import type { Entry } from "../../server/playlists/playlists";
import type { Song } from "../../server/songs/songs";
import type { Key } from "../../shared/music/chords";
import {
  chordName,
  halfSteps,
  playedKey,
  playedText,
  type NoteNaming,
} from "../../shared/music/music";
import { titleFor } from "../../shared/song-render";
import { parseSong, partBars } from "../../shared/song-text";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { useKeyChange } from "../songs/KeyDialog";

/**
 * The change ahead: the live part's last chord and the next part's first, or during the
 * last part, the next song's key, the key change, its time signature, tempo and first chords.
 */
export function Changes({
  slug,
  count,
  barsAt,
  live,
  part,
  next,
  songKey,
  languages,
  naming,
}: {
  slug: string;
  count: number;
  barsAt: (i: number) => string[][];
  live: number;
  part: (i: number) => string;
  next: Entry | null;
  songKey: Key | null;
  languages: string[];
  naming: NoteNaming;
}) {
  const { t } = useTranslation();
  const last = live >= 0 && live === count - 1;
  const ends = barsAt(live).flat().at(-1);
  const starts = barsAt(live + 1).flat()[0];
  if (!last)
    return ends && starts ? (
      <p className="rounded-lg bg-surface-secondary px-3 py-2 text-lg">
        {t("instruments.ends", {
          part: part(live),
          chord: ends,
          next: part(live + 1),
          first: starts,
        })}
      </p>
    ) : null;
  return next?.song ? (
    <NextSong
      slug={slug}
      entry={next}
      songKey={songKey}
      languages={languages}
      naming={naming}
    />
  ) : null;
}

function NextSong({
  slug,
  entry,
  songKey,
  languages,
  naming,
}: {
  slug: string;
  entry: Entry;
  songKey: Key | null;
  languages: string[];
  naming: NoteNaming;
}) {
  const { t } = useTranslation();
  const keyChange = useKeyChange();
  const song = useJson<Song>(
    entry.song ? `/api/communities/${slug}/songs/${entry.song.id}` : null,
    useChanges(slug, "songs", "song_versions"),
  ).data;
  if (!entry.song) return null;
  const played = playedKey(entry.song.keySignature, entry.keySignature);
  const version =
    song &&
    (languages
      .map((l) => song.versions.find((v) => v.language === l))
      .find(Boolean) ??
      song.versions[0]);
  const first =
    version &&
    parseSong(playedText(version.text, song.keySignature, entry.keySignature))
      .slides.flatMap((s) => partBars(s).flat())
      .slice(0, 4)
      .map((c) => chordName(c, naming, played.key));
  const change =
    songKey && played.key && halfSteps(songKey, played.key) !== 0
      ? keyChange(songKey, played.key)
      : null;
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-surface-secondary px-3 py-2">
      <p className="text-lg font-semibold">
        {t("instruments.nextSong", {
          title: titleFor(entry.song.titles, languages),
        })}
      </p>
      <p className="text-lg">
        {[
          played.shown && t("song.key", { key: played.shown }),
          change,
          entry.song.timeSignature &&
            t("song.time", { time: entry.song.timeSignature }),
          song?.bpm && t("song.tempo", { bpm: song.bpm }),
          first?.length && first.join(" "),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}
