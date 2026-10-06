import { describe, expect, test } from "vitest";
import {
  calm,
  driftStep,
  foldToTarget,
  median,
  type DriftState,
} from "./tempo.js";

const settings = { percent: 4, seconds: 8 };

/** The state after readings, one per second from t=0. */
function play(readings: (number | null)[], target = 72) {
  return readings.reduce<DriftState>(
    (state, bpm, i) => driftStep(state, i * 1000, bpm, target, settings),
    calm,
  );
}

describe("drift", () => {
  test("the band speeds up: 77 for 10 seconds against 72", () => {
    expect(play(Array(10).fill(77)).shown).toBe("fast");
  });

  test("a short push doesn't count: 6% faster for 4 seconds, then settled", () => {
    const states = [76, 76, 76, 76, 72, 72].map((_, i, all) =>
      play(all.slice(0, i + 1)),
    );
    expect(states.every((s) => s.shown === null)).toBe(true);
  });

  test("dragging, then back within 4%, clears the hint", () => {
    expect(play(Array(9).fill(66)).shown).toBe("slow");
    expect(play([...Array(9).fill(66), 71]).shown).toBeNull();
  });

  test("silence clears it", () => {
    const off = play(Array(9).fill(80));
    expect(off.shown).toBe("fast");
    expect(driftStep(off, 9000 + 5000, null, 72, settings).shown).toBeNull();
    expect(driftStep(off, 9000 + 2000, null, 72, settings).shown).toBe("fast");
  });

  test("half and double time count as the target's", () => {
    expect(foldToTarget(144, 72)).toBe(72);
    expect(foldToTarget(38, 76)).toBe(76);
    expect(play(Array(10).fill(146)).shown).toBeNull();
  });
});

test("median of checks", () => {
  expect(median([70, 74, 69])).toBe(70);
  expect(median([70, 71])).toBe(71);
  expect(median([])).toBeNull();
});
