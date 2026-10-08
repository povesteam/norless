import { describe, expect, it } from "vitest";
import { parentOf } from "./BackButton";

describe("parentOf", () => {
  it("leads a song's editor and chords to the song, and a song home", () => {
    expect(parentOf("/songs/abc/edit")).toBe("/songs/abc");
    expect(parentOf("/songs/abc/chords")).toBe("/songs/abc");
    expect(parentOf("/songs/abc")).toBe("/");
    expect(parentOf("/songs/new")).toBe("/");
  });
  it("leads a recording and a settings section to their lists", () => {
    expect(parentOf("/recordings/r1")).toBe("/recordings");
    expect(parentOf("/settings/schedule")).toBe("/settings");
  });
  it("keeps the menu on the pages at the top", () => {
    for (const top of [
      "/",
      "/playlists",
      "/playlists/p1",
      "/settings",
      "/statistics",
    ])
      expect(parentOf(top)).toBeNull();
  });
});
