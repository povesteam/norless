# Instrument layouts design

Why the musicians' layouts, note names, keys and chord colors work as the spec says.

## Decisions

- **Profile picks the defaults, nothing is hidden**: the main instrument and the device type choose the layout (guitar: Shapes over the words on a phone, the chart on a tablet or laptop; keys: Concert pitch; drums: Big cue on a phone, Parts by bars on a tablet or laptop; vocals and other: the plain chords layout). Every layout stays in the menu for everyone, and the bar grid and chords over the words stay for musicians without a profile.
- **A layout menu, not toggle buttons**: ten layouts don't fit as buttons, so the menu offers those made for the device type.
- **One row of icons on the stage views**: the musicians and vocalists views keep their controls in one row of icons, on every device, so the song gets the room and both views look alike. Names show in a tooltip on hover, keyboard focus and a half-second long-press (the long-press doesn't press the button; a short tap does). A button that is running (recording, listening, sharing) keeps its words, since that is information, not a label.
- **"What do you play" is a dialog, once**: it holds the Musician section of My account as it is and saves as things are picked. Closing it with nothing picked is a "Not now" kept on the account. It is asked only while the feature is on. A fifth row of buttons would push the chords halfway down a phone.
- **Songs store letters only (C D E F G A B)**: names are rendered per member. There is no H, since nobody in the band reads it. Do-Re-Mi is a lookup table over tonal's letters, because tonal has none.
- **Numbers count from the tonic**: a minor key's tonic is 1 (not its relative major's), `m` marks minor, `b` and `#` mark notes outside the scale, `/` the bass. E, A and B/D# in E are 1, 4 and 5/7.
- **Libraries**: tonal transposes and gives degrees and slash-chord basses. svguitar draws chord diagrams and is imported only by the tablet chart, so other layouts never download it. The table of preferred shapes is our own, since the shape databases on npm are pre-1.0.
- **Shapes and capo**: the shapes are C, A, G, E and D, and a minor key uses its relative major's shape (Am is played with C's), so the capo works for minor songs. The capo is the lowest fret from 0 to 7 where one of the member's shapes fits, ties going to the first in C, A, G, E, D order, so the answer is stable.
- **Key changes in half steps** ("A → C, up 3 half steps"): it is what a capo or a transpose button counts, and it reads the same for everyone.
- **A service key applies everywhere the entry's song shows**: layouts, stage monitor, projector's key line, bible.com header and playlist. The song keeps its own key; "Make it the song's key" is a separate, explicit act.
- **A permanent key change moves the chord track in every language**: the browser transposes the track by the same half steps, and the server stores it with the new key as one named revision. It refuses if the song changed meanwhile. Keys the team sets are stored in letters; keys already in Do-Re-Mi are read as keys wherever they parse.
- **Saved songs and changed playlists republish the live view**, so a new service key or new chords reach the screens at once.
- **Drums' energy is a guess**: verse calm, refrain full, bridge and pre-chorus building, and a `! drums:` note on the part wins. The big cue shows the part's short label (1, R, B), which fills a phone.
- **Player notes go by prefix**: a note is addressed by a word (Romanian, Ukrainian or English) or an emoji for its instrument (drums, keys, bass, guitar). Notes for everyone show to everyone, and other players' notes stay hidden.
- **Projected slides never show chords**, and colors never show on screens either.
- **Live chord, best source wins**: a MIDI piano knows the chord, the mixer hears one instrument, a microphone hears the room, so the ranking is MIDI, mixer, microphone, the latest among equals. A device shares on each change and every 5 seconds, and one silent for 15 seconds stops counting.
- **Live chord is held in memory, on its own topic**: it is of the moment, and a separate topic keeps the live view from being republished for every chord.
- **Live chord is a layout, not a box in every layout**: the chord is the whole layout, big, in its degree's color in the played key whatever the member's chord-colors switch.
- **Chord colors are per member, off by default**: the switch reaches only the member's own devices. Screens and projectors have no member, so they show none.
- **Color by the root's degree, taken from the letters**: the degree comes from the chord in letters, in the key it is played in (service key, else the song's), before any renaming. Numbers, Do-Re-Mi and guitar shapes then color alike, and a capo moves a shape and its key together. G in D and B♭ in F are both 4. Without a key there is no tonic, so nothing is colored.
- **Relative pairs**: chords that can stand in for each other look alike. The tonic is plain (the text color), so color means "away from home". 1, 4 and 5 each share a hue with their relative (6, 2 and 3 in major; 3, 6 and 7 in minor), the relative softer. 4 and its relative are blue, 5 and its relative green, the tonic's relative a faint lavender, the leftover degree cyan. Warm hues are kept for the suffix ramp, so letters and suffixes don't look alike.
- **Color science**: each color is an OKLCH color at lightness 0.62, mixed 75/25 toward the text color in OKLab. Only hue and chroma vary, so every color reaches 4.5:1 in light and dark; axe checks it in the end-to-end test.
- **Suffixes get their own ramp**: read after a minor's "m" (which stays with the letter), on four steps by tension: maj7, add and sixths grey; sus yellow; sevenths and extensions orange; diminished, augmented and altered red. G7sus4 counts as a seventh, Bm7b5 as red, and text after a slash that isn't a bass (C6/9) takes the suffix's color. Because the suffix has its own color, G, Gsus4 and G7 differ clearly while the letter keeps its degree.
- **Suffixes blend with their chord**: the ramp color is mixed 50/50 (OKLab) with its letter's color, so the suffix stands apart yet belongs to its chord. On the tonic it mixes with the text color, so C7's 7 is a paler orange.
- **A bass note has its own degree**: D/F♯ in D shows the F♯ in degree 3's color.
- **One color outside the key**: magenta, for a root or bass off the scale and for a chord that isn't the key's own on its degree (D or D7 in C, a secondary dominant; borrowed chords). A chord is the key's own when its triad matches the degree's (major: M m m M M m dim; minor: m dim M m either M M). Sus and power chords fit any degree, and sevenths and extensions don't change the triad. One color for all exceptions beats five more hues nobody could learn.
- **Where colors apply**: chords over the words, chords-only lines, the bars' beats, guitar shapes (by the degree of the chord they stand for) and the Chords mode while editing. The picker's buttons stay plain, since they are choices, not the song. The lines that join chords into a sentence ("ends on … starts on", the next song's chords) stay plain, since a color per word reads badly.
- **Each chord carries its CSS colors** (letter, suffix, bass) rather than a degree number, so a view paints what it is given.
- **My account shows a legend** of the degrees and the suffix ramp (mixed with the text color), so the colors can be learned without a chart elsewhere.

## Rejected

- **A hue for each of the seven degrees**: too colorful, and G, Gsus4 and G7 looked alike.
- **Four other schemes** (by tension, calm to tense, two families, less common stronger): tried on real songs next to Relative pairs and dropped with the scheme picker. One scheme means no preference to keep.
- **Flavour shifting the whole chord's color**: the difference between a chord and its seventh was too small; the suffix carries it.
- **Text color for chords outside the key**: it looked like the tonic.
- **The relative major's tonic as 1 for minor keys**: Am in A minor is 1, as the numbers already say.
- **The letter H**: nobody in the band reads it.
