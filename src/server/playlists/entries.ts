import { isValidReference } from "../../shared/bible.js";
import type { Db } from "../db/db.js";
import { isMember } from "../auth/members.js";
import { newId } from "../ids.js";
import type { EntryInput, EntryKind, Who } from "./playlists.js";

const touch = (db: Db, playlistId: string, userId: string, at: string) =>
  db
    .prepare("UPDATE playlists SET updated_at = ?, updated_by = ? WHERE id = ?")
    .run(at, userId, playlistId);

const playlistExists = (db: Db, communityId: string, id: string) =>
  db
    .prepare(
      // Archived playlists aren't changed, only read and restored.
      "SELECT 1 FROM playlists WHERE id = ? AND community_id = ? AND deleted_at IS NULL AND archived_at IS NULL",
    )
    .get(id, communityId) !== undefined;

/**
 * Adds an entry after the last one. Returns its id, null when the playlist doesn't
 * exist, or a message when the entry isn't valid.
 */
export function addEntry(
  db: Db,
  playlistId: string,
  input: EntryInput,
  { communityId, userId, now = new Date() }: Who,
): { id: string } | { error: string } | null {
  if (!playlistExists(db, communityId, playlistId)) return null;
  const bad = badEntry(db, communityId, input);
  if (bad) return { error: bad };
  const id = newId();
  const at = now.toISOString();
  const { kind, songId, bible, text, plannedMinutes } = input;
  db.transaction(() => {
    const last = db
      .prepare(
        "SELECT max(position) FROM entries WHERE playlist_id = ? AND deleted_at IS NULL",
      )
      .pluck()
      .get(playlistId) as number | null;
    db.prepare(
      `INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, bible_book,
         bible_chapter, bible_verse_from, bible_verse_to, text, planned_minutes,
         created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      communityId,
      playlistId,
      (last ?? 0) + 1,
      kind,
      kind === "song" ? songId : null,
      bible?.book ?? null,
      bible?.chapter ?? null,
      bible?.from ?? null,
      bible?.to ?? null,
      kind === "song" || kind === "bible" ? null : text?.trim(),
      kind === "song" || kind === "bible" ? null : (plannedMinutes ?? null),
      at,
      at,
      userId,
      userId,
    );
    touch(db, playlistId, userId, at);
  })();
  return { id };
}

function badEntry(
  db: Db,
  communityId: string,
  { kind, songId, bible, text }: EntryInput,
): string | null {
  if (kind === "song")
    return songId &&
      db
        .prepare("SELECT 1 FROM songs WHERE id = ? AND community_id = ?")
        .get(songId, communityId)
      ? null
      : "No such song";
  if (kind === "bible")
    return bible && isValidReference(bible) ? null : "No such Bible passage";
  return text?.trim() ? null : "The text is empty";
}

/** The playlist's live entries, in order. */
const entryOrder = (db: Db, playlistId: string) =>
  db
    .prepare(
      `SELECT id, position FROM entries WHERE playlist_id = ? AND deleted_at IS NULL
       ORDER BY position, created_at`,
    )
    .all(playlistId) as { id: string; position: number }[];

const findEntry = (
  db: Db,
  communityId: string,
  playlistId: string,
  id: string,
) =>
  db
    .prepare(
      `SELECT e.kind FROM entries e JOIN playlists p ON p.id = e.playlist_id
       WHERE e.id = ? AND e.playlist_id = ? AND e.community_id = ?
         AND e.deleted_at IS NULL AND p.deleted_at IS NULL AND p.archived_at IS NULL`,
    )
    .get(id, playlistId, communityId) as { kind: EntryKind } | undefined;

/**
 * Changes a divider's, a text slide's or a slides entry's text and planned minutes. Returns false when
 * the entry doesn't exist, or a message when the change doesn't fit it.
 */
export function changeEntry(
  db: Db,
  playlistId: string,
  id: string,
  change: {
    text?: string;
    plannedMinutes?: number | null;
    keySignature?: string | null;
    hostWords?: Record<string, string>;
    ledBy?: string | null;
  },
  { communityId, userId, now = new Date() }: Who,
): boolean | { error: string } {
  const entry = findEntry(db, communityId, playlistId, id);
  if (!entry) return false;
  const texts =
    change.text !== undefined || change.plannedMinutes !== undefined;
  if (texts && (entry.kind === "song" || entry.kind === "bible"))
    return {
      error: "Only dividers, text slides and slides have text and minutes",
    };
  if (change.keySignature !== undefined && entry.kind !== "song")
    return { error: "Only songs have a key" };
  if (change.ledBy !== undefined && entry.kind !== "song")
    return { error: "Only songs are led" };
  if (change.ledBy && !isMember(db, communityId, change.ledBy))
    return { error: "Not a member" };
  if (change.text !== undefined && !change.text.trim())
    return { error: "The text is empty" };
  const words = Object.entries(change.hostWords ?? {})
    .map(([language, text]) => [language, text.trim()] as const)
    .filter(([, text]) => text);
  const languages = JSON.parse(
    db
      .prepare("SELECT languages FROM communities WHERE id = ?")
      .pluck()
      .get(communityId) as string,
  ) as string[];
  if (words.some(([language]) => !languages.includes(language)))
    return { error: "A language the community doesn't have" };
  const at = now.toISOString();
  db.transaction(() => {
    if (change.text !== undefined)
      db.prepare("UPDATE entries SET text = ? WHERE id = ?").run(
        change.text.trim(),
        id,
      );
    if (change.plannedMinutes !== undefined)
      db.prepare("UPDATE entries SET planned_minutes = ? WHERE id = ?").run(
        change.plannedMinutes,
        id,
      );
    if (change.keySignature !== undefined)
      db.prepare("UPDATE entries SET key_signature = ? WHERE id = ?").run(
        change.keySignature?.trim() || null,
        id,
      );
    if (change.hostWords !== undefined)
      db.prepare("UPDATE entries SET host_words = ? WHERE id = ?").run(
        words.length ? JSON.stringify(Object.fromEntries(words)) : null,
        id,
      );
    if (change.ledBy !== undefined)
      // The schema turns null into "": no one chosen.
      db.prepare("UPDATE entries SET led_by = ? WHERE id = ?").run(
        change.ledBy || null,
        id,
      );
    db.prepare(
      "UPDATE entries SET updated_at = ?, updated_by = ? WHERE id = ?",
    ).run(at, userId, id);
    touch(db, playlistId, userId, at);
  })();
  return true;
}

/**
 * Moves an entry right after `after`, or to the top for null: halfway between its new
 * neighbors, or the whole playlist renumbered when they're too close for that.
 */
export function moveEntry(
  db: Db,
  playlistId: string,
  id: string,
  after: string | null,
  { communityId, userId, now = new Date() }: Who,
): boolean {
  if (!findEntry(db, communityId, playlistId, id) || after === id) return false;
  const at = now.toISOString();
  return db.transaction(() => {
    const order = entryOrder(db, playlistId).filter((e) => e.id !== id);
    const index =
      after === null ? 0 : order.findIndex((e) => e.id === after) + 1;
    if (index === 0 && after !== null) return false;
    const previous = order[index - 1]?.position;
    const next = order[index]?.position;
    const setPosition = db.prepare(
      "UPDATE entries SET position = ?, updated_at = ?, updated_by = ? WHERE id = ?",
    );
    if (
      previous !== undefined &&
      next !== undefined &&
      next - previous < 1e-9
    ) {
      order.splice(index, 0, { id, position: 0 });
      order.forEach((e, i) => setPosition.run(i + 1, at, userId, e.id));
    } else
      setPosition.run(
        previous === undefined
          ? (next ?? 2) - 1
          : next === undefined
            ? previous + 1
            : (previous + next) / 2,
        at,
        userId,
        id,
      );
    touch(db, playlistId, userId, at);
    return true;
  })();
}

/** Soft-deletes an entry; false when it doesn't exist. */
export function removeEntry(
  db: Db,
  playlistId: string,
  id: string,
  { communityId, userId, now = new Date() }: Who,
): boolean {
  if (!findEntry(db, communityId, playlistId, id)) return false;
  const at = now.toISOString();
  db.transaction(() => {
    db.prepare(
      "UPDATE entries SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE id = ?",
    ).run(at, at, userId, id);
    touch(db, playlistId, userId, at);
  })();
  return true;
}

/** Puts a removed entry back in its place, for Undo; false if it isn't removed. */
export function restoreEntry(
  db: Db,
  playlistId: string,
  id: string,
  { communityId, userId, now = new Date() }: Who,
): boolean {
  const at = now.toISOString();
  return db.transaction(() => {
    const restored = db
      .prepare(
        `UPDATE entries SET deleted_at = NULL, updated_at = ?, updated_by = ?
         WHERE id = ? AND playlist_id = ? AND community_id = ? AND deleted_at IS NOT NULL
           AND EXISTS (SELECT 1 FROM playlists p WHERE p.id = playlist_id AND p.deleted_at IS NULL AND p.archived_at IS NULL)`,
      )
      .run(at, userId, id, playlistId, communityId).changes;
    if (restored) touch(db, playlistId, userId, at);
    return restored > 0;
  })();
}
