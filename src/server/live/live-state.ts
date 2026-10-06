import type { FastifyInstance } from "fastify";
import {
  goesLive,
  type LiveAction,
  type LiveState,
  type Mode,
  pagesOf,
} from "../../shared/live.js";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import type { Live } from "./live.js";
import { isMember } from "../auth/members.js";
import { activeRecording, markLive } from "./recordings.js";
import { leaderOf } from "../playlists/playlists.js";
import { deviceOf } from "./presence.js";
import { eventNow } from "../schedule/schedule-routes.js";
import type { ScheduleEvent } from "../schedule/schedule.js";
import { playlistTimes, songLengths } from "../playlists/times.js";
import type { Community } from "../songs/search.js";
import { getSong } from "../songs/songs.js";
import { newId } from "../ids.js";
import { followOf, type LiveView, unnamed } from "./live-view.js";
import {
  act,
  actionSchema,
  entriesOf,
  modeOf,
  practiceRoom,
  slideCount,
} from "./live-act.js";
import { logSlide, recordPlay } from "./live-log.js";

const idle = (mode: Mode = "rehearsal"): LiveState => ({
  playlistId: null,
  entryId: null,
  slide: 0,
  blank: false,
  mode,
  changedBy: null,
  changedAt: null,
  since: null,
});

/** The community's room for v1: its first one, made when it has none. */
export function defaultRoom(db: Db, communityId: string, now = new Date()) {
  const room = db
    .prepare(
      "SELECT id, live FROM rooms WHERE community_id = ? AND deleted_at IS NULL AND temporary = 0 ORDER BY created_at, id LIMIT 1",
    )
    .get(communityId) as { id: string; live: string | null } | undefined;
  if (room) return room;
  const id = newId();
  const at = now.toISOString();
  db.prepare(
    "INSERT INTO rooms (id, community_id, name, created_at, updated_at) VALUES (?, ?, 'Main room', ?, ?)",
  ).run(id, communityId, at, at);
  return { id, live: null };
}

/**
 * The room's live state, one per community in v1. Everyone may follow `live:<slug>`;
 * the team changes it. It's kept in memory and on the room, for restarts.
 */
export function attachLiveState(
  app: FastifyInstance,
  {
    db,
    live,
    findCommunity,
    now = () => new Date(),
  }: {
    db: Db;
    live: Live;
    findCommunity: (slug: string) => (Community & { slug: string }) | undefined;
    now?: () => Date;
  },
) {
  // Each room's state, by room id: the community's main room, and its practice rooms
  //. A null room is the main room.
  const states = new Map<string, LiveState>();
  // Who listens for the tempo, per room; not kept across restarts.
  const tempos = new Map<string, NonNullable<LiveView["tempo"]>>();
  const roomOf = (communityId: string, roomId: string | null = null) =>
    roomId ?? defaultRoom(db, communityId).id;
  const stateOf = (communityId: string, roomId: string | null = null) => {
    const id = roomOf(communityId, roomId);
    const known = states.get(id);
    if (known) return known;
    const live = db
      .prepare("SELECT live FROM rooms WHERE id = ?")
      .pluck()
      .get(id) as string | null | undefined;
    const state = live ? (JSON.parse(live) as LiveState) : idle();
    states.set(id, state);
    return state;
  };
  const save = (
    communityId: string,
    state: LiveState,
    roomId: string | null = null,
  ) => {
    const id = roomOf(communityId, roomId);
    states.set(id, state);
    db.prepare("UPDATE rooms SET live = ? WHERE id = ?").run(
      JSON.stringify(state),
      id,
    );
  };

  const view = (
    community: Community,
    roomId: string | null = null,
  ): LiveView => {
    const state = stateOf(community.id, roomId);
    const entries = entriesOf(db, community.id, state.playlistId);
    const index = entries.findIndex((e) => e.id === state.entryId);
    const entry = entries[index] ?? null;
    const song = entry?.song ? getSong(db, community.id, entry.song.id) : null;
    // Recordings belong to the main room.
    const recording = roomId ? null : activeRecording(db, community.id);
    return {
      ...state,
      // With nothing live, what the next entry will get: the room's, or the schedule's.
      mode: entry ? state.mode : modeOf(db, community.id, roomId, new Date()),
      message: state.message ?? null,
      page: state.page ?? null,
      verse: state.verse ?? null,
      entry,
      song,
      slides: song
        ? slideCount(song, community.languages)
        : entry?.kind === "slides"
          ? Math.max(1, pagesOf(entry))
          : 1,
      next: entry ? (entries.slice(index + 1).find(goesLive) ?? null) : null,
      event: eventNow(db, community.id, new Date()),
      recording: recording ? { by: recording.by } : null,
      tempo: tempos.get(roomOf(community.id, roomId)) ?? null,
      ledBy: entry?.song ? leaderName(community.id, entry.id) : null,
    };
  };
  const leaderName = (communityId: string, entryId: string) => {
    const id = leaderOf(db, communityId, entryId);
    return id
      ? ((db
          .prepare("SELECT display_name FROM users WHERE id = ?")
          .pluck()
          .get(id) as string | undefined) ?? null)
      : null;
  };

  // Song lengths change only with new plays; worked out again every 10 minutes.
  const measured = new Map<
    string,
    { at: number; value: ReturnType<typeof songLengths> }
  >();
  const timeZoneOf = (communityId: string) =>
    db
      .prepare("SELECT time_zone FROM communities WHERE id = ?")
      .pluck()
      .get(communityId) as string;
  app.get<{ Params: { slug: string; id: string } }>(
    "/api/communities/:slug/playlists/:id/times",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const at = now();
      const zone = timeZoneOf(community.id);
      const cached = measured.get(community.id);
      const value =
        cached && at.getTime() - cached.at < 10 * 60_000
          ? cached.value
          : songLengths(db, community, zone);
      if (value !== cached?.value)
        measured.set(community.id, { at: at.getTime(), value });
      const events = db
        .prepare(
          "SELECT * FROM schedule_events WHERE community_id = ? AND deleted_at IS NULL",
        )
        .all(community.id) as ScheduleEvent[];
      return (
        playlistTimes(
          db,
          community,
          request.params.id,
          stateOf(community.id),
          events,
          zone,
          at,
          value,
        ) ?? reply.code(404).send({ error: "Not found" })
      );
    },
  );

  /** A live topic's community and room: `<slug>` is the main room, `<slug>/<room>` a practice room. */
  const placeOf = (rest: string) => {
    const [slug = "", roomId = null] = rest.split("/");
    const community = findCommunity(slug);
    if (!community) return null;
    if (roomId && !practiceRoom(db, community.id, roomId)) return null;
    return { community, roomId };
  };
  // Members get who changed the slide; everyone else the same without names.
  live.onSubscribe("live:", (topic, client) => {
    const place = placeOf(topic.slice("live:".length));
    if (
      !place ||
      !client.user ||
      !isMember(db, place.community.id, client.user.id)
    )
      return false;
    client.send({
      type: "event",
      topic,
      data: view(place.community, place.roomId),
    });
    return true;
  });
  live.onSubscribe("live-public:", (topic, client) => {
    const place = placeOf(topic.slice("live-public:".length));
    if (!place) return false;
    client.send({
      type: "event",
      topic,
      data: unnamed(view(place.community, place.roomId)),
    });
    return true;
  });
  live.onSubscribe("follow:", (topic, client) => {
    const community = findCommunity(topic.slice("follow:".length));
    if (!community) return false;
    client.send({ type: "event", topic, data: followOf(view(community)) });
    return true;
  });

  app.get<{ Params: { slug: string }; Querystring: { room?: string } }>(
    "/api/communities/:slug/live",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const roomId = request.query.room ?? null;
      if (roomId && !practiceRoom(db, community.id, roomId))
        return reply.code(404).send({ error: "No such room" });
      const member =
        request.user && isMember(db, community.id, request.user.id);
      const shown = view(community, roomId);
      return member ? shown : unnamed(shown);
    },
  );

  app.post<{ Params: { slug: string }; Body: LiveAction & { room?: string } }>(
    "/api/communities/:slug/live",
    {
      schema: { body: actionSchema },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "team");
      if (!userId || !request.user) return reply;
      const action = request.body;
      if (
        (action.type === "go" && typeof action.entryId !== "string") ||
        (action.type === "blank" && typeof action.blank !== "boolean") ||
        (action.type === "message" && action.text === undefined) ||
        (action.type === "page" && action.pageId === undefined) ||
        (action.type === "verse" && action.verse === undefined) ||
        (action.type === "timer" &&
          (typeof action.entryId !== "string" || action.seconds === undefined))
      )
        return reply.code(400).send({ error: "Incomplete action" });

      const roomId = request.body.room ?? null;
      if (roomId && !practiceRoom(db, community.id, roomId))
        return reply.code(404).send({ error: "No such room" });
      const at = now();
      const state = stateOf(community.id, roomId);
      const next = act(db, community, state, action, at, roomId, userId);
      // The timer's seconds stay on the entry, for the next start.
      if (next && action.type === "timer" && action.seconds)
        db.prepare("UPDATE entries SET slide_seconds = ? WHERE id = ?").run(
          action.seconds,
          action.entryId,
        );
      if (next) {
        if (next.entryId !== state.entryId) {
          recordPlay(db, community.id, state, at, roomOf(community.id, roomId));
          // The service's chapters come from the main room only.
          if (!roomId && next.playlistId && next.entryId)
            db.prepare(
              `INSERT INTO live_log (id, community_id, playlist_id, entry_id, mode, at, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              newId(),
              community.id,
              next.playlistId,
              next.entryId,
              next.mode,
              at.toISOString(),
              userId,
            );
        }
        save(
          community.id,
          {
            ...next,
            changedBy: {
              userId,
              name: request.user.displayName,
              device: deviceOf(request.headers["user-agent"] ?? ""),
            },
            changedAt: at.toISOString(),
          },
          roomId,
        );
        if (
          next.entryId !== state.entryId ||
          next.slide !== state.slide ||
          next.blank !== state.blank
        )
          logSlide(
            db,
            community.id,
            next,
            at,
            userId,
            roomOf(community.id, roomId),
          );
        publish(community, roomId);
      }
      return view(community, roomId);
    },
  );

  // The listening device switches on and off, and sends what it hears.
  app.post<{
    Params: { slug: string };
    Body: {
      listening: boolean;
      measured?: number | null;
      drift?: "fast" | "slow" | null;
      room?: string;
    };
  }>(
    "/api/communities/:slug/live/tempo",
    {
      schema: {
        body: {
          type: "object",
          required: ["listening"],
          additionalProperties: false,
          properties: {
            listening: { type: "boolean" },
            measured: {
              anyOf: [
                { type: "number", minimum: 0, maximum: 600 },
                { type: "null" },
              ],
            },
            drift: { enum: ["fast", "slow", null] },
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
      const { listening, measured = null, drift = null } = request.body;
      const roomId = request.body.room ?? null;
      if (roomId && !practiceRoom(db, community.id, roomId))
        return reply.code(404).send({ error: "No such room" });
      const key = roomOf(community.id, roomId);
      const current = tempos.get(key);
      if (!listening) {
        // Only the listener stops it; another device switching off changes nothing.
        if (current?.listenerId === userId) tempos.delete(key);
      } else
        tempos.set(key, {
          listenerId: userId,
          listener: request.user.displayName,
          measured: measured === null ? null : Math.round(measured),
          drift,
        });
      publish(community, roomId);
      return reply.code(204).send();
    },
  );

  // Follow-along phones get at most one update every 200 ms, however fast the clicks.
  const followTimers = new Map<string, ReturnType<typeof setTimeout>>();
  app.addHook("onClose", async () => {
    for (const timer of followTimers.values()) clearTimeout(timer);
  });
  /**
   * The live view to members, without names to everyone, and soon to phones following.
   * A practice room's goes out on its own topics; recordings and phones follow the main room.
   */
  const publish = (
    community: Community & { slug: string },
    roomId: string | null = null,
  ) => {
    const shown = view(community, roomId);
    const place = roomId ? `${community.slug}/${roomId}` : community.slug;
    live.publish(`live:${place}`, shown);
    live.publish(`live-public:${place}`, unnamed(shown));
    if (roomId) return;
    // Running recordings note what's live, to cut and mark them later.
    markLive(db, community.id, shown);
    if (followTimers.has(community.slug)) return;
    followTimers.set(
      community.slug,
      setTimeout(() => {
        followTimers.delete(community.slug);
        live.publish(`follow:${community.slug}`, followOf(view(community)));
      }, 200),
    );
  };

  /**
   * A song was saved or a playlist changed: the live view goes out again where that
   * playlist or song is live, so a new key or new chords show at once.
   */
  const changed = (topic: string) => {
    const [kind, id] = topic.split(":");
    if (kind !== "song" && kind !== "playlist") return;
    for (const [roomId, state] of states) {
      if (!state.entryId) continue;
      if (kind === "playlist" && state.playlistId !== id) continue;
      const place = roomPlace(roomId);
      if (!place) continue;
      const shown = view(place.community, place.practice);
      if (kind === "song" && shown.song?.id !== id) continue;
      publish(place.community, place.practice);
    }
  };

  /** A kept room's community, and its id when it's a practice room. */
  const roomPlace = (roomId: string) => {
    const room = db
      .prepare(
        "SELECT c.slug, r.temporary FROM rooms r JOIN communities c ON c.id = r.community_id WHERE r.id = ? AND r.deleted_at IS NULL",
      )
      .get(roomId) as { slug: string; temporary: number } | undefined;
    const community = room ? findCommunity(room.slug) : undefined;
    return community && room
      ? { community, practice: room.temporary ? roomId : null }
      : null;
  };

  // The slides' timer: the server moves the pages, looping, so every
  // screen follows with the controller's laptop closed.
  const ticker = setInterval(() => {
    const at = now();
    for (const [roomId, state] of states) {
      const { timer } = state;
      if (!timer || at.getTime() - Date.parse(timer.at) < timer.seconds * 1000)
        continue;
      const place = roomPlace(roomId);
      if (!place) continue;
      const shown = view(place.community, place.practice);
      const moved: LiveState =
        shown.entry?.id === timer.entryId && shown.entry.kind === "slides"
          ? {
              ...state,
              slide: (state.slide + 1) % shown.slides,
              blank: false,
              changedAt: at.toISOString(),
              timer: { ...timer, at: at.toISOString() },
            }
          : { ...state, timer: null };
      save(place.community.id, moved, place.practice);
      if (moved.timer)
        logSlide(db, place.community.id, moved, at, timer.by, roomId);
      publish(place.community, place.practice);
    }
  }, 1000);
  ticker.unref();
  app.addHook("onClose", async () => clearInterval(ticker));

  /** Ends a practice room: its state goes, and its devices go back to the main room. */
  const forget = (roomId: string) => {
    states.delete(roomId);
    tempos.delete(roomId);
  };

  return {
    stateOf,
    changed,
    viewOf: view,
    republish: publish,
    forget,
  };
}
