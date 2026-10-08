# Proposal

## Why

The maintainer used the installed app on an Android phone during a rehearsal on 2026-10-07 and listed what got in the way: a text slide's dialog cut off above the keyboard, a tooltip in the screen's corner, two languages squeezed side by side in the Song view, the offline switch scrolled out of sight in the live panel, a live panel that opens only by its small arrow, previous and next floating mid-screen in the vocalists view while a Bible passage is live, a Whole song view that lags behind a finger on its map and hides the last part under the buttons, a row of look-ahead arrows and a row for the key, an account menu where a tap on the photo should simply open My account, one guitar icon for everyone, and no way back on an iPhone. Decided with the maintainer the same day, in two rounds of questions.

## What Changes

- The photo opens My account everywhere. My account gets a This device section (the device type, and "Keep songs for offline" for the community opened last), the app team's Ideas and Usage, and About, Privacy and Install at its bottom. On a phone, who's online moves to the top of the ☰ menu.
- On a phone, pages below the top (a song, its editor and chords, a new song, a recording, a settings section) show ← in place of ☰, back to where they came from or to their parent; the pages outside a community keep "Back to <community>" at the top while they scroll.
- Phone controller: the live bar opens and folds by a tap on its title or by dragging the title; the Song view shows one language at a time with a choice above the parts.
- Stage views: look-ahead goes; the vocalists view's key moves into the toolbar row, and the line under it shows only while recordings or led-by are on; previous and next stay at the bottom with nothing live; Whole song scrolls quickly and ends with the whole part in view.
- The phone bar's button to one's stage view shows the main instrument's icon.
- Bugs: tooltips on links (the stage view button, back to the playlist) open by their button; dialogs stay in view when Android's keyboard opens.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-shell`: the photo opens My account; who's online in the phone's menu; About, Privacy and Install on My account; Back on a phone.
- `auth`: the device type on My account instead of an account menu.
- `classic-layout`: the photo opens My account; ← on a phone below the top.
- `feedback`: the app team's pages on My account.
- `offline`: the switch on My account.
- `live-control`: the phone's live bar opens by its title; one language in the Song view.
- `screens`: look-ahead removed; the vocalists view's key, scrolling and buttons; the stage view button's icon.

## Impact

- `src/client/app/UserMenu.tsx`, `src/client/account/AccountPage.tsx`, `src/client/app/CommunityNav.tsx`, `src/client/live/Classic.tsx`, `src/client/app/App.tsx` (the avatar, My account, ←, the sticky header).
- `src/client/live/LiveBar.tsx`, `src/client/live/ControllerViews.tsx`, `src/client/app/Offline.tsx` (the live bar, the Song view, the offline switch).
- `src/client/stage/Vocalists.tsx`, `VocalsParts.tsx`, `Musicians.tsx`, `LookAhead.tsx` (removed), `parts.tsx`, `src/client/ui/tip.tsx`, `src/client/ui/icons.tsx`, `src/client/index.css`.
- e2e: `auth`, `members`, `bar`, `device`, `usage`, `classic/phone`, `live/stage`, `music/instruments`, and the screenshots of the views that change.
