// Makes every icon from the Ribbon: an N stroked as one band and split down its middle
// into two strands, the two languages a community projects in sync. Installed, it sits
// on a tile in the chords' blue; in the browser tab, the Windows taskbar and Android's
// splash screen it stands alone, so the background shows through (app-shell spec).
// npx tsx scripts/icons.ts
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

/** The two strands in a 100-unit square, inside the circle Android crops icons to. */
const STRANDS = [
  "M17.77 68.69L17.77 31.31L33.86 23.78L62.61 47.74L62.61 31.31L70.09 31.31L70.09 63.7L29.07 29.52L25.24 31.31L25.24 68.69Z",
  "M29.91 68.69L29.91 36.3L70.93 70.48L74.76 68.69L74.76 31.31L82.23 31.31L82.23 68.69L66.14 76.22L37.39 52.26L37.39 68.69Z",
];
/** Around the N with a little margin, where nothing crops it: the tab, the taskbar, the splash. */
const TIGHT = "12.8 12.8 74.5 74.5";
/** The chords' blue for the 4 and its relative (oklch 0.55 0.17 250), and a pale tint of it. */
const TILE = "#0073cf";
const ON_TILE = ["#ffffff", "#bbe2ff"];
/** A PNG can't follow light and dark: blues that read on the dark splash and on either taskbar. */
const ALONE = ["#2c90e8", "#0064be"];
/** The SVG favicon's blues, deeper on a light tab and lighter on a dark one. */
const LIGHT_TAB = ["#006ac5", "#003d7c"];
const DARK_TAB = ["#a4d6ff", "#39a3ff"];

const svg = (viewBox: string, inside: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${inside}</svg>\n`;
const strands = (colors: string[]) =>
  STRANDS.map((d, i) => `<path d="${d}" fill="${colors[i]}"/>`).join("");

const tile = svg(
  "0 0 100 100",
  `<rect width="100" height="100" fill="${TILE}"/>${strands(ON_TILE)}`,
);
const alone = svg(TIGHT, strands(ALONE));
const white = svg("0 0 100 100", strands(["#fff", "#fff"]));
const favicon = svg(
  TIGHT,
  `<style>.a{fill:${LIGHT_TAB[0]}}.b{fill:${LIGHT_TAB[1]}}` +
    `@media (prefers-color-scheme:dark){.a{fill:${DARK_TAB[0]}}.b{fill:${DARK_TAB[1]}}}</style>` +
    STRANDS.map((d, i) => `<path class="${"ab"[i]}" d="${d}"/>`).join(""),
);

writeFileSync("public/icon.svg", tile);
writeFileSync("public/favicon.svg", favicon);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, source, size] of [
  ["public/apple-touch-icon.png", tile, 180],
  ["public/icon-maskable-512.png", tile, 512],
  ["public/icon-192.png", alone, 192],
  ["public/icon-512.png", alone, 512],
  ["public/favicon-32.png", alone, 32],
  ["public/icon-monochrome-512.png", white, 512],
] as const) {
  await page.setViewportSize({ width: size, height: size });
  const src = `data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}`;
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}img{display:block}</style><img src="${src}" width="${size}" height="${size}">`,
  );
  await page.screenshot({ path: file, omitBackground: true });
}
await browser.close();
