import type { FastifyInstance } from "fastify";
import { featureNames, planned, switchable } from "../../shared/features.js";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";
import { allows, isMember, memberRoles } from "../auth/members.js";
import type { Community } from "../songs/search.js";

/** The requests for each feature, as one member sees them; owners also see who. */
export type FeatureRequests = {
  counts: Record<string, number>;
  /** The member's own requests, with their notes. */
  mine: Record<string, string>;
  /** Owners only: who asked for each feature, with their notes, oldest first. */
  who?: Record<string, { name: string; note: string; at: string }[]>;
};

/** Features that can be asked for: those an owner switches, and the planned ones. */
const requestable = [
  ...featureNames.filter(switchable),
  ...Object.keys(planned),
] as string[];

/** Requests of members still in the community. */
const counted = `FROM feature_requests r
  JOIN members m ON m.user_id = r.user_id AND m.community_id = r.community_id
    AND m.status = 'active' AND m.deleted_at IS NULL`;

export function requestsOf(
  db: Db,
  communityId: string,
  userId: string,
  owner: boolean,
): FeatureRequests {
  const counts = Object.fromEntries(
    (
      db
        .prepare(
          `SELECT r.feature, count(*) AS n ${counted} WHERE r.community_id = ? GROUP BY r.feature`,
        )
        .all(communityId) as { feature: string; n: number }[]
    ).map((r) => [r.feature, r.n]),
  );
  const mine = Object.fromEntries(
    (
      db
        .prepare(
          "SELECT feature, note FROM feature_requests WHERE community_id = ? AND user_id = ?",
        )
        .all(communityId, userId) as { feature: string; note: string }[]
    ).map((r) => [r.feature, r.note]),
  );
  if (!owner) return { counts, mine };
  const who: NonNullable<FeatureRequests["who"]> = {};
  for (const r of db
    .prepare(
      `SELECT r.feature, nullif(u.display_name, '') AS name, r.note, r.updated_at AS at
       ${counted} JOIN users u ON u.id = r.user_id
       WHERE r.community_id = ? ORDER BY r.created_at`,
    )
    .all(communityId) as {
    feature: string;
    name: string | null;
    note: string;
    at: string;
  }[])
    (who[r.feature] ??= []).push({
      name: r.name ?? "",
      note: r.note,
      at: r.at,
    });
  return { counts, mine, who };
}

/**
 * Members ask the owners to switch a feature on, or for a planned one
 *; everyone sees how many asked, owners see who.
 */
export function attachFeatureRequests(
  app: FastifyInstance,
  {
    db,
    findCommunity,
  }: { db: Db; findCommunity: (slug: string) => Community | undefined },
) {
  type Params = { slug: string; feature?: string };
  /** The member asking, or the reply already sent. */
  const memberOf = (
    request: { user?: { id: string; device?: unknown } | null },
    communityId: string,
  ) => {
    const user = request.user;
    if (!user) return 401;
    // People, not the community's laptop or a guest's phone.
    if (user.device || !isMember(db, communityId, user.id)) return 403;
    return user.id;
  };
  const answer = (communityId: string, userId: string) =>
    requestsOf(
      db,
      communityId,
      userId,
      allows(memberRoles(db, communityId, userId), "owner"),
    );

  app.get<{ Params: Params }>(
    "/api/communities/:slug/feature-requests",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const member = memberOf(request, community.id);
      if (typeof member === "number")
        return reply.code(member).send({ error: "Members only" });
      return answer(community.id, member);
    },
  );

  app.put<{ Params: Params; Body: { note?: string } }>(
    "/api/communities/:slug/feature-requests/:feature",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            slug: { type: "string" },
            feature: { enum: requestable },
          },
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: { note: { type: "string", maxLength: 500 } },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const member = memberOf(request, community.id);
      if (typeof member === "number")
        return reply.code(member).send({ error: "Members only" });
      const at = new Date().toISOString();
      db.prepare(
        `INSERT INTO feature_requests (id, community_id, user_id, feature, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (community_id, user_id, feature) DO UPDATE SET
           note = excluded.note, updated_at = excluded.updated_at`,
      ).run(
        newId(),
        community.id,
        member,
        request.params.feature,
        (request.body?.note ?? "").trim(),
        at,
        at,
      );
      return answer(community.id, member);
    },
  );

  app.delete<{ Params: Params }>(
    "/api/communities/:slug/feature-requests/:feature",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const member = memberOf(request, community.id);
      if (typeof member === "number")
        return reply.code(member).send({ error: "Members only" });
      db.prepare(
        "DELETE FROM feature_requests WHERE community_id = ? AND user_id = ? AND feature = ?",
      ).run(community.id, member, request.params.feature);
      return answer(community.id, member);
    },
  );
}
