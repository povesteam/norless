/*
 * The features a community switches on, one by one, so the team meets the new app a few
 * features at a time (there are no steps). The
 * owner switches them in a graph of what each needs; Classic's are always on, the rest
 * off until switched on, so a new or imported community works like the old Norless. The
 * server never checks them.
 */
/**
 * Every feature, in the order the graph shows them, and the feature it needs, without
 * which it's off (its only way in is there). Classic's are always on. A feature added
 * later has `added`, its day: marked new until an owner switches it. Every new
 * user-facing feature takes a key here with `added`, its icon in `featureIcons`
 * (src/client/ui/icons.tsx) and its branch in `branchOf` (src/client/app/tree-layout.ts).
 */
export const features = {
  // Classic
  feedback: { classic: true },
  // Logging the laptop in from a phone: operators do from the first Sunday.
  deviceLogin: { classic: true },
  // Print, save and copy a playlist's lyrics, which singers do today with the extension.
  export: { classic: true },
  // Operator
  // The app's frame: header, menu, list of playlists, search box, song pages and the
  // list of keyboard shortcuts.
  appFrame: {},
  // Controller, Running order and Big on laptops, with screen previews, part buttons
  // and the service/rehearsal status.
  layouts: { needs: "appFrame" },
  textSlides: {},
  times: {},
  problems: {},
  commands: {},
  // Who has a playlist open, and the notice of who changed the slide.
  presence: {},
  // Media keys move the slides, with the live bar's next and previous.
  mediaKeys: {},
  // Stage
  // The stage monitor and the musicians and vocalists views.
  stageViews: { needs: "appFrame" },
  // The Screens menu: a screen on a display, pairing a TV.
  screenMenu: { needs: "layouts" },
  // The tablet and phone controller layouts.
  touchLayouts: { needs: "layouts" },
  // Adding chords, notes and tempo, which the stage views show, with the song's
  // history, notation blocks and reference recordings.
  chords: {},
  // Musician profiles, instrument layouts and keys for a service.
  instruments: { needs: "stageViews" },
  // Recording rehearsals and services, from the musicians view.
  recordings: { needs: "appFrame" },
  // Listening for the band's tempo, and the hint on stage.
  tempoCheck: { needs: "layouts" },
  // Screens
  screens: {},
  projectHere: { needs: "layouts" },
  // Anyone's phone follows the live song, through the community's address.
  followAlong: {},
  shortLinks: {},
  // Extras
  sideBySide: {},
  install: {},
  theme: {},
  // Liking and disliking songs, liked songs first in the search box, excluding songs.
  songFeedback: {},
  // A song's authors, copyright and source, in the editor and on its page.
  credits: {},
  // The Statistics page, with the year in songs, the last services as a grid and the
  // searches that found nothing; a song's services on its page; the rotation hint.
  statistics: { needs: "appFrame" },
  // A playlist's YouTube chapters, from when its entries went live in the service.
  chapters: {},
  // Chords colored by their degree in the key, a switch on My account.
  chordColors: { needs: "stageViews" },
  // Host's words on entries, and the Host view.
  host: { needs: "appFrame" },
  // The owners' Changes page: who changed what, and when.
  changes: {},
  // Practice rooms next to the live service, from the live bar.
  practiceRooms: { needs: "layouts" },
  // Added later: off in existing communities until switched on.
  // Chords played on a MIDI or Bluetooth piano, placed in the Chords mode.
  midiChords: { needs: "chords", added: "2026-10-04" },
  // Chords heard through a microphone or the mixer, in the Chords mode.
  audioChords: { needs: "chords", added: "2026-10-04" },
  // The chord played live, shared from the team's devices to the musicians view, on
  // the circle of fifths.
  liveChord: { needs: "stageViews", added: "2026-10-04" },
  // Team, added later too.
  // The roles, each date's slots from a template, the team schedule page, My schedule,
  // sign-ups, away dates, and who leads each song.
  serviceRoles: { needs: "appFrame", added: "2026-10-04" },
  // Notifications on phones, by push.
  pushNotifications: { needs: "serviceRoles", added: "2026-10-04" },
  // What's coming in the church's calendar, read from its iCal address.
  churchCalendar: { needs: "serviceRoles", added: "2026-10-04" },
  // Extras: songs kept on a device, to project without internet.
  offline: { needs: "appFrame", added: "2026-10-04" },
  // Telling a service's people its playlist is ready, and its musicians what changed.
  playlistNews: { needs: "serviceRoles", added: "2026-10-04" },
  // Each song's moments in the services' YouTube streams.
  replays: { added: "2026-10-05" },
  // PDFs and pictures as playlist entries.
  fileSlides: { needs: "layouts", added: "2026-10-05" },
  // A laptop layout for Full HD, QHD and 4K windows.
  bigScreen: { needs: "layouts", added: "2026-10-05" },
  // A built-in welcome page for the projectors.
  welcome: { added: "2026-10-05" },
  // A + between a playlist's rows, and "above" in a row's actions.
  insertBetween: { added: "2026-10-06" },
} as const satisfies Record<
  string,
  { classic?: true; needs?: string; added?: string }
>;
export type Feature = keyof typeof features;
type FeatureDef = {
  /** Classic's: always on, not switchable. */
  classic?: true;
  needs?: Feature;
  /** The day it shipped, for a feature added after the switches. */
  added?: string;
};
const defs = features as Record<Feature, FeatureDef>;
// Read on each call, so a test can add a feature.
const names = () => Object.keys(features) as Feature[];
export const featureNames = names();

/** The features an owner can switch: all but Classic's. */
export const switchable = (name: Feature) => !defs[name].classic;

/** What an owner stored: on or off per feature; nothing stored is off. */
export type Switches = Partial<Record<Feature, boolean>>;

/** The feature a feature needs, if any. */
export const needsOf = (name: Feature) => defs[name].needs;

/** Added later: marked new until an owner switches it. */
export const isAdded = (name: Feature) => !!defs[name].added;

/** A feature nobody has switched yet: added later and never set. */
export const isNew = (set: Switches, name: Feature) =>
  !!defs[name].added && set[name] === undefined;

/** Its own setting, before what it needs: Classic's always on, the rest as switched. */
export const ownOn = (set: Switches, name: Feature) =>
  !switchable(name) || set[name] === true;

/** The features that are on: their own setting, and everything they need on. */
export function switchesOn(set: Switches): Set<Feature> {
  const on = (name: Feature): boolean => {
    const needs = defs[name].needs;
    return ownOn(set, name) && (!needs || on(needs));
  };
  return new Set(names().filter(on));
}

/** What switching a locked feature on also switches on: the off ones it needs, root first. */
export function pathTo(set: Switches, name: Feature): Feature[] {
  const path: Feature[] = [];
  for (let n = defs[name].needs; n; n = defs[n].needs)
    if (!ownOn(set, n)) path.unshift(n);
  return path;
}

/** Every feature on, outside a community's pages. */
export const allOn: ReadonlySet<Feature> = new Set(featureNames);

export const shows = (on: ReadonlySet<Feature>, feature: Feature) =>
  on.has(feature);

/** For the what's new notice: the switchable features on now that weren't seen. */
export const newlyOn = (seen: ReadonlySet<string>, on: ReadonlySet<Feature>) =>
  names().filter((n) => switchable(n) && on.has(n) && !seen.has(n));

/**
 * Features planned but not built, shown in the feature graph as coming so the team sees
 * what's ahead, with what they'll need. Built, one moves to
 * `features` with `added`.
 */
export const planned = {
  // After chord detection.
  chordHelper: { needs: "midiChords" },
  // v1.2's rest.
  melodia: {},
  // v2.
  webhooks: {},
} as const satisfies Record<string, { needs?: string }>;
export type Planned = keyof typeof planned;
