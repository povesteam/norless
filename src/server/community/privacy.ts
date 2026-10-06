import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import type { Community } from "../songs/search.js";

/** Who answers for a community's personal data. */
export type PrivacyContact = {
  name?: string;
  address?: string;
  email?: string;
};

const text = (maxLength: number) => ({ type: "string", maxLength }) as const;

/**
 * The privacy notice's facts: each community's responsible party, from its settings,
 * and the operator and the services it uses, from the server's settings (OPERATOR and
 * PRIVACY_SERVICES), since they depend on who runs this copy of Norless.
 */
export function attachPrivacy(
  app: FastifyInstance,
  {
    db,
    findCommunity,
    operator,
    services,
  }: {
    db: Db;
    findCommunity: (slug: string) => Community | undefined;
    operator: string | null;
    services: string[];
  },
) {
  app.get("/api/privacy", async () => ({
    operator,
    services,
    communities: (
      db
        .prepare(
          "SELECT name, slug, privacy FROM communities WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE",
        )
        .all() as { name: string; slug: string; privacy: string }[]
    ).map(({ privacy, ...community }) => ({
      ...community,
      contact: JSON.parse(privacy) as PrivacyContact,
    })),
  }));

  app.put<{ Params: { slug: string }; Body: PrivacyContact }>(
    "/api/communities/:slug/privacy",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: text(200),
            address: text(300),
            email: {
              type: "string",
              maxLength: 320,
              pattern: "^$|^[^@\\s]+@[^@\\s]+$",
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
      const contact = Object.fromEntries(
        Object.entries(request.body)
          .map(([key, value]) => [key, value.trim()])
          .filter(([, value]) => value),
      );
      db.prepare(
        "UPDATE communities SET privacy = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      ).run(
        JSON.stringify(contact),
        new Date().toISOString(),
        userId,
        community.id,
      );
      return reply.code(204).send();
    },
  );
}
