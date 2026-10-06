import type { FastifyInstance } from "fastify";
import { newId } from "../ids.js";
import { localTime } from "./schedule.js";
import {
  OPEN_DAYS,
  type Params,
  type Slot,
  type TeamData,
} from "./team-data.js";
import type { PushResult } from "./team-notifications.js";

export type Notification = {
  id: string;
  kind: string;
  data: Record<string, string>;
  /** Null while it's being sent. */
  push: PushResult | null;
  createdAt: string;
  readAt: string | null;
};

export type MySchedule = {
  slots: (Slot & {
    eventId: string;
    name: string;
    date: string;
    start: string;
    role: string;
    /** Another role of theirs the same date, by name. */
    also: string[];
  })[];
  /** Open slots within a week of roles they're marked for. */
  open: {
    eventId: string;
    name: string;
    date: string;
    start: string;
    role: string;
    key: string;
  }[];
  away: { id: string; first: string; last: string; note: string }[];
  notifications: Notification[];
  unread: number;
};

/** A member's own schedule, what they were told, and their away dates. */
export function attachMySchedule(
  app: FastifyInstance,
  { db, now, communityFor, memberFor, rolesOf, datesOf, zoneOf }: TeamData,
) {
  // A member's own: their slots, open ones for them, away dates, what they were told.
  app.get<{ Params: Params }>(
    "/api/communities/:slug/my-schedule",
    async (request, reply) => {
      const community = communityFor(request, reply);
      if (!community) return reply;
      const me = memberFor(request, reply, community.id);
      if (!me) return reply;
      const roles = rolesOf(community.id);
      const name = (roleId: string) =>
        roles.find((r) => r.id === roleId)?.name ?? "";
      const dates = datesOf(community.id);
      const mine: MySchedule["slots"] = dates.flatMap((d) =>
        d.slots
          .filter((s) => s.userId === me)
          .map((s, _, all) => ({
            ...s,
            eventId: d.eventId,
            name: d.name,
            date: d.date,
            start: d.start,
            role: name(s.roleId),
            also: all.filter((o) => o !== s).map((o) => name(o.roleId)),
          })),
      );
      const week = now().getTime() + OPEN_DAYS * 86_400_000;
      const open: MySchedule["open"] = dates
        .filter((d) => new Date(d.start).getTime() <= week)
        .flatMap((d) =>
          d.slots
            .filter(
              (s) =>
                s.status === "open" &&
                roles.find((r) => r.id === s.roleId)?.people.includes(me) &&
                !d.slots.some((o) => o.userId === me && o.roleId === s.roleId),
            )
            // One per role and date.
            .filter(
              (s, i, all) => all.findIndex((o) => o.roleId === s.roleId) === i,
            )
            .map((s) => ({
              eventId: d.eventId,
              name: d.name,
              date: d.date,
              start: d.start,
              role: name(s.roleId),
              key: s.key,
            })),
        );
      const notifications = (
        db
          .prepare(
            `SELECT id, kind, data, push, created_at AS createdAt, read_at AS readAt FROM notifications
             WHERE user_id = ? AND community_id = ? ORDER BY created_at DESC LIMIT 30`,
          )
          .all(me, community.id) as (Omit<Notification, "data" | "push"> & {
          data: string;
          push: string | null;
        })[]
      ).map((n) => ({
        ...n,
        data: JSON.parse(n.data) as Record<string, string>,
        push: n.push === null ? null : (JSON.parse(n.push) as PushResult),
      }));
      const schedule: MySchedule = {
        slots: mine,
        open,
        away: db
          .prepare(
            "SELECT id, first_date AS first, last_date AS last, note FROM away_dates WHERE community_id = ? AND user_id = ? AND last_date >= ? ORDER BY first_date",
          )
          .all(
            community.id,
            me,
            localTime(now(), zoneOf(community.id)).date,
          ) as MySchedule["away"],
        notifications,
        unread: notifications.filter((n) => !n.readAt).length,
      };
      return schedule;
    },
  );

  app.post<{ Params: Params }>(
    "/api/communities/:slug/notifications/read",
    async (request, reply) => {
      const community = communityFor(request, reply);
      if (!community) return reply;
      const me = memberFor(request, reply, community.id);
      if (!me) return reply;
      db.prepare(
        "UPDATE notifications SET read_at = ? WHERE user_id = ? AND community_id = ? AND read_at IS NULL",
      ).run(now().toISOString(), me, community.id);
      return reply.code(204).send();
    },
  );

  // Away dates: a member marks their own.
  app.post<{
    Params: Params;
    Body: { first: string; last: string; note?: string };
  }>(
    "/api/communities/:slug/away-dates",
    {
      schema: {
        body: {
          type: "object",
          required: ["first", "last"],
          additionalProperties: false,
          properties: {
            first: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            last: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            note: { type: "string", maxLength: 200 },
          },
        },
      },
    },
    async (request, reply) => {
      const community = communityFor(request, reply);
      if (!community) return reply;
      const me = memberFor(request, reply, community.id);
      if (!me) return reply;
      const { first, last, note = "" } = request.body;
      if (last < first)
        return reply.code(400).send({ error: "Ends before it starts" });
      const at = now().toISOString();
      db.prepare(
        "INSERT INTO away_dates (id, community_id, user_id, first_date, last_date, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(newId(), community.id, me, first, last, note.trim(), at, at);
      return reply.code(204).send();
    },
  );
  app.delete<{ Params: Params & { id: string } }>(
    "/api/communities/:slug/away-dates/:id",
    async (request, reply) => {
      const community = communityFor(request, reply);
      if (!community) return reply;
      const me = memberFor(request, reply, community.id);
      if (!me) return reply;
      db.prepare(
        "DELETE FROM away_dates WHERE id = ? AND user_id = ? AND community_id = ?",
      ).run(request.params.id, me, community.id);
      return reply.code(204).send();
    },
  );
}
