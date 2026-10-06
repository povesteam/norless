# Plays design

Why plays and the slide log are recorded the way the spec says.

## Decisions

- **30 seconds makes a play**: a quick check before the service, or a song shown by mistake, doesn't count. The play is written when another entry replaces the song, or when the screens were blanked and something else goes live; `ended_at` is that moment. A play still live when the server stops is lost.
- **Blank time belongs to the play**: a prayer in the middle of a song doesn't shorten it. Moving between slides of one song adds nothing; going back to the song after another entry is a second play, so a song repeated at the end of a service counts twice.
- **Every play is saved, whatever the mode**: rehearsals and imported plays are kept, but anything that reports how often or when counts service plays only, so rehearsing a song doesn't make it look sung. Unclassified imported plays count for nothing until classified.
- **Practice rooms keep their own plays**: they are rehearsals unless the starter switched the room to service, and each play keeps its room. A practice's plays and slides stay out of the service's YouTube chapters and recordings, which belong to the main room, so a practice can't end up in the service's video description.
- **The slide log is a table of its own** (`slide_log`), beside the live log that keeps one row per entry for the chapters. The old app's oplog import fills the same table for earlier years.
- **A row only when the screens change**: another entry, slide, blank or shown again. A repeated press that changes nothing adds none.
- **The song is stored with the entry**: a song's history survives its playlist entry being removed, and imported changes whose entry wasn't imported still count for their song.
- **Not announced to open views**: no view shows the slide log, and a slide change already reaches every device on the live topic.
- **Why keep every slide change**: it gives exact song lengths, which parts get repeated, how long the screens stay blank and who ran the slides, which the old app's oplog showed.

## Rejected

- Recording a play at 10 seconds: a quick check would count.
- Counting rehearsal plays in statistics by default: statistics should reflect real services. They are counted only when the user asks.
