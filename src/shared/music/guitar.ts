/**
 * Norless's own table of guitar shapes: open chords and a few
 * barre chords, as frets from the low E string to the high one (x: not played). The
 * shape databases on npm are pre-1.0, so this stays small and ours.
 */
const SHAPES: Record<string, string> = {
  C: "x32010",
  C7: "x32310",
  Cmaj7: "x32000",
  Cadd9: "x32030",
  "C/E": "032010",
  "C/G": "332010",
  "C#m": "x46654",
  D: "xx0232",
  D7: "xx0212",
  Dm: "xx0231",
  Dm7: "xx0211",
  Dsus4: "xx0233",
  Dsus2: "xx0230",
  "D/F#": "200232",
  E: "022100",
  E7: "020100",
  Em: "022000",
  Em7: "022030",
  Esus4: "022200",
  F: "133211",
  Fmaj7: "xx3210",
  "F#m": "244222",
  "F#": "244322",
  G: "320003",
  G7: "320001",
  "G/B": "x20003",
  Gsus4: "330013",
  "G#m": "466444",
  A: "x02220",
  A7: "x02020",
  Am: "x02210",
  Am7: "x02010",
  Asus4: "x02230",
  Asus2: "x02200",
  "A/C#": "x42220",
  Bb: "x13331",
  B: "x24442",
  B7: "x21202",
  Bm: "x24432",
  Bm7: "x20202",
};

export type Fingering = {
  /** From the high string (1) to the low one (6): a fret, 0 for open, x for not played. */
  fingers: [number, number | "x"][];
  barre: { fret: number; from: number; to: number } | null;
  /** The first fret shown, 1 at the nut. */
  position: number;
};

/** How to play a chord shape, or null when the table has none. */
export function fingering(chord: string): Fingering | null {
  const frets = SHAPES[chord];
  if (!frets) return null;
  const strings = frets.split("").map((f) => (f === "x" ? "x" : Number(f)));
  const played = strings.filter((f): f is number => f !== "x" && f > 0);
  const lowest = Math.min(...played);
  const position = Math.max(...played) > 4 ? lowest : 1;
  const fingers = strings.map((f, i): [number, number | "x"] => [
    6 - i,
    f === "x" || f === 0 ? f : f - position + 1,
  ]);
  // A barre: the lowest fret held on several strings, from the lowest of them up.
  const atLowest = strings.flatMap((f, i) => (f === lowest ? [6 - i] : []));
  const from = Math.max(...atLowest);
  const barre =
    atLowest.length >= 2 &&
    strings.slice(6 - from).every((f) => f !== 0 && f !== "x")
      ? { fret: lowest - position + 1, from, to: Math.min(...atLowest) }
      : null;
  return { fingers, barre, position };
}
