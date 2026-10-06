import type { FastifyInstance } from "fastify";
import webpush from "web-push";
import { requireRole } from "../auth/auth.js";
import { newId } from "../ids.js";
import { playlistNameOf } from "../playlists/playlists.js";
import { localTime } from "./schedule.js";
import {
  OPEN_DAYS,
  REMIND_MS,
  type Params,
  type TeamData,
} from "./team-data.js";

/** How a notification went by push: per device, or why it went to none. */
export type PushResult =
  { sent: number; failed: number; gone: number } | { none: "keys" | "devices" };

/** Push texts, in the community's first language. */
const pushTexts: Record<string, Record<string, string>> = {
  en: {
    assigned: "You're on {role}, {when}",
    unassigned: "You're no longer on {role}, {when}",
    reminder: "In 3 hours: {role}, {when}",
    open: "Open: {role}, {when}",
    declined: "{who} can't do {role}, {when}",
    signedUp: "{who} takes {role}, {when}",
    offered: "{who} offers to do {role}, {when}",
    confirmed: "You're on {role}, {when}",
    notTaken: "{role}, {when}: the team chose someone else",
    ready: "{title} is ready: {count} songs",
    changed: "{song} changed, in {title}",
  },
  ro: {
    assigned: "Ești la {role}, {when}",
    unassigned: "Nu mai ești la {role}, {when}",
    reminder: "În 3 ore: {role}, {when}",
    open: "Loc liber: {role}, {when}",
    declined: "{who} nu poate la {role}, {when}",
    signedUp: "{who} se înscrie la {role}, {when}",
    offered: "{who} se oferă la {role}, {when}",
    confirmed: "Ești la {role}, {when}",
    notTaken: "{role}, {when}: echipa a ales pe altcineva",
    ready: "{title} e gata: {count} cântări",
    changed: "{song} s-a schimbat, în {title}",
  },
  uk: {
    assigned: "Ви на ролі «{role}», {when}",
    unassigned: "Ви більше не на ролі «{role}», {when}",
    reminder: "За 3 години: {role}, {when}",
    open: "Вільне місце: {role}, {when}",
    declined: "{who} не може: {role}, {when}",
    signedUp: "{who} записується: {role}, {when}",
    offered: "{who} пропонує себе: {role}, {when}",
    confirmed: "Ви на ролі «{role}», {when}",
    notTaken: "{role}, {when}: команда вибрала іншу людину",
    ready: "{title} готовий: пісень — {count}",
    changed: "{song} змінилася, у «{title}»",
  },
};

/** Telling people, and the sweep: reminders, open slots and changed songs. */
export function teamNotifications(
  app: FastifyInstance,
  {
    db,
    now,
    zoneOf,
    languageOf,
    rolesOf,
    slotsOf,
    datesOf,
    occurrence,
  }: TeamData,
  vapid?: { publicKey: string; privateKey: string; subject: string },
) {
  // Telling people: in the app, and by push where they allowed it.
  const when = (communityId: string, start: Date, name: string) =>
    `${name} ${new Intl.DateTimeFormat(languageOf(communityId), {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: zoneOf(communityId),
    }).format(start)}`;
  const tell = (
    communityId: string,
    userId: string,
    kind: string,
    about: string,
    data: Record<string, string>,
    /** Where a tap on the push opens, under the community: My schedule by default. */
    page = "my-schedule",
  ) => {
    const id = newId();
    db.prepare(
      "INSERT INTO notifications (id, community_id, user_id, kind, about, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      id,
      communityId,
      userId,
      kind,
      about,
      JSON.stringify(data),
      now().toISOString(),
    );
    const pushed = (result: PushResult) =>
      db
        .prepare("UPDATE notifications SET push = ? WHERE id = ?")
        .run(JSON.stringify(result), id);
    if (!vapid) return pushed({ none: "keys" });
    const texts = pushTexts[languageOf(communityId)] ?? pushTexts.en ?? {};
    const body = (texts[kind] ?? kind).replace(
      /\{(\w+)\}/g,
      (_, name: string) => data[name] ?? "",
    );
    const slug = db
      .prepare("SELECT slug FROM communities WHERE id = ?")
      .pluck()
      .get(communityId) as string;
    const subscriptions = db
      .prepare(
        "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
      )
      .all(userId) as {
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }[];
    if (subscriptions.length === 0) return pushed({ none: "devices" });
    void Promise.all(
      subscriptions.map((s) =>
        webpush
          .sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({
              title: "Norless",
              body,
              url: `/${slug}/${page}`,
            }),
          )
          .then(
            () => "sent" as const,
            (error: { statusCode?: number; body?: string }) => {
              // Gone: the device unsubscribed or the app was removed.
              if (error.statusCode === 404 || error.statusCode === 410) {
                db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(
                  s.id,
                );
                return "gone" as const;
              }
              app.log.warn(
                {
                  notification: id,
                  push: new URL(s.endpoint).host,
                  status: error.statusCode,
                  body: error.body,
                },
                "Push not sent",
              );
              return "failed" as const;
            },
          ),
      ),
    ).then((results) =>
      pushed({
        sent: results.filter((r) => r === "sent").length,
        failed: results.filter((r) => r === "failed").length,
        gone: results.filter((r) => r === "gone").length,
      }),
    );
  };
  const told = (userId: string, kind: string, about: string) =>
    !!db
      .prepare(
        "SELECT 1 FROM notifications WHERE user_id = ? AND kind = ? AND about = ?",
      )
      .get(userId, kind, about);
  const nameOf = (userId: string) =>
    (db
      .prepare("SELECT nullif(display_name, '') FROM users WHERE id = ?")
      .pluck()
      .get(userId) as string | null) ?? "";
  const roleName = (roleId: string) =>
    (db
      .prepare("SELECT name FROM service_roles WHERE id = ?")
      .pluck()
      .get(roleId) as string | undefined) ?? "";

  /** Tells the people marked for a role of an open slot within a week, once per date and role. */
  const tellOpen = (
    communityId: string,
    eventId: string,
    date: string,
    roleId: string,
    again = "",
  ) => {
    const e = occurrence(communityId, eventId, date);
    if (!e) return;
    const soon = e.start.getTime() - now().getTime();
    if (soon < 0 || soon > OPEN_DAYS * 86_400_000) return;
    const role = rolesOf(communityId).find((r) => r.id === roleId);
    if (!role) return;
    const taken = new Set(slotsOf(eventId, date).map((s) => s.userId));
    const about = `${eventId}|${date}|${roleId}${again}`;
    for (const userId of role.people) {
      if (taken.has(userId) || told(userId, "open", about)) continue;
      tell(communityId, userId, "open", about, {
        eventId,
        date,
        role: role.name,
        when: when(communityId, e.start, e.name),
      });
    }
  };

  /**
   * The people in a service's slots, assigned or accepted; with
   * `players`, only those of roles for an instrument or that lead the songs.
   */
  const peopleOf = (eventId: string, date: string, players = false) =>
    db
      .prepare(
        `SELECT DISTINCT s.user_id FROM slots s JOIN service_roles r ON r.id = s.role_id
         WHERE s.event_id = ? AND s.date = ? AND s.deleted_at IS NULL AND s.user_id IS NOT NULL
           AND s.status IN ('asked', 'accepted')
           ${players ? "AND (r.instrument IS NOT NULL OR r.leads = 1)" : ""}`,
      )
      .pluck()
      .all(eventId, date) as string[];
  const songTitle = (communityId: string, songId: string) =>
    (db
      .prepare(
        "SELECT title FROM song_versions WHERE song_id = ? AND deleted_at IS NULL ORDER BY language = ? DESC, created_at LIMIT 1",
      )
      .pluck()
      .get(songId, languageOf(communityId)) as string | undefined) ?? "";

  /**
   * Songs changed after their playlist was told ready, or added to it, told to its
   * service's musicians: once per change, while the service is to come.
   */
  const tellChanged = (communityId: string) => {
    const today = localTime(now(), zoneOf(communityId)).date;
    const rows = db
      .prepare(
        `SELECT p.id AS playlistId, p.title, p.service_event_id AS eventId, p.service_date AS date,
           p.created_at AS createdAt, e.song_id AS songId, max(s.updated_at, e.updated_at) AS changedAt
         FROM playlists p
         JOIN entries e ON e.playlist_id = p.id AND e.deleted_at IS NULL AND e.kind = 'song'
         JOIN songs s ON s.id = e.song_id
         WHERE p.community_id = ? AND p.ready_at IS NOT NULL AND p.deleted_at IS NULL
           AND p.service_date >= ? AND (s.updated_at > p.ready_at OR e.updated_at > p.ready_at)`,
      )
      .all(communityId, today) as {
      playlistId: string;
      title: string | null;
      eventId: string;
      date: string;
      createdAt: string;
      songId: string;
      changedAt: string;
    }[];
    for (const r of rows)
      for (const userId of peopleOf(r.eventId, r.date, true)) {
        const about = `${r.playlistId}|${r.songId}|${r.changedAt}`;
        if (!told(userId, "changed", about))
          tell(
            communityId,
            userId,
            "changed",
            about,
            {
              title: playlistNameOf(db, {
                community_id: communityId,
                title: r.title,
                service_date: r.date,
                created_at: r.createdAt,
              }),
              song: songTitle(communityId, r.songId),
              playlistId: r.playlistId,
            },
            `playlists/${r.playlistId}`,
          );
      }
  };

  /** Reminders 3 hours before, and open slots within a week: each once. */
  const sweep = () => {
    const communities = db
      .prepare(
        "SELECT DISTINCT community_id FROM service_roles WHERE deleted_at IS NULL",
      )
      .pluck()
      .all() as string[];
    for (const communityId of communities) {
      for (const d of datesOf(communityId, 2)) {
        const start = new Date(d.start);
        const ahead = start.getTime() - now().getTime();
        for (const s of d.slots) {
          if (
            s.userId &&
            (s.status === "accepted" || s.status === "asked") &&
            ahead > 0 &&
            ahead <= REMIND_MS
          ) {
            const about = `${d.eventId}|${d.date}|${s.key}`;
            if (!told(s.userId, "reminder", about))
              tell(communityId, s.userId, "reminder", about, {
                eventId: d.eventId,
                date: d.date,
                role: roleName(s.roleId),
                when: when(communityId, start, d.name),
              });
          }
          if (s.status === "open")
            tellOpen(communityId, d.eventId, d.date, s.roleId);
        }
      }
      tellChanged(communityId);
    }
  };

  return {
    vapid,
    when,
    tell,
    told,
    nameOf,
    roleName,
    tellOpen,
    peopleOf,
    sweep,
  };
}

/** What the team schedule's routes use: its data, and telling people. */
export type Team = TeamData & ReturnType<typeof teamNotifications>;

/** A playlist's news, and the devices that get push. */
export function attachNotificationRoutes(
  app: FastifyInstance,
  { db, now, vapid, communityFor, peopleOf, tell }: Team,
) {
  // The team tells a service's people that its playlist is ready.
  app.post<{ Params: Params & { id: string } }>(
    "/api/communities/:slug/playlists/:id/ready",
    async (request, reply) => {
      const community = communityFor(request, reply);
      if (!community) return reply;
      const userId = requireRole(db, request, reply, community.id, "team");
      if (!userId) return reply;
      const playlist = db
        .prepare(
          `SELECT id, community_id, title, service_event_id AS eventId, service_date AS date,
             service_date, created_at FROM playlists
           WHERE id = ? AND community_id = ? AND deleted_at IS NULL`,
        )
        .get(request.params.id, community.id) as
        | (Parameters<typeof playlistNameOf>[1] & {
            id: string;
            eventId: string | null;
            date: string | null;
          })
        | undefined;
      if (!playlist) return reply.code(404).send({ error: "Not found" });
      const people =
        playlist.eventId && playlist.date
          ? peopleOf(playlist.eventId, playlist.date).filter(
              (p) => p !== userId,
            )
          : [];
      if (!people.length)
        return reply.code(400).send({ error: "Nobody to tell" });
      const at = now().toISOString();
      const count = String(
        db
          .prepare(
            "SELECT count(*) FROM entries WHERE playlist_id = ? AND kind = 'song' AND deleted_at IS NULL",
          )
          .pluck()
          .get(playlist.id),
      );
      for (const person of people)
        tell(
          community.id,
          person,
          "ready",
          `${playlist.id}|${at}`,
          {
            title: playlistNameOf(db, playlist),
            count,
            playlistId: playlist.id,
          },
          `playlists/${playlist.id}`,
        );
      db.prepare("UPDATE playlists SET ready_at = ? WHERE id = ?").run(
        at,
        playlist.id,
      );
      return { told: people.length, readyAt: at };
    },
  );

  // Push: the key a device subscribes with, and its subscription.
  app.get("/api/push/key", async () => ({ key: vapid?.publicKey ?? null }));
  app.post<{
    Body: { endpoint: string; keys: { p256dh: string; auth: string } };
  }>(
    "/api/push/subscriptions",
    {
      schema: {
        body: {
          type: "object",
          required: ["endpoint", "keys"],
          additionalProperties: false,
          properties: {
            endpoint: { type: "string", pattern: "^https://", maxLength: 1000 },
            keys: {
              type: "object",
              required: ["p256dh", "auth"],
              additionalProperties: false,
              properties: {
                p256dh: { type: "string", maxLength: 200 },
                auth: { type: "string", maxLength: 100 },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user;
      if (!user || user.device)
        return reply.code(401).send({ error: "Log in first" });
      const { endpoint, keys } = request.body;
      db.prepare(
        `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
      ).run(
        newId(),
        user.id,
        endpoint,
        keys.p256dh,
        keys.auth,
        now().toISOString(),
      );
      return reply.code(204).send();
    },
  );
  app.delete<{ Body: { endpoint: string } }>(
    "/api/push/subscriptions",
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.code(401).send({ error: "Log in first" });
      db.prepare(
        "DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?",
      ).run(request.body?.endpoint ?? "", user.id);
      return reply.code(204).send();
    },
  );
}
