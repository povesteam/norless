import {
  hasMusic,
  type Music,
  musicFromText,
  musicOfTexts,
  splitText,
} from "../../shared/music/chord-track.js";
import { replaceSection } from "../../shared/song-edit.js";
import { normalizeTag } from "../../shared/tags.js";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";
import { indexSongs } from "./search.js";
import { type Conflict, getSong, type Song } from "./songs.js";

/** Saves a song's track and the words of the versions given. */
export function storeMusic(
  db: Db,
  id: string,
  music: Music,
  edit: Edit,
  at: string,
  lyrics = new Map<string, { title: string; lyrics: string }>(),
) {
  db.prepare("UPDATE songs SET music = ? WHERE id = ?").run(
    JSON.stringify(music),
    id,
  );
  for (const [language, v] of lyrics)
    upsertVersion(db, id, { language, title: v.title }, v.lyrics, edit, at);
}

export type VersionInput = { language: string; title: string; text: string };
export type SongInput = {
  keySignature?: string;
  timeSignature?: string;
  tags?: string[];
  /** Left out, they stay as they are. */
  authors?: string;
  copyright?: string;
  sourceUrl?: string | null;
  versions: (VersionInput & {
    /** The version's text when editing started; absent for a new language. */
    baseText?: string;
  })[];
};

export type Edit = { communityId: string; userId: string; now?: Date };

/** Tags as stored: normalized, without empty ones or repeats. */
export const storedTags = (tags: string[] = []) =>
  JSON.stringify([...new Set(tags.map(normalizeTag).filter(Boolean))]);

function upsertVersion(
  db: Db,
  songId: string,
  v: { language: string; title: string },
  lyrics: string,
  edit: Edit,
  at: string,
) {
  db.prepare(
    `INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (song_id, language) DO UPDATE SET
         title = excluded.title, lyrics = excluded.lyrics, deleted_at = NULL,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  ).run(
    newId(),
    edit.communityId,
    songId,
    v.language,
    v.title,
    lyrics,
    at,
    at,
    edit.userId,
    edit.userId,
  );
  indexSongs(db, [songId]);
}

/** Keeps the song as it is now, before a save changes it, with who saves and when. */
export function keepRevision(db: Db, id: string, edit: Edit, at: string) {
  db.prepare(
    `INSERT INTO song_revisions (id, community_id, song_id, key_signature, time_signature, tags, bpm,
       authors, copyright, source_url, reference_links, music, versions, created_at, created_by)
     SELECT ?, community_id, id, key_signature, time_signature, tags, bpm, authors, copyright, source_url,
       reference_links, music,
       (SELECT json_group_array(json_object('language', language, 'title', title, 'lyrics', lyrics))
        FROM (SELECT language, title, lyrics FROM song_versions
              WHERE song_id = songs.id AND deleted_at IS NULL ORDER BY created_at, language)),
       ?, ?
     FROM songs WHERE id = ?`,
  ).run(newId(), at, edit.userId, id);
}

export function createSong(db: Db, input: SongInput, edit: Edit): Song {
  const id = newId();
  const at = (edit.now ?? new Date()).toISOString();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO songs (id, community_id, key_signature, time_signature, tags, authors, copyright, source_url,
         created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      edit.communityId,
      input.keySignature ?? "",
      input.timeSignature ?? "",
      storedTags(input.tags),
      input.authors?.trim() ?? "",
      input.copyright?.trim() ?? "",
      input.sourceUrl || null,
      at,
      at,
      edit.userId,
      edit.userId,
    );
    // Chords pasted with the words go to the track.
    storeMusic(
      db,
      id,
      musicOfTexts(input.versions.map((v) => v.text)),
      edit,
      at,
      new Map(
        input.versions.map((v) => [
          v.language,
          { title: v.title, lyrics: splitText(v.text).lyrics },
        ]),
      ),
    );
  })();
  return getSong(db, edit.communityId, id) as Song;
}

/**
 * Saves the whole song. A version whose text someone else changed since `baseText`
 * isn't overwritten: the save stops with a conflict showing both texts.
 */
export function updateSong(
  db: Db,
  id: string,
  input: SongInput,
  edit: Edit,
): Song | { conflict: Conflict } | null {
  const at = (edit.now ?? new Date()).toISOString();
  return db.transaction(() => {
    const song = getSong(db, edit.communityId, id);
    if (!song || isDeleted(db, id)) return null;
    // Editors edit the words; chord rows pasted with them go to the track.
    for (const v of input.versions) {
      const theirs = song.versions.find(
        (c) => c.language === v.language,
      )?.lyrics;
      const mine = splitText(v.text).lyrics;
      if (theirs !== undefined && theirs !== v.baseText && theirs !== mine)
        return { conflict: { language: v.language, theirs, mine: v.text } };
    }
    keepRevision(db, id, edit, at);
    const updated = db
      .prepare(
        `UPDATE songs SET key_signature = ?, time_signature = ?, tags = ?,
           authors = coalesce(?, authors), copyright = coalesce(?, copyright),
           source_url = CASE WHEN ? THEN ? ELSE source_url END,
           updated_at = ?, updated_by = ?
         WHERE id = ? AND community_id = ? AND deleted_at IS NULL`,
      )
      .run(
        input.keySignature ?? "",
        input.timeSignature ?? "",
        storedTags(input.tags),
        input.authors?.trim() ?? null,
        input.copyright?.trim() ?? null,
        input.sourceUrl === undefined ? 0 : 1,
        input.sourceUrl || null,
        at,
        edit.userId,
        id,
        edit.communityId,
      );
    if (updated.changes === 0) return null;
    let music = song.music;
    const lyrics = new Map<string, { title: string; lyrics: string }>();
    for (const v of input.versions) {
      const words = splitText(v.text).lyrics;
      if (hasMusic(v.text))
        music = musicFromText(music, words, v.text, undefined, true);
      lyrics.set(v.language, { title: v.title, lyrics: words });
    }
    storeMusic(db, id, music, edit, at, lyrics);
    return getSong(db, edit.communityId, id);
  })();
}

/**
 * Saves the words of one section of a version (`index` among the lyrics' sections); see
 * replaceSection for when it conflicts. Chord rows typed in go to the track.
 */
export function updateSection(
  db: Db,
  id: string,
  language: string,
  index: number,
  change: { baseText: string; text: string },
  edit: Edit,
): Song | { conflict: Conflict } | null {
  const at = (edit.now ?? new Date()).toISOString();
  return db.transaction(() => {
    const song = getSong(db, edit.communityId, id);
    const version = song?.versions.find((v) => v.language === language);
    if (!song || song.deletedAt || !version) return null;
    const result = replaceSection(
      version.lyrics,
      index,
      change.baseText,
      change.text,
    );
    if ("conflict" in result)
      return { conflict: { language, ...result.conflict } };
    keepRevision(db, id, edit, at);
    const words = splitText(result.text).lyrics;
    const music = hasMusic(result.text)
      ? musicFromText(song.music, words, result.text, undefined, true)
      : song.music;
    storeMusic(
      db,
      id,
      music,
      edit,
      at,
      new Map([[language, { title: version.title, lyrics: words }]]),
    );
    db.prepare(
      "UPDATE songs SET updated_at = ?, updated_by = ? WHERE id = ?",
    ).run(at, edit.userId, id);
    return getSong(db, edit.communityId, id);
  })();
}

/** Soft delete: the song leaves search, and old playlists still show it as deleted. */
export function deleteSong(db: Db, id: string, edit: Edit): boolean {
  const at = (edit.now ?? new Date()).toISOString();
  return (
    db
      .prepare(
        "UPDATE songs SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE id = ? AND community_id = ? AND deleted_at IS NULL",
      )
      .run(at, at, edit.userId, id, edit.communityId).changes > 0
  );
}

const isDeleted = (db: Db, id: string) =>
  db
    .prepare("SELECT deleted_at IS NOT NULL FROM songs WHERE id = ?")
    .pluck()
    .get(id) === 1;
