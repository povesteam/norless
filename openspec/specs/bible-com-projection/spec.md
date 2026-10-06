# bible-com-projection Specification

## Purpose
Optionally send Norless song slides and pages to the projection windows of the "Project verses from bible.com" Chrome extension, for setups where those windows are the projector. Norless's own screens are the default.

## Requirements

### Requirement: Extension detection

When the operator's browser has the extension installed and it accepts messages from Norless, Norless SHALL detect it by sending the `help` action and getting status 200. Norless SHALL show whether bible.com projection is available. When it isn't, Norless SHALL keep working with its own projector screens. Where a language is mapped to a window on the device, the live bar SHALL say whether the extension is connected, which windows are open when the extension answers the `status` action with them, and offer a link to install it when it isn't connected.

#### Scenario: Extension missing
- **WHEN** the operator's browser doesn't have the extension
- **THEN** Norless shows "bible.com projection unavailable" and its own projector screens still work

#### Scenario: Connected, with its windows
- **WHEN** the operator mapped Romanian to window 1 and the extension answers `status` with windows 1 and 2
- **THEN** the live bar says the extension is connected, windows 1, 2 open

### Requirement: Language to window mapping

The operator SHALL be able to map each language to bible.com projection window 1, window 2, all enabled windows, or none. The mapping SHALL be saved per device, and SHALL default to none.

#### Scenario: Romanian to window 1, Ukrainian to window 2
- **WHEN** Romanian is mapped to window 1 and Ukrainian to window 2, and a song goes live
- **THEN** window 1 gets the Romanian slide and window 2 gets the Ukrainian slide

### Requirement: Slide messages

For every live state change, Norless SHALL send `updateText` to each mapped window with `markdown: false`. The `text` SHALL be HTML in the format the extension fits to the screen:
- an `h1.reference` header with the progress (e.g. "#2/5"), the key and the title in that window's language
- the slide lines in a `div.singlelines`, one `p` per line
- italic lines for refrains
- the final mark, a light grey `*`, after the last line of the last slide
- the first line of the next slide at the bottom, dimmed

All song text in the message SHALL be escaped.

#### Scenario: Ukrainian title only
- **WHEN** a song whose imported Ukrainian title was "Duh Sfânt / Святий Дух" is sent to the Ukrainian window
- **THEN** the header shows "Святий Дух"

#### Scenario: Refrain
- **WHEN** a refrain slide goes live
- **THEN** its lines are sent in italics to every mapped window, in every language

### Requirement: Text slides and Bible references

A live text slide SHALL be sent with `updateText` and `markdown: true`. When a Bible reference entry goes live, Norless SHALL NOT send anything to the bible.com windows, so the verses the operator projects from bible.com stay on screen.

#### Scenario: Announcements
- **WHEN** a text slide "# Anunțuri" goes live
- **THEN** each mapped window shows it rendered as Markdown

#### Scenario: Reading from bible.com
- **WHEN** the operator sends the entry "Ioan 3:16-18" live and then projects John 3:16 from bible.com
- **THEN** the bible.com windows show the verse, and Norless doesn't overwrite it

### Requirement: Blank

When the live state is blanked, Norless SHALL send `updateText` with an empty `text` to each mapped window.

#### Scenario: Esc
- **WHEN** the operator presses Esc
- **THEN** every mapped bible.com window goes blank

### Requirement: Pages

Projecting a start or end page SHALL send `updateFrame` with the page URL to all mapped windows. Only `https` URLs SHALL be accepted when configuring pages.

#### Scenario: Start page
- **WHEN** the operator projects the start page
- **THEN** each mapped window shows that page full size

### Requirement: Error feedback

When the extension answers with a status other than 200, Norless SHALL show the error to the operator. For status 404, the message SHALL tell them to open the projection window first.

#### Scenario: Projection window not open
- **WHEN** window 2 isn't open and a slide is sent to it
- **THEN** the operator sees "Open bible.com projection window 2 first"

### Requirement: Verses from bible.com

Norless SHALL open a connection to the extension from a team member's device where a language is mapped, and listen for the verses it projects: a message `{ action: "verse", payload: { index, reference, text } }` for a verse shown in window `index`, and `{ action: "verse", payload: { index, reference: null } }` when that window is cleared. Norless SHALL send a verse live in the community language mapped to that window, joining the other window's language when both come within 10 seconds, and SHALL take it down when its window is cleared. A live verse SHALL show on every projector in its language (else the other one), on stage monitors (except over a timed entry's countdown) and on phones following along, over what's live, until Next, Previous, another entry, blank, or "Back to the playlist" in the live bar, which says "Verse from bible.com" with its reference. Next and Previous SHALL only take it down, back to the slide it covered. While a verse is live, Norless SHALL send nothing to the bible.com windows. The server SHALL accept a verse only from the team, in the community's languages.

#### Scenario: John 3:16 in two languages
- **WHEN** the operator projects John 3:16 from bible.com in window 1 in Romanian and window 2 in Ukrainian, with Romanian mapped to window 1 and Ukrainian to window 2
- **THEN** Norless's Romanian and Ukrainian projectors show the verse each in its language, and phones following along show it too

#### Scenario: Back to the song
- **WHEN** a verse is live over the second verse of a song, and the operator presses Next
- **THEN** the screens show the song's second verse again
