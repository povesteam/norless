# Playlist export design

Why a playlist's lyrics and YouTube chapters come out the way the spec says.

## Decisions

- **Made in the browser**: the page already holds the songs, so there is no server route. Print is the saved HTML drawn in a hidden frame, whose print styles drop the contents, the links and the theme switch.
- **Available to everyone, with Classic**: singers used a contributor's browser extension for this, which stops working with the old app. Visitors can export too, because playlists are public.
- **One language per export**: the interface language when the community has it, else the community's first; the reader can pick another. No side by side.
- **Songs are numbered** in the contents and in the copied text, so a chat shows where each song starts.
- **Repeat marks (×2, ×3) stay** after the last repeated line, as the projector shows them.
- **Refrains**: print and HTML write a repeat in full, since a reader on paper shouldn't flip back. Copy writes an identical repeat as its name alone, to keep chat messages short. A repeat whose text differs is always written in full. These are the rules the extension used.
- **Playlist order and local dates**: the export uses the playlist's explicit order, and the file name takes the playlist's local date, not UTC.
- **The file's own words** (contents, back to top, light or dark) are in the export's language, like its songs.
- **No chords, no PDF generation**: the browser's print dialog saves a PDF, and chord sheets for musicians are a separate feature.
- **A live log, apart from plays**: each time the live entry changes, one row keeps the playlist, entry, mode and time (`live_log`). Plays only keep songs, and only from 30 seconds; chapters also need readings, the sermon and text slides.
- **Which service**: the playlist's last day with service rows in the log, counted by UTC calendar day. Rehearsals on other days, or earlier the same day, don't count. A playlist never live in a service says it has no chapters.
- **Which entries become chapters**: live for at least 10 seconds (YouTube's shortest chapter), in the order they went live. An entry shown again is a chapter again, but never twice in a row. The entry still live is the last chapter.
- **The offset comes from the stream**: with a YouTube Data API key on the server and the community's channel (set by owners in the Schedule tab, where the services' times are), the server finds the stream whose actual start and end hold the first entry's time, and the first chapter sits at its live time minus the stream's start. It reads the channel's uploads playlist (the channel id with `UU` for `UC`) and `videos.list` with `liveStreamingDetails`, 2 or 3 quota units of the 10,000 a day; streams are in the uploads once they start.
- **Filled in, still editable**: what's typed wins, since a video trimmed at its start moves every chapter; the dialog says which stream the time came from and links to it. Without a key, a channel or a match, the time is typed; a YouTube error is logged, not shown, and owners without a channel get a link to set it. The rest of the chapters follow at their real distance; YouTube wants the first at 0:00, so with an offset a translated "Start" line comes first.
- **The key stays on the server**: the browser never calls YouTube, and only channel and video ids go to Google.
- **Chapter format**: one per line, `m:ss Title`, or `h:mm:ss Title` from an hour, as YouTube reads them. Titles are in the copier's interface language: a song's title, a reading's reference, a divider's or text slide's first line.
- **Members only**: chapters are in the actions menu for any role; visitors don't see them.

## Rejected

- Sending chapters to YouTube through its API: it needs the channel owner's consent, and Copy is enough.
- YouTube's `search.list` to find the stream: 100 quota units a call, where the uploads cost 1 or 2.
- Chapters for rehearsals, and timestamps for slides inside a song: the video's description is for the service.
