import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import type { Community } from "../songs/search.js";
import { publicTheme, themeOf } from "../theme.js";

/** What the welcome screen shows of the community. */
export type Welcome = {
  name: string;
  logo: string | null;
  /** Short Markdown texts, shown one after another. */
  announcements: string[];
};

/**
 * The welcome screen's content: public, like what's live, for the projectors; owners
 * write its announcements.
 */
export function attachWelcome(
  app: FastifyInstance,
  {
    db,
    findCommunity,
  }: {
    db: Db;
    findCommunity: (
      slug: string,
    ) => (Community & { slug: string; name: string }) | undefined;
  },
) {
  const announcementsOf = (communityId: string) =>
    JSON.parse(
      (db
        .prepare("SELECT welcome FROM communities WHERE id = ?")
        .pluck()
        .get(communityId) as string | null) ?? "[]",
    ) as string[];

  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug/welcome",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      return {
        name: community.name,
        logo:
          publicTheme(themeOf(db, community.id), community.slug).logo ?? null,
        announcements: announcementsOf(community.id),
      } satisfies Welcome;
    },
  );

  app.put<{ Params: { slug: string }; Body: { announcements: string[] } }>(
    "/api/communities/:slug/welcome",
    {
      schema: {
        body: {
          type: "object",
          required: ["announcements"],
          additionalProperties: false,
          properties: {
            announcements: {
              type: "array",
              maxItems: 10,
              items: { type: "string", maxLength: 500 },
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
      const announcements = request.body.announcements
        .map((a) => a.trim())
        .filter(Boolean);
      db.prepare(
        "UPDATE communities SET welcome = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      ).run(
        JSON.stringify(announcements),
        new Date().toISOString(),
        userId,
        community.id,
      );
      return { announcements };
    },
  );
}
