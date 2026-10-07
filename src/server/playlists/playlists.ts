import type { BibleReference } from "../../shared/bible.js";
import type { Db } from "../db/db.js";
import { type SongResult, songResults } from "../songs/search.js";
import { newId } from "../ids.js";
import { slideFilesOf } from "./slide-files.js";
import type { Slides } from "../../shared/slides.js";
import { playlistName } from "../../shared/playlist-name.js";
import {
  addDays,
  eventsOn,
  localTime,
  type ScheduleEvent,
} from "../schedule/schedule.js";

export type EntryKind = "song" | "bible" | "divider" | "text" | "slides";

export type Entry = {
  id: string;
  kind: EntryKind;
  /** For song entries. A deleted song still shows, marked. */
  song:
    | (SongResult & {
        deleted: boolean;
        /** Went live in the last hour. */
        playedRecently: boolean;
      })
    | null;
  bible: BibleReference | null;
  /** A divider's heading, a text slide's Markdown, or a slides entry's title. */
  text: string | null;
  /** For dividers, text slides and slides, e.g. 45 for the sermon. */
  plannedMinutes: number | null;
  /** For slides entries: their files, and the timer's seconds. */
  slides?: Slides;
  /** For songs: the key for this service, set by the team; the song keeps its own. */
  keySignature: string | null;
  /** Who added it, by name, and their photo; only for members. */
  addedBy?: string | null;
  addedByAvatar?: string | null;
  /** What the host says around it, per language; only for members, when there are some. */
  hostWords?: Record<string, string>;
  /** For songs, members only: who the team chose to lead it, else the service's lead leads. */
  ledBy?: Person | null;
};

export type Person = { id: string; name: string };

/** The service a playlist plans: its event and its date in the community. */
export type Service = { eventId: string; date: string };

export type PlaylistSummary = {
  id: string;
  /** None for most: the date names it. */
  title: string | null;
  /** Its service's day, else the day it was made, in the community. */
  date: string;
  createdAt: string;
  /** Who created it, and their photo, for members. */
  createdBy?: string | null;
  createdByAvatar?: string | null;
  /** In the list: how many songs it has, and the day of the service it plans. */
  songs?: number;
  serviceDate?: string | null;
};
export type Playlist = PlaylistSummary & {
  entries: Entry[];
  /** When it was archived: it can be read and restored, not changed. */
  archivedAt: string | null;
  /** The service it plans, when Norless knows it. */
  service?: Service | null;
  /** When the team told the service's people it's ready. */
  readyAt?: string | null;
  /** Members only: who leads its songs from the service's slots, and who else may. */
  leads?: { lead: Person | null; people: Person[] };
};

export type EntryInput = {
  kind: EntryKind;
  songId?: string;
  bible?: BibleReference;
  text?: string;
  plannedMinutes?: number | null;
};

export type Who = { communityId: string; userId: string; now?: Date };

const zoneOf = (db: Db, communityId: string) =>
  (
    db
      .prepare("SELECT time_zone AS timeZone FROM communities WHERE id = ?")
      .get(communityId) as { timeZone: string }
  ).timeZone;

/** A playlist's date: its service's day, else the day it was made in the community. */
export const playlistDay =
  (db: Db, communityId: string) =>
  (serviceDate: string | null, createdAt: string) =>
    serviceDate ?? localTime(new Date(createdAt), zoneOf(db, communityId)).date;

/** A playlist's name in plain text, in the community's first language. */
export function playlistNameOf(
  db: Db,
  row: {
    community_id: string;
    title: string | null;
    service_date: string | null;
    created_at: string;
  },
) {
  const languages = db
    .prepare("SELECT languages FROM communities WHERE id = ?")
    .pluck()
    .get(row.community_id) as string;
  const [language = "ro"] = JSON.parse(languages) as string[];
  const date = playlistDay(db, row.community_id)(
    row.service_date,
    row.created_at,
  );
  return playlistName({ title: row.title, date }, language);
}

/** A playlist with its entries in order, archived ones too; null when it doesn't exist. */
export function getPlaylist(
  db: Db,
  communityId: string,
  id: string,
  { names = false, now = new Date() } = {},
): Playlist | null {
  const playlist = db
    .prepare(
      `SELECT id, title, created_at AS createdAt, archived_at AS archivedAt,
         ready_at AS readyAt, service_event_id AS eventId, service_date AS serviceDate
       FROM playlists WHERE id = ? AND community_id = ? AND deleted_at IS NULL`,
    )
    .get(id, communityId) as
    | (Omit<PlaylistSummary, "date"> & {
        archivedAt: string | null;
        readyAt: string | null;
        eventId: string | null;
        serviceDate: string | null;
      })
    | undefined;
  if (!playlist) return null;
  const { eventId, serviceDate, ...rest } = playlist;
  const service =
    eventId && serviceDate ? { eventId, date: serviceDate } : null;
  const summary = {
    ...rest,
    date: playlistDay(db, communityId)(serviceDate, rest.createdAt),
  };
  const since = new Date(now.getTime() - 60 * 60_000).toISOString();
  const rows = db
    .prepare(
      `SELECT e.id, e.kind, e.song_id, e.bible_book, e.bible_chapter, e.bible_verse_from,
         e.bible_verse_to, e.text, e.planned_minutes, e.key_signature, e.host_words, e.slide_seconds,
         nullif(u.display_name, '') AS added_by, u.avatar AS added_by_avatar, e.led_by,
         l.display_name AS led_by_name,
         s.deleted_at IS NOT NULL AS song_deleted,
         EXISTS (SELECT 1 FROM plays p WHERE p.song_id = e.song_id AND p.played_at > @since) AS played_recently
       FROM entries e
       LEFT JOIN users u ON u.id = e.created_by
       LEFT JOIN users l ON l.id = e.led_by
       LEFT JOIN songs s ON s.id = e.song_id
       WHERE e.playlist_id = @id AND e.deleted_at IS NULL
       ORDER BY e.position, e.created_at`,
    )
    .all({ id, since }) as {
    id: string;
    kind: EntryKind;
    song_id: string | null;
    bible_book: number | null;
    bible_chapter: number | null;
    bible_verse_from: number | null;
    bible_verse_to: number | null;
    text: string | null;
    planned_minutes: number | null;
    key_signature: string | null;
    host_words: string | null;
    slide_seconds: number | null;
    added_by: string | null;
    added_by_avatar: string | null;
    led_by: string | null;
    led_by_name: string | null;
    song_deleted: number;
    played_recently: number;
  }[];
  const files = slideFilesOf(
    db,
    rows.filter((r) => r.kind === "slides").map((r) => r.id),
  );
  const entries = rows.map((row): Entry => {
    const [song] = row.song_id ? songResults(db, [row.song_id]) : [];
    return {
      id: row.id,
      kind: row.kind,
      song: song
        ? {
            ...song,
            deleted: row.song_deleted === 1,
            playedRecently: row.played_recently === 1,
          }
        : null,
      bible:
        row.kind === "bible"
          ? {
              book: row.bible_book ?? 0,
              chapter: row.bible_chapter ?? 0,
              from: row.bible_verse_from ?? 0,
              to: row.bible_verse_to ?? 0,
            }
          : null,
      text: row.text,
      plannedMinutes: row.planned_minutes,
      keySignature: row.key_signature,
      ...(row.kind === "slides"
        ? {
            slides: {
              files: files.get(row.id) ?? [],
              seconds: row.slide_seconds,
            },
          }
        : {}),
      ...(names
        ? { addedBy: row.added_by, addedByAvatar: row.added_by_avatar }
        : {}),
      ...(names && row.host_words
        ? { hostWords: JSON.parse(row.host_words) as Record<string, string> }
        : {}),
      ...(names && row.kind === "song"
        ? {
            ledBy: row.led_by
              ? { id: row.led_by, name: row.led_by_name ?? "" }
              : null,
          }
        : {}),
    };
  });
  return {
    ...summary,
    entries,
    service,
    ...(names ? { leads: leadsOf(db, communityId, service) } : {}),
  };
}

/**
 * Who leads the songs of a service: the first person in a slot of a role
 * that leads the songs; and who else may lead one, its vocalists, from its slots.
 */
export function leadsOf(
  db: Db,
  communityId: string,
  service: Service | null,
): { lead: Person | null; people: Person[] } {
  if (!service) return { lead: null, people: [] };
  const rows = db
    .prepare(
      `SELECT s.user_id AS id, u.display_name AS name, r.leads
       FROM slots s
       JOIN service_roles r ON r.id = s.role_id AND r.deleted_at IS NULL
       JOIN users u ON u.id = s.user_id
       WHERE s.community_id = ? AND s.event_id = ? AND s.date = ? AND s.deleted_at IS NULL
         AND s.status IN ('asked', 'accepted') AND (r.leads = 1 OR r.instrument = 'vocals')
       ORDER BY r.leads DESC, r.position, s.position`,
    )
    .all(communityId, service.eventId, service.date) as (Person & {
    leads: number;
  })[];
  const lead = rows.find((r) => r.leads === 1);
  const people = [
    ...new Map(rows.map((r) => [r.id, { id: r.id, name: r.name }])).values(),
  ];
  return { lead: lead ? { id: lead.id, name: lead.name } : null, people };
}

/** Who leads an entry: the one the team chose, else its service's lead; for plays. */
export function leaderOf(
  db: Db,
  communityId: string,
  entryId: string,
): string | null {
  const row = db
    .prepare(
      `SELECT e.led_by AS ledBy, p.service_event_id AS eventId, p.service_date AS date
       FROM entries e JOIN playlists p ON p.id = e.playlist_id
       WHERE e.id = ? AND e.community_id = ?`,
    )
    .get(entryId, communityId) as
    | { ledBy: string | null; eventId: string | null; date: string | null }
    | undefined;
  if (!row) return null;
  if (row.ledBy) return row.ledBy;
  const service =
    row.eventId && row.date ? { eventId: row.eventId, date: row.date } : null;
  return leadsOf(db, communityId, service).lead?.id ?? null;
}

/** The community's time zone and schedule, to work out its services. */
function scheduleOf(db: Db, communityId: string) {
  const { timeZone } = db
    .prepare("SELECT time_zone AS timeZone FROM communities WHERE id = ?")
    .get(communityId) as { timeZone: string };
  const events = db
    .prepare(
      "SELECT * FROM schedule_events WHERE community_id = ? AND deleted_at IS NULL",
    )
    .all(communityId) as ScheduleEvent[];
  return { timeZone, events };
}

/** The services that haven't ended by `now`, the one under way first, within 60 days. */
function* servicesFrom(db: Db, communityId: string, now: Date) {
  const { timeZone, events } = scheduleOf(db, communityId);
  const today = localTime(now, timeZone).date;
  for (let day = 0; day < 60; day++) {
    const date = addDays(today, day);
    for (const event of eventsOn(date, events, timeZone))
      if (event.type === "service" && event.end.getTime() > now.getTime())
        yield { eventId: event.id, date } satisfies Service;
  }
}

/**
 * The service a playlist made now plans: the next one from `now` that no
 * playlist plans yet, so the playlist for Sunday made on Tuesday is Sunday's.
 */
export function freeService(
  db: Db,
  communityId: string,
  now = new Date(),
): Service | null {
  const taken = db.prepare(
    "SELECT 1 FROM playlists WHERE community_id = ? AND service_event_id = ? AND service_date = ? AND deleted_at IS NULL",
  );
  for (const service of servicesFrom(db, communityId, now))
    if (!taken.get(communityId, service.eventId, service.date)) return service;
  return null;
}

/**
 * The playlist of the service under way or next, if it has one (service-schedule
 * spec): the home and a new practice room open it, and the list marks it.
 */
export function nextServicePlaylist(
  db: Db,
  communityId: string,
  now = new Date(),
): string | null {
  const next = servicesFrom(db, communityId, now).next().value;
  return next ? playlistOf(db, communityId, next) : null;
}

/**
 * The playlist of the service under way or, between services, of the last one held,
 * within 60 days: visitors open the app on it (playlists spec), while the team
 * prepares the next one.
 */
export function heldServicePlaylist(
  db: Db,
  communityId: string,
  now = new Date(),
): string | null {
  const { timeZone, events } = scheduleOf(db, communityId);
  const today = localTime(now, timeZone).date;
  for (let day = 0; day > -60; day--) {
    const date = addDays(today, day);
    const started = eventsOn(date, events, timeZone).filter(
      (event) =>
        event.type === "service" && event.start.getTime() <= now.getTime(),
    );
    for (const event of started.reverse()) {
      const id = playlistOf(db, communityId, { eventId: event.id, date });
      if (id) return id;
    }
  }
  return null;
}

/** The playlist planning a service, the newest if several do. */
function playlistOf(db: Db, communityId: string, service: Service) {
  const id = db
    .prepare(
      `SELECT id FROM playlists WHERE community_id = ? AND service_event_id = ?
         AND service_date = ? AND deleted_at IS NULL AND archived_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
    )
    .pluck()
    .get(communityId, service.eventId, service.date) as string | undefined;
  return id ?? null;
}

/**
 * Playlists newest first, `limit` of them from `offset`, and whether more follow; with
 * `query`, those whose title or date has it, any case, the date in any of Norless's
 * languages ("octombrie", "october"); with `names`, for members, who created each one;
 * with `archived`, the archived ones instead.
 */
export function listPlaylists(
  db: Db,
  communityId: string,
  offset: number,
  limit: number,
  { names = false, query = "", archived = false } = {},
) {
  const rows = db
    .prepare(
      `SELECT p.id, p.title, p.created_at AS createdAt,
         nullif(u.display_name, '') AS createdBy, u.avatar AS createdByAvatar,
         p.service_date AS serviceDate,
         (SELECT count(*) FROM entries e WHERE e.playlist_id = p.id
            AND e.kind = 'song' AND e.deleted_at IS NULL) AS songs
       FROM playlists p LEFT JOIN users u ON u.id = p.created_by
       WHERE p.community_id = ? AND p.deleted_at IS NULL
         AND p.archived_at IS ${archived ? "NOT NULL" : "NULL"}
       ORDER BY p.created_at DESC, p.id DESC
       ${query ? "" : "LIMIT ? OFFSET ?"}`,
    )
    .all(communityId, ...(query ? [] : [limit + 1, offset])) as (Omit<
    PlaylistSummary,
    "date"
  > & { createdBy: string | null; createdByAvatar: string | null })[];
  const day = playlistDay(db, communityId);
  const dated = rows.map(({ createdBy, createdByAvatar, ...row }) => ({
    ...row,
    date: day(row.serviceDate ?? null, row.createdAt),
    ...(names && { createdBy, createdByAvatar }),
  }));
  // ponytail: a scan of every playlist while searching; a few thousand at most.
  const words = query.toLocaleLowerCase();
  const found = query
    ? dated
        .filter((p) =>
          ["ro", "uk", "en"]
            .map((language) =>
              // With the year: any `now` in another year.
              playlistName(p, language, new Date(0)).toLocaleLowerCase(),
            )
            .some((name) => name.includes(words)),
        )
        .slice(offset)
    : dated;
  return { playlists: found.slice(0, limit), more: found.length > limit };
}

/** A playlist; `userId` null when Norless makes it, e.g. for the next service. */
export function createPlaylist(
  db: Db,
  title: string | null,
  {
    communityId,
    userId,
    now = new Date(),
  }: Omit<Who, "userId"> & { userId: string | null },
  service: Service | null = freeService(db, communityId, now),
): Playlist {
  const id = newId();
  const at = now.toISOString();
  db.prepare(
    `INSERT INTO playlists (id, community_id, title, created_at, updated_at, created_by, updated_by, service_event_id, service_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    communityId,
    title,
    at,
    at,
    userId,
    userId,
    service?.eventId ?? null,
    service?.date ?? null,
  );
  return {
    id,
    title,
    date: playlistDay(db, communityId)(service?.date ?? null, at),
    createdAt: at,
    entries: [],
    archivedAt: null,
    service,
  };
}

/**
 * Renames a playlist that isn't archived, or archives or restores one; false when it
 * doesn't exist, or is archived and would be renamed.
 */
export function changePlaylist(
  db: Db,
  id: string,
  change: { title: string | null } | { archived: boolean },
  { communityId, userId, now = new Date() }: Who,
): boolean {
  const at = now.toISOString();
  const { changes } =
    "title" in change
      ? db
          .prepare(
            `UPDATE playlists SET title = ?, updated_at = ?, updated_by = ?
             WHERE id = ? AND community_id = ? AND deleted_at IS NULL AND archived_at IS NULL`,
          )
          .run(change.title, at, userId, id, communityId)
      : db
          .prepare(
            `UPDATE playlists SET archived_at = ?, updated_at = ?, updated_by = ?
             WHERE id = ? AND community_id = ? AND deleted_at IS NULL`,
          )
          .run(change.archived ? at : null, at, userId, id, communityId);
  return changes > 0;
}
