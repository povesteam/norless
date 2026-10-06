import type {
  OnlineMember,
  StageView,
  StageViewMessage,
} from "../../shared/live.js";
import type { Db } from "../db/db.js";
import type { Client, Live } from "./live.js";
import { isMember } from "../auth/members.js";

// ponytail: phones and tablets by User-Agent; good enough for an icon.
export const deviceOf = (userAgent: string) =>
  /Mobi|Android|iPhone|iPad/.test(userAgent) ? "phone" : "computer";

/**
 * Who is online, on `presence:<community slug>`: following it is being online, and
 * only members may. Each connection counts as a device of its person. A member's
 * musicians or vocalists view reports what it shows, which
 * makes that device online too, so the Big screen draws it.
 */
export function attachPresence(live: Live, db: Db) {
  type Device = {
    userId: string;
    name: string;
    avatar: string | null;
    id: number;
    /** Following presence itself, not only reporting a view. */
    follows: boolean;
    view: StageView | null;
  };
  const online = new Map<string, Map<Client, Device>>();
  let next = 0;

  const list = (slug: string): OnlineMember[] => {
    const people = new Map<string, OnlineMember>();
    for (const [client, device] of online.get(slug) ?? []) {
      const person = people.get(device.userId) ?? {
        userId: device.userId,
        name: device.name,
        avatar: device.avatar,
        devices: [],
        views: [],
      };
      person.devices.push(deviceOf(client.userAgent));
      if (device.view) person.views.push({ ...device.view, id: device.id });
      people.set(device.userId, person);
    }
    return [...people.values()]
      .map((p) => ({ ...p, devices: p.devices.sort() }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };
  const communityOf = (slug: string) =>
    db
      .prepare(
        "SELECT id FROM communities WHERE slug = ? AND deleted_at IS NULL",
      )
      .pluck()
      .get(slug) as string | undefined;
  /** The client's device in the community, made when it comes online. */
  const deviceIn = (slug: string, client: Client) => {
    const { user } = client;
    if (!user) return null;
    const devices = online.get(slug) ?? new Map<Client, Device>();
    online.set(slug, devices);
    const device = devices.get(client) ?? {
      userId: user.id,
      name: user.displayName,
      avatar: user.avatar,
      id: ++next,
      follows: false,
      view: null,
    };
    devices.set(client, device);
    return device;
  };

  live.onSubscribe("presence:", (topic, client) => {
    const slug = topic.slice("presence:".length);
    const communityId = communityOf(slug);
    if (
      !client.user ||
      !communityId ||
      !isMember(db, communityId, client.user.id)
    )
      return false;
    const device = deviceIn(slug, client);
    if (device) device.follows = true;
    live.publish(topic, list(slug)); // the others
    client.send({ type: "event", topic, data: list(slug) });
    return true;
  });

  live.onMessage("stage-view", (client, message) => {
    const { community: slug, view } = message as StageViewMessage;
    if (typeof slug !== "string" || JSON.stringify(view ?? null).length > 2000)
      return;
    const communityId = communityOf(slug);
    if (
      !client.user ||
      !communityId ||
      !isMember(db, communityId, client.user.id)
    )
      return;
    const device = deviceIn(slug, client);
    if (!device) return;
    device.view = view && typeof view === "object" ? view : null;
    if (!device.view && !device.follows) online.get(slug)?.delete(client);
    live.publish(`presence:${slug}`, list(slug));
  });

  live.onClose((client) => {
    for (const [slug, clients] of online) {
      if (!clients.delete(client)) continue;
      if (clients.size === 0) online.delete(slug);
      live.publish(`presence:${slug}`, list(slug));
    }
  });
}
