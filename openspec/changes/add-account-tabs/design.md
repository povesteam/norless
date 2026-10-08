# Design

## Context

My account was one long page, sections one under the other. A session row held only its token's hash, the user and its dates, so Norless couldn't say where a person was logged in; "Log out everywhere" was the only way to end another session. Settings already has tabs with their own addresses, and a list of sections on a phone.

## Goals / Non-Goals

**Goals:**
- My account stays short as it grows: one part at a time, each with an address.
- A person sees where they're logged in and ends one place from another.

**Non-Goals:**
- Showing or changing another device's settings: decided with the maintainer to keep them on each device (the device type, offline songs); the layouts and the stage views' look already follow the account per device type.
- Locations: no IP lookup, only the browser's own description.

## Decisions

- **Five tabs, as Settings.** Decided with the maintainer, 2026-10-07: Profile, Music, Logins, This device, About, each at `/account/<tab>`; on a phone, a list whose sections open on their own pages with a link back to it. `/account` opens the first tab on a laptop and the list on a phone, so the photo still opens My account. A laptop's or a guest's login has Logins and This device only: it has no profile, music or app team. Who is logged in shows above the tabs, as the laptop's login needs it too. Alternatives: one Devices tab with this device and the sessions (4 tabs); the sessions on a page of their own.
- **Sessions remember their browser and last use.** On each API request with a session, the server keeps the User-Agent and the time, at most once an hour or when the User-Agent changes, so no login path needs changing. The list names a session by browser and system ("Chrome on Android", from a short parse of the User-Agent, with no dependency), and by its last use; it identifies one by the first 16 characters of the token's hash, which names it without giving a way in. The device's own session isn't logged out from the list: Log out is for that.
- **The laptops and guests stay their own list.** They're users of their own with sessions of their own (`device-login` spec), listed under the sessions as before, with End.
- **What the colors mean, behind a button.** Decided with the maintainer, 2026-10-07: an ⓘ beside Plain chords opens the paragraph; the examples stay under the switch with plain chords, in the chord color, and name C major's chords as the member names chords (letters, Do-Re-Mi, numbers). With the community's naming chosen, the examples use letters, since My account belongs to no community.
- **Icons on "I play".** The instruments' icons from `instrumentIcons`, as the phone bar's stage view button shows them.

## Risks / Trade-offs

- [A User-Agent that lies or says little shows as "A browser"] → the last use still tells sessions apart.
- [An extra write on many requests] → at most one per session an hour.

## Migration Plan

`009-session-devices.sql` adds two nullable columns; sessions made before it fill them on their next use. This change builds on `fix-phone-review`'s texts for `auth`, `app-shell`, `offline` and `feedback`, so that change is archived first.
