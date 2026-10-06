# data-import Specification

## Purpose
Import the old Romanian and Ukrainian Norless databases into one community of the new app, repeatably and without losing songs, translations, playlists or play history.

## Requirements

### Requirement: Import command

The system SHALL provide a command that takes the path of a mongodump archive containing the `norless` and `norless-ua` databases, and imports them into the new database, and optionally the path of a mongodump archive of the old server's oplog (`local.oplog.rs`). The command SHALL NOT modify the archives. It SHALL print a report with counts per kind of record and every anomaly it skipped or fixed. Keys and chords written in Do-Re-Mi SHALL be imported in letters; a key that isn't a key SHALL stay as written. After the import, the chords of the imported texts SHALL go to each song's chord track, the first language's first, and the report SHALL say how many songs.

#### Scenario: Import from the nightly backup
- **WHEN** the owner runs the import with the latest backup archive
- **THEN** the new database contains the community, songs, playlists, plays and imported accounts
- **AND** the command prints how many of each were imported and what was skipped

#### Scenario: A key in Do-Re-Mi
- **WHEN** an old song's key is "Si b" and its chord line reads "Re     Sol7"
- **THEN** the imported song's key is "Bb" and its chord line reads "D      G7"

### Requirement: Re-runnable

Every imported record SHALL keep its old id. Running the import again with a newer archive SHALL update existing records and add new ones, without creating duplicates. It SHALL NOT overwrite records changed in the new app after the previous import, and SHALL report them instead. Imported songs and song versions that the new run no longer produces SHALL be deleted, unless changed in the new app after the previous import.

#### Scenario: Import again the night before cutover
- **WHEN** the import runs a second time with a newer archive
- **THEN** the song and playlist counts match the old app, with no duplicates

#### Scenario: A song joined to another since the last import
- **WHEN** an earlier import made a UA song its own song, and this one joins it to its RO song
- **THEN** the earlier song and its version are deleted, and its entries and plays point to the RO song

### Requirement: Community and languages

The import SHALL create one community from the old `congregations` record, with languages `ro`, `uk` and `en`. The songs the old Romanian app holds in English SHALL be imported as English versions, from a list checked by Pavel. The old creator SHALL become an owner, and old admins SHALL be marked as admins in the imported accounts list.

#### Scenario: Community created
- **WHEN** the import runs on an empty database
- **THEN** there is one community "Unu-Unu" with languages ro, uk and en

#### Scenario: An English song
- **WHEN** the old Romanian app holds "Mighty to save" in English
- **THEN** the imported song has an English version and no Romanian one

### Requirement: Start and end pages

The import SHALL add the start and end pages the community uses today to its page list: `https://info.unu-unu.ro/slides-open-close/start` (start) and `https://info.unu-unu.ro/slides-open-close/end` (end).

#### Scenario: Pages ready after import
- **WHEN** the import runs on an empty database
- **THEN** the operator can project the start and end pages without configuring them

### Requirement: Known service history

The import SHALL add the community's known past and current services to its schedule:
- Sunday 10:00–12:00, service, from 15 February 2014, with no end date
- Sunday 17:30–19:00, service, from 15 February 2014 to 15 March 2020 (it stopped with Covid)

After importing plays, the import SHALL run the classification of imported plays defined in `service-schedule` once. The owner SHALL be able to correct the schedule and run the classification again.

#### Scenario: Evening service before and after Covid
- **WHEN** an open happened on a Sunday at 18:00 in 2019, and another one on a Sunday at 18:00 in 2023
- **THEN** the first is a service play, and the second is a rehearsal play

#### Scenario: Sunday warm-up
- **WHEN** an open happened on a Sunday at 9:20
- **THEN** it's a rehearsal play

### Requirement: Merge songs across databases

Each UA song SHALL join the RO song with its id, or the RO song a hand-made list of matches names for it (UA songs added again under a new id, and UA copies later overwritten with another song). For each song:
- in RO only: one song with a `ro` version
- in UA only: one song with a `uk` version, or a `ro` version when its text has no Cyrillic
- in both, with UA text containing Cyrillic: one song with a `ro` version from RO and a `uk` version from UA
- in both, with RO text containing Cyrillic and UA text without it: the languages are swapped, a `ro` version from UA and a `uk` version from RO
- in both, with identical text: one song with only a `ro` version
- in both, with different non-Cyrillic text: one song with the RO text as the `ro` version, reported as an anomaly for manual review

When a song gets several UA songs, a text with Cyrillic SHALL win over one without, then the song's own id over a matched one; the others SHALL be reported as merged. Playlist entries and opens SHALL point to the song their old id joined in the app they come from; an RO entry or open of an empty RO song whose id is a matched UA song SHALL point to the song that UA song joined.

Key signature, time signature and tags SHALL come from RO, with UA tags added. The song's creator and creation time SHALL be kept.

#### Scenario: Translated song
- **WHEN** a song id exists in both databases and the UA text is Ukrainian
- **THEN** one song is imported with Romanian and Ukrainian versions

#### Scenario: Untranslated copy
- **WHEN** a song id exists in both databases with identical text
- **THEN** one song is imported with only a Romanian version

#### Scenario: Translation added under a new id
- **WHEN** the UA app has "A venit Isus" with a Russian text under an id the RO app doesn't have, and the matches name the RO "A venit Isus"
- **THEN** one song is imported with the Romanian text and the UA text, and the UA playlists' entries point to it

#### Scenario: UA copy overwritten with another song
- **WHEN** the UA copy of "Vine duminica" holds "Iubirea-adâncă-a Tatălui", and another UA song holds the translation of "Vine duminica"
- **THEN** "Vine duminica" gets that translation, and the UA entries of the overwritten copy point to "Iubirea-adâncă-a Tatălui"

#### Scenario: Ukrainian carol
- **WHEN** the RO app has "Добрий вечір тобі" in Ukrainian and the UA app its Romanian translation
- **THEN** the Romanian translation is the `ro` version and the Ukrainian text the `uk` version

### Requirement: Empty and untitled songs

Songs with neither a title nor a text, left behind by the old "Create New Song" button, SHALL be skipped. Playlist entries pointing to them SHALL be skipped too. Songs with a text but no title SHALL get the first line of their text as the title. Both cases SHALL be counted in the report.

#### Scenario: Empty song
- **WHEN** an old song has an empty title and an empty text
- **THEN** it's not imported, and the report counts it as skipped

#### Scenario: Untitled song
- **WHEN** an old song has no title and a text starting with "Isus, Tu ești lumina"
- **THEN** it's imported with the title "Isus, Tu ești lumina"

### Requirement: Split combined titles

When a UA title has the form `RO title / UA title`, the part after the first " / " SHALL become the `uk` title. The part before SHALL be ignored when the song has a `ro` version, and reported when it differs from the RO title.

#### Scenario: Combined title
- **WHEN** the UA title is "Duh Sfânt / Святий Дух"
- **THEN** the `uk` title is "Святий Дух"

### Requirement: Merge playlists and entries

Playlists sharing an id in both databases SHALL become one playlist when their entries are the same. When the entries differ, the RO playlist SHALL be kept, and the UA one imported as a separate playlist with " (UA)" appended to its title. Entries SHALL keep their order, their kind (song, Bible reference, divider) and their soft-deleted state. Entries without a kind SHALL be skipped and reported. Bible entries (`b<book>_<chapter>_<verse1>_<verse2>`) SHALL become Bible reference entries.

#### Scenario: Pre-clone playlist
- **WHEN** a playlist from 2021 exists identically in both databases
- **THEN** one playlist is imported

#### Scenario: Entry without a kind
- **WHEN** an entry has no kind
- **THEN** it is skipped and listed in the report

### Requirement: Plays from opens

Each old `opens` record (song id and time) SHALL become a play of that song, with mode "unclassified". The owner classifies them afterwards, as defined in `service-schedule`. Opens that exist in both databases (same song and time) SHALL be imported once.

#### Scenario: Twelve years of opens
- **WHEN** the import reads opens from 2014 to 2026
- **THEN** every open becomes an unclassified play, and none is lost

### Requirement: Imported accounts

Old users SHALL be imported into the imported-accounts list with their username, email addresses, creation date and last login date, merged by email across both databases. Password hashes and login tokens SHALL NOT be imported. No imported person SHALL be able to log in until the owner invites them.

#### Scenario: Same person in both databases
- **WHEN** the same email exists in the RO and UA databases
- **THEN** one imported account is listed for that person

### Requirement: History from the oplog

Given the old server's oplog, the import SHALL add what the backup doesn't keep: for each save of a song in the old app, a revision in the song's History with the whole song as it was before, at the time of the save; every slide the Romanian screens showed, in the slide log, with who showed it; the end of each imported play, when the screens moved to another song within its first 45 minutes; the time each playlist and entry was created, the time each song was added after July 2016, and the time and person for each entry removed before a service. Running the import again SHALL add nothing twice.

#### Scenario: A song's old texts
- **WHEN** a song's refrain was corrected in the old app in 2019
- **THEN** the song's History shows the text from before the correction, dated 2019

#### Scenario: How long a song lasts
- **WHEN** an imported play's song was on the screens for 4 minutes before the next song
- **THEN** the play ends 4 minutes after it started, and the song's usual length counts it

#### Scenario: A song dropped from the plan
- **WHEN** a leader put a song in Sunday's playlist on Thursday and removed it on Saturday
- **THEN** the imported entry is removed, with Saturday's time and the leader as who removed it

### Requirement: Playlist titles

An old playlist's title starting with a date (day and month in Romanian or English, any case, an optional year and an optional weekday before it) SHALL be imported with that date as the playlist's date and the rest of the title, without its separators, as its title; a title that is only a date SHALL leave the playlist untitled. A missing year SHALL be the one that puts the date nearest the day the old playlist was created (that year, the one before or the one after), so a playlist made on 30 December for "3 ianuarie" gets the next year. Titles without a date SHALL be kept, and the playlist's date SHALL be the day it was created. Titles starting with digits that aren't a date SHALL be counted in the report.

#### Scenario: Only a date
- **WHEN** an old playlist is titled "4 October 2026"
- **THEN** it's imported untitled, dated 4 October 2026

#### Scenario: A date and a word
- **WHEN** an old playlist is titled "1 March 2026 seara"
- **THEN** it's imported titled "seara", dated 1 March 2026

#### Scenario: No year
- **WHEN** an old playlist created in 2025 is titled "19 junie"
- **THEN** it's imported untitled, dated 19 June 2025
