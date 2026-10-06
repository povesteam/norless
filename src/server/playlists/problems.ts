import type { FastifyInstance } from "fastify";
import type { LiveState } from "../../shared/live.js";
import { slideScale } from "../../shared/song-render.js";
import { parseSong } from "../../shared/song-text.js";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import { getPlaylist } from "./playlists.js";
import { pastServices, type ScheduleEvent } from "../schedule/schedule.js";
import { listScreens } from "../live/screens.js";
import type { Community } from "../songs/search.js";
import { getSong } from "../songs/songs.js";

/** Below this, compared with a four-line slide, text is too small to read. */
const SMALLEST = 0.7;

export type Problem =
  /** A screen usually there during services that isn't connected. */
  | { kind: "screen"; screenId: string; name: string }
  /** A song without a version in a language one of the room's audience screens shows. */
  | { kind: "translation"; entryId: string; language: string }
  /** Slides that shrink too much to read on the projectors of a language. */
  | { kind: "small"; entryId: string; language: string; slides: number[] }
  /** A song without a key, when the room has musicians screens. */
  | { kind: "key"; entryId: string }
  /** A song the owners excluded after it was added. */
  | { kind: "excluded"; entryId: string; reason: string }
  /** Slides from a file still being prepared, or that couldn't be. */
  | { kind: "slides"; entryId: string; state: "preparing" | "failed" };

/** Screens connected during at least 3 of the last 4 scheduled services. */
function usualScreens(
  db: Db,
  communityId: string,
  events: ScheduleEvent[],
  timeZone: string,
  now: Date,
) {
  const services = pastServices(now, events, timeZone, 4);
  if (services.length < 3) return new Set<string>();
  const during = db.prepare(
    `SELECT DISTINCT screen_id FROM screen_connections
     WHERE community_id = ? AND connected_at < ? AND coalesce(disconnected_at, ?) > ?`,
  );
  const counts = new Map<string, number>();
  for (const { start, end } of services)
    for (const id of during
      .pluck()
      .all(
        communityId,
        end.toISOString(),
        now.toISOString(),
        start.toISOString(),
      ) as string[])
      counts.set(id, (counts.get(id) ?? 0) + 1);
  return new Set([...counts].filter(([, n]) => n >= 3).map(([id]) => id));
}

/** What could go wrong with a playlist on the room's screens; empty when nothing. */
export function playlistProblems(
  db: Db,
  community: Community,
  playlistId: string,
  {
    state,
    connected,
    events,
    timeZone,
    now = new Date(),
  }: {
    state: LiveState;
    connected: Set<string>;
    events: ScheduleEvent[];
    timeZone: string;
    now?: Date;
  },
): Problem[] | null {
  const playlist = getPlaylist(db, community.id, playlistId);
  if (!playlist) return null;
  const screens = listScreens(db, community.id);
  const problems: Problem[] = [];

  if (state.mode === "service") {
    const usual = usualScreens(db, community.id, events, timeZone, now);
    for (const screen of screens)
      if (usual.has(screen.id) && !connected.has(screen.id))
        problems.push({
          kind: "screen",
          screenId: screen.id,
          name: screen.name,
        });
  }

  // Translations count for the audience's screens only: the team reads the stage's,
  // which show a song's first version anyway.
  const shown = [
    ...new Set(
      screens
        .filter((s) => s.type === "projector" || s.type === "overlay")
        .flatMap((s) => s.languages),
    ),
  ];
  const projected = new Set(
    screens.filter((s) => s.type === "projector").flatMap((s) => s.languages),
  );
  const musicians = screens.some((s) => s.type === "musicians");
  for (const entry of playlist.entries) {
    const unready = entry.slides?.files.find((f) => f.state !== "ready");
    if (unready?.state === "preparing" || unready?.state === "failed")
      problems.push({
        kind: "slides",
        entryId: entry.id,
        state: unready.state,
      });
    if (!entry.song || entry.song.deleted) continue;
    const song = getSong(db, community.id, entry.song.id);
    if (!song) continue;
    if (song.excluded)
      problems.push({
        kind: "excluded",
        entryId: entry.id,
        reason: song.excluded.reason,
      });
    // A song in none of the screens' languages, like an English-only song, shows its
    // first version on all of them alike: no missing translation.
    const inSome = shown.some((l) =>
      song.versions.some((v) => v.language === l),
    );
    for (const language of shown) {
      const version = song.versions.find((v) => v.language === language);
      if (!version) {
        if (inSome)
          problems.push({ kind: "translation", entryId: entry.id, language });
        continue;
      }
      if (!projected.has(language)) continue;
      const slides = parseSong(version.text)
        .slides.map((slide, i) => ({
          i,
          scale: slideScale(
            slide.lines.filter((l) => !l.chordsOnly).map((l) => l.text),
          ),
        }))
        .filter(({ scale }) => scale < SMALLEST)
        .map(({ i }) => i);
      if (slides.length)
        problems.push({ kind: "small", entryId: entry.id, language, slides });
    }
    if (musicians && !song.keySignature)
      problems.push({ kind: "key", entryId: entry.id });
  }
  return problems;
}

/** GET …/playlists/<id>/problems, for the team. */
export function attachProblems(
  app: FastifyInstance,
  {
    db,
    findCommunity,
    stateOf,
    connectedScreens,
  }: {
    db: Db;
    findCommunity: (slug: string) => Community | undefined;
    stateOf: (communityId: string) => LiveState;
    connectedScreens: () => Set<string>;
  },
) {
  app.get<{ Params: { slug: string; id: string } }>(
    "/api/communities/:slug/playlists/:id/problems",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      if (!requireRole(db, request, reply, community.id, "team")) return reply;
      const events = db
        .prepare(
          "SELECT * FROM schedule_events WHERE community_id = ? AND deleted_at IS NULL",
        )
        .all(community.id) as ScheduleEvent[];
      const timeZone = db
        .prepare("SELECT time_zone FROM communities WHERE id = ?")
        .pluck()
        .get(community.id) as string;
      return (
        playlistProblems(db, community, request.params.id, {
          state: stateOf(community.id),
          connected: connectedScreens(),
          events,
          timeZone,
        }) ?? reply.code(404).send({ error: "Not found" })
      );
    },
  );
}
