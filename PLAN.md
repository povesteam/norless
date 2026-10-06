# Norless plan

## Goal

Song projection for communities that project several languages in sync (today: Romanian and Ukrainian). Open source. It will later extend to other small communities (churches, camps, choirs) and to offline use at camps.

## Where it stands

Built: what `openspec/specs/` describes, each capability with a `design.md` saying why it works that way. That covers the old app's features and the contributor extensions' (one playlist driving the RO and UA screens, output styling, print and copy, start and end pages), music and rehearsal (chord editing, instrument layouts, notation, tempo check, recordings, follow-along), presentation, imports and statistics (slides from files, practice rooms, English as a third language, song statistics, YouTube chapters and replays), and team scheduling (service roles, the team schedule, the church calendar, push notifications). The old app's data imports with its history, from a dump and its oplog, and the import runs again on the same database without losing what exists only in the new app.

Every feature beyond Classic arrives switched off; an owner switches features on one at a time (`feature-switches` spec).

Cutover prep comes first: the server and the cutover steps below, in the open change `add-deployment`.

## Next: cutover

1. A maintainer runs `deploy/setup.sh`: the GitHub repository and its secrets, the VM (a Hetzner CAX11 in Nuremberg on Debian), DNS, the VM's `.env` (a Mailgun sending key, a Google OAuth web client with `https://norless.com` as a JavaScript origin, the app team's emails, a YouTube Data API key; VAPID keys are generated), the Mac's backup pull, an uptime monitor on `/api/health`, GitHub Pages for the manual, and Nicolae Matei's invitation as maintainer.
2. Production on the VM, and a rehearsal with a real service (`add-deployment` 2.3). With the YouTube key set, check last Sunday's chapters against the video.
3. The Saturday-night re-import into production, rehearsed once (3.4); then the shadow Sunday beside the old app (3.2).
4. Cutover (3.3): rotate the old app's Mailgun credentials; the old app stays writable until two good Sundays, then read-only for 3 months, then redirected; the old repositories get a README line pointing here and are archived read-only. Once the old app is read-only, nothing is imported again: delete the importer (`src/server/import`, `npm run import`, the `bson` dependency, `run-reimport.sh`).

Also before or around cutover: a Norless logo (the old rainbow icon stands in), the Switzer font uploaded in Unu-Unu's theme settings, and the bible.com extension's side of sending verses (the requirement is in the `bible-com-projection` spec). The training videos' scripts are ready; filming waits until asked again (`add-deployment` 4.1).

## After cutover

- One or two features switched on a week, what the team asked for first, each announced by What's new (`add-deployment` 4.2).
- A code pass over the UI review's findings, after the shadow Sunday.
- Waiting on others: melodia.ro (an API agreed with its owner: search, import with attribution and a source link; resursecrestine.ro only with permission, links until then), the chord helper (testing with a real piano).
- Needs a choice first: Electron, so phones join the laptop over local Wi-Fi offline (a new dependency and code signing); the AI features (a provider and an API key).

## Later, not scheduled

**Multiple communities** (not planned while only one church uses Norless; the community in every URL and table stays, since it costs nothing):
- Signup, invitations, a community switcher.
- Privacy (GDPR): each community is the controller of its members' data and sets its contact; the Norless operator is the processor, with terms of service and a data processing agreement; a public list of sub-processors; export and deletion of a community's data. To check with someone who knows GDPR before launch.
- Open question: should communities share a song library? Song copyright varies.

**Offline beyond one laptop.** The laptop already works offline as an installed app (`offline` spec). Phones joining it at a camp need it to run the server on local Wi-Fi:

| Option | Laptop + projectors | Phones on local Wi-Fi | Cost |
|---|---|---|---|
| Installed PWA | yes | no (a browser can't run a server) | nothing extra |
| Electron app | yes | yes (the bundled Node runs the same server) | ~150 MB installer; code signing |
| Tauri app | yes | only with Node as a sidecar | smaller installer, adds Rust |

At a camp: everyone who joins sees the lyrics on their phone (there may be no projector at a campfire); joined phones can follow the laptop or browse songs, and ask for a song, which the operator accepts or ignores; the laptop shows the Wi-Fi name, the address, a QR code and a PIN, who joined, and what waits for the internet; it serves plain http on the local network, with the QR code and an IP address as the fallback where `norless.local` doesn't resolve. Phones join with the PIN until the app closes; only songs, the Bible and playlists are kept on devices, no member emails.

**Ideas:**
- Video files in a playlist, with play, pause and seek kept in step on every screen and the sound on one.
- A choir layout (voice part, who sings each line from `!` notes, the first note), when a choir uses Norless.
- Wrist cues on smartwatches for the drummer, the worship leader and the preacher (a native watch app).
- Behringer X32: a mixer snippet per entry, confirmed by the sound person, with channel meters; browsers can't send its OSC messages, so it needs a local bridge, such as the Electron app.
- Generic webhooks: Norless calls URLs on events (an entry goes live, a service starts or ends), so Home Assistant or anything else can follow.
- A native Bible, if the bible.com extension ever falls short.

**Dropped** (from the layout review): an interpreter view, signals from the worship leader to the band, requests from the stage to the operator, a nursery call on the screens, voting for next Sunday's songs, MIDI input beyond a piano's chords, a Loop button, a "what the band sees" strip on the laptop, arming a part to send it later, H as a note name, and locking stage devices during services.

## AI, not scheduled

Principle: **AI suggests, a person approves.** Nothing is applied automatically; every suggestion is a diff that an editor accepts or rejects, and each AI feature needs an owner's opt-in.

1. Typo and formatting fixes: spelling, diacritics (ş→ș), section names, line breaks, chord alignment, and tags (theme, occasion), as one reviewable diff; directions written as lyrics, like "(Unison fete)", turned into `!` notes so they stop being projected.
2. Intake from messages and screenshots: a song from pasted text or a hymnal photo, with a duplicate check; a song list or a service program from WhatsApp becomes a draft playlist, unknown songs flagged, Bible references and dividers recognized.
3. Translations and matching: draft translations for an editor, and the same song found across languages.
4. Search by meaning and suggestions: "songs about grace", a half-remembered line, songs for a sermon's theme, setlists that fit keys and rotation, new songs to learn; an "ask" box in the playlist ("a calmer song in A after the sermon"). Locally: a small multilingual embedding model on the server (@huggingface/transformers) and a plain cosine loop over the songs, no vector database.
5. Live sermon subtitles RO↔UA (not a priority).
6. Translating slides from files into the community's other language.

**Providers.** A few dozen requests a week, plus one-off passes over the library. Free tiers fit the volume but some train on inputs (fine for public lyrics, not for messages with names and phone numbers) and smaller models are weaker at Romanian diacritics and Ukrainian. A paid tier without training costs about $0.01 to $0.02 per song for a typo pass, and well under $1 a month in normal use. Choose the provider with the first AI feature, keep all AI calls in one module, prototype on public lyrics only, and use a tier without training for anything with personal data.

## Related work

- [norless-improvements-extension](https://github.com/unu-unu-ro/norless-improvements-extension) by Nicolae Matei: the RO→UA sync, output styling, print and copy, start and end pages that Norless now has natively.
- [chrome-bible-utilities](https://github.com/nmatei/chrome-bible-utilities) ("Project verses from bible.com"), by the same author: Norless sends it slides and receives verses from it (`bible-com-projection` spec).
