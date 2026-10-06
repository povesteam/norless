import type { Feature } from "./features.js";

/** Kinds of device; each has its own layouts and preferences. */
export const deviceTypes = ["phone", "tablet", "laptop"] as const;
export type DeviceType = (typeof deviceTypes)[number];

/** What a member sets for one device type. */
export type DevicePreferences = {
  /** The chosen layout per view, by layout id. */
  layouts?: Record<string, string>;
  /** Light or dark for musicians and vocalists layouts, which are dark by default. */
  stageScheme?: "light" | "dark" | "system";
  /** Text size of stage layouts, as a factor of the default. */
  textSize?: number;
};

export const instruments = [
  "guitar",
  "keys",
  "bass",
  "drums",
  "vocals",
  "other",
] as const;
export type Instrument = (typeof instruments)[number];

/** Chord names: as stored (C D E), Do-Re-Mi, or numbers relative to the key. */
export const noteNamings = ["letters", "solfege", "numbers"] as const;
export type NoteNaming = (typeof noteNamings)[number];

/** The shapes a guitarist may prefer, in the order offered. */
export const guitarShapes = ["C", "A", "G", "E", "D"] as const;

/** What a member plays, profile information apart from roles. */
export type Musician = {
  instruments?: Instrument[];
  /** Picks the default musicians layouts; null takes it away. */
  main?: Instrument | null;
  /** Guitar shapes in the order preferred. */
  shapes?: string[];
  /** Unset or null: the community's default. */
  noteNames?: NoteNaming | null;
  /** Chords colored by their degree in the key. */
  chordColors?: boolean;
};

export type Preferences = Partial<Record<DeviceType, DevicePreferences>> & {
  musician?: Musician;
  /** Per community, the switches its what's new notice was seen for. */
  seenSwitches?: Record<string, string[]>;
  /** The Classic hints the member has seen (classic-layout spec). */
  hints?: string[];
  /** False when the member switched counting off: their usage events carry no id. */
  countUsage?: boolean;
};

/**
 * The device type from the screen and the main input: a short side under 600 points is a
 * phone; otherwise touch is a tablet and a mouse a laptop. A member can correct it.
 */
export function deviceTypeFor(screen: {
  width: number;
  height: number;
  touch: boolean;
}): DeviceType {
  if (Math.min(screen.width, screen.height) < 600) return "phone";
  return screen.touch ? "tablet" : "laptop";
}

/** A named way to show a view on some device types, with the feature that offers it. */
export type LayoutOption = {
  id: string;
  devices: readonly DeviceType[];
  feature?: Feature;
};

/** The layouts the community's switches offer. */
export const layoutsAt = <L extends LayoutOption>(
  layouts: readonly L[],
  shows: (feature: Feature) => boolean,
) => layouts.filter((l) => !l.feature || shows(l.feature));

/**
 * The layout a view shows: the member's choice for this device type when it still
 * exists and fits, otherwise the first layout made for the device type, otherwise the
 * first one.
 */
export function chooseLayout<L extends LayoutOption>(
  layouts: readonly L[],
  device: DeviceType,
  choice: string | undefined,
): L | undefined {
  const fitting = layouts.filter((l) => l.devices.includes(device));
  return fitting.find((l) => l.id === choice) ?? fitting[0] ?? layouts[0];
}
