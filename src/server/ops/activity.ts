import type { DraggingMessage, PlaylistActivity } from "../../shared/live.js";
import type { Db } from "../db/db.js";
import type { Client, Live } from "../live/live.js";
import { allows, isMember, memberRoles } from "../auth/members.js";

/**
 * Who has a playlist open and who drags which entry where, on `activity:<playlist id>`:
 * following it is having the playlist open, and only members may. The team's dragging
 * messages update it. It's kept in memory, so a restart only drops drags in progress.
 */
export function attachActivity(live: Live, db: Db) {
  const open = new Map<
    string,
    Map<
      Client,
      {
        userId: string;
        name: string;
        avatar: string | null;
        drag: { entry: string; index: number } | null;
      }
    >
  >();

  const list = (playlistId: string): PlaylistActivity => {
    const clients = [...(open.get(playlistId)?.values() ?? [])];
    const viewers = new Map(clients.map((c) => [c.userId, c]));
    return {
      viewers: [...viewers.values()]
        .map(({ userId, name, avatar }) => ({ userId, name, avatar }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      drags: clients.flatMap(({ userId, name, drag }) =>
        drag ? [{ userId, name, ...drag }] : [],
      ),
    };
  };
  const publish = (playlistId: string) =>
    live.publish(`activity:${playlistId}`, list(playlistId));
  const communityOf = (playlistId: string) =>
    db
      .prepare(
        "SELECT community_id FROM playlists WHERE id = ? AND deleted_at IS NULL",
      )
      .pluck()
      .get(playlistId) as string | undefined;

  live.onSubscribe("activity:", (topic, client) => {
    const playlistId = topic.slice("activity:".length);
    const communityId = communityOf(playlistId);
    const { user } = client;
    if (!user || !communityId || !isMember(db, communityId, user.id))
      return false;
    open.set(
      playlistId,
      (open.get(playlistId) ?? new Map()).set(client, {
        userId: user.id,
        name: user.displayName,
        avatar: user.avatar,
        drag: null,
      }),
    );
    publish(playlistId); // the others
    client.send({ type: "event", topic, data: list(playlistId) });
    return true;
  });

  live.onUnsubscribe("activity:", (topic, client) => {
    const playlistId = topic.slice("activity:".length);
    const clients = open.get(playlistId);
    if (!clients?.delete(client)) return;
    if (clients.size === 0) open.delete(playlistId);
    publish(playlistId);
  });

  live.onMessage("dragging", (client, message) => {
    const { playlist, entry, index } = message as DraggingMessage;
    const viewer =
      typeof playlist === "string"
        ? open.get(playlist)?.get(client)
        : undefined;
    const communityId = viewer && communityOf(playlist);
    if (
      !viewer ||
      !communityId ||
      typeof entry !== "string" ||
      (index !== null && !(Number.isInteger(index) && index >= 0)) ||
      !allows(memberRoles(db, communityId, viewer.userId), "team")
    )
      return;
    viewer.drag = index === null ? null : { entry, index };
    publish(playlist);
  });
}
