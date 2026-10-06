import { expect, test } from "vitest";
import {
  type Feature,
  features,
  isNew,
  newlyOn,
  pathTo,
  shows,
  type Switches,
  switchesOn,
} from "./features.js";

test("only Classic's features are on until an owner switches others on", () => {
  const classic = switchesOn({});
  expect([...classic]).toEqual(["feedback", "deviceLogin", "export"]);
  expect(shows(classic, "layouts")).toBe(false);
  // Classic's can't be switched off.
  expect(shows(switchesOn({ export: false }), "export")).toBe(true);
  // A switch stored as anything but true is off.
  expect(
    shows(switchesOn({ appFrame: "step" } as unknown as Switches), "appFrame"),
  ).toBe(false);
});

test("a feature switched on shows; switched off, it doesn't, and what needs it neither", () => {
  const set = { appFrame: true, stageViews: true, chords: true } as const;
  expect(shows(switchesOn(set), "chords")).toBe(true);
  expect(shows(switchesOn({ ...set, history: true }), "history")).toBe(true);
  expect(shows(switchesOn({ ...set, history: false }), "history")).toBe(false);
  // The stage views need the app's frame.
  expect(shows(switchesOn({ ...set, appFrame: false }), "stageViews")).toBe(
    false,
  );
});

test("a feature is off while what it needs is off, and switching it on unlocks the path", () => {
  expect(shows(switchesOn({ practiceRooms: true }), "practiceRooms")).toBe(
    false,
  );
  expect(pathTo({ practiceRooms: true }, "practiceRooms")).toEqual([
    "appFrame",
    "layouts",
  ]);
  // Instruments need the stage views, which need the app's frame.
  expect(pathTo({ stageViews: true }, "instruments")).toEqual(["appFrame"]);
  expect(pathTo({ appFrame: true, stageViews: true }, "instruments")).toEqual(
    [],
  );
});

test("a feature added later is marked new until an owner switches it", () => {
  const defs = features as Record<string, unknown>;
  defs.later = { added: "2026-10-05" };
  try {
    const name = "later" as Feature;
    expect(switchesOn({}).has(name)).toBe(false);
    expect(isNew({}, name)).toBe(true);
    expect(switchesOn({ [name]: true }).has(name)).toBe(true);
    expect(isNew({ [name]: true }, name)).toBe(false);
    expect(isNew({ [name]: false }, name)).toBe(false);
  } finally {
    delete defs.later;
  }
});

test("what's new lists each feature switched on since, Classic's never", () => {
  const seen = new Set(switchesOn({}));
  expect(newlyOn(seen, switchesOn({ appFrame: true, layouts: true }))).toEqual([
    "appFrame",
    "layouts",
  ]);
  // Switched off, or seen before: nothing.
  expect(newlyOn(new Set(["host"]), switchesOn({}))).toEqual([]);
  expect(
    newlyOn(new Set(["appFrame", "host"]), switchesOn({ appFrame: true })),
  ).toEqual([]);
});
