import { expect, test } from "vitest";
import {
  bleMidiMessages,
  chordOfChroma,
  chordOfNotes,
  chromaOf,
  wheelDot,
  wheelLabels,
  wheelPlace,
} from "./chord-detect.js";

const G = { tonic: "G", minor: false };
const F = { tonic: "F", minor: false };

test("held notes make a chord, the lowest as its bass", () => {
  expect(chordOfNotes([60, 64, 67], null)).toBe("C");
  expect(chordOfNotes([57, 60, 64], null)).toBe("Am");
  expect(chordOfNotes([62, 66, 69, 72], G)).toBe("D7");
  // E major over G#: an inversion is a slash chord.
  expect(chordOfNotes([56, 59, 64], null)).toBe("E/G#");
  // Spelled for the key: B flat in F, not A sharp.
  expect(chordOfNotes([58, 62, 65], F)).toBe("Bb");
});

test("one or two notes are a shorthand for a chord, shown from the first key", () => {
  // One note: its major chord (decision review), octaves too.
  expect(chordOfNotes([60], null)).toBe("C");
  expect(chordOfNotes([60, 72], null)).toBe("C");
  expect(chordOfNotes([58], F)).toBe("Bb");
  // A minor third is the minor chord, a major third or a fifth the major one, from
  // the lower note; turned upside down (a sixth, a fourth), from the upper one.
  expect(chordOfNotes([57, 60], null)).toBe("Am");
  expect(chordOfNotes([60, 64], null)).toBe("C");
  expect(chordOfNotes([60, 67], null)).toBe("C");
  expect(chordOfNotes([60, 69], null)).toBe("Am");
  expect(chordOfNotes([55, 60], null)).toBe("C");
  // A minor seventh is the seventh chord.
  expect(chordOfNotes([60, 70], null)).toBe("C7");
  // A second names nothing.
  expect(chordOfNotes([60, 62], null)).toBeNull();
  expect(chordOfNotes([], null)).toBeNull();
});

/** A spectrum with these notes loud, as an analyser's decibels would be. */
const spectrum = (midi: number[], sampleRate = 48000, bins = 4096) => {
  const decibels = new Float32Array(bins).fill(-120);
  const binHz = sampleRate / (bins * 2);
  for (const m of midi) {
    const hz = 440 * 2 ** ((m - 69) / 12);
    decibels[Math.round(hz / binHz)] = -10;
  }
  return decibels;
};

test("a sound is heard as the chord its notes make", () => {
  const heard = chordOfChroma(
    chromaOf(spectrum([48, 55, 60, 64, 67]), 48000),
    G,
  );
  expect(heard?.name).toBe("C");
  expect(heard?.confidence).toBeGreaterThan(0.3);
  expect(
    chordOfChroma(chromaOf(spectrum([57, 60, 64]), 48000), null)?.name,
  ).toBe("Am");
  expect(chordOfChroma(new Array(12).fill(0), null)).toBeNull();
});

test("the wheel puts the key at the top and minor chords inside", () => {
  expect(wheelPlace("G", G)).toEqual({ step: 0, minor: false });
  expect(wheelPlace("D", G)).toEqual({ step: 1, minor: false });
  expect(wheelPlace("C", G)).toEqual({ step: 11, minor: false });
  // Em beside its relative major G; D7 at D; a slash chord at its chord.
  expect(wheelPlace("Em", G)).toEqual({ step: 0, minor: true });
  expect(wheelPlace("D7", G)?.step).toBe(1);
  expect(wheelPlace("C/E", G)?.step).toBe(11);
  expect(wheelLabels(G)[0]).toEqual({ major: "G", minor: "Em" });
  expect(wheelLabels(F)[1]).toEqual({ major: "C", minor: "Am" });
});

test("the dot sits on a chord that clearly fits, and toward the middle when unsure", () => {
  const sure = wheelDot([{ name: "G", score: 1 }], G);
  expect(sure.y).toBeLessThan(-0.8);
  // Four chords a quarter of the circle apart, each fitting as well.
  const unsure = wheelDot(
    ["G", "E", "C#", "A#"].map((name) => ({ name, score: 1 })),
    G,
  );
  expect(Math.hypot(unsure.x, unsure.y)).toBeLessThan(0.1);
});

test("a Bluetooth MIDI packet holds its messages, running status too", () => {
  // Header, timestamp, note on C4, timestamp, running status E4, timestamp, note off.
  const packet = Uint8Array.from([
    0x80, 0x81, 0x90, 60, 100, 0x82, 64, 90, 0x83, 0x80, 60, 0,
  ]);
  expect(bleMidiMessages(packet)).toEqual([
    [0x90, 60, 100],
    [0x90, 64, 90],
    [0x80, 60, 0],
  ]);
});
