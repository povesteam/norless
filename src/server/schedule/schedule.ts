export type EventType = "service" | "rehearsal";

export type ScheduleEvent = {
  id: string;
  /** What the community calls it, e.g. "Sunday service". */
  name?: string | null;
  type: EventType;
  kind: "recurring" | "one_off" | "cancellation";
  weekday: number | null; // ISO: 1 = Monday, 7 = Sunday
  start_time: string | null; // HH:MM
  end_time: string | null;
  first_date: string | null; // YYYY-MM-DD
  last_date: string | null;
  date: string | null;
  cancels_event_id: string | null;
  deleted_at?: string | null;
};

/** Services often run late: an event still counts this long after its end. */
export const LATE_MINUTES = 30;

const weekdays = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
} as const;

// One formatter per time zone: making one is far slower than using it.
const formatters = new Map<string, Intl.DateTimeFormat>();
const formatter = (timeZone: string) => {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    formatters.set(timeZone, format);
  }
  return format;
};

/** Date, ISO weekday and minutes since midnight of an instant, in a time zone. */
export function localTime(at: Date, timeZone: string) {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: weekdays[parts.weekday as keyof typeof weekdays],
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

const toMinutes = (hhmm: string) =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

const covers = (event: ScheduleEvent, minutes: number) =>
  event.start_time !== null &&
  event.end_time !== null &&
  minutes >= toMinutes(event.start_time) &&
  minutes <= toMinutes(event.end_time) + LATE_MINUTES;

/**
 * Mode of a play at `at`: the type of the event in progress (from its start until
 * LATE_MINUTES after its end), or rehearsal outside every event. One-off events win
 * over recurring ones; cancellations remove one day of a recurring event.
 */
export function classify(
  at: Date,
  events: ScheduleEvent[],
  timeZone: string,
): EventType {
  const { date, weekday, minutes } = localTime(at, timeZone);
  const live = events.filter((e) => !e.deleted_at);

  const oneOff = live.find(
    (e) => e.kind === "one_off" && e.date === date && covers(e, minutes),
  );
  if (oneOff) return oneOff.type;

  const cancelled = new Set(
    live
      .filter((e) => e.kind === "cancellation" && e.date === date)
      .map((e) => e.cancels_event_id),
  );
  const recurring = live.find(
    (e) =>
      e.kind === "recurring" &&
      e.weekday === weekday &&
      (e.first_date === null || e.first_date <= date) &&
      (e.last_date === null || date <= e.last_date) &&
      !cancelled.has(e.id) &&
      covers(e, minutes),
  );
  return recurring?.type ?? "rehearsal";
}

/** The instant a local date and time is in a time zone, e.g. 2026-10-04 10:00 in Bucharest. */
export function zonedDate(date: string, time: string, timeZone: string): Date {
  const guess = new Date(`${date}T${time}:00Z`);
  const local = localTime(guess, timeZone);
  const shown = Date.parse(`${local.date}T00:00:00Z`) + local.minutes * 60_000;
  return new Date(guess.getTime() - (shown - guess.getTime()));
}

export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

/**
 * The event in progress at `at` (until LATE_MINUTES after its end), or else the next one
 * in the coming week: its start, end and type.
 */
export function eventAround(
  at: Date,
  events: ScheduleEvent[],
  timeZone: string,
): { start: Date; end: Date; type: EventType } | null {
  const today = localTime(at, timeZone).date;
  for (let day = 0; day < 8; day++) {
    const happening = eventsOn(addDays(today, day), events, timeZone).filter(
      (e) => e.end.getTime() + LATE_MINUTES * 60_000 >= at.getTime(),
    );
    if (happening[0]) return happening[0];
  }
  return null;
}

/** The events of a local date, earliest first: one-offs and the recurring ones not cancelled. */
export function eventsOn(
  date: string,
  events: ScheduleEvent[],
  timeZone: string,
) {
  const live = events.filter((e) => !e.deleted_at);
  const weekday = ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
  const cancelled = new Set(
    live
      .filter((e) => e.kind === "cancellation" && e.date === date)
      .map((e) => e.cancels_event_id),
  );
  return [
    ...live.filter((e) => e.kind === "one_off" && e.date === date),
    ...live.filter(
      (e) =>
        e.kind === "recurring" &&
        e.weekday === weekday &&
        (e.first_date === null || e.first_date <= date) &&
        (e.last_date === null || date <= e.last_date) &&
        !cancelled.has(e.id),
    ),
  ]
    .filter((e) => e.start_time && e.end_time)
    .map((e) => ({
      id: e.id,
      start: zonedDate(date, e.start_time ?? "00:00", timeZone),
      end: zonedDate(date, e.end_time ?? "00:00", timeZone),
      type: e.type,
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** The first service that starts after `after`, within 60 days. */
export function nextService(
  after: Date,
  events: ScheduleEvent[],
  timeZone: string,
) {
  const today = localTime(after, timeZone).date;
  for (let day = 0; day < 60; day++) {
    const next = eventsOn(addDays(today, day), events, timeZone).find(
      (e) => e.type === "service" && e.start.getTime() > after.getTime(),
    );
    if (next) return next;
  }
  return null;
}

/** The last `count` service events that ended before `at`, most recent first. */
export function pastServices(
  at: Date,
  events: ScheduleEvent[],
  timeZone: string,
  count: number,
) {
  const found: { start: Date; end: Date }[] = [];
  const today = localTime(at, timeZone).date;
  for (let day = 0; day < 120 && found.length < count; day++)
    found.push(
      ...eventsOn(addDays(today, -day), events, timeZone)
        .filter((e) => e.type === "service" && e.end.getTime() < at.getTime())
        .reverse(),
    );
  return found.slice(0, count);
}
