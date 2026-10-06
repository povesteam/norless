import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import type { Live } from "./live.js";
import { isMember } from "../auth/members.js";
import type { Community } from "../songs/search.js";

/** Where a chord comes from: a MIDI piano, the mixer, or a microphone. */
export type ChordSource = "midi" | "mixer" | "mic";

/** The chord played now, from the best device sharing, and whose it is. */
export type LiveChord = {
  chord: string | null;
  source: ChordSource;
  name: string;
};

/** MIDI knows the chord; the mixer hears one instrument; a microphone, the room. */
const rank: Record<ChordSource, number> = { midi: 3, mixer: 2, mic: 1 };
/** A device that hasn't sent for this long stopped sharing. */
const QUIET_MS = 15_000;

type Sharing = LiveChord & { at: number };

/**
 * The live chord: team members' devices share the chord they
 * play or hear; members following the room get the best source's, MIDI over the mixer
 * over a microphone, the latest among equals. Kept in memory: it's
 * of the moment.
 */
export function attachLiveChord(
  app: FastifyInstance,
  {
    db,
    live,
    findCommunity,
  }: {
    db: Db;
    live: Live;
    findCommunity: (slug: string) => (Community & { slug: string }) | undefined;
  },
) {
  // Per room (`<slug>` or `<slug>/<room>`), per member sharing.
  const rooms = new Map<string, Map<string, Sharing>>();
  const shown = new Map<string, string>();

  const practiceRoom = (communityId: string, roomId: string) =>
    !!db
      .prepare(
        "SELECT 1 FROM rooms WHERE id = ? AND community_id = ? AND temporary = 1 AND deleted_at IS NULL",
      )
      .get(roomId, communityId);

  const best = (place: string, now = Date.now()): LiveChord | null => {
    const sharing = rooms.get(place);
    if (!sharing) return null;
    let top: Sharing | null = null;
    for (const [id, s] of sharing) {
      if (now - s.at > QUIET_MS) {
        sharing.delete(id);
        continue;
      }
      if (
        !top ||
        rank[s.source] > rank[top.source] ||
        (rank[s.source] === rank[top.source] && s.at > top.at)
      )
        top = s;
    }
    return top && { chord: top.chord, source: top.source, name: top.name };
  };
  const publish = (place: string) => {
    const chord = best(place);
    const json = JSON.stringify(chord);
    if (shown.get(place) === json) return;
    shown.set(place, json);
    live.publish(`live-chord:${place}`, chord);
  };
  // A device that went quiet: the next best shows.
  const sweep = setInterval(() => {
    for (const place of rooms.keys()) publish(place);
  }, 5000);
  sweep.unref();
  app.addHook("onClose", async () => clearInterval(sweep));

  live.onSubscribe("live-chord:", (topic, client) => {
    const place = topic.slice("live-chord:".length);
    const [slug = "", roomId] = place.split("/");
    const community = findCommunity(slug);
    if (
      !community ||
      !client.user ||
      !isMember(db, community.id, client.user.id) ||
      (roomId && !practiceRoom(community.id, roomId))
    )
      return false;
    client.send({ type: "event", topic, data: best(place) });
    return true;
  });

  app.post<{
    Params: { slug: string };
    Body: {
      sharing: boolean;
      source?: ChordSource;
      chord?: string | null;
      room?: string;
    };
  }>(
    "/api/communities/:slug/live/chord",
    {
      schema: {
        body: {
          type: "object",
          required: ["sharing"],
          additionalProperties: false,
          properties: {
            sharing: { type: "boolean" },
            source: { enum: ["midi", "mixer", "mic"] },
            chord: {
              // Null first: coercion would make null an empty string.
              anyOf: [{ type: "null" }, { type: "string", maxLength: 20 }],
            },
            room: { type: "string", maxLength: 100 },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "team");
      if (!userId || !request.user) return reply;
      const { sharing, source = "mic", chord = null, room } = request.body;
      if (room && !practiceRoom(community.id, room))
        return reply.code(404).send({ error: "No such room" });
      const place = room ? `${community.slug}/${room}` : community.slug;
      const all = rooms.get(place) ?? new Map<string, Sharing>();
      rooms.set(place, all);
      if (sharing)
        all.set(userId, {
          chord,
          source,
          name: request.user.displayName,
          at: Date.now(),
        });
      else all.delete(userId);
      publish(place);
      return reply.code(204).send();
    },
  );
}
