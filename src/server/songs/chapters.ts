import type { FastifyInstance } from "fastify";
import type { Shown } from "../../shared/chapters.js";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import { isMember } from "../auth/members.js";
import { keepStream, streamAt } from "./replays.js";
import type { Community } from "./search.js";

/** Calls the YouTube Data API: a resource ("videos") with its parameters. */
export type YouTube = (
  resource: string,
  params: Record<string, string>,
) => Promise<unknown>;

/** The YouTube Data API with a key; tests pass their own. */
export const youtubeApi =
  (key: string): YouTube =>
  async (resource, params) => {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
    for (const [name, value] of Object.entries({ ...params, key }))
      url.searchParams.set(name, value);
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok)
      throw new Error(`YouTube ${resource}: ${response.status}`);
    return response.json();
  };

/** A live stream: its video, when it started, and when it ended (null while live). */
export type Stream = {
  videoId: string;
  startedAt: string;
  endedAt: string | null;
};

/**
 * "@Unu-unuRo" from a handle or a channel's address, "UC…" from a /channel/ address;
 * null for anything else.
 */
export function channelOf(text: string): string | null {
  const address = text
    .trim()
    .replace(/^(https?:\/\/)?((www|m)\.)?youtube\.com\//i, "")
    .replace(/^channel\//, "")
    .replace(/[/?#].*$/, "");
  if (/^@[\w.-]{3,30}$/.test(address)) return address;
  return /^UC[\w-]{22}$/.test(address) ? address : null;
}

type Items<T> = { items?: T[] } | undefined;

/**
 * The channel's live stream that was running at `at`, among its 50 latest videos: 2
 * quota units, 3 with a handle to look up (of 10,000 a day).
 */
export async function findStream(
  youtube: YouTube,
  channel: string,
  at: string,
): Promise<Stream | null> {
  const id = channel.startsWith("UC")
    ? channel
    : (
        (await youtube("channels", {
          part: "id",
          forHandle: channel,
        })) as Items<{
          id: string;
        }>
      )?.items?.[0]?.id;
  if (!id) return null;
  // A channel's uploads, its live streams included, are the playlist "UU…".
  const uploads = (await youtube("playlistItems", {
    part: "contentDetails",
    playlistId: `UU${id.slice(2)}`,
    maxResults: "50",
  })) as Items<{ contentDetails: { videoId: string } }>;
  const ids = (uploads?.items ?? []).map((i) => i.contentDetails.videoId);
  if (ids.length === 0) return null;
  const videos = (await youtube("videos", {
    part: "liveStreamingDetails",
    id: ids.join(","),
  })) as Items<{
    id: string;
    liveStreamingDetails?: { actualStartTime?: string; actualEndTime?: string };
  }>;
  const time = Date.parse(at);
  const found = (videos?.items ?? []).find(({ liveStreamingDetails: live }) => {
    if (!live?.actualStartTime) return false;
    const end = live.actualEndTime ? Date.parse(live.actualEndTime) : Infinity;
    return Date.parse(live.actualStartTime) <= time && time <= end;
  });
  const startedAt = found?.liveStreamingDetails?.actualStartTime;
  return found && startedAt
    ? {
        videoId: found.id,
        startedAt,
        endedAt: found.liveStreamingDetails?.actualEndTime ?? null,
      }
    : null;
}

/**
 * The entries of a playlist's last service, in the order they went live, each with when
 * the next entry (of any playlist) went live; null while it's still live.
 */
export function lastService(
  db: Db,
  communityId: string,
  playlistId: string,
): Shown[] {
  // The day by the calendar in UTC: a morning service in Europe is the same day.
  return db
    .prepare(
      `SELECT l.entry_id AS entryId, l.at,
         (SELECT min(n.at) FROM live_log n WHERE n.community_id = l.community_id AND n.at > l.at) AS until
       FROM live_log l
       WHERE l.community_id = @community AND l.playlist_id = @playlist AND l.mode = 'service'
         AND substr(l.at, 1, 10) = (
           SELECT max(substr(at, 1, 10)) FROM live_log
           WHERE community_id = @community AND playlist_id = @playlist AND mode = 'service')
       ORDER BY l.at, l.rowid`,
    )
    .all({ community: communityId, playlist: playlistId }) as Shown[];
}

/** GET …/playlists/<id>/chapters and its stream, for members; the channel, for owners. */
export function attachChapters(
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
  app.get<{ Params: { slug: string; id: string } }>(
    "/api/communities/:slug/playlists/:id/chapters",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const user = request.user;
      if (!user) return reply.code(401).send({ error: "Log in first" });
      if (!isMember(db, community.id, user.id))
        return reply.code(403).send({ error: "Members only" });
      return lastService(db, community.id, request.params.id);
    },
  );

  // The stream of the playlist's last service on the community's channel, for the
  // chapters' offset. Null without an API key, a channel, or a match.
  app.get<{ Params: { slug: string; id: string } }>(
    "/api/communities/:slug/playlists/:id/stream",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const user = request.user;
      if (!user) return reply.code(401).send({ error: "Log in first" });
      if (!isMember(db, community.id, user.id))
        return reply.code(403).send({ error: "Members only" });
      const channel = db
        .prepare("SELECT youtube_channel FROM communities WHERE id = ?")
        .pluck()
        .get(community.id) as string | null;
      const [first] = lastService(db, community.id, request.params.id);
      if (!first) return { stream: null };
      // A stream already kept, corrected maybe; else found and kept.
      const kept = streamAt(db, community.id, first.at);
      if (kept) return { stream: kept };
      if (!youtube || !channel) return { stream: null };
      try {
        const stream = await findStream(youtube, channel, first.at);
        if (stream) keepStream(db, community.id, stream);
        return { stream };
      } catch (error) {
        request.log.warn({ error }, "YouTube stream not found");
        return { stream: null };
      }
    },
  );

  app.put<{ Params: { slug: string }; Body: { channel: string | null } }>(
    "/api/communities/:slug/youtube-channel",
    {
      schema: {
        body: {
          type: "object",
          required: ["channel"],
          additionalProperties: false,
          properties: { channel: { type: ["string", "null"], maxLength: 200 } },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "owner");
      if (!userId) return reply;
      const typed = request.body.channel?.trim() || null;
      const channel = typed && channelOf(typed);
      if (typed && !channel)
        return reply.code(400).send({ error: "Not a YouTube channel" });
      db.prepare(
        "UPDATE communities SET youtube_channel = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      ).run(channel, new Date().toISOString(), userId, community.id);
      return { channel };
    },
  );
}
