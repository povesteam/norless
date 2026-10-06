# Proposal

## Why

A visitor who opens Norless between services lands on the next service's playlist, which the team is still preparing: songs may change, and the songs the visitor heard last Sunday aren't there. Decided with the maintainer on 2026-10-06: visitors see the last service held when nothing is live.

## What Changes

- Opening the app without a playlist URL, a visitor (not a member) gets the playlist of the service under way or, between services, of the last one held (within 60 days); without one, the newest playlist, as now.
- Members keep the service under way or next, which they prepare.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `playlists`: the home's playlist depends on whether the person is a member.

## Impact

- `src/server/playlists/playlists.ts` (`heldServicePlaylist`), the playlist list's response (`held`), `CommunityHome` in `src/client/app/App.tsx`.
- `src/server/playlists/next-playlist.test.ts`.
