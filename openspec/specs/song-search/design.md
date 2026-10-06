# Song search design

Why the search box finds, suggests and behaves the way the spec says.

## Decisions

- **SQLite FTS5 does the search**: the `songs_fts` table uses the `unicode61 remove_diacritics 2` tokenizer, so "isus e domn" finds "Isus e Domn" with no extra service. It indexes each version's title and its words, never chords, section names or notes. `indexSongs` in `search.ts` keeps it up to date: every write of a song's text calls it for that song (one helper covers saves, section edits and History restores), and the import and the seeds rebuild it after their bulk writes. Deleted versions stay indexed and are left out by the search's join.
- **One index across languages**: a song is found by any version's title or words. Folding Cyrillic й into и is accepted: the query is folded the same way, and stored text never changes.
- **Title matches rank above word matches**: two queries are joined, titles first, each sorted by `bm25`, and every typed word matches as a prefix. Results stop at 25 songs.
- **A Bible reference replaces the song results**: book, chapter, optional verses, any non-digit separators. Book names match without diacritics as a substring of the name in any community language, so one query can match several books ("ioan" also finds "1 Ioan"). A book is listed only if it has the chapter. A static list of the 66 books carries the names, chapter and verse counts and the codes bible.com needs. Book names aren't copyrighted. A query with no chapter number is a song search.
- **Every other search ends with a divider and a new song**: everything the operator types can be added without leaving the keyboard. Nothing is created until "Save and add to playlist", so closing the editor leaves no empty songs.
- **Typing anywhere starts a search, and the first result is always selected**: Enter adds it. The selection is a filled frame in the soft accent fill, as a selected playlist entry has. A grey fill hid the options' grey chips. The focus ring shows only after Up, Down, Page Up, Page Down, Home or End, because a phone's keyboard counts as keyboard use and showed both the ring and the frame. The tags field's options look the same.
- **The empty box suggests**: up to 5 songs for each reason, a song once with its first reason, none already in the open playlist, then random songs up to 100 in all. Excluded songs never show.
  - Liked: the member's own, last liked first.
  - Played lately: sung in one of the last 4 services, longest ago first. A song sung in two of them is left out, since the rotation hint warns against it.
  - Not played lately: the Statistics page's list (3 services or more, none in 6 months), so "lately" means one thing across the app.
- **Enter picks the first song, not an action**: the actions and the hint come first, but Enter adds a song.
- **While open, the box and its results take over the screen**: the box at the top, the results filling the rest. They end above the live bar, or the keyboard on a phone, so Previous, Blank and Next keep working. This holds in every search box, on every device.
- **The takeover is one fixed panel with an inline list**: a popover would hide the rest of the page for React Aria and make the "After …" chip's × unreachable. The box keeps its place in the page while lifted, so nothing moves when it comes back.
- **The words show beside the results from 1024 pixels wide**: the highlighted song, in the viewer's language or else the first community language the song has, with chords as on the song page. Narrower windows (phones, upright tablets) show the list only. It lets the operator check the song before Enter.
- **No feature switch**: it changes how Classic's search opens, and Classic is always on.

## Rejected

- Lunr in memory, as the old app did: another dependency and a rebuild at every start.
- Searching chord lines or section names: typing "Am" would match every song with an Am chord.
- A centered panel, or only a taller list, for the takeover: the whole window gives the list and the words the most room.
- The focus ring and the frame together, or the ring alone: on phones both showed at once, and the frame says plainly what Enter picks.
- The live commands among the empty box's actions: the live bar has them.
