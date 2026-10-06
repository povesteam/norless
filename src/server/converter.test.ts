import { expect, test } from "vitest";
import { converterNews, type Watch } from "./converter.js";

test("the app team hears once after 5 minutes away, and once when it's back", () => {
  const minute = 60_000;
  let watch: Watch = { awaySince: null, told: false };
  const step = (ok: boolean, at: number) => {
    const next = converterNews(watch, ok, at * minute);
    watch = next.watch;
    return next.news;
  };
  expect(step(true, 0)).toBeNull();
  // Away for a moment (a deploy's restart): nobody hears.
  expect(step(false, 1)).toBeNull();
  expect(step(true, 2)).toBeNull();
  // Away for good, from minute 3: told at minute 8, once.
  expect([3, 4, 5, 6, 7, 8, 9].map((at) => step(false, at))).toEqual([
    null,
    null,
    null,
    null,
    null,
    "away",
    null,
  ]);
  expect(step(true, 10)).toBe("back");
  expect(step(true, 11)).toBeNull();
});
