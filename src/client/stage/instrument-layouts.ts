import type { Instrument, NoteNaming } from "../../shared/music/music";

/** The instrument layouts, in the musicians view's list. */
export const instrumentLayouts = [
  {
    id: "guitar-words",
    devices: ["phone", "tablet", "laptop"],
    feature: "instruments",
  },
  {
    id: "guitar-bars",
    devices: ["phone", "tablet", "laptop"],
    feature: "instruments",
  },
  { id: "guitar-chart", devices: ["tablet", "laptop"], feature: "instruments" },
  {
    id: "keys-concert",
    devices: ["phone", "tablet", "laptop"],
    feature: "instruments",
  },
  { id: "keys-numbers", devices: ["tablet", "laptop"], feature: "instruments" },
  { id: "drums-parts", devices: ["tablet", "laptop"], feature: "instruments" },
  { id: "drums-cue", devices: ["phone", "tablet"], feature: "instruments" },
  {
    id: "bass-roots",
    devices: ["phone", "tablet", "laptop"],
    feature: "instruments",
  },
] as const;
export type InstrumentLayoutId = (typeof instrumentLayouts)[number]["id"];

export const layoutInstrument: Record<InstrumentLayoutId, Instrument> = {
  "guitar-words": "guitar",
  "guitar-bars": "guitar",
  "guitar-chart": "guitar",
  "keys-concert": "keys",
  "keys-numbers": "keys",
  "drums-parts": "drums",
  "drums-cue": "drums",
  "bass-roots": "bass",
};

/** The layout a main instrument opens with on a device type, when none was chosen. */
export function defaultLayout(
  main: Instrument | null | undefined,
  device: string,
): string | undefined {
  const phone = device === "phone";
  switch (main) {
    case "guitar":
      return phone ? "guitar-words" : "guitar-chart";
    case "keys":
      return "keys-concert";
    case "drums":
      return phone ? "drums-cue" : "drums-parts";
    case "bass":
      return "bass-roots";
    case "vocals":
    case "other":
      return "chords";
    default:
      return undefined;
  }
}

export const isInstrumentLayout = (id: string): id is InstrumentLayoutId =>
  instrumentLayouts.some((l) => l.id === id);

/** What a musician's profile gives the layouts. */
export type Profile = {
  plays: readonly Instrument[];
  shapes: readonly string[];
  naming: NoteNaming;
  /** Whether chords are colored by their degree. */
  colors: boolean;
};
