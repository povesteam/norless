import { expect, test } from "vitest";
import {
  exportFileName,
  exportHtml,
  exportSong,
  exportText,
} from "./playlist-export";

const song = {
  versions: [
    {
      language: "ro",
      title: "Lumina lumii",
      text: "1:\nO stea se-aprinde\npeste sat\n\nR:\n.G\nCântăm cu toții\n\n2:\nE noapte\n\nR",
    },
    {
      language: "uk",
      title: "Світло світу",
      text: "1:\nЗоря\n\nR:\nСпіваємо\n\nR",
    },
  ],
};
const onlyRo = {
  versions: [{ language: "ro", title: "Doar harul Tău", text: "Doar harul" }],
};
const words = { contents: "Contents", top: "Top", theme: "Dark" };

test("a song in the chosen language, or the version it has", () => {
  expect(exportSong(song, ["uk", "ro"])?.title).toBe("Світло світу");
  expect(exportSong(onlyRo, ["uk", "ro"])).toEqual({
    title: "Doar harul Tău",
    text: "Doar harul",
  });
});

test("copy: songs numbered in order, chords left out, a repeated refrain as its name", () => {
  const ro = exportSong(song, ["ro"]);
  const other = exportSong(onlyRo, ["ro"]);
  if (!ro || !other) throw new Error("no version");
  expect(exportText([ro, other], "Duminică, 11 octombrie 2026")).toBe(
    `Duminică, 11 octombrie 2026


1. Lumina lumii

1:
O stea se-aprinde
peste sat

R:
Cântăm cu toții

2:
E noapte

R


2. Doar harul Tău

Doar harul
`,
  );
});

test("a refrain whose second time differs is written in full, with its name, everywhere", () => {
  const differs = { title: "T", text: "R:\nla la\n\n1:\nvers\n\nR:\nla la la" };
  expect(exportText([differs], "H")).toContain(
    "R:\nla la\n\n1:\nvers\n\nR:\nla la la",
  );
  const html = exportHtml([differs], { heading: "H", language: "ro", words });
  expect(html).toContain("<b>R:</b><br>la la</p>");
  expect(html).toContain("<b>R:</b><br>la la la</p>");
});

test("print and HTML write every repeat in full, with contents, links up, and repeat marks", () => {
  const ro = exportSong(song, ["ro"]);
  if (!ro) throw new Error("no version");
  const marked = { title: "Cu repetare", text: "1:\n/: Aleluia\nAmin :/" };
  const html = exportHtml([ro, marked], {
    heading: "Duminică <seară>",
    language: "ro",
    words,
  });
  expect(html.match(/Cântăm cu toții/g)).toHaveLength(2);
  expect(html).toContain('<li><a href="#song-1">Lumina lumii</a></li>');
  expect(html).toContain('<section id="song-2">');
  expect(html.match(/href="#top"/g)).toHaveLength(2);
  expect(html).toContain("Amin ×2");
  // Escaped, standalone, and the dark switch remembered.
  expect(html).toContain("<h1>Duminică &lt;seară&gt;</h1>");
  expect(html).not.toMatch(/(src|href)="(https?:)?\/\//);
  expect(html).toContain("localStorage");
  expect(html).toContain("@media print");
  // Chords stay out.
  expect(html).not.toMatch(/\bG\b/);
});

test("the file is named with the playlist's date and its title", () => {
  expect(
    exportFileName({ title: "Duminică seara: 1/2", date: "2026-09-30" }),
  ).toBe("2026-09-30-Duminică-seara-1-2.html");
  expect(exportFileName({ title: null, date: "2026-01-02" })).toBe(
    "2026-01-02-playlist.html",
  );
});
