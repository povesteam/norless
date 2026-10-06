# notation Specification

## Purpose
Show short pieces of music notation (an intro, a riff, a drum groove) to the musicians who need them, stored with the song and edited in Norless.

## Requirements

### Requirement: Notation blocks in a song

A song part SHALL be able to hold notation blocks: lines between a line ```` ```abc ```` and a line ```` ``` ````, containing ABC notation, written in the text where they go. A block SHALL be stored in the song's chord track with its part, not in the lyrics, and put back into the text the views read. A block SHALL belong to the part it's in; a block alone between blank lines is a part of its own (an intro, an ending, an instrumental part). The parser SHALL leave block lines out of lyrics, slides, chords and search, and chord lines inside a block SHALL NOT be read as chords. Projector screens, the broadcast overlay, prints and copies SHALL NOT show blocks.

#### Scenario: Piano intro stored with the song
- **WHEN** the intro part contains an `abc` block with four bars for right and left hand
- **THEN** the projector shows nothing from it, and search doesn't find its letters

#### Scenario: The team adds a block
- **WHEN** a team member adds a block to a part and saves
- **THEN** the server takes it like a chord change, since the lyrics stay the same

### Requirement: Notation on instrument layouts

Keys layouts SHALL draw the blocks of the live and next parts as staves (a grand staff when the block has two voices), and drums layouts SHALL draw their drum blocks on a drum staff with the usual note heads. Each block SHALL have a play button that plays it at the song's tempo with sounds served by Norless, downloaded only when someone plays. Blocks SHALL be shown and played in the key for this service; drum blocks don't move. Changing a song's key permanently SHALL move its blocks with its chords.

#### Scenario: Pianist sees the intro
- **WHEN** the intro part, with a block, is live or next
- **THEN** the keys layout shows the intro as notes, and play sounds it at the song's tempo

#### Scenario: Key for this service
- **WHEN** a song in E is set to D for this service
- **THEN** the intro's notes are shown and played a whole step lower

#### Scenario: Key changed for good
- **WHEN** the team changes a song in E to D permanently
- **THEN** its blocks are written in D, like its chords

### Requirement: Edit as text with a live preview

The Chords mode SHALL offer, on each part, adding a notation block and editing or removing its blocks. The block editor SHALL show its ABC text with a preview that redraws while the text changes. A click on a note in the preview SHALL put the cursor on that note in the text. The preview SHALL have a play button. A block that can't be read SHALL show where the error is.

#### Scenario: Fix one note
- **WHEN** a team member clicks a wrong note in the preview, changes it in the text and plays it
- **THEN** the preview shows the corrected note, and play sounds it

### Requirement: Drum grid editor

The block editor SHALL offer a drum grid: rows for hi-hat, snare and kick, with rows for toms, crash and ride on request, and one column per step (16 per bar in 4/4, 12 in 3/4), for 1 to 4 bars. Tapping a cell SHALL toggle a hit. The grid SHALL play back, and SHALL write the block's ABC text. A block written by the grid SHALL open in the grid again.

#### Scenario: Write a groove by tapping
- **WHEN** a drummer taps hi-hat on every eighth note, snare on beats 2 and 4, and kick on 1 and 3
- **THEN** the block shows that groove on a drum staff, and play sounds it
