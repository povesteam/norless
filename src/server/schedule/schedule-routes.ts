import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import {
  addDays,
  classify,
  eventAround,
  eventsOn,
  type EventType,
  localTime,
  type ScheduleEvent,
} from "./schedule.js";
import type { Community } from "../songs/search.js";
import { newId } from "../ids.js";

/** A schedule event as the API sends and takes it. */
export type EventInput =
  | {
      kind: "recurring";
      name: string;
      type: EventType;
      weekday: number;
      startTime: string;
      endTime: string;
      firstDate?: string | null;
      lastDate?: string | null;
    }
  | {
      kind: "one_off";
      name: string;
      type: EventType;
      date: string;
      startTime: string;
      endTime: string;
    }
  | { kind: "cancellation"; cancelsEventId: string; date: string };

export type EventOutput = {
  id: string;
  kind: ScheduleEvent["kind"];
  name: string;
  type: EventType;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
  firstDate: string | null;
  lastDate: string | null;
  date: string | null;
  cancelsEventId: string | null;
};

const columns = `id, kind, name, type, weekday, start_time AS startTime, end_time AS endTime,
  first_date AS firstDate, last_date AS lastDate, date, cancels_event_id AS cancelsEventId`;

/** The community's events that weren't deleted, recurring first, then by date. */
export function listEvents(db: Db, communityId: string): EventOutput[] {
  return db
    .prepare(
      `SELECT ${columns} FROM schedule_events
       WHERE community_id = ? AND deleted_at IS NULL
       ORDER BY kind = 'recurring' DESC, coalesce(date, first_date, '') DESC, weekday, start_time`,
    )
    .all(communityId) as EventOutput[];
}

const events = (db: Db, communityId: string) =>
  db
    .prepare(
      "SELECT * FROM schedule_events WHERE community_id = ? AND deleted_at IS NULL",
    )
    .all(communityId) as ScheduleEvent[];

const timeZone = (db: Db, communityId: string) =>
  db
    .prepare("SELECT time_zone FROM communities WHERE id = ?")
    .pluck()
    .get(communityId) as string;

/** Whether a service or rehearsal is in progress at `at`, its late minutes included. */
export function eventNow(db: Db, communityId: string, at: Date): boolean {
  const event = eventAround(
    at,
    events(db, communityId),
    timeZone(db, communityId),
  );
  return !!event && event.start.getTime() <= at.getTime();
}

/**
 * The next service or rehearsal to start after `at`, within a week, for the welcome
 * screen's countdown: when it starts, and its name.
 */
export function nextEvent(db: Db, communityId: string, at: Date) {
  const all = events(db, communityId);
  const zone = timeZone(db, communityId);
  const today = localTime(at, zone).date;
  for (let day = 0; day < 8; day++) {
    const next = eventsOn(addDays(today, day), all, zone).find(
      (e) => e.start.getTime() > at.getTime(),
    );
    if (next)
      return {
        startsAt: next.start.toISOString(),
        event: all.find((e) => e.id === next.id)?.name ?? null,
      };
  }
  return { startsAt: null, event: null };
}

/** The community's mode at `at`: the type of the event in progress, or rehearsal. */
export function modeAt(db: Db, communityId: string, at: Date): EventType {
  return classify(at, events(db, communityId), timeZone(db, communityId));
}

/**
 * Gives every imported play the type of the event it falls in with the current
 * schedule. Plays Norless recorded keep their mode, and none is deleted.
 */
export function classifyImportedPlays(
  db: Db,
  communityId: string,
  now = new Date(),
) {
  const schedule = events(db, communityId);
  const zone = timeZone(db, communityId);
  const plays = db
    .prepare(
      "SELECT id, played_at FROM plays WHERE community_id = ? AND imported = 1",
    )
    .all(communityId) as { id: string; played_at: string }[];
  const update = db.prepare(
    "UPDATE plays SET mode = ?, updated_at = ? WHERE id = ? AND mode <> ?",
  );
  const counts = { service: 0, rehearsal: 0 };
  db.transaction(() => {
    for (const play of plays) {
      const mode = classify(new Date(play.played_at), schedule, zone);
      counts[mode]++;
      update.run(mode, now.toISOString(), play.id, mode);
    }
  })();
  return counts;
}

const isDate = (text: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(text) &&
  new Date(`${text}T00:00:00Z`).toISOString().startsWith(text);
const isTime = (text: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(text);
const isoWeekday = (date: string) =>
  ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

/** Why the event can't be saved, or null. */
function badEvent(
  db: Db,
  communityId: string,
  input: EventInput,
): string | null {
  if (input.kind === "cancellation") {
    if (!isDate(input.date)) return "The date isn't a date";
    const cancelled = db
      .prepare(
        "SELECT weekday FROM schedule_events WHERE id = ? AND community_id = ? AND kind = 'recurring' AND deleted_at IS NULL",
      )
      .get(input.cancelsEventId, communityId) as
      { weekday: number } | undefined;
    if (!cancelled) return "No such recurring event";
    return cancelled.weekday === isoWeekday(input.date)
      ? null
      : "The date isn't on the event's weekday";
  }
  if (!input.name.trim()) return "The name is empty";
  if (!isTime(input.startTime) || !isTime(input.endTime))
    return "Times are HH:MM";
  if (input.endTime <= input.startTime) return "The end is before the start";
  if (input.kind === "one_off")
    return isDate(input.date) ? null : "The date isn't a date";
  const { firstDate, lastDate } = input;
  if ((firstDate && !isDate(firstDate)) || (lastDate && !isDate(lastDate)))
    return "The dates aren't dates";
  if (firstDate && lastDate && lastDate < firstDate)
    return "The last date is before the first";
  return null;
}

/** The row's columns for an input; a cancellation takes its event's name and type. */
function row(db: Db, input: EventInput) {
  if (input.kind === "cancellation") {
    const cancelled = db
      .prepare("SELECT name, type FROM schedule_events WHERE id = ?")
      .get(input.cancelsEventId) as { name: string; type: EventType };
    return {
      name: cancelled.name,
      type: cancelled.type,
      weekday: null,
      start_time: null,
      end_time: null,
      first_date: null,
      last_date: null,
      date: input.date,
      cancels_event_id: input.cancelsEventId,
    };
  }
  const common = {
    name: input.name.trim(),
    type: input.type,
    start_time: input.startTime,
    end_time: input.endTime,
    cancels_event_id: null,
  };
  return input.kind === "one_off"
    ? {
        ...common,
        weekday: null,
        first_date: null,
        last_date: null,
        date: input.date,
      }
    : {
        ...common,
        weekday: input.weekday,
        first_date: input.firstDate || null,
        last_date: input.lastDate || null,
        date: null,
      };
}

const time = { type: "string", maxLength: 5 } as const;
const day = { type: "string", maxLength: 10 } as const;
const optionalDay = { anyOf: [{ type: "null" }, day] } as const;
const eventSchema = {
  anyOf: [
    {
      type: "object",
      required: ["kind", "name", "type", "weekday", "startTime", "endTime"],
      additionalProperties: false,
      properties: {
        kind: { const: "recurring" },
        name: { type: "string", maxLength: 100 },
        type: { enum: ["service", "rehearsal"] },
        weekday: { type: "integer", minimum: 1, maximum: 7 },
        startTime: time,
        endTime: time,
        firstDate: optionalDay,
        lastDate: optionalDay,
      },
    },
    {
      type: "object",
      required: ["kind", "name", "type", "date", "startTime", "endTime"],
      additionalProperties: false,
      properties: {
        kind: { const: "one_off" },
        name: { type: "string", maxLength: 100 },
        type: { enum: ["service", "rehearsal"] },
        date: day,
        startTime: time,
        endTime: time,
      },
    },
    {
      type: "object",
      required: ["kind", "cancelsEventId", "date"],
      additionalProperties: false,
      properties: {
        kind: { const: "cancellation" },
        cancelsEventId: { type: "string", maxLength: 100 },
        date: day,
      },
    },
  ],
} as const;

/** Schedule routes, for owners: the community settings. */
export function attachSchedule(
  app: FastifyInstance,
  {
    db,
    findCommunity,
  }: { db: Db; findCommunity: (slug: string) => Community | undefined },
) {
  type Params = { slug: string; id: string };
  const authorize = (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    const community = findCommunity(slug);
    if (!community) {
      void reply.code(404).send({ error: "Not found" });
      return null;
    }
    const userId = requireRole(db, request, reply, community.id, "owner");
    return userId ? { communityId: community.id, userId } : null;
  };

  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug/schedule",
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      return { events: listEvents(db, who.communityId) };
    },
  );

  app.post<{ Params: { slug: string }; Body: EventInput }>(
    "/api/communities/:slug/schedule",
    { schema: { body: eventSchema } },
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      const bad = badEvent(db, who.communityId, request.body);
      if (bad) return reply.code(400).send({ error: bad });
      const id = newId();
      const at = new Date().toISOString();
      const r = row(db, request.body);
      db.prepare(
        `INSERT INTO schedule_events (id, community_id, name, type, kind, weekday, start_time, end_time,
           first_date, last_date, date, cancels_event_id, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        who.communityId,
        r.name,
        r.type,
        request.body.kind,
        r.weekday,
        r.start_time,
        r.end_time,
        r.first_date,
        r.last_date,
        r.date,
        r.cancels_event_id,
        at,
        at,
        who.userId,
        who.userId,
      );
      return reply.code(201).send({ id });
    },
  );

  app.put<{ Params: Params; Body: EventInput }>(
    "/api/communities/:slug/schedule/:id",
    { schema: { body: eventSchema } },
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      const kind = db
        .prepare(
          "SELECT kind FROM schedule_events WHERE id = ? AND community_id = ? AND deleted_at IS NULL",
        )
        .pluck()
        .get(request.params.id, who.communityId);
      if (!kind) return reply.code(404).send({ error: "Not found" });
      if (kind !== request.body.kind)
        return reply.code(400).send({ error: "An event keeps its kind" });
      const bad = badEvent(db, who.communityId, request.body);
      if (bad) return reply.code(400).send({ error: bad });
      const r = row(db, request.body);
      db.prepare(
        `UPDATE schedule_events SET name = ?, type = ?, weekday = ?, start_time = ?, end_time = ?,
           first_date = ?, last_date = ?, date = ?, cancels_event_id = ?, updated_at = ?, updated_by = ?
         WHERE id = ?`,
      ).run(
        r.name,
        r.type,
        r.weekday,
        r.start_time,
        r.end_time,
        r.first_date,
        r.last_date,
        r.date,
        r.cancels_event_id,
        new Date().toISOString(),
        who.userId,
        request.params.id,
      );
      return reply.code(204).send();
    },
  );

  app.delete<{ Params: Params }>(
    "/api/communities/:slug/schedule/:id",
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      const at = new Date().toISOString();
      const { changes } = db
        .prepare(
          `UPDATE schedule_events SET deleted_at = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND community_id = ? AND deleted_at IS NULL`,
        )
        .run(at, at, who.userId, request.params.id, who.communityId);
      if (changes === 0) return reply.code(404).send({ error: "Not found" });
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/api/communities/:slug/schedule/classify",
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      return classifyImportedPlays(db, who.communityId);
    },
  );
}
