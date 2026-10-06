import type { FastifyReply, FastifyRequest } from "fastify";
import type { Instrument } from "../../shared/preferences.js";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";
import { isMember } from "../auth/members.js";
import {
  addDays,
  eventsOn,
  localTime,
  type EventType,
  type ScheduleEvent,
} from "./schedule.js";
import type { Community } from "../songs/search.js";

export type SlotStatus = "open" | "asked" | "accepted" | "offered";

/** A role, and who's marked for it: by the team, or by playing its instrument. */
export type Role = {
  id: string;
  name: string;
  instrument: Instrument | null;
  /** Leads the songs of its services: a Worship lead. */
  leads: boolean;
  people: string[];
};

/** A slot of a date: `key` is its role and place, the same before and after it's saved. */
export type Slot = {
  key: string;
  roleId: string;
  userId: string | null;
  status: SlotStatus;
};

export type ScheduleDate = {
  eventId: string;
  name: string;
  type: EventType;
  /** The local day, YYYY-MM-DD. */
  date: string;
  start: string;
  end: string;
  /** Who built it, told of declines and sign-ups; null while it's the template's. */
  builtBy: string | null;
  slots: Slot[];
};

/** The starter roles, in the community's first language. */
const starter: Record<string, [string, Instrument | null, boolean?][]> = {
  ro: [
    ["Lider de laudă", null, true],
    ["Voce", "vocals"],
    ["Chitară", "guitar"],
    ["Clape", "keys"],
    ["Bas", "bass"],
    ["Tobe", "drums"],
    ["Prezentator", null],
    ["Predicator", null],
    ["Sunet", null],
    ["Slide-uri", null],
    ["Învățător la copii", null],
  ],
  uk: [
    ["Ведучий прославлення", null, true],
    ["Вокал", "vocals"],
    ["Гітара", "guitar"],
    ["Клавішні", "keys"],
    ["Бас", "bass"],
    ["Барабани", "drums"],
    ["Ведучий", null],
    ["Проповідник", null],
    ["Звук", null],
    ["Слайди", null],
    ["Вчитель дітей", null],
  ],
  en: [
    ["Worship lead", null, true],
    ["Vocals", "vocals"],
    ["Guitar", "guitar"],
    ["Keys", "keys"],
    ["Bass", "bass"],
    ["Drums", "drums"],
    ["Host", null],
    ["Preacher", null],
    ["Sound", null],
    ["Slides", null],
    ["Kids' teacher", null],
  ],
};

/** How far ahead the schedule shows, and open slots are told. */
const WEEKS = 8;
export const OPEN_DAYS = 7;
export const REMIND_MS = 3 * 3_600_000;

export const keyOf = (roleId: string, position: number) =>
  `${roleId}:${position}`;

export type Params = { slug: string };

/** The team schedule's data, and the community and member a route is for. */
export function teamData({
  db,
  findCommunity,
  now,
}: {
  db: Db;
  findCommunity: (slug: string) => (Community & { slug: string }) | undefined;
  now: () => Date;
}) {
  const zoneOf = (communityId: string) =>
    db
      .prepare("SELECT time_zone FROM communities WHERE id = ?")
      .pluck()
      .get(communityId) as string;
  const languageOf = (communityId: string) => {
    const languages = JSON.parse(
      db
        .prepare("SELECT languages FROM communities WHERE id = ?")
        .pluck()
        .get(communityId) as string,
    ) as string[];
    return languages[0] ?? "en";
  };
  const eventsOf = (communityId: string) =>
    db
      .prepare(
        "SELECT * FROM schedule_events WHERE community_id = ? AND deleted_at IS NULL",
      )
      .all(communityId) as (ScheduleEvent & { name: string })[];

  /** The roles, with the starter list the first time. */
  const rolesOf = (communityId: string): Role[] => {
    const any = db
      .prepare("SELECT count(*) FROM service_roles WHERE community_id = ?")
      .pluck()
      .get(communityId) as number;
    if (any === 0) {
      const at = now().toISOString();
      const insert = db.prepare(
        "INSERT INTO service_roles (id, community_id, name, instrument, leads, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      );
      (starter[languageOf(communityId)] ?? starter.en ?? []).forEach(
        ([name, instrument, leads = false], i) =>
          insert.run(
            newId(),
            communityId,
            name,
            instrument,
            leads ? 1 : 0,
            i,
            at,
            at,
          ),
      );
    }
    const rows = db
      .prepare(
        "SELECT id, name, instrument, leads = 1 AS leads FROM service_roles WHERE community_id = ? AND deleted_at IS NULL ORDER BY position",
      )
      .all(communityId) as (Omit<Role, "people" | "leads"> & {
      leads: number;
    })[];
    const marked = db
      .prepare(
        "SELECT role_id AS roleId, user_id AS userId FROM role_people WHERE community_id = ?",
      )
      .all(communityId) as { roleId: string; userId: string }[];
    const players = members(communityId);
    return rows.map((r) => ({
      ...r,
      leads: r.leads === 1,
      people: [
        ...new Set([
          ...marked.filter((m) => m.roleId === r.id).map((m) => m.userId),
          ...(r.instrument
            ? players
                .filter((p) =>
                  p.instruments.includes(r.instrument as Instrument),
                )
                .map((p) => p.id)
            : []),
        ]),
      ],
    }));
  };

  /** Active members who are people (not the community's laptop or a guest's phone). */
  const members = (communityId: string) =>
    (
      db
        .prepare(
          `SELECT u.id, nullif(u.display_name, '') AS name, u.avatar, u.preferences
           FROM members m JOIN users u ON u.id = m.user_id
           WHERE m.community_id = ? AND m.status = 'active' AND m.deleted_at IS NULL
             AND u.device_of IS NULL AND u.deleted_at IS NULL
           ORDER BY u.display_name COLLATE NOCASE`,
        )
        .all(communityId) as {
        id: string;
        name: string | null;
        avatar: string | null;
        preferences: string;
      }[]
    ).map((m) => ({
      id: m.id,
      name: m.name ?? "",
      avatar: m.avatar,
      instruments:
        (
          JSON.parse(m.preferences) as {
            musician?: { instruments?: string[] };
          }
        ).musician?.instruments ?? [],
    }));

  const templateOf = (eventId: string) =>
    db
      .prepare(
        `SELECT t.role_id AS roleId, t.count FROM slot_templates t
         JOIN service_roles r ON r.id = t.role_id AND r.deleted_at IS NULL
         WHERE t.event_id = ? ORDER BY r.position`,
      )
      .all(eventId) as { roleId: string; count: number }[];

  /** A date's slots: saved, or its event's template while the team hasn't changed it. */
  const slotsOf = (eventId: string, date: string): Slot[] => {
    const built = db
      .prepare("SELECT 1 FROM schedule_dates WHERE event_id = ? AND date = ?")
      .get(eventId, date);
    if (!built)
      return templateOf(eventId).flatMap(({ roleId, count }) =>
        Array.from({ length: count }, (_, i) => ({
          key: keyOf(roleId, i),
          roleId,
          userId: null,
          status: "open" as const,
        })),
      );
    return (
      db
        .prepare(
          `SELECT s.role_id AS roleId, s.position, s.user_id AS userId, s.status FROM slots s
           JOIN service_roles r ON r.id = s.role_id
           WHERE s.event_id = ? AND s.date = ? AND s.deleted_at IS NULL
           ORDER BY r.position, s.position`,
        )
        .all(eventId, date) as {
        roleId: string;
        position: number;
        userId: string | null;
        status: SlotStatus;
      }[]
    ).map((s) => ({ ...s, key: keyOf(s.roleId, s.position) }));
  };

  /** The services and rehearsals from today, `weeks` ahead. */
  const datesOf = (communityId: string, weeks = WEEKS): ScheduleDate[] => {
    const events = eventsOf(communityId);
    const zone = zoneOf(communityId);
    const today = localTime(now(), zone).date;
    const found: ScheduleDate[] = [];
    for (let day = 0; day < weeks * 7; day++) {
      const date = addDays(today, day);
      for (const e of eventsOn(date, events, zone)) {
        if (e.end.getTime() < now().getTime()) continue;
        const event = events.find((x) => x.id === e.id);
        found.push({
          eventId: e.id,
          name: event?.name ?? "",
          type: e.type,
          date,
          start: e.start.toISOString(),
          end: e.end.toISOString(),
          builtBy:
            (db
              .prepare(
                "SELECT built_by FROM schedule_dates WHERE event_id = ? AND date = ?",
              )
              .pluck()
              .get(e.id, date) as string | null | undefined) ?? null,
          slots: slotsOf(e.id, date),
        });
      }
    }
    return found;
  };

  /** Saves a date's slots from its template, the first time the team changes it. */
  const build = (
    communityId: string,
    eventId: string,
    date: string,
    by: string,
  ) => {
    if (
      db
        .prepare("SELECT 1 FROM schedule_dates WHERE event_id = ? AND date = ?")
        .get(eventId, date)
    )
      return;
    const at = now().toISOString();
    db.prepare(
      "INSERT INTO schedule_dates (id, community_id, event_id, date, built_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(newId(), communityId, eventId, date, by, at, at);
    const insert = db.prepare(
      `INSERT INTO slots (id, community_id, event_id, date, role_id, user_id, status, position, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, NULL, 'open', ?, ?, ?, ?, ?)`,
    );
    for (const { roleId, count } of templateOf(eventId))
      for (let i = 0; i < count; i++)
        insert.run(
          newId(),
          communityId,
          eventId,
          date,
          roleId,
          i,
          at,
          at,
          by,
          by,
        );
  };

  const slotRow = (eventId: string, date: string, key: string) => {
    const [roleId = "", position = "-1"] = key.split(":");
    return db
      .prepare(
        `SELECT id, role_id AS roleId, user_id AS userId, status FROM slots
         WHERE event_id = ? AND date = ? AND role_id = ? AND position = ? AND deleted_at IS NULL`,
      )
      .get(eventId, date, roleId, Number(position)) as
      | {
          id: string;
          roleId: string;
          userId: string | null;
          status: SlotStatus;
        }
      | undefined;
  };
  const setSlot = (
    id: string,
    userId: string | null,
    status: SlotStatus,
    by: string,
  ) =>
    db
      .prepare(
        "UPDATE slots SET user_id = ?, status = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      )
      .run(userId, status, now().toISOString(), by, id);

  /** The date's event, if it happens that day in the community. */
  const occurrence = (communityId: string, eventId: string, date: string) => {
    const zone = zoneOf(communityId);
    const events = eventsOf(communityId);
    const e = eventsOn(date, events, zone).find((x) => x.id === eventId);
    return (
      e && { ...e, name: events.find((x) => x.id === eventId)?.name ?? "" }
    );
  };

  // For the routes: the community in the path, and who's asking.
  const communityFor = (request: FastifyRequest, reply: FastifyReply) => {
    const community = findCommunity((request.params as Params).slug);
    if (!community) void reply.code(404).send({ error: "Not found" });
    return community;
  };
  /** A member who is a person, or the reply already sent. */
  const memberFor = (
    request: FastifyRequest,
    reply: FastifyReply,
    communityId: string,
  ) => {
    const user = request.user;
    if (!user) {
      void reply.code(401).send({ error: "Log in first" });
      return null;
    }
    if (user.device || !isMember(db, communityId, user.id)) {
      void reply.code(403).send({ error: "Members only" });
      return null;
    }
    return user.id;
  };

  return {
    db,
    now,
    zoneOf,
    languageOf,
    eventsOf,
    rolesOf,
    members,
    templateOf,
    slotsOf,
    datesOf,
    build,
    slotRow,
    setSlot,
    occurrence,
    communityFor,
    memberFor,
  };
}

export type TeamData = ReturnType<typeof teamData>;
