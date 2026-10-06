import type { FastifyInstance } from "fastify";
import type { Db } from "../db/db.js";
import type { Live } from "../live/live.js";
import { createPlaylist } from "./playlists.js";
import {
  LATE_MINUTES,
  localTime,
  nextService,
  pastServices,
  type ScheduleEvent,
} from "../schedule/schedule.js";

const CHECK_MS = 5 * 60_000;

/**
 * The next service's playlist (service-schedule spec): once a service has ended,
 * counting its late minutes, the community's next service gets an empty playlist,
 * untitled, so each viewer sees its date in their language, unless someone made a
 * playlist since. Rehearsals get none. Returns the communities that got one.
 */
export function makeNextPlaylists(db: Db, now = new Date()) {
  const made: { slug: string; id: string }[] = [];
  const communities = db
    .prepare(
      "SELECT id, slug, time_zone AS timeZone FROM communities WHERE deleted_at IS NULL",
    )
    .all() as {
    id: string;
    slug: string;
    timeZone: string;
  }[];
  for (const community of communities) {
    const events = db
      .prepare(
        "SELECT * FROM schedule_events WHERE community_id = ? AND deleted_at IS NULL",
      )
      .all(community.id) as ScheduleEvent[];
    const [ended] = pastServices(
      new Date(now.getTime() - LATE_MINUTES * 60_000),
      events,
      community.timeZone,
      1,
    );
    if (!ended) continue;
    const since = db
      .prepare(
        "SELECT 1 FROM playlists WHERE community_id = ? AND created_at >= ? AND deleted_at IS NULL",
      )
      .get(community.id, ended.end.toISOString());
    if (since) continue;
    // The next one from now: after downtime, not a service that already happened.
    const next = nextService(now, events, community.timeZone);
    if (!next) continue;
    // Untitled: its date names it, in each viewer's language.
    const { id } = createPlaylist(
      db,
      null,
      { communityId: community.id, userId: null, now },
      {
        eventId: next.id,
        date: localTime(next.start, community.timeZone).date,
      },
    );
    made.push({ slug: community.slug, id });
  }
  return made;
}

/** Checks every few minutes, so a server that was down catches up when it starts. */
export function attachNextPlaylists(
  app: FastifyInstance,
  { db, live }: { db: Db; live: Live },
) {
  const check = () => {
    for (const { slug } of makeNextPlaylists(db))
      live.publish(`playlists:${slug}`, {});
  };
  const timer = setInterval(check, CHECK_MS);
  timer.unref();
  app.addHook("onReady", async () => check());
  app.addHook("onClose", async () => clearInterval(timer));
}
