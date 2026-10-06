/**
 * An old playlist's title taken apart: a leading date ("4 October 2026",
 * "Duminica 4 mai", "7iunie 2015") becomes the playlist's date, the rest its title.
 */
const months = [
  ["january", "ianuarie"],
  ["february", "februarie"],
  ["march", "martie"],
  ["april", "aprilie"],
  ["may", "mai"],
  ["june", "iunie", "junie"],
  ["july", "iulie"],
  ["august"],
  ["september", "septembrie"],
  ["october", "octombrie"],
  ["november", "noiembrie"],
  ["december", "decembrie"],
];
const weekdays =
  "duminic[aă]|luni|mar[tț]i|miercuri|joi|vineri|s[aâ]mb[aă]t[aă]|sunday|monday|tuesday|wednesday|thursday|friday|saturday";
const pattern = new RegExp(
  `^\\s*(?:(?:${weekdays})[\\s,]+)?(\\d{1,2})[\\s.\\-/]*(\\p{L}{3,})\\.?(?:[\\s,]+(\\d{4})(?!\\d))?(.*)$`,
  "iu",
);

/** January is 0; a word of 3 letters or more that starts a month's name. */
const monthOf = (word: string) =>
  months.findIndex((names) =>
    names.some((name) => name.startsWith(word.toLowerCase())),
  );

/**
 * `{ title, date }`: the title without its date (null when nothing else is left) and the
 * date (`2026-10-04`); a missing year is the one nearest to `created`. Null when the title
 * doesn't start with a date.
 */
export function splitTitle(
  title: string,
  created: string,
): { title: string | null; date: string } | null {
  const match = pattern.exec(title);
  if (!match) return null;
  const [, day, word = "", year, rest = ""] = match;
  const month = monthOf(word);
  if (month < 0) return null;
  const made = new Date(created);
  const years = year
    ? [Number(year)]
    : [-1, 0, 1].map((d) => made.getUTCFullYear() + d);
  const [at] = years
    .map((y) => new Date(Date.UTC(y, month, Number(day), 12)))
    .sort(
      (a, b) =>
        Math.abs(a.getTime() - made.getTime()) -
        Math.abs(b.getTime() - made.getTime()),
    );
  if (!at || at.getUTCDate() !== Number(day)) return null;
  const left = rest
    .trim()
    .replace(/^[-–—,:;.\s]+/, "")
    .replace(/^\((.*)\)$/, "$1")
    .trim();
  return { title: left || null, date: at.toISOString().slice(0, 10) };
}
