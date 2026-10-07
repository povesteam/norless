# instrument-layouts Specification

## Purpose
Give each musician the view their instrument needs, following the live state: shapes and capo for guitar, concert pitch or numbers for keys, structure and feel for drums, root notes for bass.

## Requirements

### Requirement: Musician profile

A member SHALL be able to list the instruments they play (guitar, keys, bass, drums, vocals, other), mark one as their main instrument, and, for guitar, pick the shapes they prefer among C, A, G, E and D. They SHALL do it on My account, or in a dialog that the musicians view SHALL open by itself the first time while they have none, and again from its Display menu ("What I play"); closing the dialog with nothing picked SHALL count as "Not now", and SHALL NOT ask again. The main instrument SHALL choose the member's default musicians layouts. Instruments SHALL be profile information, separate from roles. Instrument layouts, profiles, the question and keys for a service SHALL show while their feature (`instruments`) is switched on.

#### Scenario: Guitarist's defaults
- **WHEN** a member sets guitar as their main instrument and opens the musicians view on a phone
- **THEN** the Shapes over the words layout opens

#### Scenario: Asked once
- **WHEN** a member without instruments opens the musicians view for the first time
- **THEN** a dialog asks what they play
- **AND** after they close it, it doesn't open again, and "What I play" in the Display menu opens it

### Requirement: Note names

The community SHALL have a default for chord names: letters (C D E F G A B), Do-Re-Mi, or numbers relative to the song's key (1, 4, 5…). A member SHALL be able to choose their own. Songs SHALL store chords with C D E F G A B, and musicians layouts SHALL show them in the member's choice, including minor and slash chords.

#### Scenario: Numbers in any layout
- **WHEN** a member who chose numbers views a song in E with the chords E, A and B/D#
- **THEN** they are shown as 1, 4 and 5/7

#### Scenario: Do-Re-Mi
- **WHEN** a member who chose Do-Re-Mi views "C#m/G#"
- **THEN** it is shown as "Do#m/Sol#"

### Requirement: Capo and shapes

For a guitarist, each song SHALL get a capo fret and shapes computed from the song's key, or the key for this service, and the member's preferred shapes: the lowest fret from 0 to 7 at which one of their shapes fits, ties going to the first in the order C, A, G, E, D; a minor key uses the shape of its relative major (Am, Em, Dm). The member SHALL be able to change the capo for a song on the device, and the shapes SHALL follow.

#### Scenario: Song in E, shapes of C
- **WHEN** a song is in E and the guitarist prefers C and G shapes (G would need capo 9)
- **THEN** the layout shows capo 4 with C shapes: E is played as C, B/D# as G/B, C#m as Am, A as F

### Requirement: Guitar layouts

A guitarist SHALL be able to choose among:
- **Shapes over the words** (phone): the live part with shapes over the lyrics, the next part as chords only, and the change between them
- **Bar grid with shapes** (phone): the whole song as bars, without lyrics, the live part highlighted
- **Chart and chord diagrams** (tablet): every part with shapes over the lyrics, a diagram of each shape used in the song, and the next song with its capo and first chords

#### Scenario: Chord diagrams
- **WHEN** a song uses C, G/B, Am and F shapes
- **THEN** the tablet chart shows a diagram for each of the four shapes

### Requirement: Keys layouts

A keys player SHALL be able to choose among:
- **Concert pitch** (tablet): the live part with chords over the lyrics, the bass note of each bar, a map of the song by bars, the next part, and the key change to the next song
- **Number chart** (tablet): every part as bars of numbers relative to the key (1, 4, 5m, 5/7…), with a switch to letters

#### Scenario: Numbers in E
- **WHEN** a song in E has the bars E, B/D# C#m, A
- **THEN** the number chart shows 1, 5/7 6m, 4

### Requirement: Drums layouts

A drummer SHALL be able to choose among:
- **Parts by bars** (tablet): the tempo, every part as a block sized by its bars, its groove notes, and the live and next parts
- **Big cue** (phone): the live part's short name in very large letters, its bars and notes, the next part, and the tempo

A part without bar lines SHALL show no bar count.

#### Scenario: Readable from the kit
- **WHEN** the refrain is live
- **THEN** the drummer's phone shows "R" filling most of the screen, with "8 bars" and the next part below it

### Requirement: Bass layout

A bass player SHALL see the root notes of each bar of the live part in large letters, using the bass note of slash chords, with the chord names smaller below, and the next part's roots.

#### Scenario: Slash chord
- **WHEN** a bar holds E/G#
- **THEN** the bass layout shows G# as its root

### Requirement: Changes between parts and songs

Every instrument layout SHALL show the live part's last chord and the next part's first chord. During a song's last part, it SHALL show the next song's key, the key change from the live song, its time signature, its tempo and its first chords.

#### Scenario: Into verse 2
- **WHEN** the refrain ends on E and verse 2 starts on E
- **THEN** the layout shows "Refrain ends on E → Verse 2 starts on E", in the member's shapes and note names

#### Scenario: Next song after the sermon
- **WHEN** the last part of a song in E is live and the next song is in A
- **THEN** the layout shows "Next song: A, up a fourth", with its time signature, tempo and first chords

### Requirement: Notes per player

Instrument layouts SHALL show the notes without a prefix, and the notes whose prefix matches one of the member's instruments. They SHALL NOT show notes addressed to other players.

#### Scenario: Drum note hidden from keys
- **WHEN** verse 2 has `! drums: rim and hats` and `! all: softer`
- **THEN** the drummer sees both notes, and the keys player sees only "softer"

### Requirement: Controls on instrument layouts

For members who can control live, every instrument layout SHALL keep previous and next visible, and a tap on a part SHALL send it live, as on vocalists layouts.

#### Scenario: Rehearsal without an operator
- **WHEN** the keys player taps the bridge in the number chart during a rehearsal
- **THEN** the bridge goes live

### Requirement: Key for a service

The team SHALL be able to set the key of a song for one service, on its playlist entry, without changing the song. The service key SHALL apply wherever that entry's song shows a key or chords: musicians layouts (transposing its chords), the stage monitor, the projector's key line, the bible.com header and the playlist. Key changes SHALL be named in half steps. The key SHALL be chosen on a wheel: the song's 12 keys in a strip that scrolls sideways and snaps the chosen one under its middle, the song's key in the middle and each key with how far it moves (+2, −3); a tap, the arrow keys or a swipe chooses. Saving for this service and saving as the song's key SHALL look alike. The team SHALL also open it from the song's key in the Vocals and Instruments views. Wherever a song's key shows in those views and on its page, it SHALL show with a key icon instead of "Key:", read out as "Key".

#### Scenario: Lower for a guest singer
- **WHEN** the team sets "Sângele Tău", in A, to G for Sunday's playlist
- **THEN** Sunday's musicians layouts show its chords a whole step lower, the projector's key line shows G, and the playlist shows "G (song: A)"
- **AND** the song itself is still in A

### Requirement: Changing a song's key

The team and editors SHALL be able to change a song's key permanently, from its page or from a service key ("Save as the song's key"). Its chords SHALL move by the same half steps in every language, and the change SHALL be a revision with their name.

#### Scenario: The band plays it in G now
- **WHEN** a team member makes Sunday's key G the key of "Sângele Tău", in A with the chords A, D and E
- **THEN** the song is in G with the chords G, C and D, in every language that has chords

### Requirement: Live chord

A team member SHALL be able to share the chord played with the other musicians from the musicians view: from a MIDI piano, from the mixer's input or from a microphone, until they stop or leave. When several devices share, members SHALL see the best source's chord: a MIDI piano, then the mixer, then a microphone, the latest among equals; a device that stops sending for 15 seconds stops counting. The musicians view SHALL offer a Live chord layout: the chord played now, big, in the color of its degree in the played key, with whose and what source it comes from, and the circle of fifths; with nobody sharing, it SHALL say how a team member shares. A practice room's chord SHALL be its own. The server SHALL refuse sharing from anyone but the team, and following from anyone but members.

#### Scenario: The piano wins
- **WHEN** a guitarist shares from a microphone and the pianist from a MIDI piano
- **THEN** musicians in the Live chord layout see the pianist's chord, marked as from the piano

#### Scenario: The pianist stops
- **WHEN** the pianist stops sharing
- **THEN** the layout shows the guitarist's microphone's chord

### Requirement: Chord colors in relative pairs

Once the `chordColors` feature is on, chords SHALL be colored for everyone reading them, and a member SHALL be able to switch on plain chords (one color) in the Musician section of My account instead. With colors, the musicians view on their devices SHALL show each chord in a color given by its degree in the key it's played in, by its root: the same degree SHALL have the same color in every key, so G in D and B♭ in F, both 4, look alike. A minor key's tonic SHALL be 1, as for numbers. The colors SHALL be Relative pairs: the tonic in the text color; 1, 4 and 5 each a hue shared with its relative (6, 2 and 3 in major; 3, 6 and 7 in minor), the relative softer and the tonic's relative a faint tint, and the degree left over its own hue. A chord's suffix after a minor's "m" SHALL take its own color, on a ramp by tension (maj7, add and sixths grey, sus yellow, sevenths and extensions orange, diminished, augmented and altered red), mixed halfway with its letter's color, so it stands apart from the letter yet belongs to it. A slash chord's bass letter SHALL take the color of its own degree in the key. A chord or bass whose root is outside the key's scale, and a chord that isn't the key's own on its degree (D or D7 in C, a secondary dominant; in minor, 5 may be major or minor), SHALL take one color for outside the key, and without a key no chord SHALL be colored. The colors SHALL apply to chords over the words and to the bars of every musicians layout, whatever the member's note names, and to guitar shapes by the degree of the chord they play, and to the chords in the Chords mode, while the member edits. Each color SHALL reach a 4.5:1 contrast in light and dark. My account SHALL show the colors with their degrees, and the suffixes' ramp. Screens, projectors and members who switched on plain chords SHALL see no colors.

#### Scenario: Same degree, same color
- **WHEN** a musician with chord colors reads a song in D with a G chord, and then one in F with a B♭ chord
- **THEN** both chords have the color of degree 4

#### Scenario: Outside the key
- **WHEN** a song in C has a B♭ chord
- **THEN** it shows in the outside color, while C is in the text color and F and G in the colors of 4 and 5

#### Scenario: A secondary dominant
- **WHEN** a song in C has D7 and Dm7
- **THEN** D7 is in the outside color and Dm7 in degree 2's

#### Scenario: Off by default
- **WHEN** an owner switched the chord colors on and a musician who never chose opens the musicians view
- **THEN** plain chords are off: the chords are colored by their degree

#### Scenario: Plain chords
- **WHEN** a musician switches on plain chords in My account
- **THEN** their chords show in the chord color, without degrees

#### Scenario: Relative pairs
- **WHEN** a musician with chord colors reads a song in C with C, Am, F, Dm, G and Em
- **THEN** C is in the text color, F and Dm share a hue, G and Em share another, and Dm and Em are softer than F and G

#### Scenario: Suffixes apart, blended with their chord
- **WHEN** a song in C has G, Gsus4, G7 and Fmaj7
- **THEN** each G is in degree 5's color, the plain G has no suffix, sus4, 7 and maj7 are in three different colors, and G7's 7 is the ramp's seventh color mixed with degree 5's

#### Scenario: A bass note
- **WHEN** a song in D has D/F♯
- **THEN** the D is in degree 1's color and the F♯ in degree 3's
