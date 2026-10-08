# song-search Specification

## Purpose
Let operators find what to add to a playlist, songs in any language, Bible references, dividers or a new song, from one search box using only the keyboard.

## Requirements

### Requirement: Search songs by title and lyrics

The system SHALL search all non-deleted songs of the community that the owners haven't excluded (`song-feedback` spec) by title and lyrics, across all language versions. Title matches SHALL rank above lyric matches. Chord lines, section names and layout characters SHALL NOT be searchable. Search SHALL ignore diacritics and case. Results SHALL be limited to 25 songs. After the songs that contain every word, the search SHALL find songs whose title or lyrics contain the query with its words joined and its punctuation ignored, and then songs within about one typo (a letter missing, extra or changed) per five letters of the query, titles before lyrics and fewer typos first, so a sloppy match never ranks above an exact one.

#### Scenario: Search without diacritics
- **WHEN** the operator types "isus e domn"
- **THEN** a song titled "Isus e Domn" is found, and so is a song whose lyrics contain "Isus e Domn"

#### Scenario: Search finds the Ukrainian version
- **WHEN** the operator types words from a song's Ukrainian title
- **THEN** that song is found

#### Scenario: Chords are not searched
- **WHEN** the operator types "Am"
- **THEN** songs aren't matched only because their chord lines contain "Am"

#### Scenario: Words typed together
- **WHEN** the operator types "datimi"
- **THEN** the song titled "Dați-mi un cântec" is found

#### Scenario: A typo
- **WHEN** the operator types "har minunt"
- **THEN** "Har minunat" is found, after any song that contains "har" and "minunt" as typed

### Requirement: Result details

Each song result SHALL show its title in the operator's language, key signature, time signature, tags, and when it was last played in a service.

#### Scenario: Last played
- **WHEN** a song was last played in a service 3 weeks ago
- **THEN** its result shows "3 weeks ago" in the UI language

### Requirement: Bible reference results

A query shaped as a Bible reference (book, chapter, optional verse, optional end verse, any non-digit separators) SHALL produce Bible reference results instead of song results. Book names SHALL match without diacritics, as a substring of the book name in any community language, so one query MAY match several books. A book SHALL be listed only if it has the requested chapter. Verses past the end of the chapter SHALL be limited to its last verse, and a reversed range SHALL be swapped. A reference without verses SHALL mean the whole chapter. A query without a chapter number SHALL be a song search.

#### Scenario: Reference with range
- **WHEN** the operator types "ioan 3:16-18"
- **THEN** the results include "Ioan 3:16-18"
- **AND** "1 Ioan 3:16-18", because its name contains "ioan" and it has a chapter 3
- **AND** not "2 Ioan", which has only one chapter

#### Scenario: Out-of-range verse
- **WHEN** the operator types "ps 23 99"
- **THEN** the result is Psalm 23 verse 6, its last verse

#### Scenario: Whole chapter
- **WHEN** the operator types "geneza 1"
- **THEN** the result is "Geneza 1:1-31"

### Requirement: Divider and new song results

Every non-Bible search SHALL end with two extra results: add the query text as a divider, and create a new song with the query as its title. Picking the new song SHALL open the editor with the query as its title, and nothing SHALL be created until "Save and add to playlist", which creates the song and adds it at the end; closing the editor creates nothing.

#### Scenario: Create a song that doesn't exist
- **WHEN** the operator searches "Cântec nou", picks "Create song", types the lyrics and presses "Save and add to playlist"
- **THEN** a song titled "Cântec nou" is created and added to the playlist

#### Scenario: Changed one's mind
- **WHEN** the operator picks "Create song" and closes the editor without saving
- **THEN** no song is created and the playlist is unchanged

### Requirement: Keyboard-first search

Typing a letter or digit anywhere outside a text field, without Ctrl, Cmd or Alt, SHALL focus the search box with that character. Up and Down SHALL move the selection in the results. The first result SHALL always be selected, shown in a filled frame; the focus ring SHALL show only once Up, Down, Page Up, Page Down, Home or End moved the selection, not while typing, which a phone's keyboard counts as keyboard use too. The tags field's options SHALL look the same. Enter SHALL add the selected result to the playlist. Esc SHALL close the results and clear the box.

#### Scenario: Type anywhere
- **WHEN** the operator presses "g" while no text field is focused
- **THEN** the search box is focused and contains "g"

#### Scenario: Copy shortcut is not captured
- **WHEN** the operator presses Cmd+C
- **THEN** the search box is not focused

#### Scenario: Enter adds the first result
- **WHEN** results are shown and the operator presses Enter without moving the selection
- **THEN** the first result is added

#### Scenario: No focus ring while typing
- **WHEN** someone types "har" on a phone and the results show
- **THEN** the first result is in a filled frame without a focus ring, and pressing Down moves the frame and the ring to the second

### Requirement: Browsing without a query

Focusing the empty search box SHALL show, in one list, songs worth suggesting, each with a chip saying why, then a random sample, up to 100 songs in all, leaving out excluded songs: for a member, the songs they like (`song-feedback` spec), last liked first, "You like it" in the accent color; songs sung in exactly one of the community's last 4 services (one sung in 2 or more is sung often enough), longest ago first, "Played recently" in grey; and the songs not played lately (`song-statistics` spec: in at least 3 services, none in the last 6 months), most sung first, "Bring it back" in green; up to 5 of each, a song once, none already in the open playlist.

#### Scenario: Browse for inspiration
- **WHEN** the operator focuses the empty search box
- **THEN** the songs sung lately are listed first, marked "Played recently" in grey, then the ones not played lately, marked "Bring it back" in green, then random songs, up to 100

### Requirement: Searching takes over the screen

While the search box's results are open, the box and its results SHALL cover the page: the box at the top, the results filling the rest down to the live bar, if one shows, or the screen's bottom (on a phone, the keyboard's top), so the live controls keep working while searching. A press on the box that opens the results SHALL NOT pick the result that appears under the pointer when it's released. On a window at least 1024 pixels wide, the highlighted song's words SHALL show beside the results, in the viewer's language if the song has it, each part marked by its faint 1, 2 or R as on the slide cards; the words SHALL change once a song stays highlighted for a moment, and SHALL stay until the next song's words have loaded, so moving quickly over the results doesn't blink. A pick, Escape or a click outside SHALL give the page back as it was.

#### Scenario: The phone's search fills the screen
- **WHEN** an operator taps the search box on a phone
- **THEN** the box moves to the top of the screen and the results fill the rest of it

#### Scenario: Checking the words before adding
- **WHEN** an operator on a laptop types "har" and moves down to "Har minunat"
- **THEN** the words of "Har minunat" show beside the results, and the live bar stays below them

#### Scenario: A click on the box
- **WHEN** an operator on a laptop clicks the search box, and a suggestion appears under the pointer before the button is released
- **THEN** the results stay open and nothing is added to the playlist
