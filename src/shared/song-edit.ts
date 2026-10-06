import { parseSong } from "./song-text.js";

/** The source text of a section: its lines, from its first to its last line. */
export function sectionSource(text: string, index: number): string | null {
  const section = parseSong(text).sections[index];
  if (!section) return null;
  return normalize(text)
    .split("\n")
    .slice(section.start, section.end + 1)
    .join("\n");
}

export type SectionEdit =
  { text: string } | { conflict: { theirs: string | null; mine: string } };

/**
 * Replaces one section of a song text. `base` is the section's source when editing
 * started. If the section still has that source at `index`, or at exactly one other
 * place because sections were added or removed before it, it's replaced. Otherwise
 * someone else changed it meanwhile, and both versions come back as a conflict.
 * An empty `replacement` removes the section.
 */
export function replaceSection(
  text: string,
  index: number,
  base: string,
  replacement: string,
): SectionEdit {
  const rows = normalize(text).split("\n");
  const { sections } = parseSong(rows.join("\n"));
  const source = (i: number) => {
    const s = sections[i];
    return s ? rows.slice(s.start, s.end + 1).join("\n") : null;
  };
  const wanted = normalize(base);
  const matches = sections.map((_, i) => i).filter((i) => source(i) === wanted);
  const target =
    source(index) === wanted
      ? index
      : matches.length === 1
        ? matches[0]
        : undefined;
  const section = target === undefined ? undefined : sections[target];
  if (!section)
    return { conflict: { theirs: source(index), mine: replacement } };

  const next = normalize(replacement).replace(/^\n+|\n+$/g, "");
  if (next === "") {
    // Remove the section and one blank line around it, so no double gap is left.
    const blankAfter = rows[section.end + 1]?.trim() === "";
    const blankBefore =
      section.start > 0 && rows[section.start - 1]?.trim() === "";
    rows.splice(
      blankAfter || !blankBefore ? section.start : section.start - 1,
      section.end - section.start + 1 + (blankAfter || blankBefore ? 1 : 0),
    );
  } else {
    rows.splice(
      section.start,
      section.end - section.start + 1,
      ...next.split("\n"),
    );
  }
  return { text: rows.join("\n") };
}

const normalize = (text: string) => text.replace(/\r\n?/g, "\n");
