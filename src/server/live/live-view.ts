import type { LiveState, Verse } from "../../shared/live.js";
import type { Entry } from "../playlists/playlists.js";
import type { SlideFile } from "../../shared/slides.js";
import type { Song } from "../songs/songs.js";

/** The live state with what screens need to show it, as sent to every device. */
export type LiveView = LiveState & {
  entry: Entry | null;
  song: Song | null;
  /** How many slides the live entry has. */
  slides: number;
  /** The entry next goes to after the live one's last slide, e.g. the next song. */
  next: Entry | null;
  /** A service or rehearsal is in progress by the schedule, as of this view. */
  event: boolean;
  /** A recording runs in the room, and who records (to members only). */
  recording: { by: string | null } | null;
  /** A device listens for the band's tempo: who (to members only), what
   * it measures, and whether the band has drifted long enough to show it. */
  tempo: {
    listenerId: string | null;
    listener: string | null;
    measured: number | null;
    drift: "fast" | "slow" | null;
  } | null;
  /** Who leads the live song, to members only. */
  ledBy: string | null;
};

/**
 * What follow-along phones need of the live state: what's live, and
 * which song and when it last changed, so each phone loads its text once. No names.
 */
export type FollowView = Pick<LiveState, "entryId" | "slide" | "blank"> & {
  /** A page is projected: phones show the song's title, or nothing. */
  page: boolean;
  /** A verse from bible.com, which phones show too. */
  verse: Verse | null;
  entry:
    | (Pick<Entry, "kind" | "bible"> & {
        songId: string | null;
        songUpdatedAt: string | null;
        title: Record<string, string> | null;
        /** A text slide's Markdown, or a slides entry's title. */
        text: string | null;
        /** A slides entry's files. */
        slides: SlideFile[] | null;
      })
    | null;
  /** The next song's titles, for "Next: …" below the last part. */
  next: Record<string, string> | null;
};

/** The live view without who changed it, for pages open to visitors. */
export const unnamed = (view: LiveView): LiveView => ({
  ...view,
  changedBy: null,
  recording: view.recording && { by: null },
  tempo: view.tempo && { ...view.tempo, listenerId: null, listener: null },
  ledBy: null,
});

export const followOf = (view: LiveView): FollowView => ({
  entryId: view.entryId,
  slide: view.slide,
  blank: view.blank,
  page: !!view.page,
  verse: view.verse ?? null,
  entry: view.entry
    ? {
        kind: view.entry.kind,
        bible: view.entry.bible,
        songId: view.entry.song?.id ?? null,
        songUpdatedAt: view.song?.updatedAt ?? null,
        title: view.entry.song?.titles ?? null,
        text:
          view.entry.kind === "text" || view.entry.kind === "slides"
            ? view.entry.text
            : null,
        slides: view.entry.slides?.files ?? null,
      }
    : null,
  next: view.next?.song?.titles ?? null,
});
