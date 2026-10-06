# Design

## Context

A feature's key lives in four places that must agree: `features` (`src/shared/features.ts`, with the feature it `needs`), `featureIcons` (`src/client/ui/icons.tsx`), `branchOf` (`src/client/app/tree-layout.ts`) and the `features.<key>` strings in each locale. The interface checks a key with `useShows()`/`<Shown>`, or `shows(switchesOf(community), key)` on views without the app frame (musicians, vocalists). The server stores a community's switches as a map and drops unknown keys; feature requests for unknown keys are refused.

## Goals / Non-Goals

**Goals:**
- Every check of a removed key checks the parent's key, so the part shows exactly when its parent does.
- The feature graph, the What's new dialog and the feature requests know only the 49 remaining features.

**Non-Goals:**
- Merging other switches (the operator's small ones, such as times and problems, stay as they are).
- Changing what any part does once shown.

## Decisions

- **A part checks its parent's key, not an alias.** `shows("history")` becomes `shows("chords")`; no table mapping old keys to new ones, since nothing outside the code knows the old keys. Alternative: keep the keys as hidden aliases of the parent, rejected as a second name for the same thing.
- **Checks that the parent already guards go.** Where a part sits inside its parent's page or mode (the year in songs inside the Statistics page, notation inside the Chords mode), the extra check is deleted instead of renamed.
- **The circle of fifths has no switch.** In the Chords mode it shows with playing chords in or listening, which are what give it a chord to show; on the musicians view it is part of the Live chord layout (`liveChord`). The maintainer's pick was "the wheel into the live chord"; gating the Chords mode's wheel on `liveChord` too would hide it from a pianist placing chords in a community without stage views, so the Chords mode follows its own chord sources.
- **What needed a removed key needs its parent.** `pushNotifications` and `playlistNews` needed `mySchedule`, and now need `serviceRoles`.
- **No migration of stored switches.** Nothing is in production; the server already drops unknown keys, and the development database is imported again.

## Risks / Trade-offs

- [An owner who wants the services grid but not the rotation hint can't choose] → accepted; nobody asked for that, and a later switch can split one out again.
- [The Features page looks different] → its screenshots are taken again before archiving.
