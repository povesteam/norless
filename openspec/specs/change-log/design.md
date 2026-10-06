# Change log design

Why every change is recorded the way the spec says, and why the Changes page shows it the way it does.

## Decisions

- **Triggers made from the schema at startup**: the server creates temporary triggers on its own connection, one set (insert, update, delete) per followed table, rather than a call at each of the hundred or so places that write. Nothing the app writes is missed, a new column is logged without code, and nothing is added to the schema, so the rules stay in code (`database`). Writes from the `sqlite3` shell or the import aren't logged, because the triggers live with the app's connection. The same triggers tell open views which tables changed (`live-updates`).
- **Who comes from the request**: each request runs inside an `AsyncLocalStorage` holding its user, which a SQL function the triggers call reads, so no code passes the user around. Jobs the server runs by itself (the next service's playlist, cutting recordings) have no user and show as Norless.
- **What is followed**: the community's own records, which are songs and their texts, playlists and entries, members, screens and paired TVs, pages, the schedule, rooms, settings, recordings and who can reach them. Not followed:
  - logs that are their own history (plays, the live log, usage events, tempo checks, screen connections, song revisions);
  - sessions and login links, which are secrets;
  - people's accounts, likes and ideas, which are personal and erased with the account.
- **Each row keeps the whole record as it became**, plus each changed field's value before and after, so a record's history can be rebuilt. Secret columns (a screen's link, a TV's token) and columns that change by themselves (the live slide, a recording's size) are left out of the row, not only of the comparison. A save that changes nothing but `updated_at` or `updated_by` isn't logged.
- **A deleted account keeps its changes without its name**: the user is cleared on each change. The history is the community's, where feedback and likes are personal.
- **Soft deletes read as removed and restored**: they are updates of `deleted_at`. A new position reads as "moved".
- **Owners only**: the log shows what members did, so only the people responsible for the community read it.
- **Older changes, not a date picker**: the log is read from the newest, so "Older changes" loads the next 100.
- **Only what changed, in words**: a field that stores an object (a screen's settings, the theme, preferences) lists each changed key with its before and after, and nested objects say "edited". The whole stored value was too noisy to read. Feature switches change many at once, so they read as the features switched on, then those switched off, by name; a feature missing from the stored switches counts as off.
- **Lists by item name**: a list field shows its items by name (a text's first line, a link's title), those that went and those that came.
- **Quick changes fold into one**: updates of one record by one person, each within a minute of the next, show as one from the oldest value to the newest, and not at all when nothing differs, such as a feature switched on and off again.
- **Long texts as a diff of lines**, as song History shows them.

## Rejected

- Using a database's own replication log as the history (MongoDB's oplog): it is a rolling window of recent writes, not a history.
- A write call at each place that changes data: one missed place means a silent gap.
- Restoring a record from the log: song History keeps its own restore, and the log is for reading.
- Logging users' own accounts, likes and ideas: they are personal.
- The whole stored value as a JSON diff, and a line per feature switch: both buried the change.
