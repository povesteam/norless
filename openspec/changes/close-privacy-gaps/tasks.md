# Tasks

## 1. Account deletion

- [x] 1.1 Add `migrations/008-unowned-recordings.sql`, rebuilding `recordings` with `owner_id` nullable
- [x] 1.2 In `deleteAccount`, empty `owner_id`, `created_by` and `updated_by` of the person's recordings (and their devices'), delete their access requests, and delete the login links sent to their address. Verify with `src/server/auth/members.test.ts`
- [x] 1.3 In `recordingFor`, a recording nobody owns is granted to every viewer (the routes already limit them to owners and the team). Verify with `src/server/live/recordings.test.ts`: the team plays a deleted member's recording without asking, it has no name, and an owner deletes it

## 2. Privacy notice

- [x] 2.1 Rewrite the `privacy` strings in en, ro and uk: backups, logs, links, usage, recordings, legal bases, transfers, children, cookies, rights, the complaint and deletion; and `account.deleteHelp`
- [x] 2.2 Add the transfers, children and complaint paragraphs to `PrivacyPage.tsx`
- [x] 2.3 Add the browsers' push services to `PRIVACY_SERVICES` in `deploy/compose.yaml`, and correct the logs' comment
- [x] 2.4 Run `e2e/about.spec.ts`, `e2e/members.spec.ts`, `e2e/device-login.spec.ts`, `e2e/device.spec.ts` and `e2e/files/recordings.spec.ts` (no screenshot set shows the privacy page, and only its text changed)

## 3. Archive

- [ ] 3.1 Before cutover, someone who knows GDPR checks the notice in all three languages
- [ ] 3.2 When archiving, update the Privacy decision in `openspec/specs/app-shell/design.md` (the cookies, the operator's copies) and add the recordings decision to `openspec/specs/rehearsal-recordings/design.md`
