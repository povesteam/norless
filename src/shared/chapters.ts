/**
 * YouTube chapters: the entries of a service as `m:ss Title`
 * lines, from when each went live and when the first one starts in the video.
 */

/** An entry that went live, and when the next one did; null while it's still live. */
export type Shown = { entryId: string; at: string; until: string | null };

/** YouTube's shortest chapter. */
const SHORTEST = 10_000;

/** "12:30", or "1:02:05" from an hour. */
export function timestamp(seconds: number): string {
  const s = Math.floor(seconds);
  const pad = (n: number) => String(n).padStart(2, "0");
  const [h, m] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60)];
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** Seconds from "12:30", "1:02:05" or "45"; null when it isn't a time. */
export function parseTimestamp(text: string): number | null {
  const parts = text.trim().split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  if (parts.slice(1).some((p) => p.length !== 2 || Number(p) > 59)) return null;
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

/** The entries that become chapters: live for 10 seconds or more, not twice in a row. */
export const chapterEntries = (shown: Shown[]) =>
  shown
    .filter(
      (s) =>
        s.until === null || Date.parse(s.until) - Date.parse(s.at) >= SHORTEST,
    )
    .filter((s, i, all) => all[i - 1]?.entryId !== s.entryId);

/**
 * When the first chapter starts in a live stream's video, in seconds
 *; null when it went live before the stream started.
 */
export function offsetIn(shown: Shown[], streamStart: string): number | null {
  const [first] = chapterEntries(shown);
  if (!first) return null;
  const seconds = Math.round(
    (Date.parse(first.at) - Date.parse(streamStart)) / 1000,
  );
  return seconds >= 0 ? seconds : null;
}

/** The chapter lines, from when the first entry starts in the video. */
export function chapterLines(
  shown: Shown[],
  /** When the first entry starts in the video, in seconds. */
  start: number,
  title: (entryId: string) => string,
  startTitle: string,
): string[] {
  const kept = chapterEntries(shown);
  const [first] = kept;
  if (!first) return [];
  const lines = kept.map(
    (s) =>
      `${timestamp(start + (Date.parse(s.at) - Date.parse(first.at)) / 1000)} ${title(s.entryId)}`,
  );
  // YouTube wants the first chapter at 0:00.
  return start > 0 ? [`0:00 ${startTitle}`, ...lines] : lines;
}
