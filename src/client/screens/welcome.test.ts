import { expect, test } from "vitest";
import { untilStart } from "./welcome";

test("the countdown runs within a day, shows the moment further off, and hides at zero", () => {
  const at = Date.parse("2026-10-11T07:00:00Z");
  const start = "2026-10-11T07:04:32Z";
  expect(untilStart(start, at)).toEqual({ countdown: "4:32" });
  expect(untilStart(start, at - 3_600_000)).toEqual({ countdown: "1:04:32" });
  expect(untilStart(start, at - 2 * 24 * 3_600_000)).toEqual({
    later: new Date(start),
  });
  expect(untilStart(start, Date.parse(start))).toBeNull();
  expect(untilStart(null, at)).toBeNull();
});
