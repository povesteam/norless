import { describe, expect, test } from "vitest";
import { now, one, run } from "./test-helpers.js";
import { transform } from "./transform.js";

describe("community", () => {
  test("creates the community, default room, start and end pages and the known service history", () => {
    const { rows } = run();

    const community = one(rows.communities);
    expect(community).toMatchObject({
      slug: "unu-unu",
      name: "Unu-Unu",
      languages: '["ro","uk","en"]',
      time_zone: "Europe/Bucharest",
      theme: expect.stringContaining('"color":"#ac5334"'),
      privacy: expect.stringContaining("Str. Iugoslaviei nr. 64"),
    });
    expect(one(rows.rooms).community_id).toBe(community.id);
    expect(rows.pages.map((p) => p.url)).toEqual([
      "https://info.unu-unu.ro/slides-open-close/start",
      "https://info.unu-unu.ro/slides-open-close/end",
    ]);
    expect(
      rows.schedule_events.map((e) => [
        e.weekday,
        e.start_time,
        e.end_time,
        e.first_date,
        e.last_date,
      ]),
    ).toEqual([
      [7, "10:00", "12:00", "2014-02-15", null],
      [7, "17:30", "19:00", "2014-02-15", "2020-03-15"],
    ]);
  });

  test("fails clearly without a congregations record", () => {
    expect(() => transform(new Map(), { now })).toThrow(/congregations/);
  });
});

describe("plays", () => {
  test("opens become plays, deduplicated across databases and classified with the history", () => {
    const opens = [
      { _id: "o1", song_id: "s1", time: Date.parse("2026-09-27T07:30:00Z") }, // Sunday 10:30
      { _id: "o2", song_id: "s1", time: Date.parse("2026-09-27T06:30:00Z") }, // Sunday 9:30
      { _id: "o3", song_id: "s1", time: Date.parse("2019-11-03T16:00:00Z") }, // Sunday 18:00, before Covid
      { _id: "o4", song_id: "gone", time: 1 },
    ];
    const { rows, report } = run({
      "norless.songs": [{ _id: "s1", title: "A", text: "a" }],
      "norless.opens": opens,
      "norless-ua.opens": opens.slice(0, 1),
    });

    expect(rows.plays.map((p) => [p.legacy_id, p.mode, p.imported])).toEqual([
      ["o1", "service", 1],
      ["o2", "rehearsal", 1],
      ["o3", "service", 1],
    ]);
    expect(report.notes).toMatchObject({
      opensInBothMerged: 1,
      opensWithoutSongSkipped: 1,
    });
    expect(report.counts.servicePlays).toBe(2);
  });
});
