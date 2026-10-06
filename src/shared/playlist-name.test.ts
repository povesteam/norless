import { expect, test } from "vitest";
import { playlistDate, playlistName } from "./playlist-name";

const now = new Date("2026-10-06T08:00:00Z");

test("a date reads as day and full month, the year only another year", () => {
  expect(playlistDate("2026-10-04", "ro", now)).toBe("4 octombrie");
  expect(playlistDate("2026-10-04", "uk", now)).toBe("4 жовтня");
  expect(playlistDate("2026-10-04", "en", now)).toBe("October 4");
  expect(playlistDate("2025-10-04", "ro", now)).toBe("4 octombrie 2025");
});

test("a title comes first, then the date", () => {
  expect(playlistName({ title: "seara", date: "2026-03-01" }, "ro", now)).toBe(
    "seara · 1 martie",
  );
  expect(playlistName({ title: null, date: "2026-03-01" }, "ro", now)).toBe(
    "1 martie",
  );
});
