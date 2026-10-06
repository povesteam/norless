import { randomInt } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import type { Community } from "../songs/search.js";

/** Letters and digits that can't be mistaken for each other (no 0 O o 1 l I). */
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const kinds = {
  playlist: "playlists",
  song: "songs",
  screen: "screens",
} as const;
type Kind = keyof typeof kinds;

/** Where a code leads: a screen by its secret, the others by id in their community. */
const pathOf = (kind: Kind, slug: string, target: string) =>
  kind === "screen" ? `/s/${target}` : `/${slug}/${kinds[kind]}/${target}`;

/**
 * A new code: 6 characters (3 were too short), 7 once 6 keep
 * colliding. Every code has a digit, so it's never a word like /pair or /login; a path
 * that isn't a code is served as the app, so a community slug that looks like one works.
 */
export function newCode(taken: (code: string) => boolean): string {
  const pick = (from: string) => from[randomInt(from.length)] ?? "";
  for (let attempt = 0; ; attempt++) {
    const chars = Array.from({ length: attempt < 20 ? 6 : 7 }, () =>
      pick(ALPHABET),
    );
    // One place gets a digit, so the code isn't a word.
    chars[randomInt(chars.length)] = pick(DIGITS);
    const code = chars.join("");
    if (!taken(code)) return code;
  }
}

/**
 * The short code of a playlist, song or screen (by its secret), made the first time;
 * `made` says whether it was just made.
 */
export function shortCode(
  db: Db,
  communityId: string,
  kind: Kind,
  id: string,
): { code: string; made: boolean } {
  const known = db
    .prepare("SELECT code FROM short_codes WHERE kind = ? AND target_id = ?")
    .pluck()
    .get(kind, id) as string | undefined;
  if (known) return { code: known, made: false };
  const taken = db.prepare("SELECT 1 FROM short_codes WHERE code = ?").pluck();
  const code = newCode((c) => taken.get(c) !== undefined);
  db.prepare(
    "INSERT INTO short_codes (code, community_id, kind, target_id, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(code, communityId, kind, id, new Date().toISOString());
  return { code, made: true };
}

/**
 * Short codes for playlists, songs and screens: made on first share, and redirecting
 * for good. A screen's code is made from its secret, so a new secret retires it.
 */
export function attachShortCodes(
  app: FastifyInstance,
  {
    db,
    findCommunity,
    notFound,
  }: {
    db: Db;
    findCommunity: (slug: string) => Community | undefined;
    /** Answers a path that isn't a known code, as any other unknown page. */
    notFound: (reply: FastifyReply) => unknown;
  },
) {
  // Anyone who can read a playlist or song can share it; the team shares screens.
  app.post<{ Params: { slug: string }; Body: { kind: Kind; id: string } }>(
    "/api/communities/:slug/short-codes",
    {
      schema: {
        body: {
          type: "object",
          required: ["kind", "id"],
          properties: {
            kind: { enum: Object.keys(kinds) },
            id: { type: "string", maxLength: 64 },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const { kind, id } = request.body;
      if (
        kind === "screen" &&
        !requireRole(db, request, reply, community.id, "team")
      )
        return reply;
      const exists = db
        .prepare(
          `SELECT 1 FROM ${kinds[kind]} WHERE ${kind === "screen" ? "secret" : "id"} = ? AND community_id = ? AND deleted_at IS NULL`,
        )
        .get(id, community.id);
      if (!exists) return reply.code(404).send({ error: "Not found" });
      const { code, made } = shortCode(db, community.id, kind, id);
      return reply.code(made ? 201 : 200).send({ code });
    },
  );

  app.get<{ Params: { code: string } }>(
    // 3 and 4 characters too, the length of the first codes.
    "/:code(^[2-9a-zA-Z]{3,7}$)",
    async (request, reply) => {
      const row = db
        .prepare(
          `SELECT s.kind, s.target_id, c.slug FROM short_codes s
           JOIN communities c ON c.id = s.community_id WHERE s.code = ?`,
        )
        .get(request.params.code) as
        { kind: Kind; target_id: string; slug: string } | undefined;
      if (!row) return notFound(reply);
      return reply.redirect(pathOf(row.kind, row.slug, row.target_id));
    },
  );
}
