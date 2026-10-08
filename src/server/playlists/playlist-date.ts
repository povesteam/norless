import type { Db } from "../db/db.js";
import { eventsOn } from "../schedule/schedule.js";
import { scheduleOf, type Who } from "./playlists.js";

/**
 * Moves a playlist to another day, for a service that moved or a playlist made for the
 * wrong week: it plans that day's first service no other playlist plans (else its first
 * service), so who leads its songs follows; without a service that day, only the day.
 * False when it doesn't exist or is archived.
 */
export function changePlaylistDate(
  db: Db,
  id: string,
  date: string,
  { communityId, userId, now = new Date() }: Who,
): boolean {
  const { timeZone, events } = scheduleOf(db, communityId);
  const services = eventsOn(date, events, timeZone).filter(
    (event) => event.type === "service",
  );
  const taken = db.prepare(
    `SELECT 1 FROM playlists WHERE community_id = ? AND service_event_id = ?
       AND service_date = ? AND id != ? AND deleted_at IS NULL`,
  );
  const service =
    services.find((event) => !taken.get(communityId, event.id, date, id)) ??
    services[0];
  const at = now.toISOString();
  const { changes } = db
    .prepare(
      `UPDATE playlists SET service_event_id = ?, service_date = ?, updated_at = ?, updated_by = ?
       WHERE id = ? AND community_id = ? AND deleted_at IS NULL AND archived_at IS NULL`,
    )
    .run(service?.id ?? null, date, at, userId, id, communityId);
  return changes > 0;
}
