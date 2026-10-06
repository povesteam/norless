import { formatLines, lettersOnly, type Segment } from "./song-render.js";
import type { Slide } from "./song-text.js";

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Styled segments as HTML, every piece of text escaped. */
const html = (segments: Segment[]) =>
  segments
    .map((s) => {
      // ~ is an invisible character that keeps its width.
      let out = escape(lettersOnly(s.text)).replace(
        /~+/g,
        (part) => `<span style="visibility: hidden">${part}</span>`,
      );
      if (s.italic) out = `<i>${out}</i>`;
      if (s.bold) out = `<b>${out}</b>`;
      if (s.underline) out = `<u>${out}</u>`;
      if (s.color)
        out = `<span style="color: ${escape(s.color)}">${out}</span>`;
      return out;
    })
    .join("");

/**
 * A song's slide as the HTML that the "Project verses from bible.com" windows fit to the
 * screen: a header with the progress, the key and the title, one paragraph per line
 * (refrains in italics, ×2 after repeated lines, a light grey * after the song's last line), and
 * the next slide's first line, dimmed.
 */
export function slideHtml({
  slides,
  index,
  keySignature,
  title,
}: {
  slides: Slide[];
  index: number;
  keySignature: string;
  title: string;
}): string {
  const slide = slides[index];
  if (!slide) return "";
  const shown = slide.lines
    .map((line, at) => ({ line, at }))
    .filter(({ line }) => !line.chordsOnly);
  const lines = formatLines(shown.map(({ line }) => line.text)).map(
    (segments, i) => {
      const repeat = slide.repeats.find((r) => r.to === shown[i]?.at);
      const last = slide.last && i === shown.length - 1;
      const text = `${html(segments)}${repeat ? ` ×${repeat.times}` : ""}${last ? ' <span style="opacity:.5">*</span>' : ""}`;
      return `<p>${slide.type === "refrain" ? `<i>${text}</i>` : text}</p>`;
    },
  );
  const header = [`#${index + 1}/${slides.length}`, keySignature, title]
    .filter(Boolean)
    .map((part) => escape(lettersOnly(part)))
    .join(" · ");
  const next = slides[index + 1]?.lines.find((l) => !l.chordsOnly);
  const nextLine = next
    ? `<p style="opacity: 0.5">${html(formatLines([next.text])[0] ?? [])}</p>`
    : "";
  return `<h1 class="reference">${header}</h1><div class="singlelines">${lines.join("")}</div>${nextLine}`;
}
