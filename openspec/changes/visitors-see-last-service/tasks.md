# Tasks

## 1. Visitors' home

- [x] 1.1 `heldServicePlaylist` in `src/server/playlists/playlists.ts`, sharing the schedule's loading with `servicesFrom`; `held` in the playlist list's response. Verify with `src/server/playlists/next-playlist.test.ts`
- [x] 1.2 `CommunityHome` opens `held` for visitors and `next` for members, once `me` is known. Verify with the playlists and auth e2e
- [ ] 1.3 When archiving, fold the decisions into `openspec/specs/playlists/design.md`
