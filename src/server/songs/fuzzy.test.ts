import { describe, expect, test } from "vitest";
import { reduced, typoBudget, typos } from "./fuzzy.js";

describe("sloppy matches", () => {
  test("reduce texts to letters and digits", () => {
    expect(reduced("Dați-mi un Cântec, 2!")).toBe("datimiuncantec2");
    expect(reduced("Святий Бог")).toBe("святиибог");
  });

  test("count the fewest typos anywhere in a text", () => {
    expect(typos("minunat", "harminunatesti")).toBe(0);
    expect(typos("minunt", "harminunatesti")).toBe(1);
    expect(typos("minuant", "harminunatesti")).toBe(2);
    expect(typos("xyz", "abc")).toBe(3);
  });

  test("allow one typo per five letters", () => {
    expect([4, 5, 9, 10].map((n) => typoBudget("a".repeat(n)))).toEqual([
      0, 1, 1, 2,
    ]);
  });
});
