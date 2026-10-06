import type { FastifyInstance } from "fastify";
import type { Instrument } from "../../shared/preferences.js";
import { requireRole } from "../auth/auth.js";
import { isMember } from "../auth/members.js";
import { newId } from "../ids.js";
import type { Params, TeamData } from "./team-data.js";

/** The roles, who's marked for them, and the slots weekly events start from. */
export function attachTeamRoles(
  app: FastifyInstance,
  { db, now, communityFor, rolesOf, eventsOf }: TeamData,
) {
  // Owners edit the roles: the whole list, in order.
  app.put<{
    Params: Params;
    Body: {
      roles: {
        id?: string;
        name: string;
        instrument: Instrument | null;
        leads?: boolean;
      }[];
    };
  }>(
    "/api/communities/:slug/service-roles",
    {
      schema: {
        body: {
          type: "object",
          required: ["roles"],
          additionalProperties: false,
          properties: {
            roles: {
              type: "array",
              maxItems: 50,
              items: {
                type: "object",
                required: ["name", "instrument"],
                additionalProperties: false,
                properties: {
                  id: { type: "string", maxLength: 20 },
                  name: { type: "string", minLength: 1, maxLength: 60 },
                  leads: { type: "boolean" },
                  instrument: {
                    enum: [
                      "guitar",
                      "keys",
                      "bass",
                      "drums",
                      "vocals",
                      "other",
                      null,
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
      const community = communityFor(request, reply);
      if (!community) return reply;
      const userId = requireRole(db, request, reply, community.id, "owner");
      if (!userId) return reply;
      const at = now().toISOString();
      rolesOf(community.id);
      db.transaction(() => {
        const kept = new Set<string>();
        request.body.roles.forEach((role, position) => {
          const name = role.name.trim();
          const known =
            role.id &&
            db
              .prepare(
                "SELECT 1 FROM service_roles WHERE id = ? AND community_id = ?",
              )
              .get(role.id, community.id);
          if (known && role.id) {
            kept.add(role.id);
            db.prepare(
              "UPDATE service_roles SET name = ?, instrument = ?, leads = ?, position = ?, deleted_at = NULL, updated_at = ?, updated_by = ? WHERE id = ?",
            ).run(
              name,
              role.instrument,
              role.leads ? 1 : 0,
              position,
              at,
              userId,
              role.id,
            );
          } else {
            const id = newId();
            kept.add(id);
            db.prepare(
              "INSERT INTO service_roles (id, community_id, name, instrument, leads, position, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ).run(
              id,
              community.id,
              name,
              role.instrument,
              role.leads ? 1 : 0,
              position,
              at,
              at,
              userId,
              userId,
            );
          }
        });
        for (const { id } of db
          .prepare(
            "SELECT id FROM service_roles WHERE community_id = ? AND deleted_at IS NULL",
          )
          .all(community.id) as { id: string }[])
          if (!kept.has(id))
            db.prepare(
              "UPDATE service_roles SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE id = ?",
            ).run(at, at, userId, id);
      })();
      return rolesOf(community.id);
    },
  );

  // The team marks who does a role (instruments count by themselves).
  app.put<{ Params: Params & { role: string }; Body: { people: string[] } }>(
    "/api/communities/:slug/service-roles/:role/people",
    {
      schema: {
        body: {
          type: "object",
          required: ["people"],
          additionalProperties: false,
          properties: {
            people: {
              type: "array",
              maxItems: 500,
              items: { type: "string", maxLength: 20 },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const community = communityFor(request, reply);
      if (!community) return reply;
      const userId = requireRole(db, request, reply, community.id, "team");
      if (!userId) return reply;
      const { role } = request.params;
      if (
        !db
          .prepare(
            "SELECT 1 FROM service_roles WHERE id = ? AND community_id = ? AND deleted_at IS NULL",
          )
          .get(role, community.id)
      )
        return reply.code(404).send({ error: "No such role" });
      const at = now().toISOString();
      db.transaction(() => {
        db.prepare("DELETE FROM role_people WHERE role_id = ?").run(role);
        for (const person of new Set(request.body.people))
          if (isMember(db, community.id, person))
            db.prepare(
              "INSERT INTO role_people (id, community_id, role_id, user_id, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)",
            ).run(newId(), community.id, role, person, at, userId);
      })();
      return reply.code(204).send();
    },
  );

  // The team sets the slots a weekly event's dates start from.
  app.put<{
    Params: Params & { event: string };
    Body: { template: { roleId: string; count: number }[] };
  }>(
    "/api/communities/:slug/slot-templates/:event",
    {
      schema: {
        body: {
          type: "object",
          required: ["template"],
          additionalProperties: false,
          properties: {
            template: {
              type: "array",
              maxItems: 50,
              items: {
                type: "object",
                required: ["roleId", "count"],
                additionalProperties: false,
                properties: {
                  roleId: { type: "string", maxLength: 20 },
                  count: { type: "integer", minimum: 0, maximum: 20 },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const community = communityFor(request, reply);
      if (!community) return reply;
      const userId = requireRole(db, request, reply, community.id, "team");
      if (!userId) return reply;
      const { event } = request.params;
      if (
        !eventsOf(community.id).some(
          (e) => e.id === event && e.kind === "recurring",
        )
      )
        return reply.code(404).send({ error: "No such weekly event" });
      const roles = new Set(rolesOf(community.id).map((r) => r.id));
      const at = now().toISOString();
      db.transaction(() => {
        db.prepare("DELETE FROM slot_templates WHERE event_id = ?").run(event);
        for (const { roleId, count } of request.body.template)
          if (roles.has(roleId) && count > 0)
            db.prepare(
              "INSERT INTO slot_templates (id, community_id, event_id, role_id, count, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ).run(
              newId(),
              community.id,
              event,
              roleId,
              count,
              at,
              at,
              userId,
              userId,
            );
      })();
      return reply.code(204).send();
    },
  );
}
