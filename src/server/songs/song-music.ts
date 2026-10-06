import { mergeText, type Music } from "../../shared/music/chord-track.js";
import type { FastifyInstance, FastifyReply } from "fastify";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";
import type { Community } from "./search.js";
import { type Edit, keepRevision, storeMusic } from "./song-saves.js";
import {
  type Conflict,
  getSong,
  type ReferenceLink,
  type Song,
} from "./songs.js";

/**
 * A track as the server accepts it, sizes bounded. Rows are one loose object (a chord
 * row over a line, or a raw row), since Fastify drops unknown fields while trying each
 * branch of an anyOf.
 */
const chordsSchema = {
  type: "object",
  required: ["lines", "rows"],
  additionalProperties: false,
  properties: {
    lines: { type: "integer", minimum: 0, maximum: 500 },
    rows: {
      type: "array",
      maxItems: 500,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          line: { type: "integer", minimum: 0, maximum: 500 },
          chords: {
            type: "array",
            maxItems: 100,
            items: {
              type: "object",
              required: ["at", "name"],
              additionalProperties: false,
              properties: {
                at: { type: "integer", minimum: -100, maximum: 2000 },
                name: { type: "string", maxLength: 40 },
              },
            },
          },
          bars: {
            type: "array",
            maxItems: 100,
            items: { type: "integer", minimum: -100, maximum: 2000 },
          },
          over: { type: "integer", minimum: 0, maximum: 2000 },
          lead: { type: "integer", minimum: 0, maximum: 1 },
          before: { type: "integer", minimum: 0, maximum: 500 },
          raw: { type: "string", maxLength: 2000 },
        },
      },
    },
  },
} as const;
const musicSchema = {
  type: "object",
  required: ["patterns", "sections", "parts"],
  additionalProperties: false,
  properties: {
    patterns: {
      type: "object",
      maxProperties: 20,
      additionalProperties: chordsSchema,
    },
    sections: {
      type: "object",
      maxProperties: 300,
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        properties: {
          follows: {
            // Boolean first: coercion would make false the string "false".
            anyOf: [{ type: "boolean" }, { type: "string", maxLength: 40 }],
          },
          own: chordsSchema,
          extras: {
            type: "array",
            maxItems: 50,
            items: {
              type: "object",
              required: ["before", "raw"],
              additionalProperties: false,
              properties: {
                before: { type: "integer", minimum: 0, maximum: 500 },
                raw: { type: "string", maxLength: 10_000 },
              },
            },
          },
        },
      },
    },
    parts: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["after", "text"],
        additionalProperties: false,
        properties: {
          after: {
            // Null first: coercion would make null an empty string.
            anyOf: [{ type: "null" }, { type: "string", maxLength: 40 }],
          },
          text: { type: "string", maxLength: 10_000 },
        },
      },
    },
  },
} as const;

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** The conflict of a track someone else changed meanwhile, in the first version's words. */
const musicConflict = (song: Song, mine: Music): { conflict: Conflict } => {
  const first = song.versions[0];
  return {
    conflict: {
      language: first?.language ?? "",
      theirs: first?.text ?? "",
      mine: mergeText(first?.lyrics ?? "", mine),
    },
  };
};

/**
 * Saves a song's chords, bar lines, notes and notation, for every language
 *: the lyrics can't change here, and it's a conflict when someone
 * else changed the track meanwhile.
 */
export function updateMusic(
  db: Db,
  id: string,
  change: { base: Music; music: Music },
  edit: Edit,
): Song | { conflict: Conflict } | null {
  const at = (edit.now ?? new Date()).toISOString();
  return db.transaction(() => {
    const song = getSong(db, edit.communityId, id);
    if (!song || song.deletedAt) return null;
    if (!same(song.music, change.base) && !same(song.music, change.music))
      return musicConflict(song, change.music);
    keepRevision(db, id, edit, at);
    storeMusic(db, id, change.music, edit, at);
    db.prepare(
      "UPDATE songs SET updated_at = ?, updated_by = ? WHERE id = ?",
    ).run(at, edit.userId, id);
    return getSong(db, edit.communityId, id);
  })();
}

/**
 * Changes a song's key with its chords moved: the browser
 * transposes the track, notation included.
 */
export function setKey(
  db: Db,
  id: string,
  change: { keySignature: string; base: Music; music: Music },
  edit: Edit,
): Song | { conflict: Conflict } | null {
  const at = (edit.now ?? new Date()).toISOString();
  return db.transaction(() => {
    const song = getSong(db, edit.communityId, id);
    if (!song || song.deletedAt) return null;
    if (!same(song.music, change.base) && !same(song.music, change.music))
      return musicConflict(song, change.music);
    keepRevision(db, id, edit, at);
    storeMusic(db, id, change.music, edit, at);
    db.prepare(
      "UPDATE songs SET key_signature = ?, updated_at = ?, updated_by = ? WHERE id = ?",
    ).run(change.keySignature.trim(), at, edit.userId, id);
    return getSong(db, edit.communityId, id);
  })();
}

export function setTempo(
  db: Db,
  id: string,
  bpm: number | null,
  edit: Edit,
): Song | null {
  const at = (edit.now ?? new Date()).toISOString();
  return db.transaction(() => {
    const song = getSong(db, edit.communityId, id);
    if (!song || song.deletedAt) return null;
    keepRevision(db, id, edit, at);
    db.prepare(
      "UPDATE songs SET bpm = ?, updated_at = ?, updated_by = ? WHERE id = ?",
    ).run(bpm, at, edit.userId, id);
    return getSong(db, edit.communityId, id);
  })();
}

/** Sets the recordings to learn a song from, in order; kept in revisions. */
export function setReferenceLinks(
  db: Db,
  id: string,
  links: ReferenceLink[],
  edit: Edit,
): Song | null {
  const at = (edit.now ?? new Date()).toISOString();
  return db.transaction(() => {
    const song = getSong(db, edit.communityId, id);
    if (!song || song.deletedAt) return null;
    keepRevision(db, id, edit, at);
    db.prepare(
      "UPDATE songs SET reference_links = ?, updated_at = ?, updated_by = ? WHERE id = ?",
    ).run(JSON.stringify(links), at, edit.userId, id);
    return getSong(db, edit.communityId, id);
  })();
}

/**
 * The routes for what the team sets besides editors: a song's track, tempo, key and
 * recordings, and tempo checks.
 */
export function attachSongMusic(
  app: FastifyInstance,
  {
    db,
    findCommunity,
    answer,
  }: {
    db: Db;
    findCommunity: (slug: string) => Community | undefined;
    answer: (
      id: string,
      result: Song | { conflict: Conflict } | null,
      reply: FastifyReply,
    ) => unknown;
  },
) {
  type Params = { slug: string; id: string };

  // The chords, notes and notation of every language, for the team and editors
  //.
  app.put<{ Params: Params; Body: { base: Music; music: Music } }>(
    "/api/communities/:slug/songs/:id/music",
    {
      schema: {
        body: {
          type: "object",
          required: ["base", "music"],
          additionalProperties: false,
          properties: { base: musicSchema, music: musicSchema },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, [
        "team",
        "editor",
      ]);
      if (!userId) return reply;
      const { id } = request.params;
      return answer(
        id,
        updateMusic(db, id, request.body, {
          communityId: community.id,
          userId,
        }),
        reply,
      );
    },
  );

  app.put<{ Params: Params; Body: { bpm: number | null } }>(
    "/api/communities/:slug/songs/:id/tempo",
    {
      schema: {
        body: {
          type: "object",
          required: ["bpm"],
          additionalProperties: false,
          properties: {
            bpm: {
              anyOf: [
                { type: "integer", minimum: 30, maximum: 300 },
                { type: "null" },
              ],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, [
        "team",
        "editor",
      ]);
      if (!userId) return reply;
      const { id } = request.params;
      return answer(
        id,
        setTempo(db, id, request.body.bpm, {
          communityId: community.id,
          userId,
        }),
        reply,
      );
    },
  );

  app.put<{
    Params: Params;
    Body: { keySignature: string; base: Music; music: Music };
  }>(
    "/api/communities/:slug/songs/:id/key",
    {
      schema: {
        body: {
          type: "object",
          required: ["keySignature", "base", "music"],
          additionalProperties: false,
          properties: {
            keySignature: { type: "string", maxLength: 20 },
            base: musicSchema,
            music: musicSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, [
        "team",
        "editor",
      ]);
      if (!userId) return reply;
      const { id } = request.params;
      return answer(
        id,
        setKey(db, id, request.body, { communityId: community.id, userId }),
        reply,
      );
    },
  );

  // The recordings to learn a song from, with their titles and pictures.
  app.put<{ Params: Params; Body: { links: ReferenceLink[] } }>(
    "/api/communities/:slug/songs/:id/reference-links",
    {
      schema: {
        body: {
          type: "object",
          required: ["links"],
          additionalProperties: false,
          properties: {
            links: {
              type: "array",
              maxItems: 10,
              items: {
                type: "object",
                required: ["url", "title", "site", "image"],
                additionalProperties: false,
                properties: {
                  url: {
                    type: "string",
                    maxLength: 500,
                    pattern: "^https://[^\\s]+$",
                  },
                  title: { type: "string", maxLength: 200 },
                  site: { type: "string", maxLength: 100 },
                  image: {
                    anyOf: [
                      { type: "string", pattern: "^[0-9A-Za-z]{12}$" },
                      { type: "null" },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, [
        "team",
        "editor",
      ]);
      if (!userId) return reply;
      const links = request.body.links.map((l) => ({
        ...l,
        title: l.title.trim(),
        site: l.site.trim(),
      }));
      const known = db.prepare("SELECT 1 FROM images WHERE id = ?");
      if (links.some((l) => l.image && !known.get(l.image)))
        return reply.code(400).send({ error: "No such image" });
      const { id } = request.params;
      return answer(
        id,
        setReferenceLinks(db, id, links, { communityId: community.id, userId }),
        reply,
      );
    },
  );

  app.post<{ Params: Params; Body: { bpm: number } }>(
    "/api/communities/:slug/songs/:id/tempo-checks",
    {
      schema: {
        body: {
          type: "object",
          required: ["bpm"],
          additionalProperties: false,
          properties: { bpm: { type: "integer", minimum: 30, maximum: 300 } },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "team");
      if (!userId) return reply;
      if (!getSong(db, community.id, request.params.id))
        return reply.code(404).send({ error: "Not found" });
      db.prepare(
        "INSERT INTO tempo_checks (id, community_id, song_id, bpm, measured_at, created_by) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(
        newId(),
        community.id,
        request.params.id,
        request.body.bpm,
        new Date().toISOString(),
        userId,
      );
      return reply.code(204).send();
    },
  );
}
