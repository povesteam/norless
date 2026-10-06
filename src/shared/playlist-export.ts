import { lettersOnly, plainLyrics } from "./song-render.js";
import type { Named } from "./playlist-name.js";
import { parseSong, type Section } from "./song-text.js";

/** A song as the playlist-export spec writes it: in one language, or the fallback's. */
export type ExportSong = { title: string; text: string };

/** The version in the first of `languages` the song has, else its first one. */
export function exportSong(
  song: { versions: { language: string; title: string; text: string }[] },
  languages: string[],
): ExportSong | null {
  const version =
    languages
      .map((l) => song.versions.find((v) => v.language === l))
      .find(Boolean) ?? song.versions[0];
  return version
    ? { title: lettersOnly(version.title), text: version.text }
    : null;
}

type Part = {
  name: string | null;
  lines: string[];
  /** Copy writes it as its name alone: a repeat with the same text as the first. */
  again: boolean;
};

/** A section's lyrics: no chords, `×2` after the last line a repeat mark covers. */
function lyrics(section: Section) {
  const sung = section.lines
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => !line.chordsOnly);
  return sung.map(({ line, i }) => {
    const repeat = section.repeats.find((r) => r.to === i);
    const text = plainLyrics([line]);
    return repeat ? `${text} ×${repeat.times}` : text;
  });
}

/** The parts of a song in order, with the refrain rules. */
function parts(text: string): Part[] {
  const { sections } = parseSong(text);
  const first = new Map<string, string>();
  return sections.map((section) => {
    const source =
      section.repeatOf === null ? section : sections[section.repeatOf];
    const lines = source ? lyrics(source) : [];
    const name = section.name ?? source?.name ?? null;
    if (!name) return { name, lines, again: false };
    const joined = lines.join("\n");
    const seen = first.get(name);
    if (seen === undefined) first.set(name, joined);
    return { name, lines, again: seen === joined };
  });
}

/**
 * Plain text for a chat: the heading, then each song numbered, its parts separated by
 * blank lines; a repeat with the same text is its name alone.
 */
export function exportText(songs: ExportSong[], heading: string): string {
  const blocks = songs.map((song, i) => {
    const body = parts(song.text).map((part) =>
      part.again && part.name
        ? part.name
        : [part.name ? `${part.name}:` : null, ...part.lines]
            .filter((l) => l !== null)
            .join("\n"),
    );
    return [`${i + 1}. ${song.title}`, ...body].join("\n\n");
  });
  return `${[heading, ...blocks].join("\n\n\n")}\n`;
}

const escape = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * A standalone page, for saving and printing: the heading, numbered contents, each song
 * with every repeat in full and a link back up, and a light or dark switch it
 * remembers. No outside resources. Print leaves out the contents, links and switch.
 */
export function exportHtml(
  songs: ExportSong[],
  {
    heading,
    language,
    words,
  }: {
    heading: string;
    language: string;
    words: { contents: string; top: string; theme: string };
  },
): string {
  const contents = songs
    .map(
      (song, i) =>
        `<li><a href="#song-${i + 1}">${escape(song.title)}</a></li>`,
    )
    .join("\n");
  const body = songs
    .map((song, i) => {
      const sections = parts(song.text)
        .map(
          (part) =>
            `<p>${part.name ? `<b>${escape(part.name)}:</b><br>` : ""}${part.lines
              .map(escape)
              .join("<br>")}</p>`,
        )
        .join("\n");
      return `<section id="song-${i + 1}">
<h2>${i + 1}. ${escape(song.title)}</h2>
${sections}
<a class="top" href="#top">↑ ${escape(words.top)}</a>
</section>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="${escape(language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(heading)}</title>
<style>
:root { color-scheme: light; --bg: #fff; --fg: #111; --muted: #666; --link: #0a58ca; }
:root.dark { color-scheme: dark; --bg: #111; --fg: #eee; --muted: #999; --link: #8ab4f8; }
body { margin: 0 auto; max-width: 40rem; padding: 1rem; background: var(--bg); color: var(--fg);
  font: 1.125rem/1.5 system-ui, sans-serif; }
a { color: var(--link); }
h1 { font-size: 1.5rem; } h2 { font-size: 1.25rem; margin-top: 2rem; }
.top, nav { font-size: 0.9rem; } p { margin: 0 0 1rem; }
button { display: block; margin-left: auto; font: inherit; }
@media print {
  nav, .top, button { display: none; }
  body { max-width: none; padding: 0; background: #fff; color: #000; }
  section { break-inside: avoid-page; } p { break-inside: avoid; }
}
</style>
</head>
<body id="top">
<button type="button" onclick="theme(!document.documentElement.classList.contains('dark'))">◐ ${escape(words.theme)}</button>
<h1>${escape(heading)}</h1>
<nav><h2>${escape(words.contents)}</h2><ol>
${contents}
</ol></nav>
${body}
<script>
function theme(dark) {
  document.documentElement.classList.toggle("dark", dark);
  try { localStorage.setItem("norless-export-dark", dark ? "1" : "0"); } catch (e) {}
}
try { theme(localStorage.getItem("norless-export-dark") === "1"); } catch (e) {}
</script>
</body>
</html>
`;
}

/** `2026-09-30-Songs.html`: the playlist's date, and its title without characters files can't have. */
export function exportFileName({ title, date }: Named) {
  const name = (title ?? "")
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${date}-${name || "playlist"}.html`;
}
