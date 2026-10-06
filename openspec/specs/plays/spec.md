# plays Specification

## Purpose
Record every time a song is played, marking whether it was in a service or a rehearsal, so later statistics and recommendations (how often, since when, what hasn't been sung lately) reflect real services.

## Requirements

### Requirement: Record a play

When a song stays live for at least 30 seconds, the system SHALL record a play with the song, room, playlist, mode (service, rehearsal, or unclassified for imported data), the time it went live and the time another entry replaced it. Blank time SHALL count as part of the play. Moving between slides of the same song SHALL NOT record another play. Sending the same song live again after another entry was live SHALL record a new play.

#### Scenario: Song shown briefly by mistake
- **WHEN** the operator sends a song live and moves to another entry after 4 seconds
- **THEN** no play is recorded for the first song

#### Scenario: Local projection
- **WHEN** a visitor projects a song locally for 5 minutes
- **THEN** no play is recorded

#### Scenario: Same song twice in a service
- **WHEN** a song is played at the start, another song follows, and the first song is played again at the end
- **THEN** two plays are recorded for it

#### Scenario: Length of a play
- **WHEN** a song goes live at 10:21:10 and the next entry goes live at 10:27:02
- **THEN** the play lasted 5 minutes 52 seconds, which counts toward the song's usual length

### Requirement: Plays in rehearsals are kept apart

Plays SHALL always be saved, whatever the mode. Anything that reports how often or when a song was played SHALL count only service plays, unless the user asks to include rehearsals. Unclassified plays SHALL never be counted. A practice room's plays SHALL be rehearsals, unless its starter switched it to service; they SHALL keep their room.

#### Scenario: Last played ignores rehearsals
- **WHEN** a song was played in a service on 1 September and in a rehearsal on 25 September
- **THEN** search shows it as last played on 1 September

#### Scenario: Band practice
- **WHEN** the band plays three songs in a practice room during the service
- **THEN** they're kept as rehearsal plays of that room, and the statistics don't count them

### Requirement: Every slide change

The server SHALL keep every change of what a room's screens show: another entry, another slide, blank or shown again, with the entry and its song, the slide, whether the screens are blank, the mode, the time and who changed it. A press that changes nothing SHALL add nothing.

#### Scenario: A song with a repeated refrain
- **WHEN** an operator goes through verse 1, the refrain, verse 2 and the refrain again
- **THEN** four changes are kept, each with its slide and time, so the refrain's two times can be told apart

#### Scenario: Blank during a prayer
- **WHEN** the operator blanks the screens and shows the slide again three minutes later
- **THEN** both changes are kept, three minutes apart
