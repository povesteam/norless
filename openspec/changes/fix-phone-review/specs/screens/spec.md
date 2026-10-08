## MODIFIED Requirements

### Requirement: Vocalists layouts

A vocalists screen, or a member opening the vocalists view on their own device, SHALL be able to use these layouts:
- **Whole song**: every part in the song's order, scrolling by itself to keep the live part in view, and a map of the parts along the edge
- **Sideways**: for a phone on a microphone stand, the live part on the left and the whole next part on the right; held upright, the next part under the live part
- **Tablet**: every part in two columns, in one or both languages, and the next song's title and first line at the bottom

The text SHALL be in the member's language by default, with one button showing the shown language's flag, or a globe for all of them, that opens the choice of each of the community's languages or all. Lines too long for the width SHALL wrap, never be cut off. In Whole song the live part SHALL be larger than the others only as far as its longest line still fits the width, so enlarging never wraps a line. For members who can control live, every layout SHALL keep previous and next visible, and a tap on a part SHALL send it live. A tap that starts a scroll SHALL NOT count. A swipe to the left or right SHALL go to the next or previous part in Sideways, and in Whole song, for members who can control live, to the next or previous song; a tap or a drag over Whole song's map of the parts SHALL go to the part under the finger: live for members who can control it, and otherwise on their own device only (Sideways back to live when the live part moves; Whole song scrolls to that part). Whole song SHALL scroll to the live part fast enough to keep up with a finger running over the map, and SHALL end with the whole part in view above previous and next, the last part too. Previous and next SHALL stay at the bottom of the screen whatever is live, a Bible passage too. On a member's device, the live song's key SHALL be in the toolbar's row of icons, beside the language button, and the line under the toolbar (recording, led by) SHALL show only while its features are switched on, so a song without them doesn't lose a row.

#### Scenario: The laptop falls behind
- **WHEN** the band starts verse 2 and the projector still shows the refrain
- **THEN** a vocalist sees all of verse 2 as the next part, and can tap it to send it live

#### Scenario: Scrolling doesn't send a part live
- **WHEN** a vocalist drags the whole-song layout to read ahead
- **THEN** nothing goes live

#### Scenario: A long line on a phone
- **WHEN** the live refrain has a line longer than the phone is wide
- **THEN** the line continues on the next row, and nothing is cut off

#### Scenario: Running a finger down the map
- **WHEN** a vocalist on the team runs a finger from 1 to 4 on the map in Whole song
- **THEN** the parts scroll along without lagging behind, and part 4 ends wholly in view above previous and next

#### Scenario: A Bible passage is live
- **WHEN** the Bible reading is live while a team member has the vocalists view open on a phone
- **THEN** "No song is live" shows, and previous and next stay at the bottom of the screen

### Requirement: Between the playlist and one's stage view

On a phone, the playlist's bar SHALL have a button to the stage view of what the person plays (Vocals for singers, Instruments for the others), with the icon of their main instrument (a microphone, a guitar for guitar and bass, a keyboard, a drum, or a note for other), while the stage views are switched on and the person chose what they play; the Vocals and Instruments toolbars SHALL start with a button back to the playlist, as big as the toolbar's other buttons.

#### Scenario: A singer during the service
- **WHEN** a singer on a phone looks at the playlist, taps Vocals in its bar, then the playlist button in the toolbar
- **THEN** they are in the Vocals view, then back at the playlist, without opening the menu

## REMOVED Requirements

### Requirement: Look ahead

**Reason**: Its row of arrows took a line of a phone's screen in both stage views; the views show what's live, and the playlist is a tap away.
**Migration**: None: the views always show the live song. To read another song, open the playlist.
