# chord-editing Specification

## Purpose
Let musicians bring their chords into Norless themselves, from what they already have, without touching the lyrics.

## Requirements

### Requirement: The team edits chords, notes and tempo

Members with the team role SHALL be able to change a song's chord track (chords, bar lines, rows of chords only, `!` notes and notation blocks) and its tempo (BPM). They SHALL NOT be able to change lyrics, section names, titles, keys, tags or other fields, unless they also have the editor role: the Chords mode saves the track alone, which carries no words. Each save SHALL be kept as a revision with the member's name.

#### Scenario: Guitarist adds chords
- **WHEN** a member with only the team role adds chord lines to verse 1 and saves
- **THEN** the chords are saved, and the song's history shows the guitarist as the author of that change

#### Scenario: Drummer sets the tempo
- **WHEN** a drummer with the team role taps the tempo of a song and saves 72 BPM
- **THEN** the song's tempo is 72 BPM

#### Scenario: Lyrics stay protected
- **WHEN** the same guitarist saves the Chords mode
- **THEN** the song's words are as they were: the save holds only the track

### Requirement: Place a chord by tapping

In a song's text, a member who may edit chords SHALL be able to tap a point in a lyric line and pick a chord, which is then placed above that point. Tapping an existing chord SHALL let them change, remove or move it a letter left or right. A chord SHALL also be dragged to another letter, which is how a chord spread by position is put exactly where it's played.

#### Scenario: Add a missing chord
- **WHEN** a musician taps the start of the word "grace" and picks C
- **THEN** C is placed above "grace", and the song's chord line is updated

#### Scenario: Pick from the song's chords
- **WHEN** a musician taps a letter in a song in G that already uses G, Em and C
- **THEN** the row offers G, Em and C first, then Am, Bm and D from the key, then "other…"

#### Scenario: Drag a chord into place
- **WHEN** a musician drags the C over "Lăudați" two letters to the right
- **THEN** C stands over that letter, and the track keeps it there

### Requirement: Chords mode

The song page SHALL offer a Chords mode to members who may edit chords, while its feature (`chords`) is switched on, where they place chords by tapping or by playing them, and set the tempo, over the words of the language shown; the chords are every language's, so switching the language keeps what was changed. Changes SHALL be saved together when the member saves, and SHALL be a conflict, showing both, when someone else changed the track meanwhile. A musicians layout SHALL link to the Chords mode of the live song when it has no chords, for members who may edit them. Under each line with bar lines, each bar of two chords or more SHALL show its chords as wide as their beats, with a slider whose thumbs are where each chord ends, a step per beat of the song's time signature (4 without one), dragged or moved with the arrow keys (set only here, with no notation to learn).

#### Scenario: From the musicians layout
- **WHEN** the live song has no chords and a guitarist with the team role looks at the chords layout
- **THEN** the layout offers to add chords, which opens the song's Chords mode

#### Scenario: A longer chord in a bar
- **WHEN** a member moves the thumb between C and G in the bar "| C G |" one beat right, and saves
- **THEN** C lasts three beats of the bar and G one, in every musicians bar grid

### Requirement: Tempo

A song SHALL have an optional tempo in beats per minute, between 30 and 300, which members who may edit chords set by typing it or by tapping a button to the beat. The song page and the musicians layouts SHALL show it.

#### Scenario: Tapping the beat
- **WHEN** a drummer taps the button eight times, 0.83 seconds apart
- **THEN** the tempo shows 72 BPM

### Requirement: Song history

Members SHALL see a song's history: each save with who made it, when, and what changed (the words of each changed language, and the key, time signature, tempo and tags). Editors and owners SHALL be able to restore the song as it was before a save; the restore SHALL be a save of its own, so it can be undone.

#### Scenario: Rolling back a musician's change
- **WHEN** an editor opens the history of a song a guitarist changed, and restores it as it was before
- **THEN** the guitarist's chords are gone, and the history shows the editor's restore as the latest save

#### Scenario: Visitors see no history
- **WHEN** someone who isn't logged in opens a song
- **THEN** no history is offered, and the server refuses it

### Requirement: Chords apart from the lyrics

A song's chords, bar lines, rows of chords only, `!` notes and notation blocks SHALL be kept apart from its lyrics, in one chord track for every language. A chord's place SHALL be its position along the line, so it stays over about the same words when they change and spreads proportionally over another verse or language: a guide to what to play and when, not notation. The sections of a type (the verses, the refrains) SHALL share a pattern by default: every section follows its type's pattern, an unnamed part too, whatever its number of lines, since unnamed parts are mostly verses; a section MAY have its own chords instead. A section with the pattern's number of lines SHALL take its chords line by line, another one spread over the whole section as if it were one line. Notes and notation blocks SHALL belong to their section only. Parts without words (an intro of chords only, an instrumental part) SHALL keep their place between the sections. Every view SHALL show the chords over the words of its language as before. The words and the track SHALL be the song's only stored form: texts in the old format, chords on lines above the words, SHALL be taken apart once, on import.

#### Scenario: The verses share their chords
- **WHEN** a guitarist adds chords to verse 1 of a song whose other verses have none
- **THEN** every verse shows them, spread along its own words

#### Scenario: The translation gets them too
- **WHEN** the Romanian version has chords and the Ukrainian one has the same sections
- **THEN** the Ukrainian version shows the same chords over its words

#### Scenario: A last verse with more lines
- **WHEN** the verses' pattern has 4 lines and the last verse has 6
- **THEN** the last verse shows the pattern's chords spread over its 6 lines, in order

### Requirement: All the parts or only this one

When a musician changes a chord in a part whose chords other parts share, the chord picker SHALL ask where the change goes: all such parts ("All verses", the default) or only this one. Only this one SHALL give the part its own chords, which later changes to the others don't reach. The choice SHALL stay for that part until the Chords mode closes.

#### Scenario: Only the last verse
- **WHEN** a musician picks "Only this one" for verse 3 and changes its first chord to Em
- **THEN** verse 3 starts with Em, and verses 1 and 2 keep G

#### Scenario: All verses
- **WHEN** a musician changes verse 2's first chord with "All verses"
- **THEN** every verse that shares the pattern starts with the new chord

### Requirement: Play chords in

In the Chords mode, a member who may edit chords SHALL be able to play chords in: tap a letter, then play the chord on a MIDI piano, which goes over that letter when the keys are let go, named from the notes held (the lowest as its bass, spelled for the song's key); or hold the chord and tap the letter, which places it there at once. The chord SHALL show from the first key pressed: one or two different notes SHALL be a shorthand, one note its major chord, two notes by their interval from the lower one (a minor third minor, a major third or a fifth major, a minor seventh the seventh chord; a sixth or a fourth the same from the upper note). A piano SHALL connect by cable or by Bluetooth: Norless SHALL connect a Bluetooth MIDI piano itself, through the browser's chooser the first time, and SHALL let go of the piano when the Chords mode closes; once a piano was used on a device, it SHALL connect again when the Chords mode opens there. Where the browser has no MIDI (Apple's browsers), the Chords mode SHALL say so and offer listening. Listening through a microphone or the mixer's input, chosen once per device, Norless SHALL name the major or minor chord heard, and the chord picker SHALL offer it. A circle of fifths SHALL show the chord played: major chords outside, their relative minors inside, the song's key at the top, turning when the key changes, with a dot on the chord played, toward the middle when what's heard fits several. Playing chords in and listening SHALL each be a feature of their own, added after the feature switches; the circle of fifths SHALL come with either.

#### Scenario: A chord from the piano
- **WHEN** a pianist taps "Domnului", plays C, E and G on a MIDI piano and lets go
- **THEN** C stands over "Domnului"

#### Scenario: One finger
- **WHEN** a pianist holds A alone, then adds the C above it
- **THEN** the panel shows A, then Am

#### Scenario: Held, then tapped
- **WHEN** a pianist holds A minor and taps "Cântați", then lets go
- **THEN** Am stands over "Cântați" at once, with no picker, and letting go places nothing else

#### Scenario: An inversion
- **WHEN** the pianist plays G#, B and E, G# lowest
- **THEN** the chord is E/G#

#### Scenario: Heard through the mixer
- **WHEN** a guitarist listens through the mixer's input, taps a letter and plays A minor
- **THEN** the picker offers "Use Am"

#### Scenario: An iPhone
- **WHEN** a member opens the Chords mode on an iPhone
- **THEN** the panel says the browser can't use a MIDI piano, and offers listening
