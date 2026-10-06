import type { FastifyInstance } from "fastify";
import { latestReplay } from "./replays.js";
import type { Db } from "../db/db.js";
import { isMember } from "../auth/members.js";
import {
  type Community,
  lastServiceDays,
  MOST_SERVICES,
  restedSongs,
  type SongResult,
  songResults,
} from "./search.js";

export const seasons = {
  winter: ["01", "02", "12"],
  spring: ["03", "04", "05"],
  summer: ["06", "07", "08"],
  autumn: ["09", "10", "11"],
} as const;
export type Season = keyof typeof seasons;
/** The last 12 months, all time, or a year such as "2025". */
export type Period = "last12" | "all" | `${number}`;

/** A song with how many services it was sung in, and its latest one in a stream. */
export type CountedSong = SongResult & {
  services: number;
  /** Where its latest service play is in the service's stream. */
  replay?: string | null;
};

const DAY = 86_400_000;

// Service plays only (plays spec); months and years by the calendar in UTC, which is the
// same day as a morning service in Europe.
const services = `FROM plays p JOIN songs s ON s.id = p.song_id
  WHERE p.community_id = @community AND p.mode = 'service' AND s.deleted_at IS NULL`;

/** Years with service plays, newest first, and the current one. */
function years(db: Db, communityId: string, now: Date) {
  const found = db
    .prepare(
      `SELECT DISTINCT CAST(substr(p.played_at, 1, 4) AS INTEGER) ${services}`,
    )
    .pluck()
    .all({ community: communityId }) as number[];
  return [...new Set([now.getUTCFullYear(), ...found])].sort((a, b) => b - a);
}

const counted = (
  db: Db,
  rows: { id: string; services: number }[],
): CountedSong[] => {
  const results = songResults(
    db,
    rows.map((r) => r.id),
  );
  return results.map((song, i) => ({
    ...song,
    services: rows[i]?.services ?? 0,
  }));
};

/** The 25 songs sung in the most services in a period, most first. */
export function mostSung(
  db: Db,
  communityId: string,
  period: Period,
  season: Season | null,
  now = new Date(),
) {
  const filters: string[] = [];
  const params: Record<string, string> = { community: communityId };
  if (period === "last12") {
    filters.push("p.played_at >= @since");
    params.since = new Date(now.getTime() - 365 * DAY).toISOString();
  } else if (period !== "all") {
    filters.push("substr(p.played_at, 1, 4) = @year");
    params.year = period;
    if (season)
      filters.push(
        `substr(p.played_at, 6, 2) IN (${seasons[season].map((m) => `'${m}'`).join(", ")})`,
      );
  }
  const rows = db
    .prepare(
      `SELECT p.song_id AS id, count(*) AS services, max(p.played_at) AS last ${services}
       ${filters.map((f) => `AND ${f}`).join(" ")}
       GROUP BY p.song_id ORDER BY services DESC, last DESC LIMIT 25`,
    )
    .all(params) as { id: string; services: number }[];
  return counted(db, rows);
}

/** Songs sung in most of the last services, most first; not excluded ones. */
export function sungLately(db: Db, communityId: string) {
  const days = lastServiceDays(db, communityId);
  const since = days.at(-1);
  if (!since) return [];
  const ids = db
    .prepare(
      `SELECT p.song_id FROM plays p JOIN songs s ON s.id = p.song_id
       WHERE p.community_id = ? AND p.mode = 'service' AND p.played_at >= ?
         AND s.deleted_at IS NULL AND s.excluded_at IS NULL
       GROUP BY p.song_id HAVING count(DISTINCT substr(p.played_at, 1, 10)) >= ?
       ORDER BY count(DISTINCT substr(p.played_at, 1, 10)) DESC, max(p.played_at) DESC`,
    )
    .pluck()
    .all(communityId, since, MOST_SERVICES) as string[];
  return songResults(db, ids, new Set(), days);
}

/** Up to 50 songs sung in 3 services or more, none in the last 6 months; most sung first. */
export function notSungLately(db: Db, communityId: string, now = new Date()) {
  return counted(db, restedSongs(db, communityId, now));
}

export type ServicesGrid = {
  /** The last 12 service days, oldest first. */
  days: string[];
  /** Each song sung in them, with its days among them; most sung first. */
  songs: (SongResult & { sung: string[] })[];
};

/** The last 12 services as a grid: which songs were sung on which day. */
export function servicesGrid(db: Db, communityId: string): ServicesGrid {
  const days = lastServiceDays(db, communityId, 12).reverse();
  const [first] = days;
  if (!first) return { days, songs: [] };
  const rows = db
    .prepare(
      `SELECT p.song_id AS id, substr(p.played_at, 1, 10) AS day
       FROM plays p JOIN songs s ON s.id = p.song_id
       WHERE p.community_id = ? AND p.mode = 'service' AND p.played_at >= ? AND s.deleted_at IS NULL
       GROUP BY p.song_id, day`,
    )
    .all(communityId, first) as { id: string; day: string }[];
  const sung = new Map<string, string[]>();
  for (const { id, day } of rows) sung.set(id, [...(sung.get(id) ?? []), day]);
  const order = [...sung].sort(
    ([, a], [, b]) =>
      b.length - a.length || (b.at(-1) ?? "").localeCompare(a.at(-1) ?? ""),
  );
  return {
    days,
    songs: songResults(
      db,
      order.map(([id]) => id),
    ).map((song, i) => ({ ...song, sung: order[i]?.[1].sort() ?? [] })),
  };
}

export type YearRecap = {
  services: number;
  songs: number;
  /** Songs whose first service play ever was that year, by their first date. */
  newSongs: (SongResult & { first: string })[];
  newCount: number;
};

/** A year's services, the songs sung in them, and the songs first sung that year. */
export function yearRecap(
  db: Db,
  communityId: string,
  year: string,
): YearRecap {
  const { services, songs } = db
    .prepare(
      `SELECT count(DISTINCT substr(played_at, 1, 10)) AS services, count(DISTINCT song_id) AS songs
       FROM plays WHERE community_id = ? AND mode = 'service' AND substr(played_at, 1, 4) = ?`,
    )
    .get(communityId, year) as { services: number; songs: number };
  const firsts = db
    .prepare(
      `SELECT p.song_id AS id, min(p.played_at) AS first, s.deleted_at AS deleted
       FROM plays p JOIN songs s ON s.id = p.song_id
       WHERE p.community_id = ? AND p.mode = 'service'
       GROUP BY p.song_id HAVING substr(first, 1, 4) = ?
       ORDER BY first`,
    )
    .all(communityId, year) as {
    id: string;
    first: string;
    deleted: string | null;
  }[];
  const shown = firsts.filter((f) => !f.deleted).slice(0, 50);
  return {
    services,
    songs,
    newCount: firsts.length,
    newSongs: songResults(
      db,
      shown.map((f) => f.id),
    ).map((song, i) => ({ ...song, first: shown[i]?.first ?? "" })),
  };
}

export type SongPlays = {
  services: number;
  first: string | null;
  last: string | null;
  years: { year: number; services: number }[];
};

/** How many services a song was sung in, the first and last, and per year. */
export function songPlays(db: Db, communityId: string, songId: string) {
  const where = `FROM plays WHERE community_id = ? AND song_id = ? AND mode = 'service'`;
  const totals = db
    .prepare(
      `SELECT count(*) AS services, min(played_at) AS first, max(played_at) AS last ${where}`,
    )
    .get(communityId, songId) as Omit<SongPlays, "years">;
  const perYear = db
    .prepare(
      `SELECT CAST(substr(played_at, 1, 4) AS INTEGER) AS year, count(*) AS services ${where}
       GROUP BY year ORDER BY year DESC`,
    )
    .all(communityId, songId) as SongPlays["years"];
  return { ...totals, years: perYear };
}

/** The Statistics page and a song's history, for members. */
export function attachStatistics(
  app: FastifyInstance,
  {
    db,
    findCommunity,
  }: { db: Db; findCommunity: (slug: string) => Community | undefined },
) {
  app.get<{
    Params: { slug: string };
    Querystring: { period?: string; season?: Season };
  }>(
    "/api/communities/:slug/statistics",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            period: { type: "string", pattern: "^(last12|all|\\d{4})$" },
            season: { enum: Object.keys(seasons) },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const user = request.user;
      if (!user) return reply.code(401).send({ error: "Log in first" });
      if (!isMember(db, community.id, user.id))
        return reply.code(403).send({ error: "Members only" });
      const period = (request.query.period ?? "last12") as Period;
      return {
        years: years(db, community.id, new Date()),
        mostSung: mostSung(
          db,
          community.id,
          period,
          request.query.season ?? null,
        ).map((song) => ({
          ...song,
          replay: latestReplay(db, community.id, song.id),
        })),
        notLately: notSungLately(db, community.id),
        recap:
          /^\d{4}$/.test(period) && !request.query.season
            ? yearRecap(db, community.id, period)
            : null,
        sungLately: sungLately(db, community.id),
        grid: servicesGrid(db, community.id),
      };
    },
  );

  app.get<{ Params: { slug: string; id: string } }>(
    "/api/communities/:slug/songs/:id/plays",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const user = request.user;
      if (!user) return reply.code(401).send({ error: "Log in first" });
      if (!isMember(db, community.id, user.id))
        return reply.code(403).send({ error: "Members only" });
      return songPlays(db, community.id, request.params.id);
    },
  );
}
