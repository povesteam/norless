import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { LiveState, Mode } from "../../shared/live.js";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";
import { allows, isMember, memberRoles } from "../auth/members.js";
import type { Community } from "../songs/search.js";

/** A practice room, as devices list and join it. */
export type PracticeRoom = {
  id: string;
  /** Who started it, whose name it carries ("Practice · Pavel"). */
  name: string;
  startedBy: string | null;
  /** Rehearsal, or service when the starter switched it (a children's meeting). */
  mode: Mode;
  playlistId: string | null;
  createdAt: string;
};

/** A practice room ends after this long without a live change. */
const IDLE_MS = 4 * 60 * 60_000;

/**
 * Practice rooms: a team member starts one next to the live service,
 * with a playlist; anyone on the team joins it, screens and guests by its link. It has
 * its own live state; it ends when its starter or an owner ends it, or after 4 hours
 * without a live change.
 */
export function attachRooms(
  app: FastifyInstance,
  {
    db,
    findCommunity,
    stateOf,
    forget,
    now = () => new Date(),
  }: {
    db: Db;
    findCommunity: (slug: string) => Community | undefined;
    stateOf: (communityId: string, roomId: string | null) => LiveState;
    forget: (roomId: string) => void;
    now?: () => Date;
  },
) {
  const rows = (communityId: string, roomId?: string) =>
    db
      .prepare(
        `SELECT r.id, coalesce(u.display_name, r.name) AS name, r.started_by AS startedBy,
           coalesce(r.mode, 'rehearsal') AS mode, r.playlist_id AS playlistId, r.created_at AS createdAt
         FROM rooms r LEFT JOIN users u ON u.id = r.started_by
         WHERE r.community_id = ? AND r.temporary = 1 AND r.deleted_at IS NULL
           AND (? IS NULL OR r.id = ?)
         ORDER BY r.created_at`,
      )
      .all(communityId, roomId ?? null, roomId ?? null) as PracticeRoom[];

  const end = (roomId: string, by: string | null) => {
    const at = now().toISOString();
    db.prepare(
      "UPDATE rooms SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL",
    ).run(at, at, by, roomId);
    forget(roomId);
  };

  /** The room, and whether the request's user may change it: its starter, or an owner. */
  const owned = (
    request: FastifyRequest<{ Params: { slug: string; id: string } }>,
    reply: FastifyReply,
  ) => {
    const community = findCommunity(request.params.slug);
    if (!community) return void reply.code(404).send({ error: "Not found" });
    const userId = requireRole(db, request, reply, community.id, "team");
    if (!userId) return;
    const [room] = rows(community.id, request.params.id);
    if (!room) return void reply.code(404).send({ error: "No such room" });
    if (
      room.startedBy !== userId &&
      !allows(memberRoles(db, community.id, userId), "owner")
    )
      return void reply
        .code(403)
        .send({ error: "Only who started it, or an owner" });
    return { community, room, userId };
  };

  // Members see the practice rooms, with who started them.
  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug/rooms",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const user = request.user;
      if (!user || !isMember(db, community.id, user.id)) return [];
      return rows(community.id);
    },
  );

  // A room's link, for screens and guests: whether it still runs, and its playlist.
  app.get<{ Params: { slug: string; id: string } }>(
    "/api/communities/:slug/rooms/:id",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const [room] = rows(community.id, request.params.id);
      if (!room) return reply.code(404).send({ error: "This room has ended" });
      return { id: room.id, mode: room.mode, playlistId: room.playlistId };
    },
  );

  app.post<{
    Params: { slug: string };
    Body: { playlistId?: string | null; mode?: Mode };
  }>(
    "/api/communities/:slug/rooms",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            playlistId: {
              // Null first: coercion would make null an empty string.
              anyOf: [{ type: "null" }, { type: "string", maxLength: 100 }],
            },
            mode: { enum: ["rehearsal", "service"] },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "team");
      if (!userId || !request.user) return reply;
      const playlistId = request.body.playlistId ?? null;
      if (
        playlistId &&
        !db
          .prepare(
            "SELECT 1 FROM playlists WHERE id = ? AND community_id = ? AND deleted_at IS NULL",
          )
          .get(playlistId, community.id)
      )
        return reply.code(400).send({ error: "No such playlist" });
      const id = newId();
      const at = now().toISOString();
      db.prepare(
        `INSERT INTO rooms (id, community_id, name, temporary, started_by, mode, playlist_id,
           created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        community.id,
        request.user.displayName,
        userId,
        request.body.mode ?? "rehearsal",
        playlistId,
        at,
        at,
        userId,
        userId,
      );
      return reply.code(201).send(rows(community.id, id)[0]);
    },
  );

  app.patch<{ Params: { slug: string; id: string }; Body: { mode: Mode } }>(
    "/api/communities/:slug/rooms/:id",
    {
      schema: {
        body: {
          type: "object",
          required: ["mode"],
          additionalProperties: false,
          properties: { mode: { enum: ["rehearsal", "service"] } },
        },
      },
    },
    async (request, reply) => {
      const allowed = owned(request, reply);
      if (!allowed) return reply;
      const at = now().toISOString();
      db.prepare(
        "UPDATE rooms SET mode = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      ).run(request.body.mode, at, allowed.userId, allowed.room.id);
      return rows(allowed.community.id, allowed.room.id)[0];
    },
  );

  app.delete<{ Params: { slug: string; id: string } }>(
    "/api/communities/:slug/rooms/:id",
    async (request, reply) => {
      const allowed = owned(request, reply);
      if (!allowed) return reply;
      end(allowed.room.id, allowed.userId);
      return reply.code(204).send();
    },
  );

  // Rooms left alone end by themselves.
  const sweep = () => {
    const open = db
      .prepare(
        "SELECT id, community_id AS communityId, created_at AS createdAt FROM rooms WHERE temporary = 1 AND deleted_at IS NULL",
      )
      .all() as { id: string; communityId: string; createdAt: string }[];
    const at = now().getTime();
    for (const room of open) {
      const last =
        stateOf(room.communityId, room.id).changedAt ?? room.createdAt;
      if (at - Date.parse(last) > IDLE_MS) end(room.id, null);
    }
  };
  const timer = setInterval(sweep, 5 * 60_000);
  timer.unref();
  app.addHook("onClose", async () => clearInterval(timer));
  return { sweep };
}
