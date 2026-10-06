# Proposal

## Why

There are 63 feature switches, and each costs a key, an icon, a branch in the graph, a name and a description in three languages, and a check in the interface. Fourteen of them are parts nobody would switch on alone (the year in songs without the Statistics page, the song history without the Chords mode), so they make the graph longer and the code heavier without giving owners a real choice. Decided with the maintainer on 2026-10-06.

## What Changes

- The Statistics page brings its rotation hint, year in songs, services grid and searches with no results (`rotation`, `yearRecap`, `servicesGrid`, `searchMisses` go).
- The Chords mode brings the song history, notation and reference recordings (`history`, `notation`, `referenceLink` go).
- The service roles bring My schedule, sign-ups, away dates and Led by (`mySchedule`, `signUps`, `blockouts`, `ledBy` go); notifications by push and playlist news then need the service roles.
- The app menu brings the keyboard shortcuts list (`shortcuts` goes), Who's here brings the notice of who changed the slide (`liveNotice` goes), and the circle of fifths comes with what shows a chord played: playing chords in and listening in the Chords mode, the live chord on the musicians view (`chordWheel` goes).
- 63 switches become 49. A stored switch for a removed key is ignored, as unknown features already are; there is no migration, since nothing is in production yet.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `feature-switches`: a switch covers a whole feature with its parts; the "taken away" example changes from the song history.
- `songs`: the song history shows while the Chords mode is on.
- `team-schedule`: the team features that arrive off are the service roles and notifications; Led by comes with the service roles.
- `chord-editing`: the circle of fifths is no longer its own feature.
- `instrument-layouts`: the Live chord layout always has the circle of fifths.

## Impact

- `src/shared/features.ts` (14 keys and their `needs`), `featureIcons` in `src/client/ui/icons.tsx`, `branchOf` in `src/client/app/tree-layout.ts`, the `features` strings in the three locales.
- The checks in Statistics, SearchBox, SongPage, ChordsMode, Instruments, App, CommunityNav, Vocalists, MusiciansPage, MySchedule, TeamSchedule, EntryList, RolesSettings, LiveBar and OnlineMembers move to the parent's key.
- Tests and seeds that name the removed keys: `src/shared/features.test.ts`, `src/server/app.test.ts`, `e2e/seed.ts`, `e2e/screenshots/views.ts`, `e2e/screenshots/shots/extras.ts`; the Features page's screenshots are taken again.
