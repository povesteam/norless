# Live control design

Why live control works as the spec says: one server-held state per room, moved by one route, mirrored at once on the device that pressed.

## Decisions

- **One route, the server decides**: every change is `POST /api/communities/<slug>/live` with an action (go, next, previous, blank, message, page, verse, timer). The server checks the role, works out next and previous from the live playlist (not the one a device has open), and publishes the result. So a screen on a device with an older playlist still follows.
- **State in memory, copied to the database**: there is one server process, so memory is the truth; `rooms.live` keeps a copy, so a restart during a service comes back on the same slide.
- **Open topic**: `live:<slug>` is readable without login, since what is projected is public. A practice room uses `live:<slug>/<room>`; the main room keeps its topic, so screens, follow-along phones and old links keep working.
- **Last change wins, no locks**: the band is trusted. The "who → what" notice shows whom to help; on a phone's compact bar it replaces the title for 4 seconds in the same place, so nothing moves.
- **Slides counted in one language**: next and previous count the slides of the version in the community's first language that has one; other languages show the same number, or their last slide. Trade-off: a longer translation's last slides aren't reached by next.
- **Timed dividers go live**: the stage monitor's countdown needs a live entry, so a divider with planned minutes goes live as a pause, and next and previous stop on it. Other dividers are skipped.
- **Mode comes from the schedule** each time an entry goes live. A hand switch confused people; an unplanned service is a one-off event. A practice room holds its own mode.
- **The slides timer runs on the server**: a 1-second ticker moves the pages, looping, so every screen follows with the controller's laptop closed. Any live action clears it. The seconds (3 to 120) stay on the entry.
- **A page is a slide**: slides use the song path for next, previous, keys, clickers and thumbnails, so nothing is special-cased.
- **Moves show at once on the pressing device**: a guess of the room's state, until the room confirms it. The server stays the judge. Guesses stay within the live entry, whose slide count the device has; another entry waits for the server (about 0.1 s). A guess ends when the room matches it, when the server refuses or is silent, or 2 seconds after it accepted. A refusal shows no message: the slide going back says it.
- **Next carries where it was pressed from**: the server still picks the target (skipping dividers and deleted songs), so two presses at once land on the same slide. Screens and other devices never guess.
- **Keys**: PageUp and PageDown work in the song editor, so a typo can be fixed mid-service. Esc leaves an open search box to the box.
- **Media keys use the Media Session API**: Chrome and Edge route hardware keys to it on macOS, Windows and ChromeOS, focused or not; phones show it on the lock screen and pass Bluetooth remotes' buttons. Browsers give media keys only to a page that plays audio, so while the switch is on a 10-second silent WAV (Chrome ignores media under 5 seconds) loops, starting on the first tap or key after a reload. A per-device switch keeps Spotify's keys otherwise. Blank sets the session to paused, so play/pause toggles.
- **Local projection needs no server**: the tab keeps its own state and sends it through a BroadcastChannel (`norless:local:<slug>`) to a projector window of the same browser, so it works for anyone and never touches a room or plays.
- **A phone projects in the page**: a phone mirrored to a TV can't use a window, so the same projector component fills the page, full screen. Back keeps projecting, since the phone needs the page to pick another song; only a laptop's closed window stops it.
- **Problems are shown only when there is one**: the indicator opens over the page, so nothing moves. Amber, and red only while a usual screen is missing, the one problem that stops something being projected.
- **A usual screen** was connected in at least 3 of the room's last 4 services, which tolerates one missed week. Screens record when they connect.
- **Missing translations count only for audience screens** (projectors and overlays). The team reads stage and vocalists screens, which show the first version anyway. A song in none of the screens' languages shows the same text everywhere, so it isn't missing one.
- **Too-small text is estimated**: the server can't measure a screen. It finds the largest font at which a slide fits a 16:9 projector from its line count and widest line, with each character's width by kind (narrow letters and spaces 0.22 of the font size, m and w 0.75, capitals 0.6, the rest 0.58). Under 70% of a four-line slide of 32-character lines is too small. The constants are fitted to the sizes the projector gave 730 real slides: every small slide found, about 2% false alarms.
- **Times**: a song's length is the median of its last 10 service plays. Imported plays have no end, so the time to the next play that day counts, at most 12 minutes, so a pause after a song doesn't inflate it. A song never sung uses the community's average singing speed, and the end is marked approximate.
- **Progress is position**: entries above the live one are muted in the text's muted color (keeps 4.5:1), skipped ones too. While the screens are blank the live entry is muted and a thin line in the live color marks the place; while it shows, its frame is enough. Always on, in Classic too. Rows show no clocks; per-entry times stay in the API for the end estimate.
- **Playlist title in the bar**: renaming is rare, so the title is in the community bar, edited by clicking it. A slot in the bar (a portal) lets the bars know nothing about playlists. Long titles are cut, the community's name first. The row above the search keeps the status and its height for members, so people coming and going move nothing.
- **Tap selects, Go live sends** (phone, tablet, Operator): checking the next song never changes the screens by accident.
- **Phone bar is compact**: title, Previous, Blank, Next, with a remembered expand button; tablets and laptops have the room for the full bar. The tablet's live panel is sticky at the side, with Pages, the message and This device under the slides, so the slides start on the first screen.
- **This device folds inside the panel**, not in a popup, so recording and listening go on while it's folded; folded, it still says when they run.
- **Practice rooms are temporary**: its starter or an owner ends it, or it ends after 4 hours without a live change (checked every 5 minutes). A device follows one room per community, remembered on it, and every live view follows that room. The default playlist is the newest, which is usually the next service's. Recordings, chapters and follow-along stay with the main room, so a practice can't end up in a service's recording or video description.
- **Big screen sizes are in CSS pixels**: tiers at 1900, 2500 and 3800, so a 4K monitor at 150% (2560) gets the QHD arrangement. Text size stays, except 125% from 3800, where 4K at 100% shows it half Full HD's size; there the previews go two per row, about twice Full HD's width. Under 1900 the Controller shows, and the picker doesn't offer Big screen.
- **Previews are the screens' own components**, drawn at 1920 × 1080 and scaled by a CSS transform, `inert` so they can't change what's live: no iframes, no extra connections. Stage monitor sizes use container units, so it looks right small.
- **People's tiles come from presence**: a musicians or vocalists view sends a `stage-view` message (layout, languages, text size, colors, device type, how the member reads chords), again after each reconnect. A tile draws the live song as that member's profile plays it. Private look-ahead isn't reported.
- **Welcome page content is public**: the server works out the next event (within a week) when the page goes up and keeps it in the live state's page, so projectors without login need nothing more; the name, logo and announcements come from a public `GET /api/communities/:slug/welcome`. Sizes use the screen's units, so a preview is the screen made small. It appears only when picked.

## Rejected

- A hand-set mode, behind a menu with a confirm or for owners only: confusing either way.
- Arming a part to send it live later: a tap and the part buttons cover it, and long-press stays free for reordering.
- A Loop button: written repeats use repeat marks, unplanned ones the part buttons.
- Locking stage devices during services, and requests or signals from the stage: the band is trusted.
- Guessing a move to another entry on the device (needs the next song's slides early), and showing guesses on other devices.
- Estimating small text from character count: more false alarms and missed slides.
- Clocks in the rows, in any form (a slim timeline, times on dividers only, minutes on the right) and checkmarks on played songs: muting says it with no space.
- A live panel at the bottom of a tablet: it hid the playlist.
- Problems, end and who's online in the bar: on a phone they pushed the title and photo out.
- Global shortcuts other than media keys: a page can't receive them while another app has focus. A clicker can be mapped to media keys with the operating system's tools.
- A phone staying the controller while a TV shows the projector (Presentation API).
- Panels arranged by hand on the Big screen, a layout that scales everything up, and controlling a device from its tile.
- Showing the Welcome page by itself, and a follow-along QR code on it.
- Permanent second rooms with their own screens, or a community per meeting: too heavy.
