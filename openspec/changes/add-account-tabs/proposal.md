# Proposal

## Why

My account kept growing (photo, logging in other devices and guests, the musician profile, this device, the app team's pages, counting usage, logging out, deleting the account, About), and it couldn't show where else one is logged in or log a lost device out from here. Its musician section explained plain chords in a long paragraph, dropped the examples once plain chords were on, and named them in letters whatever the member reads. The maintainer asked on 2026-10-07 for the login actions grouped with a list of sessions, and for tabs like Settings; decided with him the same day.

## What Changes

- My account in five tabs with their own addresses (`/account/<tab>`), a list on a phone as Settings: Profile, Music, Logins, This device, About. A laptop's or a guest's login has Logins and This device. Who is logged in shows above the tabs.
- Logins: where you're logged in (this device first; the others by browser and system, and when last used), each with Log out; the laptops and guests you logged in; Log in another device; Guest pass; Log out here or everywhere.
- Sessions keep the browser they're used from and when they were last used (at most once an hour); `GET /api/me/sessions` lists them, `DELETE /api/me/sessions/:id` ends another one.
- Music: each instrument with its icon; what the chord colors mean behind a button beside Plain chords; the examples stay with plain chords, in one color, and name the degrees as the member names chords.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `auth`: My account in tabs; the list of sessions, each logged out from here.
- `app-shell`: About, Privacy and Install in My account's About tab.
- `offline`: the switch in My account's This device tab.
- `feedback`: the app team's pages in My account's About tab.
- `instrument-layouts`: the Music tab's icons, the colors' explanation, the examples.

## Impact

- `migrations/009-session-devices.sql` (two columns on `sessions`); `src/server/auth/auth.ts` (records them), `src/server/auth/sessions.ts` (new: the list and logging out one), `src/server/app.ts`.
- `src/client/account/AccountPage.tsx` (tabs), `Logins.tsx` (new), `MusicianProfile.tsx`; `src/client/app/App.tsx` (`/account/:tab`); the locales.
- e2e: the tests that open My account go to their tab; a sessions test in `auth.spec.ts`; the account screenshots; the manual's pages on logging in, the stage and offline.
- Builds on `fix-phone-review`'s texts for `auth`, `app-shell`, `offline` and `feedback`: archive that change first.
