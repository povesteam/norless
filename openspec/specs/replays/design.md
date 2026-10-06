# Replays design

Why song moments link to the services' YouTube streams the way the spec says.

## Decisions

- **Links, not a player**: a moment is `watch?v=<video>&t=<seconds>s`, opened in a new tab. YouTube already plays and seeks well.
- **Streams are kept in a table of their own**: video, start and end. A moment belongs to the stream running when it happened, so two services streamed on the same day each get theirs.
- **The link's second**: the distance from the stream's start to when the entry went live (for a song, the play's time).
- **Found by an hourly job**: it runs at server start and every hour, for each community with a channel. It looks at the service days of the last 3 days (service rows of the live log) whose first entry no kept stream covers, and asks YouTube for the stream with the Data API (2 or 3 quota units a lookup, of 10,000 a day). A service that was never streamed costs one lookup an hour for 3 days, then stops.
- **The stream's start is a guess the team can fix**: the chapters dialog sends the video and when the first chapter starts in it; the stream's start becomes the first chapter's moment minus that time, so every link follows. People who only read chapters don't change it.
- **A stream not found yet gets an end**: a correction typed before the job found the stream keeps it until 6 hours after its start.
- **Where the links show**: the song page ("Watch again": at most 20, newest first, nothing when there are none), a past playlist's entry actions ("Watch in the stream", only in a playlist shown in a service), and the latest service play of each most played song in the statistics, as a small link beside its count.
- **For everyone who can read songs and playlists**, behind the feature `replays` (Songs branch, needs nothing), off until switched on.

## Rejected

- An embedded YouTube player: a link in a new tab gets people to the second without any player code.
