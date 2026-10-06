import type { LiveState } from "../../shared/live.js";
import { parseSong, sungLines } from "../../shared/song-text.js";
import type { Db } from "../db/db.js";
import { getPlaylist } from "./playlists.js";
import { textOf } from "../songs/songs.js";
import {
  eventAround,
  localTime,
  type ScheduleEvent,
} from "../schedule/schedule.js";
import type { Community } from "../songs/search.js";

/** An imported play, which has no end, lasts until the next play that day, at most this long. */
const MAX_IMPORTED_SECONDS = 12 * 60;
/** A song's usual length is the median of its last this many service plays. */
const RECENT_PLAYS = 10;

export type EntryTime = {
  id: string;
  /** When it went live, for entries already shown; else when it should start. */
  at: string | null;
  shown: boolean;
  minutes: number;
  /** Estimated from the singing speed: the song has no service plays. */
  approximate: boolean;
};

export type PlaylistTimes = {
  entries: EntryTime[];
  end: string;
  approximate: boolean;
  /** The end of the scheduled event the playlist runs in, if any. */
  scheduledEnd: string | null;
  /** Minutes the estimated end runs past (positive) or before (negative) it. */
  minutesPast: number | null;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

/** How many words a song's version sings, counting repeats by name and repeat marks. */
export function sungWords(text: string): number {
  return parseSong(text)
    .slides.flatMap((slide) => sungLines(slide))
    .map((line) => line.text.replace(/<[^>]*>/g, " ").replace(/[~_]/g, " "))
    .join(" ")
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/**
 * Each song's usual length in seconds, from its last service plays, and the community's
 * singing speed in seconds per sung word, over the songs that have a usual length.
 */
export function songLengths(db: Db, community: Community, timeZone: string) {
  const plays = db
    .prepare(
      `SELECT song_id, mode, played_at, ended_at, imported FROM plays
       WHERE community_id = ? ORDER BY played_at`,
    )
    .all(community.id) as {
    song_id: string;
    mode: string;
    played_at: string;
    ended_at: string | null;
    imported: number;
  }[];
  const days = plays.map(
    (p) => localTime(new Date(p.played_at), timeZone).date,
  );
  const bySong = new Map<string, number[]>();
  plays.forEach((play, i) => {
    if (play.mode !== "service") return;
    const start = Date.parse(play.played_at);
    const next = plays[i + 1];
    const seconds = play.ended_at
      ? (Date.parse(play.ended_at) - start) / 1000
      : play.imported && next && days[i + 1] === days[i]
        ? Math.min(
            (Date.parse(next.played_at) - start) / 1000,
            MAX_IMPORTED_SECONDS,
          )
        : null;
    if (seconds === null || seconds <= 0) return;
    bySong.set(play.song_id, [...(bySong.get(play.song_id) ?? []), seconds]);
  });
  const lengths = new Map(
    [...bySong].map(([song, all]) => [song, median(all.slice(-RECENT_PLAYS))]),
  );

  // Seconds per word over the songs with a usual length, in their first language.
  const versions = db.prepare(
    `SELECT v.language, v.lyrics, s.music FROM song_versions v JOIN songs s ON s.id = v.song_id
     WHERE v.song_id = ? AND v.deleted_at IS NULL`,
  );
  const text = (song: string) => {
    const all = versions.all(song) as {
      language: string;
      lyrics: string;
      music: string | null;
    }[];
    const one =
      community.languages
        .map((l) => all.find((v) => v.language === l))
        .find(Boolean) ?? all[0];
    return one && textOf(one.lyrics, one.music);
  };
  let seconds = 0;
  let words = 0;
  for (const [song, length] of lengths) {
    const version = text(song);
    const sung = version ? sungWords(version) : 0;
    if (sung === 0) continue;
    seconds += length;
    words += sung;
  }
  // ponytail: a community with no timed plays gets a guess of 1.2 seconds per word.
  return { lengths, secondsPerWord: words ? seconds / words : 1.2, text };
}

/**
 * The time of each entry: when it went live for those already shown, and estimated
 * starts for the others, from the live entry or from now (or the next event's start).
 */
export function playlistTimes(
  db: Db,
  community: Community,
  playlistId: string,
  state: LiveState,
  events: ScheduleEvent[],
  timeZone: string,
  now = new Date(),
  measured = songLengths(db, community, timeZone),
): PlaylistTimes | null {
  const playlist = getPlaylist(db, community.id, playlistId);
  if (!playlist) return null;
  const { lengths, secondsPerWord, text } = measured;
  const liveIndex =
    state.playlistId === playlistId
      ? playlist.entries.findIndex((e) => e.id === state.entryId)
      : -1;
  const event = eventAround(now, events, timeZone);
  let cursor =
    liveIndex >= 0 && state.since
      ? Date.parse(state.since)
      : Math.max(now.getTime(), event?.start.getTime() ?? 0);
  let approximate = false;

  const entries = playlist.entries.map((entry, i): EntryTime => {
    let minutes = entry.plannedMinutes ?? 0;
    let guessed = false;
    if (entry.song) {
      const known = lengths.get(entry.song.id);
      if (known !== undefined) minutes = known / 60;
      else {
        const version = text(entry.song.id);
        minutes = ((version ? sungWords(version) : 0) * secondsPerWord) / 60;
        guessed = true;
        if (i >= liveIndex) approximate = true;
      }
    }
    if (i < liveIndex)
      return {
        id: entry.id,
        at: state.wentLive?.[entry.id] ?? null,
        shown: true,
        minutes,
        approximate: guessed,
      };
    // Estimates to the minute, so they don't change with every look.
    const at = new Date(
      i === liveIndex ? cursor : Math.round(cursor / 60_000) * 60_000,
    ).toISOString();
    cursor += minutes * 60_000;
    // The live entry can't end before now.
    if (i === liveIndex) cursor = Math.max(cursor, now.getTime());
    return {
      id: entry.id,
      at,
      shown: i === liveIndex,
      minutes,
      approximate: guessed,
    };
  });

  // While something is live, only an event that has started, or starts within the
  // hour, is the one the playlist runs in; not next Sunday's.
  const runsIn =
    event &&
    (liveIndex < 0 || event.start.getTime() - now.getTime() <= 60 * 60_000)
      ? event
      : null;
  return {
    entries,
    end: new Date(Math.round(cursor / 60_000) * 60_000).toISOString(),
    approximate,
    scheduledEnd: runsIn ? runsIn.end.toISOString() : null,
    minutesPast: runsIn
      ? Math.round((cursor - runsIn.end.getTime()) / 60_000)
      : null,
  };
}
