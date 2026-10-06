import { describe, expect, test } from "vitest";
import {
  keyChords,
  placeOver,
  transposeChord,
  transposeText,
  textInLetters,
} from "./chord-sheet.js";

const A = { tonic: "A", minor: false };
const C = { tonic: "C", minor: false };
const G = { tonic: "G", minor: false };

test("a chord moves over the same letters of a line written a little differently", () => {
  // Without diacritics and a comma: still over "Domnului" and "toți".
  expect(
    placeOver(
      "Cantati Domnului toti",
      [
        { at: 8, name: "C" },
        { at: 17, name: "G" },
      ],
      "  Cântați Domnului, toți",
    ),
  ).toEqual([
    { at: 8, name: "C" },
    { at: 18, name: "G" },
  ]);
});

describe("keys", () => {
  test("transposing spells notes for the key it lands in", () => {
    expect(transposeChord("Bb/D", 2, C)).toBe("C/E");
    expect(transposeChord("F#m7", 2, A)).toBe("G#m7");
    expect(transposeChord("G", -2, { tonic: "F", minor: false })).toBe("F");
    expect(transposeChord("C", 2, { tonic: "D", minor: false })).toBe("D");
    expect(transposeChord("Ab", 2, { tonic: "D", minor: false })).toBe("Bb");
    expect(transposeChord("c#", 2, A)).toBe("d#");
  });

  test("the six chords of a key, from the tonic chord", () => {
    expect(keyChords(G)).toEqual(["G", "Am", "Bm", "C", "D", "Em"]);
    expect(keyChords({ tonic: "E", minor: true })).toEqual([
      "Em",
      "G",
      "Am",
      "Bm",
      "C",
      "D",
    ]);
  });
});

test("transposeText moves chord lines only, keeping their columns", () => {
  const text =
    "1:\n.G    D/F#  Em | C |\n Cântați Domnului\n! drums: rim\n.Intro: Do  Sol";
  expect(transposeText(text, 1, { tonic: "Ab", minor: false })).toBe(
    "1:\n.Ab   Eb/G  Fm | Db |\n Cântați Domnului\n! drums: rim\n.Intro: Db  Ab",
  );
});

test("textInLetters writes Do-Re-Mi chord lines in letters and leaves the words", () => {
  expect(textInLetters("1:\n.Re     Sol7\n Cântați Domnului\n.G  C")).toBe(
    "1:\n.D      G7\n Cântați Domnului\n.G  C",
  );
});
