import { expect, test } from "vitest";
import { normalizeTag } from "./tags.js";

test.each([
  ["Crăciun!", "craciun"],
  ["  Cina   Domnului ", "cina domnului"],
  ["ȘȚĂÂÎ-șţ", "staai st"],
  ["Різдво", "різдво"],
  ["Святий Дух", "святий дух"],
  ["Їжак", "їжак"],
  ["!!!", ""],
])("normalizeTag(%j) is %j", (input, expected) => {
  expect(normalizeTag(input)).toBe(expected);
});
