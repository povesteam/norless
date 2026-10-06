import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import type { Live } from "../live/live.js";
import { isMember } from "../auth/members.js";
import type { Community } from "../songs/search.js";
import {
  addEntry,
  changeEntry,
  moveEntry,
  removeEntry,
  restoreEntry,
} from "./entries.js";
import {
  type EntryInput,
  getPlaylist,
  listPlaylists,
  nextServicePlaylist,
  createPlaylist,
  changePlaylist,
} from "./playlists.js";

// Empty or left out: no title, the date names it.
const titleSchema = {
  type: "object",
  additionalProperties: false,
  properties: { title: { type: "string", maxLength: 200 } },
} as const;
const minutesSchema = {
  // null first: Fastify coerces types, and null would become 0 or "".
  anyOf: [{ type: "null" }, { type: "integer", minimum: 1, maximum: 240 }],
} as const;
const entrySchema = {
  type: "object",
  required: ["kind"],
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: ["song", "bible", "divider", "text"] },
    songId: { type: "string", maxLength: 100 },
    bible: {
      type: "object",
      required: ["book", "chapter", "from", "to"],
      additionalProperties: false,
      properties: {
        book: { type: "integer" },
        chapter: { type: "integer" },
        from: { type: "integer" },
        to: { type: "integer" },
      },
    },
    text: { type: "string", maxLength: 10_000 },
    plannedMinutes: minutesSchema,
    // Where it goes: after this entry, at the top for null, else at the end.
    after: { anyOf: [{ type: "null" }, { type: "string", maxLength: 100 }] },
  },
} as const;

/**
 * Playlist routes: reading is public, changes need the team role. Each change goes out
 * on `playlist:<id>`, and the list's changes on `playlists:<community slug>`, without
 * data: devices load what they show again.
 */
export function attachPlaylists(
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
  type EntryParams = Params & { entryId: string };

  /** The community, and the team member making the change; or null once answered. */
  const authorize = (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    const community = findCommunity(slug);
    if (!community) {
      void reply.code(404).send({ error: "Not found" });
      return null;
    }
    const userId = requireRole(db, request, reply, community.id, "team");
    return userId ? { communityId: community.id, userId } : null;
  };
  const changed = (slug: string, id: string, list = false) => {
    live.publish(`playlist:${id}`, {});
    if (list) live.publish(`playlists:${slug}`, {});
  };
  const notFound = (reply: FastifyReply) =>
    reply.code(404).send({ error: "Not found" });

  app.get<{
    Params: { slug: string };
    Querystring: {
      offset?: number;
      limit?: number;
      q?: string;
      archived?: boolean;
    };
  }>(
    "/api/communities/:slug/playlists",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            offset: { type: "integer", minimum: 0 },
            // ponytail: "Show more" asks for a longer list; summaries are small.
            limit: { type: "integer", minimum: 1, maximum: 5000 },
            q: { type: "string", maxLength: 100 },
            archived: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return notFound(reply);
      const {
        offset = 0,
        limit = 50,
        q = "",
        archived = false,
      } = request.query;
      const names =
        !!request.user && isMember(db, community.id, request.user.id);
      return {
        ...listPlaylists(db, community.id, offset, limit, {
          names,
          query: q.trim(),
          archived,
        }),
        next: nextServicePlaylist(db, community.id),
      };
    },
  );

  app.get<{ Params: Params }>(
    "/api/communities/:slug/playlists/:id",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return notFound(reply);
      const names =
        !!request.user && isMember(db, community.id, request.user.id);
      return (
        getPlaylist(db, community.id, request.params.id, { names }) ??
        notFound(reply)
      );
    },
  );

  app.post<{ Params: { slug: string }; Body: { title?: string } }>(
    "/api/communities/:slug/playlists",
    { schema: { body: titleSchema } },
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      const title = request.body?.title?.trim() || null;
      const playlist = createPlaylist(db, title, who);
      changed(request.params.slug, playlist.id, true);
      return reply.code(201).send(playlist);
    },
  );

  app.patch<{ Params: Params; Body: { title?: string } }>(
    "/api/communities/:slug/playlists/:id",
    { schema: { body: titleSchema } },
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      const title = request.body.title?.trim() || null;
      if (!changePlaylist(db, request.params.id, { title }, who))
        return notFound(reply);
      changed(request.params.slug, request.params.id, true);
      return reply.code(204).send();
    },
  );

  // Archived instead of deleted, so it can be found and restored.
  app.put<{ Params: Params; Body: { archived: boolean } }>(
    "/api/communities/:slug/playlists/:id/archived",
    {
      schema: {
        body: {
          type: "object",
          required: ["archived"],
          additionalProperties: false,
          properties: { archived: { type: "boolean" } },
        },
      },
    },
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      const { archived } = request.body;
      if (!changePlaylist(db, request.params.id, { archived }, who))
        return notFound(reply);
      changed(request.params.slug, request.params.id, true);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: Params; Body: EntryInput & { after?: string | null } }>(
    "/api/communities/:slug/playlists/:id/entries",
    { schema: { body: entrySchema } },
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      const result = addEntry(db, request.params.id, request.body, who);
      if (!result) return notFound(reply);
      if ("error" in result) return reply.code(400).send(result);
      // Between two entries.
      const { after } = request.body;
      if (after !== undefined)
        moveEntry(db, request.params.id, result.id, after, who);
      changed(request.params.slug, request.params.id);
      return reply.code(201).send(result);
    },
  );

  app.patch<{
    Params: EntryParams;
    Body: {
      text?: string;
      plannedMinutes?: number | null;
      keySignature?: string | null;
      hostWords?: Record<string, string>;
      ledBy?: string | null;
    };
  }>(
    "/api/communities/:slug/playlists/:id/entries/:entryId",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string", maxLength: 10_000 },
            plannedMinutes: minutesSchema,
            keySignature: {
              anyOf: [{ type: "string", maxLength: 20 }, { type: "null" }],
            },
            hostWords: {
              type: "object",
              maxProperties: 10,
              additionalProperties: { type: "string", maxLength: 2000 },
            },
            ledBy: {
              anyOf: [{ type: "string", maxLength: 20 }, { type: "null" }],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      const { id, entryId } = request.params;
      const result = changeEntry(db, id, entryId, request.body, who);
      if (result === false) return notFound(reply);
      if (result !== true) return reply.code(400).send(result);
      changed(request.params.slug, id);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: EntryParams; Body: { after: string | null } }>(
    "/api/communities/:slug/playlists/:id/entries/:entryId/move",
    {
      schema: {
        body: {
          type: "object",
          required: ["after"],
          additionalProperties: false,
          properties: {
            after: { anyOf: [{ type: "null" }, { type: "string" }] },
          },
        },
      },
    },
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      const { id, entryId } = request.params;
      if (!moveEntry(db, id, entryId, request.body.after, who))
        return notFound(reply);
      changed(request.params.slug, id);
      return reply.code(204).send();
    },
  );

  app.delete<{ Params: EntryParams }>(
    "/api/communities/:slug/playlists/:id/entries/:entryId",
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      const { id, entryId } = request.params;
      if (!removeEntry(db, id, entryId, who)) return notFound(reply);
      changed(request.params.slug, id);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: EntryParams }>(
    "/api/communities/:slug/playlists/:id/entries/:entryId/restore",
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      const { id, entryId } = request.params;
      if (!restoreEntry(db, id, entryId, who)) return notFound(reply);
      changed(request.params.slug, id);
      return reply.code(204).send();
    },
  );
}
