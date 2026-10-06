import type { LiveState } from "../../shared/live.js";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";
import { leaderOf } from "../playlists/playlists.js";
import { entriesOf } from "./live-act.js";

/** A song live this long counts as played. */
export const PLAY_SECONDS = 30;

/** Keeps what the screens show now, every slide. */
export const logSlide = (
  db: Db,
  communityId: string,
  state: LiveState,
  at: Date,
  userId: string,
  room: string,
) => {
  const entry = entriesOf(db, communityId, state.playlistId).find(
    (e) => e.id === state.entryId,
  );
  db.prepare(
    `INSERT INTO slide_log (id, community_id, room_id, playlist_id, entry_id, song_id, slide, blank, mode, at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    communityId,
    room,
    state.playlistId,
    entry ? state.entryId : null,
    entry?.song?.id ?? null,
    state.slide,
    state.blank ? 1 : 0,
    state.mode,
    at.toISOString(),
    userId,
  );
};

/** Records the live song as played, when it was live long enough. */
export const recordPlay = (
  db: Db,
  communityId: string,
  state: LiveState,
  at: Date,
  room: string,
) => {
  if (!state.entryId || !state.since) return;
  const entry = entriesOf(db, communityId, state.playlistId).find(
    (e) => e.id === state.entryId,
  );
  const seconds = (at.getTime() - Date.parse(state.since)) / 1000;
  if (!entry?.song || seconds < PLAY_SECONDS) return;
  db.prepare(
    `INSERT INTO plays (id, community_id, song_id, room_id, playlist_id, mode, played_at, ended_at, created_at, updated_at, created_by, led_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    communityId,
    entry.song.id,
    room,
    state.playlistId,
    state.mode,
    state.since,
    at.toISOString(),
    at.toISOString(),
    at.toISOString(),
    state.changedBy?.userId ?? null,
    // Who led it, for statistics.
    leaderOf(db, communityId, entry.id),
  );
};
