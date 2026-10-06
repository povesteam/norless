import { describe, expect, test } from "vitest";
import {
  bibleLink,
  formatReference,
  isValidReference,
  parseReference,
} from "./bible.js";
import { bibleBooks } from "./bible-books.js";

const titles = (query: string, languages = ["ro", "uk"]) =>
  parseReference(query, languages).map((r) => formatReference(r, "ro"));

describe("bibleBooks", () => {
  test("has the 66 books with 1,189 chapters", () => {
    expect(bibleBooks).toHaveLength(66);
    expect(bibleBooks.flatMap((b) => b.verses)).toHaveLength(1189);
    expect(new Set(bibleBooks.map((b) => b.usfm)).size).toBe(66);
  });
});

describe("parseReference", () => {
  test("a range matches every book containing the name that has the chapter", () => {
    expect(titles("ioan 3:16-18")).toEqual(["Ioan 3:16-18", "1 Ioan 3:16-18"]);
  });

  test("verses past the end of the chapter are limited to its last verse", () => {
    expect(titles("ps 23 99")).toEqual(["Psalm 23:6"]);
  });

  test("a reversed range is swapped", () => {
    expect(titles("Ioan 3,18-16")).toEqual(["Ioan 3:16-18", "1 Ioan 3:16-18"]);
  });

  test("no verses means the whole chapter", () => {
    expect(titles("geneza 1")).toEqual(["Geneza 1:1-31"]);
    expect(titles("1ioan 5:")).toEqual(["1 Ioan 5:1-21"]);
  });

  test("books without the chapter are left out", () => {
    expect(titles("2 ioan 3")).toEqual([]);
    expect(titles("iuda 0")).toEqual([]);
  });

  test("book names match without diacritics, in any community language", () => {
    expect(titles("1 imparati 3:5")).toEqual(["1 Împărați 3:5"]);
    expect(titles("Івана 3:16")).toEqual(["Ioan 3:16", "1 Ioan 3:16"]);
    expect(titles("обявлення 22 21")).toEqual(["Apocalipsa 22:21"]);
    expect(titles("john 3:16")).toEqual([]);
    expect(titles("john 3:16", ["en"])).toEqual(["Ioan 3:16", "1 Ioan 3:16"]);
  });

  test("a query without a chapter is not a reference", () => {
    expect(titles("ioan")).toEqual([]);
    expect(titles("isus e domn")).toEqual([]);
    expect(titles("3 16")).toEqual([]);
    expect(titles("psalmul 23")).toEqual([]);
  });
});

describe("formatReference", () => {
  test("uses the language's name, and English when it has none", () => {
    const ref = { book: 43, chapter: 3, from: 16, to: 16 };
    expect(formatReference(ref, "uk")).toBe("Івана 3:16");
    expect(formatReference(ref, "de")).toBe("John 3:16");
  });
});

test("links a passage to bible.com in the language's version", () => {
  const john = { book: 43, chapter: 3, from: 16, to: 18 };
  expect(bibleLink(john, "ro")).toBe(
    "https://www.bible.com/bible/191/JHN.3.16-18.VDC",
  );
  expect(bibleLink({ ...john, to: 16 }, "uk")).toBe(
    "https://www.bible.com/bible/186/JHN.3.16.UBIO",
  );
  expect(bibleLink(john, "de")).toBeNull();
  // The community's choice: a listed version, or any other by its id.
  expect(bibleLink(john, "ro", 126)).toBe(
    "https://www.bible.com/bible/126/JHN.3.16-18.NTR",
  );
  expect(bibleLink(john, "de", 57)).toBe(
    "https://www.bible.com/bible/57/JHN.3.16-18",
  );
});

test("a reference is valid only inside its chapter", () => {
  expect(isValidReference({ book: 19, chapter: 23, from: 1, to: 6 })).toBe(
    true,
  );
  expect(isValidReference({ book: 19, chapter: 23, from: 1, to: 7 })).toBe(
    false,
  );
  expect(isValidReference({ book: 19, chapter: 151, from: 1, to: 1 })).toBe(
    false,
  );
  expect(isValidReference({ book: 67, chapter: 1, from: 1, to: 1 })).toBe(
    false,
  );
  expect(isValidReference({ book: 1, chapter: 1, from: 3, to: 2 })).toBe(false);
});
