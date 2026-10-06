# Design

## Context

The home (`CommunityHome`) opens the list response's `next` (`nextServicePlaylist`: the service under way or next), else the newest playlist. Visitors with follow-along on go to the follow page while something is live, which stays.

## Decisions

- **A started service counts as held.** The walk goes back from today through the schedule's services that started by now, newest first, and takes the first with a playlist; a service under way has started, so it comes first by itself. Alternative: from an hour before a service, show it to visitors, rejected by the maintainer.
- **The server answers both, the client picks.** The list response carries `held` beside `next`, and the home picks by membership once it's known who this is, so a member never flashes past a visitor's playlist. Alternative: the server answering by who asks, rejected since `next` also marks the list and opens new practice rooms.
- **Back 60 days, as `next` looks forward 60.** Further back, the newest playlist is as good a guess.
