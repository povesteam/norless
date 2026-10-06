import { describe, expect, it } from "vitest";
import { changedKeys, foldChanges, listOf, objectOf } from "./changed-keys";

describe("changedKeys", () => {
  it("lists only the keys that changed, added or went", () => {
    const from = objectOf('{"chords":true,"replays":true,"offline":true}');
    const to = objectOf('{"chords":true,"offline":false,"liveChord":true}');
    expect(changedKeys(from, to)).toEqual([
      ["replays", true, undefined],
      ["offline", true, false],
      ["liveChord", undefined, true],
    ]);
  });

  it("compares nested values by content", () => {
    expect(changedKeys({ font: { size: 3 } }, { font: { size: 3 } })).toEqual(
      [],
    );
  });

  it("reads only objects", () => {
    expect(objectOf('["a"]')).toBeNull();
    expect(objectOf("plain")).toBeNull();
    expect(objectOf("{broken")).toBeNull();
  });
});

describe("listOf", () => {
  it("names a list's items: a text's first line, an object's title", () => {
    expect(listOf('["# Welcome!\\nFind a seat", "Thursday"]')).toEqual([
      "Welcome!",
      "Thursday",
    ]);
    expect(
      listOf(
        '[{"url":"https://x.test","title":"Live"},{"url":"https://y.test"}]',
      ),
    ).toEqual(["Live", "https://y.test"]);
    expect(listOf('{"a":1}')).toBeNull();
  });
});

describe("foldChanges", () => {
  const change = (
    at: string,
    changed: Record<string, [unknown, unknown]>,
    user = "ana",
  ) => ({
    at: `2026-10-05T19:${at}Z`,
    user: { id: user },
    table: "communities",
    rowId: "c",
    action: "update",
    changed,
  });

  it("drops a switch turned on and off again within a minute", () => {
    expect(
      foldChanges([
        change("41:30", { switches: ['{"a":true}', "{}"] }),
        change("41:00", { switches: ["{}", '{"a":true}'] }),
      ]),
    ).toEqual([]);
  });

  it("joins one person's quick changes, and keeps others apart", () => {
    const folded = foldChanges([
      change("41:30", { title: ["B", "C"] }),
      change("41:00", { title: ["A", "B"], font: ["x", "y"] }),
      change("40:50", { title: ["Z", "A"] }, "ion"),
      change("30:00", { title: ["Y", "Z"], font: ["w", "x"] }),
    ]);
    expect(folded.map((c) => c.changed)).toEqual([
      { title: ["A", "C"], font: ["x", "y"] },
      { title: ["Z", "A"] },
      { title: ["Y", "Z"], font: ["w", "x"] },
    ]);
  });
});
