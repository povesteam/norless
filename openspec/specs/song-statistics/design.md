# Song statistics design

Why the Statistics page and a song's history count and show what they do.

## Decisions

- **Only service plays count**: rehearsals and unclassified imported plays never do, as the `plays` spec says, so the numbers describe what the church sings in services.
- **Services, not plays, are counted**: a song's count is the number of service days it was played on, so a song played twice in one service counts once. "A service" is a day with service plays.
- **Days follow the calendar in UTC**: a 10:00 service in Bucharest falls on the same UTC day, so months, seasons and years come out right without time zones.
- **Seasons**: winter is January, February and December of the picked year, so Christmas songs rank as winter songs.
- **Most sung** lists 25 songs. **Not sung lately** needs 3 services in all and none in 6 months, so a song tried once or twice isn't called forgotten, and lists at most 50 songs, most sung first.
- **Members only**: any role sees the page and a song's history; visitors don't. It is reached from the community's menu and from song pages.
- **The last 4 services**: the 4 latest days with service plays in the community, or as many as there are. Counting days with plays, not scheduled services, lets a cancelled Sunday or a Christmas Eve service count as it happened.
- **The hint starts at 2 of the last 4**: a song is rarely played twice in a month, so 2 is already worth a second look. It is a warning in words in the search results, not a refusal. The Statistics page lists the same songs, most first. Excluded and deleted songs are left out of the list.
- **The year recap shows for a whole year only**: it is the year's story, not a season's. The current year counts so far. "New" means the song's first service play ever falls in that year, imported plays included, so an old year's new songs are those the old app first played then. Deleted songs count in the numbers but aren't listed; up to 50 are, by first date.
- **The services grid is a table, not a picture**: a column per day, a row per song, a mark where it was sung, so screen readers read it as a table. 12 services is about three months of Sundays. On a phone it scrolls sideways with the titles staying in view. Rows are the songs sung in those services, most sung first, then latest.
- **Search misses are counted when the search box closes**, once per search per page. Counting at every keystroke would count every prefix of "Oceane". A search is a miss only when it finds no song and no Bible passage; the server checks again before keeping it, so a stale or odd client can't fill the list.
- **No names in search misses**: the text and the time are kept, nothing about who searched.
- **Misses are folded together** without case, diacritics or extra spaces, shown as the latest way typed, and drop out as soon as a song finds them, so adding the song clears the list. The window is 90 days, and a search needs 3 characters.
- **Spam limit**: at most 30 misses an hour from one address, counted in memory; enough against a stuck client.
- **Only editors and owners see misses**, because they are the ones who add songs; New song opens the editor with the title filled in.
- **One switch for the statistics**: the Statistics page brings its views (the year in songs, the services grid, the rotation hint, the search misses). Nobody would switch one on without the page, and each switch costs a key, an icon, a node in the graph and strings in three languages.

## Rejected

- Warning from 4 of the last 6 services: songs are rarely played twice in a month, so 2 of the last 4 is the right bar.
- Keeping who searched for a missing song: the text and how often is all the planner needs.
- A switch per view: five switches for one page made the graph longer without a real choice.
