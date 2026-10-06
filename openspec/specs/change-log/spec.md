# change-log Specification

## Purpose
Keep a history of every change the app makes to a community's records, with who made it, when and what it was before, and let owners read it.

## Requirements

### Requirement: Change log

The server SHALL record every change the app makes to a community's songs and their texts, playlists and their entries, members, screens and paired TVs, pages, schedule, rooms, settings, recordings and access to recordings: who made it, when, whether it added, changed or deleted the record, the record as it became (as it was, for a delete), and, for a change, each changed field's value before and after. It SHALL leave out secrets (a screen's link, a TV's token) and fields that change by themselves (the live slide, a recording's size), and a save that changes nothing but when and by whom it was saved. Changes the server makes by itself SHALL be recorded without a person. When a member deletes their account, their changes SHALL stay, without who made them.

#### Scenario: A renamed playlist
- **WHEN** Ana renames the playlist "Duminică" to "Duminica"
- **THEN** the change log has Ana's change of the playlist's title from "Duminică" to "Duminica", with its time

#### Scenario: A new screen link
- **WHEN** an owner makes a new link for a screen
- **THEN** the change log doesn't contain the old or the new link

#### Scenario: A deleted account
- **WHEN** Ed, who edited songs, deletes his account
- **THEN** his edits stay in the change log, without his name

### Requirement: Changes page

Owners SHALL be able to read the community's change log on a Changes page (the `changes` feature), linked beside the settings: newest first, grouped by day, each change with its time, who made it (or Norless), what it did (added, changed, removed, restored), what record it was about by the name people know it by (a song's or playlist's title, a member's or screen's name), and each changed field with its value before and after, long texts as a diff of their lines. A field that stores an object (a screen's settings, the theme) SHALL show only its changed keys, one line each, and the feature switches the features switched on and those switched off, by their names (the whole stored value was too noisy). A field that stores a list SHALL show its items by name (a text's first line, a link's title), those that went and those that came; and one person's changes of one record within a minute of each other SHALL show as one, or not at all when they cancel out, such as a feature switched on and off again. They SHALL be able to filter by person and by kind (songs, playlists, settings, members, recordings), and load older changes. Nobody else SHALL see the page or its data.

#### Scenario: What changed in the song
- **WHEN** an owner opens the Changes page after an editor changed the refrain of "Har minunat"
- **THEN** the page shows the editor, the time, "Changed", the song's title, and the text's removed and added lines

#### Scenario: Only songs
- **WHEN** the owner chooses Songs
- **THEN** only changes to songs and their texts are listed

#### Scenario: A team member
- **WHEN** a member with the team role opens the Changes page's address
- **THEN** the page says only owners see the community's changes, and shows none

#### Scenario: Features switched on
- **WHEN** an owner switches on Chord colors and Offline, and opens the Changes page
- **THEN** the community settings' change says "Switched on: Chord colors, Offline", without the other switches

#### Scenario: On and off again
- **WHEN** an owner switches Watch again on, then off 20 seconds later
- **THEN** the Changes page shows neither
