import { expect, test } from "vitest";
import { showsNothing } from "./screens";

const live = {
  blank: false,
  entryId: "e1",
  page: null,
  event: true,
};

test("a screen reloads to a new version only while it shows nothing", () => {
  // A refrain during the service: it waits.
  expect(showsNothing(live)).toBe(false);
  // A start page is something too.
  expect(showsNothing({ ...live, entryId: null, page: { id: "p" } })).toBe(
    false,
  );
  // Blank, nothing live, or not loaded yet.
  expect(showsNothing({ ...live, blank: true })).toBe(true);
  expect(showsNothing({ ...live, entryId: null })).toBe(true);
  expect(showsNothing(undefined)).toBe(true);
  // On a Wednesday, with no service or rehearsal running.
  expect(showsNothing({ ...live, event: false })).toBe(true);
});
