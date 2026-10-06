import type { SectionType } from "./song-text.js";

/**
 * Whether a screen shows nothing, so it may reload to a new version (app-shell spec):
 * nothing live, the room blank, or no service or rehearsal running by the schedule.
 */
export const showsNothing = (
  view:
    | { blank: boolean; entryId: string | null; page?: unknown; event: boolean }
    | undefined,
) => !view || view.blank || (!view.entryId && !view.page) || !view.event;

/** Kinds of screen a room has. */
export const screenTypes = [
  "projector",
  "musicians",
  "vocalists",
  "stage",
  "overlay",
] as const;
export type ScreenType = (typeof screenTypes)[number];

/** How a screen looks. Every field is optional; screens start with the defaults. */
export type ScreenSettings = {
  /** Two languages on a projector: one above the other (the default) or side by side. */
  split?: "rows" | "columns";
  background?: string;
  backgroundImage?: string;
  /** How much of the background image shows, from 0 to 1. */
  imageOpacity?: number;
  textColor?: string;
  font?: string;
  clock?: boolean;
  /** Italic or bold per section type; refrains are italic unless set. */
  sectionStyles?: Partial<
    Record<SectionType, { italic?: boolean; bold?: boolean }>
  >;
  /** Behind a broadcast overlay's text. */
  overlayBackground?: "transparent" | "green" | "black";
};

export type Screen = {
  id: string;
  name: string;
  type: ScreenType;
  /** One or two of the community's languages, in the order they're shown. */
  languages: string[];
  layout: string | null;
  settings: ScreenSettings;
  secret: string;
  /** Its short code, for its link; in the team's list of screens. */
  code?: string;
};

/** What a screen's page loads with its secret: no secret, but its community. */
export type ScreenView = Omit<Screen, "secret"> & {
  community: { slug: string; languages: string[] };
};
