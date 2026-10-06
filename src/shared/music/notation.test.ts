import { describe, expect, test } from "vitest";
import { lyricsOf } from "./chords";
import { transposeText } from "./chord-sheet";
import {
  abcToGrid,
  gridToAbc,
  isDrumBlock,
  setBlock,
  toggleHit,
  type DrumGrid,
} from "./notation";
import { parseSong } from "../song-text";

const intro = [
  "I:",
  ".E  B",
  "```abc",
  "X:1",
  "K:E",
  ".E2 G2 B2 e2|",
  "",
  "R:",
  "```",
  "",
  "Prima strofă",
].join("\n");

describe("notation blocks in the song text", () => {
  test("a block belongs to its part, kept as written, blank rows and all", () => {
    const { sections, slides } = parseSong(intro);
    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      name: "I",
      start: 0,
      end: 8,
      blocks: [{ abc: "X:1\nK:E\n.E2 G2 B2 e2|\n\nR:", start: 2, end: 8 }],
    });
    // Its rows aren't chords, notes or a part's name.
    expect(sections[0]?.lines).toHaveLength(1);
    expect(sections[0]?.lines[0]?.chords.map((c) => c.name)).toEqual([
      "E",
      "B",
    ]);
    expect(slides[0]?.blocks).toHaveLength(1);
    expect(slides[1]?.lines.map((l) => l.text)).toEqual(["Prima strofă"]);
  });

  test("a block alone is a part of its own: before the words an intro", () => {
    const { slides } = parseSong("```abc\nX:1\nK:C\nC4|\n```\n\nUnu");
    expect(
      slides.map((s) => [s.type, s.lines.length, s.blocks.length]),
    ).toEqual([
      ["intro", 0, 1],
      ["verse", 1, 0],
    ]);
  });

  test("a block that isn't closed runs to the end", () => {
    const { sections } = parseSong("Unu\n```abc\nX:1\nK:C\nC4|");
    expect(sections[0]?.blocks[0]).toMatchObject({ abc: "X:1\nK:C\nC4|" });
  });

  test("lyrics leave blocks out, so the team may add them", () => {
    expect(lyricsOf(intro)).toBe("I:\n\nPrima strofă");
  });

  test("transposing moves the chords, not the block's rows", () => {
    const moved = transposeText(intro, -2, { tonic: "D", minor: false });
    expect(moved).toContain(".D  A");
    expect(moved).toContain(".E2 G2 B2 e2|");
  });

  test("a block is added after its part's last row, changed and removed", () => {
    const text = "I:\n.C G\n\nUnu";
    const added = setBlock(text, 0, null, "X:1\n\nK:C\n```\nC4|  ");
    expect(added).toBe("I:\n.C G\n```abc\nX:1\nK:C\nC4|\n```\n\nUnu");
    const changed = setBlock(added, 0, 0, "X:1\nK:C\nD4|");
    expect(parseSong(changed).sections[0]?.blocks[0]?.abc).toBe(
      "X:1\nK:C\nD4|",
    );
    expect(setBlock(changed, 0, 0, null)).toBe(text);
  });

  test("a drum block has a percussion clef", () => {
    expect(isDrumBlock("X:1\nK:C clef=perc\nF4|")).toBe(true);
    expect(isDrumBlock("X:1\nK:E\nE4|")).toBe(false);
  });
});

describe("drum grid", () => {
  // Hi-hat on every eighth, snare on 2 and 4, kick on 1 and 3.
  const rock: DrumGrid = {
    meter: "4/4",
    bars: 1,
    hits: {
      hihat: [0, 2, 4, 6, 8, 10, 12, 14],
      snare: [4, 12],
      kick: [0, 8],
    },
  };

  test("the groove is written on a drum staff, beamed by beat", () => {
    const abc = gridToAbc(rock);
    expect(abc).toContain("K:C clef=perc");
    expect(abc).toContain("%%percmap g closed-hi-hat x");
    expect(abc.split("\n").at(-1)).toBe("[gF]2g2 [gc]2g2 [gF]2g2 [gc]2g2 |]");
  });

  test("rests fill a beat's start and empty beats", () => {
    const abc = gridToAbc({ meter: "3/4", bars: 1, hits: { snare: [5, 7] } });
    expect(abc.split("\n").at(-1)).toBe("z4 zc2c z4 |]");
  });

  test("a block the grid wrote opens in the grid again", () => {
    const grid: DrumGrid = {
      meter: "3/4",
      bars: 2,
      hits: { crash: [0], kick: [0, 3, 13], snare: [6, 18], floorTom: [23] },
    };
    expect(abcToGrid(gridToAbc(grid))).toEqual(grid);
    expect(abcToGrid(gridToAbc(rock))).toEqual(rock);
  });

  test("a hand-written block that isn't a grid opens as text", () => {
    expect(abcToGrid("X:1\nM:4/4\nL:1/8\nK:C clef=perc\nF2 c2 F2 c2|")).toBe(
      null,
    );
    expect(abcToGrid("X:1\nM:4/4\nL:1/16\nK:E\nE16|")).toBe(null);
    // A triplet isn't on the grid's steps.
    expect(abcToGrid(gridToAbc(rock).replace("[gF]2g2", "(3ggg g2"))).toBe(
      null,
    );
  });

  test("a tap adds a hit, a second one takes it away", () => {
    const once = toggleHit(rock, "snare", 14);
    expect(once.hits.snare).toEqual([4, 12, 14]);
    expect(toggleHit(once, "snare", 14).hits.snare).toEqual([4, 12]);
  });
});
