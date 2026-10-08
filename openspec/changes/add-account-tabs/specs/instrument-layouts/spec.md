## MODIFIED Requirements

### Requirement: Musician profile

A member SHALL be able to list the instruments they play (guitar, keys, bass, drums, vocals, other), mark one as their main instrument, and, for guitar, pick the shapes they prefer among C, A, G, E and D. They SHALL do it on My account's Music tab, each instrument with its icon, or in a dialog that the musicians view SHALL open by itself the first time while they have none, and again from its Display menu ("What I play"); closing the dialog with nothing picked SHALL count as "Not now", and SHALL NOT ask again. The main instrument SHALL choose the member's default musicians layouts. Instruments SHALL be profile information, separate from roles. Instrument layouts, profiles, the question and keys for a service SHALL show while their feature (`instruments`) is switched on.

#### Scenario: Guitarist's defaults
- **WHEN** a member sets guitar as their main instrument and opens the musicians view on a phone
- **THEN** the Shapes over the words layout opens

#### Scenario: Asked once
- **WHEN** a member without instruments opens the musicians view for the first time
- **THEN** a dialog asks what they play
- **AND** after they close it, it doesn't open again, and "What I play" in the Display menu opens it

### Requirement: Chord colors in relative pairs

Once the `chordColors` feature is on, chords SHALL be colored for everyone reading them, and a member SHALL be able to switch on plain chords (one color) in My account's Music tab instead, where a button beside the switch SHALL explain the colors in a few lines, and examples SHALL show the degrees (C major's chords, named as the member names chords) and the suffixes, in their colors or, with plain chords, in the one color. With colors, the musicians view on their devices SHALL show each chord in a color given by its degree in the key it's played in, by its root: the same degree SHALL have the same color in every key, so G in D and B♭ in F, both 4, look alike. A minor key's tonic SHALL be 1, as for numbers. The colors SHALL be Relative pairs: the tonic in the text color; 1, 4 and 5 each a hue shared with its relative (6, 2 and 3 in major; 3, 6 and 7 in minor), the relative softer and the tonic's relative a faint tint, and the degree left over its own hue. A chord's suffix after a minor's "m" SHALL take its own color, on a ramp by tension (maj7, add and sixths grey, sus yellow, sevenths and extensions orange, diminished, augmented and altered red), mixed halfway with its letter's color, so it stands apart from the letter yet belongs to it. A slash chord's bass letter SHALL take the color of its own degree in the key. A chord or bass whose root is outside the key's scale, and a chord that isn't the key's own on its degree (D or D7 in C, a secondary dominant; in minor, 5 may be major or minor), SHALL take one color for outside the key, and without a key no chord SHALL be colored. The colors SHALL apply to chords over the words and to the bars of every musicians layout, whatever the member's note names, and to guitar shapes by the degree of the chord they play, and to the chords in the Chords mode, while the member edits. Each color SHALL reach a 4.5:1 contrast in light and dark. My account SHALL show the colors with their degrees, and the suffixes' ramp. Screens, projectors and members who switched on plain chords SHALL see no colors.

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
- **WHEN** a musician switches on plain chords in My account's Music tab
- **THEN** their chords show in the chord color, without degrees, and the examples beside the switch turn to that color

#### Scenario: Relative pairs
- **WHEN** a musician with chord colors reads a song in C with C, Am, F, Dm, G and Em
- **THEN** C is in the text color, F and Dm share a hue, G and Em share another, and Dm and Em are softer than F and G

#### Scenario: Suffixes apart, blended with their chord
- **WHEN** a song in C has G, Gsus4, G7 and Fmaj7
- **THEN** each G is in degree 5's color, the plain G has no suffix, sus4, 7 and maj7 are in three different colors, and G7's 7 is the ramp's seventh color mixed with degree 5's

#### Scenario: A bass note
- **WHEN** a song in D has D/F♯
- **THEN** the D is in degree 1's color and the F♯ in degree 3's

#### Scenario: Examples in Do-Re-Mi
- **WHEN** a musician who names chords Do-Re-Mi opens the Music tab
- **THEN** the degrees' examples read Do, Rem, Mim, Fa, Sol, Lam and Sidim, each in its degree's color
