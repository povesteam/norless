import { createReadStream, existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../db/db.js";
import { memberRoles } from "../auth/members.js";
import type { Community } from "../songs/search.js";
import { ownerOf, recordingFor } from "./recording-view.js";

/** Listing recordings, serving their audio, asking for access and deleting them. */
export function attachRecordingLibrary(
  app: FastifyInstance,
  {
    db,
    team,
    rowOf,
    republish,
  }: {
    db: Db;
    team: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      community: Community & { slug: string };
      userId: string;
      dir: string;
    } | null;
    rowOf: (
      communityId: string,
      id: string,
    ) => Parameters<typeof recordingFor>[1] | undefined;
    republish: (community: Community & { slug: string }) => void;
  },
) {
  type Params = { slug: string; id: string };

  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug/recordings",
    async (request, reply) => {
      const who = team(request, reply);
      if (!who) return reply;
      const rows = db
        .prepare(
          "SELECT * FROM recordings WHERE community_id = ? AND deleted_at IS NULL ORDER BY started_at DESC",
        )
        .all(who.community.id) as Parameters<typeof recordingFor>[1][];
      return rows.map((row) => recordingFor(db, row, ownerOf(db, who.userId)));
    },
  );

  app.get<{ Params: Params }>(
    "/api/communities/:slug/recordings/:id",
    async (request, reply) => {
      const who = team(request, reply);
      if (!who) return reply;
      const row = rowOf(who.community.id, request.params.id);
      return row
        ? recordingFor(db, row, ownerOf(db, who.userId))
        : reply.code(404).send({ error: "Not found" });
    },
  );

  // A song's last 5 files, newest first, for its page (rehearsal-recordings spec).
  app.get<{ Params: { slug: string; song: string } }>(
    "/api/communities/:slug/songs/:song/recordings",
    async (request, reply) => {
      const who = team(request, reply);
      if (!who) return reply;
      const { song } = request.params;
      const rows = db
        .prepare(
          `SELECT r.* FROM recordings r
           WHERE r.community_id = ? AND r.deleted_at IS NULL AND r.status = 'ready'
             AND EXISTS (SELECT 1 FROM recording_parts p WHERE p.recording_id = r.id AND p.song_id = ?)
           ORDER BY r.started_at DESC LIMIT 5`,
        )
        .all(who.community.id, song) as Parameters<typeof recordingFor>[1][];
      const viewer = ownerOf(db, who.userId);
      return rows
        .flatMap((row) => {
          const { parts, ...recording } = recordingFor(db, row, viewer);
          return parts
            .filter((part) => part.songId === song)
            .map((part) => ({ recording, part }));
        })
        .slice(0, 5);
    },
  );

  // The audio of one part, with byte ranges, to those with access.
  app.get<{ Params: Params & { part: string } }>(
    "/api/communities/:slug/recordings/:id/parts/:part/audio",
    async (request, reply) => {
      const who = team(request, reply);
      if (!who) return reply;
      const row = rowOf(who.community.id, request.params.id);
      const viewer = ownerOf(db, who.userId);
      if (!row) return reply.code(404).send({ error: "Not found" });
      const access = recordingFor(db, row, viewer).access;
      if (access !== "own" && access !== "granted")
        return reply.code(403).send({ error: "Ask for access first" });
      const file = db
        .prepare(
          "SELECT file FROM recording_parts WHERE id = ? AND recording_id = ?",
        )
        .pluck()
        .get(request.params.part, row.id) as string | undefined;
      const path = file && join(who.dir, row.id, file);
      if (!path || !existsSync(path))
        return reply.code(404).send({ error: "Not found" });
      const size = statSync(path).size;
      // Cut files are m4a; an uncut upload keeps the format it was recorded in.
      const type = file.endsWith(".m4a")
        ? "audio/mp4"
        : file.endsWith(".ogg")
          ? "audio/ogg"
          : "audio/webm";
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? "");
      void reply
        .header("accept-ranges", "bytes")
        .header("content-type", type)
        .header("cache-control", "private, max-age=3600");
      if (!range) {
        void reply.header("content-length", size);
        return reply.send(createReadStream(path));
      }
      const start = range[1]
        ? Number(range[1])
        : Math.max(0, size - Number(range[2]));
      const end =
        range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start >= size || start > end)
        return reply
          .code(416)
          .header("content-range", `bytes */${size}`)
          .send();
      return reply
        .code(206)
        .header("content-range", `bytes ${start}-${end}/${size}`)
        .header("content-length", end - start + 1)
        .send(createReadStream(path, { start, end }));
    },
  );

  // Asking for access, by someone it doesn't belong to.
  app.post<{ Params: Params }>(
    "/api/communities/:slug/recordings/:id/access",
    async (request, reply) => {
      const who = team(request, reply);
      if (!who) return reply;
      const row = rowOf(who.community.id, request.params.id);
      const viewer = ownerOf(db, who.userId);
      if (!row) return reply.code(404).send({ error: "Not found" });
      if (row.owner_id === viewer)
        return reply.code(400).send({ error: "It's yours" });
      db.prepare(
        `INSERT INTO recording_access (recording_id, user_id, status, asked_at) VALUES (?, ?, 'asked', ?)
         ON CONFLICT (recording_id, user_id) DO UPDATE SET status = 'asked', asked_at = excluded.asked_at, answered_at = NULL
         WHERE recording_access.status = 'refused'`,
      ).run(row.id, viewer, new Date().toISOString());
      return reply.code(204).send();
    },
  );

  // Its owner grants, refuses, or withdraws access.
  app.put<{
    Params: Params & { user: string };
    Body: { status: "granted" | "refused" };
  }>(
    "/api/communities/:slug/recordings/:id/access/:user",
    {
      schema: {
        body: {
          type: "object",
          required: ["status"],
          additionalProperties: false,
          properties: { status: { enum: ["granted", "refused"] } },
        },
      },
    },
    async (request, reply) => {
      const who = team(request, reply);
      if (!who) return reply;
      const row = rowOf(who.community.id, request.params.id);
      if (!row || row.owner_id !== ownerOf(db, who.userId))
        return reply.code(404).send({ error: "Not found" });
      const changed = db
        .prepare(
          "UPDATE recording_access SET status = ?, answered_at = ? WHERE recording_id = ? AND user_id = ?",
        )
        .run(
          request.body.status,
          new Date().toISOString(),
          row.id,
          request.params.user,
        );
      return changed.changes ? reply.code(204).send() : reply.code(404).send();
    },
  );

  // Its owner or a community owner deletes it, with its audio.
  app.delete<{ Params: Params }>(
    "/api/communities/:slug/recordings/:id",
    async (request, reply) => {
      const who = team(request, reply);
      if (!who) return reply;
      const row = rowOf(who.community.id, request.params.id);
      if (!row) return reply.code(404).send({ error: "Not found" });
      const ownerRole = memberRoles(db, who.community.id, who.userId).includes(
        "owner",
      );
      if (row.owner_id !== ownerOf(db, who.userId) && !ownerRole)
        return reply
          .code(403)
          .send({ error: "Only who recorded it or an owner" });
      const at = new Date().toISOString();
      db.prepare(
        "UPDATE recordings SET deleted_at = ?, status = CASE status WHEN 'recording' THEN 'failed' ELSE status END, updated_at = ?, updated_by = ? WHERE id = ?",
      ).run(at, at, who.userId, row.id);
      rmSync(join(who.dir, row.id), { recursive: true, force: true });
      republish(who.community);
      return reply.code(204).send();
    },
  );
}
