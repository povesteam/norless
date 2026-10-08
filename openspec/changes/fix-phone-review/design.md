# Design

## Context

The phone is where the team uses Norless most during a service. The account menu held My account, the device type, the app team's pages and, on a laptop, About, Privacy and Install; on a phone it also listed who's online. The live panel's This device section is one row that scrolls sideways on a phone, with the offline switch last. The stage views had a look-ahead row and, in the vocalists view, a row for the key. Phones without a back button (iPhones) relied on the ☰ menu or the system's edge swipe.

## Goals / Non-Goals

**Goals:**
- One tap to what's meant: the photo to My account, the title to the live panel.
- Nothing a team member needs on a Sunday hidden behind a sideways scroll or a missing back button.
- The stage views give their rows to the song.

**Non-Goals:**
- A back button on laptops and tablets, which have the browser's or the keyboard's.
- Moving Features into Settings: decided with the maintainer to keep its own page, since members who aren't owners read it there and Settings is owners-only.

## Decisions

- **The photo opens My account.** Decided with the maintainer, 2026-10-07. My account gets a This device section (the device type and the offline switch), the app team's Ideas and Usage, and About, Privacy and Install at its bottom. Visitors keep Log in and, on a laptop, the ⋯ menu. Alternatives: everything into ☰ and More (a laptop's More would mix the community's pages with the app's); a long-press keeping the old menu (hidden).
- **Who's online at the top of ☰ on a phone.** The stacked photos under one's own stay; the list that the account menu showed moves to the menu, as Classic's menu already has it.
- **The offline switch on My account, for the community opened last.** It's per device and for any member, and Settings is owners-only and community-wide. My account is outside a community, so the switch names the community this device opened last ("Keep Unu-Unu's songs for offline"); the keeper keeps running on the community's pages as before. Alternatives: Settings opened to every member for a This device tab; the live panel's first line.
- **← in ☰'s place below the top.** Decided with the maintainer, 2026-10-07: a phone's bar keeps one button at its left. Pages below the top are a song, its editor and chords, a new song, a recording and a settings section; each has a parent (the song from its editor and chords, the recordings from a recording, the settings' list from a section, the community's home from a song and a new song). ← goes back in history when the page was reached inside the app, else to the parent, so a link opened from a message doesn't leave the app. The pages outside a community keep their "Back to <community>" link, which now stays at the top. Alternatives: ← beside ☰ (less room for the title); only sticky links, relying on the iPhone's edge swipe.
- **The live bar's title opens it.** A tap on the title, or a drag of at least 24 pixels up or down from it, opens or folds the panel; the arrow button stays for the keyboard and screen readers. A drag past the threshold acts at once rather than following the finger, since the panel's height changes with its content.
- **One language in the phone's Song view.** Decided with the maintainer, 2026-10-07: a choice of the community's languages above the parts, starting in the interface language when the community has it, kept per device. Alternatives: each part in both languages one under the other; both side by side in smaller type.
- **Look-ahead removed.** Decided with the maintainer, 2026-10-07: the arrows went, and with them looking privately at another song (by swipe too). In Whole song a swipe still moves the live song for the team. Alternatives: arrows gone with the swipe kept; Earlier and Later in the Display menu.
- **The key in the vocalists' toolbar.** Decided with the maintainer, 2026-10-07: beside the language button, so it's always in view; the line under the toolbar holds the recording mark, the recordings and who leads, and shows only while recordings or service roles are switched on, so it doesn't come and go with the songs. Alternatives: above the parts' map (narrow for C#m); in the live part's corner (moves).
- **Whole song scrolls by itself, fast.** The browser's smooth scroll takes about half a second and aims once, so a finger running over the map outran it, and a live part that grew as it went live (it's drawn larger) could end under the buttons. The view scrolls in 200 ms and re-aims on every frame, ending with the whole part in view (centered when it fits); with reduced motion it jumps.
- **Previous and next at the bottom with nothing live.** The "No song is live" line takes the free height, as the parts do.
- **The instrument's icon.** The phone bar's button to one's stage view shows the main instrument: a microphone for vocals, a guitar for guitar and bass (Lucide has no bass), a piano for keys, a drum for drums, a note for other.
- **Tooltips on links.** React Aria's tooltip learns its trigger's position from a button, which a link isn't; React Aria's `Focusable` gives it the link's, so the tooltip opens beside the link instead of the screen's corner.
- **Dialogs over Android's keyboard.** React Aria sizes a dialog's backdrop to the visible height, but places it at the page's top; Android pans the visible area down to a focused field instead of resizing the page, so the dialog's top was cut off and the page showed under it. The backdrops of dialogs, drawers and alerts follow the visible area's top (`--visual-viewport-top`, kept by a listener on the visual viewport).

## Risks / Trade-offs

- [A member who used look-ahead to read the next song during the sermon loses it] → the playlist is a tap away (the toolbar's first button).
- [The offline switch on My account is one more tap away during a service] → it's set once per device, before camp, and the keeper keeps running without the page open.
