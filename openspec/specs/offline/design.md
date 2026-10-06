# Offline design

Why projecting without internet works as the spec says.

## Decisions

- **Project only, no sync**: the use is a laptop at a camp, so the device keeps songs and playlists, makes temporary playlists, and sends nothing back.
- **A switch per device, off by default**: it costs storage and downloads, and only the camp laptop needs it. Nothing personal is kept: no names, emails, likes or history. Songs are public anyway, and the data is members only like the rest of a member's data.
- **One response in Cache Storage** (`norless-offline`): the community's name and languages, every song in the text format projectors read, and the 5 newest playlists without who added what. About 4 MB for 1,500 songs.
- **Slides pages come as 4K only**: the keeper caches the 4K page of each slides entry, and the service worker answers any width of a page with it when there is no network.
- **Kept again at most every 10 minutes**, when the frame opens and when songs, playlists or entries change, so a busy Sunday doesn't download everything again and again.
- **The offline page sits outside the community frame**, which needs the server. The service worker opens it without internet, and the Offline notice links to it only on a device that keeps songs.
- **Projecting reuses local projection**: a projector window of the same browser through a BroadcastChannel, fed from the kept songs, so nothing is fetched.
- **Temporary playlists live in the browser's storage**, on that device only.
- **Search**: every word of the query in the title, or in the title or the words, accents and case ignored; titles first, 20 at most.
- **"Without internet" means the live connection is down**, not the browser's online flag: a camp router with no internet still says online. Switching off then asks with the browser's confirm, since what was kept can't come back.

## Rejected

- Editing kept songs or playlists offline, and syncing anything back.
- Phones on the laptop's wifi, and logging in offline: a larger offline mode, not this one.
