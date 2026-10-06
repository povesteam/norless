import { expect, test } from "vitest";
import { initials } from "./NameAvatar";

test("initials are the first letters of the first two words", () => {
  expect(initials("Ioana Marin")).toBe("IM");
  expect(initials("povesteam")).toBe("P");
  // A device's name: its owner's in brackets.
  expect(initials("Laptop (Dan)")).toBe("LD");
  expect(initials("ștefan  țurcanu")).toBe("ȘȚ");
  expect(initials("— Ana")).toBe("A");
});
