# Chord editing design

Why chords are kept apart from the lyrics and how musicians put them in, as the spec says.

## Decisions

- **The team may change chords, never words**: musicians keep their chords in phone notes and chats, but must not touch what everyone sings. The Chords mode saves the track alone, which has no words, so the server needs no diff to check it. A musician's change shows for everyone at once as a revision with their name, and an editor can roll it back. There is no approval queue.
- **One chord track for every language** (`songs.music`, JSON), apart from the words (`song_versions.lyrics`): verses mostly share their chords and refrains have their own, so differing chords are the exception. Most translations are literal, and their syllables don't follow the Romanian melody, so chords can't live on the words of each version.
- **A chord's place is its position along the line**: stored in letters, with the length of the line it was written over, so it scales to any line. It is a guide to what to play and when, not notation. On the imported songs, spreading verse 1's chords this way put 195 of 225 on the right word (0.8 letters off on average). Counting syllables put 176.
- **Patterns with defaults**: every section follows its type's pattern, unnamed parts too, since they are mostly verses. The first section of a type to get chords sets the pattern. The same line count takes chords line by line. Another count spreads them over the section as one line. Nobody has to say anything to get the common case.
- **Notes and notation blocks stay with their section**: an intro's notation repeated before every verse would be wrong more often than right. Parts without words (an intro of chords only) keep their place between sections.
- **"All verses" or "Only this one" is asked in the chord picker, each time**: the default is all. Only this one gives the part its own chords, which changes to the pattern don't reach. The choice sticks for that part while the Chords mode is open.
- **Putting a chord in**: tap a letter, then pick. The row offers the chords the song already uses, then the key's six (I, ii, iii, IV, V, vi, from `tonal`), then "other…". A chord drags to another letter, and ← and → move it a letter for keyboards. Chords are stored as letters (C D E); Do-Re-Mi is converted on import and only shown by preference.
- **A key change moves the whole track** (chords and notation) and saves it with the track it started from. Someone else's change in between is a conflict showing both, as for the Chords mode.
- **Held chords are `_` after the name**: `| C__ G |` is three beats of C and one of G. The chord keeps its column, transposing keeps the suffix, and the track and patterns carry it like the chord. Equal lengths are stored as none (lengths are divided by their common factor). `_` already means a spacer in lyric rows, never in chord rows.
- **Beats are set only in the Chords mode, by dragging**: a slider (React Aria through HeroUI) under each bar of two chords or more, one thumb per chord end, one step per beat of the time signature's top number (4 without one). A thumb stays a beat from its neighbors, arrow keys work, and it saves when let go. A bar with more chords than beats splits equally. Nobody has to learn rhythm notation; notation blocks cover rests and ties.
- **The bar grid is aligned**: bars sit on one line when they fit, else one row per chord line when the longest line fits, else the fewest equal rows (2 to 4). Every column has the same width, measured before the first paint so nothing jumps.
- **Tempo is 30 to 300 BPM, typed or tapped**: the tap is the average of the last 8 taps at most, restarting after 2 seconds without one, rounded to a whole BPM.
- **History**: each save with who, when and what changed. Editors and owners restore, and a restore is a save, so the state before it stays and a restore can be undone. Visitors see no history, as they see no names.
- **Piano chords: MIDI in the browser, Norless connects the piano**: Web MIDI for cables and pianos the system already connected, Web Bluetooth with the BLE MIDI service for the rest. The browser's chooser needs a tap the first time. Where the browser remembers permission, the piano reconnects when the Chords mode opens. A device asks for MIDI only after "Use a piano", so a device without a piano isn't asked every time. The piano is let go when the Chords mode closes.
- **Tap, then play**: the chord goes over the letter when every key is let go, taken from the most notes held at once, so a rolled or unevenly released chord is one chord. Holding a chord and then tapping a letter puts it there at once. This works with the phone in one hand and the keys under the other.
- **Naming the notes**: `tonal`'s `Chord.detect`, the first candidate among the usual types, the lowest note as the bass (E/G#), spelled for the song's key (Bb in F). It shows from the first key. One note is its major chord. Two notes go by their interval from the lower one, as a keyboard's one-finger chords do (a minor third is minor; a sixth or a fourth names the upper note). A second or a tritone names nothing. A power chord (C5) is rarely what a chord sheet wants.
- **Listening names only major and minor chords, and offers them**: the analyser's 16384-point spectrum is folded into the twelve pitch classes from 55 Hz to 2 kHz and matched to the 24 triads by cosine. A chord shows once heard in three of four readings, about seven a second, and quiet input shows nothing. It goes into the picker rather than being put in: sound doesn't say when a chord ends. No library was needed.
- **The wheel is an SVG**: majors outside, relative minors inside, the key at top, labels staying upright while the ring turns the short way. The dot sits on the chord MIDI names. From audio each chord pulls it by its fit to the 8th power, so it lands on a clear chord and drifts to the middle when several fit.
- **Libraries**: `tonal` (MIT) for notes and chords, `diff` (BSD) for the history and for aligning a chord over the same letters of a line. ChordSheetJS is GPL-2.0-only, which can't be combined with AGPL-3.0.

## Rejected

- Chords inline per language, on a line above the words: every verse repeats them, and a translation can't share them.
- Placing chords by syllable: it put fewer chords on the right word than position along the line did.
- A track per language: the translations are literal, one track is enough.
- Pasting a chord sheet, and ChordPro or other chord-site imports: unused. A round trip of Norless's own songs put only 78% of chords in place, and uncommon layouts failed.
- An approval queue for musicians' changes: the history and the rollback are enough.
- Rhythm marks (rests, pushes, ties across bars) in the chord rows: notation blocks do that.
- Seventh chords and inversions by ear: listening names major and minor only.
