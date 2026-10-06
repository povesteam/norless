import { expect, test } from "vitest";
import { parseMinutes } from "./minutes";

test("planned minutes in the ways people write them", () => {
  for (const [text, minutes] of [
    ["45", 45],
    ["45m", 45],
    ["45 min", 45],
    ["90 min", 90],
    ["1h", 60],
    ["1h30", 90],
    ["1 h 30 min", 90],
    ["1:30", 90],
    ["2:05", 125],
    ["1 oră 15 min", 75],
    ["1 год 30 хв", 90],
    [" 4h ", 240],
  ] as const)
    expect(parseMinutes(text), text).toBe(minutes);
});

test("anything else, or more than 4 hours, isn't planned minutes", () => {
  for (const text of ["", "h", "abc", "1:75", "0", "5h", "1.5h", "30 sec"])
    expect(parseMinutes(text), text).toBeNull();
});
