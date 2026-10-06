# playlist-export Specification

## Purpose
Give singers and musicians the lyrics of a playlist on paper, as a file, or as text to paste into a chat, in their language and in playlist order.

## Requirements

### Requirement: Export formats

Anyone, including visitors who aren't logged in, SHALL be able to print a playlist, save it as a standalone HTML file, or copy it as plain text, choosing one of the community's languages. The export SHALL contain the playlist's songs in playlist order, each with its title and lyrics. Dividers, Bible references and text slides SHALL NOT be included. Chords SHALL NOT be included.

#### Scenario: Ukrainian lyrics for the singers
- **WHEN** a singer exports today's playlist in Ukrainian
- **THEN** the export lists today's songs in playlist order, with Ukrainian titles and lyrics

#### Scenario: Song without a Ukrainian version
- **WHEN** a song in the playlist has only a Romanian version and the export is in Ukrainian
- **THEN** the song is exported with its Romanian version

### Requirement: Refrain repetition

When a named section (e.g. `R`) appears for the first time in a song, the export SHALL write its name followed by a colon, then its lines.
- Print and HTML SHALL write later repeats in full.
- Copy SHALL write a later repeat with identical text as its name alone, on one line.
- A repeat whose text differs from the first occurrence SHALL be written in full with its name and a colon, in every format.

#### Scenario: Copy with a repeated refrain
- **WHEN** a song has verse 1, refrain R, verse 2, refrain R (same text), and the playlist is copied
- **THEN** the text is verse 1, "R:" with the refrain lines, verse 2, and a line "R"

#### Scenario: Print with a repeated refrain
- **WHEN** the same song is printed
- **THEN** the refrain lines appear in full both times

#### Scenario: Refrain with different endings
- **WHEN** a song's second R differs from its first R
- **THEN** both are written in full with "R:" in every format

### Requirement: Saved HTML file

The saved file SHALL be named with the playlist's date and its title, when it has one (e.g. `2026-09-30-Songs.html`, `2026-10-04-playlist.html`), and its heading SHALL be the playlist's name in the export's language. It SHALL work offline with no external resources. It SHALL have a table of contents linking to each song, a link back to the top from each song, and a light/dark switch that the file remembers.

#### Scenario: Open on a phone without internet
- **WHEN** a singer opens the saved file on a phone in airplane mode
- **THEN** the lyrics, table of contents and dark mode work

#### Scenario: An untitled playlist
- **WHEN** a visitor saves the untitled playlist of 4 October 2026 in Ukrainian
- **THEN** the file is `2026-10-04-playlist.html`, headed "4 жовтня"

### Requirement: Print layout

Printing SHALL produce a clean layout with song titles as headings, no app interface and no chords.

#### Scenario: Print preview
- **WHEN** a member chooses print
- **THEN** the browser's print preview shows only titles and lyrics

### Requirement: YouTube chapters

Norless SHALL keep, each time the live entry changes, which entry of which playlist went live, when, and in which mode. A playlist's actions menu SHALL offer members YouTube chapters of its last service: its entries that were live for at least 10 seconds that day in service mode, in the order they went live, without the same entry twice in a row, including the entry still live. When the community has a YouTube channel and the server a YouTube Data API key, Norless SHALL find the channel's live stream that was running when the first entry went live, among its 50 latest videos, and fill in when the first chapter starts in it, from the stream's start, with a link to the video; otherwise, or when no stream matches, the member SHALL type when the first entry starts in the video, and the member MAY always change the time. each chapter's time SHALL be that plus its distance from the first entry, written `m:ss` or, from an hour, `h:mm:ss`, followed by its title in the member's language. When the first entry doesn't start at 0:00, a first chapter "0:00 Start" SHALL come before it. A Copy button SHALL copy the chapters as text. A playlist never live in a service SHALL say it has no chapters yet.

#### Scenario: Chapters after the stream
- **WHEN** a service's first song went live at 10:02:10, the reading at 10:08:40 and the sermon at 10:12:00, and the member types 12:30 as the start of the first song in the video
- **THEN** the chapters are "0:00 Start", "12:30 Har minunat", "19:00 Ioan 3:16" and "22:20 Predica"

#### Scenario: A song shown by mistake
- **WHEN** a song was live for 4 seconds before the right one
- **THEN** it isn't a chapter

#### Scenario: The rehearsal doesn't count
- **WHEN** the playlist was used in Saturday's rehearsal and Sunday's service
- **THEN** the chapters are those of Sunday's service

#### Scenario: Offset from the live stream
- **WHEN** the community's channel is @Unu-unuRo, its stream started at 10:00:00 and the first chapter went live at 10:12:30
- **THEN** the chapters dialog fills in 12:30, says it comes from the stream that started at 10:00, and links to the video

#### Scenario: No stream found
- **WHEN** the community has no channel, the server has no API key, or YouTube has no stream running at that time
- **THEN** the time starts at 0:00 for the member to type, as before
