import { type BrowserContextOptions, type Page } from "@playwright/test";
import en from "../../src/client/locales/en.json" with { type: "json" };

export const slug = "example";
export const sizes = {
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  tablet: {
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  laptop: { viewport: { width: 1440, height: 900 } },
  // Monitors for the Big screen layout, at 100% scaling.
  fhd: { viewport: { width: 1920, height: 1080 } },
  qhd: { viewport: { width: 2560, height: 1440 } },
  "4k": { viewport: { width: 3840, height: 2160 } },
  // A projector or a stage TV.
  screen: { viewport: { width: 1280, height: 720 } },
} satisfies Record<string, BrowserContextOptions>;
export type Size = keyof typeof sizes;

/** One view: who looks at it, on which sizes, and how to get there. */
export type View = {
  name: string;
  as?: string;
  sizes: Size[];
  dark?: boolean;
  /** The what's new notice shows: the person last saw the set before. */
  news?: boolean;
  /** The entry live during its shots, if not its set's. */
  live?: string;
  go: (page: Page, size: Size) => Promise<void>;
};

export const playlist = `/${slug}/playlists/p-sun`;
export const team = "ioana@example.org";
export const editor = "mihai@example.org";
export const owner = "ana@example.org";
export const musician = "andrei@example.org";
export const singer = "elena@example.org";
export const open = (path: string) => async (page: Page) => {
  await page.goto(path);
};
export const menu = async (page: Page) => {
  await page.goto(playlist);
  await page.getByRole("button", { name: en.app.menu }).click();
};

/**
 * The features each set of views shows, added to the sets before it: the groups the
 * interface steps had when there were steps, so the manual's pictures keep showing
 * the app as a community meets it, a few features at a time.
 */
const groups = [
  [],
  [
    "appFrame",
    "layouts",
    "textSlides",
    "times",
    "problems",
    "commands",
    "presence",
    "mediaKeys",
  ],
  [
    "stageViews",
    "liveNotice",
    "screenMenu",
    "touchLayouts",
    "chords",
    "history",
    "notation",
    "instruments",
    "recordings",
    "tempoCheck",
  ],
  ["screens", "projectHere", "followAlong", "shortLinks"],
  [
    "sideBySide",
    "install",
    "theme",
    "shortcuts",
    "songFeedback",
    "referenceLink",
    "credits",
    "statistics",
    "rotation",
    "yearRecap",
    "servicesGrid",
    "searchMisses",
    "chapters",
    "chordColors",
    "host",
    "changes",
    "practiceRooms",
    "midiChords",
    "audioChords",
    "chordWheel",
    "liveChord",
    "offline",
    "fileSlides",
    "bigScreen",
    "welcome",
    "insertBetween",
  ],
  [
    "serviceRoles",
    "mySchedule",
    "signUps",
    "blockouts",
    "pushNotifications",
    "ledBy",
    "churchCalendar",
    "playlistNews",
  ],
];
/** The switches of set `n` (1 is Classic's set): its groups' features on. */
export const switchesOf = (n: number) =>
  Object.fromEntries(
    groups
      .slice(0, n)
      .flat()
      .map((name) => [name, true]),
  );
