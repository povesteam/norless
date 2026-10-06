/** The live connection's messages, sent as JSON over /api/live. */

/** Client to server. The server ignores anything else. */
export type ClientMessage =
  | { type: "subscribe" | "unsubscribe"; topic: string }
  | { type: "pong" }
  | EditingMessage
  | DraggingMessage
  | StageViewMessage;

/**
 * What a member's musicians or vocalists view shows, so the Big
 * screen draws the same in its tile: the view, its layout and languages, the text size
 * and colors, the device type, and for musicians how they read chords.
 */
export type StageView = {
  view: "musicians" | "vocalists";
  layout: string;
  languages: string[];
  textSize: number;
  dark: boolean;
  device: "phone" | "tablet" | "laptop";
  profile?: {
    plays: readonly string[];
    shapes: readonly string[];
    naming: string;
    colors: boolean;
  };
};

/** "This device shows this stage view", or `view: null` when it closes it. */
export type StageViewMessage = {
  type: "stage-view";
  community: string;
  view: StageView | null;
};

/** Server to client. */
export type ServerMessage =
  { type: "event"; topic: string; data: unknown } | { type: "ping" };

/**
 * "I'm editing this song", from the song editor or the Chords mode (`section: -1`), or
 * "this section, and here's my draft", from a section's editor; `draft: null` when done.
 * One person edits a song at a time.
 */
export type EditingMessage = {
  type: "editing";
  song: string;
  language: string;
  section: number;
  draft: string | null;
};

/** The data of an `editing:<song id>` event: who edits which section right now. */
export type SectionEdit = {
  userId: string;
  name: string;
  language: string;
  section: number;
  draft: string;
  /** When they last typed, as an ISO timestamp; after 2 minutes others may take over. */
  typedAt: string;
};

/** After this long without typing, someone else may take the song over. */
export const EDIT_LOCK_MS = 5 * 60_000;

/** The data of a `presence:<community slug>` event: members online, by person. */
export type OnlineMember = {
  userId: string;
  name: string;
  /** Their photo, an image id. */
  avatar: string | null;
  devices: ("phone" | "computer")[];
  /** The stage views their devices show, each with its connection's number. */
  views: (StageView & { id: number })[];
};

/** "I'm dragging this entry, and it would land at `index` (counted without it)", or `index: null` when done. */
export type DraggingMessage = {
  type: "dragging";
  playlist: string;
  entry: string;
  index: number | null;
};

/** The data of an `activity:<playlist id>` event, for members: who has it open, and who drags what. */
export type PlaylistActivity = {
  viewers: { userId: string; name: string; avatar: string | null }[];
  drags: { userId: string; name: string; entry: string; index: number }[];
};

export type Mode = "service" | "rehearsal";

/** A room's live state, as kept on the server. */
export type LiveState = {
  playlistId: string | null;
  entryId: string | null;
  slide: number;
  blank: boolean;
  /** From the schedule when an entry goes live; nobody sets it by hand. */
  mode: Mode;
  changedBy: {
    userId: string;
    name: string;
    device: "phone" | "computer";
  } | null;
  changedAt: string | null;
  /** When the live entry went live. */
  since: string | null;
  /** A message to the stage monitors, until a controller clears it. */
  message?: string | null;
  /** When each entry of the live playlist went live, for the times already shown. */
  wentLive?: Record<string, string>;
  /** A page the projectors show full screen, until it's cleared or an entry goes live. */
  page?: {
    id: string;
    name: string;
    url: string;
    qr?: boolean;
    /** The built-in welcome page: the next event, as it went up. */
    welcome?: { startsAt: string | null; event: string | null };
  } | null;
  /** A verse projected from bible.com, until Next, an entry or blank. */
  verse?: Verse | null;
  /**
   * A slides entry's timer: the server moves to the next page every
   * `seconds`, looping, from `at`, the last move; any live action stops it. `by` started it.
   */
  timer?: { entryId: string; seconds: number; at: string; by: string } | null;
};

/** A verse from bible.com, per community language: its reference and its text. */
export type Verse = Record<string, { reference: string; text: string }>;

/** What a controller asks the room to do. */
export type LiveAction =
  | { type: "go"; entryId: string; slide?: number }
  | {
      type: "next" | "previous";
      /** Where it was pressed from, so presses at the same moment don't add up. */
      from?: { entryId: string; slide: number };
    }
  | { type: "blank"; blank: boolean }
  | { type: "message"; text: string | null }
  | { type: "page"; pageId: string | null }
  | { type: "verse"; verse: Verse | null }
  /** Starts a slides entry's timer, live from its page; null stops it. */
  | { type: "timer"; entryId: string; seconds: number | null };

/** What next and previous need to know about a playlist entry. */
type Steppable = {
  id: string;
  kind: string;
  plannedMinutes: number | null;
  song: { deleted: boolean } | null;
  slides?: {
    files: { language: string | null; total: number | null; state: string }[];
  } | null;
};

/** A slides entry's pages: its main file's, once it's ready; else 0. */
export const pagesOf = (entry: Pick<Steppable, "slides">) => {
  const main = entry.slides?.files.find((f) => f.language === null);
  return main?.state === "ready" ? (main.total ?? 0) : 0;
};

/**
 * Entries that can go live: everything but deleted songs, dividers without planned
 * minutes and slides not ready yet. A divider with them, like the sermon, is a timed
 * pause on the stage monitor.
 */
export const goesLive = (entry: Steppable) =>
  (entry.kind !== "divider" || entry.plannedMinutes !== null) &&
  !(entry.kind === "song" && entry.song?.deleted) &&
  !(entry.kind === "slides" && pagesOf(entry) === 0);

/**
 * Where next or previous goes from a slide of an entry: the next slide, else the first
 * (going back, the last) slide of the nearest entry that can go live. Null at the end
 * or start of the playlist.
 */
export function stepFrom<E extends Steppable>(
  entries: E[],
  entryId: string | null,
  slide: number,
  step: 1 | -1,
  slidesOf: (entry: E) => number,
): { entry: E; slide: number } | null {
  const index = entries.findIndex((e) => e.id === entryId);
  const current = entries[index];
  if (!current) return null;
  if (slide + step >= 0 && slide + step < slidesOf(current))
    return { entry: current, slide: slide + step };
  const others =
    step > 0 ? entries.slice(index + 1) : entries.slice(0, index).reverse();
  const target = others.find(goesLive);
  return target
    ? { entry: target, slide: step > 0 ? 0 : slidesOf(target) - 1 }
    : null;
}
