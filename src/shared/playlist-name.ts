/**
 * How people read a playlist: its date, day and full month in their
 * language ("4 octombrie"), with the year only when it isn't this one; a title comes
 * first, the date after it.
 */
export type Named = { title: string | null; date: string };

const formats = new Map<string, Intl.DateTimeFormat>();
const format = (language: string, year: boolean) => {
  const key = `${language}|${year}`;
  let found = formats.get(key);
  if (!found) {
    found = new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "long",
      ...(year && { year: "numeric" }),
      timeZone: "UTC",
    });
    formats.set(key, found);
  }
  return found;
};

/** A calendar date (`2026-10-04`) as "4 octombrie", or "4 octombrie 2025" another year. */
export function playlistDate(date: string, language: string, now = new Date()) {
  const day = new Date(`${date}T12:00:00Z`);
  return format(language, day.getUTCFullYear() !== now.getFullYear()).format(
    day,
  );
}

/** As plain text, where the date can't be muted: "seara · 1 martie", or the date alone. */
export const playlistName = (
  { title, date }: Named,
  language: string,
  now?: Date,
) =>
  title
    ? `${title} · ${playlistDate(date, language, now)}`
    : playlistDate(date, language, now);
