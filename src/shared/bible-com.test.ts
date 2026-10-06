import { expect, test } from "vitest";
import { slideHtml } from "./bible-com.js";
import { parseSong } from "./song-text.js";

const { slides } = parseSong(
  [
    "1:",
    "Har minunat <b>și</b> sfânt",
    "",
    "R:",
    "Slavă ţie, <script>x</script>",
    "",
    "2:",
    "Amin *",
  ].join("\n"),
);

test("a verse: the header, one paragraph per line, the next line dimmed", () => {
  expect(slideHtml({ slides, index: 0, keySignature: "G", title: "Har" })).toBe(
    '<h1 class="reference">#1/3 · G · Har</h1>' +
      '<div class="singlelines"><p>Har minunat <b>și</b> sfânt</p></div>' +
      '<p style="opacity: 0.5">Slavă ție, &#60;script&#62;x&#60;/script&#62;</p>',
  );
});

test("refrains in italics, song text escaped, the final mark on the last slide", () => {
  const refrain = slideHtml({
    slides,
    index: 1,
    keySignature: "",
    title: "A <b>",
  });
  expect(refrain).toContain('<h1 class="reference">#2/3 · A &#60;b&#62;</h1>');
  expect(refrain).toContain(
    "<p><i>Slavă ție, &#60;script&#62;x&#60;/script&#62;</i></p>",
  );
  expect(refrain).not.toContain("<script>");
  expect(
    slideHtml({ slides, index: 2, keySignature: "", title: "Har" }),
  ).toContain('<p>Amin <span style="opacity:.5">*</span></p>');
});
