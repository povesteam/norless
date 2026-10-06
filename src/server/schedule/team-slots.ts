import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireRole } from "../auth/auth.js";
import { isMember } from "../auth/members.js";
import { newId } from "../ids.js";
import { keyOf, type Params } from "./team-data.js";
import type { Team } from "./team-notifications.js";

/** A date's slots: asking people, their answers, sign-ups and offers. */
export function attachTeamSlots(
  app: FastifyInstance,
  {
    db,
    now,
    communityFor,
    memberFor,
    occurrence,
    build,
    slotRow,
    setSlot,
    rolesOf,
    when,
    tell,
    tellOpen,
    nameOf,
    roleName,
  }: Team,
) {
  type SlotParams = Params & { event: string; date: string; key: string };
  const slotPath =
    "/api/communities/:slug/team-schedule/:event/:date/slots/:key";
  /** The occurrence and its slot, for a slot route, built from the template if needed. */
  const slotFor = (
    request: FastifyRequest,
    reply: FastifyReply,
    communityId: string,
    by: string,
  ) => {
    const { event, date, key } = request.params as SlotParams;
    const e = occurrence(communityId, event, date);
    if (!e) {
      void reply.code(404).send({ error: "No such date" });
      return null;
    }
    build(communityId, event, date, by);
    const slot = slotRow(event, date, key);
    if (!slot) {
      void reply.code(404).send({ error: "No such slot" });
      return null;
    }
    const builtBy = db
      .prepare(
        "SELECT built_by FROM schedule_dates WHERE event_id = ? AND date = ?",
      )
      .pluck()
      .get(event, date) as string | null;
    return { e, slot, builtBy, event, date, key };
  };
  const whenFor = (communityId: string, e: { start: Date; name: string }) =>
    when(communityId, e.start, e.name);

  // The team puts someone in a slot, or empties it.
  app.post<{ Params: SlotParams; Body: { userId: string | null } }>(
    `${slotPath}/assign`,
    {
      schema: {
        body: {
          type: "object",
          required: ["userId"],
          additionalProperties: false,
          properties: {
            userId: {
              // Null first: coercion would make null an empty string.
              anyOf: [{ type: "null" }, { type: "string", maxLength: 20 }],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const community = communityFor(request, reply);
      if (!community) return reply;
      const by = requireRole(db, request, reply, community.id, "team");
      if (!by) return reply;
      const { userId } = request.body;
      if (userId && !isMember(db, community.id, userId))
        return reply.code(400).send({ error: "Not a member" });
      const found = db.transaction(() => {
        const at = slotFor(request, reply, community.id, by);
        if (!at) return null;
        const before = at.slot.userId;
        setSlot(
          at.slot.id,
          userId,
          userId === null ? "open" : userId === by ? "accepted" : "asked",
          by,
        );
        const data = {
          eventId: at.event,
          date: at.date,
          role: roleName(at.slot.roleId),
          when: whenFor(community.id, at.e),
        };
        if (before && before !== userId && before !== by)
          tell(
            community.id,
            before,
            "unassigned",
            `${at.event}|${at.date}|${at.key}`,
            data,
          );
        if (userId && userId !== by && userId !== before)
          tell(
            community.id,
            userId,
            "assigned",
            `${at.event}|${at.date}|${at.key}`,
            {
              ...data,
              key: at.key,
            },
          );
        return at;
      })();
      if (!found) return reply;
      if (userId === null)
        tellOpen(community.id, found.event, found.date, found.slot.roleId);
      // Away that day: the team sees it, and the assignment stands.
      const away =
        userId &&
        db
          .prepare(
            "SELECT 1 FROM away_dates WHERE community_id = ? AND user_id = ? AND first_date <= ? AND last_date >= ?",
          )
          .get(community.id, userId, found.date, found.date);
      return { away: !!away };
    },
  );

  // The team adds a slot to a date, or takes one away.
  app.post<{
    Params: Params & { event: string; date: string };
    Body: { roleId: string };
  }>(
    "/api/communities/:slug/team-schedule/:event/:date/slots",
    {
      schema: {
        body: {
          type: "object",
          required: ["roleId"],
          additionalProperties: false,
          properties: { roleId: { type: "string", maxLength: 20 } },
        },
      },
    },
    async (request, reply) => {
      const community = communityFor(request, reply);
      if (!community) return reply;
      const by = requireRole(db, request, reply, community.id, "team");
      if (!by) return reply;
      const { event, date } = request.params;
      if (!occurrence(community.id, event, date))
        return reply.code(404).send({ error: "No such date" });
      if (!rolesOf(community.id).some((r) => r.id === request.body.roleId))
        return reply.code(400).send({ error: "No such role" });
      build(community.id, event, date, by);
      const position =
        ((db
          .prepare(
            "SELECT max(position) FROM slots WHERE event_id = ? AND date = ? AND role_id = ?",
          )
          .pluck()
          .get(event, date, request.body.roleId) as number | null) ?? -1) + 1;
      const at = now().toISOString();
      db.prepare(
        `INSERT INTO slots (id, community_id, event_id, date, role_id, user_id, status, position, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, NULL, 'open', ?, ?, ?, ?, ?)`,
      ).run(
        newId(),
        community.id,
        event,
        date,
        request.body.roleId,
        position,
        at,
        at,
        by,
        by,
      );
      return { key: keyOf(request.body.roleId, position) };
    },
  );
  app.delete<{ Params: SlotParams }>(slotPath, async (request, reply) => {
    const community = communityFor(request, reply);
    if (!community) return reply;
    const by = requireRole(db, request, reply, community.id, "team");
    if (!by) return reply;
    const at = slotFor(request, reply, community.id, by);
    if (!at) return reply;
    db.prepare(
      "UPDATE slots SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE id = ?",
    ).run(now().toISOString(), now().toISOString(), by, at.slot.id);
    if (at.slot.userId && at.slot.userId !== by)
      tell(
        community.id,
        at.slot.userId,
        "unassigned",
        `${at.event}|${at.date}|${at.key}`,
        {
          eventId: at.event,
          date: at.date,
          role: roleName(at.slot.roleId),
          when: whenFor(community.id, at.e),
        },
      );
    return reply.code(204).send();
  });

  // The person in a slot accepts it, or declines with a reason: it opens again.
  app.post<{ Params: SlotParams; Body: { accept: boolean; reason?: string } }>(
    `${slotPath}/answer`,
    {
      schema: {
        body: {
          type: "object",
          required: ["accept"],
          additionalProperties: false,
          properties: {
            accept: { type: "boolean" },
            reason: { type: "string", maxLength: 300 },
          },
        },
      },
    },
    async (request, reply) => {
      const community = communityFor(request, reply);
      if (!community) return reply;
      const me = memberFor(request, reply, community.id);
      if (!me) return reply;
      const at = slotFor(request, reply, community.id, me);
      if (!at) return reply;
      if (at.slot.userId !== me)
        return reply.code(403).send({ error: "Not your slot" });
      const role = roleName(at.slot.roleId);
      if (request.body.accept) {
        setSlot(at.slot.id, me, "accepted", me);
        return reply.code(204).send();
      }
      setSlot(at.slot.id, null, "open", me);
      const data = {
        eventId: at.event,
        date: at.date,
        role,
        who: nameOf(me),
        reason: request.body.reason?.trim() ?? "",
        when: whenFor(community.id, at.e),
      };
      if (at.builtBy && at.builtBy !== me)
        tell(
          community.id,
          at.builtBy,
          "declined",
          `${at.event}|${at.date}|${at.key}|${now().toISOString()}`,
          data,
        );
      // Open again: the people marked for the role hear, again.
      tellOpen(
        community.id,
        at.event,
        at.date,
        at.slot.roleId,
        `|${now().toISOString()}`,
      );
      return reply.code(204).send();
    },
  );

  // A member takes an open slot: at once when marked for its role, else as an offer the
  // team confirms.
  app.post<{ Params: SlotParams }>(
    `${slotPath}/take`,
    async (request, reply) => {
      const community = communityFor(request, reply);
      if (!community) return reply;
      const me = memberFor(request, reply, community.id);
      if (!me) return reply;
      const at = slotFor(request, reply, community.id, me);
      if (!at) return reply;
      if (at.slot.status !== "open")
        return reply.code(409).send({ error: "Taken" });
      const marked = rolesOf(community.id)
        .find((r) => r.id === at.slot.roleId)
        ?.people.includes(me);
      setSlot(at.slot.id, me, marked ? "accepted" : "offered", me);
      if (at.builtBy && at.builtBy !== me)
        tell(
          community.id,
          at.builtBy,
          marked ? "signedUp" : "offered",
          `${at.event}|${at.date}|${at.key}|${now().toISOString()}`,
          {
            eventId: at.event,
            date: at.date,
            role: roleName(at.slot.roleId),
            who: nameOf(me),
            when: whenFor(community.id, at.e),
          },
        );
      return { status: marked ? "accepted" : "offered" };
    },
  );

  // The team confirms an offer, or turns it down.
  app.post<{ Params: SlotParams; Body: { yes: boolean } }>(
    `${slotPath}/confirm`,
    {
      schema: {
        body: {
          type: "object",
          required: ["yes"],
          additionalProperties: false,
          properties: { yes: { type: "boolean" } },
        },
      },
    },
    async (request, reply) => {
      const community = communityFor(request, reply);
      if (!community) return reply;
      const by = requireRole(db, request, reply, community.id, "team");
      if (!by) return reply;
      const at = slotFor(request, reply, community.id, by);
      if (!at) return reply;
      if (at.slot.status !== "offered" || !at.slot.userId)
        return reply.code(409).send({ error: "Not an offer" });
      const person = at.slot.userId;
      setSlot(
        at.slot.id,
        request.body.yes ? person : null,
        request.body.yes ? "accepted" : "open",
        by,
      );
      tell(
        community.id,
        person,
        request.body.yes ? "confirmed" : "notTaken",
        `${at.event}|${at.date}|${at.key}|${now().toISOString()}`,
        {
          eventId: at.event,
          date: at.date,
          role: roleName(at.slot.roleId),
          when: whenFor(community.id, at.e),
        },
      );
      return reply.code(204).send();
    },
  );
}
