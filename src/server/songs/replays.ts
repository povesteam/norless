import type { FastifyInstance } from "fastify";
import { chapterEntries } from "../../shared/chapters.js";
import { requireRole } from "../auth/auth.js";
import {
  findStream,
  lastService,
  type Stream,
  type YouTube,
} from "./chapters.js";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";
import type { Community } from "./search.js";

/*
 * Replays: the services' live streams, found on the community's
 * channel after each service, and each moment an entry went live as a link to its second
 * in the stream.
 */

const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * Keeps a finished stream, or moves the start of the one kept for its video. A stream
 * still live isn't kept: without its end it would cover every later service.
 */
export function keepStream(
  db: Db,
  communityId: string,
  stream: Stream,
  userId: string | null = null,
) {
  if (!stream.endedAt) return;
  const at = new Date().toISOString();
  db.prepare(
    `INSERT INTO streams (id, community_id, video_id, started_at, ended_at, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (community_id, video_id) DO UPDATE SET started_at = excluded.started_at,
       ended_at = excluded.ended_at, deleted_at = NULL, updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
  ).run(
    newId(),
    communityId,
    stream.videoId,
    stream.startedAt,
    stream.endedAt,
    at,
    at,
    userId,
    userId,
  );
}

/** The kept stream that was running at `at`, if any. */
export const streamAt = (db: Db, communityId: string, at: string) =>
  db
    .prepare(
      `SELECT video_id AS videoId, started_at AS startedAt, ended_at AS endedAt FROM streams
       WHERE community_id = ? AND deleted_at IS NULL AND started_at <= ? AND ended_at >= ?
       ORDER BY started_at DESC LIMIT 1`,
    )
    .get(communityId, at, at) as Stream | undefined;

/** A link to the second of the stream when `at` happened; null outside the streams. */
export function replayAt(db: Db, communityId: string, at: string) {
  const stream = streamAt(db, communityId, at);
  if (!stream) return null;
  const seconds = Math.floor(
    (Date.parse(at) - Date.parse(stream.startedAt)) / 1000,
  );
  return `https://www.youtube.com/watch?v=${encodeURIComponent(stream.videoId)}&t=${seconds}s`;
}

/** A song's service plays inside the streams, newest first, at most 20. */
export function songReplays(db: Db, communityId: string, songId: string) {
  const plays = db
    .prepare(
      `SELECT played_at FROM plays p WHERE community_id = ? AND song_id = ? AND mode = 'service'
         AND EXISTS (SELECT 1 FROM streams s WHERE s.community_id = p.community_id
           AND s.deleted_at IS NULL AND p.played_at BETWEEN s.started_at AND s.ended_at)
       ORDER BY played_at DESC LIMIT 20`,
    )
    .pluck()
    .all(communityId, songId) as string[];
  return plays.flatMap((at) => {
    const url = replayAt(db, communityId, at);
    return url ? [{ at, url }] : [];
  });
}

/** The latest of a song's service plays inside a stream, as a link; null for none. */
export const latestReplay = (db: Db, communityId: string, songId: string) =>
  songReplays(db, communityId, songId)[0]?.url ?? null;

/**
 * For each community with a channel, the services of the last 3 days that no kept stream
 * covers yet, looked up and kept when found: 2 or 3 quota units each.
 */
export async function findStreams(db: Db, youtube: YouTube, now = new Date()) {
  const communities = db
    .prepare(
      "SELECT id, youtube_channel AS channel FROM communities WHERE youtube_channel IS NOT NULL AND deleted_at IS NULL",
    )
    .all() as { id: string; channel: string }[];
  for (const { id, channel } of communities) {
    // The day by the calendar in UTC, as the chapters take it; over by an hour.
    const services = db
      .prepare(
        `SELECT min(at) AS first FROM live_log
         WHERE community_id = ? AND mode = 'service' AND at >= ?
         GROUP BY substr(at, 1, 10) HAVING max(at) < ?`,
      )
      .pluck()
      .all(
        id,
        new Date(now.getTime() - 3 * DAY).toISOString(),
        new Date(now.getTime() - HOUR).toISOString(),
      ) as string[];
    for (const first of services) {
      if (streamAt(db, id, first)) continue;
      const stream = await findStream(youtube, channel, first);
      if (stream) keepStream(db, id, stream);
    }
  }
}

/** The replays' routes, and the hourly look for the services' streams. */
export function attachReplays(
  app: FastifyInstance,
  {
    db,
    findCommunity,
    youtube,
  }: {
    db: Db;
    findCommunity: (slug: string) => Community | undefined;
    youtube?: YouTube;
  },
) {
  if (youtube) {
    const look = () =>
      void findStreams(db, youtube).catch((error: unknown) =>
        app.log.warn({ error }, "Service streams not found"),
      );
    const timer = setInterval(look, HOUR);
    timer.unref();
    app.addHook("onReady", async () => look());
    app.addHook("onClose", async () => clearInterval(timer));
  }

  // Everyone who reads songs sees them, as the streams are public.
  app.get<{ Params: { slug: string; id: string } }>(
    "/api/communities/:slug/songs/:id/replays",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      return songReplays(db, community.id, request.params.id);
    },
  );

  // Each entry of a playlist's last service, at the moment it first went live there.
  app.get<{ Params: { slug: string; id: string } }>(
    "/api/communities/:slug/playlists/:id/replays",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const links: Record<string, string> = {};
      for (const { entryId, at } of lastService(
        db,
        community.id,
        request.params.id,
      )) {
        if (links[entryId]) continue;
        const url = replayAt(db, community.id, at);
        if (url) links[entryId] = url;
      }
      return links;
    },
  );

  // The chapters dialog's first chapter time moves the stream's start, for the team.
  app.put<{
    Params: { slug: string; id: string };
    Body: { videoId: string; firstAt: number };
  }>(
    "/api/communities/:slug/playlists/:id/stream",
    {
      schema: {
        body: {
          type: "object",
          required: ["videoId", "firstAt"],
          additionalProperties: false,
          properties: {
            videoId: { type: "string", pattern: "^[\\w-]{6,20}$" },
            firstAt: { type: "integer", minimum: 0, maximum: 86_400 },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "team");
      if (!userId) return reply;
      const [first] = chapterEntries(
        lastService(db, community.id, request.params.id),
      );
      if (!first) return reply.code(404).send({ error: "Not shown yet" });
      const { videoId, firstAt } = request.body;
      const startedAt = new Date(
        Date.parse(first.at) - firstAt * 1000,
      ).toISOString();
      const kept = db
        .prepare(
          "SELECT ended_at FROM streams WHERE community_id = ? AND video_id = ?",
        )
        .pluck()
        .get(community.id, videoId) as string | undefined;
      // Not kept yet (still being found): until 6 hours after its start.
      const endedAt =
        kept ?? new Date(Date.parse(startedAt) + 6 * HOUR).toISOString();
      keepStream(db, community.id, { videoId, startedAt, endedAt }, userId);
      return reply.code(204).send();
    },
  );
}
