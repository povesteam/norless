import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyInstance } from "fastify";
import { changeKinds, type ChangeKind, kindOf } from "../shared/changes.js";
import { requireRole } from "./auth/auth.js";
import type { Db } from "./db/db.js";
import { newId } from "./ids.js";
import { playlistNameOf } from "./playlists/playlists.js";
import type { Live } from "./live/live.js";

/**
 * The tables the change log follows, and per table the columns it leaves out: secrets,
 * and columns that change on their own (a recording's growing size, the live slide).
 * `updated_at` and `updated_by` are never compared: the log has its own time and person.
 */
const logged: Record<string, string[]> = {
  communities: [],
  entries: [],
  members: [],
  pages: [],
  playlists: [],
  recording_access: [],
  recordings: ["pieces", "bytes", "last_piece_at"],
  rooms: ["live"],
  schedule_events: [],
  screen_devices: ["token"],
  screens: ["secret"],
  service_roles: [],
  slot_templates: [],
  slots: [],
  song_versions: [],
  songs: [],
};
const neverCompared = ["updated_at", "updated_by"];

/**
 * Tables that aren't logged but whose changes open views show (live-updates spec): the
 * logs and the records people add for themselves.
 */
const announced = [
  "away_dates",
  "feature_requests",
  "feedback",
  "live_log",
  "notifications",
  "plays",
  "recording_parts",
  "role_people",
  "schedule_dates",
  "screen_connections",
  "search_misses",
  "slide_files",
  "song_opinions",
  "song_revisions",
  "tempo_checks",
];

/** Called with each changed table and its community, while the change is being made. */
export type ChangeNotice = (table: string, communityId: string | null) => void;

/** Who is changing things, for the requests and jobs that run inside it. */
const actor = new AsyncLocalStorage<{ userId: string | null }>();

/** Runs `work` as the user, so the changes it makes are theirs; null for Norless itself. */
export const runAs = <T>(userId: string | null, work: () => T): T =>
  actor.run({ userId }, work);

/**
 * Starts the change log on this connection: a function per value the
 * log needs, and a temporary trigger per table and action, generated from the schema, so
 * a new column is logged without touching this file. Temporary triggers live with the
 * connection, outside the schema: the rules stay in code (database spec).
 */
export function startChangeLog(db: Db, notice: ChangeNotice = () => {}) {
  db.function("change_notice", (table, communityId) => {
    notice(String(table), communityId === null ? null : String(communityId));
    return null;
  });
  db.function("change_id", () => newId());
  db.function("change_at", () => new Date().toISOString());
  db.function("change_user", () => actor.getStore()?.userId ?? null);
  db.function("change_columns", (table, before, after) => {
    const skip = new Set([...neverCompared, ...(logged[String(table)] ?? [])]);
    const old = JSON.parse(String(before)) as Record<string, unknown>;
    const now = JSON.parse(String(after)) as Record<string, unknown>;
    const changed: Record<string, [unknown, unknown]> = {};
    for (const column of Object.keys(now))
      if (!skip.has(column) && old[column] !== now[column])
        changed[column] = [old[column], now[column]];
    return JSON.stringify(changed);
  });

  for (const table of [...Object.keys(logged), ...announced]) {
    const hidden = logged[table] ?? [];
    const isLogged = table in logged;
    const columns = (
      db.prepare(`PRAGMA table_info(${table})`).all() as {
        name: string;
        pk: number;
      }[]
    ).filter((c) => !hidden.includes(c.name));
    const keys = columns.filter((c) => c.pk > 0).map((c) => c.name);
    const row = (alias: string) =>
      `json_object(${columns.map((c) => `'${c.name}', ${alias}.${c.name}`).join(", ")})`;
    const rowId = (alias: string) =>
      keys.map((k) => `${alias}.${k}`).join(" || ':' || ");
    // The community a row belongs to: its own column, itself, or its recording's.
    const community = (alias: string) =>
      table === "communities"
        ? `${alias}.id`
        : table === "recording_access" || table === "recording_parts"
          ? `(SELECT community_id FROM main.recordings WHERE id = ${alias}.recording_id)`
          : `${alias}.community_id`;
    const insert = (alias: string, action: string, changed: string) =>
      (isLogged
        ? `INSERT INTO main.changes (id, community_id, at, user_id, table_name, row_id, action, row, changed)
       VALUES (change_id(), ${community(alias)}, change_at(), change_user(), '${table}', ${rowId(alias)},
         '${action}', ${row(alias)}, ${changed});`
        : "") +
      `\n        SELECT change_notice('${table}', ${community(alias)});`;
    const compared = columns.filter((c) => !neverCompared.includes(c.name));
    // A logged table's save that changes only its time doesn't count; others always do.
    const when = isLogged
      ? `WHEN ${compared.map((c) => `OLD.${c.name} IS NOT NEW.${c.name}`).join(" OR ")}`
      : "";
    db.exec(`
      DROP TRIGGER IF EXISTS temp.changes_${table}_insert;
      DROP TRIGGER IF EXISTS temp.changes_${table}_update;
      DROP TRIGGER IF EXISTS temp.changes_${table}_delete;
      CREATE TEMP TRIGGER changes_${table}_insert AFTER INSERT ON main.${table} BEGIN
        ${insert("NEW", "insert", "NULL")}
      END;
      CREATE TEMP TRIGGER changes_${table}_update AFTER UPDATE ON main.${table}
      ${when} BEGIN
        ${insert("NEW", "update", `change_columns('${table}', ${row("OLD")}, ${row("NEW")})`)}
      END;
      CREATE TEMP TRIGGER changes_${table}_delete AFTER DELETE ON main.${table} BEGIN
        ${insert("OLD", "delete", "NULL")}
      END;
    `);
  }
}

export type Change = {
  id: string;
  at: string;
  user: { id: string; name: string } | null;
  kind: ChangeKind;
  table: string;
  rowId: string;
  action: "insert" | "update" | "delete";
  /** What the record is, to say which one: a song's or playlist's title, a name. */
  label: string;
  row: Record<string, unknown>;
  changed: Record<string, [unknown, unknown]> | null;
};

const PAGE = 100;

/** The community's changes, newest first, `PAGE` at a time before `before`. */
export function listChanges(
  db: Db,
  communityId: string,
  {
    user,
    kind,
    before,
  }: { user?: string; kind?: ChangeKind; before?: string } = {},
): { changes: Change[]; more: boolean } {
  const tables = kind
    ? Object.keys(logged).filter((t) => kindOf(t) === kind)
    : Object.keys(logged);
  const rows = db
    .prepare(
      `SELECT c.id, c.at, c.user_id AS userId, u.display_name AS userName, c.table_name AS tableName,
         c.row_id AS rowId, c.action, c.row, c.changed
       FROM changes c LEFT JOIN users u ON u.id = c.user_id
       WHERE c.community_id = ? AND c.table_name IN (SELECT value FROM json_each(?))
         AND (? IS NULL OR c.user_id = ?) AND (? IS NULL OR c.at < ?)
       ORDER BY c.at DESC, c.rowid DESC LIMIT ?`,
    )
    .all(
      communityId,
      JSON.stringify(tables),
      user ?? null,
      user ?? null,
      before ?? null,
      before ?? null,
      PAGE + 1,
    ) as {
    id: string;
    at: string;
    userId: string | null;
    userName: string | null;
    tableName: string;
    rowId: string;
    action: Change["action"];
    row: string;
    changed: string | null;
  }[];
  const label = labeler(db);
  return {
    more: rows.length > PAGE,
    changes: rows.slice(0, PAGE).map((r) => {
      const row = JSON.parse(r.row) as Record<string, unknown>;
      return {
        id: r.id,
        at: r.at,
        user: r.userId ? { id: r.userId, name: r.userName ?? "" } : null,
        kind: kindOf(r.tableName),
        table: r.tableName,
        rowId: r.rowId,
        action: r.action,
        label: label(r.tableName, row),
        row,
        changed: r.changed
          ? (JSON.parse(r.changed) as Record<string, [unknown, unknown]>)
          : null,
      };
    }),
  };
}

/** Names a changed record the way people know it, looking up what the row doesn't say. */
function labeler(db: Db) {
  const songTitle = db
    .prepare(
      "SELECT title FROM song_versions WHERE song_id = ? ORDER BY created_at LIMIT 1",
    )
    .pluck();
  const playlist = db.prepare(
    "SELECT community_id, title, service_date, created_at FROM playlists WHERE id = ?",
  );
  const userName = db
    .prepare("SELECT display_name FROM users WHERE id = ?")
    .pluck();
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return (table: string, row: Record<string, unknown>): string => {
    switch (table) {
      case "songs":
        return text(songTitle.get(row.id));
      case "song_versions":
        return text(row.title);
      case "playlists":
        return playlistNameOf(db, row as Parameters<typeof playlistNameOf>[1]);
      case "entries": {
        const of = playlist.get(row.playlist_id) as
          Parameters<typeof playlistNameOf>[1] | undefined;
        return of ? playlistNameOf(db, of) : "";
      }
      case "members":
      case "recording_access":
        return text(userName.get(row.user_id));
      case "recordings":
        return text(userName.get(row.owner_id));
      case "schedule_events":
      case "screens":
      case "pages":
      case "rooms":
      case "communities":
        return text(row.name);
      default:
        return "";
    }
  };
}

/**
 * The change log's routes and hooks: each request runs as its user, so its changes are
 * theirs; owners read the community's changes.
 */
export function attachChanges(
  app: FastifyInstance,
  {
    db,
    live,
    findCommunity,
  }: {
    db: Db;
    live: Live;
    findCommunity: (slug: string) => { id: string } | undefined;
  },
) {
  // The tables changed in each community since the last tick, told once per tick on
  // `changes:<slug>` (live-updates spec): a rolled-back change is told too, and views
  // load what they show again, finding it unchanged.
  const pending = new Map<string, Set<string>>();
  const slugOf = db
    .prepare("SELECT slug FROM communities WHERE id = ?")
    .pluck();
  const tell = () => {
    for (const [communityId, tables] of pending) {
      const slug = slugOf.get(communityId) as string | undefined;
      if (slug) live.publish(`changes:${slug}`, { tables: [...tables] });
    }
    pending.clear();
  };
  startChangeLog(db, (table, communityId) => {
    if (!communityId) return;
    if (pending.size === 0) setImmediate(tell);
    const tables = pending.get(communityId) ?? new Set();
    tables.add(table);
    // The Changes page follows the log itself.
    if (table in logged) tables.add("changes");
    pending.set(communityId, tables);
  });
  app.addHook("preHandler", (request, _reply, done) =>
    runAs(request.user?.id ?? null, done),
  );

  app.get<{
    Params: { slug: string };
    Querystring: { user?: string; kind?: ChangeKind; before?: string };
  }>(
    "/api/communities/:slug/changes",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            user: { type: "string", maxLength: 100 },
            kind: { enum: [...changeKinds] },
            before: { type: "string", maxLength: 40 },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      if (!requireRole(db, request, reply, community.id, "owner")) return;
      return listChanges(db, community.id, request.query);
    },
  );

  // Who made changes here, for the page's filter.
  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug/changes/people",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      if (!requireRole(db, request, reply, community.id, "owner")) return;
      return db
        .prepare(
          `SELECT u.id, u.display_name AS name FROM users u
           WHERE u.id IN (SELECT DISTINCT user_id FROM changes WHERE community_id = ?)
           ORDER BY u.display_name COLLATE NOCASE`,
        )
        .all(community.id);
    },
  );
}
