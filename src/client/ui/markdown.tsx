import type { ReactNode } from "react";

/** **bold**, *italic* and _italic_ inside a line, as React nodes (never HTML). */
function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g)
    .filter(Boolean)
    .map((part, i) =>
      part.startsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : /^(\*|_).+\1$/.test(part) ? (
        <em key={i}>{part.slice(1, -1)}</em>
      ) : (
        part
      ),
    );
}

/**
 * The Markdown text slides use: # and ## headings, - or * lists, paragraphs separated by
 * a blank line (single line breaks kept), bold and italic. Anything else is text.
 */
export function Markdown({ text }: { text: string }) {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n\s*\n/);
  return blocks.map((block, i) => {
    const lines = block.split("\n");
    const heading = /^(#{1,2})\s+(.*)$/.exec(lines[0] ?? "");
    if (heading && lines.length === 1)
      return heading[1] === "#" ? (
        <h1 key={i} className="text-[1.4em] font-bold">
          {inline(heading[2] ?? "")}
        </h1>
      ) : (
        <h2 key={i} className="text-[1.2em] font-semibold">
          {inline(heading[2] ?? "")}
        </h2>
      );
    if (lines.every((l) => /^[-*]\s+/.test(l)))
      return (
        <ul key={i} className="list-disc ps-[1em]">
          {lines.map((l, j) => (
            <li key={j}>{inline(l.replace(/^[-*]\s+/, ""))}</li>
          ))}
        </ul>
      );
    return (
      <p key={i}>
        {lines.map((l, j) => {
          const h = /^(#{1,2})\s+(.*)$/.exec(l);
          return (
            <span key={j} className={h ? "block font-bold" : "block"}>
              {inline(h ? (h[2] ?? "") : l)}
            </span>
          );
        })}
      </p>
    );
  });
}
