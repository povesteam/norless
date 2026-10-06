import { expect, test } from "vitest";
import {
  fit,
  lyricSections,
  mapChords,
  mergeText,
  musicFromText,
  musicOfTexts,
  noMusic,
  splitText,
} from "./chord-track.js";
import { parseSong } from "../song-text.js";

const song = `1:
.G        C
 Amazing grace how sweet
.D        G
 That saved a wretch like me

R:
.C     G
 Sing hallelujah

2:
'Twas grace that taught my heart
And grace my fears relieved

R`;

/** Each line's chords and their places, per section, as the views see them. */
const chords = (text: string) =>
  parseSong(text).sections.map((s) =>
    s.lines.map((l) => l.chords.map((c) => `${c.name}@${c.at}`).join(" ")),
  );

test("a text takes apart into lyrics and a track, and comes back the same", () => {
  const { lyrics } = splitText(song);
  expect(lyrics).not.toContain(".G");
  expect(lyrics.split("\n")[1]).toBe("Amazing grace how sweet");
  const music = musicOfTexts([song]);
  const merged = mergeText(lyrics, music);
  // Verse 1 and the refrain keep their chords where they were.
  expect(chords(merged)[0]).toEqual(chords(song)[0]);
  expect(chords(merged)[1]).toEqual(chords(song)[1]);
});

test("a verse without chords shows the verses' chords, spread along its lines", () => {
  const music = musicOfTexts([song]);
  const merged = mergeText(splitText(song).lyrics, music);
  const verse2 = parseSong(merged).sections[2];
  expect(verse2?.lines.map((l) => l.chords.map((c) => c.name))).toEqual([
    ["G", "C"],
    ["D", "G"],
  ]);
  // Over the same place along the line: C a little before the middle.
  const c = verse2?.lines[0]?.chords[1]?.at ?? 0;
  expect(c).toBeGreaterThan(8);
  expect(c).toBeLessThan(14);
});

test("one track serves every language: the translation gets the chords by section", () => {
  const ro = song;
  const uk = `1:
Дивна благодать, як солодко
Що врятувала мене

R:
Алілуя співай`;
  const music = musicOfTexts([ro, uk]);
  const merged = mergeText(uk, music);
  expect(chords(merged)[0]?.map((l) => l.replace(/@\d+/g, ""))).toEqual([
    "G C",
    "D G",
  ]);
  expect(chords(merged)[1]?.[0]).toMatch(/^C@\d+ G@\d+$/);
});

test("an edit to a verse changes every verse, or with 'only' that verse", () => {
  const { lyrics } = splitText(song);
  const music = musicOfTexts([song]);
  const merged = mergeText(lyrics, music);
  // Verse 2's first chord becomes Em.
  const edited = merged.replace(/(2:\n\.)G/, "$1Em");
  const all = musicFromText(music, lyrics, edited);
  expect(chords(mergeText(lyrics, all))[0]?.[0]).toMatch(/^Em@\d+ C@\d+$/);
  const only = musicFromText(music, lyrics, edited, (key) => key === "verse.2");
  expect(chords(mergeText(lyrics, only))[0]?.[0]).toMatch(/^G@\d+ C@\d+$/);
  expect(chords(mergeText(lyrics, only))[2]?.[0]).toMatch(/^Em@\d+ C@\d+$/);
  expect(only.sections["verse.2"]?.follows).toBe(false);
});

test("words changed later keep their chords along the line", () => {
  const music = musicOfTexts([song]);
  const lyrics = splitText(song).lyrics.replace("Amazing", "Amazing, amazing");
  const line = parseSong(mergeText(lyrics, music)).sections[0]?.lines[0];
  expect(line?.chords.map((c) => c.name)).toEqual(["G", "C"]);
  expect(line?.chords[1]?.at).toBeGreaterThan(9);
});

test("an unnamed part with more lines than the verses still takes their chords", () => {
  // Like "E puterea crucii Lui": a numbered verse with chords, then an unnamed one of
  // three lines (unnamed parts are mostly verses).
  const text = `1:
.G        C
 Amazing grace how sweet
.D        G
 That saved a wretch like me

Was blind but now I see
I once was lost
But now am found`;
  const music = musicOfTexts([text]);
  const merged = mergeText(splitText(text).lyrics, music);
  const unnamed = parseSong(merged).sections[1];
  expect(unnamed?.lines.flatMap((l) => l.chords.map((c) => c.name))).toEqual([
    "G",
    "C",
    "D",
    "G",
  ]);
});

test("a section with another line count gets the chords spread over it", () => {
  const rows = fit(
    {
      lines: 4,
      rows: [0, 1, 2, 3].map((line) => ({
        line,
        chords: [{ at: 0, name: `C${line}` }],
        bars: [],
        over: 10,
      })),
    },
    [10, 10],
  );
  expect(
    rows.map((r) => ("line" in r ? [r.line, r.chords.map((c) => c.name)] : [])),
  ).toEqual([
    [0, ["C0", "C1"]],
    [1, ["C2", "C3"]],
  ]);
});

test("notes, notation blocks and parts without words stay where they were", () => {
  const text = `I:
.| G | C |

1:
! unison
.G
 Amazing grace
\`\`\`abc
X:1
K:G
GABc|
\`\`\`
how sweet the sound

! band: build up`;
  const { lyrics, parts } = splitText(text);
  expect(lyrics).toBe("1:\nAmazing grace\nhow sweet the sound");
  // A block of notes alone belongs to the section before it, as the parser has it.
  expect(parts).toEqual([
    { after: null, text: "I:\n.| G | C |" },
    { after: "verse.1", text: "! band: build up" },
  ]);
  const merged = mergeText(lyrics, musicOfTexts([text]));
  const { sections } = parseSong(merged);
  expect(sections[0]?.lines[0]?.chordsOnly).toBe(true);
  expect(sections[1]?.notes.map((n) => n.text)).toEqual([
    "unison",
    "band: build up",
  ]);
  expect(sections[1]?.blocks[0]?.abc).toContain("GABc|");
  expect(sections[1]?.lines[0]?.chords[0]?.name).toBe("G");
});

test("sections are known by their type and their place among them", () => {
  expect(lyricSections(splitText(song).lyrics).map((s) => s.key)).toEqual([
    "verse.1",
    "refrain.1",
    "verse.2",
  ]);
});

test("a key change renames every chord in the track", () => {
  const music = mapChords(
    musicOfTexts([song]),
    (name) => (name === "G" ? "A" : name),
    (row) => row,
  );
  expect(chords(mergeText(splitText(song).lyrics, music))[0]?.[0]).toMatch(
    /^A@\d+ C@\d+$/,
  );
  expect(noMusic().patterns).toEqual({});
});
