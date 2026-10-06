# song-feedback Specification

## Purpose
Let members say which songs they like and dislike, keep the songs they like at hand while planning, and let the owners see why a song is disliked and take a song out of use, saying why.

## Requirements

### Requirement: Likes and dislikes

Every member of a community SHALL be able to like or dislike each of its songs from the song's page, once: choosing the other replaces their choice, and choosing the same again takes it back. A dislike MAY carry a reason of up to 500 characters. Visitors and screen devices SHALL NOT be offered it, and the server SHALL refuse it from them. Only members still in the community SHALL count. Deleting one's account SHALL delete one's likes and dislikes.

#### Scenario: Changing one's mind
- **WHEN** a member who liked "Har minunat" presses dislike
- **THEN** the song has one dislike from them and no like from them

#### Scenario: A reason for a dislike
- **WHEN** a member dislikes a song and writes "too high for the congregation"
- **THEN** the dislike is saved with that reason

#### Scenario: Visitors can't vote
- **WHEN** a visitor who isn't logged in opens a song's page
- **THEN** no like or dislike buttons are shown

### Requirement: Counts and reasons

A song's page SHALL show members how many members like and dislike it, and their own choice. Owners SHALL also see each dislike's reason with the member's name. Visitors SHALL see neither.

#### Scenario: Members see the counts
- **WHEN** 3 members like a song and 1 dislikes it
- **THEN** a member opening its page sees 3 likes and 1 dislike

#### Scenario: Owners read the reasons
- **WHEN** Ioana disliked a song because "too high"
- **THEN** an owner opening its page sees "Ioana: too high", and a member without the owner role doesn't

### Requirement: Songs one likes

The songs a member likes SHALL be their favorites: focusing the empty search box SHALL list them first, last liked first, up to 5, each marked as liked, before the search box's other suggestions (`song-search` spec).

#### Scenario: Favorites while planning
- **WHEN** a team member who likes 4 songs focuses the empty search box
- **THEN** those 4 songs are listed first, each marked as liked

### Requirement: Reviewing disliked songs

The community settings SHALL have a Songs tab for owners listing every song with at least one dislike, most dislikes first, with its likes, its dislikes and their reasons by name, and then the excluded songs with their reason, who excluded them and when.

#### Scenario: The most disliked first
- **WHEN** one song has 3 dislikes and another has 1
- **THEN** the Songs tab lists the one with 3 dislikes first

### Requirement: Excluded songs

An owner SHALL be able to exclude a song, from its page or the Songs tab, with a reason of 1 to 500 characters, and to include it again from the same places. Search and browsing SHALL NOT list an excluded song. Its page SHALL show everyone who opens it that it isn't sung in the community, and why. Editors SHALL still be able to edit it. Playlists that already have it SHALL keep it and can still project it, and the team SHALL see a problem on that entry with the reason. Its plays SHALL stay.

#### Scenario: Excluded against doctrine
- **WHEN** an owner excludes "Cântec X" because "against our doctrine"
- **THEN** searching for "Cântec X" doesn't find it, and its page shows "Not sung here: against our doctrine"

#### Scenario: Already in Sunday's playlist
- **WHEN** an owner excludes a song that is in Sunday's playlist
- **THEN** the playlist keeps the entry, and the team sees a problem on it with the reason

#### Scenario: Included again
- **WHEN** an owner presses "Include again" on an excluded song
- **THEN** search finds it again and its page no longer shows the reason
