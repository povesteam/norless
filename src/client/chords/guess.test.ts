import { expect, test } from "vitest";
import type { LiveView } from "../../server/live/live-view";
import { guessAfter } from "./guess";

const view = {
  entryId: "e",
  slide: 1,
  slides: 3,
  blank: false,
  page: null,
} as LiveView;

test("next, previous, a part of the live entry and blank are known at once", () => {
  expect(guessAfter(view, { type: "next" })).toMatchObject({ slide: 2 });
  expect(guessAfter(view, { type: "previous" })).toMatchObject({ slide: 0 });
  expect(
    guessAfter(view, { type: "go", entryId: "e", slide: 0 }),
  ).toMatchObject({ slide: 0, blank: false });
  expect(guessAfter(view, { type: "blank", blank: true })).toMatchObject({
    slide: 1,
    blank: true,
  });
});

test("another entry, or past the entry's slides, waits for the server", () => {
  expect(guessAfter(view, { type: "go", entryId: "other" })).toBeNull();
  expect(guessAfter({ ...view, slide: 2 }, { type: "next" })).toBeNull();
  expect(guessAfter({ ...view, slide: 0 }, { type: "previous" })).toBeNull();
  expect(guessAfter({ ...view, entryId: null }, { type: "next" })).toBeNull();
});
