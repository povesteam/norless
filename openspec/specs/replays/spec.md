# replays Specification

## Purpose
Let anyone watch again how a song went in a service: each moment a song went live, as a link to that second in the service's YouTube live stream.

## Requirements

### Requirement: The services' streams

With the community's YouTube channel set and the server's YouTube Data API key, Norless SHALL find each service's live stream by itself after the service: the channel's stream running when the service's first entry went live. It SHALL keep each stream it finds, with when it started and ended, and SHALL look again later for a service whose stream wasn't found yet, for up to 3 days. Without a channel or a key it SHALL keep none.

#### Scenario: After Sunday's service
- **WHEN** Sunday's service was streamed on the community's channel from 9:58, and its first entry went live at 10:02
- **THEN** within the hour after the service Norless keeps that stream, started at 9:58

### Requirement: A song's moments in the streams

Each moment an entry went live inside a kept stream SHALL link to that stream at that second (links, not a player), opening YouTube in a new tab. The song page SHALL list "Watch again": the song's service plays inside kept streams, newest first, at most 20, each by its date. A playlist shown in a service SHALL offer, in each entry's actions, "Watch in the stream" at the moment the entry went live in its last service. The statistics' most played songs SHALL each link their latest service play inside a stream. Everyone who can read songs and playlists SHALL see these links. They SHALL show only while the feature `replays`, added later and off until switched on, is on.

#### Scenario: Watch again
- **WHEN** "Har minunat" was played in two streamed services
- **THEN** its page lists both dates, newest first, each opening the stream at the second it went live

#### Scenario: A past playlist
- **WHEN** a member opens the actions of last Sunday's second song
- **THEN** "Watch in the stream" opens the stream where that song began

### Requirement: Correcting a stream's start

When the team or an owner types in the chapters dialog when the first chapter starts in the video found for it, Norless SHALL move that stream's start so the first chapter's moment falls there, and every link into the stream SHALL follow.

#### Scenario: The stream started earlier
- **WHEN** Norless found the stream started at 9:58, and the team types that the first chapter starts at 6:30
- **THEN** the stream is kept as started 6 minutes 30 seconds before the first chapter's entry went live, and the song links move with it
