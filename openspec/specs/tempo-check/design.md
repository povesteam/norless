# Tempo check design

Why the tempo hint listens, measures and speaks the way the spec says.

## Decisions

- **The beat detector is realtime-bpm-analyzer** (Apache-2.0, no dependencies), run in the audio worklet it brings along. It reads a live stream, which is what a band playing in the room is.
- **Analysis stays on the listening device**: the audio is never uploaded for this feature, which saves bandwidth and keeps voices off the server.
- **One listening device per room**: switching it on elsewhere takes over, so two devices never send competing readings, and the others show who listens.
- **The mixer feed is the dependable input**: a room microphone also hears the PA and the room's echo, so its readings are less reliable. The kick or drum bus over USB is the best source.
- **The input is remembered per device and per use** (Record and Listen for tempo have their own), in the browser. If it is gone (a mixer unplugged), the choice window opens with the problem shown.
- **It shows what it hears, even without a target tempo**: without a sign that it hears anything, an operator can't tell whether it works until a song with a target is live. The level is the input's loudness, updated about 15 times a second without re-rendering the page.
- **Half and double time count as the target**: beat detectors often hear the eighth notes, so 144 for a song at 72 is read as 72.
- **4% for 8 seconds**: a short push in a build-up must not trigger a hint, and the hint is meant to be quiet. A change of direction restarts the 8 seconds. Owners can change both numbers.
- **Silence shows nothing**: no reading for 4 seconds clears the hint.
- **The hint travels with the live state**: the listening device sends only changes (the hint, and the measured tempo every 2 seconds while it shows). The server adds them to what stage screens already receive, with names for members only, and keeps them in memory, not across restarts.
- **Checks feed suggestions**: when a song ends, the listening device keeps its median reading as a check, if it has at least 10 readings. The song page suggests the median of the last three checks when it is 2 BPM or more from the target, or the song has none. A measured tempo is only a suggestion, never applied by itself, so a band that drifted can't move its own target.
- **Tempo suggestions come from the live checks**, not from analyzing recordings.

## Rejected

- **web-audio-beat-detector**: it works on a finished audio buffer, not a live stream.
- **Playing a click to the band**: the point is a quiet hint, not an in-ear click.
- **Hints on the projector or the broadcast overlay**: the audience is not the band.
- **Hints for songs without a target tempo**: there is nothing to drift from.
