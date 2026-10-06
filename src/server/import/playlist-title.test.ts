import { expect, test } from "vitest";
import { splitTitle } from "./playlist-title.js";

const created = "2026-03-01T08:00:00.000Z";

test("a title that is only a date leaves none", () => {
  expect(splitTitle("4 October 2026", created)).toEqual({
    title: null,
    date: "2026-10-04",
  });
  expect(splitTitle("4 Mai 2021", created)).toEqual({
    title: null,
    date: "2021-05-04",
  });
  expect(splitTitle("1 february 2026", created)?.date).toBe("2026-02-01");
  expect(splitTitle("7iunie 2015", created)?.date).toBe("2015-06-07");
  expect(splitTitle("14January 2018", created)?.date).toBe("2018-01-14");
  expect(splitTitle("5 aug. 2018", created)?.date).toBe("2018-08-05");
});

test("what follows the date is the title", () => {
  expect(splitTitle("1 March 2026 seara", created)).toEqual({
    title: "seara",
    date: "2026-03-01",
  });
  expect(splitTitle("22 May 2026 - ado", created)?.title).toBe("ado");
  expect(splitTitle("23 January 2026 (ado)", created)?.title).toBe("ado");
  expect(splitTitle("1 March 2026 după amiază", created)?.title).toBe(
    "după amiază",
  );
});

test("a weekday before the date goes; a missing year is the nearest one", () => {
  expect(splitTitle("Duminica 4 mai", "2025-04-30T10:00:00Z")).toEqual({
    title: null,
    date: "2025-05-04",
  });
  expect(splitTitle("2 ianuarie", "2025-12-28T10:00:00Z")?.date).toBe(
    "2026-01-02",
  );
  expect(splitTitle("19 junie", "2025-06-01T10:00:00Z")?.date).toBe(
    "2025-06-19",
  );
});

test("titles without a date are left alone", () => {
  for (const title of [
    "Florii",
    "July 2018",
    "289",
    "Repetiție nuntă 2",
    "4 seara",
    "31 February 2026",
  ])
    expect(splitTitle(title, created)).toBeNull();
});
