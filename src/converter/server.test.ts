import { describe, expect, test } from "vitest";
import { parseStretches, queue } from "./server.js";

describe("queue", () => {
  test("lets `at` jobs run, the next one when one ends, and refuses past the wait", async () => {
    const take = queue(1);
    const first = await take(1000);
    expect(first).toBeTypeOf("function");
    const second = take(1000);
    const third = take(10);
    expect(await third).toBeNull();
    first?.();
    // Released twice, it frees one place only.
    first?.();
    const next = await second;
    expect(next).toBeTypeOf("function");
    expect(await take(10)).toBeNull();
    next?.();
  });
});

test("stretches are milliseconds, the last one open to the end", () => {
  expect(parseStretches("0-3000,3400-")).toEqual([
    { start: 0, end: 3000 },
    { start: 3400, end: null },
  ]);
  for (const bad of ["", "3000-1000", "a-b", "0-1;rm", "-5"])
    expect(parseStretches(bad), bad).toBeNull();
});
