import type { FastifyInstance } from "fastify";
import ICAL from "ical.js";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import { fetchPublic } from "../songs/link-preview.js";
import { isMember, memberRoles } from "../auth/members.js";

/** An event of the church's calendar, as members read it. */
export type CalendarEvent = {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
};

/** What members get: the events coming up, and when the calendar was last read. */
export type Calendar = {
  events: CalendarEvent[];
  readAt: string | null;
  /** The address didn't answer with a calendar the last time. */
  failed: boolean;
  /** Owners only: the address. */
  url?: string | null;
};

const DAYS = 56;
const LIMIT = 30;
const FRESH_MS = 60 * 60_000;

/**
 * The events of an iCal text from `from` for `days` days, in order, at most `limit`:
 * recurring ones expanded, their moved or cancelled dates as the calendar says.
 */
export function upcoming(
  ics: string,
  from: Date,
  days = DAYS,
  limit = LIMIT,
): CalendarEvent[] {
  const root = new ICAL.Component(ICAL.parse(ics));
  for (const zone of root.getAllSubcomponents("vtimezone"))
    ICAL.TimezoneService.register(zone);
  const until = from.getTime() + days * 86_400_000;
  // A recurring event's changed dates come as their own events with its UID.
  const byUid = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const vevent of root.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(vevent);
    if (event.isRecurrenceException()) exceptions.push(event);
    else byUid.set(event.uid, event);
  }
  for (const exception of exceptions)
    byUid.get(exception.uid)?.relateException(exception);

  const found: CalendarEvent[] = [];
  const add = (event: ICAL.Event, start: ICAL.Time, end: ICAL.Time | null) => {
    const status = event.component.getFirstPropertyValue("status");
    if (String(status).toUpperCase() === "CANCELLED") return;
    const startAt = start.toJSDate();
    const endAt = (end ?? start).toJSDate();
    if (endAt.getTime() < from.getTime() || startAt.getTime() > until) return;
    // A whole day stays a day, "2026-10-12", whatever the server's time zone.
    const day = (time: ICAL.Time) => time.toString().slice(0, 10);
    found.push({
      title: event.summary || "",
      start: start.isDate ? day(start) : startAt.toISOString(),
      end: start.isDate ? day(end ?? start) : endAt.toISOString(),
      allDay: start.isDate,
      location: event.location || null,
    });
  };
  for (const event of byUid.values()) {
    if (!event.isRecurring()) {
      add(event, event.startDate, event.endDate);
      continue;
    }
    const occurrences = event.iterator();
    // ponytail: walks a long-running series from its start, 5,000 dates at most.
    for (let i = 0; i < 5000; i++) {
      const next = occurrences.next();
      if (!next || next.toJSDate().getTime() > until) break;
      const details = event.getOccurrenceDetails(next);
      add(details.item, details.startDate, details.endDate);
    }
  }
  return found.sort((a, b) => a.start.localeCompare(b.start)).slice(0, limit);
}

/** webcal:// is the same address over https. */
const normalized = (url: string) =>
  url.trim().replace(/^webcal:\/\//i, "https://");

/**
 * The church's calendar: owners set its iCal address; members read
 * what's coming, read again from the address at most once an hour.
 */
export function attachCalendar(
  app: FastifyInstance,
  {
    db,
    findCommunity,
    fetch = (url: string) => fetchPublic(url, { maxBytes: 4_000_000 }),
    now = () => new Date(),
  }: {
    db: Db;
    findCommunity: (slug: string) => { id: string } | undefined;
    fetch?: (url: string) => Promise<{ body: Buffer } | null>;
    now?: () => Date;
  },
) {
  // ponytail: in memory, so a restart reads each calendar again on its first visit.
  const read = new Map<
    string,
    { url: string; at: number; events: CalendarEvent[]; failed: boolean }
  >();
  const urlOf = (communityId: string) =>
    (db
      .prepare("SELECT calendar_url FROM communities WHERE id = ?")
      .pluck()
      .get(communityId) as string | null) ?? null;

  const refresh = async (communityId: string, url: string) => {
    const got = await fetch(url).catch(() => null);
    let events: CalendarEvent[] | null = null;
    try {
      if (got) events = upcoming(got.body.toString("utf8"), now());
    } catch {
      events = null;
    }
    const known = read.get(communityId);
    read.set(communityId, {
      url,
      at: now().getTime(),
      // A failed read keeps the events read before.
      events: events ?? (known?.url === url ? known.events : []),
      failed: events === null,
    });
  };
  const calendarOf = async (communityId: string): Promise<Calendar> => {
    const url = urlOf(communityId);
    if (!url) return { events: [], readAt: null, failed: false };
    const known = read.get(communityId);
    if (!known || known.url !== url || now().getTime() - known.at > FRESH_MS)
      await refresh(communityId, url);
    const got = read.get(communityId);
    const from = now().getTime();
    return {
      events: (got?.events ?? []).filter((e) => Date.parse(e.end) >= from),
      readAt: got ? new Date(got.at).toISOString() : null,
      failed: got?.failed ?? false,
    };
  };

  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug/calendar",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      if (!request.user || !isMember(db, community.id, request.user.id))
        return reply
          .code(request.user ? 403 : 401)
          .send({ error: "Members only" });
      const calendar = await calendarOf(community.id);
      // The address may be a secret one: owners only.
      return memberRoles(db, community.id, request.user.id).includes("owner")
        ? { ...calendar, url: urlOf(community.id) }
        : calendar;
    },
  );

  app.put<{ Params: { slug: string }; Body: { url: string | null } }>(
    "/api/communities/:slug/calendar",
    {
      schema: {
        body: {
          type: "object",
          required: ["url"],
          additionalProperties: false,
          properties: {
            url: {
              anyOf: [{ type: "string", maxLength: 2000 }, { type: "null" }],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      if (!requireRole(db, request, reply, community.id, "owner")) return reply;
      const url = request.body.url ? normalized(request.body.url) : null;
      if (url && !/^https:\/\/[^\s]+$/i.test(url))
        return reply.code(400).send({ error: "An https or webcal address" });
      db.prepare(
        "UPDATE communities SET calendar_url = ?, updated_at = ? WHERE id = ?",
      ).run(url, now().toISOString(), community.id);
      read.delete(community.id);
      return { ...(await calendarOf(community.id)), url };
    },
  );
}
