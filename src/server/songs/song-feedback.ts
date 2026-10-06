import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";
import type { Live } from "../live/live.js";
import { isMember, memberRoles, allows } from "../auth/members.js";
import type { Community } from "./search.js";
import { getSong } from "./songs.js";

export type Opinion = "like" | "dislike";

/** How members feel about a song, as one member sees it; owners also get the reasons. */
export type Opinions = {
  likes: number;
  dislikes: number;
  mine: Opinion | null;
  /** The reason the member gave for their dislike. */
  reason: string;
  /** Owners only: each dislike's reason, by name. */
  reasons?: { name: string; reason: string }[];
};

/** Opinions of members still in the community. */
const counted = `FROM song_opinions o
  JOIN members m ON m.user_id = o.user_id AND m.community_id = o.community_id
    AND m.status = 'active' AND m.deleted_at IS NULL`;

export function opinionsOf(
  db: Db,
  songId: string,
  userId: string,
  owner: boolean,
): Opinions {
  const { likes, dislikes } = db
    .prepare(
      `SELECT count(*) FILTER (WHERE opinion = 'like') AS likes,
         count(*) FILTER (WHERE opinion = 'dislike') AS dislikes
       ${counted} WHERE o.song_id = ?`,
    )
    .get(songId) as { likes: number; dislikes: number };
  const mine = db
    .prepare(
      "SELECT opinion, reason FROM song_opinions WHERE song_id = ? AND user_id = ?",
    )
    .get(songId, userId) as { opinion: Opinion; reason: string } | undefined;
  return {
    likes,
    dislikes,
    mine: mine?.opinion ?? null,
    reason: mine?.reason ?? "",
    ...(owner && { reasons: reasons(db, songId) }),
  };
}

/** Each counted dislike that says why, by name, newest first. */
function reasons(db: Db, songId: string) {
  return db
    .prepare(
      `SELECT u.display_name AS name, o.reason ${counted} JOIN users u ON u.id = o.user_id
       WHERE o.song_id = ? AND o.opinion = 'dislike' AND o.reason <> ''
       ORDER BY o.updated_at DESC`,
    )
    .all(songId) as { name: string; reason: string }[];
}

/** Ids of the songs a user likes, still there and not excluded, last liked first. */
export function likedSongs(db: Db, communityId: string, userId: string) {
  return db
    .prepare(
      `SELECT o.song_id FROM song_opinions o JOIN songs s ON s.id = o.song_id
       WHERE o.community_id = ? AND o.user_id = ? AND o.opinion = 'like'
         AND s.deleted_at IS NULL AND s.excluded_at IS NULL
       ORDER BY o.updated_at DESC LIMIT 100`,
    )
    .pluck()
    .all(communityId, userId) as string[];
}

/** Sets, changes or (with null) takes back a member's opinion of a song. */
export function setOpinion(
  db: Db,
  communityId: string,
  songId: string,
  userId: string,
  opinion: Opinion | null,
  reason = "",
  now = new Date(),
) {
  const at = now.toISOString();
  if (opinion === null)
    db.prepare(
      "DELETE FROM song_opinions WHERE song_id = ? AND user_id = ?",
    ).run(songId, userId);
  else
    db.prepare(
      `INSERT INTO song_opinions (id, community_id, song_id, user_id, opinion, reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (song_id, user_id) DO UPDATE SET
         opinion = excluded.opinion, reason = excluded.reason, updated_at = excluded.updated_at`,
    ).run(
      newId(),
      communityId,
      songId,
      userId,
      opinion,
      opinion === "dislike" ? reason.trim() : "",
      at,
      at,
    );
}

/** Excludes a song with a reason, or (with null) includes it again. */
export function setExclusion(
  db: Db,
  songId: string,
  userId: string,
  reason: string | null,
  now = new Date(),
) {
  db.prepare(
    "UPDATE songs SET excluded_reason = ?, excluded_at = ?, excluded_by = ? WHERE id = ?",
  ).run(
    reason,
    reason === null ? null : now.toISOString(),
    reason === null ? null : userId,
    songId,
  );
}

export type ReviewedSong = {
  id: string;
  title: string;
  likes: number;
  dislikes: number;
  reasons: { name: string; reason: string }[];
};
export type ExcludedSong = {
  id: string;
  title: string;
  reason: string;
  by: string | null;
  at: string;
};

/** The owners' Songs tab: disliked songs, most dislikes first, then the excluded ones. */
export function review(db: Db, communityId: string) {
  const title = `(SELECT title FROM song_versions v WHERE v.song_id = s.id AND v.deleted_at IS NULL
    ORDER BY v.created_at, v.language LIMIT 1)`;
  const disliked = (
    db
      .prepare(
        `SELECT s.id, ${title} AS title,
           count(*) FILTER (WHERE o.opinion = 'like') AS likes,
           count(*) FILTER (WHERE o.opinion = 'dislike') AS dislikes
         ${counted} JOIN songs s ON s.id = o.song_id
         WHERE o.community_id = ? AND s.deleted_at IS NULL AND s.excluded_at IS NULL
         GROUP BY s.id HAVING dislikes > 0
         ORDER BY dislikes DESC, likes, title`,
      )
      .all(communityId) as Omit<ReviewedSong, "reasons">[]
  ).map((song) => ({ ...song, reasons: reasons(db, song.id) }));
  const excluded = db
    .prepare(
      `SELECT s.id, ${title} AS title, s.excluded_reason AS reason,
         nullif(u.display_name, '') AS by, s.excluded_at AS at
       FROM songs s LEFT JOIN users u ON u.id = s.excluded_by
       WHERE s.community_id = ? AND s.deleted_at IS NULL AND s.excluded_at IS NOT NULL
       ORDER BY s.excluded_at DESC`,
    )
    .all(communityId) as ExcludedSong[];
  return { disliked: disliked as ReviewedSong[], excluded };
}

const reasonSchema = { type: "string", maxLength: 500 } as const;

/** Likes and dislikes for members; exclusions and the review list for owners. */
export function attachSongFeedback(
  app: FastifyInstance,
  {
    db,
    live,
    findCommunity,
  }: {
    db: Db;
    live: Live;
    findCommunity: (slug: string) => Community | undefined;
  },
) {
  type Params = { slug: string; id: string };
  /** Open song pages load the song again. */
  const changed = (communityId: string, id: string) =>
    live.publish(`song:${id}`, getSong(db, communityId, id));

  app.put<{
    Params: Params;
    Body: { opinion: Opinion | null; reason?: string };
  }>(
    "/api/communities/:slug/songs/:id/opinion",
    {
      schema: {
        body: {
          type: "object",
          required: ["opinion"],
          additionalProperties: false,
          properties: {
            opinion: { enum: ["like", "dislike", null] },
            reason: reasonSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const user = request.user;
      if (!user) return reply.code(401).send({ error: "Log in first" });
      // People, not the community's laptop or a guest's phone.
      if (user.device || !isMember(db, community.id, user.id))
        return reply.code(403).send({ error: "Members only" });
      const song = getSong(db, community.id, request.params.id);
      if (!song || song.deletedAt)
        return reply.code(404).send({ error: "Not found" });
      setOpinion(
        db,
        community.id,
        song.id,
        user.id,
        request.body.opinion,
        request.body.reason,
      );
      changed(community.id, song.id);
      return opinionsOf(
        db,
        song.id,
        user.id,
        allows(memberRoles(db, community.id, user.id), "owner"),
      );
    },
  );

  app.put<{ Params: Params; Body: { reason: string | null } }>(
    "/api/communities/:slug/songs/:id/exclusion",
    {
      schema: {
        body: {
          type: "object",
          required: ["reason"],
          additionalProperties: false,
          properties: {
            reason: {
              anyOf: [{ ...reasonSchema, minLength: 1 }, { type: "null" }],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "owner");
      if (!userId) return reply;
      const song = getSong(db, community.id, request.params.id);
      if (!song) return reply.code(404).send({ error: "Not found" });
      const reason = request.body.reason?.trim() || null;
      if (request.body.reason !== null && !reason)
        return reply.code(400).send({ error: "The reason is empty" });
      setExclusion(db, song.id, userId, reason);
      changed(community.id, song.id);
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug/song-feedback",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      if (!requireRole(db, request, reply, community.id, "owner")) return reply;
      return review(db, community.id);
    },
  );
}
