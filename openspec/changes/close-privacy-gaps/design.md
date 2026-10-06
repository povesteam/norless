# Design

## Context

The privacy page (`src/client/app/PrivacyPage.tsx`) is built from the `privacy` strings, the communities' contacts and the server's `OPERATOR` and `PRIVACY_SERVICES` (split on `;`). `deleteAccount` (`src/server/auth/members.ts`) blanks the user, ends their sessions and memberships, deletes their personal records and keeps what they added without them. A recording's `owner_id` decides who may play, grant and delete it, and is `NOT NULL` in the schema.

## Goals / Non-Goals

**Goals:**
- Every period and fact on the privacy page is what the server does.
- The notice has the parts GDPR asks of it, short and plain, in en, ro and uk.
- A deleted account leaves no login link and no link to its recordings behind.

**Non-Goals:**
- Deleting the operator's own backup copies, or changing `deploy/mac-pull.sh`.
- Changing what usage events hold or how long they're kept.
- A legal review: the text is a draft (see Risks).

## Decisions

- **Backups pulled to the operator's computer are kept for good, and the notice says so**: they are the copy that survives losing the server. Pruning them would make the notice's 14 days true but leave a single 14-day window for recovery. Alternative: delete the Mac's copies after 14 days, rejected by the maintainer.
- **A deleted member's recordings stay for the team, open to it**: `owner_id`, `created_by` and `updated_by` become empty, so nothing ties the audio to the person. Nobody is left to grant access, so the team (owner and team roles, who see recordings) may play them without asking; otherwise they'd sit unplayable until an owner deleted them. The person's own access requests go with them. The notice and My account say so before the account is deleted, so a member who'd rather take their recordings with them deletes them first. Alternatives: delete the recordings with the account (the band loses its rehearsals), or keep only the access already granted (nobody else could ever listen).
- **Owners still delete a recording nobody owns**: the existing check (its maker or an owner) already lets an owner delete it; editors don't see recordings (`members` matrix), so they don't delete them either.
- **A migration lets `owner_id` be empty**: SQLite can't drop `NOT NULL`, so `008-unowned-recordings.sql` rebuilds `recordings` (the runner turns foreign keys off around it). Alternative: keep pointing at the blanked user row, rejected since it still links the recording to the person's id.
- **Login links go with the account**: they hold the address, which deletion removes everywhere else. They're found by the address read before it's blanked.
- **Legal bases**: the community's legitimate interest in organizing its services and team, and in seeing how Norless is used (usage events); login emails and notifications are sent because the person asked for them. Usage events stay for good, without the account once it's deleted, as they are.
- **Transfers**: only Google LLC is named under the EU-US Data Privacy Framework, for the login page and a login with Google. Push messages go through the browser's push service, which may be outside the EU; they're encrypted end to end, so the notice says it can't read them, without naming a safeguard per vendor.
- **Server logs**: Docker's local driver keeps 3 files of 10 MB, and a new version starts a new container, whose logs start empty. The notice gives both limits and "a few days or weeks", not a fixed time.
- **Cookies by name**: `__Host-session` (30 days, renewed), `__Host-google-nonce` (10 minutes, each time the login page offers Sign in with Google) and `__Host-google` (10 minutes, while logging in through Google's page). All are needed to log in, so there's still no banner.
- **The rights in one sentence, through the community's contact**: the community is the controller; the page already lists its contact above.

## Risks / Trade-offs

- [The text is a plain-language draft, not legal advice] → someone who knows GDPR checks the privacy notice in all three languages before cutover.
- [A team member hears a recording its maker never shared] → the maker was told before deleting, and can delete their recordings first.
- [The log period depends on traffic and deploys] → the notice says what bounds it instead of a number of days.
