import { useEffect, useState, useSyncExternalStore } from "react";
import type { LiveView } from "../../server/live/live-view";
import type { Entry } from "../../server/playlists/playlists";
import type { Song } from "../../server/songs/songs";
import {
  goesLive,
  type LiveAction,
  pagesOf,
  stepFrom,
} from "../../shared/live";
import { type UsageFeature, usageFeatures, type Via } from "../../shared/usage";
import { parseSong, type Slide } from "../../shared/song-text";
import { live } from "./connection";
import { guessAfter } from "../chords/guess";
import { send, useJson } from "./fetch";
import { useChanges } from "./changes";
import { useIsMember } from "./me";
import { openOnDisplay } from "../live/windows";
import { track } from "./usage";

/** The slides next and previous count: the song's version in the community's first language it has. */
export function liveSlides(song: Song, languages: string[]): Slide[] {
  const version =
    languages
      .map((l) => song.versions.find((v) => v.language === l))
      .find(Boolean) ?? song.versions[0];
  return version ? parseSong(version.text).slides : [];
}

/*
 * Instant live control: this device shows its own slide moves at once,
 * as a guess, until the room's state confirms them or the server refuses (then it snaps
 * back to the room's state). Guesses stay within the live entry, whose slides are known.
 */

/** The last live view each community's views got, by slug. */
const latest = new Map<string, LiveView>();
/** This device's guess of the room's state, by slug, while its action is on its way. */
const guesses = new Map<string, LiveView>();
const guessListeners = new Set<() => void>();
const setGuess = (slug: string, view: LiveView | null) => {
  if (view) guesses.set(slug, view);
  else guesses.delete(slug);
  for (const listener of guessListeners) listener();
};
const subscribeGuesses = (listener: () => void) => {
  guessListeners.add(listener);
  return () => guessListeners.delete(listener);
};
const sameSlide = (a: LiveView, b: LiveView) =>
  a.entryId === b.entryId && a.slide === b.slide && a.blank === b.blank;

/*
 * Practice rooms: the room this device follows in each community,
 * the main room unless it joined a practice room; kept on the device.
 */
const joined = new Map<string, string | null>();
const roomListeners = new Set<() => void>();
const roomKey = (slug: string) => `norless:room:${slug}`;
const joinedRoom = (slug: string): string | null => {
  if (!joined.has(slug)) {
    let kept: string | null = null;
    try {
      kept = localStorage.getItem(roomKey(slug));
    } catch {
      // The main room.
    }
    joined.set(slug, kept);
  }
  return joined.get(slug) ?? null;
};
/** Makes this device follow a practice room, or the main room (null). */
export function joinRoom(slug: string, roomId: string | null) {
  joined.set(slug, roomId);
  try {
    if (roomId) localStorage.setItem(roomKey(slug), roomId);
    else localStorage.removeItem(roomKey(slug));
  } catch {
    // Followed until the page reloads.
  }
  latest.delete(slug);
  setGuess(slug, null);
  for (const listener of roomListeners) listener();
}
const subscribeRoom = (listener: () => void) => {
  roomListeners.add(listener);
  return () => roomListeners.delete(listener);
};
/** The practice room this device follows in the community, or null for the main room. */
export function useJoinedRoom(slug: string | null) {
  return useSyncExternalStore(subscribeRoom, () =>
    slug ? joinedRoom(slug) : null,
  );
}

/**
 * What's live in the community's room, kept up to date; undefined until it arrives.
 * This device's own moves show at once. While this tab projects locally, what it
 * projects instead.
 */
export function useLiveView(slug: string | null) {
  const [view, setView] = useState<LiveView>();
  const local = useLocal();
  const guess = useSyncExternalStore(subscribeGuesses, () =>
    slug ? guesses.get(slug) : undefined,
  );
  // A practice room this device joined, while it runs; else the main room.
  const room = useJoinedRoom(slug);
  const running = useJson<{ id: string }>(
    slug && room ? `/api/communities/${slug}/rooms/${room}` : null,
    useChanges(slug, "rooms"),
  ).data;
  useEffect(() => {
    if (slug && room && running === null) joinRoom(slug, null);
  }, [slug, room, running]);
  // Members learn who changed the slide; everyone else gets it without names.
  const topic = useIsMember(slug ?? "") ? "live" : "live-public";
  const place = room ? `${slug}/${room}` : slug;
  useEffect(
    () =>
      slug
        ? live.subscribe(`${topic}:${place}`, (data) => {
            const room = data as LiveView;
            latest.set(slug, room);
            const guessed = guesses.get(slug);
            if (guessed && sameSlide(guessed, room)) setGuess(slug, null);
            setView(room);
          })
        : undefined,
    [slug, topic, place],
  );
  return local && local.slug === slug ? local.view : (guess ?? view);
}

/** How a live action was done, for the usage events. */
export type LiveVia = Via<"live.go"> | Via<"live.next"> | Via<"live.blank">;

/**
 * Asks the room to go live, next, previous, blank or change its mode; or, while this tab
 * projects locally, its own projector. `via` records how, when it's measured.
 */
export function sendLive(slug: string, action: LiveAction, via?: LiveVia) {
  const feature = `live.${action.type}`;
  const ways: readonly string[] | undefined =
    usageFeatures[feature as UsageFeature];
  if (via && ways?.includes(via))
    track(
      feature as UsageFeature,
      {
        via,
        ...(action.type === "blank" && { blank: action.blank }),
        ...(local?.slug === slug && { local: true }),
      } as Parameters<typeof track>[1],
    );
  if (local?.slug === slug) return actLocally(action).then(() => null);
  const shown = guesses.get(slug) ?? latest.get(slug);
  // Next and previous say where from, so two presses at once land on the same slide.
  const room = joinedRoom(slug);
  const sent = {
    ...((action.type === "next" || action.type === "previous") && shown?.entryId
      ? { ...action, from: { entryId: shown.entryId, slide: shown.slide } }
      : action),
    ...(room && { room }),
  };
  const guess = shown && guessAfter(shown, action);
  if (guess) setGuess(slug, guess);
  return send("POST", `/api/communities/${slug}/live`, sent).then(
    (response) => {
      // Refused or lost: back to the room's state. Accepted: the room's next state
      // replaces the guess; this one goes anyway if it doesn't come.
      if (!guess) return response;
      const drop = () => guesses.get(slug) === guess && setGuess(slug, null);
      if (!response?.ok) drop();
      else setTimeout(drop, 2000);
      return response;
    },
  );
}

/*
 * Local projection: this tab drives a projector window of its own, in the same browser,
 * through a BroadcastChannel. Anyone can, logged in or not. The room's screens don't
 * change and no play is recorded.
 */

type Local = {
  slug: string;
  languages: string[];
  /** The playlist projected, or null for songs on their own. */
  playlistId: string | null;
  entries: Entry[];
  view: LiveView;
};
let local: Local | null = null;
let channel: BroadcastChannel | null = null;
let projector: Window | null = null;
/** Looks every half second whether the projector window was closed. */
let watch: ReturnType<typeof setInterval> | undefined;
/** Projecting stopped because its window was closed, until it's dismissed or starts again. */
let windowClosed = false;
/** On a phone, the projector fills this page instead of a window (live-control spec). */
let inPage = false;
/** Whether it fills the page now; Back hides it, still projecting. */
let shownInPage = false;
const notify = () => {
  for (const listener of listeners) listener();
};
const listeners = new Set<() => void>();
const songs = new Map<string, Song>();
const channelOf = (slug: string) =>
  new BroadcastChannel(`norless:local:${slug}`);

const publish = (next: Local | null) => {
  local = next;
  if (next) channel?.postMessage(next.view);
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** What this tab projects locally, or null. */
export function useLocal() {
  return useSyncExternalStore(subscribe, () => local);
}

/** Whether projecting stopped because the projector window was closed. */
export function useWindowClosed() {
  return useSyncExternalStore(subscribe, () => windowClosed);
}

/** The page has said that the projector window was closed. */
export function dismissWindowClosed() {
  windowClosed = false;
  notify();
}

/** Whether the projector fills this page now. */
export function useShownInPage() {
  return useSyncExternalStore(subscribe, () => shownInPage);
}

/** Back to the page from the projector filling it, still projecting. */
export function hideInPage() {
  shownInPage = false;
  notify();
}

/** Whether the next projector fills this page (a phone) or opens a window. */
export function projectInPage(phone: boolean) {
  inPage = phone;
}

/** Starts projecting `entries` locally, or switches to them, and opens the projector window. */
export function projectLocally({
  slug,
  languages,
  playlistId,
  entries,
  known = [],
}: Omit<Local, "view"> & { known?: Song[] }) {
  for (const song of known) songs.set(song.id, song);
  if (local?.slug !== slug) {
    channel?.close();
    channel = channelOf(slug);
    // A projector window opened or reloaded asks for what's projected.
    channel.onmessage = (event) => {
      if (event.data === "hello" && local) channel?.postMessage(local.view);
    };
  }
  const idle: LiveView = {
    playlistId,
    entryId: null,
    slide: 0,
    blank: false,
    mode: "rehearsal",
    changedBy: null,
    recording: null,
    tempo: null,
    ledBy: null,
    changedAt: null,
    since: null,
    entry: null,
    song: null,
    slides: 1,
    next: null,
    event: false,
  };
  windowClosed = false;
  publish({ slug, languages, playlistId, entries, view: idle });
  void openLocalProjector();
}

/** Opens the local projector window again, or brings it forward. */
export async function openLocalProjector() {
  if (!local) return;
  if (inPage) {
    shownInPage = true;
    return notify();
  }
  projector = await openOnDisplay(
    `/${local.slug}/local/${local.languages[0] ?? "ro"}`,
    "local",
  );
  // Closing the window stops projecting, as Stop projecting would (live-control spec).
  watch ??= setInterval(() => {
    if (!projector?.closed) return;
    stopLocal();
    windowClosed = true;
    notify();
  }, 500);
}

/** Stops projecting locally, and closes the projector window. */
export function stopLocal() {
  clearInterval(watch);
  watch = undefined;
  projector?.close();
  projector = null;
  shownInPage = false;
  channel?.close();
  channel = null;
  publish(null);
}

/** The entries projected locally changed, e.g. someone else edited the playlist. */
export function updateLocalEntries(playlistId: string, entries: Entry[]) {
  // The same object, so nothing renders again.
  if (local?.playlistId === playlistId) local.entries = entries;
}

async function songOf(slug: string, id: string) {
  const known = songs.get(id);
  if (known) return known;
  const response = await fetch(`/api/communities/${slug}/songs/${id}`).catch(
    () => null,
  );
  if (!response?.ok) return null;
  const song = (await response.json()) as Song;
  songs.set(id, song);
  return song;
}

/** Live actions on the local projector; modes, stage messages and pages are the room's. */
async function actLocally(action: LiveAction) {
  if (!local) return;
  const { slug, languages, entries, view } = local;
  // Every song's slides, for next and previous into the songs around.
  await Promise.all(
    entries.flatMap((e) => (e.song ? [songOf(slug, e.song.id)] : [])),
  );
  const songFor = (entry: Entry) =>
    (entry.song && songs.get(entry.song.id)) ?? null;
  const slidesOf = (entry: Entry) => {
    if (entry.kind === "slides") return Math.max(1, pagesOf(entry));
    const song = songFor(entry);
    return song ? Math.max(1, liveSlides(song, languages).length) : 1;
  };
  const show = (changes: Partial<LiveView>) =>
    local &&
    publish({
      ...local,
      view: { ...view, ...changes, changedAt: new Date().toISOString() },
    });

  if (action.type === "blank") return show({ blank: action.blank });
  let to: { entry: Entry; slide: number } | null;
  if (action.type === "go") {
    const entry = entries.find((e) => e.id === action.entryId);
    if (!entry || !goesLive(entry)) return;
    const last = slidesOf(entry) - 1;
    to = { entry, slide: Math.min(Math.max(action.slide ?? 0, 0), last) };
  } else if (action.type === "next" || action.type === "previous") {
    to = stepFrom(
      entries,
      view.entryId,
      view.slide,
      action.type === "next" ? 1 : -1,
      slidesOf,
    );
    if (!to) return view.blank ? show({ blank: false }) : undefined;
  } else return;
  const index = entries.indexOf(to.entry);
  show({
    entryId: to.entry.id,
    slide: to.slide,
    blank: false,
    entry: to.entry,
    song: songFor(to.entry),
    slides: slidesOf(to.entry),
    next: entries.slice(index + 1).find(goesLive) ?? null,
  });
}

/** In the local projector window: what the tab that opened it projects. */
export function useLocalProjection(slug: string | null) {
  const [view, setView] = useState<LiveView>();
  useEffect(() => {
    if (!slug) return;
    const own = channelOf(slug);
    own.onmessage = (event) => {
      if (event.data !== "hello") setView(event.data as LiveView);
    };
    own.postMessage("hello");
    return () => own.close();
  }, [slug]);
  return view;
}
