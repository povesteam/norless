// Makes the icons the manifest and iOS need from public/icon-512.png (the old app's
// rainbow, until Norless has a logo): npx tsx scripts/icons.ts
// iOS fills transparency with black, and maskable icons get cropped to a circle, so
// both get a white square with the picture inside its safe zone.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const icon = `data:image/png;base64,${readFileSync("public/icon-512.png").toString("base64")}`;
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size] of [
  ["public/icon-maskable-512.png", 512],
  ["public/apple-touch-icon.png", 180],
] as const) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:#fff}div{width:${size}px;height:${size}px;display:grid;place-items:center}img{width:76%;height:76%}</style><div><img src="${icon}"></div>`,
  );
  await page.screenshot({ path: file });
}
await browser.close();
