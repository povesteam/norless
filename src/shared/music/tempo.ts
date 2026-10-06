/**
 * The tempo check: readings from a beat detector, folded to the
 * song's target, and the rule for when the band has drifted long enough to say so.
 */

/** A reading at half or double time counts as the target's: 144 for 72 is 72. */
export function foldToTarget(bpm: number, target: number): number {
  let folded = bpm;
  while (folded > target * 1.5) folded /= 2;
  while (folded < target / 1.5) folded *= 2;
  return folded;
}

export type Drift = "fast" | "slow";

export type DriftState = {
  /** The direction the band is off in, and since when (ms). */
  off: Drift | null;
  since: number | null;
  /** What the stage shows. */
  shown: Drift | null;
  /** The last reading's time, to notice silence. */
  heardAt: number | null;
};

export const calm: DriftState = {
  off: null,
  since: null,
  shown: null,
  heardAt: null,
};

/** Without a reading for this long, the input is silent and nothing shows. */
export const SILENCE_MS = 4000;

/**
 * The next state after a reading (or none, at time `at`): off by more than `percent`
 * of the target for `seconds` shows the drift; back within it, or silence, clears it.
 */
export function driftStep(
  state: DriftState,
  at: number,
  reading: number | null,
  target: number,
  { percent, seconds }: { percent: number; seconds: number },
): DriftState {
  if (reading === null)
    return state.heardAt !== null && at - state.heardAt > SILENCE_MS
      ? calm
      : state;
  const bpm = foldToTarget(reading, target);
  const off: Drift | null =
    Math.abs(bpm - target) / target <= percent / 100
      ? null
      : bpm > target
        ? "fast"
        : "slow";
  if (off === null) return { ...calm, heardAt: at };
  const since = state.off === off && state.since !== null ? state.since : at;
  return {
    off,
    since,
    shown:
      at - since >= seconds * 1000
        ? off
        : state.off === off
          ? state.shown
          : null,
    heardAt: at,
  };
}

/** The middle of some numbers, rounded; null without any. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2
      ? (sorted[mid] ?? 0)
      : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  return Math.round(value);
}
