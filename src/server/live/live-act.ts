import {
  goesLive,
  type LiveAction,
  type LiveState,
  type Mode,
  pagesOf,
  stepFrom,
} from "../../shared/live.js";
import { parseSong } from "../../shared/song-text.js";
import type { Db } from "../db/db.js";
import { listPages } from "../playlists/pages.js";
import { type Entry, getPlaylist } from "../playlists/playlists.js";
import { modeAt, nextEvent } from "../schedule/schedule-routes.js";
import type { Community } from "../songs/search.js";
import { getSong, type Song } from "../songs/songs.js";

/** The welcome page's id among the pages. */
export const WELCOME = "welcome";

/** The slides a song has: in the community's first language it has a version in. */
export function slideCount(song: Song, languages: string[]): number {
  const version =
    languages
      .map((l) => song.versions.find((v) => v.language === l))
      .find(Boolean) ?? song.versions[0];
  return Math.max(1, version ? parseSong(version.text).slides.length : 1);
}

/** A practice room of the community that hasn't ended, or undefined. */
export const practiceRoom = (db: Db, communityId: string, roomId: string) =>
  db
    .prepare(
      "SELECT id, mode FROM rooms WHERE id = ? AND community_id = ? AND temporary = 1 AND deleted_at IS NULL",
    )
    .get(roomId, communityId) as
    { id: string; mode: string | null } | undefined;

export const entriesOf = (
  db: Db,
  communityId: string,
  playlistId: string | null,
) =>
  playlistId ? (getPlaylist(db, communityId, playlistId)?.entries ?? []) : [];
const slidesOf = (db: Db, community: Community, entry: Entry | undefined) => {
  // A slides entry's pages are its slides.
  if (entry?.kind === "slides") return Math.max(1, pagesOf(entry));
  if (!entry?.song) return 1;
  const song = getSong(db, community.id, entry.song.id);
  return song ? slideCount(song, community.languages) : 1;
};

/** The mode a room's entries go live in: a practice room's own, else the schedule's. */
export const modeOf = (
  db: Db,
  communityId: string,
  roomId: string | null,
  at: Date,
) =>
  ((roomId && practiceRoom(db, communityId, roomId)?.mode) as Mode | null) ||
  (roomId ? "rehearsal" : modeAt(db, communityId, at));

/**
 * The state after an action, or null when nothing changes. Any action but a stage
 * message stops a slides entry's timer; the timer's own action starts it there, live
 * from the page it's on.
 */
export const act = (
  db: Db,
  community: Community,
  state: LiveState,
  action: LiveAction,
  at: Date,
  roomId: string | null = null,
  userId = "",
): LiveState | null => {
  if (action.type === "timer") {
    const entry = entriesOf(db, community.id, state.playlistId).find(
      (e) => e.id === action.entryId,
    );
    const there =
      state.entryId === action.entryId && entry?.kind === "slides"
        ? { ...state, blank: false, page: null, verse: null }
        : step(
            db,
            community,
            state,
            { type: "go", entryId: action.entryId },
            at,
            roomId,
          );
    const live = entriesOf(db, community.id, there?.playlistId ?? null).find(
      (e) => e.id === action.entryId,
    );
    if (!there || live?.kind !== "slides") return null;
    return {
      ...there,
      timer: action.seconds
        ? {
            entryId: action.entryId,
            seconds: action.seconds,
            at: at.toISOString(),
            by: userId,
          }
        : null,
    };
  }
  const next = step(db, community, state, action, at, roomId);
  return next?.timer && action.type !== "message"
    ? { ...next, timer: null }
    : next;
};

const step = (
  db: Db,
  community: Community,
  state: LiveState,
  action: Exclude<LiveAction, { type: "timer" }>,
  at: Date,
  roomId: string | null,
): LiveState | null => {
  // Blank (Esc) takes a projected page or verse down too; Show again returns the entry.
  if (action.type === "blank")
    return {
      ...state,
      blank: action.blank,
      page: action.blank ? null : state.page,
      verse: action.blank ? null : state.verse,
    };
  // A verse from bible.com over what's live, in the community's languages only.
  if (action.type === "verse") {
    const verse = action.verse
      ? Object.fromEntries(
          Object.entries(action.verse).filter(([language]) =>
            community.languages.includes(language),
          ),
        )
      : null;
    if (verse && !Object.keys(verse).length) return null;
    return { ...state, verse, page: null, blank: false };
  }
  if (action.type === "message")
    return { ...state, message: action.text?.trim() || null };
  // The built-in welcome page, with the next service's start for its countdown.
  if (action.type === "page" && action.pageId === WELCOME)
    return {
      ...state,
      page: {
        id: WELCOME,
        name: "Welcome",
        url: "",
        welcome: nextEvent(db, community.id, at),
      },
      verse: null,
      blank: false,
    };
  if (action.type === "page") {
    const page =
      action.pageId === null
        ? null
        : listPages(db, community.id).find((p) => p.id === action.pageId);
    if (page === undefined) return null;
    return { ...state, page, verse: null, blank: false };
  }
  // Going to an entry: the mode from the schedule.
  const goTo = (playlistId: string, entry: Entry, slide: number) => {
    const sameEntry = entry.id === state.entryId;
    return {
      ...state,
      playlistId,
      entryId: entry.id,
      slide,
      blank: false,
      page: null,
      verse: null,
      mode: modeOf(db, community.id, roomId, at),
      since: sameEntry ? state.since : at.toISOString(),
      wentLive: sameEntry
        ? state.wentLive
        : {
            ...(playlistId === state.playlistId ? state.wentLive : {}),
            [entry.id]: at.toISOString(),
          },
    };
  };

  if (action.type === "go") {
    const playlistId = db
      .prepare(
        `SELECT e.playlist_id FROM entries e JOIN playlists p ON p.id = e.playlist_id
         WHERE e.id = ? AND e.community_id = ? AND e.deleted_at IS NULL AND p.deleted_at IS NULL`,
      )
      .pluck()
      .get(action.entryId, community.id) as string | undefined;
    const entry =
      playlistId &&
      entriesOf(db, community.id, playlistId).find(
        (e) => e.id === action.entryId,
      );
    if (!playlistId || !entry || !goesLive(entry)) return null;
    const last = slidesOf(db, community, entry) - 1;
    return goTo(
      playlistId,
      entry,
      Math.min(Math.max(action.slide ?? 0, 0), last),
    );
  }

  // From a verse, Next and Previous go back to the playlist where it was.
  if (state.verse) return { ...state, verse: null };
  // Next and previous, within the live playlist, skipping what can't go live.
  const entries = entriesOf(db, community.id, state.playlistId);
  if (!state.playlistId || !entries.some((e) => e.id === state.entryId))
    return null;
  // From where it was pressed, when that's in the playlist: two operators pressing
  // Next at the same moment both go to the slide after it, not two slides on.
  const from =
    action.from && entries.some((e) => e.id === action.from?.entryId)
      ? action.from
      : { entryId: state.entryId, slide: state.slide };
  const to = stepFrom(
    entries,
    from.entryId,
    from.slide,
    action.type === "next" ? 1 : -1,
    (entry) => slidesOf(db, community, entry),
  );
  // At the end or start of the playlist the slide stays; only a blank ends.
  if (!to) return state.blank ? { ...state, blank: false } : null;
  if (to.entry.id === state.entryId && to.slide === state.slide && !state.blank)
    return null;
  return goTo(state.playlistId, to.entry, to.slide);
};

/** The body of `POST /api/communities/:slug/live`: an action, for the main room or a practice room. */
export const actionSchema = {
  type: "object",
  required: ["type"],
  properties: {
    type: {
      enum: [
        "go",
        "next",
        "previous",
        "blank",
        "message",
        "page",
        "verse",
        "timer",
      ],
    },
    // The slides' timer: seconds between pages, or null to stop it.
    seconds: {
      anyOf: [{ type: "null" }, { type: "integer", minimum: 3, maximum: 120 }],
    },
    text: {
      anyOf: [{ type: "null" }, { type: "string", maxLength: 200 }],
    },
    pageId: {
      anyOf: [{ type: "null" }, { type: "string", maxLength: 100 }],
    },
    verse: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          maxProperties: 10,
          additionalProperties: {
            type: "object",
            required: ["reference", "text"],
            additionalProperties: false,
            properties: {
              reference: { type: "string", maxLength: 200 },
              text: { type: "string", maxLength: 5000 },
            },
          },
        },
      ],
    },
    entryId: { type: "string", maxLength: 100 },
    slide: { type: "integer", minimum: 0 },
    blank: { type: "boolean" },
    // A practice room's id; none for the main room.
    room: { type: "string", maxLength: 100 },
    from: {
      type: "object",
      required: ["entryId", "slide"],
      additionalProperties: false,
      properties: {
        entryId: { type: "string", maxLength: 100 },
        slide: { type: "integer", minimum: 0 },
      },
    },
  },
};
