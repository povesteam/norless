# Service schedule design

Why the schedule drives the mode, the next service's playlist and the classification of imported plays.

## Decisions

- **The schedule replaces asking the operator**: the community already knows when its services happen, and a question every time adds friction and gets skipped. The mode comes from the event in progress, so play statistics are right without anyone doing anything.
- **An event counts from its start to 30 minutes after its end**: services often run late. Nothing before the start counts, because rehearsals usually happen right before a service. With no event in progress, the mode is rehearsal, and nobody is asked. One function (`classify`) gives live control the mode for an instant.
- **The mode is never set by hand**: a switch was confusing. An unplanned service gets a one-off event in the schedule.
- **Owners only**: the schedule is read and changed by owners, in the settings' Schedule tab. The server reads it for everyone's mode.
- **Three kinds of event**: recurring weekly events with optional first and last dates, one-off events, and cancelled single occurrences. A one-off wins over a recurring event at the same time. Past periods with other times are separate recurring events with their own dates, which is how years of imported plays get the right times.
- **Times are `HH:MM` in the community's time zone**, and an event ends on the day it starts. Deleting is a soft delete. A cancellation picks a recurring event and a date on its weekday.
- **The next service's playlist is made 30 minutes after a service ends**: empty and untitled, named by the service's date, so planning can start any day that week and the home opens it. A check runs every 5 minutes in the server, so a server that was down catches up. The next service is worked out from the present, not from the one that ended, so downtime never creates a playlist for a service that already happened. None is made when a playlist was created since the service ended: someone was quicker.
- **Rehearsals get no playlist**: a rehearsal practices the songs of the next service, so it uses that service's playlist. The home and a new practice room open the playlist of the service under way or next, so a playlist made since for something else doesn't take its place.
- **Imported plays stay out of the statistics until classified**: after defining the schedule, past periods included, an owner runs the classification. Each unclassified play gets the type of the event it falls in (start to 30 minutes after the end), or rehearsal when it falls in none. No play is deleted.
- **Classification can run again**: it asks first, runs in one transaction over all imported plays (about 26,000, well under a second in SQLite), then says how many became service and rehearsal plays. Only imported plays are reclassified; plays Norless recorded keep the mode they had. Editing past periods changes statistics only after classifying again, which the page says.

## Rejected

- A mode switch on the live bar, behind a menu with a confirm, or for owners only: it was confusing, and the schedule plus a one-off event covers the unplanned service.
- A mode held by hand until the schedule's mode changes or another playlist goes live: it could stay wrong for hours.
- A separate playlist for each rehearsal: rehearsals rehearse the next service's songs.
