# Classic layout design

Why Classic works as the spec says: what it keeps from the old Norless, what it drops, and how the bar, menu and phone views are shaped.

## Decisions

- **A layout of the playlist page, not a copy**: Classic is built from the same entry list, slides panel, song editor, search box and live controls as the other layouts, so playlists have one code path. It is what a community with no feature switched on gets, and it stays a layout choice on every device when other features come on.
- **Old flow, new look**: the team keeps what they know (click to select, type to search, Enter to add, a clicker's Page keys) so they can work on the first day; the old app's awkward parts are left out (see Rejected).
- **Two columns from 750 px**: the playlist with its search box, and the selected entry's slides, in a 2 : 3 split. 750 px is a CSS media query, the old app's own breakpoint. The editor takes the slides' place only while a song is edited. Narrower, one thing shows at a time, with a back arrow.
- **It fills the window like an app**: the window never scrolls and each column scrolls alone, with no scrolling area inside another. The playlist's title, the search and the bottom bar stay in view, so Blank and Next are always reachable during a service.
- **Select first, project on purpose**: a click selects and shows the slides, so a song can be checked during the sermon. Go live (or a double-click, or Enter) sends the first slide. A visible button exists because a double-click can't be discovered. A live entry shows a plain "Live" with its icon, so it doesn't read as a button.
- **Clicker keys always work**: Page Up and Page Down act even while typing in the editor, since presenter clickers send them, and they cross into the next or previous entry. Escape only blanks, never shows again, so it can't project by accident.
- **Blank keeps the position**: Blank empties the screens and keeps the bar. Show again returns the same slide, and Previous and Next still work while blank.
- **Live is marked twice**: a frame in the live color, drawn in the border every row and slide already has, so nothing moves when something goes live; plus a small "Live" tag inside the card, so color isn't the only mark. Focus rings are drawn inside.
- **Controls disabled, not hidden, on an empty playlist**: the bar keeps its shape when the first song is added. The keyboard and a clicker still move what's live, since they act on the room.
- **Type to search**: a letter or digit outside a text field starts the search, as in the old app, because the team types faster than it points.
- **The empty search box suggests**: actions first (Add divider, Add text slide, a muted Bible-passage hint that isn't clickable), then songs worth suggesting, then random ones. Enter adds the first song, not an action, so click-then-Enter still adds a song. It is always on, since it only changes what Classic's own box shows.
- **Empty playlist offers songs to add**: where statistics is on, the right half lists the first 8 of "Not played lately" (sung in at least 3 services, none in the last 6 months), one tap adds. Without that feature, the empty message alone shows.
- **Who added an entry**: shown under the selected entry's title, never on a row and never as a browser tooltip.
- **Phone bottom bar**: Blank, Previous and Next stay on one row; the other buttons (projectors, Pages, Project here, Media keys) go in a More panel with labeled buttons, Pages keeping its own menu inside. Above them a line of fixed height shows the live title and part, cut with an ellipsis, and "Blanked" while blank. It shows on phones only, since wider pages have the slides beside the playlist.
- **The playlist's name lives in the bar**: renaming happens at most weekly, so a big field above the entries was too prominent. The bar holds ☰, the title with its date muted after it, ⋯ and the community's name, small and muted. Clicking the title turns it into a field (Enter or leaving saves, Escape cancels, empty leaves the date). Long titles are cut with an ellipsis, the community's name first, so the account stays in the bar.
- **Bars know nothing about playlists**: the page fills a slot in the bar through a portal, so other pages leave the bar as it was.
- **Status stays on the page**: problems, the estimated end and who is online keep a row above the search, with a fixed height for members. In the bar they pushed the title, the community and the photo out on a phone.
- **On a phone the title is the menu**: tapping it opens the playlist's actions, Rename first, with a ▾; there is no ⋯. A visitor with no action sees plain text. The community's name takes a line of its own above the bar, small, muted and centered, as a link home. It is drawn from the address, so it's there before the playlist loads and nothing moves.
- **Menu left, photo right**: ☰ first, then the account as a round photo or initials (name in a tooltip, Log in for a visitor), the same in every phone bar, so there is one layout to learn. The account menu (My account, device type) is under the photo.
- **The ☰ panel**: New playlist, the 10 newest playlists with their creators and the open one marked, and a filter that finds any older one by title or date. The server matches the date in every Norless language, so someone on an English interface finds "decembrie". It closes with Escape, a close button at its top, or a click beside it, since a mouse user found no visible way out.
- **A playlist has a date, and a title only when someone gave one**: an untitled playlist shows its date alone, in the viewer's language, so a new playlist needs no renaming and doesn't open in rename mode.
- **Hints**: up to four, one at a time, in a small bubble next to the control (Go live, typing to search, the clicker keys, the projector button), until "Got it" hides it for good on the account. A hint never covers its control or moves anything. Operators learn the new app from Classic itself.
- **Editor**: the old app's fields, one tab per community language for title and lyrics first (title at the top), the shared fields once after them. A hint under the lyrics says what starts a slide and how a part is named. Close leaves without saving, after a confirm when something changed. Create new song opens with the title focused, and "Save and add to playlist" creates it; closing creates nothing.
- **One button per projector**: each projector screen of the room gets a button named as the screen, or one per language when no screen is set up. Browsers allow one popup per click, so it is one button each. It opens full screen on the projector's display where the browser lets pages choose (it asks once), else in a window to move. Pressing again brings that window forward, also after the controller reloads, and live keys pressed in the projector's window act as on the controller. On touch devices each button toggles a preview of its own projector in the page, so the name is the same on every device.

## Rejected

- A third column for the editor: it stayed empty while nobody edited.
- A Close button that blanks and removes the bar: Blank with Show again keeps the position.
- A field that fills itself with today's date for a new playlist: New playlist creates it dated, with no title to fill in.
- All playlists in the menu: the 10 newest plus a filter.
- Menu on the right with the community's name on the left: the menu stays on the left like every other frame, and the photo takes the right.
- The account inside the menu drawer: it moved to the photo.
- The community's name between the title and the photo on a phone: it was cut to a stub. Also tried and dropped: a two-line bar, a label under the bar, and only in ☰.
- A fixed live color (the old pink, or orange): it sat next to a community's own primary color. The live color follows the primary's opposite hue.
- The title in a large field above the entries: too prominent for a weekly action.
- Problems and who is online in the bar: they pushed the title and photo out on phones.
- Switches in Classic's menu to try variants: picks are made on a screenshot comparison page, and only the winner stays in the code.
- Pixel-perfect copies of the old screens: same features and flow, new look.
