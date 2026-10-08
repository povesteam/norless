# Tasks

## 1. Bugs

- [x] 1.1 Tooltips on links: the stage view button and back to the playlist wrap their link in React Aria's `Focusable`. Verify in an e2e test that the long-press tooltip opens beside the button
- [x] 1.2 Dialogs follow the visible area's top (`--visual-viewport-top` on dialogs', drawers' and alerts' backdrops). Verify in an e2e test with the visual viewport panned (its offset and height stubbed, as pinch-zoom is what React Aria ignores)
- [x] 1.3 Vocalists view: previous and next at the bottom with nothing live. Verify in `e2e/live/stage.spec.ts` with a Bible passage live

## 2. Stage views

- [x] 2.1 Remove look-ahead (`LookAhead.tsx`, its strings, its tests); Whole song's swipe moves the live song for the team only
- [x] 2.2 Whole song scrolls in 200 ms, re-aiming each frame, and ends with the whole part in view. Verify the last part's bottom is above previous and next after tapping it on the map
- [x] 2.3 The vocalists' key in the toolbar row; the line under it only while recordings or service roles are on
- [x] 2.4 The phone bar's stage view button shows the main instrument's icon (`instrumentIcons` in `icons.tsx`)

## 3. Phone controller

- [x] 3.1 The live bar opens and folds by a tap on its title and by dragging it. Verify both in an e2e test on a phone
- [x] 3.2 The Song view shows one language with a choice above the parts, remembered on the device. Verify in an e2e test on a phone

## 4. My account and the bars

- [x] 4.1 The photo opens My account (both bars and the app's header); My account gets This device (device type, the offline switch for the last community), the app team's links, and About, Privacy and Install; update the e2e tests that opened the account menu
- [x] 4.2 Who's online at the top of the phone's ☰ menu (app frame)
- [x] 4.3 ← in ☰'s place on a phone below the top, back in history or to the parent; the app header sticky on a phone. Verify both ways in an e2e test

## 5. Screenshots and archive

- [x] 5.1 Take the screenshots of the views that changed (account, phone playlist, vocalists, musicians, and the new `control-song`) and check them
- [x] 5.2 Full `npm run e2e`
- [ ] 5.3 Try on an Android phone and an iPhone: a text slide's dialog with the keyboard open, a finger run down Whole song's map, ← on a song, the live bar's title tap and drag
- [ ] 5.4 When archiving, fold the decisions into the capabilities' `design.md` files, and drop look-ahead's from `screens/design.md` and `live-control/design.md`
