/** "3 weeks ago" in the given language: days within a week, then weeks, months and years. */
export function relativeTime(iso: string, now: Date, locale: string): string {
  const days = Math.round((Date.parse(iso) - now.getTime()) / 86_400_000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const size = Math.abs(days);
  if (size < 7) return format.format(days, "day");
  if (size < 30) return format.format(Math.round(days / 7), "week");
  if (size < 365) return format.format(Math.round(days / 30), "month");
  return format.format(Math.round(days / 365), "year");
}

/** A time of day on the 24-hour clock in every language, e.g. 09:05 or 18:30. */
export const clock = (at: Date | string | number, locale: string) =>
  new Date(at).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
