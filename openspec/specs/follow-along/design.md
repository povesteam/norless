# Follow-along design

Why the follow-along page works as the spec says: a public, read-only view that has to hold hundreds of phones at once.

## Decisions

- **Its own small topic**: phones subscribe to `follow:<community>`, not to the room's full live state. It carries only what a phone needs: the entry, the part, blank, whether a page is up, a text slide or Bible reference, a verse from bible.com, the next song's titles, and the song's id and last-change time. Each phone loads the song's text once, as any visitor may, and again only when that time changes.
- **At most one update per 200 ms**: the server publishes the latest state on a timer, so a fast clicker doesn't flood 500 phones.
- **Catching up is a subscribe**: the connection reconnects and subscribes again after a phone wakes up, and the server answers a subscribe with the current state. That is what puts a phone unlocked after ten minutes on the current part within two seconds.
- **Names are removed on the server**: the live state names who changed the slide. Members subscribe to the named topic; visitors' pages (projector, stage, musicians, vocalists) get one without names, and the follow topic has none. It is checked when they subscribe. Stripping names in the client would still send them to visitors' browsers.
- **Read-only and invisible**: the page has no controls, records no plays and isn't in presence, so a guest in the room leaves no trace. Guests who play in the band log in as guest musicians.
- **The same parts as the vocalists' Whole song**: every part in order, scrolling by itself to keep the live part in view, the next one marked, and the next song's title under the last part.
- **Both languages line under line**: with both chosen, each line is followed by the same line in the other language in a softer color, in one column that fits a phone. Side by side, each column would be too narrow.
- **Choices stay on the phone**: language (the browser's if the community has it, else the first), larger and smaller text (in steps of 0.2 from 0.6 to 2.4), and light or dark live in browser storage, so no account is needed. Dark is the default, since a room during worship is dim.
- **Only the title while blank or on a page**: a phone shouldn't show lyrics nobody is singing, but the title keeps its place. With no song it shows nothing. A Bible reference shows the reference and a text slide is shown.
- **Slides as a phone-sized picture**: a slides page is a picture, so the page shows the 1280 px one in the phone's language file when there is one, and the phone's pinch zoom enlarges it.
- **The short link is the community's own address**: `norless.com/<community>` is easy to say and to print. For a visitor it opens `/<community>/follow` while something is live, and the newest playlist otherwise. An owner isn't treated as a visitor while who they are still loads.
- **A QR code on start pages, not during songs**: owners switch it on per start page. The projector draws it with the short link in the bottom-right corner (lean-qr, small and dependency-free, also used for pairing). It never shows while songs are live, since it would sit on the lyrics.
- **A feature switch**: the page exists only while `followAlong` is on; otherwise it is not found.

## Rejected

- Controlling live from a follow-along phone: playing guests have their own login.
- A built-in welcome screen with countdown, logo and announcements: communities keep their own start page.
- A QR code on the projector during songs.
- Subscribing phones to the room's full live topic: it carries more than they use, and names.
