import type { FastifyInstance } from "fastify";
import webpush from "web-push";
import type { Db } from "../db/db.js";
import { localTime, type EventType } from "./schedule.js";
import type { Community } from "../songs/search.js";
import { attachMySchedule } from "./my-schedule.js";
import {
  teamData,
  type Params,
  type Role,
  type ScheduleDate,
} from "./team-data.js";
import {
  attachNotificationRoutes,
  teamNotifications,
} from "./team-notifications.js";
import { attachTeamRoles } from "./team-roles.js";
import { attachTeamSlots } from "./team-slots.js";

/**
 * Team scheduling: the community's service roles, the slots of each
 * service and rehearsal (from a template per weekly event), who takes them, away dates,
 * and telling people in the app and by push. The team builds the schedule; every
 * member sees it; each person answers for their own slots.
 */

export type Person = {
  id: string;
  name: string;
  avatar: string | null;
  away: { id: string; first: string; last: string }[];
};

export type TeamSchedule = {
  roles: Role[];
  people: Person[];
  dates: ScheduleDate[];
  /** The weekly events, with the slots each date starts from. */
  events: {
    id: string;
    name: string;
    type: EventType;
    weekday: number;
    template: { roleId: string; count: number }[];
  }[];
};

/**
 * The team schedule's routes and the job that sends reminders and open slots. Push goes
 * out when the server has VAPID keys; without them, people are told in the app only.
 */
export function attachTeamSchedule(
  app: FastifyInstance,
  {
    db,
    findCommunity,
    vapid,
    now = () => new Date(),
  }: {
    db: Db;
    findCommunity: (slug: string) => (Community & { slug: string }) | undefined;
    vapid?: { publicKey: string; privateKey: string; subject: string };
    now?: () => Date;
  },
) {
  if (vapid)
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const data = teamData({ db, findCommunity, now });
  const {
    communityFor,
    memberFor,
    rolesOf,
    zoneOf,
    eventsOf,
    members,
    datesOf,
    templateOf,
  } = data;
  const team = { ...data, ...teamNotifications(app, data, vapid) };
  const { sweep } = team;

  const timer = setInterval(() => {
    try {
      sweep();
    } catch (error) {
      app.log.error(error);
    }
  }, 60_000);
  timer.unref();
  app.addHook("onClose", async () => clearInterval(timer));

  // Routes.
  app.get<{ Params: Params; Querystring: { weeks?: number } }>(
    "/api/communities/:slug/team-schedule",
    async (request, reply) => {
      const community = communityFor(request, reply);
      if (!community) return reply;
      if (!memberFor(request, reply, community.id)) return reply;
      const roles = rolesOf(community.id);
      const away = db
        .prepare(
          "SELECT id, user_id AS userId, first_date AS first, last_date AS last FROM away_dates WHERE community_id = ? AND last_date >= ?",
        )
        .all(community.id, localTime(now(), zoneOf(community.id)).date) as {
        id: string;
        userId: string;
        first: string;
        last: string;
      }[];
      const events = eventsOf(community.id).filter(
        (e) => e.kind === "recurring",
      );
      const schedule: TeamSchedule = {
        roles,
        people: members(community.id).map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          away: away
            .filter((a) => a.userId === p.id)
            .map((a) => ({ id: a.id, first: a.first, last: a.last })),
        })),
        dates: datesOf(community.id),
        events: events.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          weekday: e.weekday ?? 0,
          template: templateOf(e.id),
        })),
      };
      return schedule;
    },
  );

  attachTeamRoles(app, data);
  attachTeamSlots(app, team);
  attachMySchedule(app, data);
  attachNotificationRoutes(app, team);

  return { sweep };
}
