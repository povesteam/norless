import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Markdown } from "./markdown";

const html = (text: string) => renderToStaticMarkup(<Markdown text={text} />);

test("headings, paragraphs with line breaks, lists, bold and italic", () => {
  expect(html("# Anunțuri\n\nDuminică la **10:00**\n*seara* la 18")).toBe(
    '<h1 class="text-[1.4em] font-bold">Anunțuri</h1><p><span class="block">Duminică la <strong>10:00</strong></span><span class="block"><em>seara</em> la 18</span></p>',
  );
  expect(html("- unu\n- doi")).toBe(
    '<ul class="list-disc ps-[1em]"><li>unu</li><li>doi</li></ul>',
  );
});

test("markup stays text", () => {
  expect(html("<script>alert(1)</script>")).toContain(
    "&lt;script&gt;alert(1)&lt;/script&gt;",
  );
});
