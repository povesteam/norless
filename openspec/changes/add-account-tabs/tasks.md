# Tasks

## 1. Sessions

- [x] 1.1 `009-session-devices.sql`; the session hook keeps the User-Agent and the last use, at most hourly
- [x] 1.2 `GET /api/me/sessions` and `DELETE /api/me/sessions/:id` (`sessions.ts`, with the User-Agent's browser and system). Unit tests: the list, ending another, not one's own or someone else's

## 2. My account

- [x] 2.1 Tabs at `/account/<tab>`, a list on a phone; a laptop's or guest's login has Logins and This device; who is logged in above
- [x] 2.2 Logins (`Logins.tsx`): the sessions with Log out each, the approved devices, Log in another device, Guest pass, Log out. Verify in `e2e/auth.spec.ts`
- [x] 2.3 Music: instruments' icons, the colors' explanation behind ⓘ, the examples kept with plain chords and named as the member names chords. Verify in `e2e/music/instruments.spec.ts`
- [x] 2.4 The e2e tests that open My account go to their tab; the manual's pages

## 3. Screenshots and archive

- [x] 3.1 Take the account screenshots (`account`, `account-logins`) and check them
- [ ] 3.2 Full `npm run e2e`; archive after `fix-phone-review`, folding the decisions into `auth/design.md` and `instrument-layouts/design.md`
