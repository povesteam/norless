# live-control Specification

## Purpose
Keep one live state per room (what is projected right now) and let authorized people change it from the operator laptop, a phone or a tablet, so every screen and language stays in sync.

## Requirements

### Requirement: One live state per room

Each room SHALL have one live state: the live entry, the slide index, whether the output is blanked, the mode (service or rehearsal), who changed it last, from which device, and when. The system SHALL push every change to all devices and screens of the room within one second.

#### Scenario: Two languages stay in sync
- **WHEN** the operator shows slide 3 of a song
- **THEN** the Romanian and Ukrainian projector screens both show slide 3 of that song, each in its own language

#### Scenario: Screen on a device with another playlist open
- **WHEN** a laptop showing a projector screen has an older playlist open and the operator sends a song live from today's playlist
- **THEN** the laptop's screen shows the new song

### Requirement: Who can control

Members with the owner or team role SHALL be able to change the live state from any device. When two people act at nearly the same time, the last change SHALL win. Every controlling device SHALL show who made the last change. When the live state changes from another device, controlling devices and stage layouts SHALL briefly show who changed it and to what (e.g. "Ioana → Verse 2"), so the team can see who moved it and help someone who did it by mistake.

#### Scenario: Musician controls during a rehearsal
- **WHEN** nobody is at the laptop and a guitarist with the team role taps "next" on a phone
- **THEN** all screens advance to the next slide

#### Scenario: Viewer can't control
- **WHEN** a member without the team or owner role opens the app
- **THEN** the controls are not offered, and the server rejects any change they send

#### Scenario: Someone on stage moved the slide
- **WHEN** a vocalist taps verse 2 on her phone during the service
- **THEN** the operator's laptop shows "Ioana → Verse 2" for a few seconds, and her name stays as the last change

### Requirement: Send an entry live

A controller SHALL be able to send the selected entry live with Enter or a double-click, and to send a specific slide or part live by clicking or tapping it. A song SHALL start at its first slide. A divider without planned minutes SHALL NOT go live. A divider with planned minutes, such as the sermon, SHALL go live as a timed pause: projectors show only their background, and stage monitors count down its minutes. A deleted song SHALL NOT go live.

#### Scenario: Click a slide
- **WHEN** the operator clicks slide 4 in the slide list of the selected song
- **THEN** that song goes live at slide 4

#### Scenario: Enter on a divider
- **WHEN** the selected entry is a divider without planned minutes and the operator presses Enter
- **THEN** the live state doesn't change

#### Scenario: The sermon goes live
- **WHEN** the operator presses next after the last song before the divider "Predica" with 45 planned minutes
- **THEN** the projectors show only their background, and the stage monitor counts down from 45:00

### Requirement: Next and previous

PageDown, the Right arrow and a "next" button SHALL move to the next slide. PageUp, the Left arrow and a "previous" button SHALL move to the previous slide. After the last slide of an entry, next SHALL move to the first slide of the next entry that can go live, skipping dividers without planned minutes. Before the first slide, previous SHALL move to the last slide of the previous entry that can go live. At the end or start of the playlist, the live state SHALL stay where it is.

#### Scenario: Presenter clicker
- **WHEN** a presenter clicker sends PageDown
- **THEN** the next slide goes live

#### Scenario: Skip a divider
- **WHEN** the last slide of a song is live, the next entry is a divider, and the one after it is a song
- **THEN** next shows the first slide of that song

#### Scenario: End of playlist
- **WHEN** the last slide of the last entry is live and the operator presses next
- **THEN** the same slide stays live and the screens don't go blank

### Requirement: Part buttons

Controllers SHALL see one button per part of the live song, in the song's order. A named part SHALL be labeled with its short name (I, R, B, E…); each unnamed slide SHALL be its own part, labeled with its number among the song's verses (1, 2, 3…). A repeated part SHALL have a button for each place it's sung. Clicking or tapping a button SHALL send that place's first slide live. The live part SHALL be marked.

#### Scenario: The leader sings the refrain once more
- **WHEN** the last refrain is live and the leader starts it again
- **THEN** the operator taps R and the refrain's first slide goes live

#### Scenario: Song without part names
- **WHEN** a song has four unnamed slides
- **THEN** its part buttons are 1, 2, 3 and 4

### Requirement: Blank and resume

Esc or a "blank" button SHALL blank all screens of the room without losing the live position. Esc SHALL only close the search results when the search box is focused. Next, previous or sending an entry live SHALL end the blank state.

#### Scenario: Blank during prayer
- **WHEN** slide 2 of a song is live and the operator presses Esc
- **THEN** all screens go blank
- **AND** pressing next shows slide 3

### Requirement: Keyboard shortcuts work while editing

PageUp and PageDown SHALL control the live state even while the song editor has focus.

#### Scenario: Fix a typo during the service
- **WHEN** the operator is typing in the song editor and presses PageDown
- **THEN** the next slide goes live and the editor keeps its content

### Requirement: Mode

The live state SHALL have a mode: service or rehearsal. The mode SHALL be set from the community's schedule as defined in `service-schedule`. The mode SHALL be shown on every controlling device as a status, not a switch: nobody SHALL change it by hand, since the switch was confusing. An unplanned service is added as a one-off event in the schedule.

#### Scenario: Scheduled rehearsal
- **WHEN** a musician sends a song live during the scheduled Thursday rehearsal
- **THEN** the mode is rehearsal without asking

### Requirement: Local projection without login

Anyone, logged in or not, SHALL be able to project locally: pick songs or a playlist, open a projector screen in the same browser (another window or tab), and control it from the page. Started from a playlist whose entry is live in the room, the projector SHALL start on that entry and slide, blank if the room is blank; otherwise with nothing live. Started from a playlist whose entry is live in the room, the projector SHALL start on that entry and slide, blank if the room is blank; otherwise with nothing live. Local projection SHALL NOT change any room's live state, and SHALL NOT record plays. "Project here", and while projecting "Projector window" and "Stop projecting", SHALL sit in the live bar at the bottom of the page; a playlist or song page SHALL show a bar with "Project here" to people who have no live bar there. When the projector window is closed, projecting SHALL stop as with "Stop projecting", and the page SHALL say that the window was closed. On a phone, the projector SHALL fill the same page, full screen and without the browser's bar, instead of opening a window: a tap on its right half SHALL go to the next slide, a tap on its left half to the previous one, and Back SHALL return to the page, still projecting.

#### Scenario: Guest at a home group
- **WHEN** a visitor without an account opens Norless on a laptop connected to a TV, searches a song and opens a local projector screen
- **THEN** the TV shows the song, and the church's screens don't change

#### Scenario: Tablet on its own
- **WHEN** someone projects locally from a tablet
- **THEN** the tablet page controls a projector window opened from that tablet's browser

#### Scenario: The projector window closed by mistake
- **WHEN** someone projecting locally closes the projector window
- **THEN** the page stops projecting, shows "Project here" again, and says the projector window was closed

#### Scenario: Phone mirrored to a TV
- **WHEN** someone with a phone mirrored to a TV taps "Project here" on a playlist and taps the right half of the screen
- **THEN** the phone shows the projector full screen, without the browser's bar, and goes to the next slide
- **AND** Back returns to the playlist, still projecting

#### Scenario: Projecting what is live
- **WHEN** verse 2 of the church's live song is on the screens, and a team member presses Project here on that playlist
- **THEN** the projector of their device starts on verse 2, and the church's screens don't change

### Requirement: Laptop layouts

On a laptop, a controller SHALL be able to choose among these layouts, as described in `app-shell` (Layouts):
- **Controller** (the default): the playlist on the left with a time per entry; the live song's parts in the middle, each part in full, with the languages side by side; on the right, a preview of the projector, next, previous, blank and the pages
- **Running order**: the whole playlist in one scroll, every song with its parts, entries already done collapsed into one line, and the same controls on the right
- **Big now and next**: a large preview of what the projector shows, the next part, all parts of the live song in a strip, and large next, previous and blank buttons
- **Big screen**: for monitors of Full HD and larger, described in Big screen; the default on a window at least 1900 CSS pixels wide when the member hasn't picked a layout

On a window at least 1024 pixels wide, Controller, Running order and Big now and next SHALL fill the window like an app, as Classic does: the window SHALL NOT scroll, each column SHALL scroll on its own, and the title row, the search box and the controls SHALL stay in view; in Big now and next the controls stay above the playlist, which scrolls under them. When a controller edits a song from a laptop layout, the editor SHALL open in the middle column, while the projector preview and the controls stay visible.

#### Scenario: Default layout on the church laptop
- **WHEN** an operator opens a playlist on a laptop with a 1440 × 900 window for the first time
- **THEN** the Controller layout is shown

#### Scenario: Default layout on a big monitor
- **WHEN** an operator opens a playlist for the first time in a 1920 × 1080 browser window
- **THEN** the Big screen layout is shown

#### Scenario: Edit during the service
- **WHEN** the operator opens the refrain of the live song in the editor from the Controller layout
- **THEN** the editor replaces the parts list in the middle, and the preview, next and blank stay visible on the right

#### Scenario: A long running order
- **WHEN** an operator scrolls a running order longer than the window in the Running order layout
- **THEN** only the running order scrolls, and the previews, next, previous and blank stay where they are

### Requirement: Phone and tablet controls

On a tablet, a controller SHALL see the playlist on the left and, in a column on the right, the live panel with large next, previous and blank buttons, which stays in view while the column scrolls, and under it the selected entry's parts as large cards that go live when tapped (the panel at the bottom hid the whole playlist); the panel's Pages, message to the stage and This device sit under the parts, so the parts start on the first screen. On a phone, a controller SHALL see three views, Order, Song and Screens, with a swipe between them, and a bar with previous, next and blank that stays at the bottom of every view. On a phone, the bar SHALL be compact by default: the live entry's title and Previous, Blank and Next; a button SHALL expand it to the parts, the other controls, Pages and the message to the stage, and collapse it again, and the phone SHALL remember which. In the compact bar, someone else's change SHALL show in place of the title for a few seconds. In the phone, tablet and Operator layouts, a tap on an entry SHALL select it and show its parts without sending it live (on a phone, the Song view comes into view), and a Go live button above the parts SHALL send it live.

#### Scenario: One-handed control
- **WHEN** a guitarist opens the app on a phone clipped to a stand
- **THEN** next and previous are reachable as large buttons without scrolling

#### Scenario: The playlist beside the controls
- **WHEN** an operator opens today's playlist in the Tablet layout on a tablet
- **THEN** the playlist's entries and the live panel show side by side, without scrolling

#### Scenario: The slides on the first screen
- **WHEN** an operator opens today's playlist in the Tablet layout on a tablet of 1024 by 768 pixels and a song is live
- **THEN** the live song's first parts show without scrolling, beside the playlist

#### Scenario: Tablet on the music stand
- **WHEN** an operator taps the bridge card on a tablet
- **THEN** the bridge goes live

#### Scenario: The playlist stays visible
- **WHEN** an operator opens today's playlist in the Phone layout on a phone
- **THEN** the live bar shows only the title and Previous, Blank and Next, and the playlist fills the rest of the screen
- **AND** after they expand the bar and reload the page, it is still expanded

#### Scenario: Checking the next song on a phone
- **WHEN** an operator taps the next song in the Order view on a phone
- **THEN** the Song view shows its parts, the screens don't change, and Go live sends it

### Requirement: Times and end estimate

Norless SHALL estimate when each playlist entry starts: when it went live for entries already shown, and an estimated start for the others; the rows SHALL NOT show these times. A song SHALL be estimated with the median length of its last 10 service plays. For imported plays, which have no end, a play's length SHALL be the time until the next play on the same day, at most 12 minutes. A song without service plays SHALL be estimated from the community's average singing speed, measured over songs with plays, applied to its sung text, counting repeats by name and repeat marks. Dividers and text slides SHALL count their planned minutes, which their rows show. Other entries SHALL count no time. Controllers SHALL see the estimated end of the playlist and how many minutes it leaves before, or runs past, the end of the scheduled event. When any song is estimated from the average speed, the end SHALL be marked as approximate.

#### Scenario: Sermon in the plan
- **WHEN** the divider "Predica" has 45 planned minutes and the songs after it have a usual length of 5 minutes each
- **THEN** the estimated end includes the 45 minutes, and the divider's row shows "45 min" without a clock

#### Scenario: Length from imported plays
- **WHEN** an imported play of a song started at 10:21 and the next imported play that day started at 10:27
- **THEN** that play counts as 6 minutes toward the song's usual length

#### Scenario: New song
- **WHEN** a song has never been sung in a service
- **THEN** its length is estimated from its text and the community's singing speed, and the end time is marked as approximate

#### Scenario: Running late
- **WHEN** the estimated end is 12:10 and the scheduled service ends at 12:00
- **THEN** controllers see that the playlist runs 10 minutes past the end

### Requirement: Problems during a service

Controlling devices SHALL show an indicator only while there is a problem, in the playlist's title row, and SHALL list the problems when it's opened, over the page so nothing moves. The indicator SHALL be in the warning color, and in the danger color only while a usual screen isn't connected, since then something isn't projected. A problem SHALL be:
- a screen that is usually connected and isn't: one that was connected during at least 3 of the room's last 4 services, checked in service mode
- a song in the playlist without a version in a language that one of the room's audience screens (projectors and broadcast overlays, connected or not) shows, when it has a version in another of their languages; stage monitors and vocalists screens don't count, since the team reads them (a song in none of them, like an English-only song, shows its first version on every screen alike)
- a slide of a song in the playlist whose text shrinks, to fit a screen, below 70% of the size a four-line slide gets on that screen
- a song in the playlist without a key, when the room has musicians screens

The playlist SHALL mark each affected entry, and the editor SHALL mark each affected slide.

#### Scenario: Everything is fine
- **WHEN** every usual screen is connected and no song in the playlist has a problem
- **THEN** no indicator is shown

#### Scenario: Stage monitor unplugged
- **WHEN** the stage monitor, connected in each of the last 4 services, is not connected during the service
- **THEN** controllers see an indicator in the danger color saying the stage monitor is not connected

#### Scenario: Too much text on a slide
- **WHEN** a slide of eleven lines would be shown at 60% of a four-line slide's size on the projector
- **THEN** the entry and the slide are marked as too small to read

#### Scenario: English on the stage only
- **WHEN** the projectors show Romanian, the stage monitor English, and a Romanian song has no English version
- **THEN** no problem is shown for it

#### Scenario: An English-only song
- **WHEN** "Mighty to save", with only an English version, is in the playlist and the screens show Romanian and Ukrainian
- **THEN** no problem is shown for it, and both screens show it in English

### Requirement: Commands in the search box

Besides songs and Bible references, the search box SHALL run commands on the room's live state: blank, next, previous, a part of the live song by name or number (e.g. "refrain", "verse 2", "bridge"), a page by name, and opening a screen by name. Enter SHALL run the selected command.

#### Scenario: Jump to the bridge by typing
- **WHEN** the operator types "bridge" in the search box and presses Enter
- **THEN** the bridge of the live song goes live

### Requirement: Start and end pages

Owners SHALL be able to manage a list of pages in the community settings: add, rename, change the URL, reorder and remove, e.g. a pre-service start page and an announcements end page. Only `https` URLs SHALL be accepted. When a page can't be shown inside another page because its site forbids embedding, the settings SHALL warn when it's saved. Controllers SHALL see one small Pages button, since pages are used now and then; it SHALL open a menu of the pages, and choosing one SHALL project it. The projected page SHALL be shown full screen on the room's projector screens. While a page is projected, the button SHALL show the page's name, highlighted, until something else goes live, and SHALL open the same menu, with that page marked, so another page can be chosen, and with "Take … off the screens", which clears the page. Blank (Esc) SHALL take the page down too, and Show again SHALL then return to the live entry.

#### Scenario: Before the service
- **WHEN** the operator chooses the "start" page in the Pages menu 10 minutes before the service
- **THEN** the projector shows that page and the button shows "start", highlighted
- **AND** when the first song goes live, the button shows "Pages" again

#### Scenario: From one page to another
- **WHEN** the "start" page is projected and the operator chooses "Final" from the button's menu
- **THEN** the projector shows the "Final" page, and the button shows "Final"

#### Scenario: Take the page off
- **WHEN** the "Final" page is projected and the operator chooses "Take “Final” off the screens" from the button's menu
- **THEN** the page goes off the screens and the button shows "Pages" again

#### Scenario: Esc during the start page
- **WHEN** the start page is projected and the operator presses Esc
- **THEN** the projectors go blank and the button shows "Pages" again

#### Scenario: Change the announcements page
- **WHEN** the owner changes the end page's URL in the settings
- **THEN** the end page in the Pages menu projects the new page from then on

#### Scenario: Site that forbids embedding
- **WHEN** the owner saves a page whose site forbids embedding
- **THEN** the settings warn that the page will show up empty on the projector

### Requirement: Media keys

A controller SHALL be able to switch on media keys on a device, from the live bar, while its feature (`mediaKeys`) is switched on; the device SHALL remember the switch. While they're on, the next-track and previous-track keys SHALL go to the next and previous slide, and play/pause SHALL blank and show again, like Esc; this SHALL also work while another window has the focus, from a Bluetooth remote's buttons, and from a phone's lock screen, which SHALL show the live song's title and part. Projecting locally, they SHALL move this device's own projector.

#### Scenario: Another window has the focus
- **WHEN** the operator has media keys on and is typing announcements in another app, and presses the next-track key
- **THEN** the projectors go to the next slide

#### Scenario: Play/pause
- **WHEN** a song is live and the operator presses play/pause, then play/pause again
- **THEN** the projectors go blank, then show the song again

#### Scenario: Switched off
- **WHEN** media keys are off on the laptop and the operator presses the next-track key
- **THEN** nothing changes on the projectors, and the key goes to whatever else plays

### Requirement: Moves show at once

On the device that controls live, Next, Previous, choosing a part or slide of the live entry, and Blank SHALL show at once, before the server answers; when the room's state comes back it SHALL replace the device's own, and when the server refuses or doesn't answer, the device SHALL show the room's state again. Next and Previous SHALL go from the slide the device showed when they were pressed, so presses on two devices at the same moment move the screens once. Screens and other devices SHALL show only the room's state.

#### Scenario: A slow network
- **WHEN** an operator presses Next on verse 1 over a slow Wi-Fi
- **THEN** her device shows the refrain live at once, and the projectors follow when the server has it

#### Scenario: Two operators at once
- **WHEN** two operators press Next on verse 1 at the same moment
- **THEN** the screens show the refrain, not verse 2

#### Scenario: Refused
- **WHEN** the server refuses an operator's Next
- **THEN** her device shows again the part the room shows

### Requirement: Practice rooms

A team member SHALL be able to start a practice room from the live bar, with a playlist and whether it counts as a rehearsal (by default) or a service. A practice room SHALL have its own live state, stage messages and tempo check, and SHALL NOT change what the main room's screens show. Team members SHALL see the practice rooms running and join one; a room's link and QR code SHALL let screens and guests follow it. A device SHALL remember the room it follows, and every live view on it SHALL show that room. Its starter or an owner SHALL be able to switch it between rehearsal and service, and end it; it SHALL end by itself after 4 hours without a live change, and its devices SHALL go back to the main room.

#### Scenario: Band practice during the service
- **WHEN** a guitarist starts a practice room with Sunday's playlist and sends its first song live
- **THEN** the band's tablets that joined it show the song, and the main projectors keep showing the service

#### Scenario: A children's meeting
- **WHEN** a teacher starts a practice room, switches it to service, and her laptop's projector follows it
- **THEN** the children's songs count as service plays, marked with the room

#### Scenario: Forgotten
- **WHEN** a practice room has had no live change for 4 hours
- **THEN** it ends, and the devices that followed it show the main room

### Requirement: Playlist title row

While the app frame is on, a playlist's title SHALL be in the community bar (`app-shell` spec), and the row above the search box SHALL hold, for controllers, the problems indicator and the estimated end, for members, who is online, and the layout, chosen from a menu that names the current one, so the entries start near the top of the page. On a phone the row SHALL fit one line: the problems as their count, the layout as its icon, and no link to all playlists, which the menu has; Add text slide SHALL be an icon beside the search box. In the Classic layout the layout menu SHALL sit in that row, above the playlist's column, not in a row of its own. The playlist's menu (the title's on a phone, ⋯ on a laptop) SHALL end with the 5 newest other playlists and All playlists, to go to another one.

#### Scenario: One row
- **WHEN** an operator opens a playlist with problems in the Controller layout on a laptop
- **THEN** "9 problems", the estimated end, who is online and "Controller" share one row above the search box, and the title is in the bar

### Requirement: This device

The live panel SHALL keep what concerns only this device or the room's setup in a "This device" section: media keys, the service or rehearsal status, the practice room, recording and listening for the tempo, so the parts, Previous, Blank and Next, the pages and the message to the stage come first. The section SHALL be folded until opened, and each device SHALL remember whether it's open. Folded, it SHALL still say when this device records or listens for the tempo, and recording and listening SHALL go on while it's folded.

#### Scenario: Folded by default
- **WHEN** an operator opens a playlist in the Controller layout for the first time on a laptop
- **THEN** the live panel shows the parts and Previous, Blank and Next, and "This device" folded

#### Scenario: Recording while folded
- **WHEN** a team member starts recording from This device and folds it
- **THEN** the section says "Recording", and the recording goes on

### Requirement: Slides live

Each page of a slides entry SHALL be a slide: Next, Previous, their keys, media keys and clickers SHALL move through the pages and then to the next or previous entry, as for songs. The controller layouts (laptop, tablet and phone) SHALL show the pages as thumbnails where a song shows its parts, and a click or tap on one SHALL send that page live. When a language's file has fewer pages than the main file, its screens SHALL show its last page for the pages it doesn't have.

A slides entry MAY have a timer, off by default: the next page every few seconds (8 by default, from 3 to 120), looping from the last page to the first. The server SHALL move the pages, so every screen follows without the controller's device. Any live action (next, previous, a page, blank, another entry) SHALL stop the timer until it's started again from the entry.

#### Scenario: Clicker through the announcements
- **WHEN** the announcements' page 3 of 12 is live and the operator presses the clicker's next
- **THEN** page 4 goes live, and after page 12 next goes to the next entry

#### Scenario: Looping before the service
- **WHEN** an operator starts the timer at 8 seconds on the announcements and closes the laptop's lid
- **THEN** the projectors show the next page every 8 seconds and start again after the last one

#### Scenario: The timer stops
- **WHEN** the announcements loop and the operator sends the first song live
- **THEN** the timer stops, and going back to the announcements doesn't start it again

### Requirement: Big screen

The Big screen layout SHALL show, at the app's usual text size: the playlist with times; the live song's parts with next, previous, blank and the pages; a live preview of every screen of the room (projectors, overlays, the stage monitor), each drawn with its own settings and layout; a tile per musician's or vocalist's device that's open now, drawing what that device shows with its layout, languages, text size and instrument, labeled with the person, the layout and the device; and a room column with the clock, the mode, the end estimate, the problems, each after its song's title, and who's here.

It SHALL add panels as the window widens, measured in CSS pixels: from 1900, people's tiles under the screens' previews; from 2500, people's tiles in their own column and larger previews; from 3800, previews two per row, each about twice its Full HD width or more, a column with the next song's whole text, and the app's text at 125%. People's tiles SHALL be at least 13rem wide, wrapping to more rows as devices join. Under 1900 the Controller layout SHALL show instead, and the layout picker SHALL offer Big screen only on a window that wide.

A click on a preview or tile SHALL open it larger in a dialog, from which a screen's settings or the message to the stage are one tap away. No preview or tile SHALL change what's live. A device with a musicians or vocalists view open SHALL report its view and the settings that change its drawing to the members' presence. It SHALL be the feature `bigScreen`, which needs `layouts`; people's tiles SHALL show only while `stageViews` is on.

#### Scenario: A wrong layout caught before the song
- **WHEN** a guitarist opens the musicians view in Bar grid on a phone while the operator uses Big screen
- **THEN** the operator sees a tile "Mihai · Bar grid · Phone" showing the bar grid of the live song

#### Scenario: The stage monitor at a glance
- **WHEN** the operator sends a message "5 more minutes" to the stage
- **THEN** the stage monitor's preview on the Big screen shows the message above the song

#### Scenario: QHD shows more
- **WHEN** the operator widens the browser window from 1920 to 2560 CSS pixels
- **THEN** people's tiles move into a column of their own and the screens' previews grow, and the text stays the same size

#### Scenario: 4K at 150% scaling
- **WHEN** an operator's 4K monitor is scaled to 150%, so the browser window is 2560 CSS pixels wide
- **THEN** the layout shows the QHD arrangement

#### Scenario: Looking closer
- **WHEN** the operator clicks the Ukrainian projector's preview
- **THEN** a dialog shows it larger with a link to that screen's settings, and the live slide doesn't change

### Requirement: Welcome page

While its feature (`welcome`) is on, the Pages menu SHALL offer a built-in Welcome page first, which projectors (local projection too) SHALL show full screen in their colors and font: the community's logo and name, the time left until the next service or rehearsal of the schedule, and the announcements the owners wrote, one after another every few seconds. The countdown SHALL hide once the event starts; the rest SHALL stay until something goes live, as for other pages. The broadcast overlay, the stage monitor and follow-along phones SHALL NOT show it.

#### Scenario: Before the service
- **WHEN** the operator picks Welcome in the Pages menu 20 minutes before "Sunday service"
- **THEN** the projectors show the community's name, "Sunday service starts in 20:00" counting down, and the announcements in turn

#### Scenario: The service starts
- **WHEN** the countdown reaches zero and nothing has gone live yet
- **THEN** the countdown goes, and the name and announcements stay until the first song goes live

### Requirement: Who controls live

Beside the Live mark of the entry that's live, members SHALL see the avatar of the person who changed what's live last, with their name in a styled tooltip ("Ioana controls what's live"). Visitors SHALL NOT see it.

#### Scenario: Two operators
- **WHEN** Ioana sends the next part live from her phone, and Andrei looks at the playlist
- **THEN** Andrei sees Ioana's avatar beside Live
