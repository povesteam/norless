import { isDrumBlock, setBlock } from "../../shared/music/notation";
import { parseSong } from "../../shared/song-text";

type Abc = typeof import("abcjs");

/** abcjs, loaded only where notation is shown or moved. It's CommonJS. */
export const loadAbc = () =>
  import("abcjs").then((m) => ("default" in m ? (m.default as Abc) : m));

/** The text with its notation blocks moved by half steps; drum blocks stay. */
export async function transposeBlocks(
  text: string,
  semitones: number,
): Promise<string> {
  const moving = parseSong(text).sections.flatMap((section, s) =>
    section.blocks.flatMap((block, b) =>
      isDrumBlock(block.abc) ? [] : [{ s, b, abc: block.abc }],
    ),
  );
  if (semitones % 12 === 0 || moving.length === 0) return text;
  const abcjs = await loadAbc();
  return moving.reduce(
    (moved, { s, b, abc }) =>
      setBlock(
        moved,
        s,
        b,
        abcjs.strTranspose(abc, abcjs.parseOnly(abc), semitones),
      ),
    text,
  );
}
