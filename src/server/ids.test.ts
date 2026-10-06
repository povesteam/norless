import { expect, test } from "vitest";
import { idFrom, newId } from "./ids.js";

test("ids are 12 letters and digits, new ones random, derived ones stable", () => {
  const ids = new Set(Array.from({ length: 2000 }, newId));
  expect(ids.size).toBe(2000);
  for (const id of ids) expect(id).toMatch(/^[0-9A-Za-z]{12}$/);
  expect(idFrom("a", "b")).toMatch(/^[0-9A-Za-z]{12}$/);
  expect(idFrom("a", "b")).toBe(idFrom("a", "b"));
  expect(idFrom("a", "b")).not.toBe(idFrom("a", "c"));
});

test("every character comes up about as often", () => {
  const counts = new Map<string, number>();
  for (let i = 0; i < 5000; i++)
    for (const c of newId()) counts.set(c, (counts.get(c) ?? 0) + 1);
  expect(counts.size).toBe(62);
  // 60,000 characters: about 968 each.
  for (const n of counts.values()) expect(n).toBeGreaterThan(800);
});
