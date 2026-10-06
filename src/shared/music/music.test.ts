import { describe, expect, test } from "vitest";
import {
  capoFor,
  chordName,
  halfSteps,
  keyName,
  notesFor,
  playedKey,
  playedText,
  rootOf,
  scaleDegree,
  shapeKeyAt,
  shapeOf,
  withColors,
  chordColors,
} from "./music.js";

const E = { tonic: "E", minor: false };

describe("note names", () => {
  test("numbers relative to the key, with minor and slash chords", () => {
    expect(
      ["E", "A", "B/D#", "C#m", "E7", "Bsus4"].map((c) =>
        chordName(c, "numbers", E),
      ),
    ).toEqual(["1", "4", "5/7", "6m", "1⁷", "5sus4"]);
    expect(chordName("C", "numbers", { tonic: "A", minor: true })).toBe("3");
  });

  test("Do-Re-Mi, and letters as stored", () => {
    expect(chordName("C#m/G#", "solfege", E)).toBe("Do#m/Sol#");
    expect(chordName("Bb", "solfege", null)).toBe("Sib");
    expect(chordName("F#m7", "letters", E)).toBe("F#m7");
    expect(chordName("Intro:", "solfege", E)).toBe("Intro:");
  });

  test("an old lowercase chord is minor", () => {
    expect(chordName("c#", "numbers", E)).toBe("6m");
  });

  test("keys show in letters or Do-Re-Mi", () => {
    expect(keyName({ tonic: "F#", minor: true }, "solfege")).toBe("Fa#m");
    expect(keyName(E, "numbers")).toBe("E");
  });
});

describe("capo and shapes", () => {
  test("a song in E with C and G shapes: capo 4, played as C", () => {
    const { capo, shapeKey } = capoFor(E, ["C", "G"]);
    expect(capo).toBe(4);
    expect(
      ["E", "B/D#", "C#m", "A"].map((c) => shapeOf(c, capo, shapeKey)),
    ).toEqual(["C", "G/B", "Am", "F"]);
  });

  test("the lowest capo wins, a tie going to the first preferred shape", () => {
    expect(
      capoFor({ tonic: "D", minor: false }, ["C", "A", "G", "E", "D"]).capo,
    ).toBe(0);
    expect(capoFor({ tonic: "Bb", minor: false }, ["G", "A"]).capo).toBe(1);
    expect(capoFor({ tonic: "F#", minor: true }, ["C", "G", "D"])).toEqual({
      capo: 2,
      shapeKey: { tonic: "E", minor: true },
    });
  });
});

test("the bass plays the bass note of slash chords", () => {
  expect(["E/G#", "C#m7", "Bb"].map(rootOf)).toEqual(["G#", "C#", "Bb"]);
});

test("each player sees the notes for everyone and their own", () => {
  const notes = [
    { text: "drums: rim and hats" },
    { text: "all: softer" },
    { text: "🎹 pad only" },
    { text: "unison" },
  ];
  expect(notesFor(notes, ["drums"])).toEqual([
    "rim and hats",
    "softer",
    "unison",
  ]);
  expect(notesFor(notes, ["keys"])).toEqual(["softer", "pad only", "unison"]);
});

test("half steps between keys", () => {
  expect(
    halfSteps({ tonic: "A", minor: false }, { tonic: "C", minor: false }),
  ).toBe(3);
  expect(
    halfSteps({ tonic: "A", minor: false }, { tonic: "G", minor: false }),
  ).toBe(-2);
  expect(halfSteps(E, { tonic: "A", minor: false })).toBe(5);
});

test("a service key moves the chords from the song's key", () => {
  expect(playedKey("La", "G")).toMatchObject({ shown: "G", semitones: -2 });
  expect(playedKey("A", null)).toMatchObject({ shown: "A", semitones: 0 });
  expect(playedText(".A   D\n Doamne", "A", "G")).toBe(".G   C\n Doamne");
  expect(playedText(".A\n Doamne", "Sol + La", "G")).toBe(".A\n Doamne");
});

test("a capo chosen by hand gives its shapes", () => {
  expect(shapeKeyAt(E, 2)).toEqual({ tonic: "D", minor: false });
  expect(shapeKeyAt({ tonic: "F#", minor: true }, 2)).toEqual({
    tonic: "E",
    minor: true,
  });
});

test("chords take their degree in the key, by their root", () => {
  const D = { tonic: "D", minor: false };
  const F = { tonic: "F", minor: false };
  // the maintainer's example: G in D is colored as Bb in F.
  expect(scaleDegree("G", D)).toBe(4);
  expect(scaleDegree("Bb", F)).toBe(4);
  expect(scaleDegree("A7sus4/C#", D)).toBe(5);
  expect(scaleDegree("Bm", D)).toBe(6);
  // A minor key's tonic is 1; C in A minor is 3.
  const Am = { tonic: "A", minor: true };
  expect(scaleDegree("Am", Am)).toBe(1);
  expect(scaleDegree("C", Am)).toBe(3);
  // Outside the key, without one, or not a chord: none.
  expect(scaleDegree("C", D)).toBeNull();
  expect(scaleDegree("G", null)).toBeNull();
  expect(scaleDegree("Intro", D)).toBeNull();

  const slide = withColors(
    {
      name: null,
      type: "verse",
      notes: [],
      repeats: [],
      blocks: [],
      lines: [
        {
          text: "Har",
          chords: [
            { at: 0, name: "G" },
            { at: 2, name: "C" },
          ],
        },
      ],
    } as never,
    D,
  );
  expect(slide.lines[0]?.chords.map((c) => c.colors?.degree)).toEqual([4, 0]);
});

test("chord colors: the tonic, relative pairs, suffixes and the bass", () => {
  const C = { tonic: "C", minor: false };
  const D = { tonic: "D", minor: false };
  const E = { tonic: "E", minor: false };
  const Am = { tonic: "A", minor: true };
  const oklch = (color: string | undefined) =>
    /oklch\(0\.62 ([\d.]+) (\d+)/
      .exec(color ?? "")
      ?.slice(1)
      .map(Number) ?? [];
  const chroma = (color: string | undefined) => oklch(color)[0] ?? 0;
  const hue = (chord: string, key = C) =>
    oklch(chordColors(chord, key)?.root)[1];
  // The tonic in the text color.
  expect(chordColors("E", E)?.root).toBe("var(--foreground)");
  // Relative pairs: F and Dm alike, G and Em alike, the minor softer; Bdim on its own.
  expect(hue("Dm")).toBe(hue("F"));
  expect(hue("Em")).toBe(hue("G"));
  expect(hue("G")).not.toBe(hue("F"));
  expect(hue("Bdim")).not.toBe(hue("G"));
  expect(chroma(chordColors("Dm", C)?.root)).toBeLessThan(
    chroma(chordColors("F", C)?.root),
  );
  // In A minor the pairs are Am and C, Dm and F, Em and G.
  expect(hue("F", Am)).toBe(hue("Dm", Am));
  expect(hue("G", Am)).toBe(hue("Em", Am));
  // Outside the key: one color.
  const outside = chordColors("Bb", C)?.root;
  expect(outside).toContain("oklch");
  expect(chordColors("Eb", C)?.root).toBe(outside);
  // A chord that isn't the key's own on its degree: D7 in C, a secondary dominant; Dm7
  // and Gsus4 are; in A minor, E and Em both.
  expect(chordColors("D7", C)).toMatchObject({
    root: outside,
    degree: 0,
  });
  expect(chordColors("Dm7", C)?.degree).toBe(2);
  expect(chordColors("Gsus4", C)?.degree).toBe(5);
  expect(chordColors("Bm7b5", C)?.degree).toBe(7);
  expect(chordColors("E7", Am)?.degree).toBe(5);
  expect(chordColors("Em", Am)?.degree).toBe(5);
  expect(chordColors("Cm", Am)?.degree).toBe(0);
  // The suffix on a ramp: G plain, then maj7, sus4, 7 and dim all apart; "m" stays.
  const suffix = (chord: string) => chordColors(chord, C);
  expect(suffix("G")?.suffix).toBeUndefined();
  expect(suffix("Am")?.suffix).toBeUndefined();
  expect(suffix("Am7")).toMatchObject({ suffixLength: 1 });
  expect(suffix("Gsus4")).toMatchObject({ suffixLength: 4 });
  const ramp = ["Fmaj7", "Gsus4", "G7", "Bdim"].map((c) => suffix(c)?.suffix);
  expect(new Set(ramp).size).toBe(4);
  expect(suffix("G7sus4")?.suffix).toBe(suffix("G7")?.suffix);
  expect(suffix("Bm7b5")?.suffix).toBe(suffix("Bdim")?.suffix);
  // Blended with its letter: G7's 7 leans to G's color, C7's to the
  // text color, so the same 7 differs by chord.
  expect(suffix("G7")?.suffix).toContain(suffix("G")?.root);
  expect(suffix("C7")?.suffix).toContain("var(--foreground)");
  expect(suffix("G7")?.suffix).not.toBe(suffix("C7")?.suffix);
  // D/F# in D: D in 1's color, F# in 3's; a bass outside the key in the outside color.
  expect(chordColors("D/F#", D)).toMatchObject({
    degree: 1,
    bassDegree: 3,
    bass: chordColors("F#m", D)?.root,
  });
  expect(chordColors("D/C", D)).toMatchObject({
    bassDegree: 0,
    bass: chordColors("C", D)?.root,
  });
  // Without a key, or for what isn't a chord: none.
  expect(chordColors("G", null)).toBeUndefined();
  expect(chordColors("Intro", D)).toBeUndefined();
});
