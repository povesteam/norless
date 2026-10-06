import { expect, test } from "vitest";
import { fingering } from "./guitar.js";

test("open shapes, from the high string, with x for strings not played", () => {
  expect(fingering("C")).toEqual({
    fingers: [
      [6, "x"],
      [5, 3],
      [4, 2],
      [3, 0],
      [2, 1],
      [1, 0],
    ],
    barre: null,
    position: 1,
  });
});

test("a barre chord high on the neck starts at its first fret", () => {
  const cSharpMinor = fingering("C#m");
  expect(cSharpMinor?.position).toBe(4);
  expect(cSharpMinor?.barre).toEqual({ fret: 1, from: 5, to: 1 });
  expect(fingering("F")?.barre).toEqual({ fret: 1, from: 6, to: 1 });
  expect(fingering("Hm7b13")).toBeNull();
});
