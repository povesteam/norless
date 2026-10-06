# Tasks

## 1. Features

- [x] 1.1 Remove the 14 keys from `features` in `src/shared/features.ts` and make `pushNotifications` and `playlistNews` need `serviceRoles`; drop them from `featureIcons` and `branchOf`, and their `features.<key>` strings in en, ro and uk. Verify with `src/shared/features.test.ts` (rewritten to use `chordColors` instead of `history`, plus a test that the parts' keys are gone) and `npm run typecheck`, which flags every remaining check of a removed key
- [x] 1.2 Statistics: drop the `rotation`, `yearRecap`, `servicesGrid` and `searchMisses` checks inside the Statistics page; the rotation hint in the search box checks `statistics`. Verify with `e2e/statistics.spec.ts`
- [x] 1.3 Chords: the song history and reference recordings on the song page check `chords`; drop the checks inside the Chords mode and the instrument layouts' notation check on `notation` (it checks `chords`). Verify with `e2e/song.spec.ts` and the music e2e
- [x] 1.4 Team: `mySchedule`, `signUps`, `blockouts` and `ledBy` checks become `serviceRoles` (App, CommunityNav, Vocalists, MusiciansPage, MySchedule, TeamSchedule, EntryList, RolesSettings), dropping those already inside a page that needs the service roles, and the `signUps` prop where it's always on. Verify with `e2e/team.spec.ts`
- [x] 1.5 Strays: the shortcuts list checks `appFrame`, the live notice checks `presence`, and the `wheel` prop goes from PlayPanel, Musicians, MusiciansSong and LiveChordView (always shown). Verify with the live and music e2e
- [x] 1.6 Seeds and tests: `src/server/app.test.ts`, `e2e/seed.ts`, `e2e/screenshots/views.ts` and `e2e/screenshots/shots/extras.ts` stop naming the removed keys. Verify with `npm run check` and the full e2e run

## 2. Specs and screenshots

- [x] 2.1 Take the Features page's screenshots again (`npm run screenshots -- -g features`) and look at the graph with 49 nodes
- [x] 2.2 When archiving, update `openspec/specs/song-statistics/design.md` ("Each view is its own feature switch") and the `feature-switches` design.md with this change's decisions
