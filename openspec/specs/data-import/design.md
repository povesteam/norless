# Data import design

Why the import of the old Romanian and Ukrainian databases works as the spec says: re-runnable, read-only on its source, and careful with what people changed since.

## Decisions

- **The archive is read directly**: gunzip plus a loop over BSON documents with the `bson` package. The format is a magic number, a header, collection metadata, then interleaved blocks of one namespace each. It checks the magic number and the version and fails loudly on anything else. No MongoDB server or Docker is needed to import, and the old server's MongoDB is too old for a current driver anyway.
- **A pure transform between thin I/O**: read the archive, `transform` applies every rule and returns rows plus a report, `write` upserts everything in one transaction. The rules are unit-tested on small synthetic fixtures, never on real data. A failed import changes nothing.
- **Stable ids from old ids**: an imported record's id is a hash of `norless-import`, its source (`ro`, `ua`, or `shared` for records merged across both), its collection and its old id, in the same 12-character shape as every id. A re-run hits the same rows, and references (entry to song, play to song) are computed without database lookups.
- **The app's own edits win**: an upsert changes a row only while its `updated_at` still equals its `imported_at`. A row someone changed in the app is left alone and listed in the report. Songs and versions an earlier import made and this one doesn't (a UA song joined to its RO song since) are soft-deleted under the same rule, keeping `updated_at = imported_at`, so an import can bring one back.
- **Read-only and one-way**: the command never modifies the archives, and a fresh backup is taken with `mongodump`, which only reads. Nothing is written back to the old app. A change to what the import makes reaches a local database by importing again from scratch, not by migrating imported data.
- **No personal data in the repo or the report**: fixtures are synthetic, dumps stay outside the repo, and the report holds counts and old ids, never names, emails or lyrics. From the old users only the username, email addresses, creation date and last login are read; password hashes, login tokens and IP addresses never enter memory.
- **Imported accounts can't log in**: logins are Google or email links in the app, so old password hashes are useless. People are merged by lowercase email across both databases and listed for an owner to invite or delete one by one.
- **Songs join by id, then by a hand-made list**: the UA database was cloned from the RO one, so a shared id is one song. UA songs added again under a new id, and UA copies overwritten with another song, are matched by a hard-coded list (RO title as a comment, so a mistake is a one-line fix). Each pair was confirmed by reading the texts line by line, since a title match found only a third of them.
- **Script and shape decide, not lists**: a UA text with Cyrillic is the `uk` version; identical text means no `uk` version; an RO text in Cyrillic with a UA text without it means the languages are swapped (Ukrainian carols kept in the RO app). Where a song gets several UA texts, Cyrillic wins, then the song's own id over a matched one, and the rest are counted as merged.
- **Entries and plays follow their own app**: an old song id joins the song it joined in the app the entry or open comes from. A few matched UA ids also exist in RO as empty songs that RO playlists use, and those resolve to the matched song.
- **Anomalies are reported, not guessed**: the same id with different non-Cyrillic text keeps the RO text and is listed for review; entries without a kind, empty songs and unmatched titles are skipped and counted; untitled songs take their first line as title.
- **English from a checked list**: songs the RO app holds in English were found by their words (English words outnumbering Romanian two to one, over 15% of the text), then read one by one into a hard-coded list. Bilingual songs stay Romanian.
- **Keys and chords in letters**: Do-Re-Mi is converted with the code that transposes chords, by zero half steps, keeping columns where there's room, so search, transposing and the chord track see one format. A key that isn't a key ("Sol + La") stays as written.
- **Chords go to the track after writing**: the import writes each text as the old app stored it, then takes its chords to the song's chord track, so imported and new songs are stored alike.
- **The oplog adds what the backup lacks**: the old server's oplog holds every write it saw, from its start to the day it was copied. It gives each song's earlier states as History revisions (the whole song before each save, with both languages as they stood, and no author, since the old app didn't record one), every slide the Romanian screens showed, and exact times and removers for playlists and entries.
  - Only the Romanian app's live object is read: the Ukrainian app had its own, and both would count each service twice.
  - The oplog's first hour is a restore, not records created then, so those times stay as the backup has them.
  - A cleared screen is a blank slide with no entry or song.
  - A play ends when the screens moved on within 3 minutes of its start and it lasted under 45 minutes. Others keep no end, and the time estimates treat them as before.
  - Revisions and slides are keyed on their oplog position and inserted once, so importing again adds nothing twice. Importing without history needs no oplog.
- **Plays are classified from the schedule**: each old open is first an unclassified play, then classified with the community's time zone through `Intl.DateTimeFormat` (stdlib, daylight saving included). The known service history is hard-coded; the owner can fix the schedule and classify again with the same function the live app uses.
- **The date leaves the title**: the app shows a playlist's date from data in each viewer's language, and a date stored in the title would stay in one. A leading day and month (Romanian or English, any case, optional weekday and year) becomes the playlist's date; a missing year is taken from the creation time. Titles without a date keep their title and take the creation day. Titles starting with digits that aren't a date are counted in the report.
- **Left out on purpose**: Bible verse text (entries keep book, chapter and verses), the old `melodia` fields beyond title, text, author and key, and the old app's logins and devices.

## Rejected

- Restoring the archive into a temporary MongoDB: it needs Docker or a Mongo server wherever the import runs, and current drivers need a newer server than the old 3.2.
- Random ids plus lookups by old id: the same result with more code.
- A two-way sync during the transition: the old app is a fallback and a source, never a target.
- Matching UA songs by title alone: Russian titles and duplicate RO candidates left most unmatched.
- Merging duplicate RO songs, or fixing the Russian texts in `uk` versions: they are what the UA room projects, and cleaning the library is for editors.
- Importing password hashes or auto-linking people on first login: an owner decides who gets in.
