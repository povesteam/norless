import { expect, test } from "vitest";
import { parseSong } from "../../shared/song-text";
import { transposeBlocks } from "./abc";

test("a key change moves notation blocks, not drum blocks", async () => {
  const text = [
    "I:",
    "```abc",
    "X:1",
    "L:1/8",
    "K:E",
    "E2 G2 B2 e2|",
    "```",
    "```abc",
    "X:1",
    "L:1/16",
    "K:C clef=perc",
    "F4 c4 F4 c4|",
    "```",
    "",
    "Unu",
  ].join("\n");
  const blocks = parseSong(await transposeBlocks(text, -2)).sections[0]?.blocks;
  expect(blocks?.[0]?.abc).toBe("X:1\nL:1/8\nK:D\nD2 F2 A2 d2|");
  expect(blocks?.[1]?.abc).toBe("X:1\nL:1/16\nK:C clef=perc\nF4 c4 F4 c4|");
});
