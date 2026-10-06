import { expect, test } from "vitest";
import {
  chapterLines,
  offsetIn,
  parseTimestamp,
  timestamp,
} from "./chapters.js";

const at = (time: string) => `2026-10-04T${time}.000Z`;
const titles: Record<string, string> = {
  har: "Har minunat",
  ioan: "Ioan 3:16",
  predica: "Predica",
  gresit: "Cântec greșit",
};
const title = (id: string) => titles[id] ?? id;

test("the spec's example: an offset puts 0:00 Start first", () => {
  expect(
    chapterLines(
      [
        { entryId: "har", at: at("07:02:10"), until: at("07:08:40") },
        { entryId: "ioan", at: at("07:08:40"), until: at("07:12:00") },
        { entryId: "predica", at: at("07:12:00"), until: null },
      ],
      parseTimestamp("12:30") ?? 0,
      title,
      "Start",
    ),
  ).toEqual([
    "0:00 Start",
    "12:30 Har minunat",
    "19:00 Ioan 3:16",
    "22:20 Predica",
  ]);
});

test("a song shown for 4 seconds goes, and the same entry twice in a row is one chapter", () => {
  expect(
    chapterLines(
      [
        { entryId: "gresit", at: at("07:00:00"), until: at("07:00:04") },
        { entryId: "har", at: at("07:00:04"), until: at("07:00:30") },
        { entryId: "gresit", at: at("07:00:30"), until: at("07:00:33") },
        { entryId: "har", at: at("07:00:33"), until: at("08:10:00") },
        { entryId: "predica", at: at("08:10:00"), until: null },
      ],
      0,
      title,
      "Start",
    ),
  ).toEqual(["0:00 Har minunat", "1:09:56 Predica"]);
});

test("timestamps as YouTube reads them, and typed ones", () => {
  expect([0, 59, 750, 3725].map(timestamp)).toEqual([
    "0:00",
    "0:59",
    "12:30",
    "1:02:05",
  ]);
  expect(["12:30", "1:02:05", "45", " 0:05 "].map(parseTimestamp)).toEqual([
    750, 3725, 45, 5,
  ]);
  for (const bad of ["", "12:3", "1:60", "a:00", "1:2:3:4"])
    expect(parseTimestamp(bad)).toBeNull();
  expect(chapterLines([], 30, title, "Start")).toEqual([]);
});

test("a live stream's start gives the offset of the first chapter", () => {
  const shown = [
    { entryId: "gresit", at: at("07:00:00"), until: at("07:00:04") },
    { entryId: "har", at: at("07:12:30"), until: null },
  ];
  // The 4-second mistake isn't a chapter: the offset is Har minunat's.
  expect(offsetIn(shown, "2026-10-04T07:00:00Z")).toBe(750);
  // Live before the stream started: no offset to give.
  expect(offsetIn(shown, "2026-10-04T07:15:00Z")).toBeNull();
  expect(offsetIn([], "2026-10-04T07:00:00Z")).toBeNull();
});
