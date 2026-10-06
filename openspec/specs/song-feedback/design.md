# Song feedback design

Why likes, dislikes and excluding a song work as the spec says.

## Decisions

- **One opinion per member and song**: a unique row for each pair. Choosing the other replaces it, and choosing the same takes it back by deleting the row. Nothing syncs opinions, and a row per click would only grow.
- **A like is a favorite**: one thumbs-up both says "I like it" and keeps the song at hand in the empty search box. A separate star would ask people to press two buttons for one wish.
- **A dislike is saved with or without a reason**: the reason (up to 500 characters) is asked in a small dialog, and not required, so disliking stays one tap.
- **Who sees what**: members see the counts and their own choice. Owners also read each reason with the member's name, on the song page and in the Songs tab. Visitors and screens see nothing, since they see no names anywhere.
- **Only current members count**: a removed member's opinions stay in the table but no longer count. Deleting one's account deletes their opinions, as it deletes the ideas they sent.
- **Excluding is the owners' call, with a required reason**: a doctrinal objection is not a vote. It can be done and undone from the song's page or the Songs tab.
- **An excluded song is hidden, not removed**: search and browsing skip it, its page says "Not sung here" with the reason to everyone who opens it, and editors can still edit it. A playlist that already has it keeps it and can still project it, so a service never breaks at the last minute. The team sees a problem on that entry with the reason. Its plays stay, so the statistics stay true.
- **The Songs tab is for owners**: songs with at least one dislike, most dislikes first, with the reasons by name, then the excluded songs with their reason, who excluded them and when.
- **A change reaches open pages at once**: a like, dislike or exclusion publishes the song's change like any other edit.

## Rejected

- A separate favorites star: a like already does it.
- Removing an excluded song from playlists that have it: it would break a planned service.
- Showing counts or reasons to visitors: reasons carry names.
