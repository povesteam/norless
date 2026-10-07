# Design

## Context

The icon shows in few places: the home screen, dock or taskbar once installed, the browser tab, and the Start page (64 px). Inside the app, the community's own logo fills the header, so Norless needs an icon, not a wordmark. The name comes from the Romanian "nor" (cloud): a cloudless sky. Communities project Romanian and Ukrainian side by side today, and English is a third language.

## Goals / Non-Goals

**Goals:**
- Recognisable at 16 px in a browser tab and on a crowded home screen, light or dark.
- Says what Norless does that other projection apps don't: languages in sync.
- Survives every platform's treatment: iOS's rounded square, Android's circle, Android's themed tint.

**Non-Goals:**
- A wordmark, brand colors for the app's interface or a brand guide.

## Decisions

- **An N from two parallel strands.** The two strands are two languages moving together, and the shape is still a letter people can name. Alternatives: the cloud and rainbow redrawn flat (familiar to today's users, but a rainbow can read as a pride flag to some churches; one variant keeps its arch); a screen with lyrics or a note (says "projection" at once, but looks like every other projection app); a plain N monogram (says nothing about the product).
- **Two strands, not three.** Two stay apart at 16 px; three merge there. Two is also what communities project today.
- **The Ribbon.** An N stroked as one band and split down its middle into two strands, crisp cut corners, the strands in two tones. Picked over a soft, slanted, arched and echoed N (2026-10-07, round 1), and over folded, cut-out, split-field, oversized, striped and lighter versions of itself (round 2).
- **A tile when installed, transparent in the tab.** iOS fills transparency with black, and Android and macOS (14 and later) take the maskable icon, which must be opaque, so home screens and the dock get a tile. The browser tab and the Windows taskbar show the ribbon alone, with a real gap between the strands, so the tab's own color shows through; the SVG favicon switches its blues with the browser's light or dark mode (round 3). The PNG that Windows uses can't switch, so its blues must read on a light and a dark taskbar.
- **A Chord blue tile.** The tile is the chords' blue for the 4 and its relative (#0073cf), the strands white and a pale tint of it (#bbe2ff), so the app's two signature colors are one. Picked over a sky blue, the chords' green, teal, violet, magenta and orange, and skeuomorphic skies (rounds 4 and 5). Of the N icons people know, Netflix's red folded ribbon and Naver's green tile come nearest; a flat blue tile with two strands is farthest from both.
- **The splash shows the ribbon alone.** Android builds an installed app's splash from the manifest's plain icon on its background color, and Windows puts the same icon in the taskbar, so that icon is the ribbon without its tile: the dark splash shows the N, not a square. A PNG can't follow light and dark, so its blues (#2c90e8, #0064be) are the ones that read on the dark splash (3.4:1 and up) and on a light or dark taskbar (2.9:1 and up). The SVG favicon switches between deeper blues on a light tab and lighter ones on a dark tab.
- **The Start page shows the tile,** what lands on the home screen when it's installed.
- **No splash images for iOS.** iOS wants one startup image per screen size, two dozen files to keep; installed, it opens on the dark background the page sets before its styles load.
- **No church symbol.** The mark stays simple, and Norless is meant for camps and choirs later.
- **Drawn as SVG, picked from variants.** Claude draws variants in SVG, shown at their real sizes and masks on a comparison page; the maintainer picks one or a mix, and a designer may polish the pick later. An AI that draws real SVG (Recraft's V4.1 Vector) can add ideas; a raster AI's ideas are redrawn as SVG.
- **Every file from one SVG.** The PNGs are rendered from the SVG with Playwright's Chromium, already installed for the tests, so no new dependency. The favicon is its own SVG, cropped tight around the mark, since at 16 px every pixel of padding is a pixel less of N.
- **Each platform's rules.** iOS fills transparency with black, so its 180 px icon is opaque; Android's maskable icon keeps the mark inside the centre 80% circle; Android's themed icons take the strands alone (`purpose: monochrome`) and tint them.

## Open questions

None.

## Risks / Trade-offs

- [Today's users look for the rainbow on cutover day] → the announcement of the move shows the new icon.
- [Two strands with a gap are fine detail at 16 px] → the favicon is cropped tight, and the comparison page showed the real 16 px before the pick.
- [Some Chrome versions might build the splash from the maskable icon, showing the tile] → tried on an Android phone before archiving.
