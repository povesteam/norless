import type { Document } from "bson";
import { normalizeTag } from "../../shared/tags.js";
import { UA_SONG_MATCHES } from "./song-matches.js";
import { ENGLISH_SONGS } from "./english-songs.js";
import { keyInLetters } from "../../shared/music/chords.js";
import { textInLetters } from "../../shared/music/chord-sheet.js";
import type { VersionSource } from "./oplog.js";
import { RO, UA, iso, legacyId, str, type Mapping } from "./mapping.js";

export const hasCyrillic = (text: string) => /\p{Script=Cyrillic}/u.test(text);

/** "RO title / UA title" → both parts, split at the first " / ". */
export function splitCombinedTitle(
  title: string,
): { ro: string; uk: string } | undefined {
  const at = title.indexOf(" / ");
  if (at < 0) return undefined;
  return { ro: title.slice(0, at).trim(), uk: title.slice(at + 3).trim() };
}

/** First lyric line: skips blank lines, chord lines and section names. */
export function firstLyricLine(text: string): string {
  return (
    text
      .split("\n")
      .map((line) => line.trim())
      .find(
        (line) =>
          line &&
          !line.startsWith(".") &&
          !/^([A-Za-z]?\d*|\+):$/.test(line) &&
          !/^\[.+\]$/.test(line),
      ) ?? ""
  );
}

/**
 * Songs: one per old id, with a version per language. A UA song joins the RO
 * song with its id, or the one UA_SONG_MATCHES names.
 */
export function mapSongs(
  { get, note, rows, at, times, imported, community }: Mapping,
  userOf: (oldId: unknown) => string | null,
) {
  const roSongs = new Map(get(RO, "songs").map((s) => [String(s._id), s]));
  const uaSongs = new Map(get(UA, "songs").map((s) => [String(s._id), s]));
  const isEmpty = (song: Document | undefined) =>
    !song || (!str(song.title).trim() && !str(song.text).trim());
  const songIds = new Map<string, string>(); // old id → new id, imported songs only
  const skippedSongs = new Set<string>();
  const roIdOf = (uaId: string) => UA_SONG_MATCHES[uaId] ?? uaId;
  const uaIdsOf = new Map<string, string[]>(); // song old id → its UA songs, its own id first
  for (const uaId of uaSongs.keys())
    if (!(uaId in UA_SONG_MATCHES)) uaIdsOf.set(uaId, [uaId]);
  for (const [uaId, roId] of Object.entries(UA_SONG_MATCHES)) {
    if (!uaSongs.has(uaId)) continue;
    if (!roSongs.has(roId)) note("matchedRoSongsMissing", roId);
    uaIdsOf.set(roId, [...(uaIdsOf.get(roId) ?? []), uaId]);
  }
  // RO entries and opens point to some matched UA songs through an empty RO copy.
  const songIdIn = (db: string, oldId: string) =>
    (db === RO ? songIds.get(oldId) : undefined) ?? songIds.get(roIdOf(oldId));
  const skippedIn = (db: string, oldId: string) =>
    skippedSongs.has(db === UA ? roIdOf(oldId) : oldId);

  // Which old record each version came from, for the songs' history.
  const versionSources = new Map<string, VersionSource[]>();
  const version = (
    songId: string,
    oldId: string,
    language: string,
    title: string,
    text: string,
    song: Document,
    db: string,
  ) => {
    versionSources.set(songId, [
      ...(versionSources.get(songId) ?? []),
      { db, oldId: String(song._id), language },
    ]);
    rows.song_versions.push({
      id: legacyId("shared", "song_versions", oldId, language),
      song_id: songId,
      language,
      title,
      // Chords in letters, as the app stores them, in the old
      // format: convertSongs takes it apart into words and the track after the import
      //.
      lyrics: textInLetters(text),
      ...community,
      created_at: iso(song.time) ?? at,
      created_by: userOf(song.creator),
      ...imported,
    });
  };
  const titleOf = (song: Document) => {
    const title = str(song.title).trim();
    if (title) return title;
    note("untitledSongs", String(song._id));
    return firstLyricLine(str(song.text));
  };

  for (const oldId of new Set([...roSongs.keys(), ...uaIdsOf.keys()])) {
    const ro = isEmpty(roSongs.get(oldId)) ? undefined : roSongs.get(oldId);
    const uas = (uaIdsOf.get(oldId) ?? [])
      .map((id) => uaSongs.get(id))
      .filter((s): s is Document => !isEmpty(s));
    // A translation wins over an untranslated copy; the others are dropped.
    const ua = uas.find((s) => hasCyrillic(str(s.text))) ?? uas[0];
    for (const other of uas)
      if (other !== ua) note("uaDuplicatesMerged", String(other._id));
    const main = ro ?? ua;
    if (!main) {
      note("emptySongsSkipped", oldId);
      skippedSongs.add(oldId);
      continue;
    }
    const id = legacyId("shared", "songs", oldId);
    songIds.set(oldId, id);
    const tags = new Set(
      [ro, ua]
        .flatMap((s) => (Array.isArray(s?.tags) ? (s.tags as unknown[]) : []))
        .map((t) => normalizeTag(String(t)))
        .filter(Boolean),
    );
    rows.songs.push({
      id,
      key_signature: keyInLetters(
        str(ro?.key_signature).trim() || str(ua?.key_signature).trim(),
      ),
      time_signature:
        str(ro?.time_signature).trim() || str(ua?.time_signature).trim(),
      tags: JSON.stringify([...tags].sort()),
      legacy_id: oldId,
      ...community,
      created_at:
        times?.insertedAt(ro ? RO : UA, "songs", String(main._id)) ??
        iso(main.time) ??
        at,
      created_by: userOf(main.creator),
      // Taken from the texts by convertSongs after the import.
      music: null,
      ...imported,
    });

    const roText = str(ro?.text);
    const uaText = str(ua?.text);
    if (ro && ua && hasCyrillic(roText) && !hasCyrillic(uaText)) {
      // Ukrainian carols: the RO app holds the Ukrainian text, the UA app its Romanian translation.
      note("swappedLanguages", oldId);
      version(id, oldId, "ro", titleOf(ua), uaText, ua, UA);
      version(id, oldId, "uk", titleOf(ro), roText, ro, RO);
      continue;
    }
    // An English song in the Romanian app becomes the English version.
    if (ro)
      version(
        id,
        oldId,
        ENGLISH_SONGS.has(oldId) ? "en" : "ro",
        titleOf(ro),
        roText,
        ro,
        RO,
      );
    if (!ua) continue;
    const combined = splitCombinedTitle(str(ua.title));
    if (ro && uaText === roText) {
      note("untranslatedUaCopies");
    } else if (ro && !hasCyrillic(uaText)) {
      note("differentUaTextWithoutCyrillic", oldId);
    } else if (!hasCyrillic(uaText)) {
      note("uaOnlySongsWithoutCyrillic", oldId);
      version(id, oldId, "ro", titleOf(ua), uaText, ua, UA);
    } else {
      if (ro && combined && combined.ro !== str(ro.title).trim())
        note("combinedTitleDiffersFromRo", oldId);
      version(id, oldId, "uk", combined?.uk || titleOf(ua), uaText, ua, UA);
    }
  }
  return { songIdIn, skippedIn, versionSources };
}
