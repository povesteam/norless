import type { FastifyInstance, FastifyReply } from "fastify";
import { requireRole } from "../auth/auth.js";
import { allows, isMember, memberRoles } from "../auth/members.js";
import { opinionsOf } from "./song-feedback.js";
import type { Db } from "../db/db.js";
import type { Live } from "../live/live.js";
import type { Community } from "./search.js";
import { restoreRevision, revisions } from "./song-history.js";
import { attachSongMusic } from "./song-music.js";
import {
  createSong,
  deleteSong,
  type SongInput,
  updateSection,
  updateSong,
} from "./song-saves.js";
import { type Conflict, getSong, people, type Song } from "./songs.js";

const versionSchema = {
  type: "object",
  required: ["language", "title", "text"],
  additionalProperties: false,
  properties: {
    language: { type: "string", maxLength: 10 },
    title: { type: "string", minLength: 1, maxLength: 200 },
    text: { type: "string", maxLength: 50_000 },
    baseText: { type: "string", maxLength: 50_000 },
  },
};
const songSchema = {
  type: "object",
  required: ["versions"],
  additionalProperties: false,
  properties: {
    keySignature: { type: "string", maxLength: 20 },
    timeSignature: { type: "string", maxLength: 10 },
    authors: { type: "string", maxLength: 300 },
    copyright: { type: "string", maxLength: 300 },
    sourceUrl: {
      anyOf: [
        { type: "string", maxLength: 500, pattern: "^(https://\\S+)?$" },
        { type: "null" },
      ],
    },
    tags: {
      type: "array",
      maxItems: 30,
      items: { type: "string", maxLength: 50 },
    },
    versions: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: versionSchema,
    },
  },
};

/** Why the versions can't be saved: a language the community doesn't have, or twice. */
function badLanguages(community: Community, versions: { language: string }[]) {
  const languages = versions.map((v) => v.language);
  const unknown = languages.find((l) => !community.languages.includes(l));
  if (unknown) return `The community has no language "${unknown}"`;
  if (new Set(languages).size < languages.length)
    return "One version per language";
  return null;
}

/**
 * Song routes: reading is public, changes need the editor role. Changes go live on
 * `song:<id>` without names, so members fetch the song again for those.
 */
export function attachSongs(
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
  const answer = (
    id: string,
    result: Song | { conflict: Conflict } | { refused: string } | null,
    reply: FastifyReply,
  ) => {
    if (result === null) return reply.code(404).send({ error: "Not found" });
    if ("conflict" in result) return reply.code(409).send(result);
    if ("refused" in result)
      return reply.code(400).send({ error: result.refused, refused: true });
    live.publish(`song:${id}`, result);
    return result;
  };

  app.get<{ Params: Params }>(
    "/api/communities/:slug/songs/:id",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      const song = community && getSong(db, community.id, request.params.id);
      if (!song) return reply.code(404).send({ error: "Not found" });
      // Visitors see no names, likes or dislikes.
      const user = request.user;
      if (!user || !isMember(db, community.id, user.id)) return song;
      const owner = allows(memberRoles(db, community.id, user.id), "owner");
      return {
        ...song,
        people: people(db, song.id),
        opinions: opinionsOf(db, song.id, user.id, owner),
      };
    },
  );

  // Tags in use, most used first, for suggestions in the editor.
  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug/tags",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      return db
        .prepare(
          `SELECT t.value AS tag, count(*) AS count FROM songs s, json_each(s.tags) t
           WHERE s.community_id = ? AND s.deleted_at IS NULL
           GROUP BY t.value ORDER BY count DESC, tag`,
        )
        .all(community.id);
    },
  );

  app.post<{ Params: { slug: string }; Body: SongInput }>(
    "/api/communities/:slug/songs",
    { schema: { body: songSchema } },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "editor");
      if (!userId) return reply;
      const bad = badLanguages(community, request.body.versions);
      if (bad) return reply.code(400).send({ error: bad });
      const song = createSong(db, request.body, {
        communityId: community.id,
        userId,
      });
      live.publish(`song:${song.id}`, song);
      return reply.code(201).send(song);
    },
  );

  app.put<{ Params: Params; Body: SongInput }>(
    "/api/communities/:slug/songs/:id",
    { schema: { body: songSchema } },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "editor");
      if (!userId) return reply;
      const bad = badLanguages(community, request.body.versions);
      if (bad) return reply.code(400).send({ error: bad });
      const { id } = request.params;
      return answer(
        id,
        updateSong(db, id, request.body, { communityId: community.id, userId }),
        reply,
      );
    },
  );

  app.put<{
    Params: Params & { language: string; index: number };
    Body: { baseText: string; text: string };
  }>(
    "/api/communities/:slug/songs/:id/versions/:language/sections/:index",
    {
      schema: {
        params: {
          type: "object",
          properties: { index: { type: "integer", minimum: 0 } },
        },
        body: {
          type: "object",
          required: ["baseText", "text"],
          additionalProperties: false,
          properties: {
            baseText: { type: "string", maxLength: 50_000 },
            text: { type: "string", maxLength: 50_000 },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "editor");
      if (!userId) return reply;
      const { id, language, index } = request.params;
      return answer(
        id,
        updateSection(db, id, language, index, request.body, {
          communityId: community.id,
          userId,
        }),
        reply,
      );
    },
  );

  attachSongMusic(app, { db, findCommunity, answer });

  // The history, for members, since it names who saved.
  app.get<{ Params: Params }>(
    "/api/communities/:slug/songs/:id/revisions",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      if (!request.user) return reply.code(401).send({ error: "Log in first" });
      if (!isMember(db, community.id, request.user.id))
        return reply.code(403).send({ error: "Members only" });
      return revisions(db, community.id, request.params.id);
    },
  );

  app.post<{ Params: Params & { revision: string } }>(
    "/api/communities/:slug/songs/:id/revisions/:revision/restore",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "editor");
      if (!userId) return reply;
      const { id, revision } = request.params;
      return answer(
        id,
        restoreRevision(db, id, revision, {
          communityId: community.id,
          userId,
        }),
        reply,
      );
    },
  );

  app.delete<{ Params: Params }>(
    "/api/communities/:slug/songs/:id",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "editor");
      if (!userId) return reply;
      const { id } = request.params;
      if (!deleteSong(db, id, { communityId: community.id, userId }))
        return reply.code(404).send({ error: "Not found" });
      live.publish(`song:${id}`, getSong(db, community.id, id));
      return reply.code(204).send();
    },
  );
}
