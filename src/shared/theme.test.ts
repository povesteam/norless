import { expect, test } from "vitest";
import { contrast, themeCss, themeProblems, UNU_UNU_THEME } from "./theme.js";

test("WCAG contrast", () => {
  expect(contrast("#000000", "#ffffff")).toBeCloseTo(21);
  expect(contrast("#ffffff", "#ac5334")).toBeCloseTo(5.17, 1);
});

test("Unu-Unu's theme passes; pale colors and dark tints don't", () => {
  expect(themeProblems(UNU_UNU_THEME)).toEqual([]);
  expect(themeProblems({ color: "#f0b090" })).toEqual(["color", "soft"]);
  expect(themeProblems({ tint: "#555555" })).toEqual(["tint"]);
});

test("the CSS sets the primary color in both modes, and a font name can't break out", () => {
  const css = themeCss({ ...UNU_UNU_THEME, font: 'Bad"; } body { color: red' });
  expect(css).toContain(
    ":root:not(.dark), .light { --accent: #ac5334; --background: #f9f5f2; }",
  );
  expect(css).toContain(".dark { --accent: #ac5334; }");
  expect(css).toContain('font-family: "Bad  body  color: red"');
  expect(themeCss({})).toBe("");
  expect(
    themeCss({ font: "Switzer", fontFileUrl: "/api/communities/x/font?v=1" }),
  ).toContain(
    '@font-face { font-family: "Switzer"; src: url("/api/communities/x/font?v=1")',
  );
});
