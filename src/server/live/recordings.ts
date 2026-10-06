import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";
import type { LiveView } from "./live-view.js";
import type { Community } from "../songs/search.js";
import { cut, extensionOf, finish } from "./recording-finish.js";
import { attachRecordingLibrary } from "./recording-library.js";
import { ownerOf, recordingFor } from "./recording-view.js";

/**
 * Rehearsal and service recordings: uploaded in numbered
 * pieces while they run, marked with what was live, then cut by the converter into a file per
 * entry. A recording belongs to whoever made it; others ask for access.
 */

/** A recording that gets no piece for this long is finished, as if stopped. */
export const IDLE_MS = 2 * 60_000;
/** A recording the converter couldn't take is tried again after this long. */
export const RETRY_MS = 5 * 60_000;

/** The running recording in a community, with who records, for the stage screens. */
export function activeRecording(db: Db, communityId: string) {
  return (
    (db
      .prepare(
        `SELECT r.id, nullif(u.display_name, '') AS by FROM recordings r
         LEFT JOIN users u ON u.id = coalesce(r.created_by, r.owner_id)
         WHERE r.community_id = ? AND r.status = 'recording' AND r.deleted_at IS NULL
         ORDER BY r.started_at DESC LIMIT 1`,
      )
      .get(communityId) as { id: string; by: string | null } | undefined) ??
    null
  );
}

/** Notes what's live in every running recording of the community, when it changed. */
export function markLive(
  db: Db,
  communityId: string,
  view: Pick<LiveView, "entryId" | "slide" | "blank" | "song">,
  now = new Date(),
) {
  const running = db
    .prepare(
      "SELECT id, started_at FROM recordings WHERE community_id = ? AND status = 'recording' AND deleted_at IS NULL",
    )
    .all(communityId) as { id: string; started_at: string }[];
  for (const r of running) {
    const last = db
      .prepare(
        "SELECT entry_id, slide FROM recording_marks WHERE recording_id = ? ORDER BY at_ms DESC, rowid DESC LIMIT 1",
      )
      .get(r.id) as { entry_id: string | null; slide: number } | undefined;
    const entryId = view.blank ? null : view.entryId;
    if (last && last.entry_id === entryId && last.slide === view.slide)
      continue;
    db.prepare(
      "INSERT INTO recording_marks (recording_id, at_ms, entry_id, song_id, slide) VALUES (?, ?, ?, ?, ?)",
    ).run(
      r.id,
      Math.max(0, now.getTime() - Date.parse(r.started_at)),
      entryId,
      entryId ? (view.song?.id ?? null) : null,
      view.slide,
    );
  }
}

export function attachRecordings(
  app: FastifyInstance,
  {
    db,
    findCommunity,
    dir,
    viewOf,
    republish,
  }: {
    db: Db;
    findCommunity: (slug: string) => (Community & { slug: string }) | undefined;
    /** Where the audio is kept; without it, recording is off. */
    dir?: string;
    viewOf: (community: Community & { slug: string }) => LiveView;
    republish: (community: Community & { slug: string }) => void;
  },
) {
  type Params = { slug: string; id: string };
  app.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer", bodyLimit: 5 * 1024 * 1024 },
    (_request, body, done) => done(null, body),
  );

  /** The team (guest musicians too) and owners; null after answering for them. */
  const team = (request: FastifyRequest, reply: FastifyReply) => {
    const community = findCommunity((request.params as Params).slug);
    if (!community) {
      void reply.code(404).send({ error: "Not found" });
      return null;
    }
    if (!dir) {
      void reply.code(503).send({ error: "Recording isn't set up here" });
      return null;
    }
    const userId = requireRole(db, request, reply, community.id, "team");
    return userId ? { community, userId, dir } : null;
  };
  const rowOf = (communityId: string, id: string) =>
    db
      .prepare(
        "SELECT * FROM recordings WHERE id = ? AND community_id = ? AND deleted_at IS NULL",
      )
      .get(id, communityId) as Parameters<typeof recordingFor>[1] | undefined;

  app.post<{ Params: { slug: string }; Body: { mime: string } }>(
    "/api/communities/:slug/recordings",
    {
      schema: {
        body: {
          type: "object",
          required: ["mime"],
          additionalProperties: false,
          properties: {
            mime: { type: "string", pattern: "^audio/", maxLength: 100 },
          },
        },
      },
    },
    async (request, reply) => {
      const who = team(request, reply);
      if (!who) return reply;
      const id = newId();
      const at = new Date().toISOString();
      const view = viewOf(who.community);
      const room = db
        .prepare(
          "SELECT id FROM rooms WHERE community_id = ? ORDER BY created_at LIMIT 1",
        )
        .pluck()
        .get(who.community.id) as string;
      db.prepare(
        `INSERT INTO recordings (id, community_id, room_id, owner_id, mode, mime, status, started_at, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, 'recording', ?, ?, ?, ?, ?)`,
      ).run(
        id,
        who.community.id,
        room,
        ownerOf(db, who.userId),
        view.mode === "service" ? "service" : "rehearsal",
        request.body.mime,
        at,
        at,
        at,
        who.userId,
        who.userId,
      );
      mkdirSync(join(who.dir, id), { recursive: true });
      markLive(db, who.community.id, view, new Date(at));
      republish(who.community);
      return reply.code(201).send({ id });
    },
  );

  // A piece of the audio, numbered from 0; one the server already has is ignored.
  app.post<{ Params: Params; Querystring: { piece: number } }>(
    "/api/communities/:slug/recordings/:id/pieces",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["piece"],
          properties: { piece: { type: "integer", minimum: 0 } },
        },
      },
    },
    async (request, reply) => {
      const who = team(request, reply);
      if (!who) return reply;
      const row = db
        .prepare(
          "SELECT created_by, mime, pieces, status FROM recordings WHERE id = ? AND community_id = ? AND deleted_at IS NULL",
        )
        .get(request.params.id, who.community.id) as
        | { created_by: string; mime: string; pieces: number; status: string }
        | undefined;
      if (!row || row.created_by !== who.userId)
        return reply.code(404).send({ error: "Not found" });
      const { piece } = request.query;
      if (piece < row.pieces) return reply.code(204).send();
      if (piece > row.pieces || row.status !== "recording")
        return reply
          .code(409)
          .send({ expected: row.pieces, status: row.status });
      const body = request.body as Buffer;
      appendFileSync(
        join(who.dir, request.params.id, `upload.${extensionOf(row.mime)}`),
        body,
      );
      db.prepare(
        "UPDATE recordings SET pieces = pieces + 1, bytes = bytes + ?, last_piece_at = ?, updated_at = ? WHERE id = ?",
      ).run(
        body.length,
        new Date().toISOString(),
        new Date().toISOString(),
        request.params.id,
      );
      return reply.code(204).send();
    },
  );

  app.post<{ Params: Params }>(
    "/api/communities/:slug/recordings/:id/stop",
    async (request, reply) => {
      const who = team(request, reply);
      if (!who) return reply;
      const row = rowOf(who.community.id, request.params.id);
      if (!row || row.created_by !== who.userId)
        return reply.code(404).send({ error: "Not found" });
      if (row.status === "recording") {
        db.prepare("UPDATE recordings SET stopped_at = ? WHERE id = ?").run(
          new Date().toISOString(),
          row.id,
        );
        await finish(db, who.dir, row.id);
        republish(who.community);
      }
      const done = rowOf(who.community.id, row.id);
      return done ? recordingFor(db, done, who.userId) : reply.code(404).send();
    },
  );

  attachRecordingLibrary(app, { db, team, rowOf, republish });

  // A recording that stopped getting pieces (a dead battery, a closed tab) is finished.
  const idle = setInterval(() => {
    if (!dir) return;
    const stale = db
      .prepare(
        "SELECT r.id, c.slug FROM recordings r JOIN communities c ON c.id = r.community_id WHERE r.status = 'recording' AND r.deleted_at IS NULL AND coalesce(r.last_piece_at, r.started_at) < ?",
      )
      .all(new Date(Date.now() - IDLE_MS).toISOString()) as {
      id: string;
      slug: string;
    }[];
    // And those the converter couldn't take: again every 5 minutes, also after a restart.
    const waiting = db
      .prepare(
        "SELECT r.id, c.slug FROM recordings r JOIN communities c ON c.id = r.community_id WHERE r.status = 'processing' AND r.deleted_at IS NULL AND r.updated_at < ?",
      )
      .all(new Date(Date.now() - RETRY_MS).toISOString()) as typeof stale;
    for (const [run, list] of [
      [finish, stale],
      [cut, waiting],
    ] as const)
      for (const r of list)
        void run(db, dir, r.id).then(() => {
          const community = findCommunity(r.slug);
          if (community) republish(community);
        });
  }, 30_000);
  idle.unref();
  app.addHook("onClose", async () => clearInterval(idle));
}
