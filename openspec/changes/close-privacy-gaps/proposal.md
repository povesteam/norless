# Proposal

## Why

The privacy notice says things the server doesn't do, and leaves out parts GDPR asks for. Backups are said to be gone within 14 days, while the copies the maintainer's Mac pulls are kept for good; server logs are said to last a few days, while they are capped by size; it names one cookie, while logging in with Google sets two more; it doesn't list the browsers' push services; and it has no legal basis, no right to complain, nothing on transfers outside the EU or on children. Deleting an account also leaves the person's login links and their link to their recordings behind. Decided with the maintainer on 2026-10-06.

## What Changes

- Backups: the notice says 14 days on the server, and that the operator's own copies are kept. `deploy/mac-pull.sh` doesn't change.
- Recordings: deleting an account keeps its recordings for the team, with nothing linking them to the person (`owner_id`, `created_by` and `updated_by` become empty, which a migration allows for `owner_id`), and the person's own access requests go. Every member with the owner or team role can then play them; the community's owners can still delete them.
- Usage events stay as they are; the notice gives their legal basis and says they stay without the account once it's deleted.
- The notice gains, in en, ro and uk: the legal bases (the community's legitimate interest in organizing its services and team and in seeing how Norless is used; login emails and notifications because the person asked), the rights of access, rectification, erasure, restriction, objection and portability through the community's contact, the right to complain to ANSPDCP, the transfer to Google LLC under the EU-US Data Privacy Framework and the push services, and that people under 16 join with a parent's or guardian's agreement.
- Cookies: the notice names `__Host-session`, `__Host-google-nonce` and `__Host-google`, with their lifetimes; all are strictly necessary, so still no banner.
- Processors: `PRIVACY_SERVICES` adds the browsers' push services (Google, Apple, Mozilla).
- Server logs: the notice says they go once they fill 30 MB, and with each new version.
- Login links: deleting an account deletes the links sent to its address. The invitation's lifetime in the notice is corrected to two days.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-shell`: the Privacy notice requirement covers legal bases, rights, complaints, transfers, children, accurate periods, the cookies by name, and what account deletion does to recordings and login links.
- `rehearsal-recordings`: a deleted member's recordings stay for the team without a name, open to the team, and owners can delete them.
- `members`: the permission matrix lets the team listen to a recording once its maker's account is deleted.

## Impact

- `src/server/auth/members.ts` (`deleteAccount`), `src/server/live/recording-view.ts` (access to a recording nobody owns), a new migration `migrations/008-unowned-recordings.sql`.
- Tests in `src/server/auth/members.test.ts` and `src/server/live/recordings.test.ts`.
- The `privacy` strings and `account.deleteHelp` in en, ro and uk, and `src/client/app/PrivacyPage.tsx` for the new paragraphs.
- `deploy/compose.yaml`: `PRIVACY_SERVICES`, and the logs' comment.
- The privacy page's e2e (`e2e/about.spec.ts`) checks the new cookie text and the complaint.
