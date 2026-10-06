import { describe, expect, test } from "vitest";
import {
  overlayRows,
  slideScale,
  titleFor,
  chordChunks,
  formatLines,
  lettersOnly,
  plainLyrics,
  stripFormatting,
  typography,
} from "./song-render.js";

describe("typography", () => {
  test("comma-below letters and non-breaking hyphens on screens", () => {
    expect(typography("Ţară, noi ne-am rugat şi ştim")).toBe(
      "Țară, noi ne‑am rugat și știm",
    );
  });

  test("ordinary hyphens for print and copy", () => {
    expect(lettersOnly("ne-am rugat şi")).toBe("ne-am rugat și");
  });
});

describe("formatLines", () => {
  const plain = { italic: false, bold: false, underline: false, color: null };

  test("plain text is one segment", () => {
    expect(formatLines(["Isus e Domn"])).toEqual([
      [{ text: "Isus e Domn", ...plain }],
    ]);
  });

  test("colored character names in skits", () => {
    expect(
      formatLines(["<span style='color: yellow'>Eli:</span> Serios?"]),
    ).toEqual([
      [
        { text: "Eli:", ...plain, color: "yellow" },
        { text: " Serios?", ...plain },
      ],
    ]);
  });

  test("italic carries across lines until it's closed", () => {
    expect(
      formatLines(["<i>Nimeni ca Tine", "nimeni</i> altul"]).map((l) =>
        l.map((s) => [s.text, s.italic]),
      ),
    ).toEqual([
      [["Nimeni ca Tine", true]],
      [
        ["nimeni", true],
        [" altul", false],
      ],
    ]);
  });

  test("bold, underline and hex colors", () => {
    expect(
      formatLines(['<b><u>A</u></b><span style="color:#ff0">B</span>'])[0],
    ).toEqual([
      { text: "A", ...plain, bold: true, underline: true },
      { text: "B", ...plain, color: "#ff0" },
    ]);
  });

  test.each([
    "<script>alert(1)</script>",
    '<img src=x onerror="alert(1)">',
    '<span style="color: red; background: url(x)">x</span>',
    '<span onclick="alert(1)">x</span>',
    "<a href='javascript:alert(1)'>x</a>",
  ])("other markup stays literal text: %s", (line) => {
    const segments = formatLines([line])[0] ?? [];

    expect(segments.map((s) => s.text).join("")).toContain("<");
    expect(
      segments.every((s) => s.color === null || /^[a-z]+$/.test(s.color)),
    ).toBe(true);
  });

  test("a </span> with nothing to close is text", () => {
    expect(stripFormatting("a</span>b")).toBe("a</span>b");
  });
});

describe("plainLyrics", () => {
  test("removes formatting and padding, keeps ordinary hyphens", () => {
    expect(
      plainLyrics([{ text: "<i>Hi</i>~~~" }, { text: "ne-am rugat şi" }]),
    ).toBe("Hi\nne-am rugat și");
  });
});

describe("chordChunks", () => {
  test("splits the line where each chord starts", () => {
    expect(
      chordChunks({
        text: "Amazing grace",
        chords: [
          { at: 1, name: "G" },
          { at: 8, name: "C" },
        ],
      }),
    ).toEqual([
      { chord: null, text: "A" },
      { chord: "G", text: "mazing " },
      { chord: "C", text: "grace" },
    ]);
  });

  test("a line without chords is one chunk, and chords can share a position", () => {
    expect(chordChunks({ text: "Slavă", chords: [] })).toEqual([
      { chord: null, text: "Slavă" },
    ]);
    expect(
      chordChunks({
        text: "Hi",
        chords: [
          { at: 2, name: "G" },
          { at: 2, name: "D" },
        ],
      }),
    ).toEqual([
      { chord: null, text: "Hi" },
      { chord: "G", text: "" },
      { chord: "D", text: "" },
    ]);
  });
});

test("a title in the viewer's language, then the community's, then any", () => {
  const titles = { ro: "Har minunat", uk: "Дивна благодать" };
  expect(titleFor(titles, ["uk", "ro"])).toBe("Дивна благодать");
  expect(titleFor(titles, ["en", "ro", "uk"])).toBe("Har minunat");
  expect(titleFor({ en: "Amazing grace" }, ["ro"])).toBe("Amazing grace");
  expect(titleFor({ ro: "Slavă ţie" }, ["ro"])).toBe("Slavă ție");
  expect(titleFor({}, ["ro"])).toBe("");
});

test("an overlay shows at most two rows, joining longer slides in pairs", () => {
  expect(overlayRows(["Unu"])).toEqual(["Unu"]);
  expect(overlayRows(["Unu", "Doi"])).toEqual(["Unu", "Doi"]);
  expect(overlayRows(["Unu", "Doi", "Trei"])).toEqual(["Unu / Doi", "Trei"]);
  expect(overlayRows(["1", "2", "3", "4"])).toEqual(["1 / 2", "3 / 4"]);
  expect(overlayRows(["1", "2", "3", "4", "5"])).toEqual([
    "1 / 2 / 3",
    "4 / 5",
  ]);
});

test("a slide is too small when it shrinks below 70% of a four-line one", () => {
  const line = "Aaaa bbbb cccc dddd eeee ffff gg";
  expect(slideScale([line, line, line, line])).toBeCloseTo(1);
  expect(slideScale(Array(11).fill(line))).toBeLessThan(0.7);
  expect(slideScale(["Mmmm wwww ".repeat(5)])).toBeLessThan(0.7);
  expect(slideScale(["<i>scurt</i>", "rând"])).toBeGreaterThan(1);
  // Narrow letters and spaces take less room: a long line of them still reads.
  expect(
    slideScale(["Și ți-l iau, și-l ții, și-l lași, și-l știi iar"]),
  ).toBeGreaterThan(0.7);
});
