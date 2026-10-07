import type { Feature } from "./features.js";

/**
 * What the app measures, each with the ways it's done, kept as the
 * event's `via`. A fixed list, so the server refuses anything else and the app team's
 * page can list what nobody used.
 */
export const usageFeatures = {
  /** An entry or a part went live. */
  "live.go": [
    "go-button",
    "double-click",
    "enter",
    "slide",
    "part",
    "song-page",
    "song-map",
    "swipe",
  ],
  /** Next and previous: arrow keys, a clicker (PageUp and PageDown), a key on the projector's window, a button, a media key. */
  "live.next": [
    "key",
    "clicker",
    "projector-key",
    "button",
    "media-key",
    "swipe",
  ],
  "live.previous": [
    "key",
    "clicker",
    "projector-key",
    "button",
    "media-key",
    "swipe",
  ],
  "live.blank": ["key", "projector-key", "button", "media-key"],
  /** A view shown in a layout; the event's layout names it. */
  "layout.shown": [],
  /** A search box result used, by its kind. */
  "search.pick": ["song", "bible", "divider", "new-song", "command"],
  /** An error notice someone saw. */
  "error.shown": [],
} as const satisfies Record<string, readonly string[]>;

export type UsageFeature = keyof typeof usageFeatures;
export type Via<F extends UsageFeature> = (typeof usageFeatures)[F][number];

/** Ways that show only with a feature on, so a community without it isn't told nobody used them. */
export const usageShownBy: Partial<Record<string, Feature>> = {
  "live.go part": "layouts",
  "search.pick command": "commands",
};

/** One event as the client sends it. */
export type UsageEvent = {
  feature: UsageFeature;
  /** The community's slug, on its pages. */
  community?: string;
  layout?: string;
  /** How long before the batch was sent it happened, in milliseconds. */
  ago: number;
  detail?: { via?: string } & Record<string, string | number | boolean>;
};

export type UsageBatch = { deviceType: string; events: UsageEvent[] };
