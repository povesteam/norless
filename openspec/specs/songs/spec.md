# songs Specification

## Purpose
Store the community's songs with one version per language, and turn song text into slides for projection, musicians and printing, compatible with the existing Norless song syntax.

## Requirements

### Requirement: Song versions per language

A song SHALL have shared fields (key signature, time signature, tags) and one or more language versions. Each language version SHALL have a title and a text. A song SHALL have at most one version per language of its community.

#### Scenario: Song with Romanian and Ukrainian versions
- **WHEN** an editor adds a Ukrainian version to a song that has a Romanian version
- **THEN** the song has two versions, each with its own title and text
- **AND** key signature, time signature and tags are shared by both versions

#### Scenario: Missing translation
- **WHEN** a song has no version in a language a screen shows
- **THEN** that screen shows the song's first version instead

### Requirement: Song editing

An editor SHALL be able to create a song, edit its fields and versions, and delete it. The song editor SHALL show the words only ("almost nobody used the dot lines"): chords, notes and notation are in the Chords mode. Chord lines, notes and blocks typed or pasted into the editor SHALL go to the chord track. Deleting SHALL be a soft delete: the song disappears from search and new playlists, and existing playlists keep showing it as deleted. Saving SHALL be possible with Ctrl+S or Cmd+S. Closing the editor with unsaved changes SHALL ask for confirmation.

#### Scenario: Save with keyboard
- **WHEN** an editor presses Ctrl+S in the song editor
- **THEN** the song is saved and the editor stays open

#### Scenario: Close with unsaved changes
- **WHEN** an editor closes the song editor after changing the text without saving
- **THEN** the app asks whether to discard the changes

#### Scenario: Deleted song in an old playlist
- **WHEN** a song that appears in a past playlist is deleted
- **THEN** the playlist still lists it, marked as deleted, and it can't go live

#### Scenario: Live song is saved
- **WHEN** an editor saves a song that is currently live
- **THEN** all screens show the updated slide within one second

### Requirement: Languages side by side in the editor

Each language version's text SHALL be edited in one text area for the whole song, never split into a text area per part or slide. The text area SHALL be tall enough for two verses even when empty, and SHALL grow with the text. On a wide screen, the editor SHALL be able to show two language versions side by side, each in its own whole-song text area. The first column SHALL show the member's language. The second column SHALL have a tab for each other language the community has, and a "+" that adds a version in a community language the song doesn't have yet. Side by side SHALL be on by default on wide screens and off on phones, and the member's last choice SHALL be remembered. Adding a language to the community SHALL stay in the community settings.

#### Scenario: Fix the Ukrainian refrain next to the Romanian one
- **WHEN** an editor opens a song with Romanian and Ukrainian versions on a laptop
- **THEN** the whole Romanian text is on the left and the whole Ukrainian text on the right, each in one text area

#### Scenario: Add an English version
- **WHEN** the community has English and an editor clicks "+" on a song without an English version
- **THEN** an empty English tab opens next to the Romanian text

### Requirement: Song revisions

Every save SHALL keep the previous version of the song's fields and texts, with who saved it and when, so versions can be compared later. Members SHALL see them in the song's history while the song history is switched on (`chord-editing` spec); whatever is switched on, members see who added the song and who last edited it.

#### Scenario: Revision kept
- **WHEN** an editor fixes a word in verse 2 and saves
- **THEN** the text before the fix is still stored, with the editor's name and the time

### Requirement: Tags

A song SHALL have zero or more tags. A tag SHALL be stored lowercase without diacritics, with runs of other characters turned into single spaces. The editor SHALL suggest existing tags ordered by how many songs use them. The editor SHALL show the song's tags above the box that adds one, and its suggestions SHALL NOT cover them.

#### Scenario: Normalized tag
- **WHEN** an editor adds the tag "Crăciun!"
- **THEN** the song gets the tag "craciun"

#### Scenario: Suggestions beside the chosen tags
- **WHEN** an editor with the tags "craciun" and "copii" focuses the tag box
- **THEN** the suggestions open below the box, and both tags stay visible

### Requirement: Slides from song text

The system SHALL split a version's text into slides. Consecutive non-empty lines SHALL form one slide. One or more blank lines SHALL end a slide. Leading and trailing whitespace on each line SHALL be ignored.

#### Scenario: Two slides
- **WHEN** the text is "Line one\nLine two\n\nLine three"
- **THEN** there are two slides: "Line one / Line two" and "Line three"

### Requirement: Named sections and repeats

A line consisting of a letter optionally followed by digits, or of digits, or of `+`, followed by a colon (e.g. `R:`, `R2:`, `1:`), or of a name in square brackets (e.g. `[bridge]`, `[R]`), SHALL name the slide it belongs to and SHALL NOT be shown. A slide whose whole text equals a defined name SHALL be replaced by a copy of the named slide. The reference MAY come before the definition. Names SHALL be case-sensitive when referenced. If a name is defined twice, the last definition SHALL win.

#### Scenario: Refrain repeated by name
- **WHEN** the text defines a slide under `R:` and later has a slide containing only `R`
- **THEN** the later slide shows the same lines as the refrain and is named `R`

### Requirement: Repeat marks

Lines between `/:` and `:/` SHALL be sung twice, and lines between `/:.` and `.:/` three times. A mark MAY stand at the start or end of a line, with or without a space. Screens SHALL NOT show the marks; they SHALL show the lines once with a small "×2" or "×3" next to them. Repeat marks SHALL count toward the sung length used for time estimates. A mark that opens in one slide and closes in another, or never closes, SHALL be shown as written and flagged in the editor as an unclosed repeat.

#### Scenario: Lines sung twice
- **WHEN** a slide is "/:Tu mă ridici\nși eu pot sta:/"
- **THEN** screens show "Tu mă ridici / și eu pot sta" with "×2", and no slashes

#### Scenario: Three times
- **WHEN** a slide is "/:.Duh Sfânt dă-mi credință.:/"
- **THEN** screens show the line with "×3"

#### Scenario: Repeat across two slides
- **WHEN** `/:` starts in verse 1 and `:/` is in the next slide
- **THEN** both marks are shown as written, and the editor flags verse 1 as having an unclosed repeat

### Requirement: Section types

A section name SHALL determine the section's type:
- `R` or `C`, optionally followed by digits, or the words refren, refrain, chorus, приспів: **refrain**
- `B`, or the words bridge, punte, міст: **bridge**
- `P`, or pre-chorus, pre-refren: **pre-chorus**
- `I`, or intro, вступ: **intro**
- `E`, or ending, final, outro, кінцівка: **ending**
- digits, or `V` or `S` (strofă) optionally followed by digits, or strofa, verse, куплет: **verse**
- any other name: **other**

Letters and words SHALL match without regard to case. Each screen SHALL have a style per section type, and by default refrains SHALL be shown in italics and all other types normally.

#### Scenario: Numbered refrain
- **WHEN** a slide is named `R2`
- **THEN** it's a refrain, and projector screens show it in italics by default

#### Scenario: Bridge
- **WHEN** a slide is named `B` or `[bridge]`
- **THEN** it's a bridge

#### Scenario: Unknown letter
- **WHEN** a slide is named `Z`
- **THEN** it's of type other and is shown normally

### Requirement: Chords

In the text format the views read, which Norless builds from the lyrics and the chord track (`chord-editing` spec), and in text typed or pasted with chords, a line that starts with `.` followed by a character other than `.` SHALL be a chord line for the next lyric line only. Chords SHALL be separated by spaces or tabs, and a chord starting at column N of the chord line (the dot is column 0) SHALL be placed before lyric character N, minus the number of leading spaces of the lyric line. A chord placed before the start of the line SHALL be dropped. A chord beyond the end of the line SHALL be placed at the end, and the line SHALL be padded to keep the chord's position. Chords SHALL NOT be shown on projector screens.

#### Scenario: Chords over a line
- **WHEN** the text is ".G      C\nAmazing grace how sweet"
- **THEN** the slide line has chord G before "mazing" and chord C before "grace how sweet"

#### Scenario: Lyric line that starts with dots
- **WHEN** a lyric line is "...and so we sing"
- **THEN** it is shown as lyrics, not read as chords

### Requirement: Bar lines

A `|` in a chord line SHALL mark a bar line, and SHALL count as a space when placing chords. The chords between two bar lines SHALL belong to one bar. Bar lines SHALL be optional, per chord line. A chord line that isn't followed by a lyric line, e.g. in an intro, SHALL be shown as chords only. Bar lines SHALL be shown only on musicians screens. In a chord line, each `_` right after a chord's name SHALL hold it one more beat in its bar (`C__ G` is three beats of C and one of G); no view SHALL show them as part of the name.

#### Scenario: Intro written in bars
- **WHEN** the intro is ". | E | B/D# | C#m | A |"
- **THEN** the musicians bar grid shows four bars: E, B/D#, C#m and A

#### Scenario: Two chords in one bar
- **WHEN** a chord line is ". | A  B | E |"
- **THEN** the first bar holds A and B, and the second holds E

#### Scenario: A held chord
- **WHEN** a chord line is ". | C__ G | Am |"
- **THEN** the first bar holds C for three beats and G for one, and every view names them C and G

### Requirement: Layout characters

A line containing only `.` SHALL add an empty line inside a slide. Empty lines at the start or end of a slide SHALL be removed. A `~` SHALL be an invisible space that keeps its width. A `_` SHALL be removed from the shown text.

#### Scenario: Empty line inside a slide
- **WHEN** a slide is "First\n.\nSecond"
- **THEN** the slide shows "First", an empty line, and "Second"

### Requirement: Typography

Shown text SHALL use comma-below letters `ș ț Ș Ț` instead of cedilla `ş ţ Ş Ţ`. Hyphens SHALL NOT break a line on projector screens. Printed and copied text SHALL use ordinary hyphens.

#### Scenario: Cedilla corrected
- **WHEN** a song text contains "ţară"
- **THEN** screens show "țară"

### Requirement: Final slide mark

The last slide of a song SHALL carry a final mark. Trailing `*` characters at the end of the text SHALL be removed. Screens and song pages SHALL show the mark as a light grey `*` after the last line, as the old app did, the same on every device (an emoji looked different on Apple, Windows, Android and TVs).

#### Scenario: End of song visible to the operator and singers
- **WHEN** the last slide of a song is shown
- **THEN** a light grey `*` appears after its last line

### Requirement: Safe formatting

Song text SHALL NOT be able to run code or change the page. A small set of inline formatting SHALL be allowed, as existing songs use it: italic `<i>`, bold `<b>`, underline `<u>`, and text color `<span style="color: …">` (e.g. character names in skits). Any other markup SHALL be shown as plain text.

#### Scenario: Colored character names in a skit
- **WHEN** a line is `<span style='color: yellow'>Eli:</span> Serios?`
- **THEN** screens show "Eli:" in yellow followed by "Serios?"

#### Scenario: Anything else stays text
- **WHEN** a line contains `<script>alert(1)</script>` or `<img src=x onerror=…>`
- **THEN** screens show those characters literally and nothing runs

### Requirement: Notes for singers and musicians

A line starting with `!` SHALL be a note for the section it's in, e.g. `! only women` or `! guitar solo, 4 bars`. Notes SHALL be shown on musicians views and stage monitors. They SHALL NOT be shown on projector screens or the broadcast overlay. Exports SHALL leave notes out unless the user includes them. A note that starts with a word and a colon, e.g. `! drums: rim and hats` or `! keys: pad`, SHALL be addressed to that group of players. Until the instrument layouts exist, every musicians view SHALL show all notes, each with its prefix.

#### Scenario: Direction for the singers
- **WHEN** a refrain contains the line `! unison, women`
- **THEN** the stage monitor shows "unison, women" with the refrain, and the projector shows only the lyrics

#### Scenario: Note for the drummer
- **WHEN** verse 2 contains `! drums: rim and hats`
- **THEN** the musicians view shows "drums: rim and hats" with verse 2

### Requirement: Edit one section

An editor SHALL be able to open a single section of a song from its slide list, and edit only that section's lines, chords and notes. Saving SHALL change only that section in the song text. Opening a section SHALL hold the whole song, as in "Live editing presence". When someone else changed the same section in the meantime (after taking the song over, or from a page opened earlier), saving SHALL show both versions and let the editor choose. Changes to other sections SHALL be kept automatically.

#### Scenario: Fix a typo in the refrain during a service
- **WHEN** an editor opens the refrain of the live song, fixes one word and saves
- **THEN** only the refrain changes, and every screen shows the fixed refrain

#### Scenario: Two editors, two sections
- **WHEN** one editor saves verse 2, opened before another editor took the song over and saved the refrain
- **THEN** both changes are kept

#### Scenario: Two editors, same section
- **WHEN** an editor saves the refrain after someone else saved a different refrain in the meantime
- **THEN** the editor sees both versions and chooses which to keep

### Requirement: Live editing presence

One person SHALL edit a song at a time. Opening the song editor, the Chords mode or a section's editor SHALL hold the whole song for that person, on all their devices. Members viewing the song SHALL see who is editing it and which section, and SHALL see that section's text change as it's typed. While someone else holds it, members who could edit it SHALL see "Ana is editing this song", and the song SHALL be read-only for them: no section can be opened, and the song editor's and Chords mode's fields and Save are disabled. The song SHALL be freed when its holder closes the editor, saves and leaves, or loses connection, or after 5 minutes without typing; a device waiting on it SHALL take it then. Editors and team members SHALL both hold songs, since the team edits chords.

#### Scenario: Watching a fix happen
- **WHEN** Ana edits verse 2 of a song that Ion has open
- **THEN** Ion sees Ana's name on verse 2, and sees the text change as she types

#### Scenario: Section already being edited
- **WHEN** Ion tries to edit verse 2, or any other section, while Ana is editing the song
- **THEN** Ion sees that Ana is editing the song, and its sections can't be opened until she's done

#### Scenario: Song editor already open
- **WHEN** Ion opens the song editor while Ana has it open
- **THEN** Ion sees "Ana is editing this song", with the fields and Save disabled; when Ana closes it, Ion's editor becomes editable and holds the song

#### Scenario: Left open
- **WHEN** Ana leaves the Chords mode open and doesn't type for 5 minutes
- **THEN** Ion can take the song over

### Requirement: Compatibility with existing songs

For every song imported from the old app, the slides (count, order, names, lines, chord positions) SHALL match what the old app produced, except for the deliberate fixes named in this spec: markup outside the allowed formatting shown as text, lines starting with `..`, names like `R2:` (which the old app showed as a text line), tabs separating chords, `_` kept inside chord names, closed repeat marks shown as "×2" or "×3" instead of the marks, a chord line without a lyric line after it kept as a line of chords (the old app put it over the next lyric line, even in the next slide), and, with the chord track, chords shown over sections that had none, from their pattern or the other language, and a chord past the end of a line placed one letter on.

#### Scenario: Regression check on the imported library
- **WHEN** the parser runs over all imported songs in the test suite
- **THEN** each result matches the old parser's output, or differs only by a listed fix

### Requirement: Reference links

A song SHALL have up to 10 reference links, in order: recordings to learn it from, such as several YouTube versions. Each SHALL have an `https` address of up to 500 characters, a title, its site's name and a picture. The team and editors SHALL add, rename and remove them in the Chords mode; the server SHALL refuse them from anyone else and refuse an address that isn't `https`.

Adding a link SHALL read its title, site name and picture: YouTube links through YouTube's oEmbed service, other pages from their Open Graph tags (`og:title`, `og:site_name`, `og:image`), else their `<title>`. The title SHALL be editable before saving; a link whose title can't be read SHALL show its site's address instead. Norless SHALL open only public `https` addresses: never this machine or a private network, checked on the address connected to and after each redirect, for at most 5 seconds and 512 KB of page. The picture SHALL be copied into Norless, made a JPEG at most 320 pixels wide, read only as JPEG, PNG, WebP or GIF, and served by Norless, so that readers' browsers never contact the linked site.

The song's page SHALL list the links to everyone who can read the song, each with its picture, title and site, opening in a new tab. The page SHALL NOT embed the recordings. The links SHALL be kept in the song's revisions: History SHALL show their changes, and restoring a revision SHALL restore its links.

#### Scenario: Learning a new song
- **WHEN** a team member adds `https://www.youtube.com/watch?v=abc` to "Har minunat", keeps the video's title and saves
- **THEN** its page lists the video with its title, "YouTube" and its picture, opening the video in a new tab

#### Scenario: Several versions
- **WHEN** the team adds a live version and an acoustic one, and renames the second "Acoustic, slower"
- **THEN** the song's page lists both, in that order, with those titles

#### Scenario: Only https
- **WHEN** someone adds `javascript:alert(1)` or `http://example.com` as a link
- **THEN** the server refuses it

#### Scenario: Not this machine
- **WHEN** a link points at `https://127.0.0.1/` or a name leading to a private address
- **THEN** Norless doesn't open it, and the link shows its address

#### Scenario: Clearing the link
- **WHEN** an editor removes a song's links in the Chords mode and saves
- **THEN** the song's page shows no recordings, and History can bring them back

### Requirement: Song credits

A song SHALL have three optional credits: Authors (up to 300 characters), Copyright (up to 300 characters) and Source, an `https` address of up to 500 characters of the page the song was taken from. Editors SHALL edit them in the song editor; the server SHALL refuse a Source that isn't `https`. A save that leaves a credit out SHALL keep it as it was. Saving SHALL keep the previous credits in the song's revisions, restoring a revision SHALL restore them, and the song's history SHALL list their changes. The song's page SHALL show the credits that are set under the title, to everyone who can read the song, with the Source as a link opening in a new tab. Projectors SHALL NOT show them.

#### Scenario: Credits on the page
- **WHEN** an editor sets Authors "Text: Ioan Bunaciu", Copyright "© Editura Făclia" and Source `https://www.resursecrestine.ro/cantari/1`
- **THEN** the song's page shows "Text: Ioan Bunaciu · © Editura Făclia · Source", the last a link to that page

#### Scenario: Restored with the song
- **WHEN** an editor restores a revision saved before the copyright was changed
- **THEN** the song has the copyright it had then

### Requirement: Song page

A song's page SHALL have its actions in one row at the top, all of one size: Project here, Chords and Edit song, and the rarer ones (Change key, History, Copy short link, Exclude) in a ⋯ menu. On a laptop, a song with more than one language SHALL show them side by side, each named; elsewhere a switch SHALL choose the language. Every part SHALL be named as the live view names it ("Verse 1", "Refrain"), with its edit button beside the name for editors. Who added and last edited the song SHALL be named beside their pictures.

#### Scenario: Both languages at once
- **WHEN** a member opens "Har minunat", which has Romanian and Ukrainian versions, on a laptop
- **THEN** both versions show side by side, each under its language's name, every part named

#### Scenario: History from the menu
- **WHEN** an editor chooses History in the song's ⋯ menu
- **THEN** the song's saves show on the page, in view
