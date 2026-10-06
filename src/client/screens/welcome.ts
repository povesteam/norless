/**
 * The welcome screen's countdown: "4:32" or "1:04:32" within a day,
 * the moment itself further off, and nothing once it has started.
 */
export function untilStart(startsAt: string | null, now: number) {
  if (!startsAt) return null;
  const left = Date.parse(startsAt) - now;
  if (!(left > 0)) return null;
  if (left >= 24 * 3_600_000) return { later: new Date(startsAt) };
  const seconds = Math.ceil(left / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    countdown: h
      ? `${h}:${pad(m)}:${pad(seconds % 60)}`
      : `${m}:${pad(seconds % 60)}`,
  };
}
