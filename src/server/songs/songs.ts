import {
  mergeText,
  type Music,
  musicOfTexts,
  noMusic,
  splitText,
} from "../../shared/music/chord-track.js";
import { median } from "../../shared/music/tempo.js";
import type { Opinions } from "./song-feedback.js";
import type { Db } from "../db/db.js";
import { indexSongs } from "./search.js";

/** A recording to learn a song from: an https address, its title and site, and a picture Norless keeps. */
export type ReferenceLink = {
  url: string;
  title: string;
  /** The site's own name ("YouTube"); empty shows the address's. */
  site: string;
  /** An image id, served at /api/images/:id. */
  image: string | null;
};

/** Someone, as views show them: their name and photo (an image id). */
export type Person = { name: string; avatar: string | null };

export type Song = {
  id: string;
  keySignature: string;
  timeSignature: string;
  tags: string[];
  /** Beats per minute, set by the team and editors. */
  bpm: number | null;
  /** Recordings to learn it from. */
  referenceLinks: ReferenceLink[];
  /** Who wrote it, whose copyright it is, and the https page it was taken from. */
  authors: string;
  copyright: string;
  sourceUrl: string | null;
  /** The median of the last three tempo checks, when it differs from bpm by 2 or more. */
  suggestedBpm: number | null;
  updatedAt: string;
  /** Set when the song was deleted; old playlists still show it. */
  deletedAt: string | null;
  /** Who created and last edited it, by name; only for members. */
  people?: { createdBy: Person | null; updatedBy: Person | null };
  /** Set when the owners took the song out of use, saying why. */
  excluded: { reason: string; at: string } | null;
  /** Likes and dislikes; only for members. */
  opinions?: Opinions;
  /** The chords, notes and notation of every language. */
  music: Music;
  /** Oldest first: the first one is shown when a language has no version. */
  versions: {
    language: string;
    title: string;
    /** The words with the track's chords, notes and blocks, as the views read them: built when sent, never stored. */
    text: string;
    /** The words alone, as editors edit them. */
    lyrics: string;
    updatedAt: string;
  }[];
};

/** A song of the community with its versions, including a deleted song. */
export function getSong(db: Db, communityId: string, id: string): Song | null {
  const song = db
    .prepare(
      `SELECT id, key_signature AS keySignature, time_signature AS timeSignature, tags, bpm,
         reference_links AS referenceLinks, authors, copyright, source_url AS sourceUrl,
         updated_at AS updatedAt, deleted_at AS deletedAt,
         excluded_reason AS excludedReason, excluded_at AS excludedAt, music
       FROM songs WHERE id = ? AND community_id = ?`,
    )
    .get(id, communityId) as
    | (Omit<
        Song,
        | "tags"
        | "versions"
        | "suggestedBpm"
        | "excluded"
        | "referenceLinks"
        | "music"
      > & {
        tags: string;
        referenceLinks: string;
        excludedReason: string | null;
        excludedAt: string | null;
        music: string | null;
      })
    | undefined;
  if (!song) return null;
  const { excludedReason, excludedAt, music, ...fields } = song;
  const checks = db
    .prepare(
      "SELECT bpm FROM tempo_checks WHERE song_id = ? ORDER BY measured_at DESC, rowid DESC LIMIT 3",
    )
    .pluck()
    .all(id) as number[];
  const measured = median(checks);
  const suggestedBpm =
    measured !== null &&
    (song.bpm === null || Math.abs(measured - song.bpm) >= 2)
      ? measured
      : null;
  const { versions, track } = trackOf(db, id, music);
  return {
    ...fields,
    music: track,
    suggestedBpm,
    tags: JSON.parse(song.tags) as string[],
    referenceLinks: JSON.parse(song.referenceLinks) as ReferenceLink[],
    excluded:
      excludedReason !== null && excludedAt !== null
        ? { reason: excludedReason, at: excludedAt }
        : null,
    versions,
  };
}

/**
 * The text the views read: the words with the track's chords,
 * notes and blocks, built when a song is sent, never stored.
 */
export const textOf = (lyrics: string, music: Music | string | null) =>
  mergeText(
    lyrics,
    typeof music === "string"
      ? (JSON.parse(music) as Music)
      : (music ?? noMusic()),
  );

/** A song's versions, with the text the views read, and its track. */
function trackOf(
  db: Db,
  id: string,
  stored: string | null,
): { versions: Song["versions"]; track: Music } {
  const rows = db
    .prepare(
      `SELECT language, title, lyrics, updated_at AS updatedAt FROM song_versions
       WHERE song_id = ? AND deleted_at IS NULL ORDER BY created_at, language`,
    )
    .all(id) as Omit<Song["versions"][number], "text">[];
  const track = stored === null ? noMusic() : (JSON.parse(stored) as Music);
  return {
    versions: rows.map((r) => ({ ...r, text: textOf(r.lyrics, track) })),
    track,
  };
}

/**
 * Takes apart the texts in the old format, chords on lines above the words, that the
 * import and the seeds write into `lyrics`: a song's words and its track, and its
 * revisions'. Their times stay: nothing changed for people.
 */
export function convertSongs(db: Db) {
  const songs = db
    .prepare("SELECT id FROM songs WHERE music IS NULL")
    .pluck()
    .all() as string[];
  db.transaction(() => {
    for (const id of songs) {
      const rows = db
        .prepare(
          "SELECT language, lyrics, deleted_at AS deletedAt FROM song_versions WHERE song_id = ? ORDER BY created_at, language",
        )
        .all(id) as {
        language: string;
        lyrics: string;
        deletedAt: string | null;
      }[];
      const music = musicOfTexts(
        rows.filter((r) => r.deletedAt === null).map((r) => r.lyrics),
      );
      db.prepare("UPDATE songs SET music = ? WHERE id = ?").run(
        JSON.stringify(music),
        id,
      );
      for (const r of rows)
        db.prepare(
          "UPDATE song_versions SET lyrics = ? WHERE song_id = ? AND language = ?",
        ).run(splitText(r.lyrics).lyrics, id, r.language);
    }
    const old = db
      .prepare("SELECT id, versions FROM song_revisions WHERE music IS NULL")
      .all() as { id: string; versions: string }[];
    for (const r of old) {
      const versions = JSON.parse(r.versions) as StoredVersion[];
      db.prepare(
        "UPDATE song_revisions SET music = ?, versions = ? WHERE id = ?",
      ).run(
        JSON.stringify(musicOfTexts(versions.map((v) => v.lyrics))),
        JSON.stringify(
          versions.map((v) => ({ ...v, lyrics: splitText(v.lyrics).lyrics })),
        ),
        r.id,
      );
    }
  })();
  indexSongs(db, songs);
  return songs.length;
}

/** A version as a revision keeps it. */
export type StoredVersion = { language: string; title: string; lyrics: string };

/** Who created and last edited a song, with their photos; a deleted account has none. */
export function people(db: Db, id: string): NonNullable<Song["people"]> {
  const row = db
    .prepare(
      `SELECT nullif(c.display_name, '') AS createdBy, c.avatar AS createdByAvatar,
         nullif(u.display_name, '') AS updatedBy, u.avatar AS updatedByAvatar
       FROM songs s LEFT JOIN users c ON c.id = s.created_by LEFT JOIN users u ON u.id = s.updated_by
       WHERE s.id = ?`,
    )
    .get(id) as Record<string, string | null>;
  const person = (name: string | null | undefined, avatar?: string | null) =>
    name ? { name, avatar: avatar ?? null } : null;
  return {
    createdBy: person(row.createdBy, row.createdByAvatar),
    updatedBy: person(row.updatedBy, row.updatedByAvatar),
  };
}

export type Conflict = {
  language: string;
  theirs: string | null;
  mine: string;
};
