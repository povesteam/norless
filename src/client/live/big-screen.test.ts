import { expect, test } from "vitest";
import { layoutsFor, tierOf } from "./big-screen";

const layouts = [{ id: "controller" }, { id: "big-screen" }];

test("Big screen is offered from 1900 CSS pixels, and grows at QHD and 4K", () => {
  expect(layoutsFor(layouts, 1440).map((l) => l.id)).toEqual(["controller"]);
  expect(layoutsFor(layouts, 1920).map((l) => l.id)).toEqual([
    "controller",
    "big-screen",
  ]);
  expect([1920, 2560, 3840].map(tierOf)).toEqual([1, 2, 3]);
  // 4K at 150% scaling: the browser has 2560.
  expect(tierOf(2560)).toBe(2);
});
