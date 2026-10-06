import { type Music, noMusic } from "../../shared/music/chord-track.js";
import type { Db } from "../db/db.js";
import {
  type Edit,
  keepRevision,
  storedTags,
  storeMusic,
} from "./song-saves.js";
import {
  getSong,
  type ReferenceLink,
  type Song,
  type StoredVersion,
  textOf,
} from "./songs.js";

export type Revision = {
  id: string;
  /** When the save that replaced this state happened, and by whom. */
  savedAt: string;
  savedBy: string | null;
  keySignature: string;
  timeSignature: string;
  tags: string[];
  bpm: number | null;
  authors: string;
  copyright: string;
  sourceUrl: string | null;
  /** Null in revisions saved before links were kept. */
  referenceLinks: ReferenceLink[] | null;
  /** Each version's words, and the text the views read, built from them and the track. */
  versions: { language: string; title: string; lyrics: string; text: string }[];
  music: Music;
};

/** A song's states before each save, newest first. */
export function revisions(db: Db, communityId: string, id: string): Revision[] {
  const rows = db
    .prepare(
      `SELECT r.id, r.created_at AS savedAt, nullif(u.display_name, '') AS savedBy,
         r.key_signature AS keySignature, r.time_signature AS timeSignature, r.tags, r.bpm,
         r.authors, r.copyright, r.source_url AS sourceUrl,
         r.reference_links AS referenceLinks, r.versions, r.music
       FROM song_revisions r LEFT JOIN users u ON u.id = r.created_by
       WHERE r.song_id = ? AND r.community_id = ?
       ORDER BY r.created_at DESC, r.rowid DESC`,
    )
    .all(id, communityId) as (Omit<
    Revision,
    "tags" | "versions" | "referenceLinks" | "music"
  > & {
    tags: string;
    referenceLinks: string | null;
    versions: string;
    music: string | null;
  })[];
  return rows.map((r) => ({
    ...r,
    tags: JSON.parse(r.tags) as string[],
    referenceLinks:
      r.referenceLinks === null
        ? null
        : (JSON.parse(r.referenceLinks) as ReferenceLink[]),
    versions: (JSON.parse(r.versions) as StoredVersion[]).map((v) => ({
      ...v,
      text: textOf(v.lyrics, r.music),
    })),
    music: r.music === null ? noMusic() : (JSON.parse(r.music) as Music),
  }));
}

/** Puts the song back as it was in a revision; the state before stays in the history. */
export function restoreRevision(
  db: Db,
  id: string,
  revisionId: string,
  edit: Edit,
): Song | null {
  const at = (edit.now ?? new Date()).toISOString();
  return db.transaction(() => {
    const song = getSong(db, edit.communityId, id);
    const revision = revisions(db, edit.communityId, id).find(
      (r) => r.id === revisionId,
    );
    if (!song || song.deletedAt || !revision) return null;
    keepRevision(db, id, edit, at);
    db.prepare(
      `UPDATE songs SET key_signature = ?, time_signature = ?, tags = ?, bpm = ?,
         authors = ?, copyright = ?, source_url = ?,
         reference_links = coalesce(?, reference_links), updated_at = ?, updated_by = ?
       WHERE id = ?`,
    ).run(
      revision.keySignature,
      revision.timeSignature,
      storedTags(revision.tags),
      revision.bpm,
      revision.authors,
      revision.copyright,
      revision.sourceUrl,
      revision.referenceLinks && JSON.stringify(revision.referenceLinks),
      at,
      edit.userId,
      id,
    );
    storeMusic(
      db,
      id,
      revision.music,
      edit,
      at,
      new Map(
        revision.versions.map((v) => [
          v.language,
          { title: v.title, lyrics: v.lyrics },
        ]),
      ),
    );
    const kept = revision.versions.map((v) => v.language);
    for (const v of song.versions)
      if (!kept.includes(v.language))
        db.prepare(
          "UPDATE song_versions SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE song_id = ? AND language = ?",
        ).run(at, at, edit.userId, id, v.language);
    return getSong(db, edit.communityId, id);
  })();
}
