# Rehearsal recordings design

Why recordings are made, cut, stored and shared the way the spec says.

## Decisions

- **No audio library**: the browser's `MediaRecorder` records and an `<audio>` element plays from a mark. A waveform library is for if a waveform with the songs marked is wanted.
- **Uploaded in numbered pieces every 5 seconds**: a piece the server already has is ignored, so retries are safe. The server finishes a recording that gets no piece for 2 minutes (a dead battery, a closed tab).
- **The screen stays on while recording** (the browser's wake lock), so a phone doesn't sleep and stop recording.
- **One upload, cut into a file per entry that was live**: each change of what is live is noted with its time in the recording. Entry changes cut the files, and part changes become marks inside a song. Short files keep a forgotten recorder from making one huge file, and each song plays and downloads on its own. A stretch under a second (a click past an entry) joins the one before.
- **m4a (AAC, 128 kbit/s)**: macOS can't open WebM or Opus (Finder and QuickTime), and m4a plays on Mac, iPhone, Windows and Android and is smaller than mp3 at the same quality. Browsers record Opus (Chrome, Firefox) or AAC (Safari), and the upload is kept as it came until cut.
- **Cutting with ffmpeg**: seeking before the input is fast and exact once re-encoded, and `+faststart` lets playback begin before the file has loaded.
- **Cutting is done by the converter, a separate container**: it reads files from people, so it can't reach the database, the stored files or the internet, and stays within a CPU and memory limit. Its Alpine ffmpeg is a quarter of Debian's size, which would have added about 400 MB to the app's image. While it is away, a recording waits as "processing" and the cut is tried again every 5 minutes. A file it can't read stays one file that plays from the start.
- **Kept on the VM's own disk until deleted**: about 25 MB an hour, and the disk alert at 80% covers running out. There is no automatic deletion. The Mac's backup copies new recordings with the same restricted key as the database.
- **A recording belongs to whoever made it**: voices are personal data, so the privacy notice names recordings, who can hear them and how to get them deleted. A recording from a laptop or a guest's phone belongs to the member who logged that device in, since the device's session ends.
- **Access requests live in the app**: a count beside Recordings in the menu, and the requests at the top of the recording with Grant and Refuse.
- **Guest musicians may record**, like the rest of the team.
- **On stage, names only to members**: stage screens show "Recording" with the name for members and without it on screens open to visitors, as for who changed the slide.
- **Download names**: the recording's date on the device and the song's title in the interface language, with the community's languages after it. Characters that file systems refuse are dropped, and a part that isn't a song uses its kind ("Prayer").
- **A song's recordings are the files cut for that song**: a song played twice in one recording counts twice, newest first, for the team and owners.

## Rejected

- **Cutting without re-encoding**: it keeps WebM or Opus, which macOS can't play.
- **ffmpeg in the app's image**: it is too large, and the app should not read untrusted audio itself.
- **Automatic deletion after a fixed time**: recordings are kept until someone deletes them.
- **Multitrack recording and mixing**: that is the sound desk's job.
