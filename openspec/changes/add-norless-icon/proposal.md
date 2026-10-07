# Proposal

## Why

Norless still wears the old app's icon: a cloud and rainbow, a soft raster that blurs at every size and turns into a smudge in a 16 px browser tab. It has no version for Android's round mask or themed icons, and no SVG. People will find the new app by its icon on their home screens from cutover on, so it needs its own. Decided with the maintainer on 2026-10-07.

## What Changes

- A new icon: a letter N drawn as two parallel strands, the two languages a community projects in sync, on a tile when installed and transparent in the browser tab. No text and no church symbol.
- One SVG source for every size: the browser tab (an SVG favicon cropped tight, with a 32 px PNG for older browsers), the iOS home screen (180 px, opaque), install (192 and 512 px), Android's round mask (the mark inside the centre 80% circle) and Android's themed icons (the strands alone).
- The Start page's icon follows, as it uses the same file.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-shell`: the app's own icon, and the sizes and masks it must read at.

## Impact

- `public/`: the icon files, replaced; `public/manifest.webmanifest` gains the monochrome icon; `index.html` links the SVG favicon.
- `e2e/pwa.spec.ts` (the manifest's icons); the Start page screenshot (`e2e/screenshots/shots/classic.ts`, `start`).
