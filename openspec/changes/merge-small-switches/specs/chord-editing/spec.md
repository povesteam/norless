## MODIFIED Requirements

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
