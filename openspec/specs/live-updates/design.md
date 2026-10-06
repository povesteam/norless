# Live updates design

Why open views follow data changes without a reload, as the spec says.

## Decisions

- **The server says which tables changed, and views load them again**: the change log's triggers announce `{ tables: [...] }` on `changes:<slug>`, once per tick. There is one way of reading data, so no view needs its own push format.
- **Each view lists its tables** (`useChanges(slug, "screens")`), so a recording that grows every 5 seconds reloads the recordings page and nothing else.
- **Open to anyone**: the notice names only tables, never data.
- **Logged tables announce real changes only** (a save that changes only the time doesn't); logs and people's own records (plays, the live log, likes, ideas, song revisions, recording parts, tempo checks, screen connections) announce every write. Accounts, sessions and usage events announce nothing.
- **Changes 150 ms apart load once**, so a burst of writes costs one reload.
- **A returning live connection reloads every view**, since changes may have been missed while it was down.
- **Open forms don't reload**: editors start from the record once and keep what's typed, while the lists beside them reload. The song editor keeps its own check of sections changed meanwhile.
- **Views that have their own topic keep it**: a playlist, the playlists, a song and the live state.

## Rejected

- Pushing the data itself: it would add a second way of reading every table.
- Refreshing a form under the person typing.
