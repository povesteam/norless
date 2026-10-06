import type { Document } from "bson";
import {
  RO,
  UA,
  iso,
  legacyId,
  str,
  type Mapping,
  type Row,
} from "./mapping.js";
import { splitTitle } from "./playlist-title.js";

/** Playlists and entries. */
export function mapPlaylists(
  { get, note, rows, at, times, imported, community }: Mapping,
  {
    userOf,
    songIdIn,
    skippedIn,
  }: {
    userOf: (oldId: unknown) => string | null;
    songIdIn: (db: string, oldId: string) => string | undefined;
    skippedIn: (db: string, oldId: string) => boolean;
  },
) {
  const entriesOf = (db: string) => {
    const byPlaylist = new Map<string, Document[]>();
    for (const e of get(db, "entries")) {
      const list = byPlaylist.get(String(e.playlist_id)) ?? [];
      byPlaylist.set(String(e.playlist_id), list);
      list.push(e);
    }
    for (const list of byPlaylist.values())
      list.sort((a, b) => Number(a.position) - Number(b.position));
    return byPlaylist;
  };
  const roEntries = entriesOf(RO);
  // The Romanian app's entries, for the slides its screens showed.
  const roEntryIds = new Map<string, { id: string; playlistId: string }>();
  const uaEntries = entriesOf(UA);
  const signature = (entries: Document[] = []) =>
    entries
      .filter((e) => !e.deleted)
      .map((e) => `${e.klass}:${e.identifier}`)
      .join("|");

  const addPlaylist = (
    source: string,
    db: string, // whose song ids the entries use
    playlist: Document,
    entries: Document[],
    titleSuffix = "",
  ) => {
    const id = legacyId(source, "playlists", String(playlist._id));
    const created =
      times?.insertedAt(db, "playlists", String(playlist._id)) ??
      iso(playlist.position) ??
      at;
    // A date in the title becomes the playlist's date, which names it.
    const old = str(playlist.title).trim();
    const split = splitTitle(old, created);
    if (!split && /^\d/.test(old)) note("playlistTitlesWithDigitsKept", id);
    const title = split ? split.title : old || null;
    rows.playlists.push({
      id,
      title: [title, titleSuffix].filter(Boolean).join(" ") || null,
      service_date: split?.date ?? null,
      legacy_id: String(playlist._id),
      ...community,
      created_at: created,
      created_by: userOf(playlist.creator),
      ...imported,
    });
    for (const e of entries) {
      const removed = times?.deletedAt(db, String(e._id));
      const entry: Row = {
        id: legacyId(source, "entries", String(e._id)),
        playlist_id: id,
        position: Number(e.position) || 0,
        kind: null,
        song_id: null,
        bible_book: null,
        bible_chapter: null,
        bible_verse_from: null,
        bible_verse_to: null,
        text: null,
        legacy_id: String(e._id),
        ...community,
        created_at:
          times?.insertedAt(db, "entries", String(e._id)) ??
          iso(e.position) ??
          created,
        created_by: userOf(e.username),
        // A song put in and taken out before the service: when, and by whom.
        deleted_at: e.deleted ? (removed?.at ?? at) : null,
        updated_by: e.deleted ? userOf(removed?.by) : null,
        ...imported,
      };
      const identifier = str(e.identifier);
      if (e.klass === "song") {
        const songId = songIdIn(db, identifier);
        if (!songId) {
          note(
            skippedIn(db, identifier)
              ? "entriesToEmptySongsSkipped"
              : "entriesToMissingSongsSkipped",
            String(e._id),
          );
          continue;
        }
        Object.assign(entry, { kind: "song", song_id: songId });
      } else if (e.klass === "bible") {
        const match = /^b(\d+)_(\d+)_(\d+)_(\d+)$/.exec(identifier);
        const [book, chapter, v1, v2] = (match ?? []).slice(1).map(Number);
        if (!match || !book || book > 66 || !chapter || !v1 || !v2) {
          note("badBibleEntriesSkipped", String(e._id));
          continue;
        }
        Object.assign(entry, {
          kind: "bible",
          bible_book: book,
          bible_chapter: chapter,
          bible_verse_from: Math.min(v1, v2),
          bible_verse_to: Math.max(v1, v2),
        });
      } else if (e.klass === "divider" && identifier.trim()) {
        Object.assign(entry, { kind: "divider", text: identifier.trim() });
      } else {
        note("entriesWithoutKindSkipped", String(e._id));
        continue;
      }
      if (e.label) note("entryLabelsDropped", String(e._id));
      rows.entries.push(entry);
      if (db === RO && source === "shared")
        roEntryIds.set(String(e._id), { id: String(entry.id), playlistId: id });
    }
  };

  const uaPlaylists = new Map(
    get(UA, "playlists").map((p) => [String(p._id), p]),
  );
  for (const playlist of get(RO, "playlists")) {
    const oldId = String(playlist._id);
    addPlaylist("shared", RO, playlist, roEntries.get(oldId) ?? []);
    const uaCopy = uaPlaylists.get(oldId);
    if (!uaCopy) continue;
    uaPlaylists.delete(oldId);
    if (signature(roEntries.get(oldId)) === signature(uaEntries.get(oldId))) {
      note("playlistsInBothMerged");
    } else {
      note("playlistsInBothKeptSeparately", oldId);
      addPlaylist("ua", UA, uaCopy, uaEntries.get(oldId) ?? [], "(UA)");
    }
  }
  for (const playlist of uaPlaylists.values())
    addPlaylist(
      "shared",
      UA,
      playlist,
      uaEntries.get(String(playlist._id)) ?? [],
    );
  return roEntryIds;
}
