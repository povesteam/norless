# Tasks

## 1. Pick

- [x] 1.1 Variants on a comparison page, at real sizes and masks, with prompts for an AI (2026-10-07)
- [x] 1.2 The maintainer picks: the Ribbon on a Chord blue tile, alone on the splash and in the tab (2026-10-07, round 5)
- [ ] 1.3 Optional: a designer polishes the picked SVG

## 2. Files

- [x] 2.1 `scripts/icons.ts` holds the two strands and the colors, and writes `public/icon.svg` (the tile) and `public/favicon.svg` (cropped tight, light and dark)
- [x] 2.2 The same script renders the PNGs with Playwright's Chromium: the tile as `apple-touch-icon.png` (180 px) and `icon-maskable-512.png`; the ribbon alone as `icon-192.png`, `icon-512.png` and `favicon-32.png`; the white strands as `icon-monochrome-512.png`
- [x] 2.3 `manifest.webmanifest` gains the monochrome icon; `index.html` links `favicon.svg` with the PNG as fallback; the Start page shows `icon.svg`
- [x] 2.4 `e2e/pwa.spec.ts`: the manifest lists icons for `any`, `maskable` and `monochrome`, and each file loads

## 3. Screenshots and archive

- [x] 3.1 Take the Start page screenshot again (`npm run screenshots -- -g start`)
- [ ] 3.2 Try it installed on an Android phone (the splash shows the ribbon alone) and an iPhone, and in a light and a dark browser tab
- [ ] 3.3 When archiving, fold the decisions into `openspec/specs/app-shell/design.md`
