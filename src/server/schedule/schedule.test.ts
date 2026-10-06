import { describe, expect, test } from "vitest";
import {
  classify,
  eventAround,
  localTime,
  type ScheduleEvent,
  zonedDate,
} from "./schedule.js";

const tz = "Europe/Bucharest";
const event = (e: Partial<ScheduleEvent>): ScheduleEvent => ({
  id: "x",
  type: "service",
  kind: "recurring",
  weekday: null,
  start_time: null,
  end_time: null,
  first_date: null,
  last_date: null,
  date: null,
  cancels_event_id: null,
  ...e,
});
const morning = event({
  id: "morning",
  weekday: 7,
  start_time: "10:00",
  end_time: "12:00",
  first_date: "2014-02-15",
});
const evening = event({
  id: "evening",
  weekday: 7,
  start_time: "17:30",
  end_time: "19:00",
  first_date: "2014-02-15",
  last_date: "2020-03-15",
});
const history = [morning, evening];

describe("localTime", () => {
  test("uses summer time (UTC+3) and winter time (UTC+2)", () => {
    expect(localTime(new Date("2026-07-05T07:00:00Z"), tz)).toEqual({
      date: "2026-07-05",
      weekday: 7,
      minutes: 600,
    });
    expect(localTime(new Date("2026-01-04T08:00:00Z"), tz)).toEqual({
      date: "2026-01-04",
      weekday: 7,
      minutes: 600,
    });
  });
});

describe("classify", () => {
  test.each([
    ["rehearsal right before the service", "2026-09-27T06:40:00Z", "rehearsal"], // 9:40
    ["the service start", "2026-09-27T07:00:00Z", "service"], // 10:00
    ["a service running late", "2026-09-27T09:25:00Z", "service"], // 12:25
    ["more than 30 minutes after the end", "2026-09-27T09:31:00Z", "rehearsal"], // 12:31
    ["a Thursday evening", "2026-09-24T15:30:00Z", "rehearsal"],
    ["the evening service before Covid", "2019-11-03T16:00:00Z", "service"], // 18:00 winter time
    ["the evening slot after Covid", "2023-11-05T16:00:00Z", "rehearsal"],
    ["the last evening service", "2020-03-15T16:00:00Z", "service"],
    ["the Sunday the clocks go forward", "2026-03-29T07:30:00Z", "service"], // 10:30 summer time
    ["the Sunday the clocks go back", "2026-10-25T08:30:00Z", "service"], // 10:30 winter time
  ])("%s", (_, at, mode) => {
    expect(classify(new Date(at), history, tz)).toBe(mode);
  });

  test("a one-off event wins over the recurring one, and a cancellation removes a day", () => {
    const events = [
      morning,
      event({
        id: "cancel",
        kind: "cancellation",
        date: "2026-10-04",
        cancels_event_id: "morning",
      }),
      event({
        id: "conference",
        kind: "one_off",
        date: "2026-10-04",
        start_time: "15:00",
        end_time: "18:00",
      }),
    ];

    expect(classify(new Date("2026-10-04T07:30:00Z"), events, tz)).toBe(
      "rehearsal",
    ); // 10:30, cancelled
    expect(classify(new Date("2026-10-04T13:00:00Z"), events, tz)).toBe(
      "service",
    ); // 16:00, conference
    expect(classify(new Date("2026-10-11T07:30:00Z"), events, tz)).toBe(
      "service",
    ); // next Sunday
  });

  test("deleted events are ignored", () => {
    expect(
      classify(
        new Date("2026-09-27T07:30:00Z"),
        [{ ...morning, deleted_at: "2026-01-01" }],
        tz,
      ),
    ).toBe("rehearsal");
  });
});

describe("events around an instant", () => {
  test("local times become instants, across summer time", () => {
    expect(zonedDate("2026-10-04", "10:00", tz).toISOString()).toBe(
      "2026-10-04T07:00:00.000Z",
    );
    expect(zonedDate("2026-12-06", "10:00", tz).toISOString()).toBe(
      "2026-12-06T08:00:00.000Z",
    );
  });

  test("the event in progress, or the next one", () => {
    // Sunday 4 October 2026, 11:00 in Bucharest: during the morning service.
    const during = eventAround(new Date("2026-10-04T08:00:00Z"), [morning], tz);
    expect(during?.end.toISOString()).toBe("2026-10-04T09:00:00.000Z");
    // Wednesday: the next Sunday's.
    const next = eventAround(new Date("2026-10-07T08:00:00Z"), [morning], tz);
    expect(next?.start.toISOString()).toBe("2026-10-11T07:00:00.000Z");
    expect(eventAround(new Date("2026-10-07T08:00:00Z"), [], tz)).toBeNull();
  });
});
