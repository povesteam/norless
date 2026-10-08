# playlists Specification

## Purpose
Plan a service or rehearsal as one ordered, shared list of songs, Bible references, dividers and text slides, visible and editable in real time from every device of the community.

## Requirements

### Requirement: Create, rename and archive playlists

A team member SHALL be able to create a playlist. A playlist SHALL have a date: its service's date, else the day it was created in the community's time zone. A new playlist SHALL have no title, and SHALL be shown by its date in each viewer's language, day and full month (e.g. "4 octombrie"), with the year only when it isn't the current year. A team member SHALL be able to give a playlist a title, shown first with its date muted after it, or clear it, move it to another day from its actions (it then plans that day's service, if any, which no other playlist plans first), and archive it, instead of deleting it. An archived playlist SHALL stay readable by its link, can still go live, and SHALL NOT be changed until a team member restores it; it SHALL leave the list of playlists and the home, and be listed with "Show archived" on the Playlists page and in the Classic menu.

#### Scenario: Last year's Christmas service
- **WHEN** an operator archives "Crăciun 2025", then ticks "Show archived" and restores it
- **THEN** it's gone from the playlists while archived, still opens by its link, and is back after Restore

#### Scenario: New playlist for today
- **WHEN** an operator creates a playlist on 30 September 2026 without typing a title
- **THEN** a Romanian viewer sees it as "30 septembrie" and a Ukrainian one as "30 вересня"

#### Scenario: A title and its date
- **WHEN** an operator titles the playlist of 1 March 2026 "seara"
- **THEN** it shows as "seara" with "1 martie" muted after it

#### Scenario: Two services on the same day
- **WHEN** an untitled playlist of 30 September exists and the operator creates another one that day
- **THEN** a second playlist is created

#### Scenario: The service moved
- **WHEN** the Sunday service moves to Saturday and an operator changes its playlist's date to that Saturday
- **THEN** the playlist shows the Saturday's date, and plans Saturday's service if the calendar has one

### Requirement: Current playlist and permalinks

Every playlist SHALL have a permanent URL. Opening the app without a playlist URL SHALL open, for members, the playlist of the service under way or next (`service-schedule` spec), and for visitors the playlist of the service under way or, between services, of the last one held; without one, the most recently created playlist. The list of playlists SHALL be ordered newest first, each with how many songs it has and, for members, who made it, as their avatar (its day is in its name), and the playlist of the service under way or next SHALL be marked.

#### Scenario: Share a playlist link
- **WHEN** an operator copies the URL of a playlist and a musician opens it on a phone
- **THEN** the musician sees that playlist

#### Scenario: Default playlist
- **WHEN** a member of a community without a service schedule opens the app's home URL
- **THEN** the newest playlist is shown

#### Scenario: The next service's playlist first
- **WHEN** Sunday's playlist exists, someone creates another playlist on Wednesday, and a member opens the home URL
- **THEN** Sunday's playlist is shown, until Sunday's service ends

#### Scenario: A visitor between services
- **WHEN** Sunday's service has ended, next Sunday's playlist is being prepared, and a visitor opens the home URL on Wednesday
- **THEN** last Sunday's playlist is shown, while members see next Sunday's

### Requirement: Entry types

A playlist SHALL contain an ordered list of entries. Each entry SHALL be one of:
- **song**: a reference to a song
- **Bible reference**: book, chapter, first and last verse
- **divider**: a short heading text
- **text slide**: Markdown text
- **slides**: pages from a file, described in Slides from files

A divider or a text slide MAY have planned minutes, e.g. 45 for the divider "Predica", up to 4 hours in whole minutes. They SHALL be typed as people write them, 45, 45m, 90 min, 1h, 1h30, 1 h 30 min or 1:30 (an hour and a half), and shown as 45 min, 1 h or 1 h 30 min. Planned minutes SHALL feed the times and end estimate, and the stage monitor's countdown, described in `live-control` and `screens`.

#### Scenario: Planned sermon
- **WHEN** an operator sets 45 planned minutes on the divider "Predica"
- **THEN** the entries after it start 45 minutes later in the estimate

#### Scenario: Divider from search
- **WHEN** the operator picks "add as divider" for the query "Cina Domnului"
- **THEN** the playlist gets a divider entry "Cina Domnului"

#### Scenario: Announcement slide
- **WHEN** an operator adds a text slide with "# Anunțuri\nDuminică la 10:00"
- **THEN** the playlist shows it as a text slide entry that can go live

### Requirement: Add entries

A new entry SHALL be added at the end of the playlist, or where it was asked for between two entries, and SHALL become the selected entry. With the `insertBetween` feature on, whoever changes entries SHALL see on a laptop, between two entries where the mouse rests for 300 ms, a + in the rows' column of icons, without a line, that offers Song, Divider and Text slide; Song SHALL focus the search box, which says where the next pick will land until it's chosen or cancelled. A row's actions SHALL then also offer Add song above and, with `textSlides` on, Add text slide above, on a touch screen in its ⋯ menu. The same song MAY be added more than once, and each copy SHALL be an independent entry.

#### Scenario: Song added twice
- **WHEN** a song is added twice and one copy is removed
- **THEN** the other copy stays in the playlist

#### Scenario: A song between two others
- **WHEN** an operator hovers between "Lumina lumii" and "Sunt iertat", chooses + then Song, and picks "Har minunat"
- **THEN** "Har minunat" is added between them and selected

### Requirement: Reorder entries

A team member SHALL be able to move an entry by dragging the row itself with the mouse, by long-pressing and dragging it on touch screens, with Move up and Move down in its actions, and with a keyboard shortcut. Rows SHALL show no drag handle. While an entry is dragged, a copy of it, its icon and title, SHALL follow the pointer or finger, and the entry SHALL leave the list on the dragging device; the rows SHALL make room where it would land: a gap as tall as the entry opens there, and the rows after it slide down (from the Meteor 3 draft), so at first the gap is where the entry was. The new order SHALL appear on every device showing the playlist within one second.

#### Scenario: Reorder on a tablet
- **WHEN** an operator long-presses an entry on a tablet and drags it two rows up
- **THEN** the entry moves two rows up on the tablet and on every other device showing the playlist

#### Scenario: Rows make room
- **WHEN** an operator drags the third entry over the first
- **THEN** a gap as tall as the dragged entry opens above the first entry, until it's dropped there, and the third entry shows only as the copy under the pointer

### Requirement: Live activity

While a member drags an entry, other devices showing the playlist SHALL show the entry moving, colored, and who is moving it, in real time. Rows that change places because of someone else's drag or change SHALL glide to their new places instead of jumping; changes made on the device itself SHALL snap, so a click or key right after lands where it's aimed, and devices set to reduce motion SHALL not glide. Members SHALL see who else has the playlist open.

#### Scenario: Watching a reorder
- **WHEN** the operator drags a song two rows up on the laptop
- **THEN** a musician's phone showing the playlist shows the song gliding up, colored and marked with the operator's avatar, before it's dropped

#### Scenario: Who is here
- **WHEN** three members have today's playlist open
- **THEN** each of them sees the other two members' avatars on the playlist

### Requirement: Entry actions

Rows SHALL show no remove or edit buttons. For the team, an entry's actions SHALL be: Edit, for dividers and text slides; Edit song, for songs and editors; Move up and Move down; Add divider above, which asks for its heading, and with `insertBetween` on Add song above and Add text slide above; and Remove. With a mouse, a right-click on an entry SHALL open a menu of its actions, as SHALL the context menu key or Shift+F10 on the selected entry. On a touch screen, each row SHALL end with a "⋯" button that opens the same menu, instead of swiping.

#### Scenario: Right-click on a laptop
- **WHEN** an operator right-clicks a song in the playlist
- **THEN** a menu offers Move up, Move down, Add divider above and Remove, and Edit song for editors

#### Scenario: Menu on a phone
- **WHEN** a team member taps the "⋯" button of a divider on a phone
- **THEN** a menu offers Edit, Move up, Move down, Add divider above and Remove, and a tap on Remove removes it

#### Scenario: Swipe on a phone
- **WHEN** a team member swipes a row to the left on a phone
- **THEN** no actions slide out; the row's "⋯" button is where they are

### Requirement: Remove entries

A team member SHALL be able to remove the selected entry with the Delete key or with Remove in the entry's actions. Removing SHALL be a soft delete. For 5 seconds after removing, the person who removed it SHALL see "Removed" with Undo, which puts the entry back in its place. The Delete key SHALL NOT remove an entry while a text field is focused.

#### Scenario: Delete key in the search box
- **WHEN** the search box is focused and the operator presses Delete
- **THEN** no playlist entry is removed

#### Scenario: Undo a slip during the service
- **WHEN** an operator removes the wrong song and taps Undo within 5 seconds
- **THEN** the song is back where it was, on every device

### Requirement: Entry display

Each entry SHALL show:
- an icon for its type
- its title in the viewer's selected language
- for songs: key signature, time signature and tags
- a mark if the song was played in the last hour
- for songs, while the playlist is being prepared (its day is today or later, and none of its songs was sung in a service from it yet): how long ago the song was last sung in a service, e.g. "2 weeks ago"

Rows SHALL have the old app's fixed heights, roomy for the 6 or 7 songs of a service: a song 72 px, its title on the first line and its key, time signature, tags and played mark on a smaller second line; other entries 48 px. Nothing a row shows SHALL make it taller.

The entry that is currently live SHALL be highlighted on every device, including for visitors who aren't logged in and opened the playlist's link, with a frame in the live color (`app-shell` spec) that doesn't move anything in the row, and "(•) Live" at the end of its title line, whose room every row keeps so a row going live doesn't move its title. Dividers SHALL be shown as headings.

While an entry is live, every entry above it SHALL show as done, the whole row half see-through, skipped ones too; while the screens are blank, the live entry SHALL show as done too, without its frame, with a thin line in the live color under it marking where the service is. This SHALL show for everyone, wherever the playlist's entries are listed; the Running order already collapses the entries done.

#### Scenario: Guest musician follows the setlist
- **WHEN** a visitor without an account opens a shared playlist link while the service runs
- **THEN** the entry that is live is highlighted and marked Live, and the highlight moves as the operator moves on

#### Scenario: Title in the viewer's language
- **WHEN** a song has Romanian and Ukrainian versions and the viewer has chosen Ukrainian
- **THEN** the playlist shows the Ukrainian title

#### Scenario: Recently played
- **WHEN** a song went live 20 minutes ago
- **THEN** its entry shows the played mark

#### Scenario: Where the service is
- **WHEN** the third entry is live and the operator then blanks the screens
- **THEN** the first two entries are faded, then the third too, without its frame and with a line under it

#### Scenario: Preparing Sunday
- **WHEN** on Friday an operator adds to Sunday's playlist a song last sung in a service two weeks ago
- **THEN** its row shows "2 weeks ago", until a song of the playlist is sung on Sunday

### Requirement: Selection per device

Each device SHALL have its own selected entry. Up and Down SHALL move the selection. The selection SHALL scroll into view.

#### Scenario: Two operators select different entries
- **WHEN** operator A selects the third entry and operator B selects the fifth
- **THEN** each keeps their own selection, and nothing goes live

### Requirement: Bible reference link

A Bible reference entry SHALL show the reference in the viewer's language (e.g. "Ioan 3:16-18"). It SHALL offer a link that opens the same passage on bible.com, in the Bible version configured for that language: owners SHALL choose it per community language in the settings' Bible tab, from a short list of common versions (Cornilescu by default for Romanian, Ogienko for Ukrainian, King James for English) or any other by its bible.com number.

#### Scenario: Open passage on bible.com
- **WHEN** the operator opens the link of the entry "Ioan 3:16-18" with Romanian selected
- **THEN** bible.com opens at John 3:16-18 in the community's Romanian version

### Requirement: Permissions

Members with the owner or team role SHALL be able to change playlists. Everyone else, including visitors who aren't logged in, SHALL see playlists read-only.

#### Scenario: Editor can't edit the playlist
- **WHEN** a member with only the editor role tries to remove an entry
- **THEN** the entry is not removed

### Requirement: Changes show at once

On the device that makes it, adding an entry from the search box, moving an entry and removing one SHALL show at once, before the server answers; when the server refuses, the playlist SHALL show again as the server has it, with a message that the change didn't go through.

#### Scenario: Adding during the sermon
- **WHEN** an operator picks "Har minunat" in the search box over a slow Wi-Fi
- **THEN** it shows at the end of the playlist at once, and stays when the server has it

#### Scenario: Refused
- **WHEN** the server refuses the new entry
- **THEN** it disappears from the playlist, and the operator sees that the change didn't go through

### Requirement: Slides from files

Whoever changes a playlist's entries SHALL be able to add a slides entry from a PDF or from pictures (`.png`, `.jpg`, `.jpeg`, `.webp`), through the playlist's add menu or by dropping files onto the playlist, up to 100 MB and 300 pages per file. Several pictures at once SHALL make one entry, a page each, in file name order; each PDF SHALL make its own entry. A presentation (`.pptx`, `.ppt`, `.pps`, `.ppsx`, `.odp`, `.key`) SHALL NOT be added: dropping or picking one SHALL add nothing for it and say how to export it as a PDF from PowerPoint, Keynote, Google Slides and Canva, since the app that made it draws it exactly and the server keeps no office suite. The entry's title SHALL be the file's name without its extension, and editable.

The server SHALL render every page to pictures for screens, phones and thumbnails (pdftoppm), once, after the upload. Until then the entry SHALL show how many pages are done, SHALL NOT go live, and SHALL be listed as a problem of the playlist; a failure SHALL show its reason and a Retry.

The entry's menu SHALL offer a file for each other community language, shown on that language's screens instead of the main file, and a timer, described in `live-control`. The entry SHALL show its page count and its first page as a thumbnail, and the original file SHALL be downloadable from its menu. It SHALL be the feature `fileSlides`, which needs `layouts`.

#### Scenario: Sunday's announcements
- **WHEN** an operator drops "Anunturi 12 oct.pdf" onto the playlist
- **THEN** an entry "Anunturi 12 oct" shows "Preparing" with its pages counting up, then its first page and its page count

#### Scenario: A PowerPoint file
- **WHEN** an operator drops "Anunturi 12 oct.pptx" onto the playlist
- **THEN** no entry is added, and a message says to export it as a PDF first, with where each app keeps that

#### Scenario: Pictures from a phone
- **WHEN** an operator adds three pictures, "1.jpg", "2.jpg" and "3.jpg", at once
- **THEN** the playlist gets one slides entry with three pages in that order

#### Scenario: A broken file
- **WHEN** an operator uploads a password-protected PDF
- **THEN** the entry says the file couldn't be opened, offers Retry, and can't go live

#### Scenario: The Ukrainian deck
- **WHEN** an operator adds a file for UA to the entry "Anunțuri"
- **THEN** the UA projector shows the UA file's pages and the RO projector the main file's
