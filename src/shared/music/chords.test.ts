import { describe, expect, test } from "vitest";
import {
  chordsAt,
  chordsUsed,
  inLetters,
  keyOf,
  lyricsOf,
  setBeats,
  setChords,
  tempoOf,
  keyInLetters,
} from "./chords.js";
import { parseSong, partBeats, type Slide } from "../song-text.js";

const lines = (text: string) =>
  parseSong(text).sections.flatMap((s) => s.lines);

describe("lyricsOf", () => {
  const song = "1:\n.G      C\n Cântați Domnului\nToți\n\nR:\nAleluia";

  test("chord lines, bar lines and notes may change; leading spaces don't count", () => {
    expect(
      lyricsOf(
        "1:\n.D   | A |\nCântați Domnului\n.E\n  Toți\n! drums: rim\n\nR:\n.Bm\nAleluia",
      ),
    ).toBe(lyricsOf(song));
  });

  test("a word, a section name or a new section changes it", () => {
    expect(lyricsOf(song.replace("Toți", "Toti"))).not.toBe(lyricsOf(song));
    expect(lyricsOf(song.replace("R:", "B:"))).not.toBe(lyricsOf(song));
    expect(lyricsOf(`${song}\n\nI:\n.G`)).not.toBe(lyricsOf(song));
  });

  test("removing a part of chords only, with its blank line, doesn't", () => {
    expect(lyricsOf("A\n\n.G D\n\nB")).toBe(lyricsOf("A\n\nB"));
  });
});

describe("setChords", () => {
  test("adds a chord line over a row, which gets a leading space", () => {
    const text = setChords("1:\nCântați Domnului", 1, [
      { at: 0, name: "G" },
      { at: 8, name: "C" },
    ]);
    expect(text).toBe("1:\n.G       C\n Cântați Domnului");
    expect(lines(text)[0]?.chords).toEqual([
      { at: 0, name: "G" },
      { at: 8, name: "C" },
    ]);
  });

  test("replaces the chords of a row, keeping its bar lines", () => {
    const text = ".| G   | C |\n Cântați Domnului";
    expect(chordsAt(text, 1)).toEqual([
      { name: "G", at: 2 },
      { name: "C", at: 8 },
    ]);
    const changed = setChords(text, 1, [
      { at: 2, name: "A" },
      { at: 8, name: "D" },
    ]);
    expect(changed).toBe(".| A   | D |\n Cântați Domnului");
  });

  test("keeps the chords where they were on a row without a leading space", () => {
    const text = ".G      C\nAmazing grace";
    const chords = chordsAt(text, 1);
    expect(lines(setChords(text, 1, chords))[0]?.chords).toEqual(
      lines(text)[0]?.chords,
    );
  });

  test("chords that would touch move apart", () => {
    expect(
      setChords("Ab", 0, [
        { at: 0, name: "Gsus4" },
        { at: 1, name: "G" },
      ]),
    ).toBe(".Gsus4 G\n Ab");
  });

  test("without chords, the chord line goes, and a row of chords only too", () => {
    expect(setChords(".G\n Doamne\nTu", 1, [])).toBe(" Doamne\nTu");
    expect(setChords("I:\n.G  D\n\n1:\nA", 1, [])).toBe("I:\n\n1:\nA");
  });

  test("changes a row of chords only", () => {
    const text = "I:\n. | G | D |";
    expect(chordsAt(text, 1)).toEqual([
      { name: "G", at: 3 },
      { name: "D", at: 7 },
    ]);
    expect(setChords(text, 1, [{ at: 3, name: "Em" }])).toBe("I:\n. | Em |  |");
  });
});

test("chordsUsed lists each chord once, in order, without other words", () => {
  expect(chordsUsed(".Intro: G  D\n\n.G   Em  C\n Doamne\n.D\n Tu")).toEqual([
    "G",
    "D",
    "Em",
    "C",
  ]);
});

test("inLetters turns Do-Re-Mi chords into letters", () => {
  expect(
    ["Re m", "la7", "Sol/si", "Do#m", "Sib", "G/B", "c#"].map(inLetters),
  ).toEqual(["Dm", "A7", "G/B", "C#m", "Bb", "G/B", "c#"]);
});

test("keyOf reads the key fields of the old data", () => {
  expect(
    [
      "Re",
      "Si b",
      "La m",
      "Sol Major",
      "Sib m",
      "F#m",
      "Re M",
      "re",
      "Do #",
    ].map(keyOf),
  ).toEqual([
    { tonic: "D", minor: false },
    { tonic: "Bb", minor: false },
    { tonic: "A", minor: true },
    { tonic: "G", minor: false },
    { tonic: "Bb", minor: true },
    { tonic: "F#", minor: true },
    { tonic: "D", minor: false },
    { tonic: "D", minor: false },
    { tonic: "C#", minor: false },
  ]);
  expect(["Sol + La", "0:30", "", "test"].map(keyOf)).toEqual([
    null,
    null,
    null,
    null,
  ]);
});

test("tempoOf averages the last 8 taps", () => {
  const taps = (gap: number, n: number) =>
    Array.from({ length: n }, (_, i) => i * gap);
  expect(tempoOf(taps(830, 8))).toBe(72);
  expect(tempoOf([0, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500])).toBe(
    120,
  );
  expect(tempoOf(taps(100, 3))).toBe(300);
  expect(tempoOf([0])).toBeNull();
});

test("keys in letters: Do-Re-Mi keys are converted, others kept as written", () => {
  expect(keyInLetters("Si b")).toBe("Bb");
  expect(keyInLetters("La m")).toBe("Am");
  expect(keyInLetters("F#m")).toBe("F#m");
  expect(keyInLetters("Sol + La")).toBe("Sol + La");
});

describe("beats in a bar (align-bar-grid)", () => {
  const intro = "Intro:\n.| C G | Am F |\n\nCuvinte";

  test("a bar's chords share it equally until beats are set", () => {
    const [slide] = parseSong(intro).slides;
    expect(partBeats(slide as Slide)).toEqual([
      [
        [
          { name: "C", beats: 1 },
          { name: "G", beats: 1 },
        ],
        [
          { name: "Am", beats: 1 },
          { name: "F", beats: 1 },
        ],
      ],
    ]);
  });

  test("setBeats holds a chord with underscores, which every view leaves out", () => {
    const text = setBeats(intro, 1, 0, [3, 1]);
    expect(text.split("\n")[1]).toBe(".| C__ G | Am F |");
    const [slide] = parseSong(text).slides;
    expect(slide?.lines.flatMap((l) => l.chords.map((c) => c.name))).toEqual([
      "C",
      "G",
      "Am",
      "F",
    ]);
    expect(partBeats(slide as Slide)[0]?.[0]).toEqual([
      { name: "C", beats: 3 },
      { name: "G", beats: 1 },
    ]);
    expect(chordsUsed(text)).toEqual(["C", "G", "Am", "F"]);
    // Back to equal; the chords keep their columns.
    expect(setBeats(text, 1, 0, [1, 1]).split("\n")[1]).toBe(
      ".| C   G | Am F |",
    );
  });

  test("over the words, the holds keep the chords where they were", () => {
    const text = ".| C    G   |\n Amazing grace";
    const next = setBeats(text, 1, 0, [1, 3]);
    expect(next.split("\n")[0]).toBe(".| C    G__ |");
    const chords = (t: string) => parseSong(t).slides[0]?.lines[0]?.chords;
    expect(chords(next)).toEqual(chords(text));
  });
});
