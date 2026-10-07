import { type BibleReference, parseReference } from "../../shared/bible.js";
import { plainLyrics } from "../../shared/song-render.js";
import { parseSong } from "../../shared/song-text.js";
import type { Db } from "../db/db.js";
import { likedSongs } from "./song-feedback.js";

export type SongResult = {
  type: "song";
  id: string;
  /** Title per language. */
  titles: Record<string, string>;
  keySignature: string;
  timeSignature: string;
  tags: string[];
  /** When the song was last played in a service, as an ISO timestamp. */
  lastPlayedAt: string | null;
  /** The member searching likes it. */
  liked?: true;
  /** Sung in most of the last services: in how many, of how many. */
  recent?: { services: number; of: number };
  /** How many recordings have it, when some do (rehearsal-recordings spec). */
  recordings?: number;
  /** Why the empty box suggests it. */
  reason?: Reason;
};

/** Liked by the member, played lately, or not played lately. */
export type Reason = "liked" | "lately" | "rested";

export type SearchResult =
  | SongResult
  | ({ type: "bible" } & BibleReference)
  | { type: "divider"; text: string }
  | { type: "new-song"; title: string };

export type Community = { id: string; languages: string[] };

/**
 * One search box's results, in order, leaving out excluded songs:
 * - an empty query: songs worth suggesting, then a random sample, up to 100 in all
 * - a Bible reference: the matching references
 * - anything else: up to 25 songs, title matches first, then a divider and a new song
 */
export function search(
  db: Db,
  community: Community,
  query: string,
  /** The member searching, whose liked songs are marked. */
  memberId?: string,
  /** The playlist the box adds to, whose songs aren't suggested. */
  playlistId?: string,
): SearchResult[] {
  const text = query.trim();
  const liked = new Set(memberId ? likedSongs(db, community.id, memberId) : []);
  const days = lastServiceDays(db, community.id);
  if (text === "") return browse(db, community.id, liked, days, playlistId);

  const references = parseReference(text, community.languages);
  if (references.length > 0)
    return references.map((r) => ({ type: "bible", ...r }));

  return [
    ...songResults(db, matchingSongs(db, community.id, text), liked, days),
    { type: "divider", text },
    { type: "new-song", title: text },
  ];
}

/** Songs suggested per reason when the box is empty. */
const SUGGESTED = 5;

/**
 * The empty box: up to 5 songs the member likes, 5 played in
 * one of the last services (two would earn the rotation hint), longest ago first, and 5
 * not played lately; none already in the playlist, a song once, each with its reason;
 * then random songs, up to 100 in all.
 */
function browse(
  db: Db,
  communityId: string,
  liked: Set<string>,
  days: string[],
  playlistId?: string,
): SongResult[] {
  const planned = new Set(
    db
      .prepare(
        "SELECT song_id FROM entries WHERE playlist_id = ? AND community_id = ? AND deleted_at IS NULL AND song_id IS NOT NULL",
      )
      .pluck()
      .all(playlistId ?? "", communityId) as string[],
  );
  const reasons = new Map<string, Reason>();
  const suggest = (reason: Reason, ids: string[]) =>
    ids
      .filter((id) => !planned.has(id) && !reasons.has(id))
      .slice(0, SUGGESTED)
      .forEach((id) => reasons.set(id, reason));
  suggest("liked", [...liked]);
  const since = days.at(-1);
  if (since)
    suggest(
      "lately",
      db
        .prepare(
          `SELECT p.song_id FROM plays p JOIN songs s ON s.id = p.song_id
           WHERE p.community_id = ? AND p.mode = 'service' AND p.played_at >= ?
             AND s.deleted_at IS NULL AND s.excluded_at IS NULL
           GROUP BY p.song_id HAVING count(DISTINCT substr(p.played_at, 1, 10)) < ?
           ORDER BY max(p.played_at)`,
        )
        .pluck()
        .all(communityId, since, MOST_SERVICES) as string[],
    );
  suggest(
    "rested",
    restedSongs(db, communityId).map((r) => r.id),
  );
  const random = db
    .prepare(
      `SELECT id FROM songs WHERE community_id = ? AND deleted_at IS NULL AND excluded_at IS NULL
       ORDER BY random() LIMIT 100`,
    )
    .pluck()
    .all(communityId) as string[];
  const ids = [
    ...reasons.keys(),
    ...random.filter((id) => !reasons.has(id)),
  ].slice(0, 100);
  return songResults(db, ids, liked, days).map((song) => {
    const reason = reasons.get(song.id);
    return reason ? { ...song, reason } : song;
  });
}

/**
 * Up to 50 songs played in 3 services or more, none in the last 6 months, most played
 * first: the Statistics page's "Not played lately".
 */
export function restedSongs(db: Db, communityId: string, now = new Date()) {
  return db
    .prepare(
      `SELECT p.song_id AS id, count(*) AS services, max(p.played_at) AS last
       FROM plays p JOIN songs s ON s.id = p.song_id
       WHERE p.community_id = ? AND p.mode = 'service'
         AND s.deleted_at IS NULL AND s.excluded_at IS NULL
       GROUP BY p.song_id HAVING services >= 3 AND last < ?
       ORDER BY services DESC, last DESC LIMIT 50`,
    )
    .all(
      communityId,
      new Date(now.getTime() - 182 * 86_400_000).toISOString(),
    ) as { id: string; services: number }[];
}

/** Lyrics only, for the search index: no chords, section names, notes or repeats. */
const indexedLyrics = (text: string) =>
  plainLyrics(
    parseSong(text)
      .sections.filter((s) => s.repeatOf === null)
      .flatMap((s) => s.lines),
  );

/**
 * Brings the search index up to date with the song texts: the given songs' versions, or
 * every version. The code that writes a song's text calls it, so the index needs no
 * triggers (the database spec).
 */
export function indexSongs(db: Db, songIds?: string[]) {
  const versions = (
    songIds
      ? db
          .prepare(
            "SELECT id, title, lyrics FROM song_versions WHERE song_id IN (SELECT value FROM json_each(?))",
          )
          .all(JSON.stringify(songIds))
      : db.prepare("SELECT id, title, lyrics FROM song_versions").all()
  ) as { id: string; title: string; lyrics: string }[];
  const drop = db.prepare("DELETE FROM songs_fts WHERE version_id = ?");
  const add = db.prepare(
    "INSERT INTO songs_fts (version_id, title, lyrics) VALUES (?, ?, ?)",
  );
  db.transaction(() => {
    if (!songIds) db.prepare("DELETE FROM songs_fts").run();
    for (const v of versions) {
      if (songIds) drop.run(v.id);
      add.run(v.id, v.title, indexedLyrics(v.lyrics));
    }
  })();
}

/** Ids of up to 25 songs whose title or lyrics contain every word, as a prefix. */
function matchingSongs(db: Db, communityId: string, text: string): string[] {
  const words = text.match(/[\p{L}\p{M}\p{N}]+/gu);
  if (!words) return [];
  const all = words.map((w) => `"${w}"*`).join(" ");
  const hits = `FROM songs_fts
    JOIN song_versions v ON v.id = songs_fts.version_id AND v.deleted_at IS NULL
    JOIN songs s ON s.id = v.song_id AND s.deleted_at IS NULL AND s.excluded_at IS NULL
      AND s.community_id = @community`;
  const rows = db
    .prepare(
      `SELECT v.song_id AS id, 0 AS tier, bm25(songs_fts) AS score ${hits} WHERE songs_fts MATCH @title
       UNION ALL
       SELECT v.song_id, 1, bm25(songs_fts, 0, 10, 1) ${hits} WHERE songs_fts MATCH @all`,
    )
    .all({ community: communityId, title: `title : (${all})`, all }) as {
    id: string;
    tier: number;
    score: number;
  }[];

  rows.sort((a, b) => a.tier - b.tier || a.score - b.score);
  const ids = new Set<string>();
  for (const { id } of rows) {
    if (ids.size === 25) break;
    ids.add(id);
  }
  return [...ids];
}

/** How many of the last services the rotation hint looks at. */
export const RECENT_SERVICES = 4;

/** The days of the community's last `count` services (or fewer), newest first. */
export function lastServiceDays(
  db: Db,
  communityId: string,
  count = RECENT_SERVICES,
): string[] {
  return db
    .prepare(
      `SELECT DISTINCT substr(played_at, 1, 10) AS day FROM plays
       WHERE community_id = ? AND mode = 'service' ORDER BY day DESC LIMIT ?`,
    )
    .pluck()
    .all(communityId, count) as string[];
}

/**
 * Played in this many of the last services, or more, earns a hint: a song is rarely
 * played twice in a month.
 */
export const MOST_SERVICES = 2;

/** Songs as search results: titles per language, key, time, tags, last service play and a like. */
export function songResults(
  db: Db,
  ids: string[],
  liked = new Set<string>(),
  /** The last service days: a song sung in most of them says so. */
  days: string[] = [],
): SongResult[] {
  const recent = db.prepare(
    `SELECT count(DISTINCT substr(played_at, 1, 10)) FROM plays
     WHERE song_id = ? AND mode = 'service' AND played_at >= ?`,
  );
  const since = days.at(-1);
  const services = (id: string) =>
    since ? (recent.pluck().get(id, since) as number) : 0;
  const song = db.prepare(
    `SELECT key_signature, time_signature, tags,
       (SELECT max(played_at) FROM plays p WHERE p.song_id = s.id AND p.mode = 'service') AS last_played_at
     FROM songs s WHERE id = ?`,
  );
  const titles = db.prepare(
    "SELECT language, title FROM song_versions WHERE song_id = ? AND deleted_at IS NULL",
  );
  const recorded = db.prepare(
    `SELECT count(*) FROM recordings r
     WHERE r.deleted_at IS NULL AND r.status = 'ready'
       AND EXISTS (SELECT 1 FROM recording_parts p WHERE p.recording_id = r.id AND p.song_id = ?)`,
  );
  return ids.map((id) => {
    const row = song.get(id) as {
      key_signature: string;
      time_signature: string;
      tags: string;
      last_played_at: string | null;
    };
    const versions = titles.all(id) as { language: string; title: string }[];
    const sung = services(id);
    const recordings = recorded.pluck().get(id) as number;
    return {
      type: "song",
      id,
      titles: Object.fromEntries(versions.map((v) => [v.language, v.title])),
      keySignature: row.key_signature,
      timeSignature: row.time_signature,
      tags: JSON.parse(row.tags) as string[],
      lastPlayedAt: row.last_played_at,
      ...(liked.has(id) && { liked: true as const }),
      ...(sung >= MOST_SERVICES && {
        recent: { services: sung, of: days.length },
      }),
      ...(recordings > 0 && { recordings }),
    };
  });
}
