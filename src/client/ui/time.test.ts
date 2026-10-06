import { expect, test } from "vitest";
import { clock, relativeTime } from "./time";

const now = new Date("2026-09-30T12:00:00Z");

test("days, then weeks, months and years, in the UI language", () => {
  expect(relativeTime("2026-09-29T09:00:00Z", now, "en")).toBe("yesterday");
  expect(relativeTime("2026-09-09T09:00:00Z", now, "en")).toBe("3 weeks ago");
  expect(relativeTime("2026-09-09T09:00:00Z", now, "ro")).toBe(
    "acum 3 săptămâni",
  );
  expect(relativeTime("2026-09-09T09:00:00Z", now, "uk")).toBe("3 тижні тому");
  expect(relativeTime("2026-05-30T09:00:00Z", now, "en")).toBe("4 months ago");
  expect(relativeTime("2024-09-30T09:00:00Z", now, "en")).toBe("2 years ago");
});

test("the clock is on 24 hours in English too", () => {
  expect(clock(new Date(2026, 9, 4, 18, 5), "en")).toBe("18:05");
  expect(clock(new Date(2026, 9, 4, 9, 5), "ro")).toBe("09:05");
});
