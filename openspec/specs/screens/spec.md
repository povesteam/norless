# screens Specification

## Purpose
Show what is live on projectors, musicians' and singers' devices and stage monitors, each in its own language and layout, following the room's live state and surviving network hiccups.

## Requirements

### Requirement: Screens and their URLs

The community SHALL be able to define screens per room. Each screen SHALL have a name, a type (projector, musicians, vocalists, stage monitor, broadcast overlay), one or two languages, a layout where its type has several, and display settings. Each screen SHALL have its own URL. It SHALL open in any browser without logging in and SHALL show only live content. The URL SHALL contain a secret that can be regenerated to revoke access.

#### Scenario: Projector laptop without a login
- **WHEN** the Ukrainian projector laptop opens the Ukrainian projector screen URL
- **THEN** it shows the live content in Ukrainian without asking for a login

#### Scenario: Revoke a leaked screen link
- **WHEN** the owner regenerates a screen's secret
- **THEN** the old URL stops showing content

### Requirement: Pair a device as a screen

A device that opens the pairing page SHALL show a short code, which changes every 5 minutes, and the same code as a QR code. A member who can control live SHALL be able to type or scan that code and choose one of the room's screens. The device SHALL then show that screen, and SHALL keep showing it after a restart until it's unpaired. Members who can control live SHALL see the paired devices of each screen and be able to unpair them.

#### Scenario: New stage TV
- **WHEN** a TV box opens the pairing page and the operator types its code on a phone and picks "Stage monitor"
- **THEN** the TV shows the stage monitor
- **AND** after a power cut, it shows the stage monitor again without anyone touching it

#### Scenario: Move the TV to another room
- **WHEN** a musician unpairs the TV box from the stage monitor
- **THEN** the TV box shows the pairing page with a new code

### Requirement: Projector layout

A projector screen SHALL show:
- the slide text in its language, fitted to the largest font size that fits the screen
- song lines that don't wrap: the font shrinks instead
- Bible text that wraps
- a header line with the progress ("#3/7"), the key and the song title in the screen's language
- the first line of the next slide at the bottom, dimmed

Refrains SHALL be shown in italics. The last slide SHALL show the final mark. Chords SHALL NOT be shown. A slide that has to shrink below 70% of the size a four-line slide gets on the screen SHALL be reported as described in `live-control` (Problems during a service).

#### Scenario: Title in the screen's language
- **WHEN** a song's Ukrainian title is "Слава" and the Ukrainian projector shows it
- **THEN** the header shows "Слава", not the Romanian title

#### Scenario: Long line
- **WHEN** a slide has a line too long for the screen at the current font size
- **THEN** the whole slide is shown in a smaller font, and the line stays on one row

### Requirement: Two languages on one screen

A projector screen with two languages SHALL show both versions of the current slide at once, each fitted to its half. The owner SHALL choose, per screen, whether the halves are top and bottom (the default) or left and right, and which language comes first. A song missing one of the two versions SHALL use the whole screen for the version it has.

#### Scenario: Ukrainian and English together
- **WHEN** a projector screen is set to Ukrainian and English and a song with both versions goes live
- **THEN** the Ukrainian slide is shown on the top half and the English slide on the bottom half

#### Scenario: Side by side
- **WHEN** the owner sets that screen to left and right
- **THEN** Ukrainian is shown on the left half and English on the right half

#### Scenario: One version missing
- **WHEN** the same song has no English version
- **THEN** the Ukrainian slide fills the whole screen

### Requirement: Text slides and Bible references on screens

A live text slide SHALL be shown as rendered Markdown. A live Bible reference entry SHALL show the reference as a title on projector screens and stage monitors, without verse text in v1.

#### Scenario: Bible reference on the projector
- **WHEN** the entry "Ioan 3:16-18" goes live
- **THEN** the projector screen shows "Ioan 3:16-18" and no verse text

### Requirement: Display settings

Each screen SHALL have settings for background color, background image, image opacity, text color, font, style per section type, and whether a clock is shown.

#### Scenario: Background image
- **WHEN** the owner sets a background image at 40% opacity on the projector screen
- **THEN** the image is shown behind the text, darkened so the text stays readable

### Requirement: Broadcast overlay

A broadcast overlay screen SHALL show the current slide as a lower third: at most two lines at a time at the bottom, inside title-safe margins, in the screen's language. Its background SHALL be one of: transparent (for a browser source in streaming software such as OBS), chroma green, or black (for keying in a video mixer). Text SHALL have an outline or shadow that stays readable over any video. Blank SHALL show only the background.

#### Scenario: OBS browser source
- **WHEN** the streaming computer adds the overlay screen's URL as an OBS browser source with a transparent background
- **THEN** the lyrics appear over the camera image without chroma keying

#### Scenario: Hardware mixer
- **WHEN** the overlay screen uses the chroma green background and feeds a video mixer
- **THEN** the mixer can key out the green and keep the outlined text

### Requirement: Parts on stage screens

Musicians, vocalists and stage monitor screens SHALL show the song as parts: each named section is a part, and each unnamed slide is its own part, numbered among the song's verses. Each part SHALL be shown whole, as one block, with its notes (`!` lines). Musicians and vocalists screens SHALL be dark by default, and a member SHALL be able to switch them to light per device type. The live part SHALL be framed in the live color (`app-shell` spec), and the next part SHALL have no mark of its own, so the eye stays on the live part in dark or light.

#### Scenario: Unnamed verses
- **WHEN** a song has a refrain named `R` and three unnamed verse slides
- **THEN** the vocalists layout shows the parts as 1, R, 2, R, 3, R in the song's order

### Requirement: Musicians layouts

A musicians screen, or a member opening the musicians view on their own device, SHALL be able to use these layouts, as described in `app-shell` (Layouts):
- **Bar grid** (the default): the whole song as rows of bars, one row per part in the song's order, the live part highlighted. A part whose chord lines have bar lines SHALL show one box per bar; a part without them SHALL show one box per chord. A part's boxes SHALL sit on one line when they fit; else a row per chord line when the longest fits, else 2, 3 or 4 rows of equal length; their columns SHALL line up, so bars align from row to row. The chords of a bar SHALL share its box by their beats, equally until the Chords mode sets them.
- **Chords over words**: the live part with chords above the lyrics, and the next part as chords only

Both SHALL show the key and the time signature. A song without chords SHALL show its parts' lyrics, the key and the structure instead, and SHALL invite members who may add chords to add them. For members who can control live, both SHALL keep previous and next visible, and a tap on a part SHALL send it live.

#### Scenario: Guitarist sees chords
- **WHEN** a song with chord lines is live
- **THEN** the musicians view shows the chords, and the projector doesn't

#### Scenario: Song without bar lines
- **WHEN** a song's chord lines have no bar lines
- **THEN** the bar grid shows one box per chord in each part

#### Scenario: Eight bars on a phone
- **WHEN** a part of eight bars doesn't fit one line on a phone
- **THEN** its bars show in equal rows whose boxes line up in columns

#### Scenario: Three beats and one
- **WHEN** the Chords mode gave C three beats and G one in a bar of four
- **THEN** C takes three quarters of the bar's box and G one

### Requirement: Vocalists layouts

A vocalists screen, or a member opening the vocalists view on their own device, SHALL be able to use these layouts:
- **Whole song**: every part in the song's order, scrolling by itself to keep the live part in view, and a map of the parts along the edge
- **Sideways**: for a phone on a microphone stand, the live part on the left and the whole next part on the right; held upright, the next part under the live part
- **Tablet**: every part in two columns, in one or both languages, and the next song's title and first line at the bottom

The text SHALL be in the member's language by default, with one button showing the shown language's flag, or a globe for all of them, that opens the choice of each of the community's languages or all. Lines too long for the width SHALL wrap, never be cut off. In Whole song the live part SHALL be larger than the others only as far as its longest line still fits the width, so enlarging never wraps a line. For members who can control live, every layout SHALL keep previous and next visible, and a tap on a part SHALL send it live. A tap that starts a scroll SHALL NOT count. A swipe to the left or right SHALL go to the next or previous part in Sideways and song in Whole song, and a tap or a drag over Whole song's map of the parts SHALL go to the part under the finger: live for members who can control it, and otherwise on their own device only (Sideways back to live when the live part moves, Whole song as looking ahead).

#### Scenario: The laptop falls behind
- **WHEN** the band starts verse 2 and the projector still shows the refrain
- **THEN** a vocalist sees all of verse 2 as the next part, and can tap it to send it live

#### Scenario: Scrolling doesn't send a part live
- **WHEN** a vocalist drags the whole-song layout to read ahead
- **THEN** nothing goes live

#### Scenario: A long line on a phone
- **WHEN** the live refrain has a line longer than the phone is wide
- **THEN** the line continues on the next row, and nothing is cut off

### Requirement: Stage monitor

A stage monitor SHALL show what the singers and musicians need but the audience doesn't: the current part, the next part, the section type (verse, refrain, bridge…), the key, the live entry's title or Bible reference, the title of the next song in the playlist, and a clock. While a divider or text slide with planned minutes is live, the stage monitor SHALL show a large countdown of the minutes left, with the clock and the current message. On a screen taller than wide, such as a phone held upright, the next part SHALL be under the live part instead of beside it.

Besides stage screens with secret URLs, `/<community>/stage` SHALL open a stage monitor in the community's languages on any device, e.g. a TV's browser, linked as Stage monitor next to Musicians and Vocalists while the stage views are on; the Screens menu (a screen on a chosen display, pairing a TV) SHALL show with its own feature (`screenMenu`).

#### Scenario: Singers see what's coming
- **WHEN** the last slide of a song is live
- **THEN** the stage monitor shows the title of the next song in the playlist

#### Scenario: Preacher sees the reference
- **WHEN** a Bible reference entry "Ioan 3:16-18" is live
- **THEN** the stage monitor shows "Ioan 3:16-18"

#### Scenario: Sermon countdown
- **WHEN** the divider "Predica" with 45 planned minutes went live 24 minutes ago
- **THEN** the stage monitor shows "21:00" left in large digits

#### Scenario: Phone held upright
- **WHEN** the stage monitor is open on a phone held upright
- **THEN** the next part is under the live part, as wide as the screen

### Requirement: Open on a chosen display

In browsers that support choosing a display (Chromium: Chrome, Edge), the operator SHALL be able to open a screen fullscreen on a chosen display (second, third…) with one click, after granting the browser permission once. The choice SHALL be remembered per device and screen. In other browsers, the screen SHALL open in a new window that the operator moves to the display and switches to fullscreen.

#### Scenario: Projector on the second display
- **WHEN** the operator's laptop has a projector as its second display and they click "open on display 2" for the Romanian projector screen
- **THEN** the screen opens fullscreen on the projector
- **AND** next Sunday, the same click uses the same display

#### Scenario: Firefox
- **WHEN** the operator uses a browser without display selection
- **THEN** the screen opens in a new window with a fullscreen button

### Requirement: Message to the stage

A controller SHALL be able to send a short message to the stage, a short text, e.g. "refrain once more" or "5 minutes", typed in the box beside the live controls; there are no presets. It SHALL show on the stage monitors, and in the musicians and vocalists views, on their devices and screens, on its own line above the song, which moves down under it rather than being covered. The message SHALL stay visible until the controller clears it, and it SHALL NOT appear on projector screens or the broadcast overlay.

#### Scenario: Repeat the refrain
- **WHEN** the operator sends "refrain once more" to the stage
- **THEN** the stage monitors and the musicians' tablets show the message, and the projector doesn't

#### Scenario: Time for the preacher
- **WHEN** the operator types "5 minutes" and Enter during the sermon
- **THEN** the stage monitor shows "5 minutes" next to the countdown

#### Scenario: The message doesn't cover the song
- **WHEN** the operator sends "5 minutes" while a musicians screen shows "Amazing Grace"
- **THEN** the message shows above the song's title, key and time, which stay readable under it

### Requirement: Fullscreen

A screen and the stage monitor SHALL offer a fullscreen button, an icon with its name in a tooltip, shown for 3 seconds after opening and after any touch or pointer movement, where the browser can go full screen and isn't already; screens SHALL hide the mouse pointer after 3 seconds without movement. On phones, the browser's bars (status bar, address bar) SHALL take the background color of the stage monitor, musicians, vocalists and screen views while they show.

#### Scenario: Projector setup
- **WHEN** the operator drags the screen window to the projector and clicks fullscreen
- **THEN** the screen fills the projector with no browser UI and no pointer

#### Scenario: Stage monitor on a phone
- **WHEN** a singer opens the stage monitor on a phone
- **THEN** the phone's status and address bars are black like the monitor
- **AND** a tap on Full screen hides them and the navigation bar

### Requirement: Resilience

A screen SHALL reconnect automatically after losing the network, and SHALL keep showing the last content until it reconnects. After reconnecting, it SHALL show the current live state within one second.

#### Scenario: Wi-Fi drops for 20 seconds
- **WHEN** the projector laptop loses Wi-Fi for 20 seconds during a song
- **THEN** the current slide stays on screen
- **AND** once the connection is back, the screen catches up to the current slide

### Requirement: Preview for the operator

The operator's main view SHALL show a small preview of what each language's projector shows.

#### Scenario: Check the Ukrainian slide
- **WHEN** the operator sends a song live
- **THEN** the operator sees a preview of the Romanian and Ukrainian projector content

### Requirement: Look ahead

On a member's own device, the musicians and vocalists views SHALL offer Earlier song and Later song (except the vocalists' Sideways layout, which keeps its room for the part), which show the live playlist's songs before and after the one shown, on that device only, without changing what's live. While another song is shown, the view SHALL say which, and offer Back to live; when the live song changes, the view SHALL go back to live by itself. A part of a song looked at SHALL NOT go live when tapped. Screens SHALL always show the live song.

#### Scenario: Reading the next song during the sermon
- **WHEN** a guitarist presses Later song while the sermon is live
- **THEN** their tablet shows the next song's chords, says it's only on this device, and the screens don't change

#### Scenario: The song starts
- **WHEN** the operator sends the next song live while the guitarist is looking at it
- **THEN** the guitarist's view is back on the live song, with its live part

### Requirement: Controls of the stage views

On a member's device, the musicians and vocalists views SHALL keep their controls (back to the community, the layouts, Record, Share chords, Listen for tempo, Display) in one row of icons above the song, on every device type, each with its name in a tooltip shown on hover, on keyboard focus and on a long-press, which SHALL NOT press the button. While a device records, listens for the tempo or shares chords, that button SHALL say so in words. No icon SHALL have an arrow beside it: Record and Listen for tempo SHALL open a dialog with the input chosen last on the device, which can be changed there, the input's level, and Start; the layouts' icon SHALL open their menu.

#### Scenario: Controls on a phone
- **WHEN** a guitarist of the team opens the musicians view on a phone
- **THEN** its controls fit one row of icons, and the song starts under them

#### Scenario: A long-press names the button
- **WHEN** they hold a finger on the tempo icon for half a second
- **THEN** a tooltip says "Listen for tempo", and listening doesn't start

#### Scenario: Recording from the row
- **WHEN** a guitarist taps the microphone icon in the musicians view
- **THEN** a dialog shows the mixer input chosen last time with its level moving, and recording starts when they tap Start recording

### Requirement: Loading in the dark

Projectors (also local projection), the stage monitor, paired screens, the pairing page, and the musicians and vocalists views SHALL be dark from the first paint while they load or reload, before any of the app's code runs and whatever the system's light or dark mode, page and browser bar alike. A paired screen SHALL load in the background it showed last on that device, so an overlay stays transparent for a browser source; the first time, black.

#### Scenario: Reloading the projector in a light-mode laptop
- **WHEN** the operator reloads the projector window on a laptop in light mode
- **THEN** the projector stays black until its slide shows, without a white flash

#### Scenario: An overlay reloads in OBS
- **WHEN** a paired overlay screen with a transparent background reloads
- **THEN** it stays transparent while it loads

### Requirement: Slides on screens

While a slides page is live, a projector SHALL show it as large as fits, letterboxed on the screen's background color, without the screen's background picture or text styles, and a broadcast overlay SHALL show it the same way with its overlay background around it. A screen SHALL show its language's file when the entry has one, else the main file; a screen with two languages SHALL show its first language's. The stage monitor SHALL show the live page and the next one, with its countdown and messages. Musicians and vocalists layouts SHALL show the entry's title, "Slides" with the page and the page count, and the page small. Screens SHALL load the picture size that fits them.

#### Scenario: A 4:3 slide on a 16:9 projector
- **WHEN** a page made at 4:3 goes live on a 16:9 projector with a black background
- **THEN** it fills the screen's height, with black on both sides

#### Scenario: The stream during announcements
- **WHEN** a page goes live while the overlay screen is transparent
- **THEN** the overlay shows the page full frame, transparent around it

#### Scenario: The band during announcements
- **WHEN** page 3 of 12 of "Anunțuri" is live
- **THEN** the musicians view shows "Anunțuri", "Slides 3/12" and the page small

### Requirement: Title-safe margins

The projector, the stage monitor, and the musicians and vocalists screens SHALL keep their content inside a TV's title-safe area: 5% of the screen's width from the left and right edges, and 5% of its height from the top and bottom, since TVs crop the picture's edges. Their previews SHALL keep the same margins, scaled. Slides from files and start or end pages SHALL fill the screen as designed; the broadcast overlay SHALL keep its own lower-third margins.

#### Scenario: A TV that crops the edges
- **WHEN** the stage monitor runs on a TV that crops 4% of the picture at each edge
- **THEN** the clock, the message to the stage and every line of the live part stay visible

#### Scenario: A long line on the projector
- **WHEN** a slide's longest line fills the projector's width
- **THEN** it ends 5% of the width before the right edge

### Requirement: Stage view names

The interface SHALL name the musicians view Instruments and the vocalists view Vocals, in the menus, the bar, the screens' types and wherever it names them, since singers are musicians too; their addresses stay `/musicians` and `/vocalists`.

#### Scenario: The bar's stage pages
- **WHEN** a singer opens the community's menu with the stage views switched on
- **THEN** it lists Instruments, Vocals and Stage monitor

### Requirement: Between the playlist and one's stage view

On a phone, the playlist's bar SHALL have a button to the stage view of what the person plays (Vocals for singers, Instruments for the others), while the stage views are switched on and the person chose what they play; the Vocals and Instruments toolbars SHALL start with a button back to the playlist, as big as the toolbar's other buttons.

#### Scenario: A singer during the service
- **WHEN** a singer on a phone looks at the playlist, taps Vocals in its bar, then the playlist button in the toolbar
- **THEN** they are in the Vocals view, then back at the playlist, without opening the menu

### Requirement: Part marks

A song's parts SHALL be marked by a faint 1, 2, 3 or R (as the map of the parts writes them) in the top corner of their box, instead of "Verse 1" or "Refrain" on a line of their own: on the playlist's slide cards and in the Vocals and Instruments views. The part's name SHALL still be read out. Maps and charts of the parts keep their labels.

#### Scenario: A phone shows more of the song
- **WHEN** a singer opens a song's slides on a phone
- **THEN** each card starts with its first line, and a faint 1, 2 or R sits in its corner
