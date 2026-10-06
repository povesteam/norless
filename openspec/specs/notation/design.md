# Notation design

Why short pieces of music notation are stored, shown and edited the way the spec says.

## Decisions

- **ABC notation in fenced blocks**: a part holds lines between a ```` ```abc ```` line and a ```` ``` ```` line, as in Markdown. ABC is plain text, small, versioned with the song and editable on any device. The lines inside are kept as written, blank lines too, and nothing in them is read as a chord, note or section name. A block alone between blank lines is a part of its own, so an intro can be only notes.
- **Blocks belong to the chord track**: they are the musicians' side of a song, so the team writes them like chords, notes and tempo. The server takes a save as a chord change when the words stay the same. Each block stays with its section.
- **abcjs (6.x, MIT) draws and plays them**: it loads only where a block is shown, so phones following lyrics don't download it. Its chunk is precached by the service worker, so staves draw offline on stage.
- **Keys layouts show blocks that aren't drums, drums layouts show drum blocks**: guitar and bass layouts show none. Blocks are drawn under their part's box, since a part box can be a button for controllers.
- **The key moves when shown, not in the text**: abcjs' `visualTranspose` and `midiTranspose` draw and play the block in the key for this service. Changing a song's key for good rewrites its blocks with abcjs, as it rewrites the chords. Drum blocks never move.
- **Play uses the song's tempo** as quarter notes per minute, else the block's `Q:`.
- **Sounds come from Norless**: the piano (C2 to C7) and 12 drum sounds of FluidR3_GM (CC BY 3.0, from the midi-js-soundfonts set), about 1.7 MB as mp3 files in `public/soundfont/`. They download only when someone presses play, and the service worker doesn't precache them. The About page credits them.
- **Editing is in the Chords mode, per part**: ABC text with a preview that redraws while typing, a click on a note jumps to it in the text, and play sounds it. A block that can't be read shows where. The song editor shows words only.
- **The drum grid writes plain ABC**: so a drummer needn't learn it, and the block opens in any ABC editor. Rows are hi-hat, snare and kick, with toms, crash and ride on request. 16 steps per bar in 4/4, 12 in 3/4, for 1 to 4 bars.
  - The text is `L:1/16`, `K:C clef=perc` and a `%%percmap` per drum: kick F, floor tom A, snare c, mid tom d, high tom e, ride f, hi-hat g and crash a (the last three with an x head).
  - Each hit lasts until the next hit in its beat, and beats are spaced so the beams follow them.
  - A block opens in the grid when every note in it is one of the grid's drums at whole steps. Otherwise it opens as text.

## Rejected

- Full scores and MusicXML import (OpenSheetMusicDisplay), and engraving-quality output (Verovio): the pieces are 1 to 4 bars, and a short snippet should be quick to edit.
- Guitar tablature for riffs: abcjs could do it if guitarists ask.
- Recording notes from a MIDI keyboard or drum kit: iPhones and iPads can't do Web MIDI.
