/** The planned minutes an entry can have: up to 4 hours. */
export const MAX_MINUTES = 240;

const hours = String.raw`(?:h|hr|hrs|hours?|or[aeă]|год\p{L}*)`;
const mins = String.raw`(?:m|min|mins|minutes?|minut\p{L}*|хв\p{L}*)`;
const spelled = new RegExp(
  String.raw`^(?:(\d{1,3})\s*${hours}\.?)?\s*(?:(\d{1,3})\s*(?:${mins}\.?)?)?$`,
  "u",
);

/**
 * Planned minutes from what someone types, in whole minutes: 45, 45m, 90 min, 1h, 1h30,
 * 1 h 30 min, or 1:30 for an hour and a half. Null when it's none
 * of these, or outside 1 to 240 minutes.
 */
export function parseMinutes(text: string): number | null {
  const s = text.trim().toLowerCase();
  const clock = /^(\d{1,2}):([0-5]\d)$/.exec(s);
  const words = clock ? null : spelled.exec(s);
  if (!clock && !words?.some((part, i) => i > 0 && part)) return null;
  const [, h = "0", m = "0"] = clock ?? words ?? [];
  const total = Number(h) * 60 + Number(m);
  return total >= 1 && total <= MAX_MINUTES ? total : null;
}
