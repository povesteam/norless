import { describe, expect, test } from "vitest";
import {
  parseSong,
  partBars,
  partLabels,
  sectionType,
  sungLines,
} from "./song-text.js";

const texts = (song: string) =>
  parseSong(song).slides.map((s) => s.lines.map((l) => l.text).join(" / "));

describe("slides", () => {
  test("blank lines separate sections, lines are trimmed", () => {
    expect(texts("  Line one\nLine two  \n\n\n\nLine three")).toEqual([
      "Line one / Line two",
      "Line three",
    ]);
  });

  test("Windows line endings work", () => {
    expect(texts("One\r\n\r\nTwo\r\n")).toEqual(["One", "Two"]);
  });

  test("each section keeps its line range in the source", () => {
    const { sections } = parseSong("1:\nFirst\nverse\n\nR:\nRefrain\n");

    expect(sections.map((s) => [s.name, s.start, s.end])).toEqual([
      ["1", 0, 2],
      ["R", 4, 5],
    ]);
  });
});

describe("named sections and repeats", () => {
  test("a section with only a name repeats the named section", () => {
    const { sections, slides } = parseSong(
      "1:\nVerse one\n\nR:\nRefrain line\n\n2:\nVerse two\n\nR",
    );

    expect(slides.map((s) => [s.name, s.lines[0]?.text])).toEqual([
      ["1", "Verse one"],
      ["R", "Refrain line"],
      ["2", "Verse two"],
      ["R", "Refrain line"],
    ]);
    expect(sections[3]?.repeatOf).toBe(1);
    expect(slides[3]?.section).toBe(1);
  });

  test("the name line can be anywhere in the section, and is never shown", () => {
    expect(parseSong("Refrain line\nR:").slides[0]).toMatchObject({
      name: "R",
      lines: [{ text: "Refrain line" }],
    });
  });

  test("a repeat may come before the definition; the last definition wins", () => {
    expect(texts("R\n\nR:\nFirst\n\nR:\nSecond")).toEqual([
      "Second",
      "First",
      "Second",
    ]);
  });

  test("names are case-sensitive when repeated", () => {
    expect(texts("R:\nRefrain\n\nr")).toEqual(["Refrain", "r"]);
  });

  test("a name without lines carries over to the next section", () => {
    expect(parseSong("R:\n\nRefrain").slides[0]?.name).toBe("R");
  });

  test("names like R2: are section names now, not text", () => {
    expect(parseSong("R2:\nSecond refrain").slides[0]).toMatchObject({
      name: "R2",
      type: "refrain",
    });
  });

  test("bracket names work in any language", () => {
    expect(parseSong("[приспів]\nСлава").slides[0]).toMatchObject({
      name: "приспів",
      type: "refrain",
    });
  });
});

describe("section types", () => {
  test.each([
    [null, "verse"],
    ["1", "verse"],
    ["12", "verse"],
    ["V2", "verse"],
    ["S", "verse"],
    ["strofa", "verse"],
    ["R", "refrain"],
    ["r2", "refrain"],
    ["C", "refrain"],
    ["refren", "refrain"],
    ["Chorus-2", "refrain"],
    ["B", "bridge"],
    ["punte", "bridge"],
    ["P", "pre-chorus"],
    ["pre-refren", "pre-chorus"],
    ["I", "intro"],
    ["E", "ending"],
    ["final", "ending"],
    ["Z", "other"],
    ["+", "other"],
  ] as const)("%s is %s", (name, type) => {
    expect(sectionType(name)).toBe(type);
  });
});

describe("chords", () => {
  test("a chord goes before the lyric character in its column (the dot is column 0)", () => {
    const line = parseSong(".G      C\nAmazing grace how sweet").slides[0]
      ?.lines[0];

    expect(line).toEqual({
      text: "Amazing grace how sweet",
      chords: [
        { name: "G", at: 1 },
        { name: "C", at: 8 },
      ],
      row: 1,
    });
  });

  test("leading spaces of the lyric line shift the chords left", () => {
    expect(parseSong(".G\n Amazing").slides[0]?.lines[0]?.chords).toEqual([
      { name: "G", at: 0 },
    ]);
  });

  test("a chord before the start of the line is dropped", () => {
    expect(parseSong(".G\n   Hi").slides[0]?.lines[0]?.chords).toEqual([]);
  });

  test("chords past the end are kept, padding the line with ~", () => {
    expect(parseSong(".C       G\nHi").slides[0]?.lines[0]).toEqual({
      text: "Hi~~~~~~",
      chords: [
        { name: "C", at: 1 },
        { name: "G", at: 8 },
      ],
      row: 1,
    });
  });

  test("chords apply to the next lyric line only", () => {
    const lines = parseSong(".Am\nFirst\nSecond").slides[0]?.lines;

    expect(lines?.map((l) => l.chords.length)).toEqual([1, 0]);
  });

  test("a lyric line starting with .. is lyrics, not chords", () => {
    expect(texts("...and so we sing")).toEqual(["...and so we sing"]);
  });

  test("removing _ shifts the chords after it", () => {
    expect(parseSong(".  G\nab_cd").slides[0]?.lines[0]).toEqual({
      text: "abcd",
      chords: [{ name: "G", at: 2 }],
      row: 1,
    });
  });
});

describe("layout characters", () => {
  test("a lone . is an empty line inside a section, but not at its edges", () => {
    expect(
      parseSong(".\nFirst\n.\nSecond\n.").slides[0]?.lines.map((l) => l.text),
    ).toEqual(["First", "", "Second"]);
  });

  test("~ stays as an invisible space, _ is removed, repeated spaces collapse", () => {
    expect(texts("A~~b  c_d")).toEqual(["A~~b cd"]);
  });
});

describe("notes for singers and musicians", () => {
  test("lines starting with ! are notes of their section, not lyrics", () => {
    expect(
      parseSong("R:\n! unison, women\nRefrain line").slides[0],
    ).toMatchObject({
      lines: [{ text: "Refrain line" }],
      notes: [{ text: "unison, women", group: null }],
    });
  });

  test("a block of notes only belongs to the section before it", () => {
    const { slides } = parseSong(
      "Verse\n\n! guitar solo, 4 bars\n\nNext verse",
    );

    expect(slides.map((s) => s.notes.map((n) => n.text))).toEqual([
      ["guitar solo, 4 bars"],
      [],
    ]);
  });

  test("repeats carry the notes of the repeated section", () => {
    expect(parseSong("R:\n! all\nRefrain\n\nR").slides[1]?.notes).toEqual([
      { text: "all", group: null },
    ]);
  });

  test("a note starting with a word and a colon is for that group, with its prefix kept", () => {
    expect(parseSong("! drums: rim and hats\nVerse").slides[0]?.notes).toEqual([
      { text: "drums: rim and hats", group: "drums" },
    ]);
    expect(parseSong("! клавіші: пед\nVerse").slides[0]?.notes[0]?.group).toBe(
      "клавіші",
    );
    expect(
      parseSong("! guitar solo: 4 bars\nVerse").slides[0]?.notes[0]?.group,
    ).toBeNull();
  });
});

describe("repeat marks", () => {
  const slide = (text: string) => parseSong(text).slides[0];

  test("lines between /: and :/ are sung twice, shown once without the marks", () => {
    expect(slide("/:Tu mă ridici\nși eu pot sta:/")).toMatchObject({
      lines: [{ text: "Tu mă ridici" }, { text: "și eu pot sta" }],
      repeats: [{ from: 0, to: 1, times: 2 }],
      unclosedRepeat: false,
    });
  });

  test("/:. and .:/ mean three times, and marks may have spaces", () => {
    expect(slide("/:. Duh Sfânt dă-mi credință .:/")).toMatchObject({
      lines: [{ text: "Duh Sfânt dă-mi credință" }],
      repeats: [{ from: 0, to: 0, times: 3 }],
    });
  });

  test("after /: a .:/ keeps the sentence's dot", () => {
    expect(slide("Prima\n/:O leagă-ne în dragoste.:/")).toMatchObject({
      lines: [{ text: "Prima" }, { text: "O leagă-ne în dragoste." }],
      repeats: [{ from: 1, to: 1, times: 2 }],
    });
  });

  test("a mark that doesn't close in the slide stays as written, flagged", () => {
    const { slides } = parseSong("/:Început\nmijloc\n\nsfârșit:/");
    expect(slides[0]).toMatchObject({
      lines: [{ text: "/:Început" }, { text: "mijloc" }],
      repeats: [],
      unclosedRepeat: true,
    });
    expect(slides[1]).toMatchObject({
      lines: [{ text: "sfârșit:/" }],
      unclosedRepeat: true,
    });
  });

  test("marks inside a line and other spellings stay as written", () => {
    expect(
      slide("Eu nu mă tem /:de nici un rău:/,\n//: Наполни ://"),
    ).toMatchObject({
      lines: [
        { text: "Eu nu mă tem /:de nici un rău:/," },
        { text: "//: Наполни ://" },
      ],
      repeats: [],
      unclosedRepeat: false,
    });
  });

  test("the final mark after a closing mark still ends the song", () => {
    expect(slide("/:Vezi, Hristos S-a născut!:/*")).toMatchObject({
      lines: [{ text: "Vezi, Hristos S-a născut!" }],
      repeats: [{ from: 0, to: 0, times: 2 }],
      last: true,
    });
  });

  test("chords after a removed mark move with the text", () => {
    expect(slide(".G   C\n/:Tu mă ridici:/")?.lines[0]).toEqual({
      text: "Tu mă ridici",
      chords: [
        { name: "G", at: 0 }, // was over the ":" of the mark
        { name: "C", at: 3 }, // still over the "m"
      ],
      row: 1,
    });
  });

  test("sung lines repeat each range, e.g. for the sung length", () => {
    const section = parseSong("Unu\n/:Doi\nTrei:/\nPatru").sections[0];
    expect(section && sungLines(section).map((l) => l.text)).toEqual([
      "Unu",
      "Doi",
      "Trei",
      "Doi",
      "Trei",
      "Patru",
    ]);
  });
});

describe("bar lines and chords without lyrics", () => {
  test("an intro in bars is a line of chords only, grouped per bar", () => {
    expect(parseSong("I:\n. | E | B/D# | C#m | A |").slides[0]?.lines).toEqual([
      {
        text: "~~~~~~~~~~~~~~~~~~~~",
        chords: [
          { name: "E", at: 3 },
          { name: "B/D#", at: 7 },
          { name: "C#m", at: 14 },
          { name: "A", at: 20 },
        ],
        bars: [["E"], ["B/D#"], ["C#m"], ["A"]],
        chordsOnly: true,
        row: 1,
      },
    ]);
  });

  test("two chords share a bar, and a bar line counts as a space over lyrics", () => {
    const [line] =
      parseSong(". | A  B | E |\nAleluia, aleluia").slides[0]?.lines ?? [];
    expect(line?.bars).toEqual([["A", "B"], ["E"]]);
    expect(line?.chords.map((c) => c.name)).toEqual(["A", "B", "E"]);
    expect(line?.chordsOnly).toBeUndefined();
  });

  test("a chord line followed by another one keeps both", () => {
    const lines = parseSong(".A\n.B\nText").slides[0]?.lines;
    expect(
      lines?.map((l) => [l.chordsOnly ?? false, l.chords[0]?.name]),
    ).toEqual([
      [true, "A"],
      [false, "B"],
    ]);
  });
});

describe("final mark", () => {
  test("only the last slide is marked, and trailing * are removed", () => {
    const { slides } = parseSong("First\n\nLast line **  ");

    expect(slides.map((s) => s.last)).toEqual([false, true]);
    expect(slides[1]?.lines[0]?.text).toBe("Last line");
  });

  test("a repeated section as the last slide doesn't mark the other copies", () => {
    const { slides } = parseSong("R:\nRefrain\n\nVerse\n\nR");

    expect(slides.map((s) => s.last)).toEqual([false, false, true]);
  });

  test("empty text has no slides", () => {
    expect(parseSong("  \n\n").slides).toEqual([]);
  });
});

describe("part labels", () => {
  const labels = (text: string) => partLabels(parseSong(text).slides);

  test("unnamed slides are numbered among the verses, named parts keep their name", () => {
    expect(labels("Unu\n\nDoi\n\nTrei\n\nPatru")).toEqual(["1", "2", "3", "4"]);
    expect(labels("Unu\n\nR:\nRefren\n\nDoi\n\nR\n\nTrei\n\nR")).toEqual([
      "1",
      "R",
      "2",
      "R",
      "3",
      "R",
    ]);
    expect(labels("I:\nIntro\n\n1:\nUnu\n\nAl doilea\n\nB:\nPunte")).toEqual([
      "I",
      "1",
      "2",
      "B",
    ]);
  });
});

test("the bar grid has a box per bar, or per chord without bar lines", () => {
  const [intro, verse] = parseSong(
    "I:\n. | E | B/D# | C#m | A |\n\n.A  B   E\nCuvinte aici",
  ).slides;
  expect(intro && partBars(intro)).toEqual([["E"], ["B/D#"], ["C#m"], ["A"]]);
  expect(verse && partBars(verse)).toEqual([["A"], ["B"], ["E"]]);
});

test("an unnamed part of chords only is the intro, an instrumental part or the ending, not a verse", () => {
  const { slides } = parseSong(
    [
      ". Intro: F  C",
      "",
      ".G",
      "Primul vers",
      "",
      ". Am  F",
      "",
      ".C",
      "Al doilea",
      "",
      ". F  C",
    ].join("\n"),
  );
  expect(slides.map((s) => s.type)).toEqual([
    "intro",
    "verse",
    "other",
    "verse",
    "ending",
  ]);
  expect(partLabels(slides)).toEqual(["I", "1", "♪", "2", "E"]);
});

test("the bar grid leaves out words in chord lines that aren't chords", () => {
  const { slides } = parseSong(
    ["1:", ". Intro: A E C#m sau G. d c# Re la7 fa-mi", "Cuvinte"].join("\n"),
  );
  expect(slides[0] && partBars(slides[0])).toEqual([
    ["A"],
    ["E"],
    ["C#m"],
    ["G"],
    ["d"],
    ["c#"],
    ["Re"],
    ["la7"],
  ]);
});
