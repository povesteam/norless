import type { Document } from "bson";
import { keyInLetters } from "../../shared/music/chords.js";
import { textInLetters } from "../../shared/music/chord-sheet.js";
import { normalizeTag } from "../../shared/tags.js";
import { classify, type ScheduleEvent } from "../schedule/schedule.js";
import type { Row } from "./mapping.js";

/*
 * The old app's oplog: Mongo's record of every write since July 2016,
 * copied before cutover. It adds what the backup doesn't keep: each song's earlier
 * texts and keys, every slide shown, and exact times of playlists, entries and songs.
 */

type Op = {
  /** Seconds since 1970, and the order within that second. */
  t: number;
  i: number;
  op: string;
  ns: string;
  o: Document;
  o2?: Document;
};

/** Seconds after the oplog's start that count as the 2016 restore, not as new records. */
const RESTORE_SECONDS = 3600;

const timeOf = (op: Op) => new Date(op.t * 1000).toISOString();
const isoOf = (seconds: number) => new Date(seconds * 1000).toISOString();

/** The oplog's documents in order, with their times. */
function opsOf(docs: Document[]): Op[] {
  return docs
    .map((d) => {
      const ts = d.ts as { t: number; i: number };
      return {
        t: ts.t,
        i: ts.i,
        op: String(d.op),
        ns: String(d.ns),
        o: d.o as Document,
        o2: d.o2 as Document | undefined,
      };
    })
    .sort((a, b) => a.t - b.t || a.i - b.i);
}

/** A record's fields after an update: `$set` and `$unset`, or a whole new document. */
function applied(before: Document, update: Document): Document {
  const set = update.$set as Document | undefined;
  const unset = update.$unset as Document | undefined;
  if (!set && !unset) return { ...update };
  const gone = new Set(Object.keys(unset ?? {}));
  return Object.fromEntries(
    Object.entries({ ...before, ...set }).filter(([key]) => !gone.has(key)),
  );
}

/** What the oplog says about when records were made and removed. */
export type OplogTimes = {
  /** When a record was inserted, unless it came with the 2016 restore. */
  insertedAt(db: string, collection: string, id: string): string | null;
  /** When an entry was marked deleted, and by whom (an old user id). */
  deletedAt(db: string, id: string): { at: string; by: string | null } | null;
};

export function scanOplog(docs: Document[]): {
  ops: Op[];
  times: OplogTimes;
} {
  const ops = opsOf(docs);
  const start = ops[0]?.t ?? 0;
  const inserted = new Map<string, number>();
  const deleted = new Map<string, { at: string; by: string | null }>();
  for (const op of ops) {
    if (op.op === "i" && op.t >= start + RESTORE_SECONDS)
      inserted.set(`${op.ns}:${String(op.o._id)}`, op.t);
    if (op.op === "u" && op.ns.endsWith(".entries")) {
      const mark = (op.o.$set as Document | undefined)?.deleted as
        Document | undefined;
      if (mark)
        deleted.set(`${op.ns}:${String(op.o2?._id)}`, {
          at: timeOf(op),
          by: typeof mark.username === "string" ? mark.username : null,
        });
    }
  }
  return {
    ops,
    times: {
      insertedAt: (db, collection, id) => {
        const t = inserted.get(`${db}.${collection}:${id}`);
        return t === undefined ? null : isoOf(t);
      },
      deletedAt: (db, id) => deleted.get(`${db}.entries:${id}`) ?? null,
    },
  };
}

/** Where each imported song's versions came from: which database's record, as which language. */
export type VersionSource = { db: string; oldId: string; language: string };

const SONG_FIELDS = [
  "title",
  "text",
  "key_signature",
  "time_signature",
  "tags",
];

/**
 * A song's earlier states, as song History keeps them: before each save of any of its
 * old records, the whole song as it was, with its versions in the languages they were
 * imported as. Keys and chords in letters, as the songs themselves.
 */
export function songRevisions(
  ops: Op[],
  sources: Map<string, VersionSource[]>,
  {
    communityId,
    idOf,
  }: { communityId: string; idOf: (...parts: string[]) => string },
): Row[] {
  const songOf = new Map<string, string>(); // "db:oldId" → new song id
  for (const [songId, list] of sources)
    for (const s of list) songOf.set(`${s.db}:${s.oldId}`, songId);
  const states = new Map<string, Document>(); // "db:oldId" → the record now
  const rows: Row[] = [];
  const snapshot = (songId: string) => {
    const list = sources.get(songId) ?? [];
    const of = (s: VersionSource) => states.get(`${s.db}:${s.oldId}`);
    const docs = list.map(of).filter((d): d is Document => !!d);
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const versions = list
      .map((s) => ({ s, doc: of(s) }))
      .filter(({ doc }) => doc && str(doc.text))
      .map(({ s, doc }) => ({
        language: s.language,
        title: str(doc?.title),
        // The old format, which convertSongs takes apart after the import.
        lyrics: textInLetters(String(doc?.text ?? "")),
      }));
    const field = (name: string) =>
      docs.map((d) => str(d[name])).find(Boolean) ?? "";
    const tags = new Set(
      docs
        .flatMap((d) => (Array.isArray(d.tags) ? (d.tags as unknown[]) : []))
        .map((t) => normalizeTag(String(t)))
        .filter(Boolean),
    );
    return {
      versions,
      key_signature: keyInLetters(field("key_signature")),
      time_signature: field("time_signature"),
      tags: JSON.stringify([...tags].sort()),
    };
  };
  for (const op of ops) {
    if (!op.ns.endsWith(".songs")) continue;
    const db = op.ns.slice(0, -".songs".length);
    const oldId = String((op.op === "u" ? op.o2?._id : op.o._id) ?? "");
    const key = `${db}:${oldId}`;
    const songId = songOf.get(key);
    if (!songId) continue;
    if (op.op === "i") {
      states.set(key, { ...op.o });
      continue;
    }
    if (op.op !== "u") continue;
    const before = states.get(key);
    const after = applied(before ?? {}, op.o);
    const changed = SONG_FIELDS.some(
      (f) => JSON.stringify(before?.[f]) !== JSON.stringify(after[f]),
    );
    if (before && changed) {
      const state = snapshot(songId);
      if (state.versions.length)
        rows.push({
          id: idOf(
            "oplog",
            "song_revisions",
            db,
            oldId,
            String(op.t),
            String(op.i),
          ),
          community_id: communityId,
          song_id: songId,
          key_signature: state.key_signature,
          time_signature: state.time_signature,
          tags: state.tags,
          versions: JSON.stringify(state.versions),
          created_at: timeOf(op),
          created_by: null,
        });
    }
    states.set(key, after);
  }
  return rows;
}

/**
 * Every slide the old app's Romanian screens showed: its live object's changes, as slide
 * log rows. The Ukrainian app's own live object is left out, so a service isn't counted
 * twice.
 */
export function slideChanges(
  ops: Op[],
  {
    communityId,
    roomId,
    entryOf,
    songOf,
    userOf,
    history,
    timeZone,
    importedAt,
    idOf,
  }: {
    communityId: string;
    roomId: string;
    entryOf: (oldId: string) => { id: string; playlistId: string } | undefined;
    songOf: (oldId: string) => string | undefined;
    userOf: (oldId: unknown) => string | null;
    history: ScheduleEvent[];
    timeZone: string;
    importedAt: string;
    idOf: (...parts: string[]) => string;
  },
): Row[] {
  let state: Document = {};
  const rows: Row[] = [];
  for (const op of ops) {
    if (op.ns !== "norless.live_object" || op.op === "d") continue;
    const next = op.op === "i" ? { ...op.o } : applied(state, op.o);
    const moved =
      next.entry_id !== state.entry_id ||
      next.identifier !== state.identifier ||
      next.slide_index !== state.slide_index;
    state = next;
    if (!moved) continue;
    const cleared = !next.entry_id;
    const entry = cleared ? undefined : entryOf(String(next.entry_id));
    const song =
      !cleared && next.klass === "song"
        ? songOf(String(next.identifier))
        : undefined;
    const at = timeOf(op);
    rows.push({
      id: idOf("oplog", "slide_log", String(op.t), String(op.i)),
      community_id: communityId,
      room_id: roomId,
      playlist_id: entry?.playlistId ?? null,
      entry_id: entry?.id ?? null,
      song_id: song ?? null,
      slide: cleared ? 0 : Number(next.slide_index ?? 0) || 0,
      blank: cleared ? 1 : 0,
      mode: classify(new Date(at), history, timeZone),
      at,
      created_by: userOf(next.username),
      imported_at: importedAt,
    });
  }
  return rows;
}

/** A play this long or longer was left on the screens, not sung. */
const LONGEST_SECONDS = 45 * 60;

/**
 * Imported plays' end, from the slides: a play ends when the screens moved on to
 * another song or were cleared. Plays without slides around their start keep no end.
 */
export function playEnds(plays: Row[], slides: Row[]) {
  // Each stretch of one song on the screens: its start and end.
  const stretches = new Map<string, { start: number; end: number }[]>();
  let current: { song: string; start: number } | null = null;
  const close = (end: number) => {
    if (!current) return;
    const list = stretches.get(current.song) ?? [];
    list.push({ start: current.start, end });
    stretches.set(current.song, list);
    current = null;
  };
  for (const slide of slides) {
    const at = Date.parse(String(slide.at));
    const song = slide.song_id ? String(slide.song_id) : null;
    if (current && current.song === song) continue;
    close(at);
    if (song) current = { song, start: at };
  }
  let ended = 0;
  for (const play of plays) {
    const start = Date.parse(String(play.played_at));
    const near = (stretches.get(String(play.song_id)) ?? []).find(
      (s) => Math.abs(s.start - start) <= 3 * 60_000,
    );
    if (
      near &&
      (near.end - start) / 1000 <= LONGEST_SECONDS &&
      near.end > start
    ) {
      play.ended_at = new Date(near.end).toISOString();
      ended++;
    }
  }
  return ended;
}
