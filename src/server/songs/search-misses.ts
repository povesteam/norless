import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";
import { type Community, search } from "./search.js";

/** A search as counted: without case, diacritics or extra spaces. */
export const foldQuery = (q: string) =>
  q
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

/** Whether the search finds a song or a Bible passage: then it's no miss. */
const finds = (db: Db, community: Community, q: string) =>
  search(db, community, q).some((r) => r.type === "song" || r.type === "bible");

/** What was looked for and not found, in the last 90 days, most often first. */
export type Miss = { query: string; times: number; last: string };

/** At most this many searches recorded from one address per hour. */
const PER_HOUR = 30;

/**
 * Searches that found nothing: the search box sends one when it
 * closes on a search without songs; editors and owners read them, the ones that find
 * a song by now left out. Who searched isn't kept.
 */
export function attachSearchMisses(
  app: FastifyInstance,
  {
    db,
    findCommunity,
  }: { db: Db; findCommunity: (slug: string) => Community | undefined },
) {
  // ponytail: in memory per address, reset every hour; enough against a stuck client.
  const recent = new Map<string, number>();
  const reset = setInterval(() => recent.clear(), 3_600_000);
  reset.unref();

  app.post<{ Params: { slug: string }; Body: { q: string } }>(
    "/api/communities/:slug/search-misses",
    {
      schema: {
        body: {
          type: "object",
          required: ["q"],
          additionalProperties: false,
          properties: { q: { type: "string", minLength: 3, maxLength: 100 } },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const used = (recent.get(request.ip) ?? 0) + 1;
      recent.set(request.ip, used);
      if (used > PER_HOUR) return reply.code(429).send({ error: "Too many" });
      const query = request.body.q.trim().replace(/\s+/g, " ");
      const folded = foldQuery(query);
      if (folded.length < 3 || finds(db, community, query))
        return reply.code(204).send();
      db.prepare(
        "INSERT INTO search_misses (id, community_id, query, folded, at) VALUES (?, ?, ?, ?, ?)",
      ).run(newId(), community.id, query, folded, new Date().toISOString());
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug/search-misses",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      if (!requireRole(db, request, reply, community.id, ["editor", "owner"]))
        return;
      const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
      const rows = db
        .prepare(
          `SELECT (SELECT query FROM search_misses l WHERE l.community_id = m.community_id
                     AND l.folded = m.folded ORDER BY at DESC LIMIT 1) AS query,
             count(*) AS times, max(at) AS last
           FROM search_misses m WHERE community_id = ? AND at >= ?
           GROUP BY folded ORDER BY times DESC, last DESC LIMIT 50`,
        )
        .all(community.id, since) as Miss[];
      // A song added since finds it: no longer missing.
      return rows.filter((m) => !finds(db, community, m.query));
    },
  );
}
