import { describe, expect, test } from "vitest";
import { replaceSection, sectionSource } from "./song-edit.js";

const song = [
  "1:",
  "Verse one",
  "",
  "R:",
  ".G   C",
  "Refrain line",
  "",
  "2:",
  "Verse two",
  "",
  "R",
].join("\n");

describe("sectionSource", () => {
  test("returns the lines of one section, including its name and chords", () => {
    expect(sectionSource(song, 1)).toBe("R:\n.G   C\nRefrain line");
    expect(sectionSource(song, 9)).toBeNull();
  });
});

describe("replaceSection", () => {
  test("replaces only the edited section", () => {
    const result = replaceSection(
      song,
      1,
      "R:\n.G   C\nRefrain line",
      "R:\n.G   C\nRefrain, fixed",
    );

    expect(result).toEqual({
      text: song.replace("Refrain line", "Refrain, fixed"),
    });
  });

  test("finds the section when others were added before it meanwhile", () => {
    const changed = `Intro\n\n${song}`;

    expect(
      replaceSection(changed, 1, "R:\n.G   C\nRefrain line", "R:\nNew refrain"),
    ).toEqual({
      text: changed.replace("R:\n.G   C\nRefrain line", "R:\nNew refrain"),
    });
  });

  test("keeps someone else's change to another section", () => {
    const theirs = song.replace("Verse two", "Verse two, edited");

    expect(
      replaceSection(theirs, 0, "1:\nVerse one", "1:\nVerse one, edited"),
    ).toEqual({
      text: song
        .replace("Verse two", "Verse two, edited")
        .replace("Verse one", "Verse one, edited"),
    });
  });

  test("reports a conflict when the same section changed meanwhile", () => {
    const theirs = song.replace("Refrain line", "Their refrain");

    expect(
      replaceSection(theirs, 1, "R:\n.G   C\nRefrain line", "R:\nMy refrain"),
    ).toEqual({
      conflict: { theirs: "R:\n.G   C\nTheir refrain", mine: "R:\nMy refrain" },
    });
  });

  test("an empty replacement removes the section and one blank line", () => {
    expect(replaceSection(song, 2, "2:\nVerse two", "")).toEqual({
      text: [
        "1:",
        "Verse one",
        "",
        "R:",
        ".G   C",
        "Refrain line",
        "",
        "R",
      ].join("\n"),
    });
  });

  test("a replacement with blank lines becomes several sections", () => {
    const result = replaceSection(
      song,
      0,
      "1:\nVerse one",
      "1:\nVerse one\n\n1b:\nMore",
    );

    expect(
      "text" in result &&
        result.text.startsWith("1:\nVerse one\n\n1b:\nMore\n\nR:"),
    ).toBe(true);
  });
});
