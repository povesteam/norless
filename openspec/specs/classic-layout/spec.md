# classic-layout Specification

## Purpose
Give the playlist page a Classic layout with the old Norless's features and flow, so the team can keep working as before on the first day of the new app, without its awkward parts (rethought).

## Requirements

### Requirement: Columns by width

On a page at least 750 px wide, the Classic layout SHALL show two columns: the playlist with the search box above it, and the slides of the selected entry. The song editor SHALL take the slides' place only while a song is being edited, and closing it SHALL bring the slides back. It SHALL fill the window like an app: the window SHALL NOT scroll, each column SHALL scroll on its own, with no scrolling area inside another, and the playlist's title, the search box and the bottom bar SHALL stay in view. On a narrower page it SHALL show one of these at a time: the playlist first; selecting an entry SHALL show its slides, with the entry's title, a back arrow to the playlist, and a pencil to edit the song; the pencil SHALL show the editor.

#### Scenario: Laptop
- **WHEN** an operator opens a playlist in Classic on a laptop and selects a song
- **THEN** the playlist and that song's slides are side by side, with no empty editor column

#### Scenario: Editing in place of the slides
- **WHEN** an editor clicks the pencil on the selected song, then Close
- **THEN** the editor shows where the slides were, and the slides come back after Close

#### Scenario: Long playlist and long song
- **WHEN** a playlist has more entries than the window holds and an editor opens a long song
- **THEN** the playlist and the editor each scroll in their column, and the window itself doesn't scroll

#### Scenario: Phone
- **WHEN** a team member opens the playlist in Classic on a phone and taps a song
- **THEN** the song's slides fill the page, and the back arrow returns to the playlist

### Requirement: Selecting and sending live

In Classic, a click or tap on an entry SHALL select it and show its slides without sending it live. For the team, the selected entry's header SHALL have a Go live button (the entry is live already: a Live mark instead, plain text with its icon, so it doesn't read as a button), which sends its first slide live, as SHALL a double-click on the entry or Enter with it selected; a click or tap on a slide SHALL send that slide live. Up and Down SHALL move the selection, Page Down and Page Up SHALL go to the next and previous slide (into the next or previous entry at either end, and even while typing in the editor), Escape SHALL blank the screens and never show them again, and Delete SHALL remove the selected entry. A divider SHALL NOT go live. The live slide's card SHALL carry a small Live tag inside it besides its frame, so color isn't the only mark. At the bottom of the page, the team SHALL see the Pages button when the community has pages, and while an entry is live, Blank, Previous and Next, with each button's label beside its icon; they SHALL be disabled while the open playlist is empty. Blank SHALL empty the screens and keep the bar; while blank, it SHALL become Show again, which shows the same slide again, and Previous and Next SHALL keep working. On a narrow screen such as a phone, the bottom bar SHALL keep Blank, Previous and Next on one row and put the other buttons (the projectors, Pages, Project here, Media keys) behind a More button.

#### Scenario: Look without projecting
- **WHEN** an operator clicks the next song to check its lyrics during the sermon
- **THEN** the song's slides are shown and the screens don't change

#### Scenario: Go live
- **WHEN** the operator presses Go live on that song, or double-clicks it
- **THEN** its first slide is live on every language's projector, and the button shows Live

#### Scenario: Blank during a prayer
- **WHEN** the operator presses Blank on verse 2, then Show again
- **THEN** the screens are empty, then show verse 2 again

#### Scenario: Page Down at the end of a song
- **WHEN** the last slide of a song is live and the operator presses Page Down
- **THEN** the first slide of the next song in the playlist goes live

#### Scenario: Visitor
- **WHEN** a visitor who isn't logged in opens the playlist in Classic
- **THEN** they see the entries and the slides, the live entry highlighted, and no search box, editor or live controls

#### Scenario: Classic on a phone
- **WHEN** an operator uses Classic on a phone 412 pixels wide while a song is live
- **THEN** Blank, Previous and Next fit on one row, and Pages is under More

### Requirement: Search and add

For the team, typing a letter or digit anywhere outside a text field SHALL start a search in the search box above the playlist. Focusing the empty search box SHALL offer first Add divider and Add text slide, and a muted hint that a Bible passage is found by its reference, then the songs of the `song-search` spec's browsing without a query. The results SHALL show each song's title, key, time signature, tags and when it was last played in a service, and SHALL offer a divider with the typed text; a divider SHALL also be added with Add divider above in an entry's actions. Up and Down SHALL move through the results, and Enter or a click SHALL add the chosen one to the end of the playlist, select it, and clear the search. Escape SHALL clear the search without adding.

#### Scenario: Add a song by typing
- **WHEN** an operator types "harul" with nothing focused and presses Enter
- **THEN** the first result is added at the end of the playlist and selected

#### Scenario: Random songs
- **WHEN** an operator clicks the empty search box
- **THEN** Add divider, Add text slide and the Bible hint come first, then suggested and random songs, and Enter adds the first song

#### Scenario: Add a divider
- **WHEN** an operator types "Rugăciune" and chooses the divider result
- **THEN** a divider "Rugăciune" is added at the end of the playlist

### Requirement: Classic entries

Each entry SHALL show what the `playlists` spec lists (type icon, title, key, time signature, tags, played mark, live highlight). Who added the selected entry SHALL show as their avatar beside its title above the slides, to members, with "Added by" and their name in a styled tooltip; no row shows it. The title SHALL take up to two lines before it's cut. The live slide SHALL have the live color's frame, as wide as the other slides' border, and a slide going live SHALL scroll into view, as little as it takes. The team SHALL be able to reorder entries by dragging the row (long-pressing on touch screens), and use the entry actions of the `playlists` spec, plus Add divider above, which asks for the divider's heading.

#### Scenario: Who added the song
- **WHEN** a member selects a song Oti added
- **THEN** Oti's avatar shows beside its title above the slides, saying "Added by Oti", and the row has no avatar

#### Scenario: Divider before the sermon
- **WHEN** an operator right-clicks the song after the sermon and chooses Add divider above with "Predica"
- **THEN** a divider "Predica" is put just above that song

### Requirement: Classic menu

Classic's bar SHALL hold, from the left, a menu button; on a playlist, its name (its title, then its date muted; or the date alone: playlists spec), its actions (⋯) and the community's name, smaller and muted, on the same line, elsewhere the community's name alone; on a phone with a playlist open, the community's name SHALL take a line of its own above the bar, small, muted and centered, and the playlist's name SHALL open its actions, Rename first, with no ⋯ button; and at the right end the account: the person's round photo or initials, with their name in a tooltip, which opens the account menu (My account, the device type), or Log in for a visitor. The menu button SHALL open a panel from the left with: the community's name; for the team, a New playlist button, and the 10 newest playlists, each with its creator and the open one marked, with a filter box that finds any older one by its title or its date in any of Norless's languages; for editors, Create new song; who is online, for members, under an "Online" heading; the interface language, while it can be chosen; for owners, Ideas and feedback once (their Ideas page) and a link to the settings, where the members are too; and links to the privacy notice and About. Choosing a playlist SHALL open it and close the panel. Escape, a close button at the panel's top or a click beside it SHALL close the panel (no visible way to close it with the mouse). The team SHALL give the open playlist a title by clicking its name in the bar, which turns into a text field with the date as its placeholder (Enter or leaving saves, Escape cancels, an empty field leaves the date alone), or with Rename in its actions, and archive it there, and restore it while archived; the menu's "Show archived" lists the archived ones. A long title SHALL be cut with an ellipsis, the community's name first, so the account stays in the bar.

#### Scenario: New playlist for Sunday
- **WHEN** an operator presses New playlist, and the next service is on 11 October 2026
- **THEN** an untitled playlist is created and opened, its name in the bar "11 octombrie" for a Romanian interface, not being edited

#### Scenario: An old playlist
- **WHEN** an operator types "Crăciun", or "decembrie", in the menu's filter box
- **THEN** the playlists whose title has "Crăciun", or whose date is in December, are listed, however old

#### Scenario: Create a new song
- **WHEN** an editor chooses Create new song
- **THEN** the editor opens on a new song with the title field focused, and "Save and add to playlist" creates it and adds it to the current playlist; closing creates nothing

#### Scenario: The account at the right
- **WHEN** Ana, logged in with a photo, opens Classic on a phone
- **THEN** the menu button is at the left of the bar and her photo at the right end, and tapping the photo opens My account and the device type

#### Scenario: Renaming in the bar
- **WHEN** an operator clicks "October 4" in the bar, types "Botez" and presses Enter
- **THEN** the playlist shows as "Botez" with "October 4" muted after it, for everyone; had they pressed Escape, it would have stayed untitled

#### Scenario: The title on a phone
- **WHEN** a team member opens the playlist of 4 October in Classic on a phone
- **THEN** "Unu-Unu" shows small and centered above the bar, which holds ☰, "October 4" and their photo

#### Scenario: Renaming on a phone
- **WHEN** an operator on a phone taps "Botez" in the bar and chooses Rename
- **THEN** the title turns into a text field

### Requirement: Classic hints

Classic SHALL offer the team up to four hints as the page's tips in the What's new bubble (feature-switches spec), which counts them with what's new and lists them in its dialog, instead of showing them over the page; opening it marks them seen on the member's account: a double-click or Go live projects the selected entry; typing anywhere searches and Enter adds; Page Down or → goes next, Page Up or ← previous, and Esc blanks; and a projector's button opens it full screen on the second display. The tips are those whose control is on the page, and the one about going live SHALL wait until the playlist has an entry.

#### Scenario: First Sunday
- **WHEN** an operator opens Classic for the first time
- **THEN** the What's new bubble offers the page's tips, nothing covers the page, and once the bubble was opened they aren't offered again

#### Scenario: An empty playlist
- **WHEN** an operator who hasn't seen the hints opens a playlist without entries
- **THEN** the tips are about searching and the rest, and the one about going live waits for an entry

### Requirement: Classic song editor

The Classic editor SHALL have the old app's fields: title, key signature, time signature, lyrics and chords, and tags with suggestions, with Save and Close. Title and lyrics SHALL have one tab per community language and come first, the title at the top; the shared fields SHALL be shown once, after them. Under the lyrics a hint SHALL say what starts a new slide (a blank line) and how a part is named (a line like `R:` or `[Bridge]`). Close SHALL leave the editor without saving, after confirming when there are unsaved changes. Only editors and owners SHALL see the pencil and the editor.

#### Scenario: Fix a Ukrainian typo
- **WHEN** an editor opens a song in Classic, switches to the UK tab, fixes a word and saves
- **THEN** the Ukrainian version is saved and the Romanian one is unchanged

### Requirement: Projecting from Classic

For the team on a laptop, Classic SHALL offer a button for each projector screen of the room, named as the screen ("Projector RO"), or for each language, when no projector screen is set up ("Projector RO" too), which opens it full screen on the projector: on the display that isn't the laptop's, or the one chosen before on this laptop, where the browser lets pages choose (it asks once). Elsewhere, or until it's allowed, it SHALL open in a window that the operator moves to the projector. Where the browser can tell the laptop has no other display, the button SHALL instead say that no projector is attached, with "Open anyway", which opens that window at half the screen's width and height, in its middle; a projector's window already open SHALL come forward without asking. Pressing Project again SHALL bring that window forward instead of opening a second one, also after the controller's page reloads; and the live keys (Page Up and Down, arrows, Esc, Enter) pressed while the projector's window has the focus SHALL act as on the controller. Each projector SHALL show its language with its display settings (background, title, progress, key, next line, refrains in italics, the final mark). On touch devices, each projector's button SHALL show a preview of that projector in the page and hide it again.

#### Scenario: RO and UA projectors from one playlist
- **WHEN** an operator opens the Romanian and the Ukrainian projector with their Project buttons, and sends a song live
- **THEN** the Romanian window shows the Romanian slide and the Ukrainian window the Ukrainian one, without a second operator

#### Scenario: Preview on a tablet
- **WHEN** a team member taps "Projector RO" on a tablet
- **THEN** the projector's current slide is shown in the page, and a second tap hides it

#### Scenario: No projector attached
- **WHEN** an operator presses "Projector RO" on a laptop without a second display
- **THEN** Norless says no projector is attached instead of covering the laptop with a black window, and "Open anyway" opens the projector in a window of half the screen, in its middle

### Requirement: The live title on a phone

On a phone, while an entry is live, Classic's bottom bar SHALL show above Previous, Blank and Next the live entry's title and part in a line of fixed height, cut with an ellipsis when long, and that it's blanked while it is. Wider pages SHALL NOT show it, since the slides are beside the playlist.

#### Scenario: The title on a phone
- **WHEN** an operator on a phone sends "Har minunat" live
- **THEN** the bar shows "Har minunat · Verse 1" above Previous, Blank and Next

### Requirement: Empty playlist

While the open playlist is empty, Classic's right half SHALL NOT stay blank where the statistics feature is on: it SHALL list up to 8 songs sung often but not lately (the Statistics page's "Not played lately"), each added to the playlist with one tap or click. Without that feature, the playlist's empty message alone SHALL show.

#### Scenario: A new Sunday playlist
- **WHEN** an operator opens the new, empty playlist for Sunday, with statistics switched on
- **THEN** songs sung in many services but not in the last 6 months are listed beside it, and clicking one adds it
