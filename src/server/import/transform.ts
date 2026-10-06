import { UNU_UNU_THEME } from "../../shared/theme.js";
import type { Document } from "bson";
import { classify, type ScheduleEvent } from "../schedule/schedule.js";
import type { Collections } from "./archive.js";
import { playEnds, scanOplog, slideChanges, songRevisions } from "./oplog.js";
import {
  RO,
  UA,
  iso,
  legacyId,
  str,
  type Mapping,
  type Report,
  type Rows,
} from "./mapping.js";
import { mapPeople } from "./map-people.js";
import { mapSongs } from "./map-songs.js";
import { mapPlaylists } from "./map-playlists.js";

const TIME_ZONE = "Europe/Bucharest";

export function transform(
  collections: Collections,
  {
    now,
    oplog,
  }: {
    now: Date;
    /** The old app's oplog, for history the backup doesn't keep. */
    oplog?: Document[];
  },
): { rows: Rows; report: Report } {
  const scanned = oplog ? scanOplog(oplog) : null;
  const times = scanned?.times;
  const at = now.toISOString();
  const report: Report = { counts: {}, notes: {}, samples: {} };
  const note = (key: string, sample?: string) => {
    report.notes[key] = (report.notes[key] ?? 0) + 1;
    const samples = (report.samples[key] ??= []);
    if (sample && samples.length < 10) samples.push(sample);
  };
  const get = (db: string, collection: string): Document[] =>
    collections.get(`${db}.${collection}`) ?? [];
  const imported = { imported_at: at, updated_at: at };
  const rows: Rows = {
    users: [],
    communities: [],
    members: [],
    rooms: [],
    pages: [],
    schedule_events: [],
    songs: [],
    song_versions: [],
    playlists: [],
    entries: [],
    plays: [],
    song_revisions: [],
    slide_log: [],
  };

  // Community, default room, start and end pages, known service history.

  const congregations = [
    ...get(RO, "congregations"),
    ...get(UA, "congregations"),
  ];
  const congregation = congregations[0];
  if (!congregation) throw new Error("The archive has no congregations record");
  const communityId = legacyId(
    "shared",
    "congregations",
    String(congregation._id),
  );
  const name = str(congregation.title) || "Unu-Unu";
  rows.communities.push({
    id: communityId,
    slug: name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    name,
    // English is the third language, for the songs sung in English.
    languages: JSON.stringify(["ro", "uk", "en"]),
    time_zone: TIME_ZONE,
    // The look of Unu-Unu's site, and the church as it names itself there.
    theme: JSON.stringify(UNU_UNU_THEME),
    privacy: JSON.stringify({
      name: "Biserica UnuUnu",
      address: "Str. Iugoslaviei nr. 64, Cluj-Napoca, România",
    }),
    legacy_id: String(congregation._id),
    created_at: at,
    deleted_at: null,
    created_by: null,
    updated_by: null,
    ...imported,
  });
  const community = {
    community_id: communityId,
    created_at: at,
    deleted_at: null,
    created_by: null,
    updated_by: null,
  };

  const roomId = legacyId("shared", "rooms", "main");
  rows.rooms.push({
    id: roomId,
    name: "Sala principală",
    ...community,
    ...imported,
  });

  const pages = [
    ["start", "Start", "https://info.unu-unu.ro/slides-open-close/start"],
    ["end", "Final", "https://info.unu-unu.ro/slides-open-close/end"],
  ] as const;
  pages.forEach(([key, pageName, url], index) =>
    rows.pages.push({
      id: legacyId("shared", "pages", key),
      name: pageName,
      url,
      position: index + 1,
      ...community,
      ...imported,
    }),
  );

  const history: ScheduleEvent[] = [
    {
      id: legacyId("shared", "schedule_events", "sunday-morning"),
      type: "service",
      kind: "recurring",
      weekday: 7,
      start_time: "10:00",
      end_time: "12:00",
      first_date: "2014-02-15",
      last_date: null,
      date: null,
      cancels_event_id: null,
    },
    {
      id: legacyId("shared", "schedule_events", "sunday-evening"),
      type: "service",
      kind: "recurring",
      weekday: 7,
      start_time: "17:30",
      end_time: "19:00",
      first_date: "2014-02-15",
      last_date: "2020-03-15",
      date: null,
      cancels_event_id: null,
    },
  ];
  const eventNames = ["Serviciu duminică dimineața", "Serviciu duminică seara"];
  history.forEach((event, index) =>
    rows.schedule_events.push({
      ...event,
      name: eventNames[index] ?? "Serviciu",
      ...community,
      ...imported,
    }),
  );

  const mapping: Mapping = { get, note, rows, at, times, imported, community };
  const userOf = mapPeople(mapping, congregations);
  const { songIdIn, skippedIn, versionSources } = mapSongs(mapping, userOf);
  const roEntryIds = mapPlaylists(mapping, { userOf, songIdIn, skippedIn });

  // Plays from opens, deduplicated across databases, classified with the history.

  const seen = new Set<string>();
  const opens = [RO, UA].flatMap((db) =>
    get(db, "opens").map((open) => ({ db, open })),
  );
  for (const { db, open } of opens) {
    const key = `${open.song_id}:${open.time}`;
    if (seen.has(key)) {
      note("opensInBothMerged");
      continue;
    }
    seen.add(key);
    const songId = songIdIn(db, str(open.song_id));
    const playedAt = iso(open.time);
    if (!songId || !playedAt) {
      note("opensWithoutSongSkipped", String(open._id));
      continue;
    }
    rows.plays.push({
      id: legacyId("shared", "plays", key),
      community_id: communityId,
      song_id: songId,
      room_id: roomId,
      playlist_id: null,
      mode: classify(new Date(playedAt), history, TIME_ZONE),
      played_at: playedAt,
      ended_at: null,
      imported: 1,
      legacy_id: String(open._id),
      created_at: playedAt,
      created_by: null,
      ...imported,
    });
  }

  // History from the oplog: songs' earlier states, every slide, and plays' ends.
  if (scanned) {
    rows.song_revisions = songRevisions(scanned.ops, versionSources, {
      communityId,
      idOf: legacyId,
    });
    rows.slide_log = slideChanges(scanned.ops, {
      communityId,
      roomId,
      entryOf: (oldId) => roEntryIds.get(oldId),
      songOf: (oldId) => songIdIn(RO, oldId),
      userOf,
      history,
      timeZone: TIME_ZONE,
      importedAt: at,
      idOf: legacyId,
    });
    report.counts.playsWithEnd = playEnds(rows.plays, rows.slide_log);
  }

  for (const [table, list] of Object.entries(rows))
    report.counts[table] = list.length;
  report.counts.servicePlays = rows.plays.filter(
    (p) => p.mode === "service",
  ).length;
  return { rows, report };
}
